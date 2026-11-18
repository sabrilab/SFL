// Le banc des gestes du jeu Bola (bola-app#32, lot A2), sans navigateur : « une animation distincte par commande », le
// gardien et les tacles, mesurés sur ce que montre la page (même graphe d'animation, même animateur, même état
// d'animation que match.js ; images de 1/60 s, deux pas de simulation chacune).
//
//   · gestes : chaque commande de la table des touches (entrees/touches.js) jouée par un humain, arrêté et en course,
//     sur le squelette canonique des paquets ; à l'image du contact on relève le clip joué, l'élan (temps de l'appui au
//     contact, part du clip jouée avant), la surface du pied qui frappe (angle du pied par rapport au départ de la balle,
//     + : pointe vers l'extérieur ; tangage, − : pointe vers le bas), le buste (tangage, + en avant ; roulis, + du côté
//     opposé au pied qui frappe) et le suivi (hauteur du pied dans les 0,4 s après le contact). Critère : chaque paire
//     de commandes que Sabri distingue (passe / passe puissante ; frappe, enroulée, piqué, ras de terre, acrobatique ;
//     centre / centre lobé ; profondeur au sol / lobée ; tacle / récupération) diffère par le clip ou par deux traits au
//     moins (écarts : surface 25°, tangage du pied 15°, buste 6°, roulis 6°, suivi 0,25 m, élan 0,04 s) ;
//   · gardien (--gardien) : le VRAI corps de la page (public/jeu/chars/footballeur.pak, sans ses textures), la semelle
//     (sommets des crampons) au-dessus du gazon hors plongeon ; plongeons du bon côté ; arrêts ; tirs cadrés sur
//     lesquels il réagit ;
//   · tacles (--tacles) : les trois issues (balle prise, contrée, porteur fauché) selon l'angle et la position de la balle,
//     la portée de la glissade selon la vitesse, le tacleur raté qui reste au sol.
//
//   npx tsx tools/jeu-banc-gestes.ts             tout
//   npx tsx tools/jeu-banc-gestes.ts --gestes    une partie seulement (--gestes, --gardien, --tacles)
//   npx tsx tools/jeu-banc-gestes.ts --json=f    les mesures en JSON (pour le compte rendu)
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as Pak from '../src/lib/jeu/pakcodec.js';
import * as Lib from '../src/lib/jeu/library.js';
import * as Clp from '../src/lib/jeu/sim/clips.js';
import * as Mon from '../src/lib/jeu/sim/monde.js';
import * as Gst from '../src/lib/jeu/sim/gestes.js';
import * as Gar from '../src/lib/jeu/sim/gardien.js';
import * as Ani from '../src/lib/jeu/rendu/animateur.js';
import * as Eta from '../src/lib/jeu/rendu/etat.js';
import * as Bcl from '../src/lib/jeu/sim/boucle.js';
import * as Cst0 from '../src/lib/jeu/sim/constantes.js';
import * as Bal from '../src/lib/jeu/sim/ballon.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const { unpak }: Any = Pak;
const { makeRig, bindClip, boneKey }: Any = Lib;
const { chargerMesures }: Any = Clp;
const { creerMonde, demarrer, pas }: Any = Mon;
const { porteur, rouler }: Any = Gst;
const { mainsMonde }: Any = Gar;
const { creerAnimateur, orientationPied }: Any = Ani;
const { etatAnim }: Any = Eta;
const { creerBoucle, avancer, joueurInterpole, balleInterpolee }: Any = Bcl;
const Cst: Any = Cst0;

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
chargerMesures(fs.readFileSync(path.join(RACINE, 'public/jeu/anims/mesures.pak')));
const avert = console.warn; console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith('THREE.')) avert(...a); };
const args = process.argv.slice(2);
const parties = ['gestes', 'gardien', 'tacles'].filter((k) => args.includes(`--${k}`));
const faire = (k: string) => !parties.length || parties.includes(k);
const jsonOut = args.find((a) => a.startsWith('--json='))?.slice(7);
const RES: Any = {};
const resume: string[] = [];
let echecs = 0;
function verifier(nom: string, ok: boolean, detail: string) {
  const l = `${ok ? 'ok   ' : 'ÉCHEC'} ${nom} : ${detail}`;
  console.log(l); resume.push(l); if (!ok) echecs++;
}
const DEG = 180 / Math.PI;
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');

// ── les paquets et les personnages ──
async function paquet(nom: string) {
  const glb = unpak(new Uint8Array(fs.readFileSync(path.join(RACINE, `public/jeu/anims/${nom}.pak`))), nom);
  const g: Any = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  g.scene.updateMatrixWorld(true);
  const index = JSON.parse(fs.readFileSync(path.join(RACINE, 'public/jeu/anims/index.json'), 'utf8'))[nom] ?? {};
  for (const c of g.animations) c.userData = { ...(index[c.name] ?? {}), pack: nom };
  return { scene: g.scene, rig: makeRig(g.scene, false), clips: g.animations };
}
const PAQ: Record<string, Any> = {};
const PAQUETS_CHAMP = ['player', 'player2', 'player3', 'celeb', 'celeb2'];
const PAQUETS_GARDIEN = ['keeper', 'keeper2', 'player', 'celeb', 'celeb2'];

function lier(corps: Any, rig: Any, paquets: string[]) {
  const mixer = new THREE.AnimationMixer(corps);
  const actions: Record<string, Any> = {};
  for (const p of paquets) {
    if (!PAQ[p]) continue;
    for (const c of PAQ[p].clips) {
      if (actions[c.name]) continue;
      const b = bindClip(c, PAQ[p].rig, rig);
      const a = mixer.clipAction(b);
      if (!b.userData.loop) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      actions[c.name] = a;
    }
  }
  const os: Record<string, Any> = {};
  for (const [k, b] of rig.bones) os[k] = b.obj;
  return { mixer, actions, os };
}
/** Le squelette canonique des paquets, à la taille du jeu (comme jeu-banc-anim). */
function persoCanon(gardien: boolean) {
  const corps = PAQ.player.scene.clone(true);
  corps.scale.setScalar((Clp as Any).HANCHE);
  const racine = new THREE.Group(); racine.add(corps); racine.updateMatrixWorld(true);
  const rig = makeRig(corps, false);
  return { racine, corps, rig, ...lier(corps, rig, gardien ? PAQUETS_GARDIEN : PAQUETS_CHAMP) };
}
/** Le vrai footballeur de la page (footballeur.pak), chargé sans ses textures (le JSON du GLB est nettoyé). */
async function chargerFootballeur() {
  const glb: Uint8Array = unpak(new Uint8Array(fs.readFileSync(path.join(RACINE, 'public/jeu/chars/footballeur.pak'))), 'footballeur');
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jl = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jl)));
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) {
    const pb = m.pbrMetallicRoughness; if (pb) { delete pb.baseColorTexture; delete pb.metallicRoughnessTexture; }
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; delete m.extensions;
  }
  for (const k of ['extensionsUsed', 'extensionsRequired']) if (json[k]) json[k] = json[k].filter((e: string) => !/texture/i.test(e));
  let js = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (js.length % 4)) % 4; if (pad) { const t = new Uint8Array(js.length + pad).fill(0x20); t.set(js); js = t; }
  const bin = glb.subarray(20 + jl), out = new Uint8Array(20 + js.length + bin.length), o = new DataView(out.buffer);
  out.set(glb.subarray(0, 12)); o.setUint32(8, out.length, true); o.setUint32(12, js.length, true); o.setUint32(16, 0x4e4f534a, true); out.set(js, 20); out.set(bin, 20 + js.length);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(out.buffer, '');
}
/** Un joueur sur le vrai corps (comme personnage.js), et la hauteur de ses semelles (sommets des crampons). */
function persoReel(modele: Any, gardien: boolean) {
  const corps: Any = cloneSkinned(modele.scene);
  const racine = new THREE.Group(); racine.add(corps); corps.updateMatrixWorld(true);
  let top = -Infinity, bottom = Infinity; const w = new THREE.Vector3();
  corps.traverse((o: Any) => { if (!o.isBone) return; o.getWorldPosition(w); top = Math.max(top, w.y); if (/toe|foot/i.test(o.name)) bottom = Math.min(bottom, w.y); });
  const scale = 1.8 / (top - bottom);
  corps.scale.setScalar(scale); corps.position.y = -bottom * scale;
  const rig = makeRig(corps, true);
  const L = lier(corps, rig, gardien ? PAQUETS_GARDIEN : PAQUETS_CHAMP);
  let chaussures: Any = null; corps.traverse((o: Any) => { if (o.isSkinnedMesh && /shoe/i.test(o.name)) chaussures = o; });
  racine.updateMatrixWorld(true);
  const semelles: number[][] = [[], []];
  const v = new THREE.Vector3();
  if (chaussures) {
    const idx = chaussures.geometry.attributes.skinIndex, wt = chaussures.geometry.attributes.skinWeight;
    const bones = chaussures.skeleton.bones.map((b: Any) => boneKey(b.name));
    for (let i = 0; i < idx.count; i++) {
      let best = -1, bw = 0; for (let k = 0; k < 4; k++) if (wt.getComponent(i, k) > bw) { bw = wt.getComponent(i, k); best = idx.getComponent(i, k); }
      const nm = bones[best] ?? '', cote = /^left/.test(nm) ? 0 : /^right/.test(nm) ? 1 : -1;
      if (cote < 0) continue;
      chaussures.getVertexPosition(i, v); v.applyMatrix4(chaussures.matrixWorld);
      if (v.y < 0.06) semelles[cote].push(i);
    }
  }
  const semelle = (out: number[]) => {
    for (let c = 0; c < 2; c++) { let lo = Infinity; for (const i of semelles[c]) { chaussures.getVertexPosition(i, v); v.applyMatrix4(chaussures.matrixWorld); if (v.y < lo) lo = v.y; } out[c] = lo; }
    return out;
  };
  return { racine, corps, rig, ...L, semelle };
}

/** Fait jouer un monde image par image avec ses animateurs ; chaque(k, M) après le rendu de l'image k. */
function jouer(M: Any, persos: Any[], images: number, entrees: ((m: Any) => Any) | null, chaque: (k: number, M: Any, anims: Any[]) => boolean | void) {
  const anims = persos.map((P: Any, i: number) => (P ? creerAnimateur(P, { gardien: M.joueurs[i].gardien, versMonde3: (q: Any, out: Any) => out.set(q.x, q.y ?? 0, q.z) }) : null));
  const caches = M.joueurs.map(() => ({})), interp = M.joueurs.map(() => ({ x: 0, z: 0, cap: 0 }));
  const bc = creerBoucle(M), bI = { x: 0, y: 0, z: 0 };
  M.evtsVus = [];
  for (let k = 0; k < images; k++) {
    avancer(bc, 1 / 60, entrees ? () => entrees(M) : null, 1, () => { for (const ev of M.evts) M.evtsVus.push({ ...ev, k }); M.evts.length = 0; });
    const p = porteur(M);
    balleInterpolee(bc, bI);
    for (let i = 0; i < M.joueurs.length; i++) {
      const P = persos[i]; if (!P || M.joueurs[i].absent) continue;
      const j = M.joueurs[i], I = interp[i];
      joueurInterpole(bc, i, I);
      P.racine.position.set(I.x, 0, I.z); P.racine.rotation.y = I.cap;
      anims[i].maj(etatAnim(M, j, I, p, bI, caches[i]), 1 / 60);
      P.racine.updateMatrixWorld(true);
    }
    if (chaque(k, M, anims) === false) break;
    if (M.phase === 'fin') break;
  }
  return anims;
}

const poser = (j: Any, x: number, z: number, cap: number, vx = 0, vz = 0) => { j.p.x = x; j.p.z = z; j.cap = cap; j.v.x = vx; j.v.z = vz; };
function balleA(M: Any, x: number, y: number, z: number, vx: number, vy: number, vz: number, poss: number | null) {
  const b = M.balle; b.p.x = x; b.p.y = y; b.p.z = z; b.v.x = vx; b.v.y = vy; b.v.z = vz; rouler(b);
  b.possesseur = poss; b.dernier = poss ?? 6; b.dernierT = M.t; b.garde = null; b.tir = null; b.recepteur = null;
}

// ─────────────────────────── 1. une animation distincte par commande ───────────────────────────
const COMMANDES: Array<[string, Any]> = [
  ['passe', { type: 'passe' }], ['passePuissante', { type: 'passe', puissante: true }],
  ['frappe', { type: 'frappe' }], ['finesse', { type: 'finesse' }], ['pique', { type: 'lobFrappe' }], ['ras', { type: 'frappe', r2: true }],
  ['acrobatique', { type: 'frappe', r2: true }], ['exterieur', { type: 'exterieur' }],
  ['centre', { type: 'centre' }], ['centreLobe', { type: 'centre', haut: true }], ['centreTendu', { type: 'centre', tendu: true }],
  ['profondeur', { type: 'profondeur' }], ['profondeurLobee', { type: 'profondeur', lobe: true }], ['profondeurTendue', { type: 'profondeur', puissante: true }],
];
// (les paires que Sabri distingue, retour du 18/11 à 21:19)
const PAIRES: Array<[string, string]> = [
  ['passe', 'passePuissante'],
  ['frappe', 'finesse'], ['frappe', 'pique'], ['frappe', 'ras'], ['frappe', 'acrobatique'], ['finesse', 'pique'], ['finesse', 'ras'], ['finesse', 'acrobatique'], ['pique', 'ras'], ['pique', 'acrobatique'], ['ras', 'acrobatique'],
  ['centre', 'centreLobe'], ['profondeur', 'profondeurLobee'], ['tacle', 'recuperer'],
];

const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3();
/** La pose au contact : surface du pied, buste, et le clip. */
function pose(P: Any, j: Any, pied: number, dirX: number, dirZ: number) {
  const knee = pied ? P.os.rightleg : P.os.leftleg, foot = pied ? P.os.rightfoot : P.os.leftfoot, toe = pied ? P.os.righttoebase : P.os.lefttoebase;
  knee.getWorldPosition(vC); foot.getWorldPosition(vA); toe.getWorldPosition(vB);
  const av = { x: 0, z: 0 };
  const tangagePied = orientationPied(vC, vA, vB, av) * DEG; // − : la pointe vers le bas (au repos ≈ −32°)
  // l'angle du pied par rapport au départ de la balle, + : la pointe vers l'extérieur de la jambe qui frappe
  let yaw = Math.atan2(av.x * dirZ - av.z * dirX, av.x * dirX + av.z * dirZ) * DEG; // + : pointe à gauche de la direction
  if (pied === 1) yaw = -yaw;
  const hauteurPied = vA.y;
  // le buste : des hanches au haut du dos, dans le repère du joueur (avant = cap)
  P.os.hips.getWorldPosition(vC); (P.os.spine2 ?? P.os.neck).getWorldPosition(vD);
  const bx = vD.x - vC.x, by = vD.y - vC.y, bz = vD.z - vC.z;
  const ax = Math.sin(j.cap), az = Math.cos(j.cap); // avant
  const lx = az, lz = -ax; // gauche (repère du jeu = repère du banc)
  const avb = bx * ax + bz * az, la = bx * lx + bz * lz;
  const buste = Math.atan2(avb, by) * DEG;
  let roulis = Math.atan2(la, by) * DEG; // + : penché vers sa gauche
  if (pied === 0) roulis = -roulis; // + : du côté opposé au pied qui frappe
  return { yaw, tangagePied, buste, roulis, hauteurPied };
}
function scenesGestes(): Any {
  const out: Any = {};
  for (const course of [false, true]) {
    for (const [id, spec0] of COMMANDES) {
      const aerien = id === 'acrobatique';
      const M: Any = creerMonde({ graine: 77, humains: [true, false], aides: [0.5, 0], presents: [0, 3, 4, 5] });
      demarrer(M, { intro: false });
      M.controleFixe = [4, null];
      const j = M.joueurs[4];
      const v = course && !aerien ? 5.5 : 0;
      poser(M.joueurs[3], id.startsWith('centre') ? -1 : 3.5, -6, Math.PI);
      if (aerien) { poser(j, 0, 4, Math.PI); balleA(M, 0, 1.0, 3.55, 0, 0.5, 0, 4); }
      else { poser(j, id.startsWith('centre') ? 5 : 0, 4, Math.PI, 0, -v); balleA(M, id.startsWith('centre') ? 5 : 0, 0.11, 3.55, 0, 0, -v, 4); }
      const persos = M.joueurs.map((q: Any) => (q.i === 4 ? persoCanon(false) : null));
      let fait = false, kAppui = -1, kContact = -1, mes: Any = null, clip = '', debut = 0, impact = 0, suivi = 0, pied = 1, dir = { x: 0, z: -1 };
      jouer(M, persos, 100, (m: Any) => {
        const t = m.t, a = !fait && m.joueurs[4].mode === 'loco' && t > 0.05 ? { ...spec0, commande: id } : null;
        if (a) { fait = true; }
        return [{ dx: 0, dz: course ? -1 : 0, allure: course ? 0.75 : 0, sprint: 0, action: a, regard: m.balle.p }, null];
      }, (k, Mm, anims) => {
        const g = j.g;
        if (kAppui < 0 && g && g.type === 'frappe') { kAppui = k; clip = g.nom; debut = g.debut; impact = g.impact; pied = g.donnees?.pied ?? 1; }
        if (kAppui >= 0 && kContact < 0 && g?.fait) {
          kContact = k;
          const b = Mm.balle, L = Math.hypot(b.v.x, b.v.z) || 1; dir = { x: b.v.x / L, z: b.v.z / L };
          mes = pose(persos[4], j, pied, dir.x, dir.z);
          mes.cmd = anims[4].diag.cmd; mes.dg = { ...anims[4].diag.commande };
        }
        if (kContact >= 0 && k - kContact <= 24) { (pied ? persos[4].os.rightfoot : persos[4].os.leftfoot).getWorldPosition(vA); suivi = Math.max(suivi, vA.y); }
        if (kContact >= 0 && k - kContact > 24) return false;
      });
      const ev = M.evtsVus.find((e: Any) => (e.type === 'passe' || e.type === 'frappe') && e.j === 4);
      out[`${id}${course ? ':course' : ''}`] = { id, course, clip, debut: +debut.toFixed(3), elanClip: +(impact - debut).toFixed(3), elan: kContact >= 0 ? +((kContact - kAppui + 1) / 60).toFixed(3) : null, ...mes, suivi, part: !!ev };
    }
  }
  // la défense : récupérer (○) contre tacle glissé (□), sur un porteur Blanc qui arrive
  for (const [id, glisse] of [['recuperer', false], ['tacle', true]] as Array<[string, boolean]>) {
    const M: Any = creerMonde({ graine: 78, humains: [true, false], aides: [0.5, 0], presents: [0, 4, 5, 6] });
    demarrer(M, { intro: false });
    M.controleFixe = [4, null];
    const j = M.joueurs[4];
    poser(j, 0, 1, 0); poser(M.joueurs[6], 0, glisse ? 4.2 : 2.2, Math.PI, 0, -3); balleA(M, 0, 0.11, glisse ? 3.6 : 1.7, 0, 0, -3.2, 6);
    const persos = M.joueurs.map((q: Any) => (q.i === 4 ? persoCanon(false) : null));
    let fait = false, kAppui = -1, kContact = -1, mes: Any = null, clip = '';
    jouer(M, persos, 90, (m: Any) => {
      const a = !fait && m.t > 0.05 ? { type: 'tacle', glisse, commande: id } : null; if (a) fait = true;
      return [{ dx: 0, dz: 0, allure: 0, sprint: 0, action: a, regard: m.balle.p }, null];
    }, (k) => {
      const g = j.g;
      if (kAppui < 0 && g && (g.type === 'tacle' || g.type === 'tacleDebout')) { kAppui = k; clip = g.nom; }
      const contact = g && (g.type === 'tacleDebout' ? g.fait : g.type === 'tacle' && g.t >= g.impact);
      if (kAppui >= 0 && kContact < 0 && contact) { kContact = k; const pied = g.nom === 'shoot2' ? 0 : 1; mes = pose(persos[4], j, pied, Math.sin(j.cap), Math.cos(j.cap)); }
      if (kContact >= 0) return false;
    });
    out[id] = { id, course: false, clip, elan: kContact >= 0 ? +((kContact - kAppui + 1) / 60).toFixed(3) : null, ...mes, suivi: NaN };
  }
  // la balle libre : ○ la prend, elle vient au pied (le contrôle de la simulation : amorti du pied)
  {
    const M: Any = creerMonde({ graine: 79, humains: [true, false], aides: [0.5, 0], presents: [0, 4, 5] });
    demarrer(M, { intro: false });
    M.controleFixe = [4, null];
    const j = M.joueurs[4];
    poser(j, 0, 4, Math.PI); balleA(M, 0.4, 0.11, 2.3, 0, 0, 0, null);
    const persos = M.joueurs.map((q: Any) => (q.i === 4 ? persoCanon(false) : null));
    let fait = false, clip = '', kAppui = -1, kPrise = -1;
    jouer(M, persos, 90, (m: Any) => {
      const a = !fait && m.t > 0.05 ? { type: 'prendre', commande: 'prendre' } : null; if (a) fait = true;
      return [{ dx: 0, dz: 0, allure: 0, sprint: 0, action: a, regard: m.balle.p }, null];
    }, (k, Mm, anims) => {
      if (fait && kAppui < 0) kAppui = k;
      // (le geste de la simulation qui prend la balle : le contrôle, joué par le graphe)
      if (!clip && j.g && j.g.type === 'controle') clip = j.g.nom;
      if (kPrise < 0 && Mm.balle.possesseur === 4) kPrise = k;
      if (process.env.BANC_DETAIL && k < 40) console.log('  prendre', k, anims[4].etat, anims[4].geste, j.mode, j.g?.nom, j.g?.type, Mm.balle.possesseur, Math.hypot(Mm.balle.p.x - j.p.x, Mm.balle.p.z - j.p.z).toFixed(2));
    });
    out.prendre = { id: 'prendre', course: false, clip, elan: kPrise >= 0 ? +((kPrise - kAppui + 1) / 60).toFixed(3) : null, yaw: NaN, tangagePied: NaN, buste: NaN, roulis: NaN, suivi: NaN };
  }
  return out;
}
function ecarts(a: Any, b: Any) {
  const d: string[] = [];
  if (a.clip.replace(/_l$/, '') !== b.clip.replace(/_l$/, '')) d.push('clip');
  if (Math.abs(a.yaw - b.yaw) >= 25) d.push('surface');
  if (Math.abs(a.tangagePied - b.tangagePied) >= 15) d.push('pied');
  if (Math.abs(a.buste - b.buste) >= 6) d.push('buste');
  if (Math.abs(a.roulis - b.roulis) >= 6) d.push('roulis');
  if (Number.isFinite(a.suivi) && Number.isFinite(b.suivi) && Math.abs(a.suivi - b.suivi) >= 0.25) d.push('suivi');
  if (a.elan != null && b.elan != null && Math.abs(a.elan - b.elan) >= 0.04) d.push('élan');
  return d;
}

// ─────────────────────────── 2. le gardien, sur le vrai corps ───────────────────────────
const AU_SOL = (k: Any) => k.mode === 'sol' || (k.g && (k.g.type === 'plongeon' || k.g.type === 'battu' || (k.g.type === 'arret' && /k_low|k_block|k_high|k_dive|k_miss/.test(k.g.nom))));
async function bancGardien() {
  const modele = await chargerFootballeur();
  const q = (t: number[], f: number) => { const x = [...t].sort((a, b) => a - b); return x.length ? x[Math.min(x.length - 1, Math.floor(x.length * f))] : NaN; };
  const moy = (t: number[]) => t.reduce((a, b) => a + b, 0) / Math.max(1, t.length);
  // a) des matchs IA contre IA : les semelles des deux gardiens, hors plongeon
  const bas: number[] = [], haut: number[] = [], parGeste: Record<string, number[]> = {};
  let pire = -Infinity, pireOu = '', enfonce = Infinity;
  const sem = [0, 0];
  for (let g = 1; g <= 2; g++) {
    const M: Any = creerMonde({ graine: 40 + g, duree: 90, humains: [false, false], aides: [0, 0] });
    demarrer(M, { intro: false });
    const persos = M.joueurs.map((j: Any) => (j.gardien ? persoReel(modele, true) : null));
    jouer(M, persos, 100 * 60, null, (k, Mm, anims) => {
      if (Mm.phase !== 'jeu' || k < 30 || k % 2) return;
      for (const j of Mm.joueurs) {
        if (!j.gardien || AU_SOL(j)) continue;
        persos[j.i].semelle(sem);
        const lo = Math.min(sem[0], sem[1]), hi = Math.max(sem[0], sem[1]);
        bas.push(lo); haut.push(hi); enfonce = Math.min(enfonce, lo);
        (parGeste[j.g?.nom ?? (Math.hypot(j.v.x, j.v.z) > 0.3 ? 'en mouvement' : 'en place')] ??= []).push(lo);
        if (lo > pire) { pire = lo; pireOu = `graine ${40 + g}, ${Mm.t.toFixed(1)} s, ${j.g?.nom ?? 'course'}`; }
        if (process.env.BANC_DETAIL && (lo > 0.02 || lo < -0.02)) console.log('  semelle', g, Mm.t.toFixed(2), j.i, j.g?.nom, j.g?.type, j.mode, (100 * lo).toFixed(1), Math.hypot(j.v.x, j.v.z).toFixed(2), JSON.stringify(anims[j.i].diag.sol), anims[j.i].diag.etat, anims[j.i].geste);
      }
    });
  }
  const pg = Object.entries(parGeste).map(([k, v]) => `${k} ${(100 * moy(v)).toFixed(1)}/${(100 * Math.max(...v)).toFixed(1)}`).join(', ');
  RES.gardienPieds = { images: bas.length, moy_cm: 100 * moy(bas), p90_cm: 100 * q(bas, 0.9), max_cm: 100 * pire, min_cm: 100 * enfonce, ou: pireOu, autre_moy_cm: 100 * moy(haut), autre_p90_cm: 100 * q(haut, 0.9) };
  verifier('Gardien : pieds au sol hors plongeon (vrai corps de la page)', bas.length > 2000 && pire <= 0.02 && enfonce >= -0.02,
    `${bas.length} images ; semelle la plus basse : moyenne ${f1(100 * moy(bas))} cm, 90e centile ${f1(100 * q(bas, 0.9))} cm, au plus ${f1(100 * pire)} cm (${pireOu}), au moins ${f1(100 * enfonce)} cm (2 cm au plus, ni enfoncée de plus de 2 cm) ; l'autre pied : moyenne ${f1(100 * moy(haut))} cm, 90e centile ${f1(100 * q(haut, 0.9))} cm ; par geste (moyenne/max, cm) : ${pg}`);
  const T = tirsGardien();
  const pct = (a: number, b: number) => (b ? (100 * a) / b : 0);
  RES.gardienTirs = { ...T, ecartMains: undefined, ecartMains_med_m: q(T.ecartMains, 0.5) };
  verifier('Gardien : il plonge du bon côté', T.cotesMesures >= 40 && T.bonCote / T.cotesMesures >= 0.95,
    `${T.bonCote}/${T.cotesMesures} plongeons (balle à plus de 0,3 m de lui) avec les mains du côté de la balle (${f1(pct(T.bonCote, T.cotesMesures))} % ; ${T.parCote.gauche} à sa gauche, ${T.parCote.droite} à sa droite) ; mains à ${f2(q(T.ecartMains, 0.5))} m du point de passage (médiane) à l'image visée`);
  verifier('Gardien : il réagit et arrête (400 frappes)', T.cadres >= 200 && (T.plongeons + T.arretsDebout) / T.cadres >= 0.85 && T.arrets / T.cadres >= 0.35 && T.arrets / T.cadres <= 0.75,
    `${T.cadres} tirs cadrés : plongeons ${T.plongeons} (dont ${T.tard} tardifs), arrêts debout ${T.arretsDebout}, battu ${T.battus}, sans geste ${T.rien} (réagit sur ${f1(pct(T.plongeons + T.arretsDebout, T.cadres))} %) ; arrêts ${T.arrets}, buts ${T.buts} (${f1(pct(T.arrets, T.cadres))} % d'arrêts)`);
}

/** b) 400 frappes au but (les positions et les cibles de jeu-banc.ts) : réaction du gardien, côté du plongeon, arrêts. */
function tirsGardien() {
  const { LB, BUT_DL, BUT_H, BALLON } = Cst, R = BALLON.R;
  const { predire }: Any = Bal;
  const ps = [0.3, 0.45, 0.6, 0.75, 0.9], xs = [-1.3, -0.95, -0.6, -0.2, 0.2, 0.6, 0.95, 1.3], ys = [0.35, 1.3], x0s = [-3, -1.5, 0, 1.5, 3];
  let k = 0, cadres = 0, arrets = 0, buts = 0, plongeons = 0, bonCote = 0, cotesMesures = 0, arretsDebout = 0, battus = 0, rien = 0, tard = 0;
  const ecartMains: number[] = [];
  const parCote = { gauche: 0, droite: 0 };
  for (const p of ps) for (const x of xs) for (const y of ys) for (const x0 of x0s) {
    k++;
    const m: Any = creerMonde({ graine: k, humains: [true, false], aides: [0, 0], presents: [4, 5] });
    demarrer(m, { intro: false });
    const j = m.joueurs[4], g = m.joueurs[5];
    j.p.x = x0; j.p.z = -LB + 11.6; j.cap = Math.PI;
    const b = m.balle; b.p.x = x0; b.p.z = -LB + 11; b.v.x = 0; b.v.z = 0; b.possesseur = 4; b.dernier = 4; b.dernierT = 0;
    g.p.x = x0 * 0.12; g.p.z = -LB + 1; g.cap = 0;
    m.controle[0] = 4;
    for (let i = 0; i < 30; i++) pas(m, [{ dx: 0, dz: 0, allure: 0 }, null]);
    (Gst as Any).demanderFrappe(m, j, { type: 'frappe', p, x, y });
    let issue = '', cadree: boolean | null = null, xg0 = g.p.x, passage: Any = null, reac = '', mesure = false, plongeT = 0;
    for (let i = 0; i < 360 && issue !== 'but' && issue !== 'dehors'; i++) {
      pas(m, [{ dx: 0, dz: 0, allure: 0 }, null]);
      for (const e of m.evts) {
        if (e.type === 'frappe' && cadree == null) {
          const r = predire(m.balle, (q: Any) => q.p.z <= -LB, 2);
          cadree = !!r && Math.abs(r.p.x) < BUT_DL - R && r.p.y < BUT_H - R;
          issue = cadree ? 'attente' : 'dehors';
          passage = r ? { x: r.p.x, y: r.p.y, t: m.t + r.t } : null; xg0 = g.p.x;
        }
        if ((issue === 'attente' || issue === 'touche') && e.type === 'but') issue = 'but';
        if (issue === 'attente' && (e.type === 'parade' || e.type === 'capte')) issue = 'touche';
        if (e.j === g.i && !reac && ['plongeon', 'arret', 'battu'].includes(e.type)) { reac = e.type; if (e.type === 'plongeon') { plongeT = m.t; if (e.tard) tard++; } }
      }
      m.evts.length = 0;
      // le côté du plongeon : où sont les mains à l'image visée (la balle n'est pas encore prise)
      const gg = g.g;
      if (!mesure && gg?.type === 'plongeon' && gg.t >= gg.donnees.tVise && passage) {
        mesure = true;
        const h = mainsMonde(g, { x: 0, y: 0, z: 0 });
        const lat = passage.x - xg0;
        if (Math.abs(lat) > 0.3) { cotesMesures++; if (Math.sign(h.x - xg0) === Math.sign(lat)) bonCote++; parCote[lat > 0 ? 'gauche' : 'droite']++; }
        ecartMains.push(Math.hypot(h.x - passage.x, h.y - passage.y));
      }
    }
    if (!cadree || (issue !== 'but' && issue !== 'touche')) continue;
    cadres++;
    if (issue === 'touche') arrets++; else buts++;
    if (reac === 'plongeon') plongeons++; else if (reac === 'arret') arretsDebout++; else if (reac === 'battu') battus++; else rien++;
    void plongeT;
  }
  return { cadres, arrets, buts, plongeons, arretsDebout, battus, rien, tard, bonCote, cotesMesures, parCote, ecartMains };
}

// ─────────────────────────── 3. les tacles (point 15) ───────────────────────────
/**
 * Un tacle glissé du Noir n° 4 sur le Blanc n° 6 qui court balle au pied (les deux joués par des intentions fixes) :
 * angle : 'face' | 'cote' | 'derriere' ; vp : la vitesse du porteur ; dBalle : la balle devant son pied (m, null : au
 * pied, aimantée) ; recul : la distance du tacleur au porteur au moment du tacle ; vt : la course du tacleur.
 */
function sceneTacle({ angle, vp = 4, dBalle = null as number | null, recul = 2.6, vt = 5, dx = 0, sansPorteur = false }: Any) {
  const M: Any = creerMonde({ graine: 90, humains: [true, true], aides: [0, 0], presents: [0, 2, 4, 5, 6] });
  demarrer(M, { intro: false });
  M.controleFixe = [4, 6];
  const t = M.joueurs[4], p = M.joueurs[6];
  // le porteur court vers −z
  poser(p, dx, 4, Math.PI, 0, -vp);
  if (sansPorteur) { p.p.x = 9; p.p.z = 10; p.v.z = 0; }
  const bz = dBalle == null ? 4 - 0.4 : 4 - dBalle;
  balleA(M, dx, 0.11, bz, 0, 0, sansPorteur ? 0 : -vp, sansPorteur ? null : 6);
  if (dBalle != null && !sansPorteur) M.balle.possesseur = null;
  // le tacleur : de face (devant le porteur, vers +z), de côté (à sa gauche, vers −x), par derrière (derrière lui, vers −z)
  if (angle === 'face') poser(t, dx + 0.15, 4 - recul, 0, 0, vt);
  else if (angle === 'cote') poser(t, dx + recul, 4 - 0.9 * vp * 0.3, -Math.PI / 2, -vt, 0);
  else poser(t, dx - 0.1, 4 + recul, Math.PI, 0, -vt);
  M.joueurs[2].p.x = dx - 1; M.joueurs[2].p.z = -6; // un coéquipier du tacleur, devant
  if (angle === 'face') { M.joueurs[2].p.x = dx + 1; M.joueurs[2].p.z = 10; }
  let fait = false;
  const evts: Any[] = [];
  let solDebut = -1, solFin = -1, x0 = 0, z0 = 0, dist = 0;
  for (let k = 0; k < 240; k++) {
    const a = !fait ? { type: 'tacle', glisse: true, commande: 'tacle' } : null;
    if (a) { fait = true; x0 = t.p.x; z0 = t.p.z; }
    const it = (dx2: number, dz2: number, al: number) => ({ dx: dx2, dz: dz2, allure: al, sprint: al > 0.9 ? 1 : 0, regard: M.balle.p });
    pas(M, [{ ...it(Math.sin(t.cap), Math.cos(t.cap), clamp01(vt / 7)), action: a }, it(0, -1, clamp01(vp / 7))]);
    for (const e of M.evts) evts.push({ ...e, t: M.t });
    M.evts.length = 0;
    if (t.mode === 'sol' && solDebut < 0) solDebut = M.t;
    if (solDebut >= 0 && solFin < 0 && t.mode === 'releve') solFin = M.t;
    if (t.g?.type === 'tacle') dist = Math.max(dist, Math.hypot(t.p.x - x0, t.p.z - z0));
    if (solFin >= 0 && M.t - solFin > 0.3) break;
  }
  // (l'issue : le premier contact — les jambes avant la balle, c'est fauché ; puis contrée ou prise)
  const premier = evts.find((e) => e.j === 4 && (e.type === 'tacleContre' || e.type === 'tacleBalle' || e.type === 'tacleJambes'));
  const issue = !premier ? 'rate' : premier.type === 'tacleJambes' ? 'fauche' : premier.type === 'tacleContre' ? 'contree' : 'prise';
  const faute = evts.some((e) => e.type === 'faute' && e.j === 4);
  const saut = evts.some((e) => e.type === 'saut' && e.j === 6);
  const chute = evts.some((e) => e.type === 'chute' && e.j === 6);
  const fin = evts.find((e) => e.type === 'tacleFin' && e.j === 4);
  const vers = evts.find((e) => e.type === 'tacleBalle' && e.j === 4)?.vers ?? null;
  return { issue, faute, saut, chute, rate: !!fin?.rate, sol: solFin >= 0 ? solFin - solDebut : NaN, dist, vers };
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Le porteur lancé (6 m/s vers −z, parti de z0) et une glissade de côté qui traverse sa course vers une balle devant lui. */
function sceneSaut(z0: number) {
  const M: Any = creerMonde({ graine: 91, humains: [true, true], aides: [0, 0], presents: [0, 4, 5, 6] });
  demarrer(M, { intro: false });
  M.controleFixe = [4, 6];
  const t = M.joueurs[4], p = M.joueurs[6];
  poser(p, 0, z0, Math.PI, 0, -6);
  balleA(M, 0, 0.11, 1.2, 0, 0, -0.5, null);
  poser(t, 2.4, 2.0, -Math.PI / 2, -4.5, 0);
  let fait = false;
  const evts: Any[] = [];
  for (let k = 0; k < 200; k++) {
    const a = !fait ? { type: 'tacle', glisse: true, commande: 'tacle' } : null; if (a) fait = true;
    pas(M, [{ dx: -1, dz: 0, allure: 0.7, sprint: 0, action: a, regard: M.balle.p }, { dx: 0, dz: -1, allure: 1, sprint: 1, regard: M.balle.p }]);
    for (const e of M.evts) evts.push(e);
    M.evts.length = 0;
  }
  return { saut: evts.some((e) => e.type === 'saut' && e.j === 6), issue: evts.some((e) => e.type === 'tacleJambes' && e.o === 6) ? 'fauche' : evts.some((e) => e.type === 'tacleBalle') ? 'prise' : 'rate' };
}
function bancTacles() {
  const lignes: string[] = [];
  const compte = (cas: Any[], f: (r: Any) => boolean) => cas.filter(f).length;
  // 1. de face, la balle au pied d'un porteur qui conduit (aimantée, ~0,4 m) : contrée
  const face = [-0.3, -0.15, 0, 0.15, 0.3].flatMap((dx) => [2.2, 2.6, 3].map((recul) => sceneTacle({ angle: 'face', vp: 3, recul, dx, vt: 4.5 })));
  // 2. de face ou de côté, la balle loin de son pied (touche longue, 1,3 m devant) : prise proprement
  const loin = [-0.2, 0, 0.2].flatMap((dx) => [2.2, 2.6].flatMap((recul) => [sceneTacle({ angle: 'face', vp: 4, dBalle: 1.3, recul: recul + 0.4, dx, vt: 4 }), sceneTacle({ angle: 'cote', vp: 3, dBalle: 1.3, recul, dx, vt: 4.5 })]));
  // 3. par derrière : les jambes d'abord, porteur fauché, faute
  const derriere = [-0.2, 0, 0.2].flatMap((dx) => [1.6, 2.0, 2.4].map((recul) => sceneTacle({ angle: 'derriere', vp: 3, recul, dx, vt: 6.5 })));
  const f = (t: Any[], k: string) => compte(t, (r) => r.issue === k);
  lignes.push(`de face, balle au pied : contrée ${f(face, 'contree')}/${face.length}, prise ${f(face, 'prise')}, fauché ${f(face, 'fauche')}, raté ${f(face, 'rate')}`);
  lignes.push(`balle loin du pied (de face et de côté) : prise ${f(loin, 'prise')}/${loin.length} (vers un coéquipier ${compte(loin, (r) => r.vers != null)}), contrée ${f(loin, 'contree')}, fauché ${f(loin, 'fauche')}, raté ${f(loin, 'rate')}`);
  lignes.push(`par derrière : fauché ${f(derriere, 'fauche')}/${derriere.length} (faute ${compte(derriere, (r) => r.faute)}, porteur à terre ${compte(derriere, (r) => r.chute)}), balle ${f(derriere, 'prise') + f(derriere, 'contree')}`);
  // 4. la portée selon la course (sans porteur) ; le raté laisse au sol un court instant ; le réussi se relève vite
  const portee = [0, 3, 5, 7.6].map((vt) => sceneTacle({ angle: 'face', vt, sansPorteur: true, recul: 9 }));
  lignes.push(`portée de la glissade : ${portee.map((r, i) => `${[0, 3, 5, 7.6][i]} m/s → ${f2(r.dist)} m`).join(', ')}`);
  const reussis = [...face, ...loin].filter((r) => r.issue === 'prise' || r.issue === 'contree');
  const rates = portee;
  const solR = reussis.map((r) => r.sol).filter(Number.isFinite), solM = rates.map((r) => r.sol).filter(Number.isFinite);
  const moy = (t: number[]) => t.reduce((a, b) => a + b, 0) / Math.max(1, t.length);
  lignes.push(`au sol avant le relevé : tacle réussi ${f2(moy(solR))} s, tacle raté ${f2(moy(solM))} s`);
  // 5. le porteur lancé saute par-dessus une glissade qui passe juste devant lui, la balle déjà jouée
  const sauts = [5, 5.5, 6, 6.5, 7, 7.5].map((z0) => sceneSaut(z0));
  lignes.push(`porteur lancé (6 m/s), glissade qui traverse sa course : sauts par-dessus ${compte(sauts, (r) => r.saut)}/${sauts.length}, issues ${sauts.map((r) => r.issue + (r.saut ? '+saut' : '')).join(', ')}`);
  RES.tacles = { face, loin, derriere, portee: portee.map((r) => r.dist), solReussi: moy(solR), solRate: moy(solM), sauts };
  const ok1 = f(face, 'contree') >= face.length * 0.6 && f(loin, 'prise') >= loin.length * 0.6 && f(derriere, 'fauche') >= derriere.length * 0.8 && compte(derriere, (r) => r.faute) >= derriere.length * 0.6;
  verifier('Tacles : trois issues selon l\'angle et la balle', ok1, lignes.slice(0, 3).join(' ; '));
  const d = RES.tacles.portee;
  const ok2 = d[0] < d[1] && d[1] < d[2] && d[2] < d[3] && d[3] > 2.5 && d[0] < 1.5 && moy(solM) >= moy(solR) + 0.3;
  verifier('Tacles : portée selon la course, raté au sol plus longtemps', ok2, lignes.slice(3, 5).join(' ; '));
  verifier('Tacles : le porteur saute par-dessus', compte(sauts, (r) => r.saut) >= 1, lignes[5]);
}

async function principal() {
  await MeshoptDecoder.ready;
  for (const n of ['player', 'player2', 'player3', 'keeper', 'keeper2', 'celeb', 'celeb2']) PAQ[n] = await paquet(n);

  if (faire('gestes')) {
    const G = scenesGestes();
    RES.gestes = G;
    console.log('commande            clip            élan (s)  clip avant contact  surface°  pied°  buste°  roulis°  suivi (m)');
    for (const [k, x] of Object.entries(G) as Array<[string, Any]>) console.log(process.env.BANC_DETAIL ? JSON.stringify([k, x.cmd, x.dg]) : '', `${k.padEnd(20)}${(x.clip || '—').padEnd(16)}${f2(x.elan).padStart(6)}  ${f2(x.elanClip).padStart(10)}       ${f1(x.yaw).padStart(7)}  ${f1(x.tangagePied).padStart(5)}  ${f1(x.buste).padStart(6)}  ${f1(x.roulis).padStart(6)}  ${f2(x.suivi).padStart(6)}`);
    verifier('Gestes : la balle libre prise sur ○ vient au pied (amorti)', /^(trap|receive|stall|knee|chest)/.test(G.prendre.clip ?? '') && G.prendre.elan != null && G.prendre.elan < 0.9, `clip ${G.prendre.clip || 'aucun'}, balle au pied ${f2(G.prendre.elan)} s après l'appui`);
    const parties0 = Object.values(G).filter((x: Any) => x.id !== 'tacle' && x.id !== 'recuperer' && x.id !== 'prendre' && !x.part).map((x: Any) => `${x.id}${x.course ? ' (course)' : ''}`);
    verifier('Gestes : chaque commande part et touche la balle', !parties0.length, parties0.length ? `sans contact : ${parties0.join(', ')}` : `${Object.keys(G).length} gestes (arrêté et en course), contact relevé pour chacun`);
    const manquent: string[] = [], lignes: string[] = [];
    for (const course of [false, true]) for (const [a, b] of PAIRES) {
      const A = G[`${a}${course && G[`${a}:course`] ? ':course' : ''}`], B = G[`${b}${course && G[`${b}:course`] ? ':course' : ''}`];
      if (!A || !B) continue;
      if (course && (a === 'tacle' || a === 'acrobatique' || b === 'acrobatique')) continue;
      const d = ecarts(A, B);
      const ok = d.includes('clip') ? d.length >= 2 || ['surface', 'pied', 'buste'].some((x) => d.includes(x)) || d.includes('clip') : d.length >= 2;
      lignes.push(`${a}/${b}${course ? ' en course' : ''} : ${d.join('+') || 'rien'}`);
      if (!ok) manquent.push(`${a}/${b}${course ? ' (course)' : ''}`);
    }
    verifier('Gestes : une animation distincte par commande', !manquent.length, `${lignes.length} paires ; ${manquent.length ? 'TROP PROCHES : ' + manquent.join(', ') : 'toutes distinctes (clip, ou deux traits au moins)'} ; ${lignes.join(' ; ')}`);
  }

  if (faire('gardien')) await bancGardien();
  if (faire('tacles')) bancTacles();

  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(RES, null, 1));
  console.log(`\n${echecs ? `${echecs} critère(s) manqué(s)` : 'banc des gestes : tout est vert'} (${resume.length} contrôles)`);
  process.exit(echecs ? 1 : 0);
}
void mainsMonde; void pas; void Cst; void chargerFootballeur; void persoReel;
principal();
