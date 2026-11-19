# ふたりで宇宙船: 自機・砲台・敵ドローン・隕石・ハート・惑星  1単位=100ゲーム座標
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *


def space_lights(scale=1.0):
    world(0.08, top=(0.5, 0.55, 0.9), bottom=(0.03, 0.02, 0.06))
    k = light('SUN', (0, 0, 5), energy=4.0, color=(1, 0.96, 0.9), name='sun')
    k.rotation_euler = (math.radians(35), math.radians(-30), math.radians(20))
    k.data.angle = math.radians(6)
    r = light('AREA', (1.5 * scale, -1.8 * scale, 1.2 * scale), energy=180 * scale * scale, size=1.5 * scale, color=(0.5, 0.75, 1.0), name='rim')
    look_at(r, (0, 0, 0))
    r2 = light('AREA', (-1.6 * scale, 1.2 * scale, 0.6 * scale), energy=120 * scale * scale, size=1.5 * scale, color=(1.0, 0.45, 0.6), name='rim2')
    look_at(r2, (0, 0, 0))


def ship():
    reset(); space_lights(0.6)
    hull = mat('hull', (0.7, 0.73, 0.8), rough=0.25, metal=0.7, coat=0.5)
    noise_bump(hull, 120, 0.03, 4)
    red = mat('red', (0.55, 0.0, 0.07), rough=0.3, coat=0.8)
    dark = mat('dark', (0.08, 0.09, 0.13), rough=0.4, metal=0.7)
    glass = mat('glass', (0.1, 0.45, 0.9), rough=0.03, coat=1.0, emit=(0.1, 0.5, 1.0), emit_str=0.6)
    # 胴体: 回転体を寝かせる(機首が +Y)
    prof = [(0.0, -0.17), (0.07, -0.165), (0.085, -0.12), (0.09, -0.02), (0.085, 0.06), (0.068, 0.14), (0.042, 0.2), (0.016, 0.235), (0.0, 0.245)]
    body = lathe([(r, z) for r, z in prof], 96, 'body')
    body.rotation_euler = (math.radians(-90), 0, 0); body.scale = (1, 1, 0.62)
    bpy.ops.object.select_all(action='DESELECT'); active(body); bpy.ops.object.transform_apply(rotation=True, scale=True)
    body.rotation_euler = (0, 0, 0)
    # lathe は Z 軸まわりなので -90°X で Y 方向へ
    assign(body, hull); smooth(body, 1)
    # 翼(平面図形を押し出してベベル)
    def wing(sx):
        pts = [(0.05, 0.06), (0.25, -0.1), (0.27, -0.17), (0.22, -0.19), (0.06, -0.14)]
        bm = bmesh.new()
        vs = [bm.verts.new((sx * x, y, 0)) for x, y in pts]
        if sx < 0:
            vs.reverse()
        f = bm.faces.new(vs)
        ext = bmesh.ops.extrude_face_region(bm, geom=[f])
        for v in [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]:
            v.co.z += 0.03
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new('wing'); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new('wing', me); bpy.context.collection.objects.link(o)
        o.location.z = -0.02
        bevel(o, 0.012, 3); assign(o, red)
        # 翼端の砲
        g = cyl(0.014, 0.12, 24, (sx * 0.245, -0.09, 0.01), 'gun'); g.rotation_euler = (math.radians(90), 0, 0); assign(g, dark); bevel(g, 0.004, 2)
        tip = cyl(0.009, 0.02, 24, (sx * 0.245, -0.025, 0.01), 'tip'); tip.rotation_euler = (math.radians(90), 0, 0)
        assign(tip, mat('tipg', (0.3, 1, 0.85), emit=(0.3, 1, 0.85), emit_str=2))
        # 白いライン
    wing(1); wing(-1)
    # 尾翼
    fin = cube((0.012, 0.09, 0.06), (0, -0.12, 0.06), 'fin'); bevel(fin, 0.005, 3); assign(fin, red)
    # コクピット
    cp = sphere(0.045, (0, 0.07, 0.035), name='cockpit'); cp.scale = (0.75, 1.5, 0.65); assign(cp, glass)
    # エンジン
    for sx in (-0.045, 0.045):
        n = cyl(0.03, 0.06, 48, (sx, -0.17, 0.0), 'noz'); n.rotation_euler = (math.radians(90), 0, 0); assign(n, dark); bevel(n, 0.006, 3)
        gl = cyl(0.022, 0.01, 48, (sx, -0.2, 0.0), 'glow'); gl.rotation_euler = (math.radians(90), 0, 0)
        assign(gl, mat('eg', (1, 0.6, 0.2), emit=(1, 0.55, 0.15), emit_str=3))
    cam_top(0.64, 10, (256, 256))
    render('space_ship')


def turret():
    reset(); space_lights(0.4)
    dark = mat('d', (0.18, 0.2, 0.26), rough=0.3, metal=0.8)
    base = sphere(0.065, (0, 0, 0), name='tb'); base.scale = (1, 1, 0.55)
    m = mat('tg', (0.2, 0.85, 0.7), rough=0.25, metal=0.5, coat=0.8); assign(base, m)
    # 砲身は +X 向き(ゲームでは角度0=右)
    b = cyl(0.022, 0.17, 32, (0.1, 0, 0.02), 'barrel'); b.rotation_euler = (0, math.radians(90), 0); assign(b, dark); bevel(b, 0.005, 2)
    mz = cyl(0.026, 0.025, 32, (0.18, 0, 0.02), 'muzzle'); mz.rotation_euler = (0, math.radians(90), 0)
    assign(mz, mat('mz', (0.4, 1, 0.85), emit=(0.3, 1, 0.8), emit_str=2.5))
    cam_top(0.44, 10, (128, 128))
    render('space_turret')


def drone():
    reset(); space_lights(0.6)
    R = 0.2
    prof = [(0, -0.04), (R * 0.5, -0.045), (R * 0.85, -0.025), (R, 0.0), (R * 0.9, 0.02), (R * 0.55, 0.035), (0, 0.04)]
    s = lathe(prof, 128, 'saucer')
    m = mat('sauc', (0.55, 0.58, 0.68), rough=0.22, metal=0.85, coat=0.5); noise_bump(m, 200, 0.02); assign(s, m); smooth(s, 1)
    dome = sphere(R * 0.45, (0, 0, 0.03), name='dome'); dome.scale = (1, 1, 0.8)
    assign(dome, mat('dg', (0.95, 0.2, 0.5), rough=0.05, coat=1.0, trans=0.3, emit=(1, 0.15, 0.5), emit_str=1.2))
    bpy.ops.mesh.primitive_torus_add(major_radius=R * 0.97, minor_radius=0.008, major_segments=128, minor_segments=8, location=(0, 0, 0.0))
    t = bpy.context.object; assign(t, mat('dk', (0.1, 0.1, 0.14), rough=0.4, metal=0.8))
    for i in range(10):
        a = 2 * math.pi * i / 10
        col = (1, 0.82, 0.25) if i % 2 else (1, 0.2, 0.4)
        l = sphere(0.011, (R * 0.78 * math.cos(a), R * 0.78 * math.sin(a), 0.02), 16, 8, 'lamp')
        assign(l, mat('lm%d' % i, col, emit=col, emit_str=4))
    # 斜め上から(3/4 ビュー)
    cam_persp((0, -2.2, 1.6), (0, 0, 0), ortho=0.5, res=(192, 160))
    render('space_drone')


def asteroid(i, seed):
    reset(); space_lights(0.55)
    random.seed(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=1.0)
    o = bpy.context.object; o.name = 'rock'
    o.scale = (random.uniform(0.85, 1.05), random.uniform(0.8, 1.0), random.uniform(0.7, 0.9))
    for nm, kind, sz, st in (('big', 'CLOUDS', 0.9, 0.35), ('mid', 'CLOUDS', 0.35, 0.12), ('cr', 'VORONOI', 0.4, -0.12)):
        tx = bpy.data.textures.new(nm + str(i), kind)
        if kind == 'CLOUDS':
            tx.noise_scale = sz; tx.noise_depth = 4
        else:
            tx.noise_scale = sz; tx.distance_metric = 'DISTANCE'
        d = o.modifiers.new(nm, 'DISPLACE'); d.texture = tx; d.strength = st; d.mid_level = 0.5
        d.texture_coords = 'LOCAL'
    tex_off = Vector((random.uniform(-9, 9), random.uniform(-9, 9), random.uniform(-9, 9)))
    o.location = (0, 0, 0)
    # 模様をずらすため空の物体を座標基準にする
    emp = bpy.data.objects.new('ref', None); bpy.context.collection.objects.link(emp); emp.location = tex_off
    for md in o.modifiers:
        md.texture_coords = 'OBJECT'; md.texture_coords_object = emp
    for f in o.data.polygons:
        f.use_smooth = True
    m = mat('rockm', (0.2, 0.17, 0.16), rough=0.9, spec=0.3)
    color_noise(m, (0.05, 0.045, 0.05), (0.32, 0.26, 0.22), 3.0, 10, 0.3, 0.75)
    noise_bump(m, 25, 0.35, 10)
    assign(o, m)
    o.rotation_euler = (random.uniform(0, 6), random.uniform(0, 6), random.uniform(0, 6))
    cam_top(2.5, 10, (192, 192))
    render('space_rock%d' % i)


def heart():
    """ハート型の陰関数から、ふっくらした高さ場を作る"""
    reset(); space_lights(0.4)
    N = 220; x0, x1, y0, y1 = -1.3, 1.3, -1.25, 1.35
    f = lambda x, y: (x * x + y * y - 1) ** 3 - x * x * y ** 3
    bm = bmesh.new(); grid = {}
    for j in range(N + 1):
        for i in range(N + 1):
            x = x0 + (x1 - x0) * i / N; y = y0 + (y1 - y0) * j / N; v = f(x, y)
            if v < 0:
                z = 0.42 * (-v) ** 0.33
                grid[(i, j)] = bm.verts.new((x * 0.11, y * 0.11, z * 0.11))
    for j in range(N):
        for i in range(N):
            q = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            if all(k in grid for k in q):
                bm.faces.new([grid[k] for k in q])
    me = bpy.data.meshes.new('heart'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('heart', me); bpy.context.collection.objects.link(o)
    for p_ in me.polygons:
        p_.use_smooth = True
    assign(o, mat('ht', (0.9, 0.04, 0.28), rough=0.1, coat=1.0, emit=(1, 0.1, 0.4), emit_str=0.35))
    cam_top(0.3, 10, (96, 96))
    render('space_heart')


def planet():
    reset()
    world(0.02)
    sun = light('SUN', (0, 0, 5), energy=5, color=(1, 0.92, 0.82), name='sun')
    sun.rotation_euler = (math.radians(55), math.radians(-50), 0)
    p = sphere(1.0, (0, 0, 0), 128, 64, 'planet')
    m = mat('pl', (0.8, 0.4, 0.2), rough=0.7)
    nt = m.node_tree; pr = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'; wave.bands_direction = 'Z'; wave.inputs['Scale'].default_value = 1.6
    wave.inputs['Distortion'].default_value = 3; wave.inputs['Detail'].default_value = 6
    ramp = nt.nodes.new('ShaderNodeValToRGB'); cr = ramp.color_ramp
    cr.elements[0].color = (0.45, 0.12, 0.08, 1); cr.elements[1].color = (1.0, 0.82, 0.55, 1)
    e = cr.elements.new(0.5); e.color = (0.85, 0.4, 0.18, 1)
    nt.links.new(tc.outputs['Object'], wave.inputs['Vector']); nt.links.new(wave.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], pr.inputs['Base Color'])
    assign(p, m)
    # 大気のふち
    atm = sphere(1.04, (0, 0, 0), 96, 48, 'atm')
    am = mat('atm', (1, 0.6, 0.4), alpha=0.15, emit=(1, 0.5, 0.3), emit_str=0.3); assign(atm, am)
    # 環
    ring = lathe([(1.35, 0), (2.1, 0)], 160, 'ring')
    rm = mat('ring', (0.95, 0.85, 0.7), rough=0.6, alpha=0.75)
    nt = rm.node_tree; pr = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 1.35; mr.inputs['From Max'].default_value = 2.1
    ramp = nt.nodes.new('ShaderNodeValToRGB'); cr = ramp.color_ramp
    stops = [(0.0, 0.0), (0.06, 0.5), (0.25, 0.75), (0.3, 0.15), (0.36, 0.8), (0.62, 0.9), (0.66, 0.05), (0.72, 0.55), (0.93, 0.4), (1.0, 0.0)]
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (stops[0][1],) * 3 + (1,)
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], (stops[-1][1],) * 3 + (1,)
    for pos, v in stops[1:-1]:
        e = cr.elements.new(pos); e.color = (v, v, v, 1)
    nt.links.new(tc.outputs['Object'], ln.inputs[0]); nt.links.new(ln.outputs['Value'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], pr.inputs['Alpha'])
    assign(ring, rm)
    ring.rotation_euler = (math.radians(14), math.radians(-20), 0)
    cam_persp((0, -8, 0.6), (0, 0, 0), ortho=4.6, res=(320, 220))
    render('space_planet')


which = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
A = 'all' in which
if A or 'ship' in which: ship(); turret()
if A or 'drone' in which: drone()
if A or 'rock' in which:
    for i, sd in enumerate((11, 29, 47, 83)):
        asteroid(i, sd)
if A or 'heart' in which: heart()
if A or 'planet' in which: planet()
