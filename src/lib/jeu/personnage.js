// Un joueur du jeu : un corps Mixamo (X Bot, Y Bot pour une joueuse) habillé en tenue Bola par le code, la grosse
// tête (tete.js) posée sur le cou, et les animations Mixamo de la bibliothèque (library.js) transposées dessus.
// Repris de sabrilab/bola-game (src/game/character.js), avec la tenue et la tête en plus.
//
// La tenue est peinte sur le corps d'après les os qui le portent (poids de peau) : torse et haut des bras = maillot,
// bassin et cuisses = short, bas des jambes = chaussettes, pieds = crampons, avant-bras et mains = peau du joueur
// (la couleur mesurée sur sa photo). La vraie tête du corps est repliée (os de la tête à l'échelle 0) : la grosse
// tête suit le cou et reprend chaque image la rotation de l'os de la tête.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadPak } from './pak.js';
import { makeRig, clipsFor, boneKey } from './library.js';

const HAUTEUR = 1.8; // taille d'un joueur (m)

// Corps lisses « Universal Base Characters » de Quaternius (licence CC0, repris de sabrilab/mixamo-library, viewer/char-m
// et char-f) : homme et femme, sans texture. Leur squelette (pelvis, thigh_l…) est renommé à la Mixamo au chargement,
// pour que les animations de la bibliothèque s'y transposent. X Bot et Y Bot (Mixamo, .pak) restent possibles.
const UBC = { pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', Head: 'Head' };
for (const [m, s] of [['Left', 'l'], ['Right', 'r']]) {
  Object.assign(UBC, { [`clavicle_${s}`]: `${m}Shoulder`, [`upperarm_${s}`]: `${m}Arm`, [`lowerarm_${s}`]: `${m}ForeArm`, [`hand_${s}`]: `${m}Hand`,
    [`thigh_${s}`]: `${m}UpLeg`, [`calf_${s}`]: `${m}Leg`, [`foot_${s}`]: `${m}Foot`, [`ball_${s}`]: `${m}ToeBase` });
  for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) for (let k = 1; k <= 3; k++) UBC[`${f.toLowerCase()}_0${k}_${s}`] = `${m}Hand${f}${k}`;
}
let glbLoader = null;
const glbCache = new Map();
function chargerCorps(modele) {
  if (modele === 'xbot' || modele === 'ybot') return loadPak(`/jeu/chars/${modele}.pak`);
  glbLoader ??= new GLTFLoader();
  if (!glbCache.has(modele)) {
    const p = glbLoader.loadAsync(`/jeu/chars/${modele}.glb`).then((g) => {
      g.scene.traverse((o) => { if (UBC[o.name]) o.name = UBC[o.name]; });
      return g;
    });
    p.catch(() => glbCache.delete(modele));
    glbCache.set(modele, p);
  }
  return glbCache.get(modele);
}

/** Les tenues : les Noirs et les Blancs de la ligue, et les statues (adversaires sans visage). */
export const TENUES = {
  noirs: { maillot: 0x0d0d0f, short: 0x0d0d0f, chaussettes: 0x0d0d0f, crampons: 0x2a2a2c, liseré: 0xf2f2f2 },
  blancs: { maillot: 0xf4f4f2, short: 0xf4f4f2, chaussettes: 0xf4f4f2, crampons: 0x161618, liseré: 0x111111 },
  marbre: { maillot: 0xe9e6df, short: 0xe9e6df, chaussettes: 0xe9e6df, crampons: 0xe9e6df, liseré: 0xe9e6df, peau: 0xe9e6df },
  obsidienne: { maillot: 0x1a1a1c, short: 0x1a1a1c, chaussettes: 0x1a1a1c, crampons: 0x1a1a1c, liseré: 0x1a1a1c, peau: 0x1a1a1c },
};

const ZONE = {
  hips: 'short', leftupleg: 'short', rightupleg: 'short',
  leftleg: 'chaussettes', rightleg: 'chaussettes',
  leftfoot: 'crampons', rightfoot: 'crampons', lefttoebase: 'crampons', righttoebase: 'crampons', lefttoeend: 'crampons', righttoeend: 'crampons',
  spine: 'maillot', spine1: 'maillot', spine2: 'maillot', leftshoulder: 'maillot', rightshoulder: 'maillot',
  leftarm: 'maillot', rightarm: 'maillot',
  neck: 'peau', head: 'peau', headtopend: 'peau', leftforearm: 'peau', rightforearm: 'peau',
};
const zoneDe = (k) => ZONE[k] ?? (/hand|thumb|index|middle|ring|pinky/.test(k) ? 'peau' : 'maillot');

/**
 * Prépare la tenue d'un corps : pour chaque sommet, la part de chaque morceau du corps (torse, bassin, mollet, pied,
 * peau) et quelques poids de détail (cou, avant-bras, mollet, cuisse), lus dans les poids de peau. Le shader
 * (materiauTenue) choisit la couleur au pixel : les bords du col, des manches, du short et des chaussettes suivent
 * des lignes de niveau lisses au lieu des dents de scie des triangles.
 */
function peindre(mesh) {
  const geo = mesh.geometry = mesh.geometry.clone();
  const idx = geo.attributes.skinIndex, w = geo.attributes.skinWeight, n = idx.count;
  const bones = mesh.skeleton.bones.map((b) => boneKey(b.name));
  const parts = new Float32Array(n * 4), detail = new Float32Array(n * 4), cuisse = new Float32Array(n);
  // le tissu : maillot et short un peu décollés du corps (gonflés le long de la normale), pas une combinaison
  geo.computeBoundingBox();
  const h = geo.boundingBox.max.y - geo.boundingBox.min.y || 1;
  const GONFLE = { maillot: 0.011, short: 0.016, chaussettes: 0.004, crampons: 0.003, peau: 0 };
  const PART = { maillot: 0, short: 1, chaussettes: 2, crampons: 3, peau: 4 };
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const zones = new Array(n);
  const somme = new Float32Array(5);
  for (let i = 0; i < n; i++) {
    somme.fill(0);
    let cou = 0, avantBras = 0, mollet = 0, cuisseP = 0;
    for (let j = 0; j < 4; j++) {
      const k = bones[idx.getComponent(i, j)], p = w.getComponent(i, j);
      if (!p) continue;
      somme[PART[zoneDe(k)]] += p;
      if (/forearm/.test(k)) avantBras += p;
      if (k === 'neck' || k === 'head') cou += p;
      if (k === 'leftleg' || k === 'rightleg') mollet += p;
      if (k === 'leftupleg' || k === 'rightupleg') cuisseP += p;
    }
    parts.set([somme[0], somme[1], somme[2], somme[3]], i * 4);
    detail.set([somme[4], cou, avantBras, mollet], i * 4);
    cuisse[i] = cuisseP;
    let best = 0;
    for (let z = 1; z < 5; z++) if (somme[z] > somme[best]) best = z;
    const z = ['maillot', 'short', 'chaussettes', 'crampons', 'peau'][best];
    zones[i] = z;
    if (nor && GONFLE[z]) {
      const g = GONFLE[z] * h;
      pos.setXYZ(i, pos.getX(i) + nor.getX(i) * g, pos.getY(i) + nor.getY(i) * g, pos.getZ(i) + nor.getZ(i) * g);
    }
  }
  geo.setAttribute('aParts', new THREE.BufferAttribute(parts, 4));
  geo.setAttribute('aDetail', new THREE.BufferAttribute(detail, 4));
  geo.setAttribute('aCuisse', new THREE.BufferAttribute(cuisse, 1));
  lisser(geo, zones, new Set(['maillot', 'short', 'crampons', 'chaussettes']), 4);
}

/** Le tissu de la tenue : un MeshStandardMaterial dont la couleur est choisie au pixel (voir peindre). */
function materiauTenue(couleurs, statue) {
  const lin = (c) => new THREE.Color(c).convertSRGBToLinear();
  const u = {
    cMaillot: { value: lin(couleurs.maillot) }, cShort: { value: lin(couleurs.short) },
    cChaussettes: { value: lin(couleurs.chaussettes) }, cCrampons: { value: lin(couleurs.crampons) },
    cPeau: { value: lin(couleurs.peau) }, cLisere: { value: lin(couleurs.liseré) },
  };
  const mat = new THREE.MeshStandardMaterial({ roughness: statue ? 0.38 : 0.8, metalness: 0.02 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aParts; attribute vec4 aDetail; attribute float aCuisse;\nvarying vec4 vParts; varying vec4 vDetail; varying float vCuisse;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvParts = aParts; vDetail = aDetail; vCuisse = aCuisse;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 cMaillot, cShort, cChaussettes, cCrampons, cPeau, cLisere;
        varying vec4 vParts; varying vec4 vDetail; varying float vCuisse;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float t = vParts.x, p = vParts.y, l = vParts.z, f = vParts.w, s = vDetail.x;
          vec3 c = cMaillot; float m = t;
          if (p > m) { m = p; c = cShort; }
          if (l > m) { m = l; c = cChaussettes; }
          if (f > m) { m = f; c = cCrampons; }
          if (s > m) { m = s; c = cPeau; }
          bool torse = t >= m - 1e-4;
          // col et manches : le liseré
          if (torse && (vDetail.y > 0.26 || vDetail.z > 0.14)) c = cLisere;
          if (torse && (vDetail.y > 0.62 || vDetail.z > 0.3)) c = cPeau;
          // le genou nu entre le short et les chaussettes
          if (p >= m - 1e-4 && vDetail.w > 0.05) c = cPeau;
          if (l >= m - 1e-4 && vCuisse > 0.2) c = cPeau;
          diffuseColor.rgb = c;
        }`);
  };
  mat.customProgramCacheKey = () => 'bola-tenue-v1';
  mat.userData.uniforms = u;
  return mat;
}

/** Lissage laplacien des sommets habillés : les muscles et les orteils du corps nu disparaissent sous le tissu. */
function lisser(geo, zones, garder, iterations) {
  const pos = geo.attributes.position, n = pos.count;
  // sommets soudés par position (le maillage est découpé aux coutures d'UV)
  const cle = (i) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  const groupe = new Int32Array(n), reps = new Map();
  for (let i = 0; i < n; i++) { const k = cle(i); if (!reps.has(k)) reps.set(k, reps.size); groupe[i] = reps.get(k); }
  const m = reps.size, voisins = Array.from({ length: m }, () => new Set());
  const index = geo.index ? geo.index.array : Array.from({ length: n }, (_, i) => i);
  for (let t = 0; t < index.length; t += 3) {
    const a = groupe[index[t]], b = groupe[index[t + 1]], c = groupe[index[t + 2]];
    voisins[a].add(b).add(c); voisins[b].add(a).add(c); voisins[c].add(a).add(b);
  }
  const P = new Float32Array(m * 3), mobile = new Uint8Array(m);
  for (let i = 0; i < n; i++) {
    const g = groupe[i];
    P[g * 3] = pos.getX(i); P[g * 3 + 1] = pos.getY(i); P[g * 3 + 2] = pos.getZ(i);
    if (garder.has(zones[i])) mobile[g] = 1;
  }
  const Q = new Float32Array(m * 3);
  for (let it = 0; it < iterations; it++) {
    Q.set(P);
    for (let g = 0; g < m; g++) {
      if (!mobile[g] || !voisins[g].size) continue;
      let x = 0, y = 0, z = 0;
      for (const v of voisins[g]) { x += P[v * 3]; y += P[v * 3 + 1]; z += P[v * 3 + 2]; }
      const k = voisins[g].size;
      Q[g * 3] = P[g * 3] * 0.4 + (x / k) * 0.6; Q[g * 3 + 1] = P[g * 3 + 1] * 0.4 + (y / k) * 0.6; Q[g * 3 + 2] = P[g * 3 + 2] * 0.4 + (z / k) * 0.6;
    }
    P.set(Q);
  }
  for (let i = 0; i < n; i++) { const g = groupe[i]; pos.setXYZ(i, P[g * 3], P[g * 3 + 1], P[g * 3 + 2]); }
  geo.computeVertexNormals();
}

/**
 * Crée un joueur.
 * tenue : 'noirs' | 'blancs' | 'marbre' | 'obsidienne' ; tete : un THREE.Object3D (creerTete) ; peau : THREE.Color.
 * packs : paquets d'animations ('player', 'keeper', 'celeb').
 */
const geometriesPeintes = new WeakMap();

export async function creerPersonnage({ modele = 'homme', tenue = 'noirs', tete = null, peau = null, packs = ['player'], echelleTete = 1.55 }) {
  const gltf = await chargerCorps(modele);
  const corps = cloneSkinned(gltf.scene);
  const t = TENUES[tenue] ?? TENUES.noirs;
  const statue = tenue === 'marbre' || tenue === 'obsidienne';
  const couleurs = {
    maillot: t.maillot, short: t.short, chaussettes: t.chaussettes, crampons: t.crampons, liseré: t.liseré,
    peau: t.peau ?? (peau ? `#${peau.getHexString()}` : 0xb98a6a),
  };
  corps.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false;
    // la géométrie habillée ne dépend que du corps : peinte une fois, partagée par tous les joueurs (dix sur le terrain)
    const source = o.geometry;
    if (geometriesPeintes.has(source)) o.geometry = geometriesPeintes.get(source);
    else { peindre(o); geometriesPeintes.set(source, o.geometry); }
    o.material = materiauTenue(couleurs, statue);
  });

  const racine = new THREE.Group(); // déplacée et tournée par le jeu, à l'échelle du mètre
  racine.add(corps);
  corps.updateMatrixWorld(true);
  let top = -Infinity, bottom = Infinity;
  const w = new THREE.Vector3();
  corps.traverse((o) => {
    if (!o.isBone) return;
    o.getWorldPosition(w);
    top = Math.max(top, w.y);
    if (/toe|foot/i.test(o.name)) bottom = Math.min(bottom, w.y);
  });
  const scale = HAUTEUR / (top - bottom);
  corps.scale.setScalar(scale);
  corps.position.y = -bottom * scale;

  const rig = makeRig(corps, true);
  const clips = {};
  for (const p of packs) Object.assign(clips, await clipsFor(rig, p));

  const os = {};
  for (const [k, b] of rig.bones) os[k] = b.obj;

  // la grosse tête : sur le cou, à l'endroit de l'os de la tête, qui est replié
  const osTete = os.head, cou = os.neck;
  let pivot = null;
  if (osTete && cou && tete) {
    pivot = new THREE.Group();
    pivot.position.copy(osTete.position);
    cou.add(pivot);
    // taille de la tête en mètres → repère local du cou (le corps est mis à l'échelle, l'armature Mixamo aussi)
    racine.updateMatrixWorld(true);
    const sw = cou.getWorldScale(new THREE.Vector3()).x || 1;
    const R = 0.12 * echelleTete; // rayon de l'œuf, en mètres
    tete.scale.setScalar(R / sw);
    tete.position.set(0, (R * 0.86) / sw, (R * 0.12) / sw);
    pivot.add(tete);
    osTete.scale.setScalar(0.0001);
  }

  const mixer = new THREE.AnimationMixer(corps);
  const actions = {};
  for (const [name, clip] of Object.entries(clips)) {
    const a = mixer.clipAction(clip);
    if (!clip.userData.loop) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    actions[name] = a;
  }
  const metresParHanche = rig.hipH * scale;
  const vitesseClip = (n) => {
    const u = clips[n]?.userData;
    return u && u.dur ? (Math.hypot(u.move[0], u.move[1]) * metresParHanche) / u.dur : 0;
  };

  let courant = null, ponctuel = null, locoNom = null;
  function fondu(name, fade = 0.2, timeScale = 1) {
    const next = actions[name];
    if (!next) return null;
    if (courant === next) {
      if (!next.isRunning()) next.reset().play();
      next.setEffectiveTimeScale(timeScale);
      return next;
    }
    next.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).play();
    if (courant) next.crossFadeFrom(courant, fade, false);
    courant = next;
    return next;
  }

  const p = {
    racine, corps, rig, os, clips, actions, mixer, scale, tete,
    get occupe() { return !!ponctuel; },
    get ponctuelNom() { return ponctuel?.name ?? null; },
    vitesseClip,
    /** locomotion : le cycle suit la vitesse (m/s), la cadence des pas aussi. */
    loco(vitesse, { force = null, fade = 0.25 } = {}) {
      if (ponctuel) return;
      let n = 'idle';
      if (vitesse > 0.35) n = vitesse < 3.4 ? 'jog' : vitesse < 5.6 ? 'run' : 'sprint';
      if (force) n = force;
      if (!actions[n]) n = Object.keys(actions).find((k) => /idle/.test(k)) ?? n;
      const cs = vitesseClip(n);
      const ts = /idle/.test(n) || !cs ? 1 : THREE.MathUtils.clamp(vitesse / cs, 0.6, 1.7);
      if (n !== locoNom) { fondu(n, fade, ts); locoNom = n; }
      else courant?.setEffectiveTimeScale(ts);
    },
    /** clip joué une fois ; surImpact à l'instant d'impact mesuré, surFin à la fin. */
    jouer(name, { fade = 0.12, timeScale = 1, surImpact, surFin, depuis = 0, impactDans = null, apres = 1.1 } = {}) {
      const u = clips[name]?.userData;
      if (!u) return null;
      const hitT = u.hit != null ? u.hit * clips[name].duration : null;
      let ts = timeScale;
      if (impactDans && hitT != null) ts = THREE.MathUtils.clamp((hitT - depuis * clips[name].duration) / impactDans, timeScale, 3.2);
      const a = fondu(name, fade, ts);
      if (!a) return null;
      a.time = depuis * clips[name].duration;
      locoNom = null;
      ponctuel = { name, action: a, hitT, fait: false, surImpact, surFin, apres: impactDans ? apres : null };
      return a;
    },
    /** boucle jouée tant qu'on ne demande rien d'autre (célébration, pose du studio) */
    boucle(name, fade = 0.3) { ponctuel = null; locoNom = name; return fondu(name, fade, 1); },
    arreterPonctuel() { ponctuel = null; },
    pencher(roulis, tangage) { corps.rotation.z = roulis; corps.rotation.x = tangage; },
    update(dt) {
      mixer.update(dt);
      if (osTete && pivot) {
        pivot.quaternion.copy(osTete.quaternion);
        osTete.scale.setScalar(0.0001);
      }
      if (!ponctuel) return;
      const s = ponctuel, t = s.action.time, dur = clips[s.name].duration;
      if (s.hitT != null && !s.fait && t >= s.hitT) {
        s.fait = true;
        if (s.apres) s.action.setEffectiveTimeScale(s.apres);
        s.surImpact?.();
      }
      if (!clips[s.name].userData.loop && t >= dur - 1e-3) {
        ponctuel = null;
        s.surFin?.();
      }
    },
    osMonde(key, out = new THREE.Vector3()) {
      const b = os[boneKey(key)];
      return b ? b.getWorldPosition(out) : out.copy(racine.position);
    },
    face(out = new THREE.Vector3()) {
      return out.set(Math.sin(racine.rotation.y), 0, Math.cos(racine.rotation.y));
    },
    liberer() {
      mixer.stopAllAction();
      corps.traverse((o) => { if (o.isSkinnedMesh) o.material.dispose(); }); // la géométrie est partagée (geometriesPeintes)
      tete?.userData.dispose?.();
    },
  };
  p.loco(0);
  return p;
}
