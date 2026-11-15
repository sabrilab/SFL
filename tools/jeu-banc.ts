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
import path from 'node:path';
import * as Cst from '../src/lib/jeu/sim/constantes.js';
import * as Bal from '../src/lib/jeu/sim/ballon.js';
import * as Crp from '../src/lib/jeu/sim/corps.js';
import * as Mon from '../src/lib/jeu/sim/monde.js';
import * as Bcl from '../src/lib/jeu/sim/boucle.js';
import * as Gst from '../src/lib/jeu/sim/gestes.js';
import * as Gar from '../src/lib/jeu/sim/gardien.js';
import * as Ia from '../src/lib/jeu/sim/ia.js';

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
  verifier('Accélération 0 → 7 m/s', t >= 2.2 && t <= 3.0, `${f2(t)} s`);
}
{
  const j = corpsSeul(); lancerA(j, 7);
  for (let i = 0; i < 60; i++) pasCorps(j, PAS, false);
  const z0 = j.p.z; let zMax = z0, t = 0, pivot = false;
  j.int.dz = -1;
  while (j.v.z > -2 && t < 5) { pasCorps(j, PAS, false); t += PAS; zMax = Math.max(zMax, j.p.z); if (j.mode === 'pivot') pivot = true; }
  verifier('Demi-tour à 7 m/s', t >= 0.9 && zMax - z0 >= 2.5 && pivot, `${f2(t)} s jusqu'à repartir à 2 m/s, ${f2(zMax - z0)} m de freinage, pivot ${pivot}`);
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
  verifier('Virage plein stick à 7 m/s', rMin >= 6 && depasse === 0, `rayon mini ${f2(rMin)} m, lacet max ${f2(omMax)} rad/s, ${depasse} pas au-delà de a_lat / v`);
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
  verifier('Conduite en sprint', dm > 1.0 && pertes > 0 && fautifs.length === 0, `balle à ${f2(dm)} m en moyenne (médiane ${f2(med(dist))}), ${pertes}/20 balles perdues sous pression, ${fautifs.length} affectation(s) de position hors ballon.js${fautifs.length ? ' : ' + fautifs.join(' | ') : ''}`);
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
for (let g = 1; g <= N; g++) {
  let immobile = 0, memePorteur = 0, dernierPorteur = -1;
  const coince = new Float64Array(10), locoDepuis = new Float64Array(10);
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
    if (m.phase === 'jeu') {
      const p = porteur(m);
      if (!p && b.garde == null && Math.hypot(b.v.x, b.v.z) < 0.2) immobile += PAS; else immobile = 0;
      if (immobile > 8) { blocages++; detailsBlocage.push(`g${g} balle immobile à ${m.t.toFixed(1)} s`); immobile = -1e9; }
      const id = p ? p.i : b.garde ?? -1;
      if (id >= 0 && id === dernierPorteur) memePorteur += PAS; else { memePorteur = 0; dernierPorteur = id; }
      if (memePorteur > 30) { blocages++; detailsBlocage.push(`g${g} même porteur ${id} à ${m.t.toFixed(1)} s`); memePorteur = -1e9; }
      for (const j of m.joueurs) locoDepuis[j.i] = j.mode === 'sol' || j.mode === 'releve' ? 0 : locoDepuis[j.i] + PAS;
      for (let a = 0; a < 10; a++) for (let c = a + 1; c < 10; c++) {
        const A = m.joueurs[a], B = m.joueurs[c];
        // (deux joueurs tombés l'un sur l'autre se relèvent emmêlés : on les compte une demi-seconde après)
        if (locoDepuis[a] < 0.5 || locoDepuis[c] < 0.5) continue;
        const pen = 2 * CORPS.rayon - Math.hypot(A.p.x - B.p.x, A.p.z - B.p.z);
        if (pen > penMax) { penMax = pen; penOu = `g${g} ${a}(${A.mode}${A.g ? ' ' + A.g.nom : ''})-${c}(${B.mode}${B.g ? ' ' + B.g.nom : ''}) à ${m.t.toFixed(1)} s`; }
      }
    }
    for (const e of m.evts) { totaux[e.type] = (totaux[e.type] ?? 0) + 1; if (e.type === 'frappe' || e.type === 'passe') if (e.effleure) effleurees++; }
  });
  buts.push(m.score[0] + m.score[1]);
  impacts.push(...m.stats.impacts);
  antiBlocages += m.stats.antiBlocages;
}
{
  const sansBut = buts.filter((x) => x === 0).length / N;
  const mb = moy(buts);
  verifier(`Matchs IA contre IA (${N} × 150 s)`, nan === 0 && blocages === 0 && dehorsCorps === 0 && mb >= 1.5 && mb <= 10 && sansBut <= 0.25,
    `NaN ${nan}, blocages ${blocages}${detailsBlocage.length ? ' (' + detailsBlocage.slice(0, 4).join(', ') + ')' : ''}, corps hors du terrain ${dehorsCorps}, buts par match ${f2(mb)} (de ${Math.min(...buts)} à ${Math.max(...buts)}, ${(sansBut * 100).toFixed(0)} % sans but), relances de coin ${antiBlocages}`);
  const per = (k: string) => f2((totaux[k] ?? 0) / N);
  console.log(`      par match : passes ${per('passe')}, frappes ${per('frappe')}, tacles balle ${per('tacleBalle')}, tacles jambes ${per('tacleJambes')}, épaules ${per('epaule')}, chutes ${per('chute')}, plongeons ${per('plongeon')}, parades ${per('parade')}, captés ${per('capte')}, poteaux ${per('poteau')}`);
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
  let lance = false, balle = -1, jambes = -1, tombe = false;
  for (let i = 0; i < 360; i++) {
    const dx = b.p.x - t.p.x, dz = b.p.z - t.p.z, d = Math.hypot(dx, dz);
    const act = !lance && d < (deFace ? 2.2 : 2.0) ? { type: 'tacle', glisse: true } : null;
    if (act) lance = true;
    pas(m, [{ dx: 0, dz: -1, allure: 0.85, sprint: 0 }, { dx: dx / d, dz: dz / d, allure: 1, sprint: 0.4, action: act }]);
    for (const e of m.evts) { if (e.type === 'tacleBalle' && balle < 0) balle = m.t; if (e.type === 'tacleJambes' && jambes < 0) jambes = m.t; if (e.type === 'chute' && e.j === 4) tombe = true; }
    m.evts.length = 0;
  }
  return { gagnee: balle > 0 && (jambes < 0 || balle <= jambes), tombe, lance };
}
{
  let face = 0, derriere = 0, chutes = 0, nf = 0, nd = 0;
  for (let g = 1; g <= 40; g++) { const r = tacle(g, true); if (r.lance) { nf++; if (r.gagnee) face++; } }
  for (let g = 1; g <= 40; g++) { const r = tacle(g, false); if (r.lance) { nd++; if (r.gagnee) derriere++; if (r.tombe) chutes++; } }
  verifier('Tacles', nf > 30 && nd > 30 && face / nf >= 0.75 && chutes / nd >= 0.7 && derriere / nd <= 0.15,
    `de face : balle gagnée ${face}/${nf} ; par derrière : porteur à terre ${chutes}/${nd}, balle gagnée ${derriere}/${nd}`);
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
  verifier('Gardiens (400 frappes)', tot >= 0.3 && tot <= 0.7 && centre > coin && faible > fort && racineBouge === 0 && mainPoteau === 0,
    `${cadres.length} cadrées sur ${tirs.length} ; arrêts ${(tot * 100).toFixed(0)} % (centre ${(centre * 100).toFixed(0)} %, coins ${(coin * 100).toFixed(0)} % ; p ≤ 0,45 : ${(faible * 100).toFixed(0)} %, p ≥ 0,75 : ${(fort * 100).toFixed(0)} %) ; racine qui bouge en plongeon ${racineBouge}, mains dans un poteau ${mainPoteau}`);
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
  // le demi-tour balle au pied : stick retourné à 6 m/s, la balle à moins de 1,5 m : il la garde (crochet) ; et la
  // touche part du pied prévu
  let garde = 0, n = 0;
  const distPied: number[] = [];
  for (let g = 1; g <= 20; g++) {
    const m: Any = sceneConduite(g, false);
    m.journal = (type: string, i: number) => { if (type === 'touche' && i === 4) distPied.push(Gst.piedProche(m.joueurs[4], m.balle, true).d); };
    let crochet = false;
    for (let i = 0; i < 360; i++) {
      const retourne = i > 150;
      pas(m, [{ dx: 0, dz: retourne ? 1 : -1, allure: 1, sprint: retourne ? 0.3 : 1 }, null]);
      for (const e of m.evts) if (e.type === 'crochet') crochet = true;
      m.evts.length = 0;
    }
    n++;
    const j = m.joueurs[4], b = m.balle;
    if (crochet && porteur(m) === j && Math.hypot(b.p.x - j.p.x, b.p.z - j.p.z) < 2.5 && j.v.z > 0.5) garde++;
  }
  const pmax = Math.max(...distPied);
  verifier('Demi-tour balle au pied', garde / n >= 0.8 && pmax <= Cst.JEU.porteeTouche + 1e-9, `${garde}/${n} demi-tours gardent la balle (crochet) ; ${distPied.length} touches de conduite, pied prévu à ${f2(med(distPied))} m en médiane, ${f2(pmax)} m au plus`);
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
        duree[k] = pen > 0.08 && A.mode !== 'sol' && B.mode !== 'sol' ? duree[k] + PAS : 0;
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

console.log(`\n${echecs ? `${echecs} critère(s) manqué(s)` : 'banc du jeu : tout est vert'} (${resume.length} contrôles)`);
process.exit(echecs ? 1 : 0);
