# エレメントデュエル: 炎・水・草のシンプルな紋章(各3段階)  真上から
# 段階: 0=形だけ / 1=丸いメダルの上 / 2=金のふち付きメダル+光
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *


def smooth_loop(pts, n=8):
    """とがった折れ線をなめらかな閉曲線にする(Catmull-Rom)。'!' 付きの点は角として残す"""
    out = []
    m = len(pts)
    for i in range(m):
        p0, p1, p2, p3 = (pts[(i + k) % m] for k in (-1, 0, 1, 2))
        sharp = len(p1) > 2
        for k in range(n):
            t = k / n
            if sharp and k == 0:
                out.append((p1[0], p1[1])); continue
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    return out


def puffy(pts, name, m, depth=0.06, bev=0.07, z=0.0):
    """輪郭をふっくらした立体にする(押し出し+丸いベベル)"""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'
    cu.extrude = depth; cu.bevel_depth = bev; cu.bevel_resolution = 10; cu.resolution_u = 4
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, (x, y) in enumerate(pts):
        sp.points[i].co = (x, y, 0, 1)
    sp.use_cyclic_u = True
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
    o.location.z = z
    assign(o, m)
    return o


def grad(name, c_lo, c_hi, y0, y1, rough=0.18, emit=0.0, coat=1.0):
    m = mat(name, c_lo, rough=rough, coat=coat)
    nt = m.node_tree; p = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = y0; mr.inputs['From Max'].default_value = y1
    r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color = (*c_lo, 1); r.color_ramp.elements[1].color = (*c_hi, 1)
    nt.links.new(tc.outputs['Object'], sep.inputs[0]); nt.links.new(sep.outputs['Y'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], r.inputs['Fac']); nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
    if emit:
        nt.links.new(r.outputs['Color'], p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value = emit
    return m


# --- 形(高さ 約2 の大きさで作る) ---
def flame_pts(inner=False):
    """ゆらめく炎: 先が右に曲がった大きな先端+左の小さな舌"""
    if inner:   # 内側の明るい炎(しずく形を少しゆがめる)
        return [(0.42 * math.sin(t) * math.sin(t / 2) + 0.06 * (1 + math.cos(t)) ** 2 / 4, 0.62 * math.cos(t) - 0.28)
                for t in (2 * math.pi * i / 120 for i in range(120))]
    pts = [(0.12, 1.05, 1), (0.34, 0.62), (0.6, 0.22), (0.66, -0.22), (0.46, -0.64), (0.0, -0.84), (-0.46, -0.64), (-0.66, -0.22),
           (-0.6, 0.18), (-0.46, 0.62, 1), (-0.3, 0.3), (-0.12, 0.52), (-0.02, 0.8)]
    return smooth_loop(pts, 12)


def drop_pts():
    """しずく: 上がとがり、下は丸い"""
    return [(0.66 * math.sin(t) * math.sin(t / 2), 0.98 * math.cos(t) - 0.06) for t in (2 * math.pi * i / 160 for i in range(160))]


def leaf_pts():
    """両端のとがった葉(斜め)"""
    pts = []
    for i in range(160):
        t = 2 * math.pi * i / 160
        sn = math.sin(t)
        w = 0.6 * math.copysign(abs(sn) ** 1.5, sn) * (1 + 0.12 * math.cos(t))
        pts.append((w, 0.98 * math.cos(t)))
    a = math.radians(-35)
    return [(x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)) for x, y in pts]


STYLE = {
    'fire': dict(pts=flame_pts, lo=(0.85, 0.05, 0.0), hi=(1.0, 0.78, 0.12), disc=(0.35, 0.03, 0.02), disc2=(0.65, 0.12, 0.03), glow=(1.0, 0.45, 0.1)),
    'water': dict(pts=drop_pts, lo=(0.0, 0.18, 0.75), hi=(0.45, 0.88, 1.0), disc=(0.01, 0.06, 0.25), disc2=(0.04, 0.2, 0.5), glow=(0.3, 0.75, 1.0)),
    'grass': dict(pts=leaf_pts, lo=(0.02, 0.32, 0.06), hi=(0.55, 0.92, 0.2), disc=(0.02, 0.18, 0.05), disc2=(0.06, 0.38, 0.1), glow=(0.5, 1.0, 0.35)),
}


def emblem(el, lv):
    reset()
    world(0.25, top=(0.9, 0.92, 1.0), bottom=(0.15, 0.15, 0.2))
    k = light('AREA', (-2.5, 2.8, 5), energy=420, size=1.6, color=(1, 0.97, 0.92), name='key'); look_at(k, (0, 0, 0))
    f = light('AREA', (3, -2, 3), energy=160, size=4, color=(0.85, 0.9, 1), name='fill', glossy=False); look_at(f, (0, 0, 0))
    st = STYLE[el]
    sc = 0.78 if lv else 0.95                      # メダルがある段階では形を少し小さく
    pts = [(x * sc, y * sc) for x, y in st['pts']()]
    sym = puffy(pts, 'sym', grad('sym', st['lo'], st['hi'], -0.9 * sc, 1.0 * sc, emit=0.12), 0.05, 0.075, 0.12)
    if el == 'fire':      # 内側の明るい炎
        inner = [(x * sc, y * sc) for x, y in flame_pts(True)]
        puffy(inner, 'inner', grad('inner', (1.0, 0.5, 0.03), (1.0, 0.88, 0.3), -0.9 * sc, 0.35 * sc, emit=0.3), 0.02, 0.05, 0.27)
    if el == 'grass':     # 葉脈(中心+左右の細い脈)と葉柄
        a = math.radians(-35)
        rot = lambda x, y: ((x * math.cos(a) - y * math.sin(a)) * sc, (x * math.sin(a) + y * math.cos(a)) * sc)
        vm = mat('vein', (0.78, 1.0, 0.6), rough=0.3, emit=(0.6, 1, 0.4), emit_str=0.25)
        lines = [([(0.0, -1.25), (0.0, -0.9), (0.03, -0.2), (0.0, 0.8)], 0.024)]
        for yy in (-0.45, -0.05, 0.35):
            for sx in (-1, 1):
                lines.append(([(0.02 * sx, yy), (0.3 * sx, yy + 0.24)], 0.013))
        for pts_, r in lines:
            cu = bpy.data.curves.new('vein', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 4
            sp = cu.splines.new('POLY'); sp.points.add(len(pts_) - 1)
            for i, (x, y) in enumerate(pts_):
                X, Y = rot(x, y); sp.points[i].co = (X, Y, 0.26 if y > -0.95 else 0.12, 1)
            o = bpy.data.objects.new('vein', cu); bpy.context.collection.objects.link(o); assign(o, vm)
    if el == 'water':     # 白い反射
        hl = puffy([(x * 0.12 - 0.2 * sc, y * 0.22 - 0.25 * sc) for x, y in smooth_loop([(0, 1), (0.6, 0), (0, -1), (-0.6, 0)], 12)], 'hl',
                   mat('hl', (1, 1, 1), emit=(1, 1, 1), emit_str=0.8, rough=0.2), 0.0, 0.02, 0.26)
        hl.rotation_euler.z = math.radians(-20)
    if lv >= 1:           # メダル
        disc = cyl(1.0, 0.12, 128, (0, 0, -0.06), 'disc'); bevel(disc, 0.05, 6)
        dm = mat('disc', st['disc'], rough=0.25, coat=1.0)
        nt = dm.node_tree; p = nt.nodes.get('Principled BSDF')
        tc = nt.nodes.new('ShaderNodeTexCoord'); g = nt.nodes.new('ShaderNodeTexGradient'); g.gradient_type = 'SPHERICAL'
        r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color = (*st['disc'], 1); r.color_ramp.elements[1].color = (*st['disc2'], 1)
        nt.links.new(tc.outputs['Object'], g.inputs['Vector']); nt.links.new(g.outputs['Fac'], r.inputs['Fac']); nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
        assign(disc, dm)
        rim_m = mat('rim', (0.85, 0.88, 0.95), rough=0.2, metal=1.0) if lv == 1 else mat('gold', (1.0, 0.7, 0.18), rough=0.18, metal=1.0)
        bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.065, major_segments=160, minor_segments=24, location=(0, 0, 0.0))
        rim = bpy.context.object; assign(rim, rim_m)
    if lv >= 2:           # 金の鋲と光の輪
        gold = bpy.data.materials['gold']
        for i in range(8):
            a = 2 * math.pi * i / 8 + math.pi / 8
            s = sphere(0.055, (1.0 * math.cos(a), 1.0 * math.sin(a), 0.06), 24, 12, 'stud'); assign(s, gold)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.86, minor_radius=0.012, major_segments=160, minor_segments=8, location=(0, 0, 0.07))
        t = bpy.context.object; assign(t, mat('glowring', st['glow'], emit=st['glow'], emit_str=2.0))
    cam_top(2.35, 10, (320, 320))
    render('card_%s%d' % (el, lv))


which = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
for el in ('fire', 'water', 'grass'):
    if 'all' in which or el in which:
        for lv in range(3):
            emblem(el, lv)
