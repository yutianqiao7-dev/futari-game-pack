# レンダー画像の後処理: 発光部分ににじみ(ブルーム)を足す
# 使い方: python blender/post.py 画像名 [しきい値] [強さ] [半径]
import sys, os
from PIL import Image, ImageFilter, ImageChops
import numpy as np
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def bloom(name, thr=0.62, amt=1.1, rad=10):
    p = os.path.join(ROOT, 'blender', 'out', name + '.png')
    im = Image.open(p).convert('RGBA')
    a = np.asarray(im).astype(np.float32) / 255
    rgb, al = a[..., :3], a[..., 3:]
    lum = rgb.max(axis=2, keepdims=True)
    bright = rgb * np.clip((lum - thr) / (1 - thr), 0, 1) * al
    b8 = Image.fromarray((bright * 255).astype(np.uint8))
    g1 = np.asarray(b8.filter(ImageFilter.GaussianBlur(rad))).astype(np.float32) / 255
    g2 = np.asarray(b8.filter(ImageFilter.GaussianBlur(rad * 3))).astype(np.float32) / 255
    glow = (g1 * 0.7 + g2 * 0.6) * amt
    out = 1 - (1 - rgb) * (1 - np.clip(glow, 0, 1))        # スクリーン合成
    ga = np.clip(glow.max(axis=2, keepdims=True) * 1.4, 0, 1)
    al2 = np.maximum(al, ga)
    out = np.where(al2 > 0, (out * np.maximum(al, 1e-4) + glow * (1 - al)) / np.maximum(al2, 1e-4), 0)
    res = np.concatenate([np.clip(out, 0, 1), al2], axis=2)
    Image.fromarray((res * 255).astype(np.uint8)).save(p, optimize=True)
    print('[bloom]', name)

if __name__ == '__main__':
    a = sys.argv[1:]
    bloom(a[0], *(float(x) for x in a[1:]))
