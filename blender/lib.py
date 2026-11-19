# 共通部品: シーン初期化・マテリアル・カメラ・ライト・書き出し
# 使い方: blender -b --python blender/build_xxx.py
import bpy, bmesh, math, os, sys, random
from mathutils import Vector, Matrix, Euler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'blender', 'out')   # レンダー原本(PNG)。export.py が docs/img へ軽い WebP を書き出す
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try:
            sc.render.engine = eng
            break
        except TypeError:
            pass
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.resolution_percentage = 100
    # ゲーム素材は鮮やかさ優先(AgX は強い発光色が白くとびやすい)
    try:
        sc.view_settings.view_transform = 'Standard'
        sc.view_settings.look = 'None'
    except Exception:
        pass
    ee = sc.eevee
    for k, v in (('taa_render_samples', 96), ('use_shadows', True), ('use_raytracing', True),
                 ('use_gtao', True), ('shadow_ray_count', 2), ('shadow_step_count', 8)):
        try:
            setattr(ee, k, v)
        except Exception:
            pass
    try:
        ee.ray_tracing_options.resolution_scale = '1'
    except Exception:
        pass
    world(0.25)
    return sc


def world(strength=0.3, top=(0.55, 0.62, 0.8), bottom=(0.06, 0.06, 0.1)):
    w = bpy.data.worlds.new('W')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (*bottom, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (*top, 1)
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = -1
    mr.inputs['From Max'].default_value = 1
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs[0], out.inputs[0])
    return w


def mat(name, color=(0.8, 0.8, 0.8), rough=0.4, metal=0.0, emit=None, emit_str=0.0, coat=0.0,
        sss=0.0, trans=0.0, ior=1.45, alpha=1.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['IOR'].default_value = ior
    for nm, v in (('Coat Weight', coat), ('Subsurface Weight', sss), ('Transmission Weight', trans),
                  ('Specular IOR Level', spec), ('Alpha', alpha)):
        if nm in p.inputs:
            p.inputs[nm].default_value = v
    if sss and 'Subsurface Radius' in p.inputs:
        p.inputs['Subsurface Radius'].default_value = (1.0, 0.4, 0.25)
    if emit is not None:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = emit_str
    if trans > 0 or alpha < 1:
        try:
            m.surface_render_method = 'BLENDED' if alpha < 1 else 'DITHERED'
        except Exception:
            pass
    return m


def noise_bump(m, scale=40.0, strength=0.15, detail=6.0):
    """マテリアルに細かい凹凸を足す"""
    nt = m.node_tree
    p = nt.nodes.get('Principled BSDF')
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = strength
    nt.links.new(n.outputs['Fac'], b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return n


def color_noise(m, c1, c2, scale=6.0, detail=8.0, lo=0.35, hi=0.65):
    """ベース色を2色のまだら模様にする"""
    nt = m.node_tree
    p = nt.nodes.get('Principled BSDF')
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    r = nt.nodes.new('ShaderNodeValToRGB')
    r.color_ramp.elements[0].position = lo
    r.color_ramp.elements[0].color = (*c1, 1)
    r.color_ramp.elements[1].position = hi
    r.color_ramp.elements[1].color = (*c2, 1)
    nt.links.new(n.outputs['Fac'], r.inputs['Fac'])
    nt.links.new(r.outputs['Color'], p.inputs['Base Color'])
    return n


def assign(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)
    return obj


def smooth(obj, level=2, render=None):
    for f in obj.data.polygons:
        f.use_smooth = True
    if level:
        md = obj.modifiers.new('sub', 'SUBSURF')
        md.levels = level
        md.render_levels = render or level
    return obj


def bevel(obj, width=0.02, seg=4):
    md = obj.modifiers.new('bev', 'BEVEL')
    md.width = width
    md.segments = seg
    md.limit_method = 'ANGLE'
    md.harden_normals = False
    for f in obj.data.polygons:
        f.use_smooth = True
    return obj


def active(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def apply_mods(o):
    active(o)
    for md in list(o.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=md.name)
        except Exception:
            pass


def cyl(r=1, depth=1, v=96, loc=(0, 0, 0), name='cyl'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=depth, location=loc)
    o = bpy.context.object
    o.name = name
    return o


def sphere(r=1, loc=(0, 0, 0), seg=64, ring=32, name='sph'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=r, location=loc)
    o = bpy.context.object
    o.name = name
    for f in o.data.polygons:
        f.use_smooth = True
    return o


def cube(size=(1, 1, 1), loc=(0, 0, 0), name='box'):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.scale = size
    o.name = name
    bpy.ops.object.transform_apply(scale=True)
    return o


def lathe(profile, v=128, name='lathe'):
    """(半径, 高さ) の点列を回転させて回転体を作る"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for i in range(v):
        a = 2 * math.pi * i / v
        ring = [bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile]
        rings.append(ring)
    for i in range(v):
        a, b = rings[i], rings[(i + 1) % v]
        for j in range(len(profile) - 1):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    for f in me.polygons:
        f.use_smooth = True
    return o


def light(kind='AREA', loc=(0, 0, 5), rot=(0, 0, 0), energy=500, size=3, color=(1, 1, 1), name='L', spot=None, glossy=True):
    d = bpy.data.lights.new(name, kind)
    d.energy = energy
    d.color = color
    if kind == 'AREA':
        d.size = size
    elif kind in ('POINT', 'SPOT'):
        d.shadow_soft_size = size
    if kind == 'SPOT' and spot:
        d.spot_size = spot
        d.spot_blend = 0.6
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    if not glossy:
        o.visible_glossy = False
        try:
            d.specular_factor = 0.0
        except Exception:
            pass
    return o


def look_at(o, target):
    d = Vector(target) - o.location
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def studio(key=900, fill=250, rim=500, dist=6.0, warm=(1, 0.95, 0.88), cool=(0.75, 0.85, 1)):
    """上から見下ろす素材用の3点ライト"""
    k = light('AREA', (-dist * 0.6, dist * 0.55, dist), energy=key, size=dist * 0.25, color=warm, name='key')
    look_at(k, (0, 0, 0))
    f = light('AREA', (dist * 0.7, -dist * 0.2, dist * 0.6), energy=fill, size=dist, color=cool, name='fill', glossy=False)
    look_at(f, (0, 0, 0))
    r = light('AREA', (dist * 0.3, -dist * 0.9, dist * 0.35), energy=rim, size=dist * 0.3, color=(1, 1, 1), name='rim')
    look_at(r, (0, 0, 0))
    return k, f, r


def cam_top(ortho=2.0, z=20, res=(512, 512), name='cam'):
    c = bpy.data.cameras.new(name)
    c.type = 'ORTHO'
    c.ortho_scale = ortho
    c.clip_end = 200
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    o.location = (0, 0, z)
    o.rotation_euler = (0, 0, 0)
    sc = bpy.context.scene
    sc.camera = o
    sc.render.resolution_x, sc.render.resolution_y = res
    return o


def cam_persp(loc, target, lens=50, res=(512, 512), name='camp', ortho=None):
    c = bpy.data.cameras.new(name)
    if ortho:
        c.type = 'ORTHO'
        c.ortho_scale = ortho
    else:
        c.lens = lens
    c.clip_end = 300
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    o.location = loc
    look_at(o, target)
    sc = bpy.context.scene
    sc.camera = o
    sc.render.resolution_x, sc.render.resolution_y = res
    return o


def render(name, transparent=True):
    sc = bpy.context.scene
    sc.render.film_transparent = transparent
    path = os.path.join(OUT, name + '.png')
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('[render]', path)
    return path


def hide_all_but(keep):
    """keep に含まれるオブジェクト以外をレンダーから外す(ライト・カメラは残す)"""
    keep = set(keep)
    for o in bpy.context.scene.objects:
        if o.type in ('LIGHT', 'CAMERA'):
            continue
        o.hide_render = o not in keep and not any(p in keep for p in parents(o))


def parents(o):
    p = o.parent
    while p:
        yield p
        p = p.parent


def join(objs, name):
    for o in objs:
        apply_mods(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    return o
