"""Avatar v2 — style « 3D à pâte 2D » (réf. Galactik Football).

Changements par rapport à la v1 :
  * Corps généré par METABALLS : les volumes fusionnent en une surface
    lisse et continue — plus aucune « bulle » apparente.
  * Tête = UV-sphere avec UVs calculés à la main + TEXTURE de visage anime
    dessinée par code (yeux, sourcils, nez, bouche).
  * Cheveux en mèches coniques (style afro court de la réf. 1).
  * Rendu de contrôle en toon shading + contours Freestyle.

Les poids de skin sont calculés à la main : pour chaque vertex, blend des
2 os les plus proches (falloff en 1/d²) — robuste sur mesh continu.
"""
import bpy
import math
import random
from mathutils import Vector

SCRATCH = "/tmp/claude-0/-home-user-SFL/f3643510-aa7d-5bd3-93fe-68890f1ebf77/scratchpad"

random.seed(7)

# ---------------------------------------------------------------- squelette
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.fbx(filepath=f"{SCRATCH}/neutral_idle.fbx")
ARM = next(o for o in bpy.data.objects if o.type == "ARMATURE")
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    bpy.data.objects.remove(o, do_unlink=True)

def bh(n):
    return ARM.matrix_world @ ARM.data.bones["mixamorig:" + n].head_local

def bt(n):
    return ARM.matrix_world @ ARM.data.bones["mixamorig:" + n].tail_local

HIPS, SPINE, SPINE1, SPINE2 = bh("Hips"), bh("Spine"), bh("Spine1"), bh("Spine2")
NECK, HEAD, HEAD_TOP = bh("Neck"), bh("Head"), bh("HeadTop_End")
L_SHO, R_SHO = bh("LeftArm"), bh("RightArm")
L_ELB, R_ELB = bh("LeftForeArm"), bh("RightForeArm")
L_WRI, R_WRI = bh("LeftHand"), bh("RightHand")
L_TIP = ARM.matrix_world @ ARM.data.bones["mixamorig:LeftHandMiddle1"].tail_local
R_TIP = ARM.matrix_world @ ARM.data.bones["mixamorig:RightHandMiddle1"].tail_local
L_HIP, R_HIP = bh("LeftUpLeg"), bh("RightUpLeg")
L_KNEE, R_KNEE = bh("LeftLeg"), bh("RightLeg")
L_ANK, R_ANK = bh("LeftFoot"), bh("RightFoot")
L_TOE, R_TOE = bt("LeftToeBase"), bt("RightToeBase")

HEAD_H = (HEAD_TOP - HEAD).length
head_c = HEAD + (HEAD_TOP - HEAD) * 0.56
head_r = HEAD_H * 0.62

# ---------------------------------------------------------------- matériaux
def mat(name, rgba, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Roughness"].default_value = rough
    return m

SKIN_RGBA = (0.60, 0.32, 0.14, 1)  # médium (linéaire approx)
M = {
    "Skin": mat("Skin", SKIN_RGBA),
    "Shirt": mat("Shirt", (0.09, 0.32, 0.72, 1)),
    "Shorts": mat("Shorts", (0.93, 0.94, 0.96, 1)),
    "Socks": mat("Socks", (0.93, 0.94, 0.96, 1)),
    "Shoes": mat("Shoes", (0.07, 0.07, 0.08, 1)),
    "Hair": mat("Hair", (0.09, 0.055, 0.035, 1)),
}
# matériau visage : texture image
face_mat = bpy.data.materials.new("FaceTex")
face_mat.use_nodes = True
bsdf = face_mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.9
tex = face_mat.node_tree.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(f"{SCRATCH}/face_medium.png")
face_mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

# ---------------------------------------------------------------- corps (metaballs)
mball = bpy.data.metaballs.new("bodymb")
mball.resolution = 0.010
mb_obj = bpy.data.objects.new("BodyMB", mball)
bpy.context.collection.objects.link(mb_obj)

def ball(p, r):
    el = mball.elements.new()
    el.co = p
    el.radius = r
    el.stiffness = 2.0

def chain(a, b, r0, r1, n=None):
    """Chaîne dense : l'espacement reste sous 0.5x le rayon local pour que
    les boules fusionnent en un volume continu (fini l'effet collier)."""
    dist = (b - a).length
    r_min = min(r0, r1)
    if n is None:
        n = max(3, int(dist / (r_min * 0.45)) + 1)
    for i in range(n):
        t = i / (n - 1)
        ball(a.lerp(b, t), r0 + (r1 - r0) * t)

# Torse athlétique : épaules larges, taille marquée
ball(HIPS, 0.12)
ball(HIPS + Vector((0.06, 0, 0.01)), 0.085)
ball(HIPS + Vector((-0.06, 0, 0.01)), 0.085)
ball(SPINE, 0.112)
ball(SPINE1, 0.105)
ball(SPINE2, 0.12)
ball(SPINE2 + Vector((0, 0.012, 0.055)), 0.118)  # pectoraux/haut du buste
ball(L_SHO + (SPINE2 - L_SHO) * 0.25, 0.088)      # trapèzes
ball(R_SHO + (SPINE2 - R_SHO) * 0.25, 0.088)
ball(L_SHO, 0.085)                                 # deltoïdes
ball(R_SHO, 0.085)
ball(L_SHO + Vector((0.02, 0, -0.01)), 0.07)       # élargit la carrure
ball(R_SHO + Vector((-0.02, 0, -0.01)), 0.07)
# Colonne : assurer la continuité bassin -> poitrine
chain(HIPS, SPINE2, 0.108, 0.115)
# Cou
chain(NECK, HEAD + Vector((0, 0, 0.015)), 0.062, 0.064)
# Épaules -> torse continu
chain(L_SHO, SPINE2, 0.075, 0.10)
chain(R_SHO, SPINE2, 0.075, 0.10)
# Bras
for sho, elb, wri, tip in ((L_SHO, L_ELB, L_WRI, L_TIP), (R_SHO, R_ELB, R_WRI, R_TIP)):
    chain(sho, elb, 0.072, 0.058)
    chain(elb, wri, 0.058, 0.044)
    chain(wri, tip, 0.048, 0.038)                  # main moufle
# Jambes
for hip, knee, ank, toe in ((L_HIP, L_KNEE, L_ANK, L_TOE), (R_HIP, R_KNEE, R_ANK, R_TOE)):
    chain(hip, knee, 0.105, 0.070)
    chain(knee, ank, 0.070, 0.050)
    heel = ank + Vector((0, 0.035, -0.025))
    chain(heel, toe + Vector((0, -0.01, 0.012)), 0.055, 0.046)  # pied/chaussure

bpy.context.view_layer.objects.active = mb_obj
mb_obj.select_set(True)
bpy.ops.object.convert(target="MESH")
body = bpy.context.object
body.name = "Body"
print("metaball -> mesh:", len(body.data.vertices), "vertices")

# lisse + allège
dec = body.modifiers.new("dec", "DECIMATE")
dec.ratio = min(1.0, 16000 / max(1, len(body.data.polygons)))
bpy.ops.object.modifier_apply(modifier="dec")
bpy.ops.object.shade_smooth()
print("apres decimate:", len(body.data.polygons), "polys")

# ------------------------------------------------- matériaux du corps par zones
SUBSEG = [
    ("Shorts", HIPS + Vector((0, 0, -0.02)), HIPS + Vector((0, 0, 0.05))),
    ("Shorts", L_HIP, L_HIP + (L_KNEE - L_HIP) * 0.42),
    ("Shorts", R_HIP, R_HIP + (R_KNEE - R_HIP) * 0.42),
    ("Shirt", SPINE, SPINE2 + Vector((0, 0, 0.07))),
    ("Shirt", L_SHO + (SPINE2 - L_SHO) * 0.3, L_SHO + (L_ELB - L_SHO) * 0.42),
    ("Shirt", R_SHO + (SPINE2 - R_SHO) * 0.3, R_SHO + (R_ELB - R_SHO) * 0.42),
    ("Skin", L_SHO + (L_ELB - L_SHO) * 0.55, L_TIP),
    ("Skin", R_SHO + (R_ELB - R_SHO) * 0.55, R_TIP),
    ("Skin", NECK, HEAD + Vector((0, 0, 0.03))),
    ("Skin", L_HIP + (L_KNEE - L_HIP) * 0.55, L_KNEE + (L_ANK - L_KNEE) * 0.12),
    ("Skin", R_HIP + (R_KNEE - R_HIP) * 0.55, R_KNEE + (R_ANK - R_KNEE) * 0.12),
    ("Socks", L_KNEE + (L_ANK - L_KNEE) * 0.25, L_ANK),
    ("Socks", R_KNEE + (R_ANK - R_KNEE) * 0.25, R_ANK),
    ("Shoes", L_ANK + Vector((0, 0.03, -0.02)), L_TOE),
    ("Shoes", R_ANK + Vector((0, 0.03, -0.02)), R_TOE),
]

def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length

mat_slots = ["Shirt", "Shorts", "Skin", "Socks", "Shoes"]
for name in mat_slots:
    body.data.materials.append(M[name])
slot_of = {n: i for i, n in enumerate(mat_slots)}

for poly in body.data.polygons:
    c = Vector(poly.center)
    best, best_d = "Shirt", 1e9
    for label, a, b in SUBSEG:
        dd = seg_dist(c, a, b)
        if dd < best_d:
            best, best_d = label, dd
    poly.material_index = slot_of[best]

# ---------------------------------------------------------------- tête texturée
bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r, location=head_c,
                                     segments=48, ring_count=32)
head_o = bpy.context.object
head_o.name = "Head"
head_o.scale = (0.92, 0.98, 1.08)
# NB : location/rotation par défaut True sur cet opérateur — ne PAS les
# appliquer, sinon les coordonnées locales perdent leur centrage et la
# sculpture + les UVs partent en vrille.
bpy.ops.object.select_all(action="DESELECT")
head_o.select_set(True)
bpy.context.view_layer.objects.active = head_o
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.object.shade_smooth()

# menton/mâchoire : taper anime sous la ligne des yeux (plus étroit vers le bas,
# menton légèrement en avant)
me = head_o.data
for v in me.vertices:
    p = v.co  # local, centré
    if p.z < 0:
        t = min(1.0, -p.z / (head_r * 1.08))
        s = 1.0 - 0.30 * (t ** 1.8)
        v.co.x *= s
        v.co.y *= 1.0 - 0.12 * (t ** 2.0)
        if p.y < 0:
            v.co.y -= head_r * 0.10 * (t ** 2.4)   # menton qui avance
        v.co.z *= 0.96                              # menton moins long

# UVs contrôlés : u = 0.5 + atan2(x, -y)/2pi, v = 0.5 + asin(z_norm)/pi
# (on supprime d'abord l'unwrap par défaut de la uv_sphere, sinon c'est lui
# qui reste actif au rendu)
while me.uv_layers:
    me.uv_layers.remove(me.uv_layers[0])
uvl = me.uv_layers.new(name="UVMap")
for loop in me.loops:
    p = me.vertices[loop.vertex_index].co
    r_xy = Vector((p.x, p.y, p.z)).length
    zn = max(-1.0, min(1.0, p.z / max(r_xy, 1e-9)))
    u = 0.5 + math.atan2(p.x, -p.y) / (2 * math.pi)
    vv = 0.5 + math.asin(zn) / math.pi
    uvl.data[loop.index].uv = (u, vv)
me.materials.append(face_mat)

# Oreilles (peau unie)
ears = []
for sx in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=head_r * 0.15,
        location=head_c + Vector((sx * head_r * 0.90, 0.01, -head_r * 0.05)),
        segments=16, ring_count=12)
    e = bpy.context.object
    e.scale = (0.55, 0.9, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    e.data.materials.append(M["Skin"])
    ears.append(e)

# ---------------------------------------------------------------- cheveux
# Afro court en mèches : calotte + cônes distribués sur le crâne
hair_objs = []
bpy.ops.mesh.primitive_uv_sphere_add(radius=head_r * 1.02, location=head_c + Vector((0, 0.008, head_r * 0.06)),
                                     segments=32, ring_count=24)
cap = bpy.context.object
cap.scale = (1.02, 1.02, 1.0)
bpy.ops.object.transform_apply(scale=True)
# ne garder que la partie haute/arrière (au-dessus de la ligne des cheveux)
import bmesh
bm = bmesh.new()
bm.from_mesh(cap.data)
to_del = []
for v in bm.verts:
    w = cap.matrix_world @ v.co
    local = w - head_c
    front = -local.y / head_r          # >0 devant
    up = local.z / head_r
    if up < 0.30 - 0.45 * max(0.0, -front):   # garde haut + descend derrière
        if not (front < -0.2 and up > -0.25):
            to_del.append(v)
bmesh.ops.delete(bm, geom=to_del, context="VERTS")
bm.to_mesh(cap.data)
bm.free()
bpy.ops.object.shade_smooth()
cap.data.materials.append(M["Hair"])
hair_objs.append(cap)

# mèches coniques (denses au sommet pour couvrir tout le crâne)
for i in range(170):
    theta = random.uniform(0, 2 * math.pi)
    phi = random.uniform(0.0, 1.15) ** 0.8 * 1.15  # biais vers le sommet
    dirv = Vector((math.sin(phi) * math.cos(theta),
                   math.sin(phi) * math.sin(theta),
                   math.cos(phi)))
    # éviter le visage : mèches uniquement sur le sommet, les côtés hauts
    # et l'arrière — jamais sur le front/tempes
    front = -dirv.y
    if front > 0.05 and dirv.z < 0.55:
        continue
    if dirv.z < 0.0 and front > -0.35:
        continue
    base = head_c + Vector((0, 0.008, head_r * 0.06)) + dirv * head_r * 0.97
    ln = head_r * random.uniform(0.28, 0.5)
    bpy.ops.mesh.primitive_cone_add(radius1=head_r * random.uniform(0.13, 0.2),
                                    radius2=0, depth=ln, location=base + dirv * ln * 0.3,
                                    vertices=6)
    cone = bpy.context.object
    cone.rotation_mode = "QUATERNION"
    cone.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(dirv)
    cone.data.materials.append(M["Hair"])
    hair_objs.append(cone)

# ---------------------------------------------------------------- join total
bpy.ops.object.select_all(action="DESELECT")
all_parts = [body, head_o] + ears + hair_objs
for o in all_parts:
    o.select_set(True)
# La tête est l'objet actif du join : c'est son jeu de couches (UVMap du
# visage) qui sert de référence — sinon les UVs sont perdus.
bpy.context.view_layer.objects.active = head_o
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
avatar = bpy.context.object
avatar.name = "AvatarBody"
avatar.data.name = "AvatarBody"

# ---------------------------------------------------------------- poids de skin
WSEG = [
    ("Hips", HIPS + Vector((0, 0, -0.06)), SPINE),
    ("Spine1", SPINE, SPINE2),
    ("Spine2", SPINE2, NECK),
    ("Neck", NECK, HEAD),
    ("Head", HEAD, HEAD_TOP + Vector((0, 0, 0.3))),
    ("LeftArm", L_SHO, L_ELB), ("RightArm", R_SHO, R_ELB),
    ("LeftForeArm", L_ELB, L_WRI), ("RightForeArm", R_ELB, R_WRI),
    ("LeftHand", L_WRI, L_TIP), ("RightHand", R_WRI, R_TIP),
    ("LeftUpLeg", L_HIP, L_KNEE), ("RightUpLeg", R_HIP, R_KNEE),
    ("LeftLeg", L_KNEE, L_ANK), ("RightLeg", R_KNEE, R_ANK),
    ("LeftFoot", L_ANK, L_TOE), ("RightFoot", R_ANK, R_TOE),
]
groups = {}
for name, _, _ in WSEG:
    full = "mixamorig:" + name
    if full not in groups:
        groups[full] = avatar.vertex_groups.new(name=full)

for i, v in enumerate(avatar.data.vertices):
    p = v.co
    dists = sorted(((seg_dist(p, a, b), n) for n, a, b in WSEG))[:2]
    (d0, n0), (d1, n1) = dists
    w0 = 1.0 / max(d0, 1e-5) ** 2
    w1 = 1.0 / max(d1, 1e-5) ** 2
    tot = w0 + w1
    # dominance franche : si un os est bien plus proche, on lui donne tout
    if d0 * 2.2 < d1:
        groups["mixamorig:" + n0].add([i], 1.0, "REPLACE")
    else:
        groups["mixamorig:" + n0].add([i], w0 / tot, "REPLACE")
        groups["mixamorig:" + n1].add([i], w1 / tot, "REPLACE")

avatar.parent = ARM
avatar.matrix_parent_inverse = ARM.matrix_world.inverted()
mod = avatar.modifiers.new("Armature", "ARMATURE")
mod.object = ARM

# ---------------------------------------------------------------- shape keys
bpy.context.view_layer.objects.active = avatar
avatar.shape_key_add(name="Basis")
mesh_data = avatar.data

def gidx(name):
    vg = avatar.vertex_groups.get("mixamorig:" + name)
    return vg.index if vg else -1

INFLATE = {}
for n, f in [("Hips", 1.0), ("Spine1", 1.0), ("Spine2", 1.0),
             ("LeftArm", 0.55), ("RightArm", 0.55),
             ("LeftForeArm", 0.55), ("RightForeArm", 0.55),
             ("LeftUpLeg", 0.6), ("RightUpLeg", 0.6),
             ("LeftLeg", 0.55), ("RightLeg", 0.55),
             ("Neck", 0.3), ("Head", 0.06)]:
    INFLATE[gidx(n)] = f

def vfactor(v):
    f = 0.0
    for g in v.groups:
        f = max(f, INFLATE.get(g.group, 0.0) * g.weight)
    return f

def add_key(name, fn):
    key = avatar.shape_key_add(name=name, from_mix=False)
    basis = mesh_data.shape_keys.key_blocks["Basis"]
    for i, v in enumerate(mesh_data.vertices):
        key.data[i].co = fn(basis.data[i].co.copy(), v)
    return key

AMP = 0.05
add_key("Costaud", lambda co, v: co + v.normal * (AMP * vfactor(v)))
add_key("Mince", lambda co, v: co - v.normal * (AMP * 0.45 * vfactor(v)))

head_gi = gidx("Head")
def head_w(v):
    for g in v.groups:
        if g.group == head_gi:
            return g.weight
    return 0.0

def reshape_head(co, sx, sy, szu, szd):
    p = co - head_c
    p.x *= sx
    p.y *= sy
    p.z *= (szu if p.z > 0 else szd)
    return head_c + p

add_key("TeteCarree",
        lambda co, v: co if head_w(v) < 0.5 else reshape_head(co, 1.14, 1.03, 0.92, 1.02))
add_key("TeteLongue",
        lambda co, v: co if head_w(v) < 0.5 else reshape_head(co, 0.91, 0.97, 1.12, 1.10))

# ---------------------------------------------------------------- export GLB
# AVANT la conversion toon : le GLB garde les matériaux Principled (+ texture
# visage embarquée) ; le rendu toon in-app est fait par three.js.
bpy.ops.object.select_all(action="DESELECT")
avatar.select_set(True)
ARM.select_set(True)
bpy.ops.export_scene.gltf(
    filepath="/home/user/SFL/public/models/avatar-base.glb",
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_morph=True,
    export_skins=True,
    export_apply=False,
    export_yup=True,
)
print("GLB exporte")

# ---------------------------------------------------------------- rendu toon
scene.frame_set(110)

# Toon BSDF pour le rendu (le GLB gardera les Principled ; le toon in-app
# sera fait par three.js)
for m in list(M.values()) + [face_mat]:
    nt = m.node_tree
    bsdf_node = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    toon = nt.nodes.new("ShaderNodeBsdfToon")
    toon.inputs["Size"].default_value = 0.7
    toon.inputs["Smooth"].default_value = 0.02
    if m.name == "FaceTex":
        nt.links.new(tex.outputs["Color"], toon.inputs["Color"])
    else:
        toon.inputs["Color"].default_value = bsdf_node.inputs["Base Color"].default_value
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    nt.links.new(toon.outputs["BSDF"], out.inputs["Surface"])

bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
floor = bpy.context.object
fm = mat("floor", (0.86, 0.88, 0.92, 1), 1.0)
floor.data.materials.append(fm)

world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
wbg = world.node_tree.nodes["Background"]
wbg.inputs[0].default_value = (0.84, 0.87, 0.92, 1)
wbg.inputs[1].default_value = 1.0

bpy.ops.object.light_add(type="SUN", location=(3, -3, 6))
sun = bpy.context.object
sun.data.energy = 4.0
sun.rotation_euler = (math.radians(50), 0, math.radians(35))

# Freestyle : contours noirs
scene.render.use_freestyle = True
scene.render.line_thickness = 1.6
vl = bpy.context.view_layer
fs = vl.freestyle_settings
ls = fs.linesets.new("contours")
ls.select_silhouette = True
ls.select_border = True
ls.select_crease = False
ls.select_contour = True
ls.select_external_contour = True
# tout lineset (y compris celui par défaut) doit avoir un linestyle,
# sinon Freestyle plante à chaque rendu
for lset in fs.linesets:
    if lset.linestyle is None:
        lset.linestyle = bpy.data.linestyles.new("style_" + lset.name)

bpy.ops.object.camera_add(location=(1.35, -2.9, 1.35))
cam = bpy.context.object
cam.rotation_euler = (math.radians(81), 0, math.radians(25))
cam.data.lens = 60
scene.camera = cam

scene.render.engine = "CYCLES"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 700
scene.render.resolution_y = 900

scene.render.filepath = f"{SCRATCH}/toon_full.png"
bpy.ops.render.render(write_still=True)

cam.location = (0.5, -1.15, HEAD.z + 0.06)
cam.rotation_euler = (math.radians(86), 0, math.radians(23))
scene.render.filepath = f"{SCRATCH}/toon_face.png"
bpy.ops.render.render(write_still=True)

cam.location = (-1.6, -2.6, 1.15)
cam.rotation_euler = (math.radians(83), 0, math.radians(-31))
scene.render.filepath = f"{SCRATCH}/toon_34.png"
bpy.ops.render.render(write_still=True)

# Debug : tête plein face (sans rotation de caméra parasite)
cam.location = (0, HEAD.y - 1.05, HEAD.z + 0.05)
cam.rotation_euler = (math.radians(90), 0, 0)
scene.render.filepath = f"{SCRATCH}/toon_face_front.png"
bpy.ops.render.render(write_still=True)
print("RENDUS OK")
