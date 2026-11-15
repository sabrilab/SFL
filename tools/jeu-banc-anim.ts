// Le banc d'animation du jeu Bola (bola-app#26), sans navigateur : le graphe d'animation (src/lib/jeu/rendu/graphe.js)
// et l'animateur (rendu/animateur.js) appliqués aux clips des paquets .pak (débrouillés en mémoire, jamais écrits),
// sur le squelette canonique des paquets mis à la taille du jeu (hanche à 0,957 m), pendant des matchs IA contre IA
// et des scènes jouées par un « humain » (gestes techniques, tacles, chutes). Même état d'animation que la page
// (rendu/etat.js), même pas de temps (images de 1/60 s, deux pas de simulation chacune).
//
// Contrôles (code de sortie 1 si l'un manque) ; les seuils sont ceux mesurés à la construction, un peu au-dessus :
//   · chaque état du graphe, chaque clip ajouté au lot 1 (ATTENDUS) et chaque couche procédurale (passement,
//     talonnade, sombrero) est atteint, en matchs IA et dans des scènes jouées (gestes, tacle, chutes, gardien) ;
//   · pieds tenus : vitesse au sol d'un pied verrouillé, médiane ≤ 3 cm/s, 90e centile ≤ 30 cm/s (les cycles de
//     course n'ont pas la foulée de la simulation à toutes les vitesses : la correction est plafonnée à 22 cm) ;
//   · fondus sans saut de pose : pendant qu'une couche entre ou sort, au plus 0,4 % des images où un os tourne de plus
//     de 40° en 1/60 s, aucune au-delà de 90° ;
//   · sortie d'un geste vers la course sur un appui (le pied qui porte est en appui dans le cycle) : 75 % au moins ;
//   · le coup reçu se voit (couche additive), le bassin descend sans dépasser 6 cm.
//   npx tsx tools/jeu-banc-anim.ts           tout (≈ 1 min)
//   npx tsx tools/jeu-banc-anim.ts --vite    2 matchs au lieu de 4
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as Pak from '../src/lib/jeu/pakcodec.js';
import * as Lib from '../src/lib/jeu/library.js';
import * as Clp from '../src/lib/jeu/sim/clips.js';
import * as Mon from '../src/lib/jeu/sim/monde.js';
import * as Gst from '../src/lib/jeu/sim/gestes.js';
import * as Ani from '../src/lib/jeu/rendu/animateur.js';
import * as Eta from '../src/lib/jeu/rendu/etat.js';
import * as Bcl from '../src/lib/jeu/sim/boucle.js';
import * as Crp0 from '../src/lib/jeu/sim/corps.js';
import * as Cst0 from '../src/lib/jeu/sim/constantes.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const { unpak }: Any = Pak;
const { makeRig, bindClip, boneKey }: Any = Lib;
const { chargerMesures }: Any = Clp;
const { creerMonde, demarrer }: Any = Mon;
const { porteur, rouler }: Any = Gst;
const GstA: Any = Gst;
const { creerAnimateur }: Any = Ani;
const { etatAnim }: Any = Eta;
const { creerBoucle, avancer, joueurInterpole, balleInterpolee }: Any = Bcl;
const Crp: Any = Crp0, Cst: Any = Cst0;

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const vite = process.argv.includes('--vite');
chargerMesures(fs.readFileSync(path.join(RACINE, 'public/jeu/anims/mesures.pak')));
const avert = console.warn; console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith('THREE.')) avert(...a); };

const resume: string[] = [];
let echecs = 0;
function verifier(nom: string, ok: boolean, detail: string) {
  const l = `${ok ? 'ok   ' : 'ÉCHEC'} ${nom} : ${detail}`;
  console.log(l); resume.push(l); if (!ok) echecs++;
}
const quantile = (t: number[], q: number) => { const s = [...t].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; };

async function principal() {
// ── les paquets ──
await MeshoptDecoder.ready;
async function paquet(nom: string) {
  const glb = unpak(new Uint8Array(fs.readFileSync(path.join(RACINE, `public/jeu/anims/${nom}.pak`))), nom);
  const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
  g.scene.updateMatrixWorld(true);
  const index = JSON.parse(fs.readFileSync(path.join(RACINE, 'public/jeu/anims/index.json'), 'utf8'))[nom] ?? {};
  for (const c of g.animations) c.userData = { ...(index[c.name] ?? {}), pack: nom };
  return { scene: g.scene, rig: makeRig(g.scene, false), clips: g.animations };
}
const PAQ: Record<string, Any> = {};
for (const n of ['player', 'player2', 'keeper', 'keeper2', 'celeb', 'celeb2']) PAQ[n] = await paquet(n);

/** Un joueur sans maillage : le squelette canonique, à la taille du jeu, avec les clips de ses paquets. */
function creerPerso(gardien: boolean) {
  const corps = PAQ.player.scene.clone(true);
  corps.scale.setScalar(Clp.HANCHE);
  const racine = new THREE.Group(); racine.add(corps); racine.updateMatrixWorld(true);
  const rig = makeRig(corps, false);
  const mixer = new THREE.AnimationMixer(corps);
  const actions: Record<string, Any> = {};
  for (const p of gardien ? ['keeper', 'keeper2', 'celeb', 'celeb2'] : ['player', 'player2', 'celeb', 'celeb2']) {
    for (const c of PAQ[p].clips) {
      const b = bindClip(c, PAQ[p].rig, rig);
      const a = mixer.clipAction(b);
      if (!b.userData.loop) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      actions[c.name] = a;
    }
  }
  const os: Record<string, Any> = {};
  for (const [k, b] of rig.bones) os[k] = b.obj;
  return { racine, corps, rig, os, actions, mixer };
}

// ── la mesure ──
const ATTENDUS_ETATS = ['loco', 'depart', 'arret', 'demitour', 'geste', 'chute', 'tacle', 'releve', 'pivot', 'fete', 'gardien'];
// (« a|b » : l'un ou l'autre côté suffit)
const ATTENDUS_CLIPS = ['slide', 'getup_dos', 'getup_ventre', 'trap', 'trap_l', 'stall|stall_l', 'knee|knee_l', 'head_std', 'stagger', 'fall_side', 'fall_back', 'fall_sweep', 'fall_trip',
  'start', 'stop', 'turn180_std|turn180_std_l', 'feint_r', 'feint_l', 'kickup|kickup_l', 'k_catch_std', 'k_high', 'k_low_l|k_low_r', 'k_roll', 'c_thumbs', 'shoot2|shoot2_l', 'volley|header2|head_std'];
const vus = new Set<string>(), clipsVus = new Set<string>(), figuresVues = new Set<string>();
const glisse: number[] = [];       // vitesse au sol d'un pied tenu (m/s)
const glisseParEtat: Record<string, number[]> = {};
let sauts = 0, sautMax = 0, sautOu = '', imagesMesurees = 0;
let sorties = 0, sortiesAppui = 0, cocs = 0, bassinMax = 0;
const SAUT_MAX = 40 * Math.PI / 180; // en 1/60 s
const detailSorties: Record<string, number> = {};

function suivre(M: Any, nom: string, duree: number, entrees: ((m: Any) => Any) | null) {
  const persos = M.joueurs.map((j: Any) => creerPerso(j.gardien));
  const anims = persos.map((p: Any, i: number) => creerAnimateur(p, { gardien: M.joueurs[i].gardien, versMonde3: (v: Any, out: Any) => out.set(v.x, v.y ?? 0, v.z) }));
  const caches = M.joueurs.map(() => ({}));
  const interp = M.joueurs.map(() => ({ x: 0, z: 0, cap: 0 }));
  const prec = M.joueurs.map(() => ({ x: 0, z: 0 }));
  const bc = creerBoucle(M);
  const bI = { x: 0, y: 0, z: 0 };
  const piedsPrec = M.joueurs.map(() => [new THREE.Vector3(), new THREE.Vector3()]);
  const tenusPrec = M.joueurs.map(() => [false, false]);
  const qPrec = M.joueurs.map(() => new Map<string, THREE.Quaternion>());
  const sortiePrec = M.joueurs.map(() => null as Any);
  const w = new THREE.Vector3(), q = new THREE.Quaternion();
  const dt = 1 / 60;
  for (let k = 0; k < duree * 60; k++) {
    avancer(bc, dt, entrees ? () => entrees(M) : null, 1, () => { if (process.env.BANC_SCENES && entrees) for (const ev of M.evts) if (!['controle', 'touche'].includes(ev.type)) console.log('  ev', nom, ev.type, JSON.stringify(ev).slice(0, 120)); M.evts.length = 0; });
    const p = porteur(M);
    balleInterpolee(bc, bI);
    for (let i = 0; i < M.joueurs.length; i++) {
      const j = M.joueurs[i]; if (j.absent) continue;
      const I = interp[i];
      joueurInterpole(bc, i, I);
      const saut = Math.hypot(I.x - prec[i].x, I.z - prec[i].z) > 0.8;
      prec[i].x = I.x; prec[i].z = I.z;
      const P = persos[i], A = anims[i];
      P.racine.position.set(I.x, 0, I.z); P.racine.rotation.y = I.cap;
      (caches[i] as Any).saut = saut;
      const e = etatAnim(M, j, I, p, bI, caches[i]);
      A.maj(e, dt);
      P.racine.updateMatrixWorld(true);
      vus.add(A.diag.etat);
      if (A.geste) clipsVus.add(A.geste);
      if (e.figure) figuresVues.add(e.figure.type);
      bassinMax = Math.max(bassinMax, A.diag.pose[0]);
      if (e.choc && e.choc.age < 0.02) { cocs++; }
      if (process.env.BANC_TRACE) { const [tn, ti, ta, tb] = process.env.BANC_TRACE.split(':'); if (tn === nom && +ti === i && M.t >= +ta && M.t <= +tb) { const nq = P.os.neck.quaternion; console.log('  trace', M.t.toFixed(3), A.diag.etat, 'tg', A.diag.tGraphe, A.diag.noms?.join('+'), 'neck', [nq.x, nq.y, nq.z, nq.w].map((x: number) => x.toFixed(2)).join(','), 'cap', I.cap.toFixed(2), 'v', Math.hypot(j.v.x, j.v.z).toFixed(2), 'mode', j.mode); } }
      // les pieds tenus : leur vitesse au sol
      for (let f = 0; f < 2; f++) {
        const os = f ? P.os.rightfoot : P.os.leftfoot;
        os.getWorldPosition(w);
        if (A.diag.tenus[f] && tenusPrec[i][f] && !saut) { const v = Math.hypot(w.x - piedsPrec[i][f].x, w.z - piedsPrec[i][f].z) / dt; glisse.push(v); const k = A.diag.etat + (A.diag.lent ? ':lent' : ':' + A.diag.dom + ':' + Math.round(Math.hypot(j.v.x, j.v.z))); (glisseParEtat[k] ??= []).push(v); }
        piedsPrec[i][f].copy(w); tenusPrec[i][f] = A.diag.tenus[f];
      }
      // les sauts de pose : la rotation locale de chaque os d'une image à l'autre (hors racine et hanches, que la
      // simulation déplace), seulement quand une couche entre ou sort (un fondu) et hors racine qui saute
      const fondu = A.diag.enFondu;
      let pire = 0, osPire = '';
      for (const [kb, b] of P.rig.bones as Map<string, Any>) {
        if (kb === 'root' || kb === 'hips') continue;
        const o = b.obj, qp = qPrec[i].get(kb);
        q.copy(o.quaternion);
        if (qp) { const a = 2 * Math.acos(Math.min(1, Math.abs(qp.dot(q)))); if (a > pire) { pire = a; osPire = kb; } qp.copy(q); }
        else qPrec[i].set(kb, q.clone());
      }
      if (fondu && !saut && !e.saut) {
        imagesMesurees++;
        if (pire > sautMax) { sautMax = pire; sautOu = `${nom} j${i} ${osPire} ${A.diag.etat}/${A.geste ?? '-'} t=${M.t.toFixed(2)}`; }
        if (pire > SAUT_MAX) { sauts++; if (process.env.BANC_DETAIL) console.log('  saut', (pire * 180 / Math.PI).toFixed(0), nom, 'j' + i, osPire, A.diag.etat, A.geste ?? '-', 'couches', A.diag.noms?.join('+'), 't', M.t.toFixed(2)); }
      }
      // la sortie d'un geste : à la fin de son fondu, le pied qui porte est-il en appui dans le cycle ?
      const S = A.diag.sortie;
      if (S && S !== sortiePrec[i] && S.pied >= 0) sortiePrec[i] = S;
      const SP = sortiePrec[i];
      if (SP && SP.reste <= 0 && !SP.compte) { SP.compte = true; sorties++; const ok = A.diag.appuiLoco[SP.pied]; if (ok) sortiesAppui++; const k = `${SP.trouve ? 'trouve' : 'non'}:${ok ? 'ok' : 'rate'}:${SP.cycle}>${A.diag.dom}`; detailSorties[k] = (detailSorties[k] ?? 0) + 1; }
    }
    if (M.phase === 'fin') break;
  }
  void boneKey;
}

// 1) des matchs IA contre IA
for (let g = 1; g <= (vite ? 2 : 4); g++) {
  const M: Any = creerMonde({ graine: 30 + g, duree: 60, humains: [false, false], aides: [0, 0] });
  demarrer(M, { intro: false });
  suivre(M, `match${g}`, 75, null);
}
// 2) les scènes : un humain joue les gestes techniques et les tacles (le n° 4 Noir contre le n° 6 Blanc)
function scene(nom: string, actions: Array<[number, Any]>, prep: (M: Any) => void, duree = 3) {
  const M: Any = creerMonde({ graine: 77, humains: [true, false], aides: [0.5, 0], presents: [0, 4, 5, 6] });
  demarrer(M, { intro: false });
  prep(M);
  M.controleFixe = [4, null];
  const t0 = M.t;
  suivre(M, nom, duree, (m: Any) => {
    const t = m.t - t0;
    let action = null;
    for (const a of actions) if (!a[1]._fait && t >= a[0]) { a[1]._fait = true; action = { ...a[1] }; delete action._fait; }
    return [{ dx: 0, dz: -1, allure: m.joueurs[4].mode === 'loco' ? 0.6 : 0, sprint: 0, action, regard: m.balle.p }, null];
  });
}
const poser = (j: Any, x: number, z: number, cap: number, vz = 0) => { j.p.x = x; j.p.z = z; j.cap = cap; j.v.x = 0; j.v.z = vz; };
const balleA = (M: Any, x: number, z: number, vz: number, poss: number | null) => { const b = M.balle; b.p.x = x; b.p.y = 0.11; b.p.z = z; b.v.x = 0; b.v.y = 0; b.v.z = vz; rouler(b); b.possesseur = poss; b.dernier = poss; b.dernierT = M.t; };
for (const [nom, act] of [['feinte', { type: 'feinte', dx: 1, dz: 0 }], ['feinte2', { type: 'feinte', dx: -1, dz: 0 }], ['passement', { type: 'passement', dx: 1, dz: 0 }],
  ['talon', { type: 'talonnade' }], ['sombrero', { type: 'sombrero' }], ['sombrero2', { type: 'sombrero' }], ['petitpont', { type: 'petitPont' }]] as Array<[string, Any]>) {
  scene(nom, [[0.15, act]], (M) => {
    const lent = nom === 'feinte' || nom === 'feinte2' || nom === 'sombrero';
    poser(M.joueurs[4], 0, 4, Math.PI, lent ? 0 : -3); balleA(M, 0, 3.6, lent ? 0 : -3.2, 4);
    poser(M.joueurs[6], 0, nom === 'petitpont' ? 2.6 : 2.2, 0);
  }, 2.5);
}
// un amorti de la poitrine et une tête debout : la balle arrive en l'air vers un joueur arrêté
const loin = (M: Any) => poser(M.joueurs[6], 6, 12, 0);
scene('poitrine', [], (M) => { loin(M); poser(M.joueurs[4], 0, 0, Math.PI); const b = M.balle; b.p.x = 0; b.p.y = 1.25; b.p.z = -6; b.v.x = 0; b.v.y = 2; b.v.z = 8; b.possesseur = null; b.dernier = 6; b.dernierT = M.t - 1; b.recepteur = 4; }, 2.5);
scene('tete', [], (M) => { loin(M); poser(M.joueurs[4], 0, 0, Math.PI); const b = M.balle; b.p.x = 0; b.p.y = 1.5; b.p.z = -5; b.v.x = 0; b.v.y = 3.0; b.v.z = 7; b.possesseur = null; b.dernier = 6; b.dernierT = M.t - 1; b.recepteur = 4; }, 2.5);
// une volée : balle aérienne devant le joueur, frappe demandée
scene('volee', [[0.05, { type: 'frappe', p: 0.7, x: 0.5, y: 1 }]], (M) => { loin(M); poser(M.joueurs[4], 0, -2, Math.PI); const b = M.balle; b.p.x = 0.1; b.p.y = 1.7; b.p.z = -3.3; b.v.x = 0; b.v.y = 0.8; b.v.z = 2.5; b.possesseur = 4; b.dernier = 4; b.dernierT = M.t; }, 2.5);
// un tacle glissé humain sur le porteur adverse (les Blancs ont la balle)
scene('tacle', [[0.35, { type: 'tacle', glisse: true }]], (M) => { poser(M.joueurs[4], 0, 1, 0, 0); poser(M.joueurs[6], 0, 5, Math.PI, -3); balleA(M, 0, 4.4, -3.5, 6); }, 4);
// les chutes, chacune, et son relevé
for (const genre of ['avant', 'cote', 'arriere', 'balaye', 'croc']) scene('chute-' + genre, [], (M) => { loin(M); poser(M.joueurs[4], 0, 4, Math.PI, -4); Crp.tomber(M.joueurs[4], genre); }, 4);
// le gardien : une frappe basse sur le côté, une à hauteur de poitrine dans l'axe, une haute dans l'axe ; une relance courte
for (const [nom, x, y] of [['g-bas', 1.5, 0.2], ['g-bas2', -1.6, 0.25], ['g-face', 0.1, 1.2], ['g-haut', 0.1, 1.85]] as Array<[string, number, number]>) {
  const M: Any = creerMonde({ graine: 5, humains: [true, false], aides: [0, 0], presents: [4, 5] });
  demarrer(M, { intro: false });
  const j = M.joueurs[4], g = M.joueurs[5];
  const loinB = nom.startsWith('g-bas') ? 13 : 9;
  poser(j, 0, -Cst.LB + loinB + 0.6, Math.PI); balleA(M, 0, -Cst.LB + loinB, 0, 4); poser(g, 0, -Cst.LB + 1, 0);
  M.controle[0] = 4;
  GstA.demanderFrappe(M, j, { type: 'frappe', p: nom.startsWith('g-bas') ? 0.3 : 0.45, x, y });
  suivre(M, nom, 3, () => [{ dx: 0, dz: 0, allure: 0 }, null]);
}
{
  const M: Any = creerMonde({ graine: 6, humains: [false, false], aides: [0, 0], presents: [0, 1] });
  demarrer(M, { intro: false });
  const k = M.joueurs[0], c = M.joueurs[1];
  poser(c, 0, Cst.LB - 6, Math.PI); poser(k, 0, Cst.LB - 0.8, Math.PI);
  const b = M.balle; b.garde = 0; b.possesseur = null; b.dernier = 0; b.dernierT = M.t;
  k.attente = 0.2;
  suivre(M, 'relance', 3, null);
}

const manquent = ATTENDUS_ETATS.filter((x) => !vus.has(x));
const clipsManquent = ATTENDUS_CLIPS.filter((x) => !x.split('|').some((y) => clipsVus.has(y)));
const figuresManquent = ['passement', 'talon', 'sombrero'].filter((x) => !figuresVues.has(x));
verifier('États et clips atteints', !manquent.length && !clipsManquent.length && !figuresManquent.length,
  `états ${[...vus].sort().join(', ')}${manquent.length ? ' ; MANQUENT ' + manquent.join(', ') : ''} ; ${clipsVus.size} clips joués${clipsManquent.length ? ' ; clips jamais joués : ' + clipsManquent.join(', ') : ''} ; couches procédurales ${[...figuresVues].join(', ')}${figuresManquent.length ? ' ; MANQUENT ' + figuresManquent.join(', ') : ''}`);
if (process.env.BANC_DETAIL) console.log('  sorties', JSON.stringify(detailSorties));
  if (process.env.BANC_DETAIL) for (const [k, t] of Object.entries(glisseParEtat)) console.log('  glisse', k, t.length, (quantile(t, 0.5) * 100).toFixed(1), (quantile(t, 0.9) * 100).toFixed(1));
  const p50 = quantile(glisse, 0.5), p90 = quantile(glisse, 0.9), p99 = quantile(glisse, 0.99);
verifier('Pieds tenus au sol', glisse.length > 5000 && p50 <= 0.03 && p90 <= 0.3, `${glisse.length} images de pied tenu ; glissement médian ${(p50 * 100).toFixed(1)} cm/s, 90e centile ${(p90 * 100).toFixed(1)} cm/s, 99e ${(p99 * 100).toFixed(0)} cm/s`);
verifier('Fondus sans saut de pose', imagesMesurees > 2000 && sauts <= imagesMesurees * 0.004 && sautMax < 90 * Math.PI / 180, `${imagesMesurees} images en fondu ; ${sauts} au-delà de 40° par os en 1/60 s (0,4 % au plus, aucune au-delà de 90°) ; pire ${(sautMax * 180 / Math.PI).toFixed(0)}° (${sautOu})`);
verifier('Sortie des gestes sur un appui', sorties >= 30 && sortiesAppui / sorties >= 0.75, `${sortiesAppui}/${sorties} sorties vers la course finissent pied d'appui posé`);
verifier('Coups reçus et bassin', cocs > 5 && bassinMax <= 0.06 + 1e-6, `${cocs} chocs joués en couche additive ; bassin descendu de ${(bassinMax * 100).toFixed(1)} cm au plus (6 au plus)`);

console.log(`\n${echecs ? `${echecs} critère(s) manqué(s)` : "banc d'animation : tout est vert"} (${resume.length} contrôles)`);
process.exit(echecs ? 1 : 0);
}
principal();
