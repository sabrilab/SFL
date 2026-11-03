// Bibliothèque d'animations Mixamo : paquets chargés à la demande (public/assets/anims/*.pak)
// et transposés sur n'importe quel personnage au squelette Mixamo. Reprise de sabrilab/bola-game (src/anim/library.js), elle-même reprise d'Aeriea.
//
// Les clips sont stockés sur le squelette de référence Mixamo (os sans préfixe, hanche au repos = 1).
// Pour un personnage cible, chaque piste de rotation est transposée par deux rotations constantes
// (calculées une fois depuis les poses de repos) : local_cible = M_parent⁻¹ · local_source · M_os,
// avec M = R_source_repos⁻¹ · A · R_cible_repos (A aligne les directions des os : A-pose ↔ T-pose).
import * as THREE from 'three';
import { loadPak } from './pak.js';

export const boneKey = (s) => s.replace(/^mixamorig\d*:?/i, '').replace(/_\d+$/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const BASE = '/jeu/anims/';
const packs = new Map(); // nom → Promise<{ rig, clips: Map, meta }>
let index = null;

async function getIndex() {
  index ??= fetch(BASE + 'index.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return index;
}

// charge un paquet (une seule fois) ; renvoie { rig, clips, meta }
export function loadPack(name) {
  if (!packs.has(name)) {
    packs.set(name, (async () => {
      const [gltf, idx] = await Promise.all([loadPak(`${BASE}${name}.pak`), getIndex()]);
      const root = gltf.scene; root.updateMatrixWorld(true);
      const rig = makeRig(root, false);
      const meta = idx[name] || {};
      const clips = new Map();
      for (const c of gltf.animations) { c.userData = { ...(meta[c.name] || {}), pack: name }; clips.set(c.name, c); }
      return { rig, clips, meta };
    })());
  }
  return packs.get(name);
}

// Squelette d'un personnage : os indexés par nom normalisé, rotations et positions de repos relatives à la racine.
// skinned=true : remet les maillages en pose de liaison avant la mesure.
export function makeRig(root, skinned = true) {
  if (skinned) root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const bones = new Map();
  root.traverse((o) => {
    if (o === root || (skinned && !o.isBone)) return;
    const k = boneKey(o.name); if (!k || bones.has(k)) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s);
    bones.set(k, { obj: o, key: k, wq: q, wp: p });
  });
  const hips = bones.get('hips');
  let ground = Infinity; for (const k of ['leftfoot', 'rightfoot', 'lefttoebase', 'righttoebase']) if (bones.has(k)) ground = Math.min(ground, bones.get(k).wp.y);
  if (!isFinite(ground)) ground = 0;
  // pied au repos : la cheville est au-dessus du sol ; on prend le bas de la boîte quand c'est un vrai modèle
  // (boîte ramenée dans le repère de la racine, comme les os : une racine mise à l'échelle, Muta par exemple, l'enfonçait de 0,9 m dans le sol)
  if (skinned) { const box = new THREE.Box3().setFromObject(root).applyMatrix4(inv); if (isFinite(box.min.y)) ground = Math.min(ground, box.min.y); }
  else ground = 0;
  const hipH = hips ? hips.wp.y - ground : 1;
  const ankleH = bones.has('leftfoot') ? bones.get('leftfoot').wp.y - ground : 0.08 * hipH;
  // repère (relatif à la racine) d'un nœud quelconque, au repos : figé maintenant (par nom, partagé entre instances), car les clips sont transposés
  // plus tard (au premier usage), quand le personnage a bougé dans le monde
  const rel = new Map(); root.traverse((o) => rel.has(o.name) || rel.set(o.name, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
  const relMatrix = (o) => (rel.get(o.name) ?? new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(root.matrixWorld).invert(), o.matrixWorld)).clone();
  return { root, bones, hips, ground, hipH, ankleH, cache: new Map(), relMatrix };
}

// enfant principal de chaque os (pour aligner les directions au repos)
const CHILD = {
  hips: 'spine', spine: 'spine1', spine1: 'spine2', spine2: 'neck', neck: 'head',
  leftshoulder: 'leftarm', leftarm: 'leftforearm', leftforearm: 'lefthand', lefthand: 'lefthandmiddle1',
  rightshoulder: 'rightarm', rightarm: 'rightforearm', rightforearm: 'righthand', righthand: 'righthandmiddle1',
  leftupleg: 'leftleg', leftleg: 'leftfoot', leftfoot: 'lefttoebase', rightupleg: 'rightleg', rightleg: 'rightfoot', rightfoot: 'righttoebase',
};
const ALIGN = new Set(['leftarm', 'rightarm', 'leftforearm', 'rightforearm', 'leftupleg', 'rightupleg', 'leftleg', 'rightleg']);

function boneMaps(src, tgt) {
  const M = new Map(), tmp = new THREE.Quaternion(), A = new THREE.Quaternion();
  for (const [k, t] of tgt.bones) {
    const s = src.bones.get(k); if (!s) continue;
    A.identity();
    const c = CHILD[k];
    if (ALIGN.has(k) && c && src.bones.has(c) && tgt.bones.has(c)) {
      const ds = src.bones.get(c).wp.clone().sub(s.wp).normalize(), dt = tgt.bones.get(c).wp.clone().sub(t.wp).normalize();
      A.setFromUnitVectors(dt, ds);
    }
    // M = R_s⁻¹ · A · R_t
    M.set(k, tmp.copy(s.wq).invert().multiply(A).multiply(t.wq).clone());
  }
  return M;
}

// Transpose un clip de la bibliothèque sur un personnage (rig = makeRig(modèle)). Résultat mis en cache.
export function bindClip(clip, srcRig, rig, opts = {}) {
  const ck = clip.uuid + (opts.rootMotion ? ':rm' : '');
  if (rig.cache.has(ck)) return rig.cache.get(ck);
  rig.maps ??= boneMaps(srcRig, rig);
  const M = rig.maps, tracks = [], q = new THREE.Quaternion(), pre = new THREE.Quaternion();
  for (const tr of clip.tracks) {
    const dot = tr.name.lastIndexOf('.'), node = tr.name.slice(0, dot), prop = tr.name.slice(dot + 1);
    const k = boneKey(node);
    if (prop === 'quaternion') {
      const t = rig.bones.get(k), m = M.get(k); if (!t || !m) continue;
      // parent cible : son M (les hiérarchies Mixamo correspondent os à os) ; à défaut sa rotation de repos
      const pk = t.obj.parent && boneKey(t.obj.parent.name), pm = pk && M.get(pk);
      if (pm) pre.copy(pm).invert();
      else if (t.obj.parent && t.obj.parent !== rig.root) { const s3 = new THREE.Vector3(); rig.relMatrix(t.obj.parent).decompose(s3, pre, new THREE.Vector3()); pre.invert(); }
      else pre.identity();
      const v = tr.values, out = new Float32Array(v.length);
      for (let i = 0; i < v.length; i += 4) {
        q.set(v[i], v[i + 1], v[i + 2], v[i + 3]).premultiply(pre).multiply(m);
        out[i] = q.x; out[i + 1] = q.y; out[i + 2] = q.z; out[i + 3] = q.w;
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${t.obj.name}.quaternion`, tr.times, out));
    } else if (prop === 'position' && k === 'hips' && rig.hips) {
      // position normalisée (hanche au repos = 1) → repère du parent des hanches
      const hp = rig.hips.obj.parent;
      const pinv = hp && hp !== rig.root ? rig.relMatrix(hp).invert() : new THREE.Matrix4();
      const v = tr.values, out = new Float32Array(v.length), p = new THREE.Vector3();
      const x0 = rig.hips.wp.x, z0 = rig.hips.wp.z;
      for (let i = 0; i < v.length; i += 3) {
        p.set(x0 + v[i] * rig.hipH, rig.ground + v[i + 1] * rig.hipH, z0 + v[i + 2] * rig.hipH).applyMatrix4(pinv);
        out[i] = p.x; out[i + 1] = p.y; out[i + 2] = p.z;
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${rig.hips.obj.name}.position`, tr.times, out));
    }
  }
  const c = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  c.userData = { ...clip.userData };
  // root motion : courbe du déplacement horizontal (mètres pour ce personnage), échantillonnable par le contrôleur
  const rt = clip.tracks.find((x) => x.name === 'Root.position');
  if (rt) c.userData.root = { times: rt.times, values: rt.values.map((x) => x * rig.hipH), scale: rig.hipH };
  rig.cache.set(ck, c);
  return c;
}

// déplacement root motion (x, z) à l'instant t d'un clip transposé
export function rootAt(clip, t, out = new THREE.Vector2()) {
  const r = clip.userData.root; if (!r) return out.set(0, 0);
  const T = r.times, V = r.values, n = T.length;
  if (t <= T[0]) return out.set(V[0], V[2]);
  if (t >= T[n - 1]) return out.set(V[(n - 1) * 3], V[(n - 1) * 3 + 2]);
  let i = 1; while (T[i] < t) i++;
  const a = (t - T[i - 1]) / (T[i] - T[i - 1]);
  return out.set(V[(i - 1) * 3] + (V[i * 3] - V[(i - 1) * 3]) * a, V[(i - 1) * 3 + 2] + (V[i * 3 + 2] - V[(i - 1) * 3 + 2]) * a);
}

// charge les clips demandés d'un paquet, transposés sur le personnage
export async function clipsFor(rig, pack, opts) {
  const p = await loadPack(pack), out = {};
  for (const [name, c] of p.clips) out[name] = bindClip(c, p.rig, rig, opts);
  return out;
}
