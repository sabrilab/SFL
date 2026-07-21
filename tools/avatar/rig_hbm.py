#!/usr/bin/env python3
"""Avatar HBM v2 : corps athlétique + morphs + cheveux/sourcils/pupilles.

Pipeline :
 1. corps réaliste HBM (+ yeux, matériau séparé) ;
 2. squelette/animation Mixamo, transformation objet neutralisée ;
 3. binding A-pose -> conversion T-pose (2 passes) ;
 4. carrure athlétique (épaules larges, taille fine) ;
 5. cheveux x3 / sourcils / pupilles générés depuis le scalp ;
 6. shape keys Mince/Costaud/TeteCarree/TeteLongue (corps + accessoires tête) ;
 7. re-binding final + lissage des poids (épaules/trapèzes) ;
 8. export GLB.
"""
import bpy
import bmesh
import math
import os
from mathutils import Quaternion, Matrix, Vector

SCRATCH = "/tmp/claude-0/-home-user-SFL/f3643510-aa7d-5bd3-93fe-68890f1ebf77/scratchpad"
BLEND = f"{SCRATCH}/human-base-meshes-bundle-v1.4.1/human_base_meshes_bundle.blend"
FBX = f"{SCRATCH}/neutral_idle.fbx"
OUT = f"{SCRATCH}/avatar-hbm-rigged.glb"

KEEP = [
    "GEO-body_male_realistic",
    "GEO-body_male_realistic.eye.L",
    "GEO-body_male_realistic.eye.R",
]

def clamp01(t):
    return max(0.0, min(1.0, t))

def ramp(t):
    t = clamp01(t)
    return t * t * (3 - 2 * t)

def make_mat(name, rgba):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = rgba
    return m

# ------------------------------------------------------------------ 1. corps
bpy.ops.wm.open_mainfile(filepath=BLEND)
for obj in list(bpy.data.objects):
    if obj.name not in KEEP:
        bpy.data.objects.remove(obj, do_unlink=True)

body = bpy.data.objects["GEO-body_male_realistic"]
for obj in bpy.data.objects:
    obj.hide_set(False)
    obj.hide_viewport = False
    obj.hide_select = False
    for mod in list(obj.modifiers):
        obj.modifiers.remove(mod)

# matériaux : peau (recolorée par le viewer) et yeux (blanc cassé).
# Le corps HBM n'a aucun matériau : sans slot explicite, le join ferait
# hériter toutes ses faces du matériau des yeux.
skin_mat = make_mat("Skin", (0.79, 0.53, 0.31, 1.0))
body.data.materials.clear()
body.data.materials.append(skin_mat)
eyes_mat = make_mat("Eyes", (0.93, 0.92, 0.90, 1.0))
for name in KEEP[1:]:
    eye = bpy.data.objects[name]
    eye.data.materials.clear()
    eye.data.materials.append(eyes_mat)

n_body_verts = len(body.data.vertices)
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = "Body"
# indices des vertex d'yeux (appondus au corps par le join)
eye_idx = list(range(n_body_verts, len(body.data.vertices)))
if body.data.shape_keys:
    bpy.ops.object.shape_key_remove(all=True)

def world_zs(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    zs = [p.z for p in pts]
    return min(zs), max(zs)

zmin, zmax = world_zs(body)
body_h = zmax - zmin
print(f"Body height: {body_h:.3f}m")

# -------------------------------------------------------------- 2. squelette
bpy.ops.import_scene.fbx(filepath=FBX)
armature = None
for obj in list(bpy.data.objects):
    if obj.type == 'ARMATURE':
        armature = obj
    elif obj.type == 'MESH' and obj.name != "Body":
        bpy.data.objects.remove(obj, do_unlink=True)
print(f"Armature: {len(armature.data.bones)} bones")

arm_scale = armature.scale[0]
bpy.ops.object.select_all(action='DESELECT')
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for action in bpy.data.actions:
    for fc in list(action.fcurves):
        if not fc.data_path.endswith('.location'):
            continue
        if "mixamorig:Hips" in fc.data_path:
            # le root garde sa translation (balancement de l'idle), à l'échelle
            if abs(arm_scale - 1.0) > 1e-6:
                for kp in fc.keyframe_points:
                    kp.co.y *= arm_scale
                    kp.handle_left.y *= arm_scale
                    kp.handle_right.y *= arm_scale
        else:
            # les autres os n'ont pas besoin de translation animée (squelette
            # rigide) et ces clés figées écraseraient le repositionnement
            # des os des épaules
            action.fcurves.remove(fc)
print(f"Armature transform applied (scale {arm_scale})")

bone_zs = []
for b in armature.data.bones:
    bone_zs.append((armature.matrix_world @ b.head_local).z)
    bone_zs.append((armature.matrix_world @ b.tail_local).z)
az_min, az_max = min(bone_zs), max(bone_zs)
arm_h = az_max - az_min

# --------------------------------------------------- 3. alignement du corps
scale = arm_h / body_h
body.scale = (scale, scale, scale)
bpy.context.view_layer.update()

def world_bbox(obj):
    pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))

(bx0, bx1), (by0, by1), (bz0, bz1) = world_bbox(body)
body.location.x += -(bx0 + bx1) / 2
body.location.y += -(by0 + by1) / 2
body.location.z += az_min - bz0
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# NB : on ne déplace PAS les os (toute édition du squelette, même une
# translation pure, désynchronise les rotations baked de l'animation
# Mixamo). Les épaules sont corrigées par sculpture du mesh, calée sur la
# ligne des deltoïdes.
delt_top = max(v.co.z for v in body.data.vertices if 0.13 < abs(v.co.x) < 0.30)
print(f"deltoid top={delt_top:.3f}")

# Angle réel de l'A-pose mesuré sur le mesh : direction moyenne des vertex
# de bras/main par rapport au pivot de l'épaule (os mixamorig:LeftArm).
shoulder_bone = armature.data.bones["mixamorig:LeftArm"]
sj = armature.matrix_world @ shoulder_bone.head_local
sj_x, sj_z = sj.x, sj.z
arm_pts = []
for v in body.data.vertices:
    co = v.co
    if co.x > sj_x + 0.04 and co.z < sj_z:
        d = math.hypot(co.x - sj_x, co.z - sj_z)
        if 0.35 < d < 0.80:
            arm_pts.append((co.x, co.z))
ax = sum(p[0] for p in arm_pts) / len(arm_pts)
az = sum(p[1] for p in arm_pts) / len(arm_pts)
ARM_DROP = math.atan2(sj_z - az, ax - sj_x)
print(f"shoulder joint: x={sj_x:.3f} z={sj_z:.3f} | A-pose angle: {math.degrees(ARM_DROP):.1f}deg ({len(arm_pts)} pts)")

def rotate_bone_world(pb, axis, angle):
    M = pb.matrix.copy()
    head = M.to_translation()
    R = (Matrix.Translation(head)
         @ Quaternion(axis, angle).to_matrix().to_4x4()
         @ Matrix.Translation(-head))
    pb.matrix = R @ M

def set_arm_pose(angle):
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')
    for name, sign in (("mixamorig:LeftArm", 1), ("mixamorig:RightArm", -1)):
        rotate_bone_world(armature.pose.bones[name], (0, 1, 0), sign * angle)
        bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')

def clear_pose():
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.transforms_clear()
    bpy.ops.object.mode_set(mode='OBJECT')

saved_action = armature.animation_data.action if armature.animation_data else None
if armature.animation_data:
    armature.animation_data.action = None

def pin_eyes_to_head():
    """Les sphères d'yeux (géométrie fermée) reçoivent des poids parasites
    du binding automatique : on les rattache rigidement à la tête."""
    for g in body.vertex_groups:
        g.remove(eye_idx)
    hg = body.vertex_groups.get("mixamorig:Head")
    if hg is None:
        hg = body.vertex_groups.new(name="mixamorig:Head")
    hg.add(eye_idx, 1.0, 'REPLACE')

clear_pose()
set_arm_pose(ARM_DROP)
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
pin_eyes_to_head()

clear_pose()
set_arm_pose(-ARM_DROP)
bpy.context.view_layer.objects.active = body
for mod in list(body.modifiers):
    if mod.type == 'ARMATURE':
        bpy.ops.object.modifier_apply(modifier=mod.name)
body.parent = None
for vg in list(body.vertex_groups):
    body.vertex_groups.remove(vg)
clear_pose()
print("A->T conversion done")

# ------------------------------------------------------- 5. repères du mesh
verts = body.data.vertices
z_top = max(v.co.z for v in verts)
neck_z = z_top - 0.32

eye_cos = [verts[i].co.copy() for i in eye_idx]
eye_cz = sum(c.z for c in eye_cos) / len(eye_cos)
eye_front_y = min(c.y for c in eye_cos)
eL = [c for c in eye_cos if c.x > 0]
eR = [c for c in eye_cos if c.x < 0]
eye_L = (sum(c.x for c in eL) / len(eL), sum(c.z for c in eL) / len(eL))
eye_R = (sum(c.x for c in eR) / len(eR), sum(c.z for c in eR) / len(eR))

head_cos = [v.co for v in verts if v.co.z > z_top - 0.30]
head_y_c = sum(c.y for c in head_cos) / len(head_cos)

torso_cos = [v.co for v in verts if v.co.z < neck_z and abs(v.co.x) < 0.30]
y_c = sum(c.y for c in torso_cos) / len(torso_cos)

# axe des bras du mesh converti en T (pour les morphs de corpulence)
arm_cos = [v.co for v in verts if abs(v.co.x) > 0.5]
arm_z = sum(c.z for c in arm_cos) / len(arm_cos)
# ligne des deltoïdes recalculée sur le mesh en T
delt_top = max(v.co.z for v in verts if 0.13 < abs(v.co.x) < 0.30)

print(f"landmarks: z_top={z_top:.2f} eye_z={eye_cz:.2f} arm_z={arm_z:.2f} delt_top={delt_top:.2f}")

# --------------------------------------------------- 6. carrure athlétique
# Épaules/deltoïdes élargis et rehaussés (carrure en V, trapèzes plus
# horizontaux), taille resserrée — calé sur la ligne des deltoïdes du mesh.
sh_c = delt_top - 0.06                        # centre bande épaules
sh_lo, sh_hi = sh_c - 0.10, sh_c + 0.09
wa_lo, wa_hi = z_top - 1.02, z_top - 0.72     # bande taille
for v in verts:
    co = v.co
    if abs(co.x) < 0.45:
        if sh_lo < co.z < sh_hi:
            b = ramp(1 - abs(co.z - sh_c) / (sh_hi - sh_c))
            co.x *= 1 + 0.05 * b
        # rehausse trapèzes/deltoïdes : la pente épaule-cou devient
        # plus horizontale, carrure moins tombante
        if co.z > delt_top - 0.14 and abs(co.x) > 0.09:
            lift = ramp((abs(co.x) - 0.09) / 0.12) * ramp((co.z - (delt_top - 0.14)) / 0.10)
            co.z += 0.014 * lift
        if wa_lo < co.z < wa_hi:
            b = ramp(1 - abs(co.z - (wa_lo + wa_hi) / 2) / ((wa_hi - wa_lo) / 2))
            co.x *= 1 - 0.06 * b
            co.y = y_c + (co.y - y_c) * (1 - 0.05 * b)
# pieds : le corps HBM agrandi à l'échelle du squelette (x1,15) donne des
# pieds trop longs/larges — on les réduit autour de chaque cheville
for sign in (1, -1):
    foot = [v for v in verts if v.co.z < 0.13 and sign * v.co.x > 0]
    if not foot:
        continue
    cx = sum(v.co.x for v in foot) / len(foot)
    ankle_y = sum(v.co.y for v in foot) / len(foot)
    for v in foot:
        f = ramp((0.13 - v.co.z) / 0.08)  # plein effet au sol, fondu à la cheville
        v.co.x = cx + (v.co.x - cx) * (1 - 0.08 * f)
        v.co.y = ankle_y + (v.co.y - ankle_y) * (1 - 0.12 * f)

body.data.update()
print("athletic build applied")

# ------------------------------------- 7. cheveux / sourcils / pupilles
hair_mat = make_mat("Hair", (0.055, 0.032, 0.018, 1.0))

def is_scalp(co):
    if co.z < z_top - 0.35:
        return False
    if co.z > eye_cz + 0.07:
        return True
    if co.z > eye_cz - 0.01 and co.y > head_y_c + 0.015:
        return True
    return False

def build_hair(name, disp_fn):
    dup = body.copy()
    dup.data = body.data.copy()
    bpy.context.collection.objects.link(dup)
    dup.vertex_groups.clear()
    bm = bmesh.new()
    bm.from_mesh(dup.data)
    dead = [v for v in bm.verts if not is_scalp(v.co)]
    bmesh.ops.delete(bm, geom=dead, context='VERTS')
    bm.to_mesh(dup.data)
    bm.free()
    dup.data.update()
    for v in dup.data.vertices:
        v.co = disp_fn(v.co.copy(), v.normal.copy())
    dup.data.update()
    dup.name = name
    dup.data.materials.clear()
    dup.data.materials.append(hair_mat)
    return dup

def d_ras(co, n):
    return co + n * 0.004

def d_court(co, n):
    top = ramp((co.z - (z_top - 0.10)) / 0.10)
    return co + n * (0.006 + 0.020 * top)

def d_crete(co, n):
    out = co + n * 0.004
    strip = ramp(1 - abs(co.x) / 0.03)
    top = ramp((co.z - (z_top - 0.14)) / 0.14)
    out.z += 0.045 * strip * top
    return out

hair_objs = [
    build_hair("CheveuxRas", d_ras),
    build_hair("CheveuxCourt", d_court),
    build_hair("CheveuxCrete", d_crete),
]
print("hair built:", [f"{h.name}({len(h.data.vertices)}v)" for h in hair_objs])

# sourcils + pupilles : petites boîtes sombres devant le visage
def add_box(name, loc, scale, rot_y=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    o.rotation_euler = (0, rot_y, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.name = name
    o.data.materials.append(hair_mat)
    return o

brow_z = eye_cz + 0.035
boxes = [
    add_box("SourcilL", (eye_L[0] * 1.02, eye_front_y + 0.002, brow_z), (0.026, 0.007, 0.007), math.radians(6)),
    add_box("SourcilR", (eye_R[0] * 1.02, eye_front_y + 0.002, brow_z), (0.026, 0.007, 0.007), math.radians(-6)),
    add_box("PupilleL", (eye_L[0], eye_front_y - 0.003, eye_L[1]), (0.009, 0.005, 0.009)),
    add_box("PupilleR", (eye_R[0], eye_front_y - 0.003, eye_R[1]), (0.009, 0.005, 0.009)),
]
bpy.ops.object.select_all(action='DESELECT')
for b in boxes:
    b.select_set(True)
bpy.context.view_layer.objects.active = boxes[0]
bpy.ops.object.join()
traits = bpy.context.view_layer.objects.active
traits.name = "Traits"
print("traits built")

# ---------------------------------------------------------- 8. shape keys
def sk_corpulence(co, amp_torse, amp_bras):
    """Mélange continu torse (échelle radiale autour de la colonne) /
    bras (section autour de l'axe du bras) — la frontière nette créait
    une déchirure visible au coude."""
    if co.z >= neck_z + 0.05:
        return co
    b = ramp((neck_z + 0.05 - co.z) / 0.12)
    t = ramp((abs(co.x) - 0.22) / 0.18)  # 0 = torse, 1 = bras
    ft = 1 + amp_torse * b
    fb = 1 + amp_bras * b
    # déplacement torse
    x1 = co.x * ft
    y1 = y_c + (co.y - y_c) * ft
    z1 = co.z
    # déplacement bras
    x2 = co.x
    y2 = y_c + (co.y - y_c) * fb
    z2 = arm_z + (co.z - arm_z) * fb
    out = co.copy()
    out.x = x1 + (x2 - x1) * t
    out.y = y1 + (y2 - y1) * t
    out.z = z1 + (z2 - z1) * t
    return out

def sk_mince(co):
    return sk_corpulence(co, -0.09, -0.10)

def sk_costaud(co):
    return sk_corpulence(co, 0.13, 0.08)

def sk_tete_carree(co):
    if co.z <= neck_z:
        return co
    b = ramp((co.z - neck_z) / 0.06)
    out = co.copy()
    jaw = ramp((eye_cz + 0.02 - co.z) / 0.14)
    out.x *= 1 + (0.09 + 0.07 * jaw) * b
    out.y = head_y_c + (co.y - head_y_c) * (1 + 0.03 * b)
    squash = ramp((co.z - (z_top - 0.12)) / 0.12)
    out.z = co.z - (co.z - (z_top - 0.30)) * 0.05 * squash * b
    return out

def sk_tete_longue(co):
    if co.z <= neck_z:
        return co
    b = ramp((co.z - neck_z) / 0.06)
    out = co.copy()
    out.z = neck_z + (co.z - neck_z) * (1 + 0.11 * b)
    out.x *= 1 - 0.06 * b
    out.y = head_y_c + (co.y - head_y_c) * (1 - 0.03 * b)
    return out

def add_keys(obj, keys):
    obj.shape_key_add(name="Basis", from_mix=False)
    for name, fn in keys:
        sk = obj.shape_key_add(name=name, from_mix=False)
        for i, v in enumerate(obj.data.vertices):
            sk.data[i].co = fn(v.co)

add_keys(body, [
    ("Mince", sk_mince),
    ("Costaud", sk_costaud),
    ("TeteCarree", sk_tete_carree),
    ("TeteLongue", sk_tete_longue),
])
for h in hair_objs:
    add_keys(h, [("TeteCarree", sk_tete_carree), ("TeteLongue", sk_tete_longue)])
add_keys(traits, [("TeteCarree", sk_tete_carree), ("TeteLongue", sk_tete_longue)])
print("shape keys added")

# ------------------------------------------------------ 9. binding final
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# Correction deltoïde/trapèze (bind T-pose, l'idle baisse les bras ~59°).
# Le pivot de l'os du bras Mixamo est ~22 cm sous la ligne des deltoïdes ;
# le sommet de l'épaule, s'il suit 100% le bras, bombe (boule), s'il suit
# 100% la clavicule, il fait étagère (spike). Compromis : transfert PARTIEL
# vers la clavicule (le cap suit le bras à moitié) + fort lissage pour
# fondre la frontière. Limité au deltoïde (fondu latéral) pour ne pas
# gonfler le tube du bras.
def vgw(vg, vi):
    try:
        return vg.weight(vi)
    except RuntimeError:
        return 0.0

CAP_H = 0.13
CAP_MAX = 0.50        # transfert partiel : le cap suit le bras à moitié
CAP_X = 0.09
for side, sign in (("Left", 1), ("Right", -1)):
    vg_arm = body.vertex_groups.get(f"mixamorig:{side}Arm")
    vg_sh = body.vertex_groups.get(f"mixamorig:{side}Shoulder")
    if vg_arm is None:
        continue
    if vg_sh is None:
        vg_sh = body.vertex_groups.new(name=f"mixamorig:{side}Shoulder")
    for v in body.data.vertices:
        if sign * v.co.x <= 0.02:
            continue
        w_arm = vgw(vg_arm, v.index)
        if w_arm <= 0.0:
            continue
        t = clamp01((v.co.z - sj_z) / CAP_H)
        if t <= 0.0:
            continue
        lat = 1.0 - ramp((abs(v.co.x) - (sj_x + CAP_X)) / 0.06)
        if lat <= 0.0:
            continue
        move = w_arm * CAP_MAX * ramp(t) * lat
        vg_arm.add([v.index], w_arm - move, 'REPLACE')
        vg_sh.add([v.index], move, 'ADD')
print("shoulder cap partially reweighted")

# fort lissage APRÈS le transfert : fond la frontière bras/clavicule
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active = body
try:
    bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
    bpy.ops.object.vertex_group_smooth(group_select_mode='BONE_DEFORM', factor=0.6, repeat=9, expand=0.0)
    bpy.ops.object.mode_set(mode='OBJECT')
    print("weights smoothed")
except Exception as e:
    bpy.ops.object.mode_set(mode='OBJECT')
    print("weight smooth skipped:", e)

# yeux rigides sur la tête + vertex orphelins -> tête
pin_eyes_to_head()
head_group = body.vertex_groups.get("mixamorig:Head")
orphans = [v.index for v in body.data.vertices if sum(g.weight for g in v.groups) < 1e-6]
if orphans:
    head_group.add(orphans, 1.0, 'REPLACE')
print(f"orphans fixed: {len(orphans)}")

# accessoires : 100% sur l'os de la tête
for obj in hair_objs + [traits]:
    obj.parent = armature
    mod = obj.modifiers.new("Armature", 'ARMATURE')
    mod.object = armature
    vg = obj.vertex_groups.new(name="mixamorig:Head")
    vg.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')

if saved_action is not None:
    if not armature.animation_data:
        armature.animation_data_create()
    armature.animation_data.action = saved_action

# ------------------------------------------------------------- 10. export
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    export_animations=True,
    export_skins=True,
    export_morph=True,
    export_yup=True,
)
print(f"Exported: {OUT} ({os.path.getsize(OUT)/1e6:.2f}MB)")
