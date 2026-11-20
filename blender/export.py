# レンダー原本(blender/out/*.png)を、ゲーム用の軽い WebP にして docs/img へ書き出す
# メニュー用アイコンもここで合成する。  使い方: python blender/export.py
import os, glob
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'blender', 'out')
DST = os.path.join(ROOT, 'docs', 'img')
os.makedirs(DST, exist_ok=True)

# 表示サイズに対して大きすぎる原本は縮める(長辺の上限)
LIMIT = {'chara_fire_full': 960, 'chara_water_full': 960, 'chara_grass_full': 960, 'hockey_table': 1080, 'escape_door': 900, 'sea_water_mine': 640, 'sea_water_enemy': 640, 'pg_table': 1080, 'pt_floor': 900}


def save(im, name, q=86):
    p = os.path.join(DST, name + '.webp')
    im.save(p, 'WEBP', quality=q, method=6)
    return os.path.getsize(p)


def load(name):
    return Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')


total = 0
for path in sorted(glob.glob(os.path.join(SRC, '*.png'))):
    name = os.path.splitext(os.path.basename(path))[0]
    im = Image.open(path)
    im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    if name.startswith('card_'):         # カードの絵は余白を切って大きく見せる
        x0, y0, x1, y1 = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        side = max(x1 - x0, y1 - y0); pad = int(side * 0.04); cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        h = side // 2 + pad
        im = im.crop((cx - h, cy - h, cx + h, cy + h)).resize((256, 256), Image.LANCZOS)   # はみ出た分は透明になる
    lim = LIMIT.get(name)
    if lim and max(im.size) > lim:
        im.thumbnail((lim, lim), Image.LANCZOS)
    total += save(im, name, 84 if im.mode == 'RGB' else 88)


# --- メニューのアイコン(160x160、レンダー素材を組み合わせる) ---
def icon(name, layers, bg=None):
    c = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    for src, size, pos, rot in layers:
        im = load(src) if isinstance(src, str) else src
        if rot:
            im = im.rotate(rot, Image.BICUBIC, expand=True)
        im.thumbnail((size, size), Image.LANCZOS)
        # 影
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); sh.putalpha(im.getchannel('A').point(lambda a: int(a * 0.45)))
        sh = sh.filter(ImageFilter.GaussianBlur(4))
        x, y = pos[0] - im.width // 2, pos[1] - im.height // 2
        c.alpha_composite(sh, (x + 3, y + 5)); c.alpha_composite(im, (x, y))
    return save(c, 'icon_' + name, 90)


def card_face(el):
    """キャラの顔を角丸のカード形に切りぬく(メニューのアイコン用)"""
    from PIL import ImageDraw
    im = load('chara_' + el).crop((40, 0, 280, 300)).resize((96, 120), Image.LANCZOS)
    bg = Image.new('RGBA', im.size, {'fire': (120, 30, 10, 255), 'water': (20, 60, 140, 255), 'grass': (30, 100, 40, 255)}[el])
    bg.alpha_composite(im)
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, 95, 119), 12, fill=255)
    out = Image.new('RGBA', (100, 124), (0, 0, 0, 0))
    border = Image.new('RGBA', (100, 124), (0, 0, 0, 0)); ImageDraw.Draw(border).rounded_rectangle((0, 0, 99, 123), 14, fill=(255, 255, 255, 255))
    out.alpha_composite(border); bg.putalpha(m); out.alpha_composite(bg, (2, 2))
    return out


def table_crop():
    t = load('hockey_table').resize((360, 640), Image.LANCZOS)
    t = t.crop((40, 360, 320, 640)).resize((150, 150), Image.LANCZOS)
    m = Image.new('L', t.size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 149, 149), 26, fill=255)
    t.putalpha(m)
    return t


total += icon('hockey', [(table_crop(), 150, (80, 80), 0), ('hockey_mallet_pink', 62, (104, 52), 0), ('hockey_puck', 34, (70, 84), 0), ('hockey_mallet_blue', 72, (60, 116), 0)])
total += icon('cards', [(card_face('water'), 96, (46, 70), 0), (card_face('grass'), 96, (114, 70), 0), (card_face('fire'), 104, (80, 98), 0)])
total += icon('sea', [('sea_ship4_h', 158, (80, 84), 28)])
total += icon('escape', [('escape_door', 150, (80, 80), 0)])
total += icon('pilot', [('space_planet', 120, (110, 40), 0), ('space_ship', 132, (76, 92), -18)])
total += icon('janken', [('jk_scissors', 78, (44, 58), -14), ('jk_paper', 82, (112, 56), 14), ('jk_rock', 86, (80, 112), 0)])
total += icon('mines', [('mn_explosion', 100, (104, 56), 0), ('mn_flag', 70, (40, 52), 0), ('mn_bomb', 96, (72, 104), 0)])
total += icon('auction', [('au_coins', 92, (110, 112), 0), ('au_crown', 104, (68, 66), -8), ('au_gavel', 90, (108, 52), 20)])
total += icon('pong', [('pg_paddle_blue', 110, (54, 76), -24), ('pg_paddle_red', 118, (104, 84), 22), ('pg_ball', 30, (80, 30), 0)])
total += icon('paint', [('pt_pink', 84, (108, 58), 0), ('pt_bomb', 60, (36, 50), 0), ('pt_blue', 96, (66, 108), 0)])
print('webp total %.0f KB in %s' % (total / 1024, DST))
