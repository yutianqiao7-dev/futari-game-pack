# かいせんバトル: もらった画像から海面と軍艦を切り出す  python art/sea_extract.py
#   src/sea_water.webp … ゲーム画面の見本(盤面の海を使う。マス目の線は消す)
#   src/sea_ships.png  … 同じ配置の軍艦だけの絵(緑背景)
import os
import numpy as np
from PIL import Image, ImageEnhance
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'blender', 'out')      # export.py が WebP にする
X0, Y0, X1, Y1 = 18, 192, 455, 629                               # 盤面の内側(枠の内側)
CELL = (X1 - X0) / 8


def water():
    im = np.asarray(Image.open(os.path.join(HERE, 'src', 'sea_water.webp')).convert('RGB')).astype(np.float32)
    b = im[Y0:Y1, X0:X1].copy()
    n = b.shape[0]
    lum = b.mean(axis=2)
    # マス目の線の位置: 等間隔の位置の近くで、縦(横)にそろって明るい列(行)を探す
    def lines(prof):
        out = []
        for k in range(1, 8):
            c = int(round(k * CELL))
            win = range(max(0, c - 4), min(n, c + 5))
            base = np.median(prof[max(0, c - 12):c + 12])
            hits = [i for i in win if prof[i] > base + 6]
            if not hits:
                hits = [max(win, key=lambda i: prof[i])]
            out.append((min(hits), max(hits)))
        return out
    cols = lines(lum.mean(axis=0)); rows = lines(lum.mean(axis=1))
    # 線の部分を、すぐ横(下)の海の模様で上書きする(ぼかすと線のあとが残るため)
    fill = b.copy()
    M = 4                                   # 線のまわりの、にじみも含めて消す幅
    def patch(a, z, axis):
        w = (z - a + 1) + 2 * M
        lo = max(0, a - M); hi = min(n, lo + w)
        src = hi + 2 if hi + 2 + (hi - lo) <= n else lo - 2 - (hi - lo)     # 右(下)が無ければ左(上)から
        seg = fill[:, src:src + (hi - lo)] if axis == 1 else fill[src:src + (hi - lo), :]
        t = np.minimum(np.arange(hi - lo) + 1, np.arange(hi - lo)[::-1] + 1) / 2.5
        t = np.clip(t, 0, 1)                                            # ふちはなじませる
        t = t[None, :, None] if axis == 1 else t[:, None, None]
        if axis == 1:
            fill[:, lo:hi] = fill[:, lo:hi] * (1 - t) + seg * t
        else:
            fill[lo:hi, :] = fill[lo:hi, :] * (1 - t) + seg * t
    for a_, z_ in cols:
        patch(a_, z_, 1)
    for a_, z_ in rows:
        patch(a_, z_, 0)
    fill = fill[3:-3, 3:-3]                 # 枠のにじみを落とす
    sea = Image.fromarray(np.clip(fill, 0, 255).astype(np.uint8)).resize((640, 640), Image.LANCZOS)
    sea.save(os.path.join(OUT, 'sea_water_mine.png'))
    # 敵の海: 同じ海を少し暗く、紺に寄せる
    e = np.asarray(sea).astype(np.float32)
    e = e * np.array([0.7, 0.72, 0.92]) + np.array([6, 0, 14])
    enemy = ImageEnhance.Brightness(Image.fromarray(np.clip(e, 0, 255).astype(np.uint8))).enhance(0.85)
    enemy.save(os.path.join(OUT, 'sea_water_enemy.png'))
    print('water ok, lines', cols, rows)


def ships():
    im = np.asarray(Image.open(os.path.join(HERE, 'src', 'sea_ships.png')).convert('RGB')).astype(np.float32)
    bg = np.median(np.concatenate([im[0], im[-1]]), axis=0)
    ge = im[..., 1] - np.maximum(im[..., 0], im[..., 2])               # 緑の強さ(軍艦には緑がない)
    bge = bg[1] - max(bg[0], bg[2])
    alpha = 1 - np.clip((ge - 25) / (bge - 45), 0, 1)
    alpha = ndimage.grey_opening(alpha, size=(2, 2))
    A = np.maximum(alpha, 1e-3)[..., None]
    fg = (im - (1 - A) * bg) / A
    fg[..., 1] = np.minimum(fg[..., 1], np.maximum(fg[..., 0], fg[..., 2]) * 1.02 + 4)   # 緑かぶりを取る
    rgba = np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    lab, n = ndimage.label(alpha > 0.5)
    boxes = [s for s in ndimage.find_objects(lab) if (s[0].stop - s[0].start) * (s[1].stop - s[1].start) > 300]
    S = 128                                   # 書き出すときの1マスの大きさ(px)
    k = S / CELL

    def place(sl, L, vert):
        pad = 3
        x0, x1 = sl[1].start - pad, sl[1].stop + pad
        y0, y1 = sl[0].start - pad, sl[0].stop + pad
        piece = img.crop((x0, y0, x1, y1))
        piece = piece.resize((round(piece.width * k), round(piece.height * k)), Image.LANCZOS)
        W, H = (S, S * L) if vert else (S * L, S)
        canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        canvas.alpha_composite(piece, ((W - piece.width) // 2, (H - piece.height) // 2))
        return canvas

    def find(x, y):
        for s in boxes:
            if s[1].start <= x < s[1].stop and s[0].start <= y < s[0].stop:
                return s
        raise ValueError('ship not found at %d,%d' % (x, y))

    picks = {(3, 'h'): find(320, 216), (3, 'v'): find(318, 380), (2, 'v'): find(372, 410), (4, 'h'): find(240, 490), (2, 'h'): find(72, 547)}
    for (L, o), sl in picks.items():
        place(sl, L, o == 'v').save(os.path.join(OUT, 'sea_ship%d_%s.png' % (L, o)))
    place(picks[(4, 'h')], 4, False).rotate(90, expand=True).save(os.path.join(OUT, 'sea_ship4_v.png'))
    print('ships ok', len(boxes))


water()
ships()
