# かいせんバトル: 軍艦(2・3・4マス、横/縦)と海面  1マス=1単位
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *


def sea_lights():
    world(0.2, top=(0.6, 0.75, 1.0), bottom=(0.1, 0.15, 0.25))
    s = light('SUN', (0, 0, 5), energy=2.2, color=(1, 0.96, 0.88), name='sun')
    s.rotation_euler = (math.radians(38), math.radians(-28), math.radians(25)); s.data.angle = math.radians(4)


def hull_shape(L, w=0.36):
    """上から見た船体の輪郭(艦首は +X)"""
    pts = []
    n = 24
    for i in range(n + 1):                     # 艦首のとがったカーブ
        t = i / n
        x = L / 2 - 0.05 - (1 - math.cos(t * math.pi / 2)) * 0.0 - t * 0.0
        pts.append((L / 2 - 0.04 - (t ** 1.8) * 0.75, w * math.sin(t * math.pi / 2)))
    pts += [(-L / 2 + 0.22, w), (-L / 2 + 0.1, w * 0.92), (-L / 2 + 0.06, w * 0.6)]
    upper = pts
    lower = [(x, -y) for x, y in reversed(upper)]
    return upper + lower[1:-1]


def extrude_poly(pts, z0, z1, name, bev=0.02):
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z0)) for x, y in pts]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z = z1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    if bev:
        bevel(o, bev, 3)
    return o


def ship(L):
    reset(); sea_lights()
    S = L * 0.94
    hullm = mat('hull', (0.25, 0.29, 0.36), rough=0.45, metal=0.3)
    noise_bump(hullm, 80, 0.02)
    deckm = mat('deck', (0.55, 0.38, 0.2), rough=0.6)
    nt = deckm.node_tree; p = nt.nodes.get('Principled BSDF')
    wave = nt.nodes.new('ShaderNodeTexWave'); wave.bands_direction = 'Y'; wave.inputs['Scale'].default_value = 28; wave.inputs['Distortion'].default_value = 1.5
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.32, 0.2, 0.1, 1); ramp.color_ramp.elements[1].color = (0.62, 0.45, 0.25, 1)
    nt.links.new(wave.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    grey = mat('grey', (0.48, 0.52, 0.58), rough=0.4, metal=0.2)
    dark = mat('dark', (0.12, 0.14, 0.18), rough=0.5, metal=0.5)
    red = mat('red', (0.5, 0.06, 0.05), rough=0.6)
    hp = hull_shape(S)
    h = extrude_poly(hp, -0.15, 0.06, 'hull', 0.03); assign(h, hullm)
    redline = extrude_poly(hull_shape(S + 0.02, 0.37), -0.16, -0.08, 'red', 0.01); assign(redline, red)
    inner = [(x * 0.96, y * 0.82) for x, y in hp]
    d = extrude_poly(inner, 0.05, 0.075, 'deck', 0.008); assign(d, deckm)
    # 艦橋
    bw = 0.34 if L > 2 else 0.28
    br = cube((bw, 0.36, 0.14), (-0.02 * L, 0, 0.14), 'bridge'); bevel(br, 0.025, 3); assign(br, grey)
    br2 = cube((bw * 0.6, 0.26, 0.1), (-0.02 * L - 0.02, 0, 0.25), 'bridge2'); bevel(br2, 0.02, 3); assign(br2, grey)
    win = cube((bw * 0.62, 0.27, 0.02), (-0.02 * L - 0.02, 0, 0.27), 'win'); assign(win, mat('w', (0.1, 0.25, 0.45), rough=0.05, coat=1, emit=(0.2, 0.5, 0.9), emit_str=0.3))
    mast = cyl(0.025, 0.25, 16, (-0.02 * L - 0.08, 0, 0.38), 'mast'); assign(mast, dark)
    rad = cube((0.03, 0.2, 0.025), (-0.02 * L - 0.08, 0, 0.47), 'radar'); assign(rad, dark)
    # 煙突
    if L >= 3:
        fu = cyl(0.085, 0.2, 32, (-0.02 * L - 0.36, 0, 0.18), 'funnel'); fu.scale = (1.3, 1, 1); assign(fu, grey); bevel(fu, 0.01, 2)
        ft = cyl(0.07, 0.03, 32, (-0.02 * L - 0.36, 0, 0.28), 'ftop'); ft.scale = (1.3, 1, 1); assign(ft, dark)
    # 砲塔
    def turret(x, facing):
        b = cyl(0.13, 0.08, 48, (x, 0, 0.11), 'tb'); assign(b, grey); bevel(b, 0.02, 3)
        top = sphere(0.12, (x, 0, 0.14), 32, 16, 'tt'); top.scale = (1, 1, 0.35); assign(top, grey)
        for dy in (-0.035, 0.035):
            g = cyl(0.018, 0.28, 16, (x + facing * 0.2, dy, 0.15), 'gun'); g.rotation_euler = (0, math.radians(90), 0); assign(g, dark)
    if L == 2:
        turret(S / 2 - 0.45, 1)
    elif L == 3:
        turret(S / 2 - 0.5, 1); turret(-S / 2 + 0.42, -1)
    else:
        turret(S / 2 - 0.5, 1); turret(S / 2 - 0.88, 1); turret(-S / 2 + 0.45, -1)
    # 救命ボート・手すりの点々
    for sx in (-1, 1):
        for k in range(2 if L > 2 else 1):
            bt = sphere(0.05, (-0.02 * L + 0.25 - k * 0.5 if L > 2 else 0.25, sx * 0.24, 0.1), 16, 8, 'boat'); bt.scale = (2.2, 0.8, 0.6)
            assign(bt, mat('bt', (0.95, 0.5, 0.1), rough=0.5))
    for vert in (False, True):
        cam = cam_top(L * 1.0, 10, (128 * L, 128))
        if vert:
            cam.rotation_euler = (0, 0, math.radians(90))
            bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = 128, 128 * L
        render('sea_ship%d_%s' % (L, 'v' if vert else 'h'))
        bpy.data.objects.remove(cam)


def cloud_world(sky, strength=0.9):
    """雲の浮かぶ空(海面に映りこませる)"""
    w = bpy.data.worlds.new('sky'); bpy.context.scene.world = w; w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear(); L = nt.links
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = strength
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 2.5; n.inputs['Detail'].default_value = 10; n.inputs['Roughness'].default_value = 0.6
    r = nt.nodes.new('ShaderNodeValToRGB')
    r.color_ramp.elements[0].position = 0.45; r.color_ramp.elements[0].color = (*sky, 1)
    r.color_ramp.elements[1].position = 0.8; r.color_ramp.elements[1].color = (0.75, 0.8, 0.9, 1)
    L.new(tc.outputs['Generated'], n.inputs['Vector']); L.new(n.outputs['Fac'], r.inputs['Fac'])
    L.new(r.outputs['Color'], bg.inputs['Color']); L.new(bg.outputs[0], out.inputs[0])


def ocean(name, deep, shallow, sky):
    """平面 + 波の凹凸。空の映りこみで水らしく見せる"""
    reset()
    cloud_world(sky, 0.8)
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    o = bpy.context.object
    m = mat('water', deep, rough=0.05, spec=0.5, ior=1.33)
    nt = m.node_tree; p = nt.nodes.get('Principled BSDF'); L = nt.links
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n1 = nt.nodes.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 1.8; n1.inputs['Detail'].default_value = 7; n1.inputs['Roughness'].default_value = 0.55
    n1.inputs['Distortion'].default_value = 0.6
    w1 = nt.nodes.new('ShaderNodeTexWave'); w1.bands_direction = 'DIAGONAL'
    w1.inputs['Scale'].default_value = 1.2; w1.inputs['Distortion'].default_value = 7; w1.inputs['Detail'].default_value = 3
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'FLOAT'; mx.inputs['Factor'].default_value = 0.25
    for nd in (w1, n1):
        L.new(tc.outputs['Object'], nd.inputs['Vector'])
    L.new(n1.outputs['Fac'], mx.inputs[2]); L.new(w1.outputs['Fac'], mx.inputs[3])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.32; bump.inputs['Distance'].default_value = 0.1
    L.new(mx.outputs[0], bump.inputs['Height']); L.new(bump.outputs['Normal'], p.inputs['Normal'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.3; ramp.color_ramp.elements[0].color = (*deep, 1)
    ramp.color_ramp.elements[1].position = 0.7; ramp.color_ramp.elements[1].color = (*shallow, 1)
    L.new(mx.outputs[0], ramp.inputs['Fac']); L.new(ramp.outputs['Color'], p.inputs['Base Color'])
    assign(o, m)
    sun = light('SUN', (0, 0, 5), energy=0.8, color=(1, 0.97, 0.9), name='sun')
    sun.rotation_euler = (math.radians(14), math.radians(-10), 0); sun.data.angle = math.radians(4)
    cam_top(7, 10, (640, 640))
    render(name, transparent=False)


which = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
A = 'all' in which
if A or 'ship' in which:
    for L in (2, 3, 4):
        ship(L)
if A or 'ocean' in which:
    ocean('sea_water_mine', (0.003, 0.05, 0.16), (0.01, 0.25, 0.4), (0.35, 0.55, 0.85))
    ocean('sea_water_enemy', (0.006, 0.008, 0.07), (0.05, 0.06, 0.25), (0.35, 0.3, 0.7))
