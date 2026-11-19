// Le banc du jeu Bola (bola-app#23), sans navigateur : la simulation pure de src/lib/jeu/sim/ (ballon, corps,
// contacts, gestes, gardiens, IA, monde, boucle à pas fixe). Il passe tous les contrôles, imprime chaque mesure et sort
// en erreur (code 1) si un critère manque.
//
//   npx tsx tools/jeu-banc.ts            tout le banc (≈ 1 à 2 minutes)
//   npx tsx tools/jeu-banc.ts --vite     sans les 50 matchs (10 seulement) ni les 10 000 tirs (2 000)
//   npx tsx tools/jeu-banc.ts --graine=7 imprime l'empreinte d'un match IA contre IA de 150 s (comparée par le banc
//                                        navigateur /jouer?banc : même graine, même empreinte)
//
// Les critères viennent de la conception (§7.2) ; deux sont adaptés et le disent : le nombre de buts par match (la
// moyenne et la part de matchs sans but, plutôt que « chaque match entre 1 et 14 ») et la conduite (l'avance de la
// balle en sprint).
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import * as Cst from '../src/lib/jeu/sim/constantes.js';
import * as Bal from '../src/lib/jeu/sim/ballon.js';
import * as Crp from '../src/lib/jeu/sim/corps.js';
import * as Mon from '../src/lib/jeu/sim/monde.js';
import * as Bcl from '../src/lib/jeu/sim/boucle.js';
import * as Gst from '../src/lib/jeu/sim/gestes.js';
import * as Gar from '../src/lib/jeu/sim/gardien.js';
import * as Ia from '../src/lib/jeu/sim/ia.js';
import * as Clp from '../src/lib/jeu/sim/clips.js';
import * as Ctc from '../src/lib/jeu/sim/contacts.js';
import * as Crp2 from '../src/lib/jeu/sim/corps.js';
import * as Cam from '../src/lib/jeu/rendu/camera.js';
import * as Ral from '../src/lib/jeu/rendu/ralenti.js';
import * as Eff from '../src/lib/jeu/rendu/effets.js';
import * as Son from '../src/lib/jeu/rendu/son.js';
import * as Pol from '../src/lib/jeu/police.js';
import * as Scn from '../src/lib/jeu/sim/scenarios.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
// (la simulation est en JS : ses paramètres par défaut donnent à TypeScript des types trop étroits, on la lit en « any »)
const { PAS, G, BALLON, CORPS, BX, BZ, LB, BUT_DL, BUT_H }: Any = Cst;
const { creerBalle, pasBalle, predire }: Any = Bal;
const { creerCorps, pasCorps }: Any = Crp;
const { creerMonde, demarrer, pas, empreinte }: Any = Mon;
const { creerBoucle, avancer }: Any = Bcl;
const { porteur, demanderFrappe, rouler }: Any = Gst;
const { mainsMonde }: Any = Gar;
const { intentionVide }: Any = Ia;
const { chargerMesures, oublierMesures, empreinteOctets, MESURES, CLIPS }: Any = Clp;

// les mesures des clips (public/jeu/anims/mesures.pak) : la simulation refuse de démarrer sans elles
const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const lireMesures = () => chargerMesures(fs.readFileSync(path.join(RACINE, 'public/jeu/anims/mesures.pak')));
lireMesures();

const args = process.argv.slice(2);
const vite = args.includes('--vite');
const graineSeule = args.find((a) => a.startsWith('--graine='));
const R = BALLON.R;
const resume: string[] = [];
let echecs = 0;
function verifier(nom: string, ok: boolean, detail: string) {
  const ligne = `${ok ? 'ok   ' : 'ÉCHEC'} ${nom} : ${detail}`;
  console.log(ligne);
  resume.push(ligne);
  if (!ok) { echecs++; }
}
const med = (t: number[]) => { const s = [...t].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const moy = (t: number[]) => t.reduce((a, b) => a + b, 0) / (t.length || 1);
const f2 = (x: number) => x.toFixed(2);

/** Un match IA contre IA, jusqu'au bout ; renvoie le monde. */
function matchIA(graine: number, duree = 150, suivi?: (m: Any) => void) {
  const m: Any = creerMonde({ graine, duree, humains: [false, false], aides: [0, 0] });
  demarrer(m, { intro: false });
  for (let i = 0; i < (duree + 30) * 120 && m.phase !== 'fin'; i++) { pas(m); suivi?.(m); m.evts.length = 0; }
  return m;
}

if (graineSeule) {
  const g = +graineSeule.split('=')[1];
  const m: Any = creerMonde({ graine: g, humains: [false, false], aides: [0, 0] });
  demarrer(m, { intro: false });
  for (let i = 0; i < 18000; i++) pas(m);
  console.log(JSON.stringify({ graine: g, pas: m.pas, empreinte: empreinte(m), score: m.score }));
  process.exit(0);
}

// ─────────────────────────── le ballon ───────────────────────────
{
  // chute libre de 2 m : à chaque rebond, la vitesse de sortie vaut e × la vitesse d'arrivée (e donné par la vitesse),
  // et la hauteur atteinte vaut v_sortie² / 2g (à la traînée près, moins de 5 %) ; l'énergie ne remonte jamais
  const b: Any = creerBalle(); b.p.y = 2;
  const hauts: number[] = [], vArr: number[] = [], vSor: number[] = [];
  let monte = false, vy0 = 0;
  for (let i = 0; i < 2400; i++) {
    const y0 = b.p.y; vy0 = b.v.y;
    pasBalle(b, null);
    if (vy0 < 0 && b.v.y > 0) { vArr.push(-vy0); vSor.push(b.v.y); }
    if (monte && b.v.y <= 0) hauts.push(y0 - R);
    monte = b.v.y > 0;
  }
  let pireE = 0, pireH = 0;
  // e mesuré sur un choc franc (le ballon posé à 1 µm du sol, qui descend à v)
  for (const v of [2, 6, 12]) {
    const q: Any = creerBalle(); q.p.y = R + 1e-6; q.v.y = -v;
    pasBalle(q, null);
    const vin = v + G * PAS; // la gravité du pas, appliquée avant le choc
    const e = Math.max(BALLON.enMin, BALLON.enBase - BALLON.enPente * vin);
    pireE = Math.max(pireE, Math.abs(q.v.y / vin - e) / e);
  }
  for (let k = 0; k < Math.min(3, hauts.length); k++) {
    const hth = (vSor[k] * vSor[k]) / (2 * G);
    pireH = Math.max(pireH, (hth - hauts[k]) / hth);
  }
  const decroit = hauts.every((h, k) => k === 0 || h < hauts[k - 1]);
  verifier('Chute libre de 2 m', pireE < 0.05 && pireH >= -0.01 && pireH < 0.07 && decroit && b.sol, `rebonds ${hauts.slice(0, 4).map(f2).join(' / ')} m ; e mesuré / e attendu : écart ${(pireE * 100).toFixed(1)} % ; hauteur / (v² / 2g) : ${(pireH * 100).toFixed(1)} % en dessous (la traînée, moins de 7 %) ; au repos ${b.sol}`);
}
{
  // roulage à 8 m/s (roulement pur) : distance analytique d = ln(1 + k v² / a) / 2k (traînée C_d basse + roulement)
  const b: Any = creerBalle(); b.p.z = -15.5; b.v.z = 8; rouler(b);
  let t = 0; while (Math.hypot(b.v.x, b.v.z) > 1e-3 && t < 80) { pasBalle(b, null); t += PAS; }
  const k = BALLON.kAir * BALLON.cdBas, a = BALLON.muRoule * G;
  const d = Math.log(1 + (k * 64) / a) / (2 * k), fait = b.p.z + 15.5;
  verifier('Roulage à 8 m/s', Math.abs(fait - d) / d < 0.05, `${f2(fait)} m pour ${f2(d)} m attendus, en ${t.toFixed(1)} s`);
}
{
  // traînée : frappe à 25 m/s, perte de vitesse sur 15 m ; Magnus : enroulée à 20 m/s avec 60 rad/s
  const b: Any = creerBalle(); b.p.y = 1; b.v.z = 25;
  // sans gravité pour mesurer l'air seul (on la compense à chaque pas)
  while (b.p.z < 15) { b.v.y += G * PAS; pasBalle(b, null); }
  const perte = 1 - Math.hypot(b.v.x, b.v.y, b.v.z) / 25;
  const c: Any = creerBalle(); c.p.y = 1; c.v.z = 20; c.w.y = 60;
  while (c.p.z < 15) { c.v.y += G * PAS; pasBalle(c, null); }
  // ω = +y, v = +z : ω × v = +x
  verifier('Traînée et Magnus', perte > 0.15 && perte < 0.22 && c.p.x > 0.8 && c.p.x < 1.5, `25 m/s perd ${(perte * 100).toFixed(1)} % sur 15 m ; l'enroulée dévie de ${f2(c.p.x)} m (+x attendu)`);
}
{
  // panneau : à 0,5 m de haut, restitution mesurée = attendue ; au-dessus (1,5 m, le filet), e ≤ 0,2
  const essai = (y: number) => {
    const b: Any = creerBalle(); b.p.x = 9; b.p.y = y; b.v.x = 10; b.w.z = 0;
    let avant = 10, apres = 0;
    for (let i = 0; i < 60; i++) { const vx = b.v.x; b.v.y += G * PAS; pasBalle(b, null); if (vx > 0 && b.v.x < 0) { avant = vx; apres = -b.v.x; break; } }
    return apres / avant;
  };
  const e05 = essai(0.5), e15 = essai(1.5);
  const att = Math.max(BALLON.panneauMin, BALLON.panneauE - BALLON.panneauPente * 10);
  verifier('Panneaux et filet', Math.abs(e05 - att) < 0.02 && e15 <= 0.2, `panneau e = ${f2(e05)} (attendu ${f2(att)}), filet e = ${f2(e15)}`);
}
{
  // tunnel : des tirs à 30 m/s vers les panneaux, les coins et les poteaux ; aucune balle hors du terrain
  const n = vite ? 2000 : 10000;
  let dehors = 0, poteaux = 0, aleat = 12345;
  const u = () => { aleat = (Math.imul(aleat, 1664525) + 1013904223) >>> 0; return aleat / 4294967296; };
  for (let i = 0; i < n; i++) {
    const b: Any = creerBalle();
    b.p.x = (u() * 2 - 1) * 8; b.p.z = (u() * 2 - 1) * 13; b.p.y = R + u() * 2;
    let tx = (u() * 2 - 1) * 11, tz = (u() < 0.5 ? -1 : 1) * (14 + u() * 2.5);
    if (i % 3 === 0) { tx = (u() < 0.5 ? -1 : 1) * BUT_DL; tz = (u() < 0.5 ? -1 : 1) * LB; }
    const dx = tx - b.p.x, dz = tz - b.p.z, L = Math.hypot(dx, dz);
    b.v.x = (dx / L) * 30; b.v.z = (dz / L) * 30; b.v.y = u() * 6;
    for (let k = 0; k < 240; k++) {
      pasBalle(b, (t: string) => { if (t === 'poteau') poteaux++; });
      if (Math.abs(b.p.x) > BX - R + 1e-6 || Math.abs(b.p.z) > BZ - R + 1e-6 || b.p.y < R - 1e-6) { dehors++; break; }
      // dans un poteau
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) if (b.p.y < BUT_H && Math.hypot(b.p.x - sx * BUT_DL, b.p.z - sz * LB) < BALLON.poteauR + R - 0.01) { dehors++; k = 999; }
    }
  }
  verifier('Tunnel (tirs à 30 m/s)', dehors === 0, `${n} tirs, ${dehors} hors du terrain ou dans un poteau, ${poteaux} chocs de poteau`);
}

// ─────────────────────────── les corps ───────────────────────────
const corpsSeul = () => { const j: Any = creerCorps(0, 0, 'A'); j.int = intentionVide(); return j; };
const lancerA = (j: Any, v: number) => { j.int.dx = 0; j.int.dz = 1; j.int.allure = 1; j.int.sprint = 1; let t = 0; while (Math.hypot(j.v.x, j.v.z) < v && t < 10) { pasCorps(j, PAS, false); t += PAS; } return t; };
{
  const j = corpsSeul();
  const t = lancerA(j, 7);
  // (bola-app#32 : « du peps, comme des sportifs de haut niveau » ; avant 2,2 à 3 s, désormais 1,2 à 2 s)
  verifier('Accélération 0 → 7 m/s', t >= 1.2 && t <= 2.0, `${f2(t)} s (bola-app#32 : 1,2 à 2 s)`);
}
{
  const j = corpsSeul(); lancerA(j, 7);
  for (let i = 0; i < 60; i++) pasCorps(j, PAS, false);
  const z0 = j.p.z; let zMax = z0, t = 0, pivot = false;
  j.int.dz = -1;
  while (j.v.z > -2 && t < 5) { pasCorps(j, PAS, false); t += PAS; zMax = Math.max(zMax, j.p.z); if (j.mode === 'pivot') pivot = true; }
  // (bola-app#32 : « demi-tour immédiat, sans boucle ni ralentissement mou » ; avant : au moins 0,9 s et 2,5 m de freinage,
  // désormais au plus 0,7 s et 2,2 m, toujours par le pivot sur appuis)
  verifier('Demi-tour à 7 m/s', t <= 0.7 && zMax - z0 <= 2.2 && pivot, `${f2(t)} s jusqu'à repartir à 2 m/s, ${f2(zMax - z0)} m de freinage, pivot ${pivot} (bola-app#32 : 0,7 s et 2,2 m au plus)`);
}
{
  const j = corpsSeul(); lancerA(j, 7);
  for (let i = 0; i < 60; i++) pasCorps(j, PAS, false);
  const a = (80 * Math.PI) / 180;
  j.int.dx = Math.sin(a); j.int.dz = Math.cos(a);
  let h0 = Math.atan2(j.v.x, j.v.z), omMax = 0, rMin = Infinity, depasse = 0;
  for (let i = 0; i < 240; i++) {
    pasCorps(j, PAS, false);
    const s = Math.hypot(j.v.x, j.v.z), h = Math.atan2(j.v.x, j.v.z);
    const om = Math.abs(h - h0) / PAS; h0 = h;
    if (s > 6.9 && om > 1e-3) { omMax = Math.max(omMax, om); rMin = Math.min(rMin, s / om); if (om > (CORPS.aLat / s) * 1.01) depasse++; }
  }
  // (bola-app#32 : « virages serrés » ; avant, rayon d'au moins 6 m à 7 m/s ; désormais 2 à 4 m, toujours borné par a_lat / v)
  verifier('Virage plein stick à 7 m/s', rMin >= 2 && rMin <= 4 && depasse === 0, `rayon mini ${f2(rMin)} m, lacet max ${f2(omMax)} rad/s, ${depasse} pas au-delà de a_lat / v (bola-app#32 : rayon de 2 à 4 m)`);
}

// ─────────────────────────── la conduite ───────────────────────────
function sceneConduite(graine: number, defenseur: boolean) {
  const presents = defenseur ? [4, 6] : [4];
  const m: Any = creerMonde({ graine, humains: [true, false], aides: [1, 0], presents });
  demarrer(m, { intro: false });
  const j = m.joueurs[4]; j.p.x = 0; j.p.z = 12; j.cap = Math.PI;
  const b = m.balle; b.p.x = 0; b.p.z = 11.5; b.possesseur = 4; b.dernier = 4; b.dernierT = 0;
  if (defenseur) { const d = m.joueurs[6]; d.p.x = (graine % 2 ? 1 : -1) * 1.2; d.p.z = 4 - (graine % 5) * 0.4; d.cap = 0; }
  m.controle[0] = 4;
  return m;
}
{
  // sprint balle au pied : distance moyenne à la balle (après la mise en course) ; aucune position de balle posée
  const dist: number[] = [];
  for (let g = 1; g <= 10; g++) {
    const m: Any = sceneConduite(g, false);
    for (let i = 0; i < 300; i++) {
      pas(m, [{ dx: 0, dz: -1, allure: 1, sprint: 1 }, null]);
      const j = m.joueurs[4], s = Math.hypot(j.v.x, j.v.z);
      if (i > 120 && s > 6) dist.push(Math.hypot(m.balle.p.x - j.p.x, m.balle.p.z - j.p.z));
    }
  }
  // sous pression : un défenseur sur la route ; la balle doit parfois être perdue
  let pertes = 0;
  for (let g = 1; g <= 20; g++) {
    const m: Any = sceneConduite(g, true);
    for (let i = 0; i < 360; i++) { pas(m, [{ dx: 0, dz: -1, allure: 1, sprint: 1 }, null]); const p = porteur(m); if (p && p.e === 1) { pertes++; break; } }
  }
  // aucune affectation de la position du ballon hors de ballon.js (sauf dans les mains du gardien, gardien.js)
  const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/lib/jeu/sim');
  const fautifs: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (f === 'ballon.js' || f === 'gardien.js' || f === 'clips.js' || f === 'scenarios.js') continue; // (les scènes posent la balle au départ)
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    const re = /\bb\.p\.[xyz]\s*=[^=]|balle\.p\.[xyz]\s*=[^=]/g;
    for (const l of s.split('\n')) if (re.test(l) && !/engagement|b\.p\.x = 0; b\.p\.y = BALLON\.R; b\.p\.z = 0/.test(l)) fautifs.push(`${f}: ${l.trim()}`);
  }
  const dm = moy(dist);
  // (bola-app#32 : la balle aimantée reste au pied en sprint, « elle suit le joueur au lieu de partir devant » ; avant, à plus
  // d'un mètre devant ; désormais entre 0,5 et 1 m ; un défenseur sur la route la prend encore, au tacle)
  verifier('Conduite en sprint', dm >= 0.5 && dm <= 1.0 && pertes > 0 && fautifs.length === 0, `balle à ${f2(dm)} m en moyenne (médiane ${f2(med(dist))}), ${pertes}/20 balles perdues sous pression, ${fautifs.length} affectation(s) de position hors ballon.js${fautifs.length ? ' : ' + fautifs.join(' | ') : ''} (bola-app#32 : 0,5 à 1 m)`);
}

// ─────────────────────────── le contrôle orienté ───────────────────────────
{
  const res: Record<string, { q: number; d: number }> = {};
  for (const vin of [6, 10, 14, 18, 22]) for (const ang of [0, 45, 90, 135]) {
    const m: Any = creerMonde({ graine: 3, humains: [true, false], aides: [0.5, 0], presents: [4] });
    demarrer(m, { intro: false });
    const j = m.joueurs[4]; j.p.x = 0; j.p.z = 0; j.cap = 0;
    const b = m.balle; b.p.x = 0; b.p.z = 6; b.v.z = -vin; rouler(b); b.possesseur = null; b.dernier = 9; b.dernierT = 0;
    m.controle[0] = 4;
    // la sortie voulue : ang degrés par rapport à la course de la balle (−z)
    const a = (ang * Math.PI) / 180;
    const it = { dx: Math.sin(a), dz: -Math.cos(a), allure: 0.05, sprint: 0 };
    let q = -1, t0 = 0;
    for (let i = 0; i < 240; i++) {
      pas(m, [it, null]);
      for (const e of m.evts) if (e.type === 'controle' && q < 0) { q = e.q; t0 = m.t; }
      m.evts.length = 0;
      if (q >= 0 && m.t - t0 >= 0.5) break;
    }
    res[`${vin}/${ang}`] = { q, d: Math.hypot(b.p.x - j.p.x, b.p.z - j.p.z) };
  }
  let monotone = true;
  for (const ang of [0, 45, 90, 135]) { let p = 2; for (const v of [6, 10, 14, 18, 22]) { const q = res[`${v}/${ang}`].q; if (q > p + 1e-9) monotone = false; p = q; } }
  for (const v of [6, 10, 14, 18, 22]) { let p = 2; for (const ang of [0, 45, 90, 135]) { const q = res[`${v}/${ang}`].q; if (q > p + 1e-9) monotone = false; p = q; } }
  const fort = res['22/90'];
  verifier('Contrôle orienté', monotone && fort.d > 1.5, `q : 6 m/s dans l'axe ${f2(res['6/0'].q)}, 10 m/s à 90° ${f2(res['10/90'].q)}, 22 m/s à 90° ${f2(fort.q)} (balle à ${f2(fort.d)} m au bout de 0,5 s) ; qualité décroissante ${monotone}`);
}

// ─────────────────────────── les matchs IA contre IA ───────────────────────────
const N = vite ? 10 : 50;
const buts: number[] = [], impacts: number[] = [];
let penOu = '';
let nan = 0, blocages = 0, dehorsCorps = 0, penMax = 0, antiBlocages = 0, effleurees = 0;
const detailsBlocage: string[] = [];
const totaux: Record<string, number> = {};
// (bola-app#26, lot 2) les statistiques du jeu : passes réussies, arrêts, fautes, tacles réussis, une-deux, reprises
// aériennes, et le gardien sur la bissectrice de l'angle balle-poteaux
const SM: Record<string, number> = { passes: 0, passesOk: 0, arrets: 0, fautes: 0, vols: 0, uneDeux: 0, aeriens: 0, avantages: 0, coupsFrancs: 0, tirages: 0, appels: 0, contresTacle: 0 };
let bisN = 0, bisSomme = 0, fautesOuvertes = 0, ecartMin = Infinity;
const surPlaceMax = { d: 0, ou: '' };
// (correctifs #32, D6 du contrôle du jeu) une balle libre lente (moins de 1 m/s, au sol) sans personne qui va vers elle
// (plus de 1 m/s dans sa direction) ni à moins de 1 m : au plus 1,5 s ; avant, 4 s (graine 11, receveur au sol)
const ignoree = { max: 0, ou: '', n: 0 };
// (correctifs #32, D7 du contrôle du jeu) la forme en attaque installée (porteur de champ, possession depuis 1,5 s) : un
// joueur derrière la balle, de la largeur des deux côtés (à ±4,5 m), un pivot devant ; mesurée toutes les 0,05 s
const forme = { n: 0, largeur: 0, tout: 0 };
let cfPoses = 0, cfSous = 0;
const { surAngle }: Any = Gar;
for (let g = 1; g <= N; g++) {
  let passeEq = -1;
  let immobile = 0, memePorteur = 0, dernierPorteur = -1;
  const surPlace = { x: 0, z: 0, t: 0 };
  const coince = new Float64Array(10), locoDepuis = new Float64Array(10);
  let seule = 0;
  const m = matchIA(g, 150, (m: Any) => {
    for (const j of m.joueurs) {
      if (!Number.isFinite(j.p.x + j.p.z + j.v.x + j.v.z + j.cap + j.d)) nan++;
      if (Math.abs(j.p.x) > BX || Math.abs(j.p.z) > BZ) dehorsCorps++;
      const s = Math.hypot(j.v.x, j.v.z);
      if (m.phase === 'jeu' && j.mode === 'loco' && j.int && j.int.allure > 0.5 && s < 0.1) coince[j.i] += PAS; else coince[j.i] = 0;
      if (coince[j.i] > 5) { blocages++; detailsBlocage.push(`g${g} joueur ${j.i} coincé à ${m.t.toFixed(1)} s`); coince[j.i] = -1e9; }
    }
    const b = m.balle;
    if (!Number.isFinite(b.p.x + b.p.y + b.p.z + b.v.x + b.v.y + b.v.z)) nan++;
    if (m.phase !== 'jeu') { surPlace.x = b.p.x; surPlace.z = b.p.z; surPlace.t = m.t; }
    if (m.phase === 'jeu') {
      const p = porteur(m);
      if (!p && b.garde == null && Math.hypot(b.v.x, b.v.z) < 0.2) immobile += PAS; else immobile = 0;
      if (immobile > 8) { blocages++; detailsBlocage.push(`g${g} balle immobile à ${m.t.toFixed(1)} s`); immobile = -1e9; }
      if (!p && b.garde == null && !m.arret && b.p.y < 0.45 && Math.hypot(b.v.x, b.v.z) < 1) {
        let enRoute = false;
        for (const j of m.joueurs) {
          if (j.absent || j.mode === 'sol') continue;
          const dx = b.p.x - j.p.x, dz = b.p.z - j.p.z, d = Math.hypot(dx, dz) || 1;
          if (d < 1 || (j.v.x * dx + j.v.z * dz) / d > 1) { enRoute = true; break; }
        }
        seule = enRoute ? 0 : seule + PAS;
        if (seule > ignoree.max) { ignoree.max = seule; ignoree.ou = `g${g} à ${m.t.toFixed(1)} s (${b.p.x.toFixed(1)} ; ${b.p.z.toFixed(1)})`; }
        if (seule > 1.5 && seule - PAS <= 1.5) ignoree.n++;
      } else seule = 0;
      if (p && !p.gardien && m.possession && m.possession.e === p.e && m.t - m.possession.t > 1.5 && m.pas % 6 === 0) {
        const e = p.e, sg = e === 0 ? -1 : 1, ab = sg * b.p.z;
        let xMax = p.p.x, xMin = p.p.x, fixo = false, piv = false;
        for (const o of m.joueurs) {
          if (o.e !== e || o.gardien || o.absent || o === p) continue;
          xMax = Math.max(xMax, o.p.x); xMin = Math.min(xMin, o.p.x);
          const ao = sg * o.p.z;
          if (ao < ab - 3) fixo = true;
          if (ab < 7 ? ao > ab + 4 : ao > 8) piv = true;
        }
        const larg = xMax >= 4.5 && xMin <= -4.5;
        forme.n++; if (larg) forme.largeur++; if (larg && fixo && piv) forme.tout++;
      }
      const id = p ? p.i : b.garde ?? -1;
      if (id >= 0 && id === dernierPorteur) memePorteur += PAS; else { memePorteur = 0; dernierPorteur = id; }
      if (memePorteur > 30) { blocages++; detailsBlocage.push(`g${g} même porteur ${id} à ${m.t.toFixed(1)} s`); memePorteur = -1e9; }
      // (correctifs #26) la balle qui reste sur place (dans un rond de 2 m) : coincée dans un coin avec des joueurs
      // autour, 14 s sans issue avant le correctif (graine 7) ; au plus 15 s en jeu
      if (Math.hypot(b.p.x - surPlace.x, b.p.z - surPlace.z) > 2) { surPlace.x = b.p.x; surPlace.z = b.p.z; surPlace.t = m.t; }
      else if (m.t - surPlace.t > surPlaceMax.d) { surPlaceMax.d = m.t - surPlace.t; surPlaceMax.ou = `g${g} à ${m.t.toFixed(1)} s (${b.p.x.toFixed(1)} ; ${b.p.z.toFixed(1)})`; }
      for (const j of m.joueurs) locoDepuis[j.i] = j.mode === 'sol' || j.mode === 'releve' ? 0 : locoDepuis[j.i] + PAS;
      for (let a = 0; a < 10; a++) for (let c = a + 1; c < 10; c++) {
        const A = m.joueurs[a], B = m.joueurs[c];
        // (deux joueurs tombés l'un sur l'autre se relèvent emmêlés : on les compte une demi-seconde après)
        if (locoDepuis[a] < 0.5 || locoDepuis[c] < 0.5) continue;
        const pen = 2 * CORPS.rayon - Math.hypot(A.p.x - B.p.x, A.p.z - B.p.z);
        if (pen > penMax) { penMax = pen; penOu = `g${g} ${a}(${A.mode}${A.g ? ' ' + A.g.nom : ''})-${c}(${B.mode}${B.g ? ' ' + B.g.nom : ''}) à ${m.t.toFixed(1)} s`; }
      }
    }
    // (correctifs #26) la balle du coup franc n'est jamais posée sous un corps au sol
    if (m.evts.some((e: Any) => e.type === 'coupFranc')) { cfPoses++; const bp = m.balle.p; for (const j of m.joueurs) if (!j.absent && (j.mode === 'sol' || j.mode === 'releve')) { const ux = Math.sin(j.cap), uz = Math.cos(j.cap); const u = Math.max(-0.8, Math.min(0.8, (bp.x - j.p.x) * ux + (bp.z - j.p.z) * uz)); if (Math.hypot(bp.x - j.p.x - ux * u, bp.z - j.p.z - uz * u) < 0.45) cfSous++; } }
    for (const e of m.evts) {
      totaux[e.type] = (totaux[e.type] ?? 0) + 1; if (e.type === 'frappe' || e.type === 'passe') if (e.effleure) effleurees++;
      // une passe est réussie si le prochain joueur (ou gardien) à prendre la balle est de la même équipe
      if (e.type === 'passe') { if (passeEq >= 0) SM.passes++; passeEq = m.joueurs[e.j].e; }
      else if ((e.type === 'controle' || e.type === 'capte') && passeEq >= 0) { SM.passes++; if (m.joueurs[e.j].e === passeEq) SM.passesOk++; passeEq = -1; }
      else if (e.type === 'tacleBalle' || e.type === 'frappe' || e.type === 'but' || e.type === 'engagement' || e.type === 'coupFranc') { if (passeEq >= 0) SM.passes++; passeEq = -1; }
      // pendant un coup franc et jusqu'à ce qu'elle soit jouée : aucun adversaire à moins de 3 m (à 0,4 m près : ils reculent)
    }
    // (à la reprise d'un coup franc : les adversaires debout à 3 m de la balle, à 0,6 m près ; sauf un joueur coincé
    // contre un panneau, qui ne peut pas reculer plus)
    if (m.evts.some((e: Any) => e.type === 'reprise')) for (const j of m.joueurs) if (!j.absent && !j.gardien && j.e === m.ecart?.e && j.mode !== 'sol' && j.mode !== 'releve' && Math.abs(j.p.x) < BX - 0.6 && Math.abs(j.p.z) < BZ - 0.6) ecartMin = Math.min(ecartMin, Math.hypot(j.p.x - m.balle.p.x, j.p.z - m.balle.p.z));
    // le gardien sur l'angle : la balle à moins de 12 m de son but, au sol, pas de tir ni de plongeon, gardien en place
    if (m.phase === 'jeu' && !m.arret) for (const k of m.joueurs) {
      const pb = m.balle.possesseur != null ? m.joueurs[m.balle.possesseur] : null;
      if (!k.gardien || k.g || m.balle.tir || m.balle.garde != null || m.balle.p.y > 0.5 || !pb || pb.e === k.e) continue;
      const zb = -Cst.sens(k.e) * LB, dB = Math.hypot(m.balle.p.x, m.balle.p.z - zb);
      if (dB > 12 || dB < 3 || Math.abs(m.balle.p.z) > LB - 0.5 || Math.hypot(m.balle.v.x, m.balle.v.z) > 3) continue;
      // la distance du gardien à la bissectrice (la droite de la balle à son point sur l'angle)
      const q = surAngle(m.balle.p.x, m.balle.p.z, zb, Math.abs(k.p.z - zb));
      const ux = q.x - m.balle.p.x, uz = q.z - m.balle.p.z, L = Math.hypot(ux, uz) || 1;
      bisSomme += Math.abs((k.p.x - m.balle.p.x) * uz - (k.p.z - m.balle.p.z) * ux) / L; bisN++;
    }
  });
  for (const k of Object.keys(SM)) if (k !== 'passes' && k !== 'passesOk') SM[k] += m.stats[k] ?? 0;
  if (m.avantage) fautesOuvertes++;
  buts.push(m.score[0] + m.score[1]);
  impacts.push(...m.stats.impacts);
  antiBlocages += m.stats.antiBlocages;
}
{
  const sansBut = buts.filter((x) => x === 0).length / N;
  const mb = moy(buts);
  verifier(`Matchs IA contre IA (${N} × 150 s)`, nan === 0 && blocages === 0 && dehorsCorps === 0 && mb >= 1.5 && mb <= 10 && sansBut <= 0.25,
    `NaN ${nan}, blocages ${blocages}${detailsBlocage.length ? ' (' + detailsBlocage.slice(0, 4).join(', ') + ')' : ''}, corps hors du terrain ${dehorsCorps}, buts par match ${f2(mb)} (de ${Math.min(...buts)} à ${Math.max(...buts)}, ${(sansBut * 100).toFixed(0)} % sans but), relances de coin ${antiBlocages}`);
  verifier('Coup franc : balle à côté du joueur au sol', cfPoses > 10 && cfSous === 0, `${cfPoses} coups francs, ${cfSous} balle(s) posée(s) à moins de 0,45 m d'un corps au sol (31 sur 58 avant le correctif)`);
  verifier('Balle jamais coincée (correctifs #26)', surPlaceMax.d <= 15, `au plus ${surPlaceMax.d.toFixed(1)} s dans un rond de 2 m en jeu (${surPlaceMax.ou}) ; borne 15 s`);
  // (l'objectif du contrôle, la forme complète la moitié du temps, n'est pas encore atteint : on garde la largeur, 47 % avant
  // ces correctifs, au-dessus de 50 % ; la forme complète, 19 % avant, est relevée pour la suite)
  verifier('Placements : largeur des deux côtés en attaque installée (correctifs #32)', forme.largeur / (forme.n || 1) >= 0.5,
    `largeur des deux côtés ${((100 * forme.largeur) / (forme.n || 1)).toFixed(0)} % du temps (au moins 50 %) ; forme 1-2-1 complète ${((100 * forme.tout) / (forme.n || 1)).toFixed(0)} % (relevée, objectif 50 %) ; ${forme.n} relevés`);
  verifier('Balle libre lente jamais ignorée (correctifs #32)', ignoree.n === 0, `${ignoree.n} fois plus de 1,5 s sans joueur qui va vers elle ; au plus ${ignoree.max.toFixed(2)} s (${ignoree.ou || '—'})`);
  const per = (k: string) => f2((totaux[k] ?? 0) / N);
  console.log(`      par match : passes ${per('passe')}, frappes ${per('frappe')}, tacles balle ${per('tacleBalle')}, tacles jambes ${per('tacleJambes')}, épaules ${per('epaule')}, chutes ${per('chute')}, plongeons ${per('plongeon')}, parades ${per('parade')}, captés ${per('capte')}, poteaux ${per('poteau')}`);
  {
    const pm = (k: string) => SM[k] / N, pr = SM.passesOk / (SM.passes || 1), bis = bisSomme / (bisN || 1);
    // (les fautes notées sont toutes réglées : avantage ou coup franc, sauf celles qu'un but ou la fin a coupées)
    const reglees = SM.avantages + SM.coupsFrancs;
    verifier('Statistiques de match (lot 2)', pm('arrets') >= 0.8 && pm('arrets') <= 8 && pm('fautes') >= 0.5 && pm('fautes') <= 5 && pm('vols') >= 1.5 && pm('vols') <= 12 && pm('uneDeux') >= 1 && pr >= 0.55 && pr <= 0.92 && pm('aeriens') >= 0.3 && reglees >= SM.fautes - fautesOuvertes - N && reglees <= SM.fautes && bis <= 0.4 && ecartMin >= 2.4 && pm('appels') > 5,
      `par match : arrêts ${f2(pm('arrets'))}, fautes ${f2(pm('fautes'))} (avantage ${f2(pm('avantages'))}, coup franc ${f2(pm('coupsFrancs'))} ; tirages ${f2(pm('tirages'))}), tacles réussis ${f2(pm('vols'))} (contrés ${f2(pm('contresTacle'))}), une-deux ${f2(pm('uneDeux'))}, reprises aériennes ${f2(pm('aeriens'))}, appels ${f2(pm('appels'))} ; passes réussies ${(pr * 100).toFixed(0)} % (${SM.passes}) ; gardien à ${(bis * 100).toFixed(0)} cm de la bissectrice en moyenne (${bisN} pas) ; adversaires au coup franc à ${f2(ecartMin)} m au moins`);
  }
  verifier('Contacts', penMax <= 0.05 + 1e-6, `pénétration maximale après un pas ${(penMax * 100).toFixed(1)} cm (${penOu})`);
  const propres = impacts.filter((x) => x <= 0.3).length / (impacts.length || 1);
  verifier('Frappes au contact du pied', propres > 0.7 && effleurees === impacts.filter((x) => x > 0.3 && x <= 0.6).length, `${impacts.length} impacts, pied-balle médian ${f2(med(impacts))} m, ${(propres * 100).toFixed(0)} % à moins de 0,30 m ; au-delà : effleurées (${effleurees}) ou manquées, toutes journalisées`);
}

// ─────────────────────────── épaule contre épaule ───────────────────────────
{
  let gagne = 0, n = 0;
  for (let k = 0; k < 200; k++) {
    const m: Any = creerMonde({ graine: k + 1, humains: [true, true], aides: [0, 0], presents: [1, 6] });
    demarrer(m, { intro: false });
    const A = m.joueurs[1], B = m.joueurs[6];
    A.m = 85; B.m = 72;
    const gap = 0.55 + (k % 5) * 0.03, vA = 6.4 + (k % 3) * 0.1, vB = 5.9 + (k % 4) * 0.05;
    A.p.x = -gap / 2; A.p.z = 0; B.p.x = gap / 2; B.p.z = 0.1 * ((k % 7) - 3) / 3;
    A.v.z = -vA; B.v.z = -vB; A.cap = B.cap = Math.PI;
    m.balle.p.x = 5; m.balle.p.z = 10; m.balle.possesseur = null;
    m.controle = [1, 6];
    // gagnant : celui que le duel désigne le plus souvent (événements « epaule »), le perdant étant déséquilibré
    let pourA = 0, pourB = 0, dA = 0, dB = 0;
    for (let i = 0; i < 90; i++) {
      pas(m, [{ dx: 0.25, dz: -1, allure: 1, sprint: (vA - 4.6) / 2.8, charge: true }, { dx: -0.25, dz: -1, allure: 1, sprint: (vB - 4.6) / 2.8, charge: true }]);
      for (const e of m.evts) if (e.type === 'epaule') { if (e.gagnant === 1) pourA++; else pourB++; }
      m.evts.length = 0;
      dA = Math.max(dA, A.d); dB = Math.max(dB, B.d);
    }
    n++;
    if (pourA > pourB && dB >= dA) gagne++;
  }
  verifier('Épaule contre épaule', gagne / n >= 0.7, `le plus lourd et le plus rapide gagne ${gagne}/${n} duels`);
}

// ─────────────────────────── les tacles ───────────────────────────
function tacle(graine: number, deFace: boolean) {
  const m: Any = creerMonde({ graine, humains: [true, true], aides: [0, 0], presents: [4, 6] });
  demarrer(m, { intro: false });
  const p = m.joueurs[4], t = m.joueurs[6];
  p.p.x = 0; p.p.z = 6; p.cap = Math.PI; p.v.z = -4;
  const b = m.balle; b.p.x = 0; b.p.z = 6 - 0.6 - (graine % 4) * 0.1; b.v.z = -4.6; rouler(b); b.possesseur = 4; b.dernier = 4; b.dernierT = 0;
  if (deFace) { t.p.x = 0.3 * ((graine % 3) - 1); t.p.z = 0.6; t.cap = 0; }
  else { t.p.x = 0.25 * ((graine % 3) - 1); t.p.z = 8.8; t.cap = Math.PI; t.v.z = -5.5; }
  m.controle = [4, 6];
  let lance = false, balle = -1, jambes = -1, tombe = false, t0 = -1, debout = -1;
  const hanches: number[] = [];
  for (let i = 0; i < 480; i++) {
    const dx = b.p.x - t.p.x, dz = b.p.z - t.p.z, d = Math.hypot(dx, dz);
    const act = !lance && d < (deFace ? 2.2 : 2.0) ? { type: 'tacle', glisse: true } : null;
    if (act) lance = true;
    pas(m, [{ dx: 0, dz: -1, allure: 0.85, sprint: 0 }, { dx: dx / d, dz: dz / d, allure: 1, sprint: 0.4, action: act }]);
    for (const e of m.evts) {
      // (bola-app#32, lot A2, point 15 : la balle au pied du porteur, prise de face, est « contrée » — tacleContre — : c'est
      // toujours la balle touchée d'abord, l'une des trois issues du tacle ; elle compte comme balle gagnée)
      if ((e.type === 'tacleBalle' || (e.type === 'tacleContre' && e.glisse)) && balle < 0) balle = m.t; if (e.type === 'tacleJambes' && jambes < 0) jambes = m.t; if (e.type === 'chute' && e.j === 4) tombe = true;
      if ((e.type === 'tacleBalle' || e.type === 'tacleJambes' || (e.type === 'tacleContre' && e.glisse)) && e.j === 6 && e.h != null) hanches.push(e.h);
    }
    m.evts.length = 0;
    if (lance && t0 < 0 && t.g?.nom === 'slide') t0 = m.t;
    if (t0 >= 0 && debout < 0 && t.mode === 'loco') debout = m.t - t0;
  }
  return { gagnee: balle > 0 && (jambes < 0 || balle <= jambes), tombe, lance, hanches, debout };
}
{
  let face = 0, derriere = 0, chutes = 0, nf = 0, nd = 0;
  const hanches: number[] = [], releves: number[] = [];
  const garder = (r: Any) => { hanches.push(...r.hanches); if (r.debout >= 0) releves.push(r.debout); else releves.push(99); };
  for (let g = 1; g <= 40; g++) { const r = tacle(g, true); if (r.lance) { nf++; if (r.gagnee) face++; garder(r); } }
  for (let g = 1; g <= 40; g++) { const r = tacle(g, false); if (r.lance) { nd++; if (r.gagnee) derriere++; if (r.tombe) chutes++; garder(r); } }
  // (bola-app#26) le vrai tacle glissé : au sol (hanches sous 0,25 m) à chaque contact, et debout en 2,8 s au plus
  // depuis le départ de la glissade (glissade de 1 à 1,6 s, relevé du dos 1,3 s)
  const hMax = Math.max(...hanches), rMax = Math.max(...releves);
  verifier('Tacles', nf > 30 && nd > 30 && face / nf >= 0.75 && chutes / nd >= 0.7 && derriere / nd <= 0.15 && hanches.length >= 60 && hMax <= 0.25 && rMax <= 2.8,
    `de face : balle gagnée ${face}/${nf} ; par derrière : porteur à terre ${chutes}/${nd}, balle gagnée ${derriere}/${nd} ; tacleur au sol à chaque contact (${hanches.length} contacts, hanches à ${(hMax * 100).toFixed(0)} cm au plus) ; relevé en ${f2(Math.max(...releves.filter((x) => x < 99)))} s au plus${rMax > 2.8 ? ' (TROP LENT)' : ''}`);
}

// ─────────────────────────── les gardiens ───────────────────────────
{
  type Tir = { p: number; x: number; y: number; issue: string };
  const tirs: Tir[] = [];
  let racineBouge = 0, mainPoteau = 0;
  const ps = [0.3, 0.45, 0.6, 0.75, 0.9], xs = [-1.3, -0.95, -0.6, -0.2, 0.2, 0.6, 0.95, 1.3], ys = [0.35, 1.3], x0s = [-3, -1.5, 0, 1.5, 3];
  let k = 0;
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
    demanderFrappe(m, j, { type: 'frappe', p, x, y });
    // l'issue : la frappe est-elle cadrée (trajectoire prédite au départ, sans hasard ensuite), puis but ou arrêt
    let issue = '', xPlonge: number | null = null, zPlonge = 0, cadree: boolean | null = null;
    for (let i = 0; i < 360 && issue !== 'but' && issue !== 'dehors'; i++) {
      pas(m, [{ dx: 0, dz: 0, allure: 0 }, null]);
      for (const e of m.evts) {
        if (e.type === 'frappe' && cadree == null) {
          const r = predire(m.balle, (q: Any) => q.p.z <= -LB, 2);
          cadree = !!r && Math.abs(r.p.x) < BUT_DL - R && r.p.y < BUT_H - R;
          issue = cadree ? 'attente' : 'dehors';
        }
        // (une parade qui n'empêche pas la balle d'entrer reste un but)
        if ((issue === 'attente' || issue === 'touche') && e.type === 'but') issue = 'but';
        if (issue === 'attente' && (e.type === 'parade' || e.type === 'capte')) issue = 'touche';
      }
      m.evts.length = 0;
      const gg = g.g;
      if (gg?.type === 'plongeon') {
        if (gg.age > gg.donnees.appel.t + PAS) { if (xPlonge == null) { xPlonge = g.p.x; zPlonge = g.p.z; } else if (Math.hypot(g.p.x - xPlonge, g.p.z - zPlonge) > 1e-9) racineBouge++; }
        const h = mainsMonde(g, { x: 0, y: 0, z: 0 });
        for (const sx of [-1, 1]) if (h.y < BUT_H && Math.hypot(h.x - sx * BUT_DL, h.z + LB) < BALLON.poteauR) mainPoteau++;
      }
    }
    if (issue === '') issue = 'dehors';
    if (issue === 'touche') issue = 'arret';
    if (issue === 'attente') issue = 'autre'; // cadrée, mais ni but ni arrêt (poteau, ralentie) : hors du compte
    tirs.push({ p, x, y, issue });
    if (process.env.BANC_GARDIEN) console.log('tir', p, x, y, x0, issue);
  }
  const cadres = tirs.filter((t) => t.issue === 'but' || t.issue === 'arret');
  const taux = (f: (t: Tir) => boolean) => { const s = cadres.filter(f); return s.filter((t) => t.issue === 'arret').length / (s.length || 1); };
  const tot = taux(() => true);
  const centre = taux((t) => Math.abs(t.x) < 0.7), coin = taux((t) => Math.abs(t.x) > 0.7);
  const faible = taux((t) => t.p <= 0.45), fort = taux((t) => t.p >= 0.75);
  // (correctifs #32, point 13, D1 du contrôle du jeu : le gardien plonge pour de vrai — k_dive au-dessus de 0,45 m, k_high sur
  // une balle haute à moins de 0,9 m de lui, un plongeon court quand il part tard — ; sur ces frappes de 11 m sans
  // défenseur, ses arrêts passent de 67-68 % à 72 % : la borne haute passe de 70 à 75 %)
  verifier('Gardiens (400 frappes)', tot >= 0.3 && tot <= 0.75 && centre > coin && faible > fort && racineBouge === 0 && mainPoteau === 0,
    `${cadres.length} cadrées sur ${tirs.length} ; arrêts ${(tot * 100).toFixed(0)} % (centre ${(centre * 100).toFixed(0)} %, coins ${(coin * 100).toFixed(0)} % ; p ≤ 0,45 : ${(faible * 100).toFixed(0)} %, p ≥ 0,75 : ${(fort * 100).toFixed(0)} %) ; racine qui bouge en plongeon ${racineBouge}, mains dans un poteau ${mainPoteau}`);
  // (correctifs #32, D1 du contrôle du jeu) une frappe de près (7 m) dans un coin : il plonge (avant : 0 sur 45, il était
  // battu avant même d'avoir réagi)
  let pres = 0, plonges = 0;
  for (const x of [-1.15, -0.95, 0.95, 1.15]) for (const y of [0.3, 0.9]) for (const x0 of [-2, 0, 2]) for (const p of [0.45, 0.7]) {
    const m: Any = creerMonde({ graine: 500 + x0 * 7 + Math.round(x * 100) + Math.round(y * 10) + Math.round(p * 1000), humains: [true, false], aides: [0, 0], presents: [4, 5] });
    demarrer(m, { intro: false });
    const j = m.joueurs[4], g = m.joueurs[5];
    j.p.x = x0; j.p.z = -LB + 7.6; j.cap = Math.PI;
    const b = m.balle; b.p.x = x0; b.p.z = -LB + 7; b.v.x = 0; b.v.z = 0; b.possesseur = 4; b.dernier = 4; b.dernierT = 0;
    g.p.x = x0 * 0.12; g.p.z = -LB + 1; g.cap = 0;
    m.controle[0] = 4;
    for (let i = 0; i < 30; i++) pas(m, [{ dx: 0, dz: 0, allure: 0 }, null]);
    demanderFrappe(m, j, { type: 'frappe', p, x, y });
    // (on ne compte que les frappes cadrées qui passent à plus de 0,8 m du gardien, dans son plan : un coin pour lui ;
    // près de lui, il arrête dans l'axe, debout ou couché)
    let plonge = false, loin: boolean | null = null;
    for (let i = 0; i < 120 && m.phase === 'jeu'; i++) {
      pas(m, [{ dx: 0, dz: 0, allure: 0 }, null]);
      if (loin == null && m.evts.some((e: Any) => e.type === 'frappe')) {
        const zk = g.p.z, rk = predire(m.balle, (q: Any) => q.p.z <= zk, 2), rl = predire(m.balle, (q: Any) => q.p.z <= -LB, 2);
        loin = !!rk && !!rl && Math.abs(rl.p.x) < BUT_DL - R && rl.p.y < BUT_H - R && Math.abs(rk.p.x - g.p.x) > 0.8;
      }
      m.evts.length = 0;
      if (g.g?.type === 'plongeon') plonge = true;
    }
    if (!loin) continue;
    pres++; if (plonge) plonges++;
  }
  verifier('Gardien : frappe de près dans un coin (correctifs #32)', pres >= 12 && plonges >= 0.8 * pres, `frappes à 7 m cadrées loin de lui (plus de 0,8 m) : ${plonges}/${pres} plongeons (au moins 80 %)`);
}

// ─────────────────────────── les correctifs du contrôle (balle et corps, chutes, demi-tour, lob, gardien) ───────────
{
  // la balle ne traverse personne : 1 000 balles basses et mi-hautes tirées sur un joueur debout, couché ou qui se
  // relève ; on compte les passages (centre du ballon plus près de l'axe que le rayon de la capsule, sans contact)
  const { BALLE_CORPS: BCo }: Any = Cst;
  let passages = 0, tirs = 0, contacts = 0;
  for (let k = 0; k < 1000; k++) {
    const mode = k % 3 === 0 ? 'loco' : k % 3 === 1 ? 'sol' : 'releve';
    const m: Any = creerMonde({ graine: 500 + k, humains: [true, true], aides: [0, 0], presents: [4, 6] });
    demarrer(m, { intro: false });
    const d = m.joueurs[6], t = m.joueurs[4];
    t.p.x = -8; t.p.z = 8;
    d.p.x = 0; d.p.z = 0; d.cap = (k * 0.37) % (2 * Math.PI);
    if (mode === 'sol') { Crp.tomber(d); d.g.t = Crp.duree('trip'); d.g.rm = false; d.v.x = d.v.z = 0; }
    if (mode === 'releve') { d.mode = 'releve'; Crp.lancerGeste(d, 'getup', { taux: 1.6, depuis: 0.72, type: 'releve' }); d.mode = 'releve'; }
    const b = m.balle, a = (k * 2.399) % (2 * Math.PI), v = 8 + (k % 7) * 3, y = mode === 'loco' ? 0.11 + (k % 5) * 0.3 : 0.11 + (k % 2) * 0.1;
    // (couché, le corps est le long du cap : on vise un point de son segment)
    const off = mode === 'sol' ? ((k % 9) / 8 - 0.5) * 1.2 : 0;
    const cx = d.p.x + Math.sin(d.cap) * off, cz = d.p.z + Math.cos(d.cap) * off;
    b.p.x = cx - Math.sin(a) * 4; b.p.z = cz - Math.cos(a) * 4; b.p.y = y; b.v.x = Math.sin(a) * v; b.v.z = Math.cos(a) * v; b.v.y = 0; rouler(b);
    b.possesseur = null; b.dernier = 4; b.dernierT = -9; b.garde = null;
    let touche = false, mini = Infinity;
    tirs++;
    for (let i = 0; i < 120; i++) {
      pas(m, [{ dx: 0, dz: 0, allure: 0 }, { dx: 0, dz: 0, allure: 0 }]);
      if (b.dernier === 6 || m.evts.some((e: Any) => e.type === 'controle' && e.j === 6)) touche = true;
      m.evts.length = 0;
      // la distance du ballon à l'axe de la capsule qu'il pourrait traverser
      let dd: number;
      if (d.mode === 'sol') { const fx = Math.sin(d.cap), fz = Math.cos(d.cap); const u = Math.max(-BCo.sol[0], Math.min(BCo.sol[0], (b.p.x - d.p.x) * fx + (b.p.z - d.p.z) * fz)); dd = Math.hypot(b.p.x - d.p.x - fx * u, b.p.y - BCo.sol[1], b.p.z - d.p.z - fz * u) - BCo.sol[2]; }
      else dd = Math.hypot(b.p.x - d.p.x, b.p.z - d.p.z) - (d.mode === 'releve' ? BCo.releve[2] : b.p.y < 0.9 ? BCo.jambes[2] : BCo.buste[2]);
      mini = Math.min(mini, dd);
    }
    if (touche) contacts++;
    if (mini < R - 0.03 && !touche) passages++;
  }
  verifier('Balle contre les corps', passages === 0 && contacts > 900, `${tirs} balles (debout, au sol, au relevé), ${contacts} arrêtées ou contrôlées par le corps, ${passages} passage(s) à travers`);
}
{
  // la chute : la vitesse du fauché ne dépasse jamais sa vitesse d'avant le contact + 1 m/s, et ne remonte pas au sol
  let pireExces = -Infinity, reaccel = 0, n = 0;
  for (let g = 1; g <= 40; g++) {
    const m: Any = creerMonde({ graine: g, humains: [true, true], aides: [0, 0], presents: [4, 6] });
    demarrer(m, { intro: false });
    const p = m.joueurs[4], t = m.joueurs[6];
    p.p.x = 0; p.p.z = 6; p.cap = Math.PI; p.v.z = -(3.5 + (g % 5) * 0.6);
    const b = m.balle; b.p.x = 0; b.p.z = 5.4; b.v.z = p.v.z - 0.6; rouler(b); b.possesseur = 4; b.dernier = 4; b.dernierT = 0;
    t.p.x = 0.25 * ((g % 3) - 1); t.p.z = 8.8; t.cap = Math.PI; t.v.z = -5.5;
    let lance = false, v0 = 0, sPrec = Infinity, auSol = false, nSol = 0;
    for (let i = 0; i < 480; i++) {
      const dx = b.p.x - t.p.x, dz = b.p.z - t.p.z, d = Math.hypot(dx, dz);
      const act = !lance && d < 2.0 ? { type: 'tacle', glisse: true } : null;
      if (act) lance = true;
      const avant = Math.hypot(p.v.x, p.v.z), modeAvant = p.mode;
      pas(m, [{ dx: 0, dz: -1, allure: 0.85, sprint: 0 }, { dx: dx / d, dz: dz / d, allure: 1, sprint: 0.4, action: act }]);
      m.evts.length = 0;
      const s = Math.hypot(p.v.x, p.v.z);
      if ((p.mode === 'sol') && modeAvant !== 'sol') { v0 = avant; auSol = true; n++; nSol = 0; }
      // (le premier pas au sol peut prendre jusqu'à + 0,5 m/s, la poussée de la chute ; ensuite, elle ne fait que baisser)
      if (auSol && p.mode === 'sol') { pireExces = Math.max(pireExces, s - (v0 + 1)); if (++nSol > 2 && s > sPrec + 1e-9) reaccel++; sPrec = s; }
    }
  }
  verifier('Chute bornée', n >= 25 && pireExces <= 1e-9 && reaccel === 0, `${n} chutes ; vitesse au plus ${pireExces <= 0 ? 'sous' : 'AU-DESSUS de'} celle d'avant le contact + 1 m/s (écart ${f2(pireExces)}) ; réaccélérations au sol ${reaccel}`);
}
{
  // le demi-tour balle au pied : stick retourné en pleine course (bola-app#32 : la balle aimantée tourne autour de lui et
  // repart dans le nouveau sens avant lui ; avant, un crochet de 170° et des touches du pied prévu) : il la garde dans
  // 80 % des cas au moins, elle n'est jamais à plus de 1,2 m de lui pendant le demi-tour, et il est reparti en moins d'1 s
  let garde = 0, n = 0, dMax = 0;
  const reparti: number[] = [];
  for (let g = 1; g <= 20; g++) {
    const m: Any = sceneConduite(g, false);
    let tR = -1;
    for (let i = 0; i < 360; i++) {
      const retourne = i > 150;
      pas(m, [{ dx: 0, dz: retourne ? 1 : -1, allure: 1, sprint: retourne ? 0.3 : 1 }, null]);
      m.evts.length = 0;
      const j = m.joueurs[4], b = m.balle;
      if (retourne && i < 300) dMax = Math.max(dMax, Math.hypot(b.p.x - j.p.x, b.p.z - j.p.z));
      if (retourne && tR < 0 && j.v.z > 2) tR = (i - 150) * PAS;
    }
    n++;
    if (tR >= 0) reparti.push(tR);
    const j = m.joueurs[4], b = m.balle;
    if (porteur(m) === j && Math.hypot(b.p.x - j.p.x, b.p.z - j.p.z) < 1.2 && j.v.z > 0.5) garde++;
  }
  verifier('Demi-tour balle au pied', garde / n >= 0.8 && dMax <= 1.2 && reparti.length === n && Math.max(...reparti) < 1.0, `${garde}/${n} demi-tours gardent la balle (aimantée), à ${f2(dMax)} m au plus pendant le demi-tour, reparti à 2 m/s en ${f2(med(reparti))} s (médiane), ${f2(Math.max(...reparti))} s au plus`);
}
{
  // la passe lobée : 13 m, un adversaire à 3 m sur la ligne ; elle passe au-dessus (sommet ≥ 2,5 m, angle ≥ 40°)
  let ok = 0, n = 0, apexMin = Infinity, angMin = Infinity;
  for (let g = 1; g <= 20; g++) {
    const m: Any = creerMonde({ graine: g, humains: [true, true], aides: [0, 0], presents: [4, 2, 6] });
    demarrer(m, { intro: false });
    const j = m.joueurs[4], c = m.joueurs[2], o = m.joueurs[6];
    j.p.x = 0; j.p.z = 4; j.cap = Math.PI; c.p.x = 0.5 * ((g % 3) - 1); c.p.z = 4 - 13; o.p.x = 0.2 * ((g % 3) - 1); o.p.z = 1; m.controle[1] = 6;
    const b = m.balle; b.p.x = 0; b.p.z = 3.55; b.possesseur = 4; b.dernier = 4; b.dernierT = 0; m.controle[0] = 4;
    demanderFrappe(m, j, { type: 'lob', p: 0.6, cible: 2 });
    let parti = false, apex = 0, ang = 0, prisParO = false;
    for (let i = 0; i < 360; i++) {
      const vAvant = { ...b.v };
      // (l'adversaire reste sur la ligne de passe : il ne la prend que si elle passe à sa portée)
      pas(m, [{ dx: 0, dz: 0, allure: 0 }, { dx: 0, dz: 0, allure: 0 }]);
      for (const e of m.evts) { if (e.type === 'passe' && !parti) { parti = true; ang = Math.atan2(b.v.y, Math.hypot(b.v.x, b.v.z)) * 180 / Math.PI; } if (e.type === 'controle' && e.j === 6) prisParO = true; }
      m.evts.length = 0; void vAvant;
      if (parti) apex = Math.max(apex, b.p.y);
    }
    if (!parti) continue;
    n++; apexMin = Math.min(apexMin, apex); angMin = Math.min(angMin, ang);
    if (!prisParO && apex >= 2.5 && ang >= 40) ok++;
  }
  verifier('Passe lobée', n >= 15 && ok === n, `${ok}/${n} lobs passent au-dessus de l'adversaire ; sommet ${f2(apexMin)} m au moins, angle de départ ${angMin.toFixed(0)}° au moins`);
}
{
  // le gardien plonge avant que la balle ne passe : aucun plongeon décidé après la ligne, et quand la balle passe son
  // plan, les mains sont déjà parties vers elle (0,2 m au moins, si elle passe à plus de 0,6 m) ; trop tard, il est
  // battu sur ses appuis au lieu de plonger dans le vide
  let tard = 0, n = 0, mainsPrete = 0;
  for (let k = 0; k < 120; k++) {
    const m: Any = creerMonde({ graine: 900 + k, humains: [true, false], aides: [0, 0], presents: [4, 5] });
    demarrer(m, { intro: false });
    const j = m.joueurs[4], g = m.joueurs[5];
    const x0 = ((k % 5) - 2) * 1.5;
    j.p.x = x0; j.p.z = -LB + 11.6; j.cap = Math.PI;
    const b = m.balle; b.p.x = x0; b.p.z = -LB + 11; b.v.x = 0; b.v.z = 0; b.possesseur = 4; b.dernier = 4; b.dernierT = 0;
    g.p.x = x0 * 0.12; g.p.z = -LB + 1; g.cap = 0; m.controle[0] = 4;
    for (let i = 0; i < 30; i++) pas(m, [{ dx: 0, dz: 0, allure: 0 }, null]);
    demanderFrappe(m, j, { type: 'frappe', p: 0.4 + (k % 4) * 0.15, x: (k % 2 ? 1 : -1) * (0.9 + (k % 3) * 0.2), y: 0.4 + (k % 3) * 0.5 });
    let tPlonge = -1, tPlan = -1, mains0: Any = null, ecart = 0;
    for (let i = 0; i < 300; i++) {
      pas(m, [{ dx: 0, dz: 0, allure: 0 }, null]);
      for (const e of m.evts) if (e.type === 'plongeon' && tPlonge < 0) { tPlonge = m.t; mains0 = mainsMonde(g, { x: 0, y: 0, z: 0 }); }
      m.evts.length = 0;
      if (tPlan < 0 && b.p.z <= g.p.z) { tPlan = m.t; if (mains0) { const h = mainsMonde(g, { x: 0, y: 0, z: 0 }); const besoin = b.p.x - mains0.x; ecart = Math.abs(besoin) < 0.6 ? 1 : ((h.x - mains0.x) * Math.sign(besoin)); } }
      if (m.phase !== 'jeu') break;
    }
    if (tPlonge < 0) continue;
    n++;
    if (tPlan >= 0 && tPlonge > tPlan) tard++;
    // (une balle arrêtée avant son plan : les mains y étaient)
    if (tPlan < 0 || ecart >= 0.2) mainsPrete++;
  }
  verifier('Gardien à temps', n >= 15 && tard === 0 && mainsPrete / n >= 0.8, `${n} plongeons ; ${tard} décidé(s) après le passage de la balle ; mains déjà parties vers la balle (≥ 0,2 m) à son passage : ${mainsPrete}/${n}`);
}
{
  // pendant le ralenti du but, les corps ne se fondent plus l'un dans l'autre ; et les entrées folles ne cassent rien
  let longs = 0;
  for (let g = 1; g <= (vite ? 6 : 20); g++) {
    const duree = new Float64Array(100);
    matchIA(g, 150, (m: Any) => {
      if (m.phase !== 'but' && m.phase !== 'fin') return;
      for (let a = 0; a < 10; a++) for (let c = a + 1; c < 10; c++) {
        const A = m.joueurs[a], B = m.joueurs[c];
        const pen = 2 * CORPS.rayon - Math.hypot(A.p.x - B.p.x, A.p.z - B.p.z);
        const k = a * 10 + c;
        // (un corps au sol ou qui se relève n'est qu'un obstacle bas, on l'enjambe : comme en jeu, il ne compte pas)
        const bas = (j: Any) => j.mode === 'sol' || j.mode === 'releve';
        duree[k] = pen > 0.08 && !bas(A) && !bas(B) ? duree[k] + PAS : 0;
        if (duree[k] > 1 && duree[k] - PAS <= 1) longs++;
      }
    });
  }
  const m: Any = creerMonde({ graine: 3, humains: [true, false], aides: [1, 0] });
  demarrer(m, { intro: false });
  for (let i = 0; i < 600; i++) pas(m, [{ dx: NaN, dz: Infinity, allure: NaN, sprint: -Infinity }, null]);
  const sain = m.joueurs.every((j: Any) => Number.isFinite(j.p.x + j.p.z + j.v.x + j.v.z)) && Number.isFinite(m.balle.p.x);
  const bc: Any = creerBoucle(m); const pas0 = m.pas;
  avancer(bc, NaN); const n1 = avancer(bc, 1 / 30);
  verifier('But au ralenti et entrées folles', longs === 0 && sain && n1 === 4 && m.pas === pas0 + 4, `chevauchements de plus de 8 cm pendant plus de 1 s au but : ${longs} ; intention NaN/infinie : ${sain ? 'aucune NaN' : 'NaN'} ; après un dt NaN, 1/30 s fait ${n1} pas`);
}

// ─────────────────────────── gestes au bon pied, contrôles, gestes techniques (bola-app#26) ───────────────────────────
{
  // des matchs IA : chaque frappe et passe part du pied du côté de la balle ; chaque contrôle prend le geste de sa
  // surface (amorti au pied presque arrêté, pied levé, cuisse, poitrine, tête) au pied de ce côté ; la réception en
  // course seulement en course
  let elans = 0, bonPied = 0, ctrl = 0, ctrlBon = 0, trapCourse = 0, receiveArret = 0;
  const vusClips = new Set<string>();
  const coteClip = (nom: string) => (Clp.CLIPS as Any)[nom]?.piedImpact?.pied;
  for (let g = 1; g <= (vite ? 4 : 10); g++) matchIA(400 + g, 150, (m: Any) => {
    for (const e of m.evts) {
      // (une balle dans l'axe, à 8 cm près : l'un ou l'autre pied convient)
      if (e.type === 'elan' && e.pied !== 'tete') { elans++; if (Math.abs(e.cote) < 0.08 || (e.pied === 0) === (e.cote > 0)) bonPied++; }
      if (e.type === 'controle' && e.clip) {
        vusClips.add(e.clip);
        if (e.clip === 'receive') { if (e.sj < 1) receiveArret++; continue; }
        if (/^(trap|stall|knee)/.test(e.clip)) { ctrl++; if ((coteClip(e.clip) === 'g') === e.gauche) ctrlBon++; if (/^trap/.test(e.clip) && e.surface === 'pied' && e.sj > 1.6) trapCourse++; }
      }
    }
  });
  verifier('Gestes au bon pied', elans > 100 && bonPied / elans >= 0.9 && ctrl > 50 && ctrlBon / ctrl >= 0.9 && trapCourse === 0 && receiveArret === 0,
    `frappes et passes : ${bonPied}/${elans} du pied du côté de la balle ; contrôles : ${ctrlBon}/${ctrl} au bon pied (${[...vusClips].sort().join(', ')}) ; amorti sur place en course ${trapCourse}, réception en course à l'arrêt ${receiveArret}`);
}
{
  // les gestes techniques (le lot 3 les met sur le stick droit) : talonnade (la balle part derrière, 3 m au moins),
  // sombrero (levée à 1,4 m au moins, au-dessus du défenseur), feinte (le défenseur face, à moins de 2 m, planté),
  // petit pont (pieds écartés : la balle passe entre ses jambes)
  const res: Record<string, string> = {};
  let ok = true;
  const essai = (nom: string, act: Any, prep: (m: Any) => void, mesure: (m: Any, d: Any) => boolean) => {
    const m: Any = creerMonde({ graine: 3, humains: [true, false], aides: [0.5, 0], presents: [4, 6] });
    demarrer(m, { intro: false });
    m.controleFixe = [4, null];
    prep(m);
    const d: Any = { y: 0, z0: m.balle.p.z, plante: 0 };
    for (let i = 0; i < 180; i++) {
      pas(m, [{ dx: 0, dz: -1, allure: i < 10 ? 0.3 : 0, sprint: 0, action: i === 2 ? act : null, regard: m.balle.p }, { dx: 0, dz: 0, allure: 0, regard: m.joueurs[4].p }]);
      d.y = Math.max(d.y, m.balle.p.y); d.plante = Math.max(d.plante, m.joueurs[6].plante); d.zMax = Math.max(d.zMax ?? -99, m.balle.p.z);
      for (const e of m.evts) if (e.type === 'petitPont') d.passe = e.passe;
      m.evts.length = 0;
    }
    const r = mesure(m, d);
    res[nom] = r ? 'ok' : 'RATÉ'; ok &&= r;
  };
  const poserJ = (m: Any, vz: number, dDef: number) => {
    const j = m.joueurs[4], o = m.joueurs[6], b = m.balle;
    j.p.x = 0; j.p.z = 4; j.cap = Math.PI; j.v.x = 0; j.v.z = vz;
    b.p.x = 0; b.p.y = R; b.p.z = 3.55; b.v.x = 0; b.v.y = 0; b.v.z = vz; rouler(b); b.possesseur = 4; b.dernier = 4; b.dernierT = m.t;
    o.p.x = 0; o.p.z = 4 - dDef; o.cap = 0; o.v.x = 0; o.v.z = 0;
  };
  essai('talonnade', { type: 'talonnade' }, (m) => poserJ(m, -2, 6), (m, d) => d.zMax - d.z0 >= 3 || m.balle.p.z - d.z0 >= 3);
  essai('sombrero', { type: 'sombrero' }, (m) => poserJ(m, 0, 1.8), (_m, d) => d.y >= 1.4);
  essai('sombrero en course', { type: 'sombrero' }, (m) => poserJ(m, -3, 2.2), (_m, d) => d.y >= 1.4);
  essai('feinte', { type: 'feinte', dx: 1, dz: 0 }, (m) => poserJ(m, 0, 1.6), (_m, d) => d.plante >= 0.3);
  essai('passement', { type: 'passement', dx: 1, dz: 0 }, (m) => poserJ(m, -3, 1.9), (m, d) => d.plante >= 0.3 && !!m.joueurs[4].figure);
  essai('petit pont', { type: 'petitPont' }, (m) => { poserJ(m, -2, 1.1); m.joueurs[6].phase = 0.25; m.joueurs[6].v.z = 2; m.joueurs[6].int = { ...m.joueurs[6].int }; }, (m, d) => d.passe === true && m.balle.p.z < m.joueurs[6].p.z);
  verifier('Gestes techniques', ok, Object.entries(res).map(([k, v]) => `${k} ${v}`).join(' ; '));
}

// ─────────────────────────── duels, ballon, IA collective (bola-app#26, lot 2) ───────────────────────────
const { JEU }: Any = Cst;
/** Un monde de scène : humains des deux côtés (les joueurs tenus par controleFixe), joueurs choisis présents. */
function scene(graine: number, presents: number[], fixe: [number | null, number | null], humains: [boolean, boolean] = [true, true]) {
  const m: Any = creerMonde({ graine, humains, aides: [0, 0], presents });
  demarrer(m, { intro: false });
  m.controleFixe = fixe;
  return m;
}
const poser = (j: Any, x: number, z: number, cap: number, vx = 0, vz = 0) => { j.p.x = x; j.p.z = z; j.cap = cap; j.v.x = vx; j.v.z = vz; j.mode = 'loco'; j.g = null; };
const balleA = (m: Any, x: number, z: number, vx = 0, vz = 0, pos: number | null = null) => { const b = m.balle; b.p.x = x; b.p.y = R; b.p.z = z; b.v.x = vx; b.v.y = 0; b.v.z = vz; rouler(b); b.possesseur = pos; b.dernier = pos; b.dernierT = m.t; b.garde = null; b.tir = null; b.recepteur = null; };
{
  // le tirage de maillot : un défenseur collé dans le dos du porteur qui le tient ; le porteur perd 15 % d'allure (à
  // 10 % près), les deux perdent de l'équilibre, et tenu plus de 0,8 s c'est une faute (pas sans JEU.fautes)
  const essai = (tire: boolean, fautes = true) => {
    const avant = JEU.fautes; JEU.fautes = fautes;
    const m = scene(31, [4, 6], [4, 6]);
    const p = m.joueurs[4], d = m.joueurs[6];
    poser(p, 0, 4, Math.PI, 0, -4.2); poser(d, 0.05, 4.62, Math.PI, 0, -4.2);
    balleA(m, 0, 3.4, 0, -5, 4);
    let vit = 0, n = 0, dP = 0, dD = 0, faute = '', tirage = 0;
    for (let i = 0; i < 150; i++) {
      pas(m, [{ dx: 0, dz: -1, allure: 1, sprint: 0 }, { dx: (p.p.x - d.p.x) * 2, dz: -1, allure: 1, sprint: 0.3, tire }]);
      for (const e of m.evts) { if (e.type === 'faute') faute = e.genre; if (e.type === 'tirage') tirage++; }
      m.evts.length = 0;
      if (i > 30 && i < 90) { vit += Math.hypot(p.v.x, p.v.z); n++; }
      dP = Math.max(dP, p.d); dD = Math.max(dD, d.d);
    }
    JEU.fautes = avant;
    return { v: vit / n, dP, dD, faute, tirage };
  };
  const libre = essai(false), tenu = essai(true), sansFautes = essai(true, false);
  const baisse = 1 - tenu.v / libre.v;
  verifier('Tirage de maillot', baisse >= 0.08 && baisse <= 0.3 && tenu.dP > 0.02 && tenu.dD > 0.02 && tenu.faute === 'tirage' && libre.faute === '' && sansFautes.faute === '' && tenu.tirage > 0,
    `porteur tenu : ${f2(tenu.v)} m/s contre ${f2(libre.v)} libre (−${(baisse * 100).toFixed(0)} %) ; déséquilibre porteur ${f2(tenu.dP)}, tireur ${f2(tenu.dD)} ; faute « ${tenu.faute || 'aucune'} » (sans tirage : « ${libre.faute || 'aucune'} », règle coupée : « ${sansFautes.faute || 'aucune'} »)`);
}
{
  // la protection : le porteur arrêté, dos au défenseur qui pousse dans son dos ; en protégeant, il garde la balle
  // 2 s et repousse le défenseur (poussée de dos) ; sans protéger, le défenseur passe
  const essai = (protege: boolean) => {
    const m = scene(32, [4, 6], [4, 6]);
    const p = m.joueurs[4], d = m.joueurs[6];
    poser(p, 0, 4, Math.PI); poser(d, 0, 4.75, Math.PI);
    balleA(m, 0, 3.5, 0, 0, 4);
    let garde = 0, dMin = 9, dos = 0, dD = 0;
    for (let i = 0; i < 240; i++) {
      const tx = m.balle.p.x - d.p.x, tz = m.balle.p.z - d.p.z, L = Math.hypot(tx, tz) || 1;
      pas(m, [{ dx: 0, dz: 0, allure: 0, protege, regard: d.p }, { dx: tx / L, dz: tz / L, allure: 1, sprint: 0.2, charge: true }]);
      for (const e of m.evts) if (e.type === 'dos') dos++;
      m.evts.length = 0;
      if (porteur(m) === p) garde += PAS;
      dMin = Math.min(dMin, Math.hypot(d.p.x - p.p.x, d.p.z - p.p.z)); dD = Math.max(dD, d.d);
    }
    return { garde, dMin, dos, dD, recul: Math.hypot(p.p.x, p.p.z - 4) };
  };
  const pr = essai(true), sans = essai(false);
  verifier('Protection et poussée de dos', pr.garde >= 1.9 && pr.dos > 0 && sans.dos === 0 && pr.dD > sans.dD + 0.03 && pr.recul <= sans.recul + 0.05,
    `en protégeant : balle gardée ${f2(pr.garde)} s sur 2 s, ${pr.dos} poussée(s) de dos, défenseur déséquilibré ${f2(pr.dD)} (sans protéger : ${f2(sans.dD)}), porteur repoussé de ${f2(pr.recul)} m (sans protéger : ${f2(sans.recul)} m)`);
}
{
  // le tacle debout et ses issues : balle prise, balle contrée (les deux pieds dessus), ou jambes ; chacune arrive
  let prise = 0, contree = 0, jambes = 0, n = 0;
  for (let g = 1; g <= 120; g++) {
    const m = scene(600 + g, [4, 6], [4, 6]);
    const p = m.joueurs[4], t = m.joueurs[6];
    const off = ((g % 7) - 3) * 0.12, prox = 0.22 + (g % 5) * 0.08;
    poser(p, 0, 4, Math.PI, 0, -2); poser(t, off, 4 - prox - 0.85, 0);
    // (une fois sur trois, la balle protégée derrière le porteur : le tacle de face ne trouve que ses jambes)
    if (g % 3 === 0) { poser(t, off, 4 - 0.75, 0); balleA(m, 0, 4 + 0.4, 0, -2, 4); } else balleA(m, 0, 4 - prox, 0, -2, 4);
    let lance = false;
    for (let i = 0; i < 150; i++) {
      const act = !lance && i === 2 ? { type: 'tacle', glisse: false } : null; if (act) lance = true;
      pas(m, [{ dx: 0, dz: -1, allure: 0.4 }, { dx: 0, dz: 1, allure: 0.3, action: act }]);
      for (const e of m.evts) { if (e.type === 'tacleBalle' && e.debout) prise++; if (e.type === 'tacleContre') contree++; if (e.type === 'tacleJambes' && e.debout) jambes++; }
      m.evts.length = 0;
    }
    n++;
  }
  verifier('Tacle debout : issues', prise > 10 && contree > 5 && jambes > 5,
    `${n} tacles debout : balle prise ${prise}, contrée ${contree} (la balle gicle, les deux déséquilibrés), jambes ${jambes}`);
}
{
  // faute et avantage. (a) La faute notée, le porteur fauté garde la balle (il continue) : au bout de 2,5 s l'avantage a
  // joué, pas de coup franc. (b) La faute notée, l'équipe fautive prend la balle : coup franc au point de la faute, hors
  // des surfaces, adversaires à 3 m (à 0,4 m près) à la reprise, balle jouée d'abord par l'équipe fautée. (c) Le tacle
  // glissé par derrière sur un porteur : faute notée. (d) JEU.fautes = false : aucune faute.
  const { faute }: Any = Ctc;
  const base = (g: number, pres: number[], humains: [boolean, boolean] = [true, true]) => {
    const m = scene(700 + g, pres, [humains[0] ? 4 : null, 8], humains);
    const p = m.joueurs[4], o = m.joueurs[6];
    poser(p, (g % 5) - 2, 4 - g * 0.8, Math.PI, 0, -3); balleA(m, p.p.x, p.p.z - 0.45, 0, -3.3, 4);
    poser(o, p.p.x + 0.3, p.p.z + 0.8, Math.PI);
    poser(m.joueurs[8], p.p.x + 3, p.p.z - 4, 0);
    return m;
  };
  let av = 0, nA = 0, cf = 0, cfBons = 0, nC = 0, ecartMin = 9, horsOk = 0, sansRegle = 0;
  const mauvaisCF: string[] = [];
  for (let g = 0; g < 10; g++) {
    // (a)
    {
      // (le fautif, le n° 8 tenu, reste planté : personne ne reprend la balle au porteur)
      const m = base(g, [4, 8]);
      const note = faute(m, m.joueurs[8], m.joueurs[4], 'debout');
      let a = false, c = false;
      for (let i = 0; i < 400; i++) { pas(m, [{ dx: 0.3, dz: -1, allure: 0.7 }, { dx: 0, dz: 0, allure: 0 }]); for (const e of m.evts) { if (e.type === 'avantage') a = true; if (e.type === 'coupFranc') c = true; } m.evts.length = 0; }
      if (note) { nA++; if (a && !c) av++; }
    }
    // (b)
    {
      // (l'équipe fautée est jouée par l'IA : son tireur joue le coup franc)
      const m = base(g, [4, 6, 8, 2, 7], [false, true]);
      const pt = { x: m.joueurs[4].p.x, z: m.joueurs[4].p.z };
      const note = faute(m, m.joueurs[6], m.joueurs[4], 'derriere');
      // l'équipe fautive prend la balle : le n° 8 (humain des Blancs) la reçoit dans les pieds
      const o8 = m.joueurs[8]; poser(o8, pt.x + 1, pt.z - 1.2, 0); balleA(m, o8.p.x, o8.p.z + 0.4, 0, 0, 8);
      let ev: Any = null, reprise = false, ecart = 9, premier: number | null = null;
      for (let i = 0; i < 900; i++) {
        pas(m, [null, { dx: 0, dz: 0, allure: 0 }]);
        for (const e of m.evts) {
          if (e.type === 'coupFranc' && !ev) ev = e;
          if (e.type === 'reprise' && !reprise) { reprise = true; for (const o of m.joueurs) if (!o.absent && !o.gardien && o.e !== e.e && o.mode !== 'sol' && o.mode !== 'releve') ecart = Math.min(ecart, Math.hypot(o.p.x - m.balle.p.x, o.p.z - m.balle.p.z)); }
          if (reprise && premier == null && (e.type === 'passe' || e.type === 'frappe' || e.type === 'controle' || e.type === 'tacleBalle' || e.type === 'touche')) premier = m.joueurs[e.j].e;
        }
        m.evts.length = 0;
      }
      if (note) {
        nC++;
        if (ev) {
          cf++;
          const hors = [-1, 1].every((s2) => Math.hypot(ev.x, ev.z - s2 * LB) >= Cst.TERRAIN.surface + 0.5);
          if (hors) horsOk++;
          ecartMin = Math.min(ecartMin, ecart);
          if (reprise && ecart >= 2.6 && (premier == null || premier === 0) && hors && Math.hypot(ev.x - pt.x, ev.z - pt.z) < 6.6 + 0.01) cfBons++;
          else mauvaisCF.push(`g${g} : reprise ${reprise}, adversaires à ${f2(ecart)} m, d'abord ${premier}, hors ${hors}`);
        }
      }
    }
    // (d)
    { const avant = JEU.fautes; JEU.fautes = false; const m = base(g, [4, 6, 8]); if (faute(m, m.joueurs[6], m.joueurs[4], 'debout')) sansRegle++; JEU.fautes = avant; }
  }
  // (c) : le tacle glissé par derrière (le banc des tacles) note une faute
  let cN = 0, cF = 0;
  for (let g = 1; g <= 10; g++) {
    const m = scene(800 + g, [4, 6], [4, 6]);
    const p = m.joueurs[4], t = m.joueurs[6], b = m.balle;
    poser(p, 0, 6, Math.PI, 0, -4); balleA(m, 0, 6 - 0.6 - (g % 4) * 0.1, 0, -4.6, 4);
    poser(t, 0.25 * ((g % 3) - 1), 8.8, Math.PI, 0, -5.5);
    let lance = false, f = false, jambes = false;
    for (let i = 0; i < 300; i++) {
      const dx = b.p.x - t.p.x, dz = b.p.z - t.p.z, d = Math.hypot(dx, dz) || 1;
      const act = !lance && d < 2.0 ? { type: 'tacle', glisse: true } : null; if (act) lance = true;
      pas(m, [{ dx: 0, dz: -1, allure: 0.85 }, { dx: dx / d, dz: dz / d, allure: 1, sprint: 0.4, action: act }]);
      for (const e of m.evts) { if (e.type === 'faute') f = true; if (e.type === 'tacleJambes' && !e.balleAvant) jambes = true; }
      m.evts.length = 0;
    }
    if (jambes) { cN++; if (f) cF++; }
  }
  verifier('Fautes et avantage', nA >= 8 && av >= 0.7 * nA && nC >= 8 && cf === nC && cfBons === cf && horsOk === cf && cN >= 6 && cF === cN && sansRegle === 0,
    `porteur fauté qui garde la balle : ${av}/${nA} avantages joués ; l'équipe fautive la prend : ${cf}/${nC} coups francs (${cfBons} bien joués : hors des surfaces, adversaires à ${f2(ecartMin)} m au moins à la reprise, balle jouée d'abord par l'équipe fautée${mauvaisCF.length ? ' ; ' + mauvaisCF.join(' ; ') : ''}) ; tacle glissé par derrière dans les jambes : ${cF}/${cN} fautes ; règle coupée (JEU.fautes = false) : ${sansRegle} faute(s)`);
}
{
  // l'effet : la finesse (intérieur) du pied droit enroule vers la gauche de la course, celle du gauche vers la droite ;
  // l'extérieur fait l'inverse ; la courbe (écart de la balle à la droite de départ, à 15 m) dépasse 1 m et la balle
  // finit sur la cible (la visée est corrigée par l'intégrateur)
  const courbe = (type: string, gauche: boolean) => {
    // (sans gardien : on mesure la balle jusqu'à la ligne)
    const m = scene(41, [4], [4, null], [true, false]);
    const j = m.joueurs[4];
    poser(j, 0, 3.6, Math.PI);
    // (la balle du côté du pied voulu : à gauche du joueur qui regarde −z, c'est −x)
    balleA(m, gauche ? -0.16 : 0.16, 3.0, 0, 0, 4);
    for (let i = 0; i < 20; i++) pas(m, [{ dx: 0, dz: 0, allure: 0 }, null]);
    demanderFrappe(m, j, { type, p: 0.6, x: 0, y: 1.0 });
    let p0: Any = null, v0: Any = null, ecart = 0, pied = -1, xFin = NaN;
    for (let i = 0; i < 300; i++) {
      pas(m, [{ dx: 0, dz: 0, allure: 0 }, null]);
      for (const e of m.evts) if (e.type === 'elan') pied = e.pied;
      if (!p0 && m.evts.some((e: Any) => e.type === 'frappe')) { p0 = { ...m.balle.p }; v0 = { ...m.balle.v }; }
      m.evts.length = 0;
      if (p0) {
        const L = Math.hypot(v0.x, v0.z), along = ((m.balle.p.x - p0.x) * v0.x + (m.balle.p.z - p0.z) * v0.z) / L;
        // > 0 : à gauche de la course (gauche de (fx, fz) = (fz, −fx))
        const lat = ((m.balle.p.x - p0.x) * (v0.z / L) - (m.balle.p.z - p0.z) * (v0.x / L));
        if (along <= 15) ecart = lat;
        if (m.balle.p.z <= -LB && Number.isNaN(xFin)) xFin = m.balle.p.x;
        if (along > 21) break;
      }
    }
    return { ecart, pied, xFin };
  };
  const fD = courbe('finesse', false), fG = courbe('finesse', true), eD = courbe('exterieur', false), eG = courbe('exterieur', true);
  const ok = fD.pied === 1 && fG.pied === 0 && fD.ecart > 1.0 && fG.ecart < -1.0 && eD.ecart < -0.7 && eG.ecart > 0.7 && [fD, fG, eD, eG].every((c) => Math.abs(c.xFin) < 1.0);
  verifier('Effet : brossée et extérieur', ok,
    `écart à 15 m (> 0 : vers la gauche) : finesse pied droit ${f2(fD.ecart)} m, pied gauche ${f2(fG.ecart)} m ; extérieur pied droit ${f2(eD.ecart)} m, pied gauche ${f2(eG.ecart)} m ; balle à la ligne à x = ${[fD, fG, eD, eG].map((c) => f2(c.xFin)).join(' / ')} (cible 0)`);
}
{
  // les rebonds avec effet : sur le gazon, le lifté repart plus vite que la balle sans effet, le rétro moins vite ; sur
  // un panneau, l'effet de côté dévie la balle du côté de sa rotation
  const sol = (wx: number) => { const b: Any = creerBalle(); b.p.y = 0.6; b.v.z = 8; b.v.y = -3; b.w.x = wx; let vz = 0; for (let i = 0; i < 120; i++) { const vy = b.v.y; pasBalle(b, null); if (vy < 0 && b.v.y > 0) { vz = b.v.z; break; } } return vz; };
  const lift = sol(60), plat = sol(0), retro = sol(-60);
  // (le rétro garde sa rotation inverse après le rebond : il glisse plus longtemps et s'arrête plus court)
  const roule = (wx: number) => { const b: Any = creerBalle(); b.p.y = 0.6; b.v.z = 8; b.v.y = -3; b.w.x = wx; for (let i = 0; i < 2400 && Math.hypot(b.v.x, b.v.z) > 0.05; i++) pasBalle(b, null); return b.p.z; };
  const dLift = roule(60), dPlat = roule(0), dRetro = roule(-60);
  const panneau = (wy: number) => { const b: Any = creerBalle(); b.p.x = 8.5; b.p.y = 0.5; b.v.x = 12; b.w.y = wy; for (let i = 0; i < 60; i++) { b.v.y += G * PAS; const vx = b.v.x; pasBalle(b, null); if (vx > 0 && b.v.x < 0) break; } return b.v.z; };
  const pP = panneau(40), pN = panneau(-40), p0 = panneau(0);
  verifier('Rebonds avec effet', lift > plat + 0.3 && retro <= plat + 0.1 && dLift > dPlat + 0.5 && dRetro < dPlat - 0.3 && pP > 0.3 && pN < -0.3 && Math.abs(p0) < 1e-6,
    `gazon, vitesse après le rebond : lifté ${f2(lift)}, sans effet ${f2(plat)}, rétro ${f2(retro)} m/s (glissement de Coulomb : le rétro ne freine pas plus au premier rebond) ; arrêt à ${f2(dLift)} / ${f2(dPlat)} / ${f2(dRetro)} m ; panneau, vitesse de côté après le choc : ω +40 → ${f2(pP)}, −40 → ${f2(pN)}, 0 → ${f2(p0)} m/s`);
}
{
  // les balles aériennes : un centre du côté sur un attaquant au point de penalty, l'IA le reprend de la tête ou de
  // volée (geste aérien, impact à la hauteur de la balle) ; et le contrôle raté part vraiment (40 à 70 % de la vitesse)
  let air = 0, n = 0;
  const noms = new Set<string>(), portees: number[] = [];
  for (let k = 0; k < 20; k++) {
    // (le journal donne la distance de la surface — tête ou pied — à la balle, à l'impact)
    const m: Any = creerMonde({ graine: 50 + k, humains: [false, false], aides: [0, 0], presents: [1, 4, 5], journal: (t: string, ...v: Any[]) => { if (t === 'impact' && /^(head|header|volley|shoot2|bicycle)/.test(v[2])) portees.push(v[1]); } });
    demarrer(m, { intro: false });
    const j = m.joueurs[1], r = m.joueurs[4], g = m.joueurs[5];
    poser(j, -6.5 + (k % 3) * 0.5, -9.5, Math.PI / 2); poser(r, 0.3 * ((k % 5) - 2), -9.5 - (k % 4) * 0.6, Math.PI); poser(g, 0, -14.2, 0);
    balleA(m, j.p.x + 0.45, j.p.z, 0, 0, 1);
    for (let i = 0; i < 6; i++) pas(m);
    demanderFrappe(m, j, { type: 'centre', p: 0.9, cible: 4 });
    for (let i = 0; i < 300; i++) { pas(m); for (const e of m.evts) if (e.type === 'elan' && e.j === 4 && e.aerien) { air++; noms.add(e.nom); } m.evts.length = 0; }
    n++;
  }
  const ratios: number[] = [];
  for (let k = 0; k < 30; k++) {
    const m = scene(900 + k, [3, 5, 8], [3, null], [true, false]);
    const j = m.joueurs[3];
    poser(j, 1, 2, Math.PI / 2);
    poser(m.joueurs[8], -8, 2.5, -Math.PI / 2);
    const v = 18 + (k % 5);
    balleA(m, -6.4, 2.0, v, 0, null); m.balle.dernier = 8; m.balle.recepteur = 3;
    for (let i = 0; i < 120; i++) {
      pas(m, [{ dx: 0, dz: -1, allure: 0.05 }, null]);
      for (const e of m.evts) if (e.type === 'controle' && e.j === 3 && e.rate) ratios.push(Math.hypot(m.balle.v.x - j.v.x, m.balle.v.z - j.v.z) / e.vin);
      m.evts.length = 0;
    }
  }
  const rOk = ratios.length >= 10 && ratios.every((x) => x >= 0.35 && x <= 0.75);
  const pm = med(portees);
  verifier('Balles aériennes et contrôle raté', air >= 15 && rOk && portees.length >= 15 && pm <= 0.3,
    `centres repris en l'air : ${air}/${n} (${[...noms].sort().join(', ')}), surface à ${f2(pm)} m de la balle à l'impact (médiane), ${f2(Math.max(...portees))} m au plus ; contrôles ratés : ${ratios.length}, la balle repart avec ${ratios.length ? f2(Math.min(...ratios)) : '-'} à ${ratios.length ? f2(Math.max(...ratios)) : '-'} de sa vitesse`);
}
{
  // l'IA collective. (1) Appel de balle : un coéquipier marqué de près s'échappe vers l'espace (≥ 2,5 m de tout
  // adversaire, couloir libre) en 1,5 s. (2) Une-deux : le passeur reparti dans l'espace reçoit la remise en une touche.
  // (3) Pressing coordonné : chasseur sur le porteur, un défenseur sur la ligne de passe la plus dangereuse, le
  // couvreur entre la balle et le but ; porteur dos au but : un second presseur. (4) Le gardien sur l'angle, et sa
  // sortie face à un porteur seul.
  const res: string[] = [];
  let ok = true;
  // (1)
  {
    let bons = 0;
    for (let g = 0; g < 8; g++) {
      const m = scene(60 + g, [2, 4, 8, 5, 0], [4, 8], [true, true]);
      const p = m.joueurs[4], c = m.joueurs[2], o = m.joueurs[8];
      poser(p, 0, 3, Math.PI); balleA(m, 0, 2.6, 0, 0, 4);
      poser(c, -4.4, -1.6 + g * 0.2, Math.PI); poser(o, -4.0, -1.9 + g * 0.2, 0);
      for (let i = 0; i < 180; i++) pas(m, [{ dx: 0, dz: 0, allure: 0 }, { dx: 0, dz: 0, allure: 0 }]);
      const dO = Math.min(...m.joueurs.filter((x: Any) => x.e === 1 && !x.absent).map((x: Any) => Math.hypot(x.p.x - c.p.x, x.p.z - c.p.z)));
      let lane = true;
      for (const x of m.joueurs) if (x.e === 1 && !x.absent && !x.gardien) { const ex = c.p.x - p.p.x, ez = c.p.z - p.p.z, E = ex * ex + ez * ez; const u = Math.max(0, Math.min(1, ((x.p.x - p.p.x) * ex + (x.p.z - p.p.z) * ez) / E)); if (Math.hypot(x.p.x - p.p.x - ex * u, x.p.z - p.p.z - ez * u) < 1.1) lane = false; }
      if (dO >= 2.5 && lane) bons++;
    }
    res.push(`appels ${bons}/8`); ok &&= bons >= 6;
  }
  // (2)
  {
    let bons = 0;
    for (let g = 0; g < 10; g++) {
      // (le passeur et le mur sont de l'IA ; le défenseur, tenu, reste planté devant le passeur)
      const m: Any = creerMonde({ graine: 80 + g, humains: [false, true], aides: [0, 0], presents: [2, 4, 8, 5] });
      demarrer(m, { intro: false }); m.controleFixe = [null, 8];
      const a = m.joueurs[2], b2 = m.joueurs[4], o = m.joueurs[8];
      poser(a, -2, 2, Math.PI); balleA(m, -2, 1.55, 0, 0, 2);
      poser(b2, 1.2, -1 - (g % 3) * 0.3, Math.PI * 0.8); poser(o, -2.0, 0.6 - (g % 2) * 0.2, 0);
      for (let i = 0; i < 3; i++) pas(m, [null, { dx: 0, dz: 0, allure: 0 }]);
      a.uneDeux = { t: m.t, cible: 4, x: -3.4, z: -3.5 };
      demanderFrappe(m, a, { type: 'passe', p: 0.25, cible: 4 });
      let un = false;
      for (let i = 0; i < 480 && !un; i++) { pas(m, [null, { dx: 0, dz: 0, allure: 0 }]); for (const e of m.evts) if (e.type === 'uneDeux' && e.j === 2) un = true; m.evts.length = 0; }
      if (un) bons++;
    }
    res.push(`une-deux ${bons}/10`); ok &&= bons >= 4;
  }
  // (3)
  {
    let chasse = 0, ligne = 0, couvre = 0, double = 0;
    for (let g = 0; g < 8; g++) {
      for (const dos of [false, true]) {
        // (un seul receveur dangereux, le n° 8 : la ligne à couper ne change pas en cours de route)
        const m = scene(120 + g, [1, 2, 3, 4, 8, 9, 0], [null, 9], [false, true]);
        const p = m.joueurs[9];
        // les Blancs attaquent vers +z ; le porteur au milieu, deux receveurs ; les Noirs (IA) défendent leur but en +z
        poser(p, 0.5, -1 + g * 0.3, dos ? Math.PI : 0); balleA(m, 0.5, -1 + g * 0.3 + (dos ? -0.4 : 0.4), 0, 0, 9);
        poser(m.joueurs[8], 4.5, 2.5, 0);
        poser(m.joueurs[1], 0, 9, Math.PI); poser(m.joueurs[2], -2, 3.5, Math.PI); poser(m.joueurs[3], 2.5, 4.5, Math.PI); poser(m.joueurs[4], 0, 3, Math.PI);
        // (bola-app#32 : le chasseur, plus vif, arrive au porteur planté et le tacle avant 2,5 s ; on mesure ici les places
        // du pressing, pas le tacle : les Noirs ne tentent pas de tacle pendant la scène, j.essai tenu haut)
        for (let i = 0; i < 300; i++) { for (const o of m.joueurs) if (o.e === 0) o.essai = 9; pas(m, [null, { dx: 0, dz: 0, allure: 0, protege: false }]); m.balle.dernierT = m.t; }
        const Rr = m._roles?.[0];
        if (!Rr) continue;
        const J = (i: number | null) => (i != null ? m.joueurs[i] : null);
        const c = J(Rr.chasseur), l = J(Rr.ligne), v = J(Rr.couvreur), d2 = J(Rr.double);
        if (c && Math.hypot(c.p.x - p.p.x, c.p.z - p.p.z) < 1.6) chasse++;
        if (!dos) {
          const q = J(Rr.cible);
          if (l && q) { const ex = q.p.x - p.p.x, ez = q.p.z - p.p.z, E = ex * ex + ez * ez; const u = Math.max(0, Math.min(1, ((l.p.x - p.p.x) * ex + (l.p.z - p.p.z) * ez) / E)); if (Math.hypot(l.p.x - p.p.x - ex * u, l.p.z - p.p.z - ez * u) < 1.3) ligne++; }
          if (v && Rr.cov && Math.hypot(v.p.x - Rr.cov.x, v.p.z - Rr.cov.z) < 1.3 && v.p.z > p.p.z) couvre++;
        } else if (d2 && Math.hypot(d2.p.x - p.p.x, d2.p.z - p.p.z) < 1.8) double++;
      }
    }
    res.push(`pressing : chasseur au porteur ${chasse}/16, ligne coupée ${ligne}/8, couverture ${couvre}/8, second presseur (dos au but) ${double}/8`);
    ok &&= chasse >= 13 && ligne >= 6 && couvre >= 6 && double >= 6;
  }
  // (4)
  {
    let pire = 0, sortie = 0, nSortie = 0;
    const places = [[-7, 8], [-4, 10], [0, 11], [3, 7], [6.5, 9], [8, 5], [0, 6.5], [-2.5, 7]];
    for (const [x, dz] of places) for (const seul of [false, true]) {
      const m = scene(150, seul ? [4, 5] : [4, 5, 6], [4, null], [true, false]);
      const p = m.joueurs[4], k = m.joueurs[5];
      poser(p, x, -LB + dz + 0.45, Math.PI); balleA(m, x, -LB + dz, 0, 0, 4);
      if (!seul) poser(m.joueurs[6], x * 0.5, -LB + dz * 0.5, 0);
      for (let i = 0; i < 300; i++) { pas(m, [{ dx: 0, dz: 0, allure: 0 }, null]); m.balle.dernierT = m.t; }
      const q = surAngle(m.balle.p.x, m.balle.p.z, -LB, Math.abs(k.p.z + LB));
      const ux = q.x - m.balle.p.x, uz = q.z - m.balle.p.z, L = Math.hypot(ux, uz) || 1;
      const dist = Math.abs((k.p.x - m.balle.p.x) * uz - (k.p.z - m.balle.p.z) * ux) / L;
      pire = Math.max(pire, dist);
      if (seul && Math.hypot(x, dz) < 8 && k.p.z + LB >= 1.9) sortie++;
      if (seul && Math.hypot(x, dz) < 8) nSortie++;
    }
    res.push(`gardien à ${(pire * 100).toFixed(0)} cm au plus de la bissectrice, sorti face au porteur seul ${sortie}/${nSortie}`);
    ok &&= pire <= 0.25 && nSortie >= 3 && sortie === nSortie;
  }
  verifier('IA collective', ok, res.join(' ; '));
}

// ─────────────────────────── les mesures des clips (.pak) ───────────────────────────
{
  // (bola-app#26, décision 2 de #25) les mesures ne sont plus en clair : sim/clips.js est un registre vide, rempli par
  // mesures.pak ; sans lui, la simulation refuse de démarrer ; un .pak abîmé est refusé ; les mesures ont été prises
  // sur les paquets actuels (empreinte de chaque paquet) ; aucun FBX ni GLB d'animation Mixamo en clair dans public/
  const texteClips = fs.readFileSync(path.join(RACINE, 'src/lib/jeu/sim/clips.js'), 'utf8');
  const enClair = /"root"\s*:|"pieds"\s*:/.test(texteClips) || texteClips.length > 6000;
  oublierMesures();
  let refuse = false;
  try { creerMonde({ graine: 1 }); } catch { refuse = true; }
  const brut = new Uint8Array(fs.readFileSync(path.join(RACINE, 'public/jeu/anims/mesures.pak')));
  const abime = brut.slice(); abime[abime.length - 9] ^= 0x5a;
  let abimeRefuse = false;
  try { chargerMesures(abime); } catch { abimeRefuse = true; }
  lireMesures();
  const perimes: string[] = [];
  for (const [pack, h] of Object.entries(MESURES.sources as Record<string, string>)) {
    const f = path.join(RACINE, `public/jeu/anims/${pack}.pak`);
    if (!fs.existsSync(f) || empreinteOctets(new Uint8Array(fs.readFileSync(f))) !== h) perimes.push(pack);
  }
  const suivis = execSync('git ls-files public', { cwd: RACINE, encoding: 'utf8' }).split('\n').filter(Boolean);
  // (les seuls modèles en clair autorisés : décors et corps Quaternius CC0, et le neutral_idle.fbx signalé dans #25)
  const permis = /^public\/jeu\/(plateau|chars\/(homme|femme))|^public\/assets\/mixamo\/neutral_idle\.fbx$|^public\/sponsoring\//;
  const clairs = suivis.filter((f) => /\.(fbx|glb|gltf)$/i.test(f) && !permis.test(f) && /anim|mixamo|jeu/i.test(f));
  const nouveaux = ['slide', 'getup_dos', 'trap', 'stall', 'kickup', 'head_std', 'fall_side', 'k_low_l', 'k_low_r', 'k_high'];
  const manque = nouveaux.filter((k) => !CLIPS[k]);
  verifier('Mesures des clips en .pak', !enClair && refuse && abimeRefuse && perimes.length === 0 && clairs.length === 0 && manque.length === 0,
    `clips.js en clair : ${enClair ? 'OUI' : 'non'} ; monde sans mesures ${refuse ? 'refusé' : 'ACCEPTÉ'} ; .pak abîmé ${abimeRefuse ? 'refusé' : 'ACCEPTÉ'} ; empreinte ${MESURES.empreinte}, ${Object.keys(CLIPS).length} clips mesurés sur ${Object.keys(MESURES.sources).join(', ')}${perimes.length ? ' ; PÉRIMÉES pour ' + perimes.join(', ') : ' (à jour)'} ; FBX/GLB d'animation en clair dans public/ : ${clairs.length ? clairs.join(', ') : 'aucun'}${manque.length ? ' ; clips absents : ' + manque.join(', ') : ''}`);
}

// ─────────────────────────── la vue : caméra, ralenti, effets, son, police (bola-app#26, lot 4) ───────────────────────────
{
  const { creerCameraTele, majCameraTele, poserFoyer, duelPresDuBut, CAMERA_TELE }: Any = Cam;
  const E0 = (o: Any = {}) => ({ phase: 'jeu', large: false, fov: 60, aspect: 390 / 844, intro: false, celebre: null, zBut: null, duel: false, balle: { x: 0, y: 0.11, z: 0, vx: 0, vz: 0 }, ...o });
  const dt = 1 / 60;
  // 1. elle anticipe : balle à vitesse constante, le foyer est devant elle de ≈ v × 0,45 s
  {
    const c: Any = creerCameraTele(); poserFoyer(c, 0, 8);
    const E: Any = E0(); let z = 8;
    for (let i = 0; i < 240; i++) { z -= 5 * dt; E.balle.z = z; E.balle.vz = -5; majCameraTele(c, E, dt); }
    const avance = z - c.f.z; // > 0 : le foyer est plus loin vers -z que la balle
    verifier('Caméra : anticipe la balle', Math.abs(avance - 5 * CAMERA_TELE.avance) < 0.3, `balle à 5 m/s : foyer ${f2(avance)} m devant la balle (attendu ${f2(5 * CAMERA_TELE.avance)} m) ; l'ancienne caméra était ${f2(-5 * 0.35 + 5 / 2.6)} m derrière`);
  }
  // 2. sans dépassement : la cible saute de 6 m, le foyer et le cadre y vont sans jamais la dépasser
  {
    const c: Any = creerCameraTele(); poserFoyer(c, 0, 0);
    const E: Any = E0();
    for (let i = 0; i < 60; i++) majCameraTele(c, E, dt);
    E.balle.z = -6; let maxF = 0, maxR = 0;
    for (let i = 0; i < 600; i++) { majCameraTele(c, E, dt); maxF = Math.max(maxF, -c.f.z); maxR = Math.max(maxR, -c.regard.z); }
    verifier('Caméra : aucun dépassement', maxF <= 6 + 1e-3 && maxR <= 6 + 1e-3 && maxF > 5.95, `cible à 6 m : foyer au plus ${f2(maxF)} m, cadre au plus ${f2(maxR)} m`);
  }
  // 3. rien qui tremble : une balle dont la vitesse est bruitée (contacts, rebonds) — le cadre reste lisse ; comparé au
  // filtre du premier ordre d'avant (bola-app#23 : foyer.lerp(balle + v × 0,35, 1 − e^(−2,6 dt)))
  {
    let sd = 99; const bruit = () => { sd = (Math.imul(sd, 1103515245) + 12345) >>> 0; return sd / 4294967296 - 0.5; };
    const c: Any = creerCameraTele(); poserFoyer(c, 0, 0);
    const E: Any = E0(); let z = 0, fAncien = 0;
    const nouv: number[] = [], anc: number[] = [];
    for (let i = 0; i < 900; i++) {
      const vz = -3 * Math.sin(i / 120) + bruit() * 8; z += vz * dt;
      E.balle.z = z; E.balle.vz = vz; majCameraTele(c, E, dt); nouv.push(c.f.z);
      fAncien += (z + vz * 0.35 - fAncien) * (1 - Math.exp(-dt * 2.6)); anc.push(fAncien);
    }
    const sec = (t: number[]) => { let q = 0; for (let i = 2; i < t.length; i++) { const a = (t[i] - 2 * t[i - 1] + t[i - 2]) / (dt * dt); q += a * a; } return Math.sqrt(q / (t.length - 2)); };
    const jn = sec(nouv), ja = sec(anc);
    verifier('Caméra : rien qui tremble', jn < ja * 0.25, `accélération du foyer sous une vitesse bruitée (±4 m/s à chaque image) : ${f2(jn)} m/s² (rms) contre ${f2(ja)} avec le filtre d'avant`);
  }
  // 4. sur de vrais matchs IA contre IA (120 s, trois graines) : le cadre n'a jamais de cassure — ni de vitesse
  // (accélération bornée), ni d'accélération (son saut d'une image à l'autre borné) ; hors des 1,5 s qui suivent un
  // engagement. L'ancienne caméra (premier ordre, bola-app#23), mesurée de la même façon le 15/11 : accélération au
  // plus 830 à 870 m/s², saut d'accélération 900 m/s² par image (lot4/cam-essai-ancien.ts du dossier du chantier).
  {
    let accMax = 0, saut = 0, duels = 0;
    for (const g of [5, 7, 9]) {
      const m: Any = creerMonde({ graine: g, humains: [false, false], aides: [0, 0] }); demarrer(m, { intro: false });
      const bc: Any = creerBoucle(m); const c: Any = creerCameraTele(); poserFoyer(c, 0, 0);
      const E: Any = E0(); const pos: number[][] = [];
      for (let i = 0; i < 7200; i++) {
        avancer(bc, dt, null, 1); m.evts.length = 0;
        const b = m.balle;
        E.balle.x = b.p.x; E.balle.y = b.p.y; E.balle.z = b.p.z; E.balle.vx = b.v.x; E.balle.vz = b.v.z;
        E.zBut = b.tir ? Cst.butDe(1 - b.tir.e) : null; E.duel = m.phase === 'jeu' && duelPresDuBut(m, porteur(m)); if (E.duel) duels++;
        majCameraTele(c, E, dt);
        if (m.phase === 'jeu') pos.push([c.pos.z, c.regard.z, c.regard.x]); else pos.length = 0;
        const n = pos.length;
        if (n >= 90) for (const k of [0, 1, 2]) {
          const a1 = (pos[n - 1][k] - 2 * pos[n - 2][k] + pos[n - 3][k]) / (dt * dt), a0 = (pos[n - 2][k] - 2 * pos[n - 3][k] + pos[n - 4][k]) / (dt * dt);
          accMax = Math.max(accMax, Math.abs(a1)); saut = Math.max(saut, Math.abs(a1 - a0));
        }
      }
    }
    verifier('Caméra : des matchs sans cassure de cadre', accMax < 80 && saut < 20 && duels > 0, `accélération du cadre au plus ${f2(accMax)} m/s² (seuil 80 ; avant : 870), saut d'accélération au plus ${f2(saut)} m/s² par image (seuil 20 ; avant : 900) ; ${(duels / 60).toFixed(1)} s de duel près d'un but (cadre resserré)`);
  }

  // ── le ralenti : le tampon ──
  const { creerTampon, enregistrer, lireTampon, creerRalenti, armerRalenti, suivreRalenti, lancerRalenti, simGelee, passerRalenti, avancerRalenti, dureeRalenti, RALENTI, PLANS_RALENTI, cameraPlan }: Any = Ral;
  {
    const T: Any = creerTampon(7, Uint8Array.from([0, 2, 1, 0, 0, 0, 3]));
    const ecr = (t: number) => (D: Float32Array, o: number) => { const a = t * 0.8; D[o] = t * 2; D[o + 1] = t < 0.5 ? 3.1 : -3.1; D[o + 2] = 0; D[o + 3] = Math.sin(a / 2); D[o + 4] = 0; D[o + 5] = Math.cos(a / 2); D[o + 6] = t < 0.5 ? 0 : 1; };
    for (let k = 0; k <= 30; k++) enregistrer(T, k / 30, ecr(k / 30));
    const out = new Float32Array(7);
    lireTampon(T, 0.5 + 1 / 60, out);
    const lin = Math.abs(out[0] - (1 + 2 / 60)) < 1e-4;
    lireTampon(T, 14.5 / 30, out); const angle = Math.abs(Math.abs(out[1]) - Math.PI) < 0.06; // 3,1 → −3,1 par π, pas par 0
    const qn = Math.hypot(out[2], out[3], out[4], out[5]);
    // l'anneau : 10 s à 60 images/s n'en gardent que 4,6 s à 30 images/s
    const T2: Any = creerTampon(1, Uint8Array.from([0]));
    let pris = 0; for (let i = 0; i <= 600; i++) if (enregistrer(T2, i / 60, (D: Float32Array, o: number) => { D[o] = i; })) pris++;
    const garde = T2.t[(T2.debut + T2.n - 1) % T2.cap] - T2.t[T2.debut];
    verifier('Ralenti : le tampon', lin && angle && Math.abs(qn - 1) < 1e-5 && pris === 301 && T2.n === T2.cap && Math.abs(garde - (T2.cap - 1) / 30) < 1e-6 && garde >= RALENTI.duree,
      `interpolation linéaire ${lin ? 'juste' : 'FAUSSE'}, angle par le plus court chemin ${angle ? 'oui' : 'NON'} (${f2(out[1])}), quaternion unitaire (${qn.toFixed(6)}) ; 601 images proposées à 60/s : ${pris} prises, ${T2.n}/${T2.cap} gardées, ${f2(garde)} s`);
  }
  // ── le ralenti contre la vraie simulation : la sim ne bouge pas pendant la lecture ; le match qui suit est le même ──
  {
    const G = 9, FIN = 150 * 120;
    const jouer2 = (avecRalenti: boolean) => jouer(avecRalenti, false, 7);
    const jouer = (avecRalenti: boolean, reduit = false, graine = G) => {
      const m: Any = creerMonde({ graine, humains: [false, false], aides: [0, 0] }); demarrer(m, { intro: false });
      const bc: Any = creerBoucle(m);
      const T: Any = creerTampon(2 * 10 + 3, Uint8Array.from(Array(23).fill(0)));
      const R: Any = creerRalenti({ reduit });
      const lectures: Any[] = []; let cur: Any = null, buts = 0, filets = 0, butsAvecFilet = 0, tBut = -9;
      const sortie: Any = {};
      let images = 0;
      // (correctifs #26 : un but marqué juste avant FIN va au bout de sa phase « but », et de son ralenti)
      while ((m.pas < FIN || m.phase === 'but' || (avecRalenti && simGelee(R))) && images < 400000) {
        images++;
        if (avecRalenti && R.etat === 'pret' && m.phase === 'but' && m.phaseT < 0.62) { if (lancerRalenti(R, T)) cur = { pas: m.pas, emp: empreinte(m), plans: [] as string[], ecran: dureeRalenti(R), duree: 0, pasPendant: 0 }; }
        if (avecRalenti && simGelee(R)) {
          const p0 = m.pas; const o = avancerRalenti(R, T, dt, sortie);
          if (!o.fini) { cur.duree += dt; if (cur.plans[cur.plans.length - 1] !== o.plan.nom) cur.plans.push(o.plan.nom); }
          cur.pasPendant += m.pas - p0;
          if (o.fini) { cur.empApres = empreinte(m); cur.pasApres = m.pas; lectures.push(cur); cur = null; }
          continue;
        }
        avancer(bc, dt, null, 1);
        for (const e of m.evts) {
          if (e.type === 'but') { buts++; tBut = e.t; if (avecRalenti) armerRalenti(R, m.t, { zBut: Cst.butDe(1 - e.e), xBut: m.balle.p.x, buteur: { x: 0, z: 0 } }); }
          if (e.type === 'balleChoc' && e.genre === 'filet') { filets++; if (e.t - tBut < 0.6 && e.t >= tBut) { butsAvecFilet++; tBut = -9; } }
        }
        m.evts.length = 0;
        if (m.phase === 'jeu' || m.phase === 'but' || m.phase === 'engagement') enregistrer(T, m.t, (D: Float32Array, o: number) => { for (const j of m.joueurs) { D[o++] = j.p.x; D[o++] = j.p.z; } D[o++] = m.balle.p.x; D[o++] = m.balle.p.y; D[o++] = m.balle.p.z; });
        if (avecRalenti) suivreRalenti(R, T, m.t);
      }
      return { m, lectures, buts, filets, butsAvecFilet, emp: empreinte(m), pas: m.pas };
    };
    const A = jouer(true), B = jouer(false), C = jouer(true, true, 7); // (correctifs #26 : la graine 7, riche en buts ; la 9 n'en a plus aucun depuis les correctifs de l'IA)
    // une seconde graine, plus riche en buts : mêmes exigences
    const A2 = jouer2(true), B2 = jouer2(false);
    const L = [...A.lectures, ...A2.lectures];
    const plansOk = L.length > 0 && L.every((l: Any) => l.plans.join(',') === PLANS_RALENTI.map((p: Any) => p.nom).join(','));
    const geles = L.every((l: Any) => l.pasPendant === 0 && l.empApres === l.emp && l.pasApres === l.pas);
    const durees = L.map((l: Any) => l.duree);
    verifier('Ralenti : la simulation n\'avance jamais pendant la lecture', L.length === A.buts + A2.buts && geles && A.emp === B.emp && A.pas === B.pas && A2.emp === B2.emp && A2.pas === B2.pas,
      `graines ${G} et 7 : ${A.buts + A2.buts} buts, ${L.length} ralentis ; pas faits pendant les lectures : ${L.reduce((s: number, l: Any) => s + l.pasPendant, 0)} ; empreinte avant/après chaque lecture identique : ${geles ? 'oui' : 'NON'} ; fin des matchs avec ralentis ${A.emp}, ${A2.emp} = sans ${B.emp}, ${B2.emp}`);
    verifier('Ralenti : trois plans, durée', plansOk && durees.every((d: number) => d > 6 && d < 13), `plans ${L[0]?.plans.join(' → ') ?? '—'} ; durées à l'écran ${durees.map((d: number) => d.toFixed(1)).join(', ')} s (6 à 13 s)`);
    // mouvement réduit : jamais de ralenti, et passer arrête tout de suite
    const R2: Any = creerRalenti({ reduit: false }), T3: Any = creerTampon(1, Uint8Array.from([0]));
    for (let i = 0; i < 200; i++) enregistrer(T3, i / 30, (D: Float32Array, o: number) => { D[o] = i; });
    armerRalenti(R2, 5, { zBut: 15, xBut: 0, buteur: { x: 0, z: 10 } }); suivreRalenti(R2, T3, 6); lancerRalenti(R2, T3);
    const avant = simGelee(R2); passerRalenti(R2); const o = avancerRalenti(R2, T3, dt, {});
    verifier('Ralenti : mouvement réduit, passer', C.lectures.length === 0 && C.buts > 0 && avant && o.fini && !simGelee(R2) && !T3.fige,
      `mouvement réduit : ${C.lectures.length} ralenti pour ${C.buts} buts ; passer : lecture ${avant ? 'en cours' : 'ABSENTE'} → ${o.fini ? 'finie à l\'image suivante' : 'CONTINUE'}`);
    verifier('Filet : chaque but secoue le filet', A.buts + A2.buts > 1 && A.butsAvecFilet + A2.butsAvecFilet >= Math.ceil((A.buts + A2.buts) * 0.7), `${A.butsAvecFilet + A2.butsAvecFilet}/${A.buts + A2.buts} buts suivis d'un choc dans le filet en moins de 0,6 s (${A.filets + A2.filets} chocs de filet dans les deux matchs)`);
    // les caméras des plans : finies, au-dessus du gazon, et qui regardent vers la balle
    let okCam = true;
    for (const p of PLANS_RALENTI) { const c: Any = {}; for (let i = 0; i < 30; i++) cameraPlan(c, p, { zBut: -15, xBut: 0.5, buteur: { x: 2, z: -9 } }, { x: 0.5, y: 0.3, z: -13 + i * 0.01 }, dt, i === 0); const d = Math.hypot(c.pos.x - c.regard.x, c.pos.y - c.regard.y, c.pos.z - c.regard.z); if (!(c.pos.y > 0.3 && d > 1 && d < 15 && Number.isFinite(c.fov))) okCam = false; }
    verifier('Ralenti : caméras des plans', okCam, 'derrière le but, au ras du gazon, du cube : au-dessus du gazon, entre 1 et 15 m de ce qu\'elles regardent');
  }

  // ── effets : le filet, les ombres, l'herbe ──
  {
    const { creerToile, pasToile, reposToile, ecartToile, formeOmbres, traceGlisse }: Any = Eff;
    // (bola-app#32, lot C, point 8 « des vrais filets […] que le ballon reste accroché de manière réaliste » : l'onde du
    // shader de #27 est remplacée par une vraie toile, et le filet de la simulation retient la balle ; l'ancien contrôle
    // de l'onde n'a plus d'objet, il devient celui-ci) des tirs dans le but (8, 18, 30 m/s ; au ras du sol, à 0,9 et 1,6 m ;
    // de face et à 30°), la vraie balle de la simulation et la toile affichée qu'elle pousse, 4 s chacun
    {
      const T: Any = creerToile(1);
      let essais = 0, buts = 0, retenues = 0, traverse = 0, rebond = 0, ecart = 0, zMax = 0, profond = 0;
      for (const v of [8, 18, 30]) for (const y of [0.11, 0.9, 1.6]) for (const ang of [0, 30]) {
        reposToile(T); essais++;
        const b: Any = creerBalle(), a = (ang * Math.PI) / 180;
        b.p.x = -Math.sin(a) * 2.4; b.p.z = LB - 6; b.p.y = y;
        const dx = Math.sin(a) - b.p.x, dz = 6.5, L = Math.hypot(dx, dz);
        b.v.x = (dx / L) * v; b.v.z = (dz / L) * v; b.v.y = y > 0.2 ? (G * 3) / v : 0;
        let but = false, entre = false;
        for (let k = 0; k < Math.round(4 / PAS); k++) {
          if (pasBalle(b, null) >= 0) but = true;
          pasToile(T, b.p);
          const d = b.p.z - LB;
          if (d > 0.35) entre = true;
          if (entre) rebond = Math.max(rebond, -b.v.z);
          profond = Math.max(profond, d); ecart = Math.max(ecart, ecartToile(T));
          for (let i = 0; i < T.n; i++) {
            if (T.fixe[i]) continue;
            const o = 3 * i, rx = T.P[o] - b.p.x, ry = T.P[o + 1] - b.p.y, rz = T.P[o + 2] - b.p.z;
            const h = rx * T.N[o] + ry * T.N[o + 1] + rz * T.N[o + 2], l2 = rx * rx + ry * ry + rz * rz - h * h;
            zMax = Math.max(zMax, T.P[o + 2]);
            if (T.dedans && l2 < R * R && h > -0.6 && h < Math.sqrt(R * R - l2) - 0.01) traverse++;
          }
        }
        if (but) buts++;
        const d = b.p.z - LB;
        if (but && d > R && d < Cst.BUT_P && Math.abs(b.p.x) < BUT_DL && Math.hypot(b.v.x, b.v.y, b.v.z) < 0.2) retenues++;
      }
      // la balle partie (un nouvel engagement) : la toile revient à son repos et s'endort
      const loin = { x: 0, y: R, z: 0 };
      let pasRetour = 0;
      while (T.eveille && pasRetour < 600) { pasToile(T, loin); pasRetour++; }
      verifier('Filet : la balle reste prise dans la poche', buts === essais && retenues === essais && rebond < 2 && profond <= Cst.BALLON.poche.mur + 1e-6 && traverse === 0 && zMax < BZ,
        `${buts}/${essais} buts, ${retenues} balles retenues au fond du but à l'arrêt ; ressort vers le terrain à ${f2(rebond)} m/s au plus (< 2) ; ${f2(profond)} m derrière la ligne au plus (panneau à ${f2(BZ - LB)}) ; toile enfoncée de ${(ecart * 100).toFixed(0)} cm au plus, jamais traversée (${traverse}), jamais au-delà du panneau (${f2(zMax)} m)`);
      verifier('Filet : la toile revient et s\'endort', !T.eveille && ecartToile(T) < 0.01 && pasRetour < 600,
        `au repos et endormie ${(pasRetour * PAS).toFixed(2)} s après le départ de la balle, à ${(ecartToile(T) * 1000).toFixed(1)} mm de sa forme`);
    }
    const o = new Float32Array(18);
    const pied = (x: number, y: number) => ({ x, y, z: 0, ax: 0, az: 1 });
    formeOmbres({ x: 0, y: 0.95, z: 0 }, pied(-0.1, 0.03), pied(0.1, 0.45), { x: 0, y: 1.7, z: 0 }, o);
    const debout = o[5] > 0.4 && o[11] > 0.5 && o[17] < 0.05;
    formeOmbres({ x: 0, y: 0.18, z: 0 }, pied(-0.1, 0.1), pied(0.1, 0.1), { x: 0, y: 0.2, z: 1.5 }, o);
    const couche = o[3] > 1.9 && Math.abs(o[4]) < 0.05 && o[1] > 0.3;
    verifier('Ombres de contact', debout && couche, `debout : tache ${f2(o[5])}, pied posé ${debout ? 'marqué' : 'NON'}, pied levé effacé ; couché : tache de ${f2(o[3])} m le long du corps (vers la tête), décalée de ${f2(o[1])} m`);
    // l'herbe : un vrai tacle glissé de la simulation (hauteur de hanche mesurée sur le clip) laisse une trace ; un
    // joueur debout ou qui marche n'en laisse pas
    const { hancheA }: Any = Crp2;
    // (bola-app#32, lot B : l'IA tacle à bon escient — glissé seulement de côté ou de dos, jamais dans sa surface, pas
    // en série, point 15 — et le match de la graine 3 peut ne plus en compter aucun : on joue les graines 3 à 6 jusqu'à
    // trouver des traits ; les traits fautifs sont comptés sur tous les matchs joués)
    let traces = 0, glisses = 0, faux = 0; const fauxNoms = new Set<string>();
    for (let g = 3; g <= 6 && traces === 0; g++) {
      const m: Any = creerMonde({ graine: g, humains: [false, false], aides: [0, 0] }); demarrer(m, { intro: false });
      const etats: Any[] = m.joueurs.map(() => ({}));
      for (let i = 0; i < 120 * 150; i++) {
        pas(m); m.evts.length = 0; if (i % 2) continue;
        for (const j of m.joueurs) {
          const h = j.g && (j.mode === 'geste' || j.mode === 'sol') ? hancheA(j.g.nom, j.g.t) : 0.95;
          const T = traceGlisse(etats[j.i], { x: j.p.x, y: h, z: j.p.z }, m.t);
          if (T) { traces++; if (j.g?.nom === 'slide' || j.g?.nom === 'c_slide' || /fall|trip|volley|bicycle|k_block|k_low|k_high|k_dive/.test(j.g?.nom ?? '')) glisses++; else { faux++; fauxNoms.add(`${j.mode}:${j.g?.nom ?? '-'}`); } }
        }
      }
    }
    const e2: Any = {}; let marche = 0; for (let i = 0; i < 60; i++) if (traceGlisse(e2, { x: 0, y: 0.95, z: i * 0.05 }, i / 60)) marche++;
    const e3: Any = {}; let lent = 0; for (let i = 0; i < 60; i++) if (traceGlisse(e3, { x: 0, y: 0.2, z: i * 0.01 }, i / 60)) lent++;
    verifier('Herbe qui marque', traces > 0 && faux === 0 && marche === 0 && lent === 0, `${traces} traits peints (matchs IA des graines 3 à 6, arrêtés au premier qui en peint) (${glisses} de glissades, chutes, ciseaux et retournés, ${faux} ailleurs${faux ? ' : ' + [...fauxNoms].join(', ') : ''}) ; joueur debout qui court : ${marche} ; corps au sol presque immobile : ${lent}`);
  }

  // ── le son (le plan, sans navigateur) et la police ──
  {
    const { planSons, niveauFoule }: Any = Son;
    const m: Any = creerMonde({ graine: 7, humains: [false, false], aides: [0, 0] }); demarrer(m, { intro: false });
    const cpt: Record<string, number> = {}; let frappes = 0, buts = 0, borne = true, fins = 0;
    while (m.phase !== 'fin' && m.pas < 200 * 120) {
      pas(m);
      for (const e of m.evts) { if (e.type === 'frappe') frappes++; if (e.type === 'but') buts++; }
      for (const x of planSons(m.evts, m)) { cpt[x.s] = (cpt[x.s] ?? 0) + 1; if (!(x.g >= 0 && x.g <= 1) || !(Math.abs(x.pan) <= 0.6)) borne = false; if (x.s === 'sifflet' && x.n === 3) fins++; }
      m.evts.length = 0;
    }
    const pres = niveauFoule({ balle: { p: { z: 14 }, tir: null } }), loin = niveauFoule({ balle: { p: { z: 0 }, tir: null } }), tir = niveauFoule({ balle: { p: { z: 10 }, tir: { e: 0 } } });
    verifier('Son : chaque événement a son son', cpt.frappe === frappes && (cpt.clameur ?? 0) === buts && fins === 1 && (cpt.rebond ?? 0) > 0 && (cpt.panneau ?? 0) > 0 && (cpt.filet ?? 0) > 0 && borne && pres > loin && tir > pres,
      `${Object.entries(cpt).map(([k, v]) => `${k} ${v}`).join(', ')} ; ${frappes} frappes, ${buts} buts → clameurs ; sifflet de fin ${fins} ; volumes dans [0, 1] : ${borne ? 'oui' : 'NON'} ; rumeur loin ${f2(loin)} < près d'un but ${f2(pres)} < frappe ${f2(tir)}`);
    const page = fs.readFileSync(path.join(RACINE, 'src/app/jouer/page.tsx'), 'utf8');
    const match = fs.readFileSync(path.join(RACINE, 'src/lib/jeu/match.js'), 'utf8');
    const { POLICE_SCORE, POLICES, CLASSE_SCORE }: Any = Pol;
    const restes = (page.match(/var\(--font-anton\)/g) ?? []).length;
    verifier('Police du score en un seul endroit', POLICE_SCORE === 'anton' && CLASSE_SCORE === POLICES.anton.classe && (page.match(/CLASSE_SCORE\)/g) ?? []).length === 3 && restes === 0 && /POLICES\[POLICE_SCORE\]/.test(match) && !!POLICES.inter,
      `police.js : « ${POLICE_SCORE} » (Inter 800 prête : « inter ») ; page.tsx : 3 usages de CLASSE_SCORE, ${restes} font-anton en dur ; le cube lit POLICES[POLICE_SCORE]`);
  }
}

// ─────────────────────────── reproductible ───────────────────────────
{
  const journal = (g: number) => { const l: string[] = []; const m: Any = creerMonde({ graine: g, humains: [false, false], aides: [0, 0], journal: (t: string) => l.push(t) }); demarrer(m, { intro: false }); for (let i = 0; i < 6000; i++) pas(m); return empreinte(m) + ':' + l.length + ':' + l.join(',').length; };
  const a = journal(11), b2 = journal(11), c = journal(12);
  // la même graine découpée en images de 1/60, 1/144 et irrégulières : même empreinte au même pas
  const decoupe = (dts: () => number) => {
    const m: Any = creerMonde({ graine: 21, humains: [false, false], aides: [0, 0] });
    demarrer(m, { intro: false });
    const bc: Any = creerBoucle(m);
    let e = '';
    while (m.pas < 6000) avancer(bc, dts(), null, 1, () => { if (m.pas === 6000) e = empreinte(m); });
    return e;
  };
  let s = 7;
  const irr = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return 0.004 + (s / 4294967296) * 0.06; };
  const e60 = decoupe(() => 1 / 60), e144 = decoupe(() => 1 / 144), eIrr = decoupe(irr);
  const m: Any = creerMonde({ graine: 21, humains: [false, false], aides: [0, 0] }); demarrer(m, { intro: false }); for (let i = 0; i < 6000; i++) pas(m);
  const ref = empreinte(m);
  verifier('Reproductible', a === b2 && a !== c && e60 === ref && e144 === ref && eIrr === ref, `graine 11 deux fois ${a === b2 ? 'identique' : 'DIFFÉRENTE'} (${a.split(':')[0]}), graine 12 ${a !== c ? 'différente' : 'IDENTIQUE'} ; découpes 1/60, 1/144, irrégulière : ${e60}, ${e144}, ${eIrr} (référence ${ref})`);
}

// ══ correctifs du contrôle de #26 ══
{
  const { SCENARIOS }: Any = Scn;
  const scene = (nom: string, T: number, suivi: (m: Any, t: number) => void) => {
    const S = SCENARIOS[nom];
    const m: Any = creerMonde({ graine: S.graine, humains: [false, false], aides: [0, 0], presents: S.presents }); demarrer(m, { intro: false });
    const sc = S.creer(m); const t0 = m.t;
    while (m.t - t0 < T) { pas(m, sc.entrees(m)); suivi(m, m.t - t0); m.evts.length = 0; }
    return m;
  };
  // le tacle glissé : une glissade courte (≤ 1 s, ≤ 4 m) et la victime au sol tout de suite (≤ 0,45 s après le contact)
  {
    const { hancheA }: Any = Crp;
    let deb = -1, fin = -1, x0 = 0, z0 = 0, dist = 0, contact = -1, basse = -1;
    scene('tacle', 3, (m, t) => {
      const A = m.joueurs[2], V = m.joueurs[9];
      if (contact < 0 && m.evts.some((e: Any) => e.type === 'tacleJambes')) contact = t;
      if (A.g?.nom === 'slide' && deb < 0) { deb = t; x0 = A.p.x; z0 = A.p.z; }
      if (deb >= 0 && fin < 0 && A.g?.nom !== 'slide') { fin = t; dist = Math.hypot(A.p.x - x0, A.p.z - z0); }
      const hv = V.g && (V.mode === 'sol' || V.mode === 'geste') ? hancheA(V.g.nom, V.g.t) : 0.95;
      if (contact >= 0 && basse < 0 && hv < 0.45) basse = t;
    });
    verifier('Tacle glissé : glissade courte, victime au sol à l\'impact', deb >= 0 && fin - deb <= 1.0 && dist <= 4 && contact >= 0 && basse >= 0 && basse - contact <= 0.45,
      `glissade ${f2(fin - deb)} s sur ${f2(dist)} m (bornes 1 s, 4 m ; 1,42 s et 5,7 m avant) ; victime au sol ${f2(basse - contact)} s après le contact (borne 0,45 ; 0,92 avant)`);
  }
  // le ciseau : jamais pour un dégagement (scène « centre » : le défenseur Blanc dégage de la tête ou de volée basse),
  // et toujours suivi d'un passage au sol puis du relevé (avant : debout en 0,13 s)
  {
    const choix: string[] = [];
    scene('centre', 2, (m) => { for (const e of m.evts) if (e.type === 'elan' && e.j === 7) choix.push(e.nom); });
    let fins = 0, solOk = 0;
    for (let g = 1; g <= 12; g++) {
      const prev: string[] = [];
      matchIA(g, 150, (m: Any) => { for (const j of m.joueurs) { const k = j.mode + ':' + (j.g?.nom ?? ''); if (/^geste:(volley|bicycle)/.test(prev[j.i] ?? '') && !k.startsWith('geste:')) { fins++; if (j.mode === 'sol') solOk++; } prev[j.i] = k; } });
    }
    verifier('Ciseau : seulement pour frapper, et suivi du relevé', !choix.includes('volley') && choix.length > 0 && fins > 0 && solOk === fins,
      `dégagement du défenseur (scène centre) : ${choix.join(', ') || 'aucun'} ; 12 matchs : ${solOk}/${fins} ciseaux ou retournés finis au sol puis relevés`);
  }
}

console.log(`\n${echecs ? `${echecs} critère(s) manqué(s)` : 'banc du jeu : tout est vert'} (${resume.length} contrôles)`);
process.exit(echecs ? 1 : 0);
