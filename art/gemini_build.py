# Gemini で作った原本(art/src/gemini/*.jpg)を、ゲームで使う形に切り出す
#   python art/gemini_build.py  →  blender/out/*.png  →  python blender/export.py で docs/img へ
# ゲーム側は画像の大きさの決まりごとで描いているので、余白の割合をここで合わせる
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from key_green import matte, finish, split, OUT

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'gemini')
P = lambda n: os.path.join(SRC, n + '.jpg')


def table():
    """台: 黒い余白とレールの外を切り、盤面だけを 9:16 にのばす(ゴール幅は台の約42%でゲームと同じ)"""
    im = Image.open(P('hockey_table')).convert('RGB')
    im.crop((39, 106, 730, 1252)).resize((720, 1280), Image.LANCZOS).save(os.path.join(OUT, 'hockey_table.png'))
    print('hockey_table')


def turret(img):
    """砲台: 回転の中心(丸い台座の中心)が画像の真ん中に来るように置く"""
    a = np.asarray(img.getchannel('A')) > 40
    ys, xs = np.nonzero(a)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    cy = (y0 + y1) / 2
    disk_r = (y1 - y0) / 2
    cx = x0 + disk_r                                   # 砲身は右向きなので、台座は左端から半径の位置
    half = int(max(x1 - cx, disk_r) * 1.06)
    sq = img.crop((int(cx - half), int(cy - half), int(cx + half), int(cy + half)))
    sq.thumbnail((160, 160), Image.LANCZOS)
    sq.save(os.path.join(OUT, 'space_turret.png'))
    print('space_turret', sq.size, 'disk %.2f' % (disk_r / half))


def door():
    im = Image.open(P('escape_door')).convert('RGB')
    im.thumbnail((720, 1280), Image.LANCZOS)
    im.save(os.path.join(OUT, 'escape_door.png'))
    print('escape_door', im.size)


table()
for nm, pc in zip(['hockey_mallet_blue', 'hockey_puck', 'hockey_mallet_pink'], split(matte(P('hockey_pieces')), 3)):
    finish(pc, nm, 256, 0.15, True)                    # ゲームは直径の1.3倍の範囲として描く
finish(matte(P('space_ship')), 'space_ship', 256, 0.09, True)
parts = split(matte(P('space_parts')), 3)
turret(parts[0])
finish(parts[1], 'space_drone', 256, 0.04)
finish(parts[2], 'space_heart', 128, 0.06, True)
for i, pc in enumerate(split(matte(P('space_rocks')), 4)):
    finish(pc, 'space_rock%d' % i, 256, 0.1, True)     # ゲームは半径の2.5倍の幅として描く
finish(matte(P('space_planet')), 'space_planet', 420, 0.02)
door()
for nm, pc in zip(['red', 'blue', 'yellow', 'green', 'white'], split(matte(P('escape_crystals')), 5)):
    finish(pc, 'escape_crystal_' + nm, 160, 0.05)
