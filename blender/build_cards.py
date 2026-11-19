# エレメントデュエル: 炎・水・草のせい(各3段階)  正面やや上から
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *


def card_lights():
    world(0.22, top=(0.85, 0.9, 1.0), bottom=(0.2, 0.18, 0.22))
    k = light('AREA', (-2.2, -3.0, 3.2), energy=380, size=2.2, color=(1, 0.96, 0.9), name='key'); look_at(k, (0, 0, 0.5))
    f = light('AREA', (2.8, -2.2, 1.2), energy=150, size=3.5, color=(0.85, 0.9, 1), name='fill', glossy=False); look_at(f, (0, 0, 0.5))
    r = light('AREA', (1.5, 2.8, 2.8), energy=600, size=1.6, color=(1, 1, 1), name='rim'); look_at(r, (0, 0, 0.6))


def blob(elems, name, res=0.02):
    """メタボールで有機的な体を作ってメッシュ化"""
    bpy.ops.object.metaball_add(type='BALL', radius=1, location=(0, 0, 0))
    mb = bpy.context.object; md = mb.data; md.resolution = res; md.render_resolution = res; md.threshold = 0.6
    md.elements.clear()
    for e in elems:
        el = md.elements.new()
        el.type = e.get('type', 'BALL'); el.co = e['co']; el.radius = e['r']; el.stiffness = e.get('s', 2.0)
        if el.type == 'ELLIPSOID':
            el.size_x, el.size_y, el.size_z = e['size']
        if 'rot' in e:
            el.rotation = Euler(e['rot']).to_quaternion()
    bpy.context.view_layer.update()
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object; o.name = name
    md2 = o.modifiers.new('sm', 'SMOOTH'); md2.factor = 0.6; md2.iterations = 6
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def face(z, y, spread=0.17, size=0.085, blush=(1, 0.45, 0.55), happy=False):
    """目(白い反射つき)・口・ほっぺ。y は顔の表面位置(-Y が正面)"""
    eye = mat('eye', (0.02, 0.02, 0.04), rough=0.05, coat=1.0)
    hl = mat('hl', (1, 1, 1), emit=(1, 1, 1), emit_str=1.2)
    for sx in (-1, 1):
        e = sphere(size, (sx * spread, y, z), 32, 16, 'eye'); e.scale = (0.85, 0.45, 1.15); assign(e, eye)
        h = sphere(size * 0.32, (sx * spread - size * 0.25, y - size * 0.42, z + size * 0.45), 16, 8, 'hl'); assign(h, hl)
        h2 = sphere(size * 0.14, (sx * spread + size * 0.3, y - size * 0.42, z - size * 0.4), 12, 6, 'hl2'); assign(h2, hl)
        b = sphere(size * 0.6, (sx * (spread + size * 1.2), y + size * 0.35, z - size * 1.3), 24, 12, 'blush'); b.scale = (1.25, 0.35, 0.7)
        assign(b, mat('bl', blush, rough=0.85, spec=0.2))
    # 口: 小さな弧
    bpy.ops.mesh.primitive_torus_add(major_radius=size * 0.55, minor_radius=size * 0.13, major_segments=32, minor_segments=8,
                                     location=(0, y - 0.005, z - size * 1.15))
    m = bpy.context.object; m.rotation_euler = (math.radians(90), 0, 0)
    bm = bmesh.new(); bm.from_mesh(m.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > -size * 0.1], context='VERTS')   # 上半分を消して笑顔の弧に
    bm.to_mesh(m.data); bm.free(); assign(m, eye)


def gradient_mat(name, c_low, c_high, emit=0.0, rough=0.25, sss=0.0, trans=0.0, z0=0.0, z1=1.2, coat=0.6):
    m = mat(name, c_low, rough=rough, sss=sss, trans=trans, coat=coat)
    nt = m.node_tree; p = nt.nodes.get('Principled BSDF')
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = z0; mr.inputs['From Max'].default_value = z1
    r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color = (*c_low, 1); r.color_ramp.elements[1].color = (*c_high, 1)
    nt.links.new(tc.outputs['Object'], sep.inputs[0]); nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], r.inputs['Fac']); nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
    if emit:
        nt.links.new(r.outputs['Color'], p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value = emit
    return m


def crown(z, r=0.16):
    gold = mat('gold', (1.0, 0.68, 0.12), rough=0.25, metal=0.7, emit=(1.0, 0.6, 0.1), emit_str=0.15)
    gem = mat('gem', (0.9, 0.1, 0.3), rough=0.02, coat=1, emit=(1, 0.2, 0.4), emit_str=1.0)
    band = cyl(r, 0.06, 64, (0, 0, z), 'band'); assign(band, gold); bevel(band, 0.01, 2)
    for i in range(5):
        a = 2 * math.pi * i / 5 + math.pi / 2
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.045, radius2=0.0, depth=0.12, location=(r * math.cos(a), r * math.sin(a), z + 0.08))
        c = bpy.context.object; assign(c, gold); smooth(c, 0)
        s = sphere(0.022, (r * math.cos(a), r * math.sin(a), z + 0.15), 16, 8, 'ball'); assign(s, gold)
    g = sphere(0.035, (0, -r - 0.005, z), 24, 12, 'gem'); g.scale = (1, 0.5, 1); assign(g, gem)


def sparkles(n, rad, z, col, seed=1):
    random.seed(seed)
    m = mat('spk', col, emit=col, emit_str=1.6)
    for i in range(n):
        a = random.uniform(0, 2 * math.pi); rr = rad * random.uniform(0.8, 1.15)
        s = sphere(random.uniform(0.018, 0.035), (rr * math.cos(a), rr * math.sin(a) * 0.6 + 0.2, z + random.uniform(-0.35, 0.45)), 12, 6, 'spk'); assign(s, m)


def fire(lv):
    reset(); card_lights()
    s = 0.8 + lv * 0.12
    el = [dict(co=(0, 0, 0.32 * s), r=0.42 * s), dict(co=(0, 0, 0.62 * s), r=0.3 * s),
          dict(co=(0, 0.02, 0.88 * s), r=0.17 * s), dict(co=(0.02, 0.03, 1.04 * s), r=0.09 * s)]
    tongues = [(-0.2, 0.68, 0.14), (0.21, 0.64, 0.13)] if lv >= 1 else []
    if lv >= 2:
        tongues += [(-0.3, 0.48, 0.12), (0.31, 0.44, 0.12), (-0.1, 0.92, 0.1)]
    for x, z, r in tongues:
        el.append(dict(co=(x * s, 0.04, z * s), r=r * s))
        el.append(dict(co=(x * s * 1.18, 0.05, (z + 0.12) * s), r=r * 0.7 * s))
    body = blob(el, 'fire', 0.018)
    m = gradient_mat('fire', (0.85, 0.08, 0.0), (1.0, 0.72, 0.1), emit=0.35, rough=0.35, z0=0.05, z1=1.0 * s, coat=0.3)
    assign(body, m)
    # 内側の明るい芯
    face(0.4 * s, -0.4 * s, 0.13 * s, 0.07 * s, blush=(1, 0.75, 0.3))
    if lv >= 1:   # 小さな手
        for sx in (-1, 1):
            h = sphere(0.085 * s, (sx * 0.3 * s, -0.2 * s, 0.2 * s), 24, 12, 'hand'); assign(h, m)
    if lv >= 2:
        crown(1.08 * s, 0.16 * s)
        sparkles(10, 0.62 * s, 0.6 * s, (1, 0.6, 0.15), 3)
    return s


def water(lv):
    reset(); card_lights()
    s = 0.8 + lv * 0.12
    el = [dict(co=(0, 0, 0.35 * s), r=0.45 * s), dict(co=(0, 0, 0.66 * s), r=0.26 * s), dict(co=(0, 0, 0.88 * s), r=0.14 * s),
          dict(co=(0, 0, 0.98 * s), r=0.08 * s)]
    if lv >= 1:
        for sx in (-1, 1):
            el.append(dict(type='ELLIPSOID', co=(sx * 0.36 * s, 0.05, 0.3 * s), r=0.17 * s, size=(1.4, 0.5, 0.8), rot=(0, sx * 0.6, 0)))
    if lv >= 2:
        el.append(dict(type='ELLIPSOID', co=(0, 0.3 * s, 0.75 * s), r=0.14 * s, size=(0.4, 1.3, 1.0)))
    body = blob(el, 'water', 0.018)
    m = gradient_mat('water', (0.0, 0.12, 0.65), (0.35, 0.8, 1.0), rough=0.05, sss=0.4, z0=0.0, z1=1.1 * s, coat=1.0)
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Transmission Weight'].default_value = 0.25
    assign(body, m)
    # 体の中の泡
    bub = mat('bub', (0.85, 0.97, 1), rough=0.02, coat=1, alpha=0.55, emit=(0.6, 0.9, 1), emit_str=0.4)
    for x, z, r in ((0.14, 0.62, 0.035),):
        b = sphere(r * s, (x * s, -0.22 * s, z * s), 16, 8, 'bub'); assign(b, bub)
    face(0.4 * s, -0.43 * s, 0.14 * s, 0.072 * s, blush=(0.95, 0.5, 0.65))
    if lv >= 2:
        crown(1.06 * s, 0.15 * s)
        sparkles(12, 0.65 * s, 0.6 * s, (0.5, 0.9, 1.0), 5)
    return s


def leaf(loc, rot, size, m):
    """葉っぱ: 先のとがった、ふっくらした楕円体"""
    o = sphere(1, (0, 0, 0), 48, 24, 'leaf')
    for v in o.data.vertices:
        z = v.co.z                     # -1..1 を葉の付け根..先に
        t = (z + 1) / 2
        w = math.sin(t * math.pi) ** 0.8 * (1 - t * 0.35)
        v.co.x *= w * 0.38; v.co.y *= w * 0.1; v.co.z = t
        v.co.y += (v.co.x * 2.2) ** 2 * 0.25 - t * t * 0.12       # 少し反らせる
    o.scale = (size, size, size); o.location = loc; o.rotation_euler = rot
    smooth(o, 1); assign(o, m)
    return o


def grass(lv):
    reset(); card_lights()
    s = 0.8 + lv * 0.12
    el = [dict(type='ELLIPSOID', co=(0, 0, 0.36 * s), r=0.44 * s, size=(1.08, 1.0, 0.9))]
    if lv >= 1:
        for sx in (-1, 1):
            el.append(dict(co=(sx * 0.2 * s, -0.05, 0.08 * s), r=0.16 * s))     # 足
    body = blob(el, 'grass', 0.018)
    m = gradient_mat('grass', (0.04, 0.3, 0.06), (0.4, 0.78, 0.15), rough=0.4, sss=0.2, z0=0.0, z1=0.8 * s, coat=0.4)
    noise_bump(m, 30, 0.08, 4)
    assign(body, m)
    face(0.42 * s, -0.42 * s, 0.15 * s, 0.075 * s)
    lm = gradient_mat('leaf', (0.03, 0.28, 0.04), (0.35, 0.72, 0.1), rough=0.35, sss=0.2, z0=0.6 * s, z1=1.2 * s, coat=0.5)
    top = 0.5 * s
    stem = cyl(0.025 * s, 0.14 * s, 16, (0, 0, top + 0.05 * s), 'stem'); assign(stem, mat('stem', (0.35, 0.55, 0.15), rough=0.5))
    leaf((0, 0, top + 0.1 * s), (0, math.radians(-50), 0), 0.38 * s, lm)
    leaf((0, 0, top + 0.1 * s), (0, math.radians(50), 0), 0.38 * s, lm)
    if lv >= 1:
        leaf((0, 0.02, top + 0.1 * s), (math.radians(25), 0, 0), 0.3 * s, lm)
        for sx in (-1, 1):   # 腕の葉
            leaf((sx * 0.28 * s, -0.08 * s, 0.26 * s), (0, math.radians(sx * 110), 0), 0.24 * s, lm)
    if lv >= 2:
        # 花の冠
        pet = mat('pet', (1.0, 0.55, 0.75), rough=0.4, sss=0.3)
        cen = mat('cen', (1.0, 0.8, 0.2), rough=0.4)
        for k in range(7):
            a = math.radians(-10 + 200 * k / 6)          # 後ろ半分だけに並べて顔をかくさない
            cx, cy = 0.4 * s * math.cos(a), 0.28 * s * math.sin(a) + 0.05 * s
            for pi_ in range(5):
                b = 2 * math.pi * pi_ / 5
                p = sphere(0.04 * s, (cx + 0.045 * s * math.cos(b), cy + 0.045 * s * math.sin(b), top + 0.02 * s), 16, 8, 'pet'); p.scale = (1.3, 1.3, 0.4); assign(p, pet)
            c = sphere(0.03 * s, (cx, cy, top + 0.04 * s), 16, 8, 'cen'); assign(c, cen)
        sparkles(10, 0.62 * s, 0.6 * s, (0.8, 1.0, 0.5), 7)
    return s


def shoot(name, s):
    h = 1.35 * s
    cam_persp((0, -6.5, 0.5 * s + 1.4), (0, 0, 0.5 * s), ortho=1.75 * s, res=(384, 384))
    render(name)


which = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['all']
for elname, fn in (('fire', fire), ('water', water), ('grass', grass)):
    if 'all' in which or elname in which:
        for lv in range(3):
            sc = fn(lv)
            shoot('card_%s%d' % (elname, lv), sc)
