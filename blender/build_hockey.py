# エアホッケー: 台(背景)・パック・マレット  1単位=100ゲーム座標(px)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *

W, H, GW = 3.6, 6.4, 1.5


def table():
    reset()
    world(0.35, top=(0.4, 0.45, 0.7), bottom=(0.02, 0.02, 0.05))
    # 盤面: つやのある深い紺。中央が少し明るい
    base = cube((W, H, 0.2), (0, 0, -0.1), 'surface')
    m = mat('surf', (0.03, 0.05, 0.14), rough=0.12, coat=0.3, spec=0.5)
    nt = m.node_tree
    p = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    grad = nt.nodes.new('ShaderNodeTexGradient'); grad.gradient_type = 'SPHERICAL'
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.32, 0.2, 1)
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.015, 0.02, 0.06, 1)
    ramp.color_ramp.elements[1].position = 0.9
    ramp.color_ramp.elements[1].color = (0.05, 0.09, 0.32, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], grad.inputs['Vector'])
    nt.links.new(grad.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    noise_bump(m, 900, 0.015, 2)
    assign(base, m)
    # 空気穴(小さな凹み)
    hole = mat('hole', (0.0, 0.0, 0.0), rough=0.6)
    holes = []
    y = -H / 2 + 0.2
    row = 0
    while y < H / 2 - 0.1:
        x = -W / 2 + 0.2 + (row % 2) * 0.1
        while x < W / 2 - 0.1:
            holes.append((x, y))
            x += 0.2
        y += 0.2
        row += 1
    bm = bmesh.new()
    for x, yy in holes:
        bmesh.ops.create_circle(bm, cap_ends=True, radius=0.012, segments=10,
                                matrix=Matrix.Translation((x, yy, 0.0015)))
    me = bpy.data.meshes.new('holes'); bm.to_mesh(me); bm.free()
    ho = bpy.data.objects.new('holes', me); bpy.context.collection.objects.link(ho); assign(ho, hole)

    # ネオンのライン(少し浮かせた発光チューブ)
    def neon(pts_list, color, name, r=0.012, strength=1.6):
        cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
        cu.bevel_depth = r; cu.bevel_resolution = 4
        for pts, cyclic in pts_list:
            sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
            for i, (x, yy) in enumerate(pts):
                sp.points[i].co = (x, yy, 0.012, 1)
            sp.use_cyclic_u = cyclic
        o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
        assign(o, mat(name, color, emit=color, emit_str=strength, rough=0.3))
        return o

    def arc(cx, cy, r, a0, a1, n=96):
        return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]

    white = (0.55, 0.62, 1.0)
    neon([([(-W / 2 + 0.08, 0), (W / 2 - 0.08, 0)], False), (arc(0, 0, 0.52, 0, 2 * math.pi), True)], white, 'midline')
    neon([(arc(0, H / 2, GW / 2 + 0.22, math.pi, 2 * math.pi), False)], (1.0, 0.25, 0.5), 'arcTop')
    neon([(arc(0, -H / 2, GW / 2 + 0.22, 0, math.pi), False)], (0.15, 0.7, 1.0), 'arcBot')
    dot = cyl(0.05, 0.01, 48, (0, 0, 0.006), 'centerdot'); assign(dot, mat('cd', white, emit=white, emit_str=1.5))

    # 外枠(クロームのレール+内側のネオン帯)
    chrome = mat('chrome', (0.85, 0.87, 0.92), rough=0.12, metal=1.0)
    rail_w = 0.07

    def rail(x0, y0, x1, y1):
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        o = cube((abs(x1 - x0) or rail_w, abs(y1 - y0) or rail_w, 0.09), (cx, cy, 0.045), 'rail')
        bevel(o, 0.025, 4); assign(o, chrome)
        return o

    hw, hh = W / 2 - rail_w / 2, H / 2 - rail_w / 2
    rail(-hw, -H / 2, -hw, H / 2); rail(hw, -H / 2, hw, H / 2)
    for sy in (1, -1):
        rail(-W / 2, sy * hh, -GW / 2, sy * hh); rail(GW / 2, sy * hh, W / 2, sy * hh)
    inner = W / 2 - rail_w - 0.008
    innerH = H / 2 - rail_w - 0.008
    neon([([(-inner, -innerH), (-inner, innerH)], False)], (0.55, 0.45, 1.0), 'edgeL', 0.008, 1.2)
    neon([([(inner, -innerH), (inner, innerH)], False)], (0.55, 0.45, 1.0), 'edgeR', 0.008, 1.2)
    # ゴール口: 黒い穴+発光ふち
    for sy, col in ((1, (1.0, 0.3, 0.55)), (-1, (0.2, 0.75, 1.0))):
        g = cube((GW, 0.12, 0.3), (0, sy * (H / 2 - 0.02), -0.1), 'goal'); assign(g, mat('gh', (0, 0, 0), rough=1))
        neon([([(-GW / 2, sy * (H / 2 - 0.085)), (GW / 2, sy * (H / 2 - 0.085))], False)], col, 'goalLip', 0.016, 2.0)
        for sx in (-1, 1):
            post = cyl(0.05, 0.12, 48, (sx * GW / 2, sy * (H / 2 - rail_w / 2), 0.06), 'post'); assign(post, chrome)

    # 天井の照明が映りこむように
    world(0.12, top=(0.5, 0.55, 0.9), bottom=(0.01, 0.01, 0.03))
    for i, (x, y) in enumerate(((-0.6, 1.8), (0.7, -1.4), (0, 0.2))):
        l = light('AREA', (x, y, 4.5), energy=120, size=1.6, color=(0.85, 0.9, 1.0), name='ceil%d' % i, glossy=False)
    sp = light('SPOT', (0, 0, 7), energy=500, size=1.0, color=(0.9, 0.92, 1.0), name='spot', spot=math.radians(70), glossy=False)
    # 細長い照明の映りこみ(つやを見せる)
    for i, (x, y, rz) in enumerate(((-1.0, 2.2, 0.5), (1.1, -2.4, 0.5))):
        bar = light('AREA', (x, y, 6), energy=40, size=0.12, color=(0.8, 0.85, 1.0), name='bar%d' % i)
        bar.data.shape = 'RECTANGLE'; bar.data.size_y = 3.0; bar.rotation_euler = (0, 0, rz)
    cam_top(H, 10, (720, 1280))
    render('hockey_table', transparent=False)


def mallet(name, body, deep, glow):
    reset()
    world(0.12, top=(0.7, 0.75, 0.9), bottom=(0.02, 0.02, 0.04))
    R = 0.54
    # 横から見た形: 低い円盤 + くびれ + 持ち手のドーム
    prof = [(0.0, 0.0), (R * 0.98, 0.0), (R, 0.02), (R, 0.075), (R * 0.97, 0.11), (R * 0.88, 0.13), (R * 0.62, 0.135),
            (R * 0.5, 0.15), (R * 0.38, 0.2), (R * 0.33, 0.27), (R * 0.36, 0.33), (R * 0.33, 0.38), (R * 0.22, 0.41), (0.0, 0.42)]
    o = lathe(prof, 160, name)
    m = mat(name, body, rough=0.28, coat=0.5, spec=0.5)
    noise_bump(m, 300, 0.02, 3)
    assign(o, m)
    smooth(o, 1)
    # 上面の溝リング
    ring = bpy.data.objects.new('ring', bpy.data.meshes.new('r'))
    bpy.ops.mesh.primitive_torus_add(major_radius=R * 0.78, minor_radius=0.018, major_segments=160, minor_segments=16, location=(0, 0, 0.13))
    t = bpy.context.object; assign(t, mat('rim', deep, rough=0.35, coat=0.5)); smooth(t, 1)
    bpy.ops.mesh.primitive_torus_add(major_radius=R * 0.995, minor_radius=0.012, major_segments=160, minor_segments=12, location=(0, 0, 0.05))
    g = bpy.context.object; assign(g, mat('glow', glow, emit=glow, emit_str=1.5)); smooth(g, 0)
    # 持ち手の頭に光沢キャップ
    cap = sphere(R * 0.24, (0, 0, 0.36), name='cap'); cap.scale = (1, 1, 0.55)
    assign(cap, mat('cap', (0.95, 0.96, 1.0), rough=0.08, coat=1.0))
    studio(320, 90, 300, 5)
    cam_top(R * 2 * 1.3, 10, (256, 256))
    render(name)


def puck():
    reset()
    world(0.12, top=(0.8, 0.75, 0.6), bottom=(0.02, 0.02, 0.02))
    R = 0.15
    prof = [(0, 0), (R * 0.95, 0), (R, 0.01), (R, 0.04), (R * 0.95, 0.05), (R * 0.7, 0.05), (R * 0.62, 0.044), (0, 0.044)]
    o = lathe(prof, 128, 'puck')
    m = mat('puck', (0.95, 0.32, 0.02), rough=0.3, coat=0.6)
    assign(o, m); smooth(o, 1)
    bpy.ops.mesh.primitive_torus_add(major_radius=R * 0.66, minor_radius=0.006, major_segments=128, minor_segments=10, location=(0, 0, 0.048))
    t = bpy.context.object; assign(t, mat('pr', (1, 0.95, 0.7), emit=(1, 0.8, 0.3), emit_str=1.4)); smooth(t, 0)
    studio(110, 30, 90, 2)
    cam_top(R * 2 * 1.3, 10, (128, 128))
    render('hockey_puck')


which = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
if 'all' in which or 'table' in which:
    table()
if 'all' in which or 'mallet' in which:
    mallet('hockey_mallet_blue', (0.01, 0.25, 0.85), (0.01, 0.12, 0.35), (0.3, 0.85, 1.0))
    mallet('hockey_mallet_pink', (0.85, 0.03, 0.22), (0.35, 0.02, 0.12), (1.0, 0.45, 0.7))
if 'all' in which or 'puck' in which:
    puck()
