"""Construit l'avatar humain stylisé riggé sur le squelette Mixamo.

Pipeline :
  1. Importe le FBX Mixamo (squelette + animation Neutral Idle), jette le bot.
  2. Construit un corps humain stylisé (footballeur) à partir des positions
     réelles des os : primitives qui se chevauchent, jointes en un seul mesh.
  3. Poids de skin déterministes : chaque primitive est pesée sur son os,
     les sphères d'articulation en 50/50.
  4. Shape keys : Mince / Costaud (corpulence), TeteCarree / TeteLongue.
  5. Export GLB (mesh + squelette + animation + morphs) et rendus de contrôle.
"""
import bpy
import math
from mathutils import Vector

SCRATCH = "/tmp/claude-0/-home-user-SFL/f3643510-aa7d-5bd3-93fe-68890f1ebf77/scratchpad"
OUT_GLB = "/home/user/SFL/public/models/avatar-base.glb"

# ---------------------------------------------------------------- import FBX
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.fbx(filepath=f"{SCRATCH}/neutral_idle.fbx")

ARM = next(o for o in bpy.data.objects if o.type == "ARMATURE")
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    bpy.data.objects.remove(o, do_unlink=True)

def bhead(name):
    return ARM.matrix_world @ ARM.data.bones["mixamorig:" + name].head_local

def btail(name):
    return ARM.matrix_world @ ARM.data.bones["mixamorig:" + name].tail_local

# Repères anatomiques (monde, mètres). Le perso fait ~1.78, pieds à z=0.
HIPS = bhead("Hips")
SPINE1, SPINE2 = bhead("Spine1"), bhead("Spine2")
NECK, HEAD, HEAD_TOP = bhead("Neck"), bhead("Head"), bhead("HeadTop_End")
L_SHO, R_SHO = bhead("LeftArm"), bhead("RightArm")
L_ELB, R_ELB = bhead("LeftForeArm"), bhead("RightForeArm")
L_WRI, R_WRI = bhead("LeftHand"), bhead("RightHand")
L_HANDTIP = ARM.matrix_world @ ARM.data.bones["mixamorig:LeftHandMiddle1"].tail_local
R_HANDTIP = ARM.matrix_world @ ARM.data.bones["mixamorig:RightHandMiddle1"].tail_local
L_HIP, R_HIP = bhead("LeftUpLeg"), bhead("RightUpLeg")
L_KNEE, R_KNEE = bhead("LeftLeg"), bhead("RightLeg")
L_ANK, R_ANK = bhead("LeftFoot"), bhead("RightFoot")
L_TOE, R_TOE = btail("LeftToeBase"), btail("RightToeBase")

SHO_W = (L_SHO - R_SHO).length          # largeur d'épaules (~0.36)
HEAD_H = (HEAD_TOP - HEAD).length       # hauteur os de tête

# ---------------------------------------------------------------- matériaux
def mat(name, rgba, rough=0.75):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Roughness"].default_value = rough
    return m

M = {
    "Skin": mat("Skin", (0.72, 0.45, 0.28, 1)),
    "Shirt": mat("Shirt", (0.10, 0.42, 0.88, 1)),
    "Shorts": mat("Shorts", (0.96, 0.96, 0.98, 1)),
    "Socks": mat("Socks", (0.96, 0.96, 0.98, 1)),
    "Shoes": mat("Shoes", (0.08, 0.08, 0.09, 1), 0.4),
    "Hair": mat("Hair", (0.11, 0.08, 0.05, 1)),
    "Dark": mat("Dark", (0.05, 0.05, 0.06, 1), 0.35),
}

PARTS = []  # (objet, [(bone, poids)] )

def sphere(name, r, loc, material, squash=(1, 1, 1), weights=None, rot=None, seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc,
                                         segments=seg, ring_count=seg // 2)
    o = bpy.context.object
    o.name = name
    o.scale = squash
    if rot:
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = rot
    o.data.materials.append(M[material])
    bpy.ops.object.shade_smooth()
    PARTS.append((o, weights or []))
    return o

def capsule(name, a, b, r, material, weights, taper=1.0):
    """Sphère étirée de a vers b (rayon r, extrémité b multipliée par taper)."""
    d = b - a
    mid = (a + b) / 2
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o = sphere(name, 1.0, mid, material,
               squash=(r, r * (0.9 + 0.1 * taper), d.length / 2 + r * 0.35),
               weights=weights, rot=rot)
    return o

B = lambda n: "mixamorig:" + n

# ---------------------------------------------------------------- corps
# Bassin (short) puis ventre/poitrine (maillot) — ovoïdes qui se chevauchent
sphere("pelvis", SHO_W * 0.40, HIPS - Vector((0, 0, 0.02)), "Shorts",
       (1, 0.72, 0.70), [(B("Hips"), 1)])
sphere("belly", SHO_W * 0.37, SPINE1, "Shirt", (1, 0.66, 0.82),
       [(B("Spine"), 0.5), (B("Spine1"), 0.5)])
chest_c = SPINE2 + Vector((0, 0, 0.055))
sphere("chest", SHO_W * 0.44, chest_c, "Shirt", (1, 0.62, 0.95),
       [(B("Spine2"), 1)])
# Barre d'épaules
capsule("shoulders", L_SHO, R_SHO, 0.072, "Shirt", [(B("Spine2"), 1)])

# Cou + tête
capsule("neck", NECK - Vector((0, 0, 0.02)), HEAD + Vector((0, 0, 0.02)),
        0.052, "Skin", [(B("Neck"), 1)])
head_c = HEAD + (HEAD_TOP - HEAD) * 0.55
head_r = HEAD_H * 0.65
sphere("head", head_r, head_c, "Skin", (0.94, 1.0, 1.06), [(B("Head"), 1)])
# Mâchoire légèrement avancée
sphere("jaw", head_r * 0.72, head_c + Vector((0, -head_r * 0.18, -head_r * 0.42)),
       "Skin", (0.88, 0.95, 0.78), [(B("Head"), 1)])
# Cheveux : calotte régulière + frange sur le front
sphere("hair", head_r * 1.05, head_c + Vector((0, head_r * 0.08, head_r * 0.35)),
       "Hair", (1, 1.0, 0.75), [(B("Head"), 1)])
sphere("fringe", head_r * 0.92, head_c + Vector((0, -head_r * 0.28, head_r * 0.62)),
       "Hair", (0.95, 1.0, 0.55), [(B("Head"), 1)])
# Yeux — posés sur la surface du visage pour rester visibles
for sx in (-1, 1):
    sphere("eye", head_r * 0.115,
           head_c + Vector((sx * head_r * 0.37, -head_r * 0.95, head_r * 0.05)),
           "Dark", (1, 0.45, 1.30), [(B("Head"), 1)], seg=16)
# Nez
sphere("nose", head_r * 0.14, head_c + Vector((0, -head_r * 1.0, -head_r * 0.22)),
       "Skin", (0.75, 0.85, 1.05), [(B("Head"), 1)], seg=16)
# Bouche — fine bande discrète
sphere("mouth", head_r * 0.30, head_c + Vector((0, -head_r * 0.92, -head_r * 0.52)),
       "Dark", (1, 0.22, 0.16), [(B("Head"), 1)], seg=16)
# Oreilles
for sx in (-1, 1):
    sphere("ear", head_r * 0.16, head_c + Vector((sx * head_r * 0.95, 0, -head_r * 0.05)),
           "Skin", (0.5, 0.8, 1.0), [(B("Head"), 1)], seg=16)

# Bras : manche courte sur le haut, peau ensuite
for side, sho, elb, wri, tip in (("Left", L_SHO, L_ELB, L_WRI, L_HANDTIP),
                                 ("Right", R_SHO, R_ELB, R_WRI, R_HANDTIP)):
    arm_b, fore_b, hand_b = B(side + "Arm"), B(side + "ForeArm"), B(side + "Hand")
    sphere("deltoid", 0.064, sho, "Shirt", (1, 1, 1.05), [(arm_b, 0.7), (B("Spine2"), 0.3)])
    # manche = moitié haute du bras
    capsule("sleeve", sho, sho + (elb - sho) * 0.5, 0.062, "Shirt", [(arm_b, 1)])
    capsule("upperarm", sho + (elb - sho) * 0.45, elb, 0.052, "Skin", [(arm_b, 1)])
    sphere("elbow", 0.052, elb, "Skin", weights=[(arm_b, 0.5), (fore_b, 0.5)], seg=16)
    capsule("forearm", elb, wri, 0.047, "Skin", [(fore_b, 1)], taper=0.85)
    sphere("wrist", 0.042, wri, "Skin", weights=[(fore_b, 0.5), (hand_b, 0.5)], seg=16)
    capsule("hand", wri, tip + (tip - wri) * 0.25, 0.05, "Skin", [(hand_b, 1)])

# Jambes : cuisse (short en haut, peau), chaussette, chaussure
for side, hip, knee, ank, toe in (("Left", L_HIP, L_KNEE, L_ANK, L_TOE),
                                  ("Right", R_HIP, R_KNEE, R_ANK, R_TOE)):
    up_b, low_b, foot_b = B(side + "UpLeg"), B(side + "Leg"), B(side + "Foot")
    # short qui descend sur le haut de cuisse
    capsule("shortleg", hip, hip + (knee - hip) * 0.42, 0.085, "Shorts", [(up_b, 1)])
    capsule("thigh", hip + (knee - hip) * 0.30, knee, 0.075, "Skin", [(up_b, 1)], taper=0.85)
    sphere("knee", 0.062, knee, "Skin", weights=[(up_b, 0.5), (low_b, 0.5)], seg=16)
    capsule("calf", knee, ank, 0.062, "Socks", [(low_b, 1)], taper=0.8)
    # chaussure : du talon au bout du pied
    heel = ank + Vector((0, 0.03, -0.02))
    shoe_c = (heel + toe) / 2
    shoe_c.z = max(0.05, shoe_c.z * 0.5)
    d = (toe - heel)
    sphere("shoe", 1.0, shoe_c, "Shoes",
           (0.062, d.length / 2 + 0.04, 0.055),
           weights=[(foot_b, 1)])

# ---------------------------------------------------------------- join
for o in bpy.data.objects:
    o.select_set(False)
objs = [o for o, _ in PARTS]
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Groupes de poids AVANT le join (par objet, tous les vertices)
for o, weights in PARTS:
    for bone, w in weights:
        vg = o.vertex_groups.new(name=bone)
        vg.add(range(len(o.data.vertices)), w, "REPLACE")

bpy.ops.object.join()
body = bpy.context.object
body.name = "AvatarBody"
body.data.name = "AvatarBody"

# ---------------------------------------------------------------- shape keys
body.shape_key_add(name="Basis")
me = body.data

def group_index(name):
    vg = body.vertex_groups.get(name)
    return vg.index if vg else -1

# facteur d'inflation par os (corpulence)
INFLATE = {}
for n in ["Hips", "Spine", "Spine1", "Spine2"]:
    INFLATE[group_index(B(n))] = 1.0
for n in ["LeftArm", "RightArm", "LeftForeArm", "RightForeArm",
          "LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg"]:
    INFLATE[group_index(B(n))] = 0.55
for n in ["Neck"]:
    INFLATE[group_index(B(n))] = 0.35
for n in ["Head"]:
    INFLATE[group_index(B(n))] = 0.10

def vertex_factor(v):
    f = 0.0
    for g in v.groups:
        f = max(f, INFLATE.get(g.group, 0.0) * g.weight)
    return f

def add_key(name, fn):
    key = body.shape_key_add(name=name, from_mix=False)
    basis = me.shape_keys.key_blocks["Basis"]
    for i, v in enumerate(me.vertices):
        key.data[i].co = fn(basis.data[i].co.copy(), v)
    return key

AMP = 0.055
add_key("Costaud", lambda co, v: co + v.normal * (AMP * vertex_factor(v)))
add_key("Mince", lambda co, v: co - v.normal * (AMP * 0.32 * vertex_factor(v)))

head_gi = group_index(B("Head"))
def head_weight(v):
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
        lambda co, v: co if head_weight(v) < 0.5 else reshape_head(co, 1.16, 1.04, 0.90, 1.06))
add_key("TeteLongue",
        lambda co, v: co if head_weight(v) < 0.5 else reshape_head(co, 0.90, 0.96, 1.16, 1.10))

# ---------------------------------------------------------------- skin + export
body.parent = ARM
# L'armature Mixamo est à l'échelle 0.01 : on compense pour que le mesh
# garde sa transformation monde identité.
body.matrix_parent_inverse = ARM.matrix_world.inverted()
mod = body.modifiers.new("Armature", "ARMATURE")
mod.object = ARM

bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
ARM.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_morph=True,
    export_skins=True,
    export_apply=False,
    export_yup=True,
)
print("GLB exporte:", OUT_GLB)

# ---------------------------------------------------------------- rendus de contrôle
scene.frame_set(110)

bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
bpy.context.object.data.materials.append(mat("floor", (0.90, 0.92, 0.95, 1), 1.0))
world = bpy.data.worlds.new("w")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.85, 0.88, 0.93, 1)
bg.inputs[1].default_value = 0.6
for loc, e in [((2.6, -2.6, 3.0), 500), ((-2.8, -1.6, 2.0), 180), ((0.4, 3.2, 2.6), 300)]:
    bpy.ops.object.light_add(type="AREA", location=loc)
    L = bpy.context.object
    L.data.energy = e
    L.data.size = 3.5
    L.rotation_euler = (math.radians(52), 0, math.atan2(loc[0], -loc[1]))

bpy.ops.object.camera_add(location=(1.5, -3.0, 1.30))
cam = bpy.context.object
cam.rotation_euler = (math.radians(81), 0, math.radians(26))
cam.data.lens = 55
scene.camera = cam
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 700
scene.render.resolution_y = 900

kb = me.shape_keys.key_blocks

def shot(path, mince=0, costaud=0, carree=0, longue=0):
    kb["Mince"].value = mince
    kb["Costaud"].value = costaud
    kb["TeteCarree"].value = carree
    kb["TeteLongue"].value = longue
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

shot(f"{SCRATCH}/avatar_normal.png")
shot(f"{SCRATCH}/avatar_costaud.png", costaud=1)
shot(f"{SCRATCH}/avatar_mince_tetelongue.png", mince=1, longue=1)
# Gros plan visage
cam.location = (0.45, -1.15, head_c.z + 0.03)
cam.rotation_euler = (math.radians(88), 0, math.radians(21))
shot(f"{SCRATCH}/avatar_face.png")
print("Rendus OK")

# ---------------------------------------------------------------- vérif GLB
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=OUT_GLB)
import mathutils
for o in bpy.data.objects:
    if o.type == "MESH":
        bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
        zs = [v.z for v in bb]
        sk = o.data.shape_keys.key_blocks.keys() if o.data.shape_keys else []
        print(f"VERIF mesh {o.name}: hauteur {max(zs)-min(zs):.2f}, shape keys {sk}")
print(f"VERIF animations: {[a.name for a in bpy.data.actions]}")
