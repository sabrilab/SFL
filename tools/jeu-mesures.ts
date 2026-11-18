// Les mesures du jeu Bola (bola-app#32), sans navigateur : le même banc avant et après chaque lot, pour comparer.
// Rien n'y est un critère (le banc ne sort jamais en erreur sur une valeur) : il imprime et écrit un JSON.
//
//   · réactivité : une manette inventée (et le clavier) lue une fois par image de 1/60 s, deux pas de simulation par
//     image, comme la page (entrees/commande.js lireManette puis intentionDe à chaque pas) ; pour chaque manœuvre,
//     la latence entre l'appui et le premier déplacement visible (ms et images à 60 i/s), et ce qui suit : départ,
//     arrêt au relâché du stick, demi-tour à 180°, virage à 90° (sans balle et balle au pied), passe et frappe (appui
//     bref, à l'arrêt et en course), vitesse de rotation du porteur (°/s) et temps d'un demi-tour ;
//   · IA contre IA (graines fixes 1..N, 150 s) : passes tentées et réussies, possessions (nombre, durée moyenne),
//     joueurs de champ à moins de 5 m du ballon (moyenne), buts par match, arrêts du gardien ;
//   · passes « humaines » : un joueur simulé tient les Noirs à la manette (aide de la manette), passe à un coéquipier
//     choisi au hasard en visant son corps au stick, d'un appui bref ; part des passes qui arrivent au receveur ;
//   · gardien : la hauteur du pied le plus bas au-dessus du gazon hors plongeon (animateur et clips des .pak, comme
//     tools/jeu-banc-anim.ts), max et moyenne, et la même mesure sur les joueurs de champ pour comparer.
// Le bouton d'une action (passe, frappe) est lu dans entrees/touches.js (ligne « passe », « frappe ») : le banc suit
// la table, il marche avant et après un changement de disposition.
//
//   npx tsx tools/jeu-mesures.ts                        tout (≈ 3 à 5 min)
//   npx tsx tools/jeu-mesures.ts --reactivite           seulement la réactivité (quelques secondes)
//   npx tsx tools/jeu-mesures.ts --ia=30 --passes=10 --gardien=2 --json=/chemin/mesures.json
import fs from 'node:fs';
import path from 'node:path';
import * as Clp from '../src/lib/jeu/sim/clips.js';
import * as Mon from '../src/lib/jeu/sim/monde.js';
import * as Gst from '../src/lib/jeu/sim/gestes.js';
import * as Cst from '../src/lib/jeu/sim/constantes.js';
import * as Cmd from '../src/lib/jeu/entrees/commande.js';
import * as Clv from '../src/lib/jeu/entrees/clavier.js';
import * as Tch from '../src/lib/jeu/entrees/touches.js';
import * as Hsd from '../src/lib/jeu/sim/hasard.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const { chargerMesures }: Any = Clp;
const { creerMonde, demarrer, pas }: Any = Mon;
const { porteur }: Any = Gst;
const { PAS, LB, butDe, sens }: Any = Cst;
const { creerCommande, lireManette, intentionDe }: Any = Cmd;
const { creerEtatClavier, etatDepuisTouches }: Any = Clv;
const { TOUCHES, BOUTONS_CLAVIER }: Any = Tch;
const { creerHasard }: Any = Hsd;

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
chargerMesures(fs.readFileSync(path.join(RACINE, 'public/jeu/anims/mesures.pak')));

const args = process.argv.slice(2);
const arg = (k: string, def: number) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? +a.split('=')[1] : args.includes(`--${k}`) ? def : null; };
const seulement = ['reactivite', 'ia', 'passes', 'gardien'].filter((k) => args.some((a) => a === `--${k}` || a.startsWith(`--${k}=`)));
const faire = (k: string) => seulement.length === 0 || seulement.includes(k);
const N_IA = arg('ia', 30) ?? 30, N_PASSES = arg('passes', 10) ?? 10, N_GARDIEN = arg('gardien', 2) ?? 2;
const jsonOut = args.find((a) => a.startsWith('--json='))?.split('=')[1] ?? null;
const RES: Any = { date: new Date().toISOString(), commit: null, reactivite: {}, ia: null, passesHumaines: null, gardien: null };
try { RES.commit = fs.readFileSync(path.join(RACINE, '.git'), 'utf8').trim(); } catch { /* worktree */ }

const IMG = 1 / 60;
const ms = (s: number | null) => (s == null ? null : Math.round(s * 1000));
const img = (s: number | null) => (s == null ? null : Math.ceil(s / IMG - 1e-6));
const deg = (r: number) => (r * 180) / Math.PI;
const enr = (a: number) => { a %= 2 * Math.PI; if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI; return a; };
const moy = (t: number[]) => t.reduce((a, b) => a + b, 0) / (t.length || 1);

// ── la table des touches : le bouton (index standard) d'une ligne ──
const IDX: Record<string, number> = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7 };
function boutonDe(id: string): number {
  const t = TOUCHES.find((x: Any) => x.id === id);
  if (!t) throw new Error(`ligne ${id} absente de touches.js`);
  const nom = String(t.xbox).split(/\s*\+\s*/).pop()!.split(' ')[0];
  if (IDX[nom] == null) throw new Error(`bouton ${t.xbox} illisible`);
  return IDX[nom];
}
const NOMS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT'];
function toucheClavier(bouton: number): string {
  const n = BOUTONS_CLAVIER[NOMS[bouton]];
  return n === 'Espace' ? ' ' : n === 'Maj' ? 'shift' : String(n).toLowerCase();
}
const B_PASSE = boutonDe('passe'), B_FRAPPE = boutonDe('frappe');
RES.touches = { passe: NOMS[B_PASSE], frappe: NOMS[B_FRAPPE], clavierPasse: toucheClavier(B_PASSE), clavierFrappe: toucheClavier(B_FRAPPE) };

// le repère : le stick (sx vers la droite, sy vers le haut) = le repère du jeu (x, z)
const versJeu = (sx: number, sy: number) => ({ x: sx, z: sy });
const versEcran = (gx: number, gz: number) => ({ sx: gx, sy: gz });

// ─────────────────────────── la réactivité ───────────────────────────
type Pilote = { stick: [number, number]; boutons: Set<number>; sprint: number };
function scene(presents: number[], { balle = false, x = 0, z = 6, cap = Math.PI }: Any = {}) {
  const M: Any = creerMonde({ graine: 3, humains: [true, false], aides: [0.5, 0], presents });
  demarrer(M, { intro: false });
  M.controleFixe = [4, null];
  M.controle[0] = 4;
  const j = M.joueurs[4];
  j.p.x = x; j.p.z = z; j.v.x = 0; j.v.z = 0; j.cap = cap;
  const b = M.balle;
  if (balle) { b.p.x = x + Math.sin(cap) * 0.4; b.p.z = z + Math.cos(cap) * 0.4; b.possesseur = 4; b.dernier = 4; b.dernierT = 0; }
  else { b.p.x = 9; b.p.z = 15.5; b.possesseur = null; }
  b.v.x = b.v.y = b.v.z = 0;
  return M;
}

/** Une image : la manette (ou le clavier) lue une fois, puis deux pas. */
function image(M: Any, cmd: Any, etat: Any, P: Pilote, clavier: boolean) {
  const t = M.t;
  if (clavier) {
    const tenues = new Set<string>();
    const [sx, sy] = P.stick;
    if (sx > 0.3) tenues.add('arrowright'); if (sx < -0.3) tenues.add('arrowleft');
    if (sy > 0.3) tenues.add('arrowup'); if (sy < -0.3) tenues.add('arrowdown');
    for (const k of P.boutons) tenues.add(toucheClavier(k));
    if (P.sprint > 0.5) tenues.add('shift');
    etatDepuisTouches(tenues, t, etat, null, versEcran);
    // (les flèches : le haut de l'écran est sy > 0 ; etatDepuisTouches écrit ax[1] = −1 pour la flèche du haut)
  } else {
    etat.b.fill(0);
    for (const k of P.boutons) etat.b[k] = 1;
    etat.b[7] = P.sprint;
    etat.ax[0] = P.stick[0]; etat.ax[1] = -P.stick[1]; etat.ax[2] = 0; etat.ax[3] = 0;
  }
  lireManette(cmd, etat, t, M, 0, versJeu);
  for (let k = 0; k < 2; k++) { pas(M, [intentionDe(cmd), null]); }
}

function nouvelEtat(clavier: boolean) { return clavier ? creerEtatClavier() : { b: new Float64Array(17), ax: new Float64Array(4) }; }

/** Une manœuvre de déplacement. avant : la course d'élan (stick, sprint, durée), puis le changement, observé. */
function manoeuvre(nom: string, { balle, clavier, elan, apres, duree = 2.5 }: Any) {
  const M = scene(balle ? [4] : [4], { balle, x: 0, z: 10, cap: Math.PI });
  const cmd = creerCommande(), etat = nouvelEtat(clavier);
  const j = M.joueurs[4];
  const P: Pilote = { stick: [0, 0], boutons: new Set(), sprint: 0 };
  // l'élan
  if (elan) { P.stick = elan.stick; P.sprint = elan.sprint ?? 0; for (let k = 0; k < elan.duree * 60; k++) image(M, cmd, etat, P, clavier); }
  const p0 = { x: j.p.x, z: j.p.z }, v0 = { x: j.v.x, z: j.v.z }, s0 = Math.hypot(j.v.x, j.v.z);
  const h0 = s0 > 0.3 ? Math.atan2(j.v.x, j.v.z) : j.cap, cap0 = j.cap;
  const t0 = M.t;
  P.stick = apres.stick; P.sprint = apres.sprint ?? 0;
  const serie: Any[] = [];
  for (let k = 0; k < duree * 60; k++) {
    image(M, cmd, etat, P, clavier);
    serie.push({ t: M.t - t0, x: j.p.x, z: j.p.z, vx: j.v.x, vz: j.v.z, cap: j.cap, mode: j.mode, g: j.g?.nom ?? null, bx: M.balle.p.x, bz: M.balle.p.z, pos: porteur(M) === j });
  }
  return { M, j, p0, v0, s0, h0, cap0, serie, t0 };
}

const R: Any = RES.reactivite;
function noter(cle: string, o: Any) {
  R[cle] = o;
  const morceaux = Object.entries(o).map(([k, v]) => `${k} ${typeof v === 'number' ? (Number.isInteger(v) ? v : (v as number).toFixed(2)) : v}`);
  console.log(`  ${cle.padEnd(28)} ${morceaux.join(' · ')}`);
}

function mesuresDeplacement(clavier: boolean) {
  const suffixe = clavier ? ' (clavier)' : '';
  for (const balle of [false, true]) {
    if (clavier && balle) continue;
    const sb = balle ? ' balle au pied' : ' sans balle';
    // départ : arrêté, stick à fond vers -z (le haut du terrain)
    {
      const r = manoeuvre('depart', { balle, clavier, elan: null, apres: { stick: [0, -1] }, duree: 2 });
      const vu = r.serie.find((q: Any) => Math.hypot(q.x - r.p0.x, q.z - r.p0.z) >= 0.03);
      const v4 = r.serie.find((q: Any) => Math.hypot(q.vx, q.vz) >= 4);
      noter('départ' + sb + suffixe, { latence_ms: ms(vu?.t ?? null), latence_images: img(vu?.t ?? null), a4ms_ms: ms(v4?.t ?? null) });
    }
    // arrêt : lancé à pleine course (sprint), stick lâché
    {
      const r = manoeuvre('arret', { balle, clavier, elan: { stick: [0, -1], sprint: 1, duree: 3 }, apres: { stick: [0, 0] }, duree: 2 });
      const vu = r.serie.find((q: Any) => Math.hypot(q.vx, q.vz) <= r.s0 - 0.25);
      const st = r.serie.find((q: Any) => Math.hypot(q.vx, q.vz) < 0.3);
      const d = st ? Math.hypot(st.x - r.p0.x, st.z - r.p0.z) : null;
      const garde = balle ? r.serie[r.serie.length - 1].pos : null;
      noter('arrêt' + sb + suffixe, { v0_ms: r.s0, latence_ms: ms(vu?.t ?? null), latence_images: img(vu?.t ?? null), arret_ms: ms(st?.t ?? null), glisse_m: d ?? -1, ...(balle ? { balle_gardee: garde ? 1 : 0, balle_a_m: Math.hypot(r.serie[r.serie.length - 1].bx - r.serie[r.serie.length - 1].x, r.serie[r.serie.length - 1].bz - r.serie[r.serie.length - 1].z) } : {}) });
    }
    // demi-tour : lancé à pleine course vers -z, stick vers +z
    {
      const r = manoeuvre('demitour', { balle, clavier, elan: { stick: [0, -1], sprint: 1, duree: 3 }, apres: { stick: [0, 1], sprint: 1 }, duree: 3 });
      const ux = 0, uz = 1;
      const vu = r.serie.find((q: Any) => Math.abs(enr(q.cap - r.cap0)) > (5 * Math.PI) / 180 || Math.hypot(q.vx, q.vz) <= r.s0 - 0.25);
      const repart = r.serie.find((q: Any) => q.vx * ux + q.vz * uz > 0.5);
      const lance = r.serie.find((q: Any) => q.vx * ux + q.vz * uz > 3);
      const face = r.serie.find((q: Any) => Math.abs(enr(q.cap - 0)) < (15 * Math.PI) / 180);
      // la boucle : l'écart latéral maximal à l'axe de la course (m) et la distance encore parcourue vers l'avant
      let lat = 0, avant = 0;
      for (const q of r.serie) { lat = Math.max(lat, Math.abs(q.x - r.p0.x)); avant = Math.max(avant, r.p0.z - q.z); }
      const garde = balle ? r.serie[r.serie.length - 1].pos : null;
      noter('demi-tour' + sb + suffixe, { v0_ms: r.s0, latence_ms: ms(vu?.t ?? null), latence_images: img(vu?.t ?? null), repart_ms: ms(repart?.t ?? null), a3ms_retour_ms: ms(lance?.t ?? null), face_ms: ms(face?.t ?? null), avance_m: avant, boucle_m: lat, ...(balle ? { balle_gardee: garde ? 1 : 0 } : {}) });
    }
    // virage à 90° : lancé à pleine course vers -z, stick vers +x
    {
      const r = manoeuvre('virage', { balle, clavier, elan: { stick: [0, -1], sprint: 1, duree: 3 }, apres: { stick: [1, 0], sprint: 1 }, duree: 2.5 });
      const cible = Math.PI / 2;
      const head = (q: Any) => (Math.hypot(q.vx, q.vz) > 0.3 ? Math.atan2(q.vx, q.vz) : q.cap);
      const vu = r.serie.find((q: Any) => Math.abs(enr(head(q) - r.h0)) > (3 * Math.PI) / 180);
      const fait = r.serie.find((q: Any) => Math.abs(enr(head(q) - cible)) < (15 * Math.PI) / 180 && Math.hypot(q.vx, q.vz) > 0.5);
      // vitesse de rotation de la course (°/s) : maximale sur 0,1 s, et moyenne de 5° à 75°
      let wmax = 0;
      for (let k = 6; k < r.serie.length; k++) { const a = r.serie[k - 6], c = r.serie[k]; if (Math.hypot(a.vx, a.vz) > 0.5 && Math.hypot(c.vx, c.vz) > 0.5) wmax = Math.max(wmax, Math.abs(deg(enr(head(c) - head(a)))) / (c.t - a.t)); }
      const a5 = r.serie.find((q: Any) => Math.abs(enr(head(q) - r.h0)) > (5 * Math.PI) / 180), a75 = r.serie.find((q: Any) => Math.abs(enr(head(q) - r.h0)) > (75 * Math.PI) / 180);
      const wmoy = a5 && a75 ? 70 / (a75.t - a5.t) : null;
      const sMin = Math.min(...r.serie.filter((q: Any) => !fait || q.t <= fait.t).map((q: Any) => Math.hypot(q.vx, q.vz)));
      let avant = 0; for (const q of r.serie) if (!fait || q.t <= fait.t) avant = Math.max(avant, r.p0.z - q.z);
      const garde = balle ? r.serie[r.serie.length - 1].pos : null;
      noter('virage 90°' + sb + suffixe, { v0_ms: r.s0, latence_ms: ms(vu?.t ?? null), latence_images: img(vu?.t ?? null), fait_ms: ms(fait?.t ?? null), rotation_max_degs: wmax, rotation_moy_degs: wmoy ?? -1, vitesse_min_ms: sMin, rayon_m: avant, ...(balle ? { balle_gardee: garde ? 1 : 0 } : {}) });
    }
  }
}

/** Une passe ou une frappe d'un appui bref (0,1 s), à l'arrêt ou en course. */
function mesureAction(type: 'passe' | 'frappe', course: boolean, clavier: boolean, tenue = 0.1) {
  // le porteur (4) vers -z, à 12 m du but d'en face (Noirs : but en -15) ; un coéquipier (3, ailier droit) à 9 m devant à droite
  const M = scene([0, 3, 4, 5], { balle: true, x: 0, z: 3, cap: Math.PI });
  const cmd = creerCommande(), etat = nouvelEtat(clavier);
  const j = M.joueurs[4], o = M.joueurs[3];
  // (le coéquipier est devant, à 12° de la course : le stick qui court vers -z le vise déjà, à l'aide de la manette près)
  o.p.x = 2; o.p.z = -8; o.v.x = 0; o.v.z = 0;
  const P: Pilote = { stick: [0, 0], boutons: new Set(), sprint: 0 };
  if (course) { P.stick = [0, -1]; for (let k = 0; k < 60; k++) image(M, cmd, etat, P, clavier); }
  else for (let k = 0; k < 20; k++) image(M, cmd, etat, P, clavier);
  // la direction : vers le coéquipier (passe, à l'arrêt) ; en course, le stick reste dans la course
  if (type === 'passe' && !course) { const dx = o.p.x - j.p.x, dz = o.p.z - j.p.z, L = Math.hypot(dx, dz); P.stick = [dx / L, dz / L]; }
  const bouton = type === 'passe' ? B_PASSE : B_FRAPPE;
  const t0 = M.t;
  const evt: Any = { reponse: null, depart: null, contact: null };
  const ref = { mode: j.mode, g: j.g, s: Math.hypot(j.v.x, j.v.z) };
  P.boutons.add(bouton);
  for (let k = 0; k < 150; k++) {
    if (M.t - t0 >= tenue - 1e-9) P.boutons.delete(bouton);
    image(M, cmd, etat, P, clavier);
    const tt = M.t - t0;
    // la première réponse visible du corps : un geste lancé (élan, armé), ou une pose de charge
    if (evt.reponse == null && ((j.g && j.g !== ref.g) || j.mode !== ref.mode || j.arme || j.charge)) evt.reponse = tt;
    for (const e of M.evts) if (evt.depart == null && (e.type === 'passe' || e.type === 'frappe') && e.j === 4) evt.depart = tt;
    M.evts.length = 0;
    if (evt.depart != null && tt > evt.depart + 0.6) break;
  }
  noter(`${type} ${course ? 'en course' : 'arrêté'} (appui ${Math.round(tenue * 1000)} ms)${clavier ? ' (clavier)' : ''}`, {
    reponse_ms: ms(evt.reponse), reponse_images: img(evt.reponse), depart_balle_ms: ms(evt.depart), depart_images: img(evt.depart),
  });
}

if (faire('reactivite')) {
  console.log(`Réactivité (manette inventée, une lecture par image de 1/60 s, deux pas par image) ; passe = ${NOMS[B_PASSE]}, frappe = ${NOMS[B_FRAPPE]}`);
  mesuresDeplacement(false);
  for (const c of [false, true]) for (const t of ['passe', 'frappe'] as const) mesureAction(t, c, false);
  console.log('Réactivité au clavier (mêmes manœuvres)');
  mesuresDeplacement(true);
  for (const t of ['passe', 'frappe'] as const) mesureAction(t, false, true);
}

// ─────────────────────────── IA contre IA ───────────────────────────
type Suivi = { possessions: number[]; equipe: number; debut: number; proches: number; prochesN: number; passes: number; passesOk: number; passeEq: number };
function suivreStats(m: Any, S: Suivi) {
  const b = m.balle;
  if (m.phase !== 'jeu') { if (S.equipe >= 0) { S.possessions.push(m.t - S.debut); S.equipe = -1; } }
  else {
    const p = porteur(m);
    const e = p ? p.e : b.garde != null ? m.joueurs[b.garde].e : S.equipe;
    if (e !== S.equipe) { if (S.equipe >= 0) S.possessions.push(m.t - S.debut); S.equipe = e; S.debut = m.t; }
    let n = 0;
    for (const j of m.joueurs) if (!j.gardien && !j.absent && Math.hypot(j.p.x - b.p.x, j.p.z - b.p.z) < 5) n++;
    S.proches += n; S.prochesN++;
  }
  for (const ev of m.evts) {
    if (ev.type === 'passe') { if (S.passeEq >= 0) S.passes++; S.passeEq = m.joueurs[ev.j].e; }
    else if ((ev.type === 'controle' || ev.type === 'capte') && S.passeEq >= 0) { S.passes++; if (m.joueurs[ev.j].e === S.passeEq) S.passesOk++; S.passeEq = -1; }
    else if (ev.type === 'tacleBalle' || ev.type === 'frappe' || ev.type === 'but' || ev.type === 'engagement' || ev.type === 'coupFranc') { if (S.passeEq >= 0) S.passes++; S.passeEq = -1; }
  }
}
const nouveauSuivi = (): Suivi => ({ possessions: [], equipe: -1, debut: 0, proches: 0, prochesN: 0, passes: 0, passesOk: 0, passeEq: -1 });

if (faire('ia')) {
  console.log(`IA contre IA : ${N_IA} matchs de 150 s (graines 1 à ${N_IA})`);
  const S = nouveauSuivi();
  const buts: number[] = [];
  let arrets = 0, tirs = 0, demandes = 0, essais = 0;
  const t0 = Date.now();
  for (let g = 1; g <= N_IA; g++) {
    const m: Any = creerMonde({ graine: g, duree: 150, humains: [false, false], aides: [0, 0] });
    demarrer(m, { intro: false });
    for (let i = 0; i < 180 * 120 && m.phase !== 'fin'; i++) { pas(m); suivreStats(m, S); m.evts.length = 0; }
    if (S.equipe >= 0) { S.possessions.push(m.t - S.debut); S.equipe = -1; }
    buts.push(m.score[0] + m.score[1]);
    arrets += m.stats.arrets; tirs += m.stats.tirs; demandes += m.stats.demandes; essais++;
  }
  const butsT = buts.reduce((a, b) => a + b, 0);
  RES.ia = {
    matchs: N_IA, butsParMatch: butsT / N_IA, sansBut: buts.filter((x) => x === 0).length / N_IA,
    passesTentees: S.passes / N_IA, passesReussies: S.passesOk / N_IA, passesPct: (100 * S.passesOk) / (S.passes || 1),
    possessionsParMatch: S.possessions.length / N_IA, possessionMoy_s: moy(S.possessions), possessionMed_s: [...S.possessions].sort((a, b) => a - b)[Math.floor(S.possessions.length / 2)] ?? 0,
    prochesDuBallon5m: S.proches / (S.prochesN || 1),
    tirsParMatch: tirs / N_IA, arretsParMatch: arrets / N_IA, arretsPct: (100 * arrets) / ((arrets + butsT) || 1),
    secondes: (Date.now() - t0) / 1000,
  };
  void demandes; void essais;
  const I = RES.ia;
  console.log(`  buts/match ${I.butsParMatch.toFixed(2)} (${(I.sansBut * 100).toFixed(0)} % sans but) · passes ${I.passesTentees.toFixed(1)} tentées/match, réussies ${I.passesPct.toFixed(1)} % · possessions ${I.possessionsParMatch.toFixed(1)}/match, ${I.possessionMoy_s.toFixed(2)} s en moyenne (médiane ${I.possessionMed_s.toFixed(2)} s) · joueurs de champ à moins de 5 m du ballon ${I.prochesDuBallon5m.toFixed(2)} · tirs ${I.tirsParMatch.toFixed(1)}/match, arrêts ${I.arretsParMatch.toFixed(2)}/match (${I.arretsPct.toFixed(0)} % des tirs arrêtés ou marqués) · ${I.secondes.toFixed(0)} s`);
}

// ─────────────────────────── passes « humaines » ───────────────────────────
if (faire('passes')) {
  console.log(`Passes d'un joueur simulé à la manette (Noirs, aide de la manette) : ${N_PASSES} matchs de 150 s`);
  let tentees = 0, auReceveur = 0, aUnCoequipier = 0, interceptees = 0, perdues = 0, sansDepart = 0, ouvertes = 0, ouvertesOk = 0;
  const distances: number[] = [];
  for (let g = 1; g <= N_PASSES; g++) {
    const m: Any = creerMonde({ graine: 100 + g, duree: 150, humains: [true, false], aides: [0.5, 0] });
    demarrer(m, { intro: false });
    const rng = creerHasard(500 + g).ia;
    const cmd = creerCommande(), etat = { b: new Float64Array(17), ax: new Float64Array(4) };
    let tenuDepuis = -1, attendre = 0.8, appuiFin = -1, visee: number | null = null, enVol: Any = null, passeur = -1;
    for (let k = 0; k < 180 * 60 && m.phase !== 'fin'; k++) {
      etat.b.fill(0); etat.ax.fill(0);
      if (m.phase === 'jeu') {
        const j = m.joueurs[m.controle[0] ?? 4], p = porteur(m), b = m.balle;
        if (p === j) {
          if (tenuDepuis < 0) { tenuDepuis = m.t; attendre = 0.5 + rng.u() * 0.8; visee = null; }
          if (m.t - tenuDepuis < attendre && appuiFin < 0) {
            // il conduit vers le but d'en face, à 70 %
            const zb = butDe(1); const dx = -j.p.x * 0.3, dz = zb - j.p.z, L = Math.hypot(dx, dz) || 1;
            etat.ax[0] = (dx / L) * 0.7; etat.ax[1] = -(dz / L) * 0.7;
          } else {
            if (visee == null) {
              const co = m.joueurs.filter((o: Any) => o.e === 0 && !o.gardien && o !== j && !o.absent);
              visee = co[Math.floor(rng.u() * co.length)].i;
              appuiFin = m.t + 0.1; passeur = j.i;
            }
            const o = m.joueurs[visee!], dx = o.p.x - j.p.x, dz = o.p.z - j.p.z, L = Math.hypot(dx, dz) || 1;
            etat.ax[0] = dx / L; etat.ax[1] = -dz / L;
            if (m.t < appuiFin) etat.b[B_PASSE] = 1;
          }
        } else {
          if (!(enVol && b.dernier === enVol.de)) { tenuDepuis = -1; }
          if (m.t > appuiFin + 0.6) appuiFin = -1;
          // sans la balle : vers la balle
          const dx = b.p.x - j.p.x, dz = b.p.z - j.p.z, L = Math.hypot(dx, dz);
          if (L > 0.5) { etat.ax[0] = dx / L; etat.ax[1] = -dz / L; }
        }
      }
      lireManette(cmd, etat, m.t, m, 0, versJeu);
      for (let s = 0; s < 2; s++) {
        pas(m, [intentionDe(cmd), null]);
        for (const ev of m.evts) {
          if (ev.type === 'passe' && visee != null && ev.j === passeur) {
            tentees++;
            const o = m.joueurs[visee], pj = m.joueurs[ev.j];
            distances.push(Math.hypot(o.p.x - pj.p.x, o.p.z - pj.p.z));
            // (le couloir : un adversaire de champ à moins de 1,1 m du segment passeur → receveur, au départ)
            let ouvert = true;
            for (const x of m.joueurs) {
              if (x.e === pj.e || x.absent || x.gardien) continue;
              const ex = o.p.x - pj.p.x, ez = o.p.z - pj.p.z, E = ex * ex + ez * ez || 1;
              const u = Math.max(0, Math.min(1, ((x.p.x - pj.p.x) * ex + (x.p.z - pj.p.z) * ez) / E));
              if (Math.hypot(x.p.x - pj.p.x - ex * u, x.p.z - pj.p.z - ez * u) < 1.1) ouvert = false;
            }
            if (ouvert) ouvertes++;
            enVol = { de: ev.j, a: visee, recepteur: m.balle.recepteur, t: m.t, ouvert };
            visee = null; tenuDepuis = -1; appuiFin = -1;
          } else if (enVol && (ev.type === 'controle' || ev.type === 'capte' || ev.type === 'tacleBalle')) {
            if (ev.j === enVol.de && m.t - enVol.t < 0.35) continue;
            const q = m.joueurs[ev.j];
            if (ev.j === enVol.a) { auReceveur++; if (enVol.ouvert) ouvertesOk++; }
            else if (q.e === 0) aUnCoequipier++;
            else interceptees++;
            enVol = null;
          } else if (enVol && (ev.type === 'frappe' || ev.type === 'but' || ev.type === 'engagement' || ev.type === 'coupFranc')) { perdues++; enVol = null; }
        }
        m.evts.length = 0;
      }
      if (enVol && m.t - enVol.t > 4) { perdues++; enVol = null; }
      if (visee != null && appuiFin > 0 && m.t > appuiFin + 1.2) { sansDepart++; visee = null; tenuDepuis = -1; appuiFin = -1; }
    }
  }
  RES.passesHumaines = { matchs: N_PASSES, tentees, couloirLibre: ouvertes, couloirLibreAuReceveurPct: (100 * ouvertesOk) / (ouvertes || 1), auReceveurPct: (100 * auReceveur) / (tentees || 1), aUnCoequipierPct: (100 * (auReceveur + aUnCoequipier)) / (tentees || 1), intercepteesPct: (100 * interceptees) / (tentees || 1), perduesPct: (100 * perdues) / (tentees || 1), sansDepart, distanceMoy_m: moy(distances) };
  const P = RES.passesHumaines;
  console.log(`  ${P.tentees} passes (${P.couloirLibre} au couloir libre, dont ${P.couloirLibreAuReceveurPct.toFixed(1)} % au receveur) : au receveur visé ${P.auReceveurPct.toFixed(1)} %, à un coéquipier ${P.aUnCoequipierPct.toFixed(1)} %, interceptées ${P.intercepteesPct.toFixed(1)} %, perdues ${P.perduesPct.toFixed(1)} % ; appuis sans passe ${P.sansDepart} ; ${P.distanceMoy_m.toFixed(1)} m en moyenne`);
}

// ─────────────────────────── le gardien : les pieds ───────────────────────────
async function gardien() {
  const THREE: Any = await import('three');
  const { GLTFLoader }: Any = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { MeshoptDecoder }: Any = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
  const Pak: Any = await import('../src/lib/jeu/pakcodec.js');
  const Lib: Any = await import('../src/lib/jeu/library.js');
  const Ani: Any = await import('../src/lib/jeu/rendu/animateur.js');
  const Eta: Any = await import('../src/lib/jeu/rendu/etat.js');
  const Bcl: Any = await import('../src/lib/jeu/sim/boucle.js');
  const avert = console.warn; console.warn = (...a: unknown[]) => { if (!String(a[0]).startsWith('THREE.')) avert(...a); };
  await MeshoptDecoder.ready;
  async function paquet(nom: string) {
    const glb = Pak.unpak(new Uint8Array(fs.readFileSync(path.join(RACINE, `public/jeu/anims/${nom}.pak`))), nom);
    const g = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
    g.scene.updateMatrixWorld(true);
    const index = JSON.parse(fs.readFileSync(path.join(RACINE, 'public/jeu/anims/index.json'), 'utf8'))[nom] ?? {};
    for (const c of g.animations) c.userData = { ...(index[c.name] ?? {}), pack: nom };
    return { scene: g.scene, rig: Lib.makeRig(g.scene, false), clips: g.animations };
  }
  const PAQ: Record<string, Any> = {};
  const noms = fs.readdirSync(path.join(RACINE, 'public/jeu/anims')).filter((f) => f.endsWith('.pak') && f !== 'mesures.pak').map((f) => f.replace(/\.pak$/, ''));
  for (const n of noms) PAQ[n] = await paquet(n);
  const gard = noms.filter((n) => /^keeper|^celeb/.test(n)), champ = noms.filter((n) => /^player|^celeb/.test(n));
  function creerPerso(estGardien: boolean) {
    const corps = PAQ.player.scene.clone(true);
    corps.scale.setScalar(Clp.HANCHE);
    const racine = new THREE.Group(); racine.add(corps); racine.updateMatrixWorld(true);
    const rig = Lib.makeRig(corps, false);
    const mixer = new THREE.AnimationMixer(corps);
    const actions: Record<string, Any> = {};
    for (const p of estGardien ? gard : champ) for (const c of PAQ[p].clips) {
      const b = Lib.bindClip(c, PAQ[p].rig, rig);
      const a = mixer.clipAction(b);
      if (!b.userData.loop) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      actions[c.name] = a;
    }
    const os: Record<string, Any> = {};
    for (const [k, b] of rig.bones) os[k] = b.obj;
    return { racine, corps, rig, os, actions, mixer };
  }
  const hG: number[] = [], hGplace: number[] = [], hC: number[] = [];
  let hGmax = 0, hGmaxOu = '';
  const parGeste: Record<string, number[]> = {};
  const w = new THREE.Vector3();
  for (let g = 1; g <= N_GARDIEN; g++) {
    const M: Any = creerMonde({ graine: 40 + g, duree: 90, humains: [false, false], aides: [0, 0] });
    demarrer(M, { intro: false });
    const suivis = [0, 1, 5, 6, 4].map((i) => M.joueurs[i]);
    const persos = suivis.map((j: Any) => creerPerso(j.gardien));
    const anims = persos.map((p: Any, k: number) => Ani.creerAnimateur(p, { gardien: suivis[k].gardien, versMonde3: (v: Any, out: Any) => out.set(v.x, v.y ?? 0, v.z) }));
    const caches = suivis.map(() => ({}));
    const interp = suivis.map(() => ({ x: 0, z: 0, cap: 0 }));
    const bc = Bcl.creerBoucle(M), bI = { x: 0, y: 0, z: 0 };
    for (let k = 0; k < 100 * 60 && M.phase !== 'fin'; k++) {
      Bcl.avancer(bc, 1 / 60, null, 1, () => { M.evts.length = 0; });
      const p = porteur(M);
      Bcl.balleInterpolee(bc, bI);
      for (let n = 0; n < suivis.length; n++) {
        const j = suivis[n], I = interp[n];
        Bcl.joueurInterpole(bc, j.i, I);
        const P = persos[n], A = anims[n];
        P.racine.position.set(I.x, 0, I.z); P.racine.rotation.y = I.cap;
        const e = Eta.etatAnim(M, j, I, p, bI, caches[n]);
        A.maj(e, 1 / 60);
        P.racine.updateMatrixWorld(true);
        if (M.phase !== 'jeu' || k < 30) continue;
        let bas = Infinity;
        for (const nm of ['lefttoebase', 'righttoebase', 'leftfoot', 'rightfoot']) {
          const o = P.os[nm]; if (!o) continue;
          o.getWorldPosition(w);
          // (la cheville est à ~8 cm du gazon pied à plat : on la ramène à la hauteur de l'orteil)
          bas = Math.min(bas, nm.endsWith('foot') ? w.y - 0.08 : w.y);
        }
        if (!Number.isFinite(bas)) continue;
        const type = j.g?.type ?? null;
        if (j.gardien) {
          if (type === 'plongeon' || type === 'battu' || (type === 'arret' && /k_high|k_low|dive/.test(j.g.nom))) continue;
          hG.push(bas);
          if (!j.g) hGplace.push(bas);
          (parGeste[j.g?.nom ?? A.diag.etat] ??= []).push(bas);
          if (bas > hGmax) { hGmax = bas; hGmaxOu = `graine ${40 + g}, ${M.t.toFixed(1)} s, ${j.g?.nom ?? A.diag.etat}`; }
        } else if (j.mode === 'loco') hC.push(bas);
      }
    }
  }
  const q = (t: number[], f: number) => { const s = [...t].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * f))] ?? 0; };
  const pg: Record<string, Any> = {};
  for (const [k, v] of Object.entries(parGeste)) pg[k] = { n: v.length, moy_cm: 100 * moy(v), max_cm: 100 * Math.max(...v) };
  RES.gardien = {
    matchs: N_GARDIEN, images: hG.length,
    piedGardien_moy_cm: 100 * moy(hG), piedGardien_p90_cm: 100 * q(hG, 0.9), piedGardien_max_cm: 100 * hGmax, ou: hGmaxOu,
    piedGardienEnPlace_moy_cm: 100 * moy(hGplace), piedGardienEnPlace_max_cm: 100 * Math.max(...hGplace),
    piedChamp_moy_cm: 100 * moy(hC), piedChamp_p90_cm: 100 * q(hC, 0.9),
    parGeste: pg,
  };
  const G = RES.gardien;
  console.log(`Gardien (pied le plus bas au-dessus du gazon, hors plongeon ; ${N_GARDIEN} matchs de 90 s) : moyenne ${G.piedGardien_moy_cm.toFixed(1)} cm, p90 ${G.piedGardien_p90_cm.toFixed(1)} cm, max ${G.piedGardien_max_cm.toFixed(1)} cm (${G.ou}) ; en place ${G.piedGardienEnPlace_moy_cm.toFixed(1)} cm (max ${G.piedGardienEnPlace_max_cm.toFixed(1)}) ; joueurs de champ en course ${G.piedChamp_moy_cm.toFixed(1)} cm (p90 ${G.piedChamp_p90_cm.toFixed(1)})`);
  for (const [k, v] of Object.entries(pg).sort((a: Any, b: Any) => b[1].n - a[1].n).slice(0, 12)) console.log(`    ${k.padEnd(14)} ${String(v.n).padStart(6)} images · moyenne ${v.moy_cm.toFixed(1)} cm · max ${v.max_cm.toFixed(1)} cm`);
}

(async () => {
  if (faire('gardien')) await gardien();
  if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify(RES, null, 2)); console.log(`→ ${jsonOut}`); }
  void PAS; void LB; void sens;
})();
