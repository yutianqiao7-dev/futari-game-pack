# Gemini などで作ったグリーンバック(またはマゼンタ背景)の画像を、透過PNGにして余白を整える
# 使い方: python art/key_green.py 入力画像 出力名[,出力名2,...] [オプション]
#   出力は blender/out/<出力名>.png (export.py が docs/img に WebP を書き出す)
#   --keepgreen   絵の中に本物の緑がある場合(草のキャラなど)。外周とつながった緑だけ抜く
#   --size N      長辺の大きさ(px) 既定 512
#   --pad F       まわりの余白(物の大きさに対する片側の割合) 既定 0.03
#   --square      正方形のキャンバスの中央に置く
#   出力名をカンマで複数書くと、1枚の中の物を左上から順に(行ごとに左→右)切り分ける
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'blender', 'out')


def matte(src, keepgreen=False):
    """背景の色(緑・マゼンタなど、原色の背景)を自動で見分けて透明にする"""
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    border = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]])
    bg = np.median(border, axis=0)
    dom = [c for c in range(3) if bg[c] > 128]                         # 背景で強い色の成分(緑なら G、マゼンタなら R と B)
    oth = [c for c in range(3) if c not in dom]
    key_of = lambda a: np.min(a[..., dom], axis=-1) - np.max(a[..., oth], axis=-1)
    ge = key_of(im)                                                     # 背景の色っぽさ
    bge = float(np.min(bg[dom]) - np.max(bg[oth]))
    alpha = 1 - np.clip((ge - 0.12 * bge) / (0.62 * bge), 0, 1)
    if keepgreen:                                                       # 外周につながる背景だけを抜く
        d = np.sqrt(((im - bg) ** 2).sum(axis=2))
        lab, _ = ndimage.label(d < 150)
        edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
        reach = np.isin(lab, edge[edge > 0])
        alpha = np.where(reach, np.clip((d - 38) / 67, 0, 1), 1.0)
    alpha = ndimage.grey_opening(alpha, size=(2, 2))
    A = np.maximum(alpha, 1e-3)[..., None]
    fg = (im - (1 - A) * bg) / A
    # 背景色のかぶりを取る: 背景で強い成分が、ほかの成分より飛び出している分を引く
    excess = np.maximum(0, key_of(fg) - 4)
    if keepgreen:
        excess = np.where(ndimage.binary_dilation(alpha < 0.98, iterations=2), excess, 0)
    for c in dom:
        fg[..., c] -= excess
    return Image.fromarray(np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8), 'RGBA')


def finish(img, name, size=512, pad=0.03, square=False):
    x0, y0, x1, y1 = img.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    w, h = x1 - x0, y1 - y0
    p = int(round(max(w, h) * pad))
    out = img.crop((x0 - p, y0 - p, x1 + p, y1 + p))           # はみ出した分は透明になる
    if square:
        s = max(out.size)
        c = Image.new('RGBA', (s, s), (0, 0, 0, 0)); c.alpha_composite(out, ((s - out.width) // 2, (s - out.height) // 2)); out = c
    out.thumbnail((size, size), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    out.save(os.path.join(OUT, name + '.png'))
    print(name, out.size)


def split(img, n):
    """1枚の中の物を n 個に切り分ける(近くの破片はまとめる)"""
    a = np.asarray(img.getchannel('A')) > 40
    grown = ndimage.binary_dilation(a, iterations=max(6, img.width // 60))
    lab, k = ndimage.label(grown)
    sizes = ndimage.sum(a, lab, range(1, k + 1))
    keep = list(np.argsort(sizes)[::-1][:n] + 1)
    objs = ndimage.find_objects(lab)
    boxes = [(objs[i - 1], i) for i in keep]
    rowh = np.median([b[0].stop - b[0].start for b, _ in boxes])
    boxes.sort(key=lambda t: (round(((t[0][0].start + t[0][0].stop) / 2) / rowh), (t[0][1].start + t[0][1].stop) / 2))
    parts = []
    arr = np.asarray(img).copy()
    for sl, i in boxes:
        m = (lab == i)
        piece = arr.copy(); piece[..., 3] = np.where(m, piece[..., 3], 0)
        parts.append(Image.fromarray(piece, 'RGBA'))
    return parts


if __name__ == '__main__':
    a = sys.argv[1:]
    opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
    names = a[1].split(',')
    img = matte(a[0], '--keepgreen' in a)
    pieces = split(img, len(names)) if len(names) > 1 else [img]
    for nm, pc in zip(names, pieces):
        finish(pc, nm, opt('--size', 512), opt('--pad', 0.03), '--square' in a)
