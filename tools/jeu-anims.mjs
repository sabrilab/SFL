// Les clips Mixamo du jeu /jouer, des FBX de la bibliothèque de Sabri aux paquets brouillés (bola-app#26, lot 1).
//
// Adapté de sabrilab/bola-game (tools/anims/convert.mjs, lui-même repris d'Aeriea), sans aucune dépendance nouvelle :
//   · les FBX sont lus en place, dans le clone local de la bibliothèque Mixamo (dossier « Mixamo Animations », donné par
//     la variable JEU_MIXAMO, obligatoire), par le FBXLoader de three déjà installé ; rien n'est copié ;
//   · même cuisson que bola-game : squelette canonique sans préfixe « mixamorig », position des hanches normalisée
//     (1 = hanche au repos), déplacement horizontal (root motion) sorti sur un nœud « Root » (sauf root: 'keep'), miroir gauche / droite,
//     lacet retiré (unturn), rognage (from, to), impact par vitesse maximale d'un os, plus yaw et hitAt (manifeste) ;
//   · le GLB est écrit par un écrivain minimal (ci-dessous) au lieu de @gltf-transform et gltfpack (absents de SFL) :
//     un buffer, des échantillonneurs linéaires à 30 images/s (15 pour les clips lents : fps du manifeste ; une
//     réduction des images clés essayée ne gagnait rien, les pistes Mixamo bougent à chaque image) ; les rotations en entiers 16 bits normalisés (glTF
//     2.0 l'autorise pour les rotations ; GLTFLoader les relit), les translations en flottants ;
//   · puis brouillé par pak() (pakcodec.js) : seul le .pak est écrit dans public/jeu/anims, jamais le GLB en clair.
// index.json reçoit les métadonnées de chaque clip (loop, dur, move, plant, hit, turn), comme pour les paquets de
// bola-game. Ensuite : node tools/jeu-clips.mjs (les mesures de la simulation, mesures.pak).
//
//   node tools/jeu-anims.mjs            tous les paquets du manifeste (tools/jeu-anims-manifest.mjs)
//   node tools/jeu-anims.mjs player2    un seul paquet
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.self ??= globalThis;
const avert = console.warn;
console.warn = (...a) => { if (!String(a[0]).startsWith('THREE.')) avert(...a); };
const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '..');
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { pak } = await import(path.join(racine, 'src/lib/jeu/pakcodec.js'));
const { PACKS } = await import(path.join(ici, 'jeu-anims-manifest.mjs'));

const SRC = process.env.JEU_MIXAMO;
if (!SRC) { console.error('JEU_MIXAMO : le dossier « Mixamo Animations » de la bibliothèque (clone local)'); process.exit(1); }
const OUT = path.join(racine, 'public/jeu/anims');
const ONLY = process.argv[2];
const FPS = 30;
const canon = (n) => n.replace(/^mixamorig\d*:?/, '');

function loadFBX(file) {
  const b = fs.readFileSync(file);
  return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
}

/** La cuisson d'un clip (repris de bola-game, plus yaw, hitAt, noRoot). */
function bake(file, opt) {
  const obj = loadFBX(file);
  const clip = obj.animations[0];
  const hips = obj.getObjectByName('mixamorigHips') || obj.getObjectByName('mixamorig:Hips');
  const hipH = hips.position.y;
  const fps = opt.fps ?? FPS;
  const n = Math.max(2, Math.round(clip.duration * fps) + 1), times = new Float32Array(n).map((_, i) => Math.min(clip.duration, i / fps));
  const tracks = [];
  for (const t of clip.tracks) {
    const [node, prop] = t.name.split('.');
    if (prop === 'scale' || (prop === 'position' && node !== hips.name)) continue;
    if (/(Toe_End|HeadTop_End|4)$/.test(node) && prop === 'quaternion') continue;
    if (/Hand(Thumb|Index|Middle|Ring|Pinky)/.test(node)) continue; // doigts : pose fixe, comme les autres paquets
    const interp = t.createInterpolant(), size = t.getValueSize(), out = new Float32Array(n * size);
    for (let i = 0; i < n; i++) out.set(interp.evaluate(times[i]), i * size);
    tracks.push({ node: canon(node), prop, size, out });
  }
  const hp = tracks.find((t) => t.node === 'Hips' && t.prop === 'position');
  let root = null;
  if (hp) {
    for (let i = 0; i < hp.out.length; i++) hp.out[i] /= hipH;
    const x0 = hp.out[0], z0 = hp.out[2];
    if (opt.root !== 'keep') {
      root = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { root[i * 3] = hp.out[i * 3] - x0; root[i * 3 + 2] = hp.out[i * 3 + 2] - z0; hp.out[i * 3] = x0; hp.out[i * 3 + 2] = z0; }
    }
  }
  const sauver = () => { const r = []; obj.traverse((o) => { if (o.isBone) r.push([o, o.quaternion.clone(), o.position.clone()]); }); return r; };
  const rendre = (r, mx) => { mx.stopAllAction(); mx.uncacheRoot(obj); for (const [o, q, p] of r) { o.quaternion.copy(q); o.position.copy(p); } obj.updateMatrixWorld(true); };
  let plant = 0;
  if (opt.loop) {
    const r = sauver(), mx = new THREE.AnimationMixer(obj); mx.clipAction(clip).play();
    const lf = obj.getObjectByName('mixamorigLeftFoot'), v = new THREE.Vector3(); let lo = Infinity;
    for (let i = 0; i < n; i++) { mx.setTime(times[i]); obj.updateMatrixWorld(true); lf.getWorldPosition(v); if (v.y < lo) { lo = v.y; plant = times[i] / clip.duration; } }
    rendre(r, mx);
  }
  let hitT = opt.hitAt ?? null;
  if (opt.hit && hitT == null) {
    const r = sauver(), mx = new THREE.AnimationMixer(obj); mx.clipAction(clip).play();
    const os = obj.getObjectByName('mixamorig' + (opt.hitBone || 'RightHand')), hv = new THREE.Vector3(), v = new THREE.Vector3(), prev = new THREE.Vector3(); let best = -1;
    for (let i = 0; i < n; i++) {
      mx.setTime(times[i]); obj.updateMatrixWorld(true); hips.getWorldPosition(hv); os.getWorldPosition(v).sub(hv);
      if (i > 0) { const sp = v.distanceTo(prev); if (sp > best && times[i] >= (opt.hitAfter ?? 0) && times[i] <= (opt.hitBefore ?? Infinity)) { best = sp; hitT = times[i]; } }
      prev.copy(v);
    }
    rendre(r, mx);
  }
  if (opt.mirror) {
    const swap = (nm) => nm.replace(/Left|Right/, (m) => (m === 'Left' ? 'Right' : 'Left'));
    const bones = []; obj.traverse((o) => { if (o.isBone) bones.push(o); });
    const byName = new Map(bones.map((o) => [canon(o.name), o]));
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert(), m4 = new THREE.Matrix4();
    const wq = (o, out) => { m4.multiplyMatrices(inv, o.matrixWorld); return out.setFromRotationMatrix(m4.extractRotation(m4)); };
    const rest = new Map(); obj.updateMatrixWorld(true); for (const o of bones) rest.set(o, wq(o, new THREE.Quaternion()));
    const r = sauver(), mx = new THREE.AnimationMixer(obj); mx.clipAction(clip).play();
    const W = [], d = new THREE.Quaternion(), q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      mx.setTime(times[i]); obj.updateMatrixWorld(true);
      const w = new Map();
      for (const o of bones) {
        const tgt = byName.get(swap(canon(o.name))) || o;
        d.copy(wq(o, q)).multiply(rest.get(o).clone().invert()); d.y = -d.y; d.z = -d.z;
        w.set(tgt, d.clone().multiply(rest.get(tgt)));
      }
      W.push(w);
    }
    rendre(r, mx);
    for (const t of tracks) {
      if (t.prop === 'quaternion') {
        const o = byName.get(t.node); if (!o) continue;
        for (let i = 0; i < n; i++) {
          const pw = o.parent && o.parent.isBone ? W[i].get(o.parent).clone().invert() : new THREE.Quaternion();
          q.copy(pw).multiply(W[i].get(o)); q.toArray(t.out, i * 4);
        }
      } else for (let i = 0; i < t.out.length; i += 3) t.out[i] = -t.out[i];
    }
    if (root) for (let i = 0; i < root.length; i += 3) root[i] = -root[i];
  }
  // yaw : tout le corps tourné autour de la verticale (rotation et décalage des hanches) ; le root motion ne tourne
  // pas : il garde sa direction (la glissade sur le dos, tête devant, devient une glissade pieds devant)
  if (opt.yaw) {
    const ry = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), opt.yaw), q = new THREE.Quaternion();
    const hq = tracks.find((t) => t.node === 'Hips' && t.prop === 'quaternion');
    // (le parent des hanches, au repos, est sans rotation dans les FBX Mixamo de la bibliothèque)
    for (let i = 0; i < hq.out.length; i += 4) { q.fromArray(hq.out, i).premultiply(ry); q.toArray(hq.out, i); }
    const c = Math.cos(opt.yaw), s = Math.sin(opt.yaw);
    for (let i = 0; i < hp.out.length; i += 3) { const x = hp.out[i], z = hp.out[i + 2]; hp.out[i] = x * c + z * s; hp.out[i + 2] = -x * s + z * c; }
  }
  let a = 0, b = n - 1;
  const t0 = opt.from ?? 0, t1 = opt.to ?? clip.duration;
  while (a < n - 1 && times[a] < t0 - 1e-4) a++;
  while (b > a + 1 && times[b] > t1 + 1e-4) b--;
  let outTimes = times, duration = clip.duration;
  if (a > 0 || b < n - 1) {
    for (const t of tracks) t.out = t.out.slice(a * t.size, (b + 1) * t.size);
    if (root) { const rx = root[a * 3], rz = root[a * 3 + 2]; root = root.slice(a * 3, (b + 1) * 3); for (let i = 0; i < root.length; i += 3) { root[i] -= rx; root[i + 2] -= rz; } }
    outTimes = times.slice(a, b + 1).map((t) => t - times[a]); duration = outTimes[outTimes.length - 1];
  }
  let turn = null;
  const hqT = opt.unturn && tracks.find((t) => t.node === 'Hips' && t.prop === 'quaternion');
  if (hqT) {
    const m = hqT.out.length / 4, q = new THREE.Quaternion(), f = new THREE.Vector3(), ry = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), yaw = new Float32Array(m);
    for (let i = 0; i < m; i++) { q.fromArray(hqT.out, i * 4); f.set(0, 0, 1).applyQuaternion(q); yaw[i] = Math.atan2(f.x, f.z); if (i) { let d = yaw[i] - yaw[i - 1]; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; yaw[i] = yaw[i - 1] + d; } }
    for (let i = 0; i < m; i++) { const dy = yaw[i] - yaw[0]; ry.setFromAxisAngle(up, -dy); q.fromArray(hqT.out, i * 4).premultiply(ry); q.toArray(hqT.out, i * 4); }
    turn = Array.from({ length: 17 }, (_, k) => { const x = k / 16 * (m - 1), i = Math.min(m - 2, Math.floor(x)), u = x - i; return +((yaw[i] + (yaw[i + 1] - yaw[i]) * u - yaw[0]).toFixed(3)); });
  }
  if (opt.noRoot) root = null;
  const hit = hitT != null ? Math.max(0, Math.min(1, (hitT - times[a]) / duration)) : null;
  return { obj, times: outTimes, tracks, root, duration, plant, hit, turn };
}

/** Le squelette canonique (Root → Hips → …), normalisé : hanche au repos = 1. */
function squelette(obj) {
  const hips = obj.getObjectByName('mixamorigHips') || obj.getObjectByName('mixamorig:Hips');
  const hipH = hips.position.y;
  const nodes = [{ name: 'Root', children: [] }], index = new Map([['Root', 0]]);
  const walk = (b, parent) => {
    if (!b.isBone) return;
    const i = nodes.length, name = canon(b.name);
    nodes.push({ name, rotation: b.quaternion.toArray(), translation: b.position.toArray().map((v) => v / hipH), children: [] });
    index.set(name, i);
    nodes[parent].children.push(i);
    for (const c of b.children) walk(c, i);
  };
  walk(hips, 0);
  for (const nd of nodes) if (!nd.children.length) delete nd.children;
  return { nodes, index };
}

/** L'écrivain GLB minimal : nœuds, animations, un buffer. */
function ecrireGLB(nomScene, sq, clips) {
  const morceaux = [];
  let taille = 0;
  const vues = [], accesseurs = [];
  const ajouter = (octets) => {
    const pad = (4 - (taille % 4)) % 4;
    if (pad) { morceaux.push(new Uint8Array(pad)); taille += pad; }
    const v = { buffer: 0, byteOffset: taille, byteLength: octets.byteLength };
    morceaux.push(new Uint8Array(octets.buffer, octets.byteOffset, octets.byteLength)); taille += octets.byteLength;
    vues.push(v);
    return vues.length - 1;
  };
  const accesseur = (arr, type, { normalise = false, minmax = false } = {}) => {
    const comp = arr instanceof Int16Array ? 5122 : 5126;
    const k = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
    const a = { bufferView: ajouter(arr), componentType: comp, count: arr.length / k, type };
    if (normalise) a.normalized = true;
    if (minmax) { let lo = Infinity, hi = -Infinity; for (const x of arr) { lo = Math.min(lo, x); hi = Math.max(hi, x); } a.min = [lo]; a.max = [hi]; }
    accesseurs.push(a);
    return accesseurs.length - 1;
  };
  const animations = [];
  for (const { nom, b } of clips) {
    const samplers = [], channels = [];
    const input = accesseur(b.times, 'SCALAR', { minmax: true });
    const canal = (node, prop, size, arr) => {
      const n = sq.index.get(node); if (n == null) return;
      let out;
      if (size === 4) {
        const q = new Int16Array(arr.length);
        for (let i = 0; i < arr.length; i += 4) {
          // (même hémisphère d'une image à l'autre : l'interpolation ne prend jamais le grand chemin)
          if (i >= 4 && arr[i] * arr[i - 4] + arr[i + 1] * arr[i - 3] + arr[i + 2] * arr[i - 2] + arr[i + 3] * arr[i - 1] < 0) for (let k = 0; k < 4; k++) arr[i + k] = -arr[i + k];
          for (let k = 0; k < 4; k++) q[i + k] = Math.round(Math.max(-1, Math.min(1, arr[i + k])) * 32767);
        }
        out = accesseur(q, 'VEC4', { normalise: true });
      } else out = accesseur(new Float32Array(arr), 'VEC3');
      samplers.push({ input, output: out, interpolation: 'LINEAR' });
      channels.push({ sampler: samplers.length - 1, target: { node: n, path: size === 4 ? 'rotation' : 'translation' } });
    };
    for (const t of b.tracks) canal(t.node, t.prop, t.size, t.out);
    if (b.root) canal('Root', 'position', 3, b.root);
    animations.push({ name: nom, samplers, channels });
  }
  const json = {
    asset: { version: '2.0', generator: 'SFL tools/jeu-anims.mjs' },
    scene: 0, scenes: [{ name: nomScene, nodes: [0] }], nodes: sq.nodes, animations,
    buffers: [{ byteLength: taille }], bufferViews: vues, accessors: accesseurs,
  };
  let js = new TextEncoder().encode(JSON.stringify(json));
  const jpad = (4 - (js.length % 4)) % 4;
  if (jpad) { const t = new Uint8Array(js.length + jpad).fill(0x20); t.set(js); js = t; }
  const bpad = (4 - (taille % 4)) % 4;
  const bin = new Uint8Array(taille + bpad);
  let o = 0; for (const m of morceaux) { bin.set(m, o); o += m.byteLength; }
  const total = 12 + 8 + js.length + 8 + bin.length;
  const glb = new Uint8Array(total), dv = new DataView(glb.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); glb.set(js, 20);
  const b0 = 20 + js.length;
  dv.setUint32(b0, bin.length, true); dv.setUint32(b0 + 4, 0x004e4942, true); glb.set(bin, b0 + 8);
  return glb;
}

const idxFile = path.join(OUT, 'index.json');
const index = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
for (const [pack, clips] of Object.entries(PACKS)) {
  if (ONLY && pack !== ONLY) continue;
  index[pack] = {};
  let sq = null;
  const cuits = [];
  for (const [nom, opt] of Object.entries(clips)) {
    const file = path.join(SRC, `Liam@${opt.file}.fbx`);
    if (!fs.existsSync(file)) { console.error('manquant :', file); process.exitCode = 1; continue; }
    const b = bake(file, opt);
    sq ??= squelette(b.obj);
    cuits.push({ nom, b });
    const disp = b.root ? [b.root[b.root.length - 3], b.root[b.root.length - 1]] : [0, 0];
    index[pack][nom] = {
      loop: !!opt.loop, dur: +b.duration.toFixed(3), move: disp.map((v) => +v.toFixed(3)), plant: +b.plant.toFixed(3),
      ...(b.hit != null ? { hit: +b.hit.toFixed(3) } : {}), ...(opt.hitAt != null ? { hitFixe: true } : {}), ...(b.turn ? { turn: b.turn } : {}), source: opt.file,
    };
  }
  const glb = ecrireGLB(pack, sq, cuits);
  const dst = path.join(OUT, `${pack}.pak`);
  fs.writeFileSync(dst, pak(glb, pack)); // jamais de .glb Mixamo en clair
  console.log(pack, cuits.length, 'clips', (fs.statSync(dst).size / 1024).toFixed(0), 'Ko');
}
fs.writeFileSync(idxFile, JSON.stringify(index, null, 1) + '\n');
