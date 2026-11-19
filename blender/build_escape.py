# 封印のとびら: 石のアーチと木の扉(背景)・水晶(5色)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *


def arch_outline(w, h, n=64):
    """上が半円のアーチ形(底辺中央が原点)"""
    r = w / 2
    pts = [(-r, 0)]
    for i in range(n + 1):
        a = math.pi - math.pi * i / n
        pts.append((r * math.cos(a), h - r + r * math.sin(a)))
    pts.append((r, 0))
    return pts


def slab(pts, z0, z1, name, bev=0.02):
    bm = bmesh.new()
    vs = [bm.verts.new((x, z0, y)) for x, y in pts]      # XZ 平面(正面が -Y)
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]:
        v.co.y = z1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    if bev:
        bevel(o, bev, 3)
    return o


def door():
    reset()
    world(0.05, top=(0.6, 0.5, 0.4), bottom=(0.05, 0.03, 0.02))
    W, H = 3.0, 4.6
    # 石のアーチ(外枠): 大きなアーチから内側をくりぬく
    stone = mat('stone', (0.3, 0.26, 0.22), rough=0.9)
    color_noise(stone, (0.1, 0.09, 0.08), (0.36, 0.32, 0.27), 5, 10, 0.3, 0.75)
    noise_bump(stone, 9, 0.6, 12)
    outer = slab(arch_outline(W + 0.7, H + 0.4), -0.25, 0.3, 'outer', 0.05)
    inner = slab(arch_outline(W, H), -0.6, 0.6, 'cut', 0)
    bo = outer.modifiers.new('cut', 'BOOLEAN'); bo.object = inner; bo.operation = 'DIFFERENCE'
    apply_mods(outer); bpy.data.objects.remove(inner)
    assign(outer, stone)
    # 石の継ぎ目(要石まわりの放射線)
    jm = mat('joint', (0.08, 0.06, 0.05), rough=1)
    r_in, r_out, cy = W / 2, W / 2 + 0.35, H - W / 2
    for z in (0.7, 1.5, 2.3):
        for sx in (-1, 1):
            c = cube((0.36, 0.02, 0.025), (sx * (r_in + 0.17), -0.255, z), 'j'); assign(c, jm)
    # 要石(金の紋章をはめる台)
    ks = slab([(-0.28, 0), (0.28, 0), (0.2, 0.5), (-0.2, 0.5)], -0.34, 0.2, 'key', 0.03)
    ks.location = (0, 0, H - 0.1); assign(ks, stone)
    # 木の扉(縦板2枚)
    wood = mat('wood', (0.35, 0.2, 0.1), rough=0.6)
    nt = wood.node_tree; p = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); wv = nt.nodes.new('ShaderNodeTexWave'); wv.bands_direction = 'X'
    wv.inputs['Scale'].default_value = 7; wv.inputs['Distortion'].default_value = 9; wv.inputs['Detail'].default_value = 6
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, 1, 0.12)
    rp = nt.nodes.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].color = (0.06, 0.025, 0.01, 1); rp.color_ramp.elements[1].color = (0.26, 0.13, 0.05, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], wv.inputs['Vector'])
    nt.links.new(wv.outputs['Fac'], rp.inputs['Fac']); nt.links.new(rp.outputs['Color'], p.inputs['Base Color'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.25
    nt.links.new(wv.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    planks = 6
    pw = W / planks
    ra = (W - 0.02) / 2; ca = (H - 0.01) - ra
    top = lambda x: ca + math.sqrt(max(0.0, ra * ra - x * x))
    for i in range(planks):
        x0, x1 = -W / 2 + i * pw + 0.012, -W / 2 + (i + 1) * pw - 0.012
        xs = [x1 - (x1 - x0) * k / 16 for k in range(17)]
        poly = [(x0, 0), (x1, 0)] + [(x, top(x)) for x in xs]
        pl = slab(poly, -0.05, 0.1, 'plank', 0.015); assign(pl, wood)
    # 鉄の帯と鋲
    iron = mat('iron', (0.12, 0.12, 0.13), rough=0.45, metal=0.9)
    noise_bump(iron, 40, 0.3)
    for z in (0.6, 2.0, 3.3):
        hw = W / 2 if z < cy else math.sqrt(max(0, (W / 2) ** 2 - (z - cy) ** 2))
        b = cube((hw * 2 - 0.06, 0.05, 0.16), (0, -0.07, z), 'band'); bevel(b, 0.012, 2); assign(b, iron)
        for k in range(9):
            x = -hw + 0.12 + k * (hw * 2 - 0.24) / 8
            r = sphere(0.032, (x, -0.1, z), 16, 8, 'rivet'); assign(r, iron)
    # 中央の継ぎ目と金のふち
    gold = mat('gold', (1.0, 0.7, 0.25), rough=0.25, metal=1.0)
    seam = cube((0.03, 0.06, H - 0.4), (0, -0.06, (H - 0.4) / 2), 'seam'); assign(seam, mat('sm', (0.05, 0.03, 0.02), rough=1))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.62, minor_radius=0.04, major_segments=96, minor_segments=12, location=(0, -0.1, 2.0))
    t = bpy.context.object; t.rotation_euler = (math.radians(90), 0, 0); assign(t, gold)
    # 照明: 左右のたいまつ風の暖色+上からの光
    for sx in (-1, 1):
        l = light('POINT', (sx * 2.3, -1.0, 3.0), energy=260, size=0.25, color=(1.0, 0.55, 0.2), name='torch')
    k = light('AREA', (0, -4, 5.5), energy=230, size=3, color=(1.0, 0.85, 0.65), name='key'); look_at(k, (0, 0, 2.2))
    f = light('AREA', (0, -6, 1), energy=150, size=5, color=(0.5, 0.45, 0.7), name='fill', glossy=False); look_at(f, (0, 0, 1.5))
    cam_persp((0, -12, (H + 0.4) / 2), (0, 0, (H + 0.4) / 2), ortho=H + 0.55, res=(720, 1000))
    render('escape_door')


def crystal(name, col):
    reset()
    world(0.3, top=(0.9, 0.9, 1.0), bottom=(0.1, 0.1, 0.15))
    # 六角柱の先をとがらせた結晶
    bm = bmesh.new()
    n = 6; r = 0.22
    bot = [bm.verts.new((r * 0.75 * math.cos(2 * math.pi * i / n + 0.3), r * 0.75 * math.sin(2 * math.pi * i / n + 0.3), 0)) for i in range(n)]
    mid = [bm.verts.new((r * math.cos(2 * math.pi * i / n + 0.3), r * math.sin(2 * math.pi * i / n + 0.3), 0.55)) for i in range(n)]
    tip = bm.verts.new((0, 0, 0.9)); base = bm.verts.new((0, 0, -0.05))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], mid[j], mid[i])); bm.faces.new((mid[i], mid[j], tip)); bm.faces.new((bot[j], bot[i], base))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('c'); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('crystal', me); bpy.context.collection.objects.link(o)
    bevel(o, 0.01, 2)
    for p in o.data.polygons:
        p.use_smooth = False
    m = mat('cr', col, rough=0.02, trans=0.6, coat=1.0, ior=1.6, emit=col, emit_str=0.8)
    assign(o, m)
    # 小さな結晶を2本添える
    for sx, sc, rz in ((-0.18, 0.55, 0.35), (0.2, 0.45, -0.4)):
        c = o.copy(); c.data = o.data; bpy.context.collection.objects.link(c)
        c.scale = (sc, sc, sc); c.location = (sx, 0.02, 0); c.rotation_euler = (0, rz, 0)
    k = light('AREA', (-1.2, -2, 2.4), energy=120, size=1, name='key'); look_at(k, (0, 0, 0.4))
    r = light('AREA', (1.2, 1.5, 1.5), energy=200, size=0.6, name='rim'); look_at(r, (0, 0, 0.4))
    cam_persp((0, -6, 1.2), (0, 0, 0.42), ortho=1.15, res=(128, 160))
    render(name)


which = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
if 'all' in which or 'door' in which:
    door()
if 'all' in which or 'crystal' in which:
    for nm, c in (('red', (1.0, 0.1, 0.2)), ('blue', (0.1, 0.35, 1.0)), ('yellow', (1.0, 0.8, 0.05)), ('green', (0.08, 0.8, 0.25)), ('white', (0.9, 0.92, 1.0))):
        crystal('escape_crystal_' + nm, c)
