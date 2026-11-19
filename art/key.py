# 緑背景(グリーンバック)のキャラ絵を透過PNGにする  python art/key.py
# 草のキャラは本人も緑なので「外周とつながった背景色の領域」だけを抜く
import os
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'blender', 'out')   # export.py が WebP にする


def key(name, soft=(38, 105), conn=150, nogreen=False):
    im = np.asarray(Image.open(os.path.join(HERE, 'src', name + '.webp')).convert('RGB')).astype(np.float32)
    h, w, _ = im.shape
    border = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]])
    bg = np.median(border, axis=0)
    d = np.sqrt(((im - bg) ** 2).sum(axis=2))
    # 外周から、背景に近い色だけをたどって届く領域
    cand = d < conn
    lab, n = ndimage.label(cand)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    reach = np.isin(lab, edge[edge > 0])
    # 閉じたすき間(腕と体の間など)も、背景色にとても近ければ抜く
    closed = (d < soft[0] + 12) & ~reach
    region = reach | closed
    a = np.clip((d - soft[0]) / (soft[1] - soft[0]), 0, 1)
    alpha = np.where(region, a, 1.0)
    if nogreen:
        # 炎・水のキャラは本来の緑がないので、緑の強さそのもので透明度を決める(すけた炎や水しぶきも自然に抜ける)
        ge = im[..., 1] - np.maximum(im[..., 0], im[..., 2])
        alpha = np.minimum(alpha, 1 - np.clip((ge - 25) / (bg[1] - max(bg[0], bg[2]) - 25), 0, 1))
    alpha = ndimage.grey_opening(alpha, size=(2, 2))           # 1px のゴミを消す
    # ふちの緑かぶりを取る: 半透明部分は背景を差し引いて元の色にもどす
    A = np.maximum(alpha, 1e-3)[..., None]
    fg = (im - (1 - A) * bg) / A
    edge_zone = (alpha < 0.999) | ndimage.binary_dilation(alpha < 0.5, iterations=2)
    g_lim = np.maximum(fg[..., 0], fg[..., 2]) * 1.05 + 10
    fg[..., 1] = np.where(edge_zone & region, np.minimum(fg[..., 1], g_lim), fg[..., 1])
    if nogreen:
        fg[..., 1] = np.minimum(fg[..., 1], np.maximum(fg[..., 0], fg[..., 2]))
    out = np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    img.save(os.path.join(OUT, 'chara_%s_full.png' % name))
    # カード用: 顔〜胸のあたりを正方形に切り出す
    ys, xs = np.nonzero(alpha[: h // 3] > 0.5)
    cx = int(np.median(xs)) if len(xs) else w // 2
    s = 470
    x0 = int(np.clip(cx - s / 2, 0, w - s))
    crop = img.crop((x0, 45, x0 + s, 45 + s)).resize((320, 320), Image.LANCZOS)
    crop.save(os.path.join(OUT, 'chara_%s.png' % name))
    print(name, 'bg', bg.round(), 'cut %.0f%%' % (100 * (alpha < 0.5).mean()))


key('fire', nogreen=True)
key('water', nogreen=True)
key('grass')
