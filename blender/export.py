# レンダー原本(blender/out/*.png)を、ゲーム用の軽い WebP にして docs/img へ書き出す
# メニュー用アイコンもここで合成する。  使い方: python blender/export.py
import os, glob
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'blender', 'out')
DST = os.path.join(ROOT, 'docs', 'img')
os.makedirs(DST, exist_ok=True)

# 表示サイズに対して大きすぎる原本は縮める(長辺の上限)
LIMIT = {'hockey_table': 1080, 'escape_door': 900, 'sea_water_mine': 640, 'sea_water_enemy': 640}


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


def table_crop():
    t = load('hockey_table').resize((360, 640), Image.LANCZOS)
    t = t.crop((40, 360, 320, 640)).resize((150, 150), Image.LANCZOS)
    m = Image.new('L', t.size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 149, 149), 26, fill=255)
    t.putalpha(m)
    return t


total += icon('hockey', [(table_crop(), 150, (80, 80), 0), ('hockey_mallet_pink', 62, (104, 52), 0), ('hockey_puck', 34, (70, 84), 0), ('hockey_mallet_blue', 72, (60, 116), 0)])
total += icon('cards', [('card_water2', 112, (42, 84), 12), ('card_grass2', 112, (118, 84), -12), ('card_fire2', 140, (80, 76), 0)])
total += icon('sea', [('sea_ship4_h', 158, (80, 84), 28)])
total += icon('escape', [('escape_door', 150, (80, 80), 0)])
total += icon('pilot', [('space_planet', 120, (110, 40), 0), ('space_ship', 132, (76, 92), -18)])
print('webp total %.0f KB in %s' % (total / 1024, DST))
