// Le banc des manettes du jeu Bola (bola-app#23), sans navigateur : entrees/commande.js (zone morte, jauges, gestes du
// stick droit, défense) et entrees/manettes.js (marques, ordre standard, table de secours de la DualShock 4) sur la
// vraie simulation (sim/monde.js). Des manettes inventées jouent ; chaque contrôle imprime sa mesure, et le banc sort
// en erreur (code 1) si un critère manque.
//
//   npx tsx tools/jeu-banc-manettes.ts
//
// (bola-app#26, lot 3) Plus : le lecteur du stick droit (motifs relatifs au cap, à 0°, 90° et 180°) ; chaque ligne du
// tableau des touches (entrees/touches.js) jouée à la manette (Xbox et PlayStation partagent l'ordre standard des
// boutons) et au clavier (entrees/clavier.js), avec l'action et l'événement de la simulation attendus ; le second doigt
// du pouce donne les mêmes gestes ; l'enchaînement crochet → roulette → frappe ; aucun geste en défense ; le tableau
// exporté en Markdown (--touches=chemin.md).
//
// Couvert : zone morte et gâchettes ; marques et ordre des boutons (Xbox, DualSense, DualShock 4 sans mapping, manette
// inconnue) ; sprint à la gâchette ; passe et frappe à la puissance d'appui ; lobée, profondeur, finesse ; crochet,
// roulette, semelle ; pressing, tacle glissé, tacle debout, changer de joueur (LB et stick droit), renfort, sortie du
// gardien ; deux manettes sur un match entier (0 NaN, fin atteinte, même graine et mêmes manettes = même empreinte) ;
// débranchement et rebranchement en plein match (l'IA reprend au pas suivant) ; l'IA contre l'IA inchangée.
import * as Mon from '../src/lib/jeu/sim/monde.js';
import * as Gst from '../src/lib/jeu/sim/gestes.js';
import * as Cmd from '../src/lib/jeu/entrees/commande.js';
import * as Man from '../src/lib/jeu/entrees/manettes.js';
import * as Clp from '../src/lib/jeu/sim/clips.js';
import * as Gs from '../src/lib/jeu/entrees/geste-stick.js';
import * as Clv from '../src/lib/jeu/entrees/clavier.js';
import * as Tch from '../src/lib/jeu/entrees/touches.js';
import fs from 'node:fs';
import path from 'node:path';

// les mesures des clips : la simulation refuse de démarrer sans elles (sim/clips.js)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Clp as any).chargerMesures(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public/jeu/anims/mesures.pak')));

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const { creerMonde, demarrer, pas, empreinte, engagement, changerHumains }: Any = Mon;
const { porteur }: Any = Gst;
const { creerCommande, lireManette, intentionDe, zoneMorte, gachette, BOUTONS: K }: Any = Cmd;
const { marqueDe, normaliser }: Any = Man;

let echecs = 0;
function verifier(nom: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'ok   ' : 'ÉCHEC'} ${nom} : ${detail}`);
  if (!ok) echecs++;
}
const versJeu = (sx: number, sy: number) => ({ x: -sy, z: -sx });
const f2 = (x: number) => x.toFixed(2);

/** Une manette au repos. */
const pad = () => ({ b: new Float64Array(17), ax: new Float64Array(4) });

/** Un match à une manette (les Noirs), sans intro ; le banc fait les images de 1/60 s (2 pas). */
function partie(graine = 3, humains = [true, false]) {
  const m: Any = creerMonde({ graine, humains, aides: humains.map((h) => (h ? 0.5 : 0)) });
  demarrer(m, { intro: false });
  const cmds = [creerCommande(), creerCommande()];
  const etats = [pad(), pad()];
  let t = 0;
  const evts: Any[] = [];
  const actions: Any[] = []; // les actions sorties des manettes des Noirs
  const image = (fixer?: (e: Any[], t: number) => void) => {
    fixer?.(etats, t);
    for (const e of [0, 1]) if (m.humains[e]) lireManette(cmds[e], etats[e], t, m, e, versJeu);
    if (cmds[0].attente) actions.push({ ...cmds[0].attente });
    for (let k = 0; k < 2; k++) {
      pas(m, [m.humains[0] ? intentionDe(cmds[0]) : null, m.humains[1] ? intentionDe(cmds[1]) : null]);
      evts.push(...m.evts); m.evts.length = 0;
    }
    t += 1 / 60;
  };
  const images = (n: number, fixer?: (e: Any[], t: number) => void) => { for (let i = 0; i < n; i++) image(fixer); };
  // (une première image au repos : une manette ne déclenche rien à sa première lecture)
  image();
  return { m, cmds, etats, image, images, evts, actions, get t() { return t; } };
}

// ── zone morte, gâchettes ──
{
  const a = zoneMorte(0.12, 0.1).amp, b = zoneMorte(0.3, 0).amp, c = zoneMorte(1, 0).amp, d = zoneMorte(0.7, 0.7).amp;
  verifier('zone morte', a === 0 && b > 0 && b < 0.15 && c === 1 && d === 1, `0,16 → ${f2(a)} ; 0,3 → ${f2(b)} ; 1 → ${f2(c)} ; diagonale pleine → ${f2(d)}`);
  verifier('gâchette', gachette(0.05) === 0 && Math.abs(gachette(0.54) - 0.5) < 1e-9 && gachette(1) === 1, `0,05 → 0 ; 0,54 → ${f2(gachette(0.54))} ; 1 → 1`);
}

// ── marques et ordre des boutons ──
{
  const xb = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
  const ds = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
  const ds4 = '054c-05c4-Sony Computer Entertainment Wireless Controller';
  const autre = '0079-0006-Generic   USB  Joystick  ';
  verifier('marques', marqueDe(xb) === 'xbox' && marqueDe(ds) === 'playstation' && marqueDe(ds4) === 'playstation' && marqueDe(autre) === 'generique', `${marqueDe(xb)}, ${marqueDe(ds)}, ${marqueDe(ds4)}, ${marqueDe(autre)}`);
  const btn = (n: number, on: number[]) => Array.from({ length: n }, (_, i) => ({ pressed: on.includes(i), value: on.includes(i) ? 1 : 0 }));
  const std = normaliser({ id: ds, mapping: 'standard', buttons: btn(17, [2]), axes: [0.5, 0, 0, 0] }, pad());
  // DualShock 4 sous Firefox Linux : □ est le bouton brut 3, R2 l'axe 5
  const brut = normaliser({ id: ds4, mapping: '', buttons: btn(13, [3]), axes: [0, 0, -1, 0.4, 0, 1, 1, 0] }, pad());
  const rien = normaliser({ id: autre, mapping: '', buttons: btn(12, []), axes: [0, 0] }, pad());
  verifier('ordre standard', std && std.b[2] === 1 && std.ax[0] === 0.5, `□ → b[2] = ${std?.b[2]}`);
  verifier('DualShock 4 sans mapping', !!brut && brut.b[2] === 1 && brut.b[7] === 1 && brut.b[6] === 0 && brut.b[15] === 1 && brut.ax[2] === 0.4, `□ → ${brut?.b[2]}, R2 → ${brut?.b[7]}, croix droite → ${brut?.b[15]}, stick droit x → ${brut?.ax[2]}`);
  verifier('manette inconnue ignorée', rien === null, `normaliser → ${rien}`);
}

// ── sprint à la gâchette (le n° 10 seul, la balle laissée loin derrière lui) ──
{
  const vitesse = (rt: number) => {
    const m: Any = creerMonde({ graine: 3, humains: [true, false], aides: [0.5, 0], presents: [4] });
    demarrer(m, { intro: false });
    m.balle.p.z = 12; m.balle.possesseur = null;
    const c = creerCommande(), e = pad();
    let v = 0;
    // 2,5 s de course, vers le but attaqué (avant le panneau)
    for (let i = 0; i < 150; i++) {
      e.ax[0] = 1; e.b[K.RT] = rt;
      lireManette(c, e, i / 60, m, 0, versJeu);
      for (let k = 0; k < 2; k++) pas(m, [intentionDe(c), null]);
      const j = m.joueurs[4]; v = Math.hypot(j.v.x, j.v.z);
    }
    return v;
  };
  const v0 = vitesse(0), v5 = vitesse(0.54), v1 = vitesse(1);
  verifier('sprint à la gâchette', v5 > v0 + 0.5 && v1 > v5 + 0.5, `stick plein ${f2(v0)} m/s ; RT à moitié ${f2(v5)} m/s ; RT à fond ${f2(v1)} m/s`);
}

/** Appuie sur un bouton pendant n images, puis le relâche. */
function appui(P: Any, bouton: number, n: number, autres?: (e: Any[]) => void) {
  for (let i = 0; i < n + 1; i++) P.image((e: Any[]) => { e[0].b.fill(0); autres?.(e); e[0].b[bouton] = i < n ? 1 : 0; });
}

// ── passes et frappes à la puissance d'appui ──
// (bola-app#32 : l'action part à l'appui, chargée ; la puissance est celle du relâché, lue par la simulation à
// l'impact : on la lit dans l'événement « passe » / « frappe » ; la frappe est sur B / ○, la combinaison lue à l'appui)
{
  const P = partie(5);
  const vus: Any[] = P.actions;
  appui(P, K.A, 12); // 0,2 s
  P.images(90);
  const evP = P.evts.find((e: Any) => e.type === 'passe');
  engagement(P.m, 0); P.m.phase = 'jeu';
  vus.length = 0; P.evts.length = 0;
  appui(P, K.B, 27); // 0,45 s
  P.images(30);
  const evF = P.evts.find((e: Any) => e.type === 'frappe');
  verifier('passe à l\'appui', !!evP && Math.abs(evP.p - 12 / 60 / 0.9) < 0.04, `0,2 s → p = ${f2(evP?.p ?? -1)}, passe jouée : ${!!evP}`);
  verifier('frappe à l\'appui (B / ○)', !!evF && Math.abs(evF.p - 0.5) < 0.04, `0,45 s → p = ${f2(evF?.p ?? -1)}, frappe partie : ${!!evF}`);
  // la commande à l'appui : centre (passe lobée au milieu), profondeur, enroulée, piqué, puissante, extérieur, R2 + ○
  const types: string[] = [];
  for (const [b, mod] of [[K.X, -1], [K.Y, -1], [K.B, K.RB], [K.B, K.LB], [K.A, K.RB], [K.B, K.LT], [K.B, K.RT]] as [number, number][]) {
    engagement(P.m, 0); P.m.phase = 'jeu'; vus.length = 0;
    appui(P, b, 20, (e) => { if (mod >= 0) e[0].b[mod] = 1; });
    types.push(vus[0] ? `${vus[0].commande}:${vus[0].type}` : 'rien');
    P.images(60);
  }
  const attendu = 'centre:lob,profondeur:profondeur,finesse:finesse,pique:lobFrappe,passePuissante:passe,exterieur:exterieur,ras:frappe';
  verifier('commandes à l\'appui (□, △, R1 + ○, L1 + ○, R1 + ✕, L2 + ○, R2 + ○)', types.join(',') === attendu, types.join(', '));
}

// ── stick droit : crochet, roulette ; R3 : semelle ──
{
  const P = partie(9);
  const evt = (t: string) => P.evts.some((e: Any) => e.type === t);
  P.images(40, (e) => { e[0].ax[0] = 1; });
  // coup sec vers le haut de l'écran
  for (let i = 0; i < 10; i++) P.image((e) => { e[0].ax[0] = 1; e[0].ax[3] = i < 5 ? -1 : 0; });
  P.images(40, (e) => { e[0].ax[0] = 1; });
  const crochet = evt('crochet');
  // (depuis que la balle ne traverse plus les corps, l'attaquant blanc placé devant au coup d'envoi la bloque : on
  // l'écarte, le geste se joue balle au pied, sans adversaire sur la route)
  const ecarter = () => { const o = P.m.joueurs[9]; o.p.x = 7; o.p.z = 6; };
  engagement(P.m, 0); P.m.phase = 'jeu'; ecarter();
  P.images(40, (e) => { e[0].ax[0] = 1; });
  // demi-cercle : du bas, par la droite, vers le haut
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + (Math.PI * i) / 16; P.image((e) => { e[0].ax[0] = 1; e[0].ax[2] = Math.cos(a); e[0].ax[3] = -Math.sin(a); }); }
  P.images(4, (e) => { e[0].ax[0] = 1; e[0].ax[2] = 0; e[0].ax[3] = 0; });
  const roulette = evt('roulette');
  P.images(120);
  engagement(P.m, 0); P.m.phase = 'jeu'; ecarter();
  P.images(60, (e) => { e[0].ax[0] = 1; });
  for (let i = 0; i < 4; i++) P.image((e) => { e[0].ax[0] = 1; e[0].b[K.R3] = i < 2 ? 1 : 0; });
  const semelle = evt('semelle');
  verifier('gestes du stick droit', crochet && roulette && semelle, `crochet ${crochet}, roulette ${roulette}, semelle ${semelle}`);
}

// ── défense ──
{
  const P = partie(11);
  engagement(P.m, 1); P.m.phase = 'jeu';
  const ev = (t: string) => P.evts.filter((e: Any) => e.type === t).length;
  const c0 = P.m.controle[0];
  P.images(2, (e) => { e[0].b.fill(0); e[0].b[K.LB] = 1; });
  const c1 = P.m.controle[0];
  P.images(2, (e) => { e[0].b.fill(0); });
  // stick droit vers le bas de l'écran (repère du jeu : +x)
  P.images(3, (e) => { e[0].ax[3] = 1; });
  P.images(3, (e) => { e[0].ax[3] = 0; });
  const c2 = P.m.controle[0];
  verifier('changer de joueur', c1 !== c0 && ev('changer') >= 2, `LB : ${c0} → ${c1} ; stick droit : → ${c2} ; ${ev('changer')} changements`);
  // pressing : le joueur va au porteur
  const j = () => P.m.joueurs[P.m.controle[0]];
  const p = porteur(P.m);
  const d0 = p ? Math.hypot(p.p.x - j().p.x, p.p.z - j().p.z) : 0;
  P.images(40, (e) => { e[0].b.fill(0); e[0].b[K.A] = 1; e[0].b[K.RB] = 1; e[0].b[K.Y] = 1; });
  const renfort = P.m.renfort[0], sortie = P.m.sortie[0];
  const q = porteur(P.m) ?? P.m.balle;
  const d1 = Math.hypot((q.p?.x ?? q.p.x) - j().p.x, (q.p?.z ?? q.p.z) - j().p.z);
  verifier('pressing, renfort, sortie', d1 < d0 && renfort && sortie, `distance au porteur ${f2(d0)} → ${f2(d1)} m ; renfort ${renfort} ; sortie ${sortie}`);
  P.images(2, (e) => { e[0].b.fill(0); });
  // (bola-app#32 : l'IA joue plus vite, la balle a souvent changé de pied pendant le pressing ; on remet les Blancs au
  // coup d'envoi, le joueur tenu à 1,6 m du porteur, pour essayer le tacle en défense)
  engagement(P.m, 1); P.m.phase = 'jeu';
  { const pb = porteur(P.m), jj = j(); if (pb) { jj.p.x = pb.p.x; jj.p.z = pb.p.z - 1.6; jj.cap = 0; jj.v.x = 0; jj.v.z = 0; } }
  const avant = j();
  // (bola-app#26, lot 3 : la disposition du genre, X / □ tacle glissé, B / ○ tacle debout)
  P.images(2, (e) => { e[0].b[K.X] = 1; });
  const glisse = avant.g?.type === 'tacle' || P.evts.some((e: Any) => e.type === 'tacleBalle' || e.type === 'tacleJambes');
  verifier('tacle glissé (X)', glisse, `geste ${avant.g?.type ?? 'aucun'} ; porteur ${porteur(P.m)?.i ?? '-'} (${porteur(P.m)?.e ?? '-'}), joueur ${avant.i}, mode ${avant.mode}, attaque ${(Cmd as Any).enAttaque(P.m, 0)}, dernière ${JSON.stringify(P.cmds[0].dernier)}`);
}

// ── deux manettes, un match entier, reproductible ──
function deuxManettes(graine: number) {
  const P = partie(graine, [true, true]);
  // deux joueurs inventés, à graine : ils courent vers le but adverse, sprintent, passent, frappent, taclent
  let s = graine * 2654435761 >>> 0;
  const u = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return s / 4294967296; };
  const tenus = [[0, 0], [0, 0]];
  let nan = 0, images = 0;
  while (P.m.phase !== 'fin' && images < 60 * 200) {
    P.image((e) => {
      for (const k of [0, 1]) {
        const E = e[k];
        const sens = k === 0 ? 1 : -1;
        E.ax[0] = sens * (0.6 + 0.4 * u()); E.ax[1] = (u() - 0.5) * 1.2;
        E.b[K.RT] = u() < 0.5 ? 1 : 0;
        const [bt, n] = tenus[k];
        if (n > 0) { E.b[bt] = 1; tenus[k][1]--; } else { E.b.fill(0, 0, 6); if (u() < 0.03) tenus[k] = [[K.A, K.X, K.B, K.Y, K.LB][Math.floor(u() * 5)], 3 + Math.floor(u() * 40)]; }
      }
    });
    images++;
    for (const j of P.m.joueurs) if (!Number.isFinite(j.p.x + j.p.z + j.v.x + j.v.z)) nan++;
    if (!Number.isFinite(P.m.balle.p.x + P.m.balle.p.y + P.m.balle.p.z)) nan++;
  }
  return { m: P.m, nan, evts: P.evts };
}
{
  const a = deuxManettes(21), b = deuxManettes(21);
  const st = a.m.stats;
  verifier('deux manettes, match entier', a.m.phase === 'fin' && a.nan === 0, `fin ${a.m.phase === 'fin'}, NaN ${a.nan}, score ${a.m.score.join('-')}, ${st.passes} passes, ${st.tirs} frappes, ${st.tacles} tacles`);
  verifier('mêmes manettes, même match', empreinte(a.m) === empreinte(b.m), `${empreinte(a.m)} = ${empreinte(b.m)}`);
}

// ── débranchée en plein match, puis rebranchée ──
{
  const P = partie(13, [true, true]);
  P.images(600, (e) => { e[0].ax[0] = 1; e[1].ax[0] = -1; });
  const c1 = P.m.controle[1];
  changerHumains(P.m, [true, false], [0.5, 0]);
  P.image();
  const j1 = P.m.joueurs[c1];
  const reprise = P.m.controle[1] === null && j1.aide === 0;
  P.images(600, (e) => { e[0].ax[0] = 1; });
  changerHumains(P.m, [false, false], [0, 0]);
  P.images(600);
  changerHumains(P.m, [true, true], [0.5, 0.5]);
  P.images(600, (e) => { e[0].ax[0] = 1; e[1].ax[0] = -1; });
  let nan = 0;
  for (const j of P.m.joueurs) if (!Number.isFinite(j.p.x + j.v.x + j.p.z + j.v.z)) nan++;
  verifier('débranchement à chaud', reprise && nan === 0 && P.m.controle[1] != null, `l'IA reprend les Blancs au pas suivant : ${reprise} ; rebranchée : joueur ${P.m.controle[1]} ; NaN ${nan}`);
}

// ── l'IA contre l'IA : la même empreinte qu'avant les manettes ──
{
  const m: Any = creerMonde({ graine: 7, duree: 150, humains: [false, false], aides: [0, 0] });
  demarrer(m, { intro: false });
  for (let i = 0; i < 18000; i++) { pas(m); m.evts.length = 0; }
  // (la référence de tools/jeu-banc.ts --graine=7 ; re-bénie par bola-app#26, lot 1 : vrai tacle glissé, chutes et
  // relevés, contrôles anticipés, plongeons bas, IA qui glisse moins souvent — d3f4e37b avant ; re-bénie par le lot 2 :
  // duels (tirage, poussée de dos, tacle contré), fautes et avantage, effet au pied, contrôle raté, centres et reprises,
  // appels, une-deux, pressing coordonné, gardien sur l'angle — 7c88787c avant ; les manettes ne la changent pas)
  // (bola-app#32, lot A : la physique des corps plus vive, la balle aimantée, les passes dosées, les frappes à l'appui et la
  // prise automatique changent le match de l'IA ; 98ccc5d7 aux correctifs #26, 7919334a avant)
  // (bola-app#32, lot A2 : le geste de chaque commande — son clip, son élan, son rythme, 0,17 à 0,3 s pour l'IA au lieu de
  // 0,22 s partout —, le gardien qui plonge même tard et sort dans les pieds, les trois issues du tacle glissé et sa
  // portée selon la course, le tacle debout sans tirage au sort changent le match de l'IA ; 7fcad362 au lot A)
  const REF = '59097628';
  verifier('IA contre IA inchangée (graine 7)', empreinte(m) === REF, `${empreinte(m)} (attendu ${REF}, celle du banc physique)`);
}

// ── les correctifs du contrôle : gâchettes vues au repos, Xbox sous Linux, manette rebranchée sous un autre index ──
{
  const btn = (n: number, on: number[]) => Array.from({ length: n }, (_, i) => ({ pressed: on.includes(i), value: on.includes(i) ? 1 : 0 }));
  const ds4 = '054c-05c4-Sony Computer Entertainment Wireless Controller';
  const vu = { repos: [false, false] };
  const a0 = normaliser({ id: ds4, mapping: '', buttons: btn(13, []), axes: [0, 0, 0, 0, 0, 0, 0, 0] }, pad(), vu);
  const g0 = a0.b[6], d0 = a0.b[7];
  normaliser({ id: ds4, mapping: '', buttons: btn(13, []), axes: [0, 0, -1, 0, 0, -1, 0, 0] }, pad(), vu);
  const a2 = normaliser({ id: ds4, mapping: '', buttons: btn(13, []), axes: [0, 0, 1, 0, 0, 0, 0, 0] }, pad(), vu);
  verifier('gâchettes DS4 à 0 avant le premier appui', g0 === 0 && d0 === 0 && a2.b[6] === 1 && Math.abs(a2.b[7] - 0.5) < 1e-9, `axes à 0 au départ : L2 ${f2(g0)}, R2 ${f2(d0)} ; vues au repos puis enfoncées : L2 ${f2(a2.b[6])}, R2 ${f2(a2.b[7])}`);
  const x360 = '045e-028e-Microsoft X-Box 360 pad';
  const x = normaliser({ id: x360, mapping: '', buttons: btn(11, [0, 7]), axes: [0.5, 0, -1, 0, 0, -1, 0, 1] }, pad(), { repos: [false, false] });
  verifier('Xbox 360 sans mapping (Linux)', !!x && x.b[0] === 1 && x.b[9] === 1 && x.b[13] === 1 && x.ax[0] === 0.5 && x.b[6] === 0, x ? `reconnue : A ${x.b[0]}, Menu ${x.b[9]}, croix bas ${x.b[13]}, LX ${f2(x.ax[0])}, LT ${f2(x.b[6])}` : 'non reconnue');
  // rebranchée sous un autre index : elle retrouve son équipe d'avant (les Blancs), pas la première libre
  const pads: Any[] = [];
  const g = (index: number, id: string, on: number[] = []) => ({ index, id, connected: true, mapping: 'standard', buttons: btn(17, on), axes: [0, 0, 0, 0] });
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true, writable: true });
  const M = Man.creerManettes({ versJeu });
  const xb = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', ps = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';
  M.mode('salon');
  pads[0] = g(0, xb); pads[1] = g(1, ps); M.lire(0, null);
  pads[0] = g(0, xb, [0]); pads[1] = g(1, ps, [0]); M.lire(0.02, null); // A / ✕ : la Xbox chez les Noirs, la DualSense chez les Blancs
  pads[0] = g(0, xb); pads[1] = g(1, ps); M.lire(0.04, null);
  const avant = M.equipes().map((p: Any) => p?.marque ?? null).join('/');
  const m2: Any = creerMonde({ graine: 3, humains: [true, true], aides: [0.5, 0.5] }); demarrer(m2, { intro: false });
  M.mode('match');
  pads.length = 1; M.lire(1, m2);                                    // la DualSense se débranche
  pads[1] = undefined; pads[2] = g(2, ps); M.lire(2, m2);             // elle revient sous l'index 2
  pads[2] = g(2, ps, [0]); M.lire(2.02, m2);                          // ✕ pour rejoindre
  const apres = M.equipes().map((p: Any) => p?.marque ?? null).join('/');
  const nPlaces = M.instantane().pads.length;
  M.detruire();
  verifier('manette rebranchée sous un autre index', avant === 'xbox/playstation' && apres === 'xbox/playstation' && nPlaces === 2, `avant ${avant}, après ${apres} ; ${nPlaces} places branchées`);
}

// ══ bola-app#26, lot 3 : touches et gestes ══
const { creerLecteur, lireGesteStick, stickDoigt }: Any = Gs;
const { etatDepuisTouches, creerEtatClavier }: Any = Clv;
const { TOUCHES, touchesMarkdown }: Any = Tch;

// ── le lecteur du stick droit : chaque motif, relatif au cap (0°, 90°, 180°) ──
{
  // un stick d'écran (sx, sy) dont la direction est « rel » (avant, gauche…) pour un joueur de cap « cap » : on passe
  // par le repère du jeu ; versJeu(sx, sy) = (−sy, −sx), donc l'inverse : sx = −gz, sy = −gx
  const ecran = (cap: number, a: number) => { const h = cap + a; return { sx: -Math.cos(h), sy: -Math.sin(h) }; };
  const REL: Record<string, number> = { avant: 0, gauche: Math.PI / 2, arriere: Math.PI, droite: -Math.PI / 2 };
  const fauxMonde = (cap: number, s: number, devant = false) => ({
    joueurs: [{ e: 0, p: { x: 0, z: 0 }, v: { x: Math.sin(cap) * s, z: Math.cos(cap) * s }, cap }, ...(devant ? [{ e: 1, p: { x: Math.sin(cap) * 0.9, z: Math.cos(cap) * 0.9 }, cap: cap + Math.PI }] : [])],
  });
  // un motif joué : une suite d'angles relatifs (rad) tenus chacun n images de 1/60 s, puis relâché
  const jouerMotif = (cap: number, angles: number[], n: number, s = 4, opts: Any = {}) => {
    const L = creerLecteur(), M = fauxMonde(cap, s, opts.devant), j = M.joueurs[0];
    let t = 0, a: Any = null;
    const lire = (sx: number, sy: number) => { const r = lireGesteStick(L, sx, sy, t, M, j, versJeu, !!opts.fin, !!opts.r3); if (r && !a) a = r; t += 1 / 60; };
    for (const ang of angles) for (let i = 0; i < n; i++) { const e = ecran(cap, ang); lire(e.sx, e.sy); }
    for (let i = 0; i < 3; i++) lire(0, 0);
    return a;
  };
  const cas: [string, () => Any, string][] = [];
  for (const capDeg of [0, 90, 180]) {
    const cap = (capDeg * Math.PI) / 180;
    cas.push([`${capDeg}° coup sec gauche en course`, () => jouerMotif(cap, [REL.gauche], 6), 'crochet']);
    cas.push([`${capDeg}° coup sec droite à l'arrêt`, () => jouerMotif(cap, [REL.droite], 6, 0), 'feinte']);
    cas.push([`${capDeg}° coup sec avant`, () => jouerMotif(cap, [REL.avant], 6), 'pousser']);
    cas.push([`${capDeg}° coup sec avant, défenseur collé`, () => jouerMotif(cap, [REL.avant], 6, 4, { devant: true }), 'petitPont']);
    cas.push([`${capDeg}° R3 + coup sec avant`, () => jouerMotif(cap, [REL.avant], 6, 4, { r3: true }), 'sombrero']);
    cas.push([`${capDeg}° coup sec arrière`, () => jouerMotif(cap, [REL.arriere], 6), 'talonnade']);
    cas.push([`${capDeg}° arrière maintenu`, () => jouerMotif(cap, [REL.arriere], 30), 'tirerArriere']);
    cas.push([`${capDeg}° quart avant → gauche`, () => jouerMotif(cap, [0, 0.4, 0.8, 1.2, 1.57], 3), 'passement']);
    cas.push([`${capDeg}° demi-cercle`, () => jouerMotif(cap, [3.14, 2.5, 1.9, 1.2, 0.6, 0], 3), 'roulette']);
  }
  const rates = cas.filter(([, f, att]) => f()?.type !== att).map(([n, f]) => `${n} → ${f()?.type ?? 'rien'}`);
  verifier('stick droit : motifs relatifs au cap (0°, 90°, 180°)', rates.length === 0, rates.length ? rates.join(' ; ') : `${cas.length} motifs, tous justes`);
  // le même stick d'écran donne deux gestes différents selon le cap (relatif au joueur, pas à l'écran)
  const L1 = creerLecteur(), L2 = creerLecteur();
  const M0 = fauxMonde(0, 4), M1 = fauxMonde(Math.PI, 4);
  let a0: Any = null, a1: Any = null;
  for (let i = 0; i < 9; i++) { const sx = i < 6 ? 1 : 0; a0 ??= lireGesteStick(L1, sx, 0, i / 60, M0, M0.joueurs[0], versJeu); a1 ??= lireGesteStick(L2, sx, 0, i / 60, M1, M1.joueurs[0], versJeu); }
  verifier('stick droit relatif au cap, pas à l\'écran', a0?.type === 'talonnade' && a1?.type === 'pousser', `coup sec vers la droite de l'écran : cap 0° → ${a0?.type}, cap 180° → ${a1?.type}`);
  // le second doigt du pouce : le même lecteur, par stickDoigt (46 px = à fond)
  const d = stickDoigt(0, -60), d0 = stickDoigt(10, 0);
  verifier('second doigt → stick', Math.abs(d.y - 1) < 1e-9 && Math.abs(d0.x - 10 / 46) < 1e-9, `60 px vers le haut → (${f2(d.x)}, ${f2(d.y)}) ; 10 px → ${f2(d0.x)}`);
  // pas de faux motif : un stick qui tourne lentement en 1 s n'est ni un quart ni un coup sec
  const lent = jouerMotif(0, [0, 0.3, 0.6, 0.9, 1.2], 14);
  const tour = lent?.type ?? 'rien';
  verifier('stick lent : pas de geste', tour === 'rien' || tour === 'tirerArriere' || tour === null, `quart de cercle en 1,2 s → ${tour}`);
}

// ── le tableau des touches, ligne par ligne, à la manette et au clavier ──
type Image = { b?: string[]; ls?: [number, number]; rs?: [number, number] };
const BTN: Record<string, number> = { A: K.A, B: K.B, X: K.X, Y: K.Y, LB: K.LB, RB: K.RB, LT: K.LT, RT: K.RT, R3: K.R3 };
// (bola-app#32 : Espace = B / ○, S = X / □)
const TOUCHE: Record<string, string> = { A: 'd', B: ' ', X: 's', Y: 'f', LB: 'q', RB: 'r', LT: 'c', RT: 'shift', R3: 'u' };
/** n images identiques. */
const tenir = (n: number, im: Image = {}): Image[] => Array.from({ length: n }, () => im);
/** Les touches tenues qui font cette image au clavier (I J K L relatives au joueur de cap « cap »). */
const versEcran = (gx: number, gz: number) => ({ sx: -gz, sy: -gx });
function touchesDe(im: Image, cap: number | null) {
  const s = new Set<string>();
  for (const b of im.b ?? []) s.add(TOUCHE[b]);
  const [lx, ly] = im.ls ?? [0, 0], [rx, ry] = im.rs ?? [0, 0];
  if (lx > 0.3) s.add('arrowright'); if (lx < -0.3) s.add('arrowleft'); if (ly > 0.3) s.add('arrowup'); if (ly < -0.3) s.add('arrowdown');
  if ((rx || ry) && cap == null) {
    // (en défense : le haut, la gauche, le bas, la droite de l'écran)
    if (ry > 0.3) s.add('i'); if (ry < -0.3) s.add('k'); if (rx < -0.3) s.add('j'); if (rx > 0.3) s.add('l');
  } else if (rx || ry) {
    const g = versJeu(rx, ry), fx = Math.sin(cap as number), fz = Math.cos(cap as number);
    const av = fx * g.x + fz * g.z, ga = fz * g.x - fx * g.z;
    if (av > 0.3) s.add('i'); if (av < -0.3) s.add('k'); if (ga > 0.3) s.add('j'); if (ga < -0.3) s.add('l');
  }
  return s;
}
// le monde d'une ligne : le n° 10 Noir (4) balle au pied, face au but attaqué (−z), et ce qu'il faut autour
type Situation = { libre?: boolean | number; air?: boolean; x?: number; z?: number; cap?: number; v?: number; adv?: [number, number, number][]; fixe?: boolean; defense?: boolean; partenaire?: [number, number, number] };
function monde(S: Situation) {
  const m: Any = creerMonde({ graine: 3, humains: [true, false], aides: [0.5, 0], presents: [0, 4, 5, ...(S.adv ?? []).map((a) => a[0]), ...(S.partenaire ? [S.partenaire[0]] : []), ...(S.defense ? [9] : [])] });
  demarrer(m, { intro: false });
  const j = m.joueurs[4], b = m.balle;
  const cap = S.cap ?? Math.PI, v = S.v ?? 0;
  j.p.x = S.x ?? 0; j.p.z = S.z ?? 4; j.cap = cap; j.v.x = Math.sin(cap) * v; j.v.z = Math.cos(cap) * v;
  for (const [i, x, z] of S.adv ?? []) { const o = m.joueurs[i]; o.p.x = x; o.p.z = z; o.cap = 0; o.v.x = o.v.z = 0; }
  if (S.partenaire) { const [i, x, z] = S.partenaire; const o = m.joueurs[i]; o.p.x = x; o.p.z = z; o.cap = Math.PI; o.v.x = o.v.z = 0; }
  if (S.defense) {
    const p = m.joueurs[9]; p.p.x = 0; p.p.z = 1; p.cap = 0; p.v.x = 0; p.v.z = 0;
    b.p.x = 0; b.p.y = BALL_R; b.p.z = 1.45; b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
    b.possesseur = 9; b.dernier = 9; b.dernierT = m.t;
    j.p.z = 2.4; j.cap = Math.PI;
  } else {
    b.p.x = j.p.x + Math.sin(cap) * 0.45; b.p.y = BALL_R; b.p.z = j.p.z + Math.cos(cap) * 0.45;
    b.v.x = j.v.x; b.v.y = 0; b.v.z = j.v.z; b.w.x = b.w.y = b.w.z = 0;
    b.possesseur = 4; b.dernier = 4; b.dernierT = m.t;
    // (la balle libre à 2,5 m devant lui : il n'est pas porteur)
    if (S.libre) { b.p.x = j.p.x + (typeof S.libre === 'number' ? S.libre : 2.5); b.possesseur = null; b.dernier = null; }
    // (bola-app#32 : la balle en l'air devant lui, qui retombe : R2 + ○ y est acrobatique)
    if (S.air) { b.p.y = 1.0; b.v.y = 0.5; }
  }
  b.garde = null; b.tir = null; b.recepteur = null;
  if (S.fixe !== false) m.controleFixe = [4, null];
  m.controle[0] = 4;
  return m;
}
const BALL_R = 0.11;
/** Joue une suite d'images sur la manette (« pad ») ou au clavier ; rend les actions sorties et les événements. */
function jouerSuite(S: Situation, suite: Image[], appareil: 'pad' | 'clavier', apres = 90) {
  const m = monde(S);
  const c = creerCommande(), e = pad(), ec = creerEtatClavier();
  const actions: Any[] = [], evts: Any[] = [], gestes: string[] = [];
  let t = 0, dernier: Any = null;
  // (en course, le stick gauche reste poussé devant lui si la suite ne dit rien)
  const lsDef: [number, number] | undefined = S.v ? [-Math.cos((S.cap ?? Math.PI)), -Math.sin(S.cap ?? Math.PI)] : undefined;
  const image = (im0: Image) => {
    const im = im0.ls || !lsDef ? im0 : { ...im0, ls: lsDef };
    if (appareil === 'pad') {
      e.b.fill(0); for (const b of im.b ?? []) e.b[BTN[b]] = 1;
      e.ax[0] = im.ls?.[0] ?? 0; e.ax[1] = -(im.ls?.[1] ?? 0); e.ax[2] = im.rs?.[0] ?? 0; e.ax[3] = -(im.rs?.[1] ?? 0);
      lireManette(c, e, t, m, 0, versJeu);
    } else {
      // (comme match.js : relatives au joueur en attaque, à l'écran en défense)
      const cap = (Cmd as Any).enAttaque(m, 0) ? m.joueurs[m.controle[0] ?? 4].cap : null;
      etatDepuisTouches(touchesDe(im, cap), t, ec, cap, versEcran);
      lireManette(c, ec, t, m, 0, versJeu);
    }
    if (c.dernier && c.dernier !== dernier) { dernier = c.dernier; actions.push({ ...dernier }); }
    const ch = c.changer;
    for (let k = 0; k < 2; k++) {
      pas(m, [intentionDe(c), null]);
      for (const ev of m.evts) evts.push(ev);
      m.evts.length = 0;
      const g = m.joueurs[4].g?.type; if (g && gestes[gestes.length - 1] !== g) gestes.push(g);
    }
    if (ch) actions.push({ type: 'changer' });
    t += 1 / 60;
  };
  image({});
  for (const im of suite) image(im);
  for (let i = 0; i < apres; i++) image({});
  return { m, actions, evts, gestes };
}
// chaque ligne : la situation, la suite d'images, l'événement de la simulation qui prouve que le geste a eu lieu
const COURSE: Situation = { v: 4.2 };
// (les modificateurs restent tenus 10 images après le relâché du stick : le clavier garde sa direction 0,09 s)
const sec = (dir: [number, number], mods: string[] = []): Image[] => [...tenir(5, { rs: dir, b: mods }), ...tenir(10, { b: mods })];
// (le bouton principal est lâché d'abord, les modificateurs encore tenus : c'est au relâché qu'ils sont lus)
const appuyer = (bt: string[], n = 15, ls?: [number, number]): Image[] => [...tenir(n, { b: bt, ls }), ...tenir(2, { b: bt.slice(1), ls }), ...tenir(2, { ls })];
// (le n° 10 regarde −z, la droite de l'écran : devant lui = stick à droite, sa gauche = le haut de l'écran)
const AV: [number, number] = [1, 0], AR: [number, number] = [-1, 0], GA: [number, number] = [0, 1];
const ESSAIS: Record<string, { S: Situation; suite: Image[]; ev?: string | ((r: Any) => boolean); verif?: (a: Any) => boolean; apres?: number }> = {
  // (bola-app#32 : la disposition de Sabri ; « ev » prouve le geste dans la simulation, « verif » la commande)
  passe: { S: { partenaire: [3, 0, -2] }, suite: appuyer(['A']), ev: 'passe', verif: (a) => a.commande === 'passe' },
  passePuissante: { S: { partenaire: [3, 0, -2] }, suite: appuyer(['A', 'RB']), ev: 'passe', verif: (a) => a.puissante === true && a.commande === 'passePuissante' },
  uneDeux: { S: { partenaire: [3, -1, -4], fixe: false }, suite: [...tenir(12, { b: ['LB', 'A'] }), ...tenir(40, { b: ['LB'] })], ev: (r) => r.evts.some((e: Any) => e.type === 'appelUneDeux') && r.actions.some((a: Any) => a.uneDeux === 'remise'), apres: 200 },
  frappe: { S: {}, suite: appuyer(['B'], 25), ev: 'frappe', verif: (a) => a.commande === 'frappe' },
  finesse: { S: {}, suite: appuyer(['B', 'RB'], 25), ev: 'frappe' },
  pique: { S: {}, suite: appuyer(['B', 'LB'], 25), ev: 'frappe' },
  ras: { S: {}, suite: appuyer(['B', 'RT'], 25), ev: (r) => r.evts.some((e: Any) => e.type === 'elan' && e.commande === 'ras') && r.evts.some((e: Any) => e.type === 'frappe'), verif: (a) => a.r2 === true },
  acrobatique: { S: { air: true }, suite: appuyer(['B', 'RT'], 6), ev: (r) => r.evts.some((e: Any) => e.type === 'elan' && e.commande === 'acrobatique'), verif: (a) => a.r2 === true },
  exterieur: { S: {}, suite: appuyer(['B', 'LT'], 25), ev: 'frappe' },
  feinteFrappe: { S: {}, suite: [...tenir(12, { b: ['B'] }), ...tenir(3, { b: ['B', 'A'] }), ...tenir(3)], ev: (r) => r.evts.some((e: Any) => e.type === 'feinteFrappe') && !r.evts.some((e: Any) => e.type === 'frappe') },
  frappeParfaite: { S: {}, suite: [...tenir(4, { b: ['B'] }), ...tenir(1), ...tenir(2, { b: ['B'] })], ev: (r) => r.evts.some((e: Any) => e.type === 'frappeParfaite') && r.evts.some((e: Any) => e.type === 'frappe') },
  centre: { S: { x: 6.5, z: -9, cap: Math.PI * 1.5, partenaire: [3, 0, -11] }, suite: appuyer(['X']), ev: 'passe' },
  centreLobe: { S: { x: 6.5, z: -9, cap: Math.PI * 1.5, partenaire: [3, 0, -11] }, suite: appuyer(['X', 'LB']), ev: 'passe', verif: (a) => a.haut === true },
  centreTendu: { S: { x: 6.5, z: -9, cap: Math.PI * 1.5, partenaire: [3, 0, -11] }, suite: appuyer(['X', 'RB']), ev: 'passe', verif: (a) => a.tendu === true },
  profondeur: { S: { partenaire: [3, 0, -2] }, suite: appuyer(['Y']), ev: 'passe' },
  profondeurLobee: { S: { partenaire: [3, 0, -2] }, suite: appuyer(['Y', 'LB']), ev: 'passe', verif: (a) => a.lobe === true },
  profondeurTendue: { S: { partenaire: [3, 0, -2] }, suite: appuyer(['Y', 'RB']), ev: 'passe', verif: (a) => a.puissante === true },
  semelle: { S: COURSE, suite: [...tenir(3, { b: ['R3'], ls: AV }), ...tenir(3, { ls: AV })], ev: 'semelle' },
  jongle: { S: {}, suite: tenir(110, { b: ['LB', 'RB'] }), ev: (r) => r.evts.filter((e: Any) => e.type === 'jongle').length >= 2 },
  prendre: { S: { fixe: true, libre: 1.6 }, suite: appuyer(['B'], 3), ev: (r) => r.evts.some((e: Any) => e.type === 'prendre') && r.evts.some((e: Any) => e.type === 'controle' && e.j === 4) },
  changerA: { S: { fixe: false, libre: true, partenaire: [3, -3, 2] }, suite: [], ev: 'changer' },
  crochet: { S: COURSE, suite: sec(GA), ev: 'crochet' },
  crochetCourt: { S: COURSE, suite: sec(GA, ['LT']), ev: 'crochet', verif: (a) => a.court === true },
  feinte: { S: {}, suite: sec(GA), ev: 'feinte' },
  passement: { S: COURSE, suite: [...tenir(3, { rs: AV }), ...tenir(3, { rs: [0.7071, 0.7071] }), ...tenir(3, { rs: GA }), ...tenir(3)], ev: 'passement' },
  doublePassement: { S: COURSE, suite: [...tenir(3, { rs: AV, b: ['LT'] }), ...tenir(3, { rs: [0.7071, 0.7071], b: ['LT'] }), ...tenir(3, { rs: GA, b: ['LT'] }), ...tenir(10, { b: ['LT'] })], ev: (r) => r.evts.some((e: Any) => e.type === 'passement' && e.double) },
  roulette: { S: COURSE, suite: [...tenir(3, { rs: AR }), ...tenir(2, { rs: [-0.7071, 0.7071] }), ...tenir(3, { rs: GA }), ...tenir(2, { rs: [0.7071, 0.7071] }), ...tenir(3, { rs: AV }), ...tenir(3)], ev: 'roulette' },
  talonnade: { S: COURSE, suite: sec(AR), ev: 'talonnade' },
  tirerArriere: { S: COURSE, suite: [...tenir(30, { rs: AR }), ...tenir(3)], ev: 'tirerArriere' },
  pousser: { S: COURSE, suite: sec(AV), ev: 'pousser' },
  petitPont: { S: { adv: [[7, 0, 3.0]] }, suite: sec(AV), ev: 'petitPont' },
  sombrero: { S: {}, suite: [...tenir(3, { b: ['R3'] }), ...tenir(5, { b: ['R3'], rs: AV }), ...tenir(10, { b: ['R3'] }), ...tenir(3)], ev: 'sombrero', apres: 120 },
  // (défense : □ / X tacle glissé, ○ / B récupérer du pied, debout)
  tacle: { S: { defense: true }, suite: appuyer(['X'], 3), ev: (r) => r.gestes.includes('tacle') && !r.gestes.includes('tacleDebout') },
  recuperer: { S: { defense: true }, suite: appuyer(['B'], 3), ev: (r) => r.gestes.includes('tacleDebout') && !r.gestes.includes('tacle') },
  changer: { S: { defense: true, fixe: false, partenaire: [3, 3, 0] }, suite: appuyer(['LB'], 3), ev: 'changer' },
  choisir: { S: { defense: true, fixe: false, partenaire: [3, 3, 0] }, suite: [...tenir(4, { rs: [0, -1] }), ...tenir(3)], ev: 'changer' },
};
// (changer en attaque : la balle libre près de nous, LB)
ESSAIS.changerA.suite = appuyer(['LB'], 3);
{
  const lignes = TOUCHES.filter((l: Any) => l.attendu);
  const manquent = lignes.filter((l: Any) => !ESSAIS[l.id]).map((l: Any) => l.id);
  verifier('chaque ligne du tableau a son essai', manquent.length === 0, manquent.length ? `sans essai : ${manquent.join(', ')}` : `${lignes.length} lignes à essayer`);
  const ratesPad: string[] = [], ratesClavier: string[] = [], ecarts: string[] = [];
  for (const l of lignes) {
    const E = ESSAIS[l.id];
    if (!E) continue;
    const S = E.S;
    const essai = (app: 'pad' | 'clavier') => {
      const r = jouerSuite(S, E.suite, app, E.apres ?? 90);
      // (changer en attaque : la balle part loin du n° 10 avant LB)
      const a = r.actions.find((x: Any) => x.type === l.attendu);
      const okEv = !E.ev ? true : typeof E.ev === 'string' ? r.evts.some((x: Any) => x.type === E.ev) : E.ev(r);
      const ok = !!a && okEv && (!E.verif || E.verif(a));
      if (process.env.BANC_DETAIL === l.id && app === 'pad') console.log(l.id, JSON.stringify(r.actions), r.evts.map((x: Any) => `${x.t.toFixed(2)} ${x.type}${x.j != null ? ' ' + x.j : ''}`).join(', '), r.gestes.join(','));
      return { ok, r, a, txt: `${l.id} : actions ${r.actions.map((x: Any) => x.type).join('/') || 'aucune'}, événement ${okEv}` };
    };
    const p = essai('pad'), c = essai('clavier');
    if (!p.ok) ratesPad.push(p.txt);
    if (!c.ok) ratesClavier.push(c.txt);
    const tp = p.r.actions.map((x: Any) => x.type).join('/'), tc = c.r.actions.map((x: Any) => x.type).join('/');
    if (tp !== tc) ecarts.push(`${l.id} : manette ${tp} ≠ clavier ${tc}`);
  }
  verifier('tableau à la manette (Xbox et PlayStation : mêmes boutons standard)', ratesPad.length === 0, ratesPad.length ? ratesPad.join(' ; ') : `${lignes.length} lignes, chaque geste par sa combinaison`);
  verifier('tableau au clavier', ratesClavier.length === 0, ratesClavier.length ? ratesClavier.join(' ; ') : `${lignes.length} lignes`);
  verifier('mêmes intentions manette et clavier', ecarts.length === 0, ecarts.length ? ecarts.join(' ; ') : 'mêmes actions, dans le même ordre, sur chaque ligne');
}

// ── (bola-app#32, lot A) réactivité, balle aimantée, passes qui arrivent, L1, R2, charge ──
{
  /** Une manette sur un monde de situation, image par image (1/60 s, deux pas) ; f(e, k) règle l'image k. */
  const rejouer = (S: Situation, n: number, f: (e: Any, k: number, m: Any) => void, apresImage?: (m: Any, k: number) => void) => {
    const m = monde(S), c = creerCommande(), e = pad();
    let t = 0;
    const evts: Any[] = [];
    lireManette(c, e, t, m, 0, versJeu); t += 1 / 60;
    for (let k = 0; k < n; k++) {
      e.b.fill(0); e.ax.fill(0);
      f(e, k, m);
      lireManette(c, e, t, m, 0, versJeu);
      for (let s2 = 0; s2 < 2; s2++) { pas(m, [intentionDe(c), null]); for (const ev of m.evts) evts.push({ ...ev, k }); m.evts.length = 0; }
      apresImage?.(m, k);
      t += 1 / 60;
    }
    return { m, evts, c };
  };
  // (le stick d'écran qui va vers (gx, gz) du jeu : versJeu(sx, sy) = (−sy, −sx))
  const stick = (e: Any, gx: number, gz: number) => { e.ax[0] = -gz; e.ax[1] = gx; };
  const res: string[] = [];
  let ok = true;
  // 1. l'appui répond à l'image suivante, un appui bref part tout de suite (passe et frappe)
  for (const [nom, bt, S] of [['passe', K.A, { partenaire: [3, 0, -4] }], ['frappe', K.B, {}]] as [string, number, Situation][]) {
    let rep = -1, dep = -1;
    const r0 = rejouer(S, 40, (e, k) => { if (k >= 1 && k < 7) e.b[bt] = 1; }, (m, k) => {
      const j = m.joueurs[4];
      if (rep < 0 && j.g && k >= 1) rep = k - 1;
    });
    const ev0 = r0.evts.find((x: Any) => (x.type === 'passe' || x.type === 'frappe') && x.j === 4);
    dep = ev0 ? ev0.k - 1 : -1;
    const bon = rep >= 0 && rep <= 1 && dep >= 0 && dep <= 12;
    ok &&= bon; res.push(`${nom} : élan ${rep} image(s) après l'appui, balle partie ${dep} images après (appui de 0,1 s)`);
  }
  // 2. la charge : un appui bref → la puissance juste ; tenu 0,6 s → l'élan est tenu armé, la flèche publiée, p ≈ 0,67
  {
    const bref = rejouer({ partenaire: [3, 0, -6] }, 50, (e, k) => { if (k >= 1 && k < 5) e.b[K.A] = 1; });
    const pb = bref.evts.find((x: Any) => x.type === 'passe');
    let gel = 0, fleche = 0;
    const long = rejouer({ partenaire: [3, 0, -6] }, 90, (e, k) => { if (k >= 1 && k < 37) e.b[K.A] = 1; }, (m) => { const j = m.joueurs[4]; if (j.g?.gel) gel++; if (j.vise) fleche++; });
    const pl = long.evts.find((x: Any) => x.type === 'passe');
    const bon = !!pb && pb.p == null && !!pl && Math.abs(pl.p - 36 / 60 / 0.9) < 0.05 && gel > 15 && fleche > 15 && pl.k <= 40;
    ok &&= bon; res.push(`charge : appui bref p ${pb?.p ?? 'juste'}, tenu 0,6 s p ${pl ? f2(pl.p) : '—'} (élan tenu armé ${gel} images, flèche ${fleche} images, balle partie ${pl ? pl.k - 36 : '—'} images après le relâché)`);
  }
  // 3. trop chargée (1 s), la frappe passe au-dessus de la barre ; à moitié, elle reste sous la barre
  {
    const haut = (n: number) => { let y = NaN; rejouer({ z: 0 }, 160, (e, k) => { if (k >= 1 && k < 1 + n) e.b[K.B] = 1; }, (m) => { const b = m.balle; if (Number.isNaN(y) && b.p.z <= -14.9 && b.tir) y = b.p.y; }); return y; };
    const y1 = haut(60), y5 = haut(27);
    const bon = y1 > 2.05 && !(y5 > 2.05);
    ok &&= bon; res.push(`frappe trop chargée : à la ligne à ${f2(y1)} m (au-dessus de 2 m), à moitié ${Number.isNaN(y5) ? 'arrêtée avant' : f2(y5) + ' m'}`);
  }
  // 4. arrêt net, virage serré, demi-tour immédiat, balle au pied et gardée
  {
    const lance = (k: number) => k < 150;
    const sit: Situation = { z: 10, cap: Math.PI };
    let tStop = -1;
    const a = rejouer(sit, 220, (e, k) => { if (lance(k)) { stick(e, 0, -1); e.b[K.RT] = 1; } }, (m, k) => { const j = m.joueurs[4]; if (!lance(k) && tStop < 0 && Math.hypot(j.v.x, j.v.z) < 0.3) tStop = (k - 150) / 60; });
    const ja = a.m.joueurs[4], dA = Math.hypot(a.m.balle.p.x - ja.p.x, a.m.balle.p.z - ja.p.z);
    let tRep = -1;
    const d = rejouer(sit, 240, (e, k) => { stick(e, 0, lance(k) ? -1 : 1); e.b[K.RT] = 1; }, (m, k) => { const j = m.joueurs[4]; if (!lance(k) && tRep < 0 && j.v.z > 2) tRep = (k - 150) / 60; });
    const jd = d.m.joueurs[4];
    let tVir = -1;
    const v = rejouer(sit, 220, (e, k) => { if (lance(k)) stick(e, 0, -1); else stick(e, 1, 0); e.b[K.RT] = 1; }, (m, k) => { const j = m.joueurs[4], s3 = Math.hypot(j.v.x, j.v.z); if (!lance(k) && tVir < 0 && s3 > 1 && Math.abs(Math.atan2(j.v.x, j.v.z) - Math.PI / 2) < 0.26) tVir = (k - 150) / 60; });
    const jv = v.m.joueurs[4];
    const garde = (r: Any, j: Any) => porteur(r.m) === j && Math.hypot(r.m.balle.p.x - j.p.x, r.m.balle.p.z - j.p.z) < 1.2;
    const bon = tStop >= 0 && tStop <= 0.6 && dA < 0.8 && garde(a, ja) && tRep >= 0 && tRep <= 0.6 && garde(d, jd) && tVir >= 0 && tVir <= 0.65 && garde(v, jv);
    ok &&= bon; res.push(`balle au pied lancé : arrêt ${f2(tStop)} s (balle à ${f2(dA)} m), demi-tour reparti en ${f2(tRep)} s, virage 90° en ${f2(tVir)} s ; balle gardée ${garde(a, ja)}/${garde(d, jd)}/${garde(v, jv)}`);
  }
  // 5. la passe arrive : couloir libre, 6 à 11 m, quatre angles ; le receveur (Noir n° 3) la contrôle
  {
    let arrive = 0, n = 0;
    for (const [x, z] of [[0, -6], [4, -6], [-5, -4], [6, 1], [-7, 0], [3, -10], [0, -11], [-4, -9]] as [number, number][]) {
      n++;
      const r = rejouer({ partenaire: [3, x, 4 + z] }, 150, (e, k, m) => { const j = m.joueurs[4], o = m.joueurs[3]; if (k >= 1 && k < 5) { e.b[K.A] = 1; const L = Math.hypot(o.p.x - j.p.x, o.p.z - j.p.z) || 1; stick(e, (o.p.x - j.p.x) / L, (o.p.z - j.p.z) / L); } });
      if (r.evts.some((ev: Any) => ev.type === 'controle' && ev.j === 3)) arrive++;
    }
    const bon = arrive >= n - 1;
    ok &&= bon; res.push(`passes qui arrivent (couloir libre) : ${arrive}/${n}`);
  }
  // 6. L1 seul, sans la balle : le joueur le plus proche du ballon ; R2 tenu ne change pas de joueur et fait sprinter
  {
    const r = rejouer({ defense: true, fixe: false, partenaire: [3, 0.5, 2.4] }, 6, (e, k) => { if (k === 1) e.b[K.LB] = 1; });
    const c1 = r.m.controle[0];
    // (R2 tapé quatre fois en défense : le même joueur tenu qu'avec rien ; R2 tenu, sans la balle : le sprint)
    const r2 = rejouer({ defense: true, fixe: false, partenaire: [3, 0.5, 2.4] }, 30, (e, k) => { if (k % 6 < 2) e.b[K.RT] = 1; });
    const r0b = rejouer({ defense: true, fixe: false, partenaire: [3, 0.5, 2.4] }, 30, () => {});
    const c2 = r2.m.controle[0], c0 = r0b.m.controle[0];
    const rs = rejouer({ libre: 9 }, 90, (e) => { e.b[K.RT] = 1; stick(e, 0, -1); });
    const v2 = Math.hypot(rs.m.joueurs[4].v.x, rs.m.joueurs[4].v.z);
    const bon = c1 === 3 && c2 === c0 && v2 > 6.5;
    ok &&= bon; res.push(`L1 : contrôle → ${c1} (le plus proche du ballon : 3) ; R2 tapé : contrôle ${c2} (sans R2 : ${c0}) ; R2 tenu sans la balle : ${f2(v2)} m/s`);
  }
  // 7. un geste raté coûte la balle : deux gestes du stick droit à moins de 0,25 s
  {
    const r = rejouer({ v: 4.2 }, 60, (e, k) => { stick(e, 0, -1); if (k >= 2 && k < 5) e.ax[3] = -1; if (k >= 9 && k < 12) e.ax[3] = 1; });
    const rate = r.evts.some((x: Any) => x.type === 'gesteRate');
    ok &&= rate; res.push(`geste raté (deux gestes à 0,12 s) : ${rate ? 'balle perdue' : 'RIEN'}`);
  }
  verifier('lot A : réactivité, balle aimantée, passes, L1, R2, charge', ok, res.join(' ; '));
}

// ── I J K L : relatives au joueur (I = pousser devant lui, quel que soit son cap) ──
{
  const res: string[] = [];
  for (const capDeg of [0, 90, 180, 270]) {
    const cap = (capDeg * Math.PI) / 180;
    const M = { joueurs: [{ e: 0, p: { x: 0, z: 0 }, v: { x: Math.sin(cap) * 4, z: Math.cos(cap) * 4 }, cap }] }, j = M.joueurs[0];
    for (const [k, att] of [['i', 'pousser'], ['k', 'talonnade'], ['j', 'crochet']] as [string, string][]) {
      const L = creerLecteur(), ec = creerEtatClavier();
      let a: Any = null;
      for (let i = 0; i < 20; i++) {
        etatDepuisTouches(new Set(i < 5 ? [k] : []), i / 60, ec, cap, versEcran);
        a ??= lireGesteStick(L, ec.ax[2], -ec.ax[3], i / 60, M, j, versJeu);
      }
      // (J, sa gauche : le crochet part à gauche de son cap)
      const gauche = a && (Math.cos(cap) * a.dx - Math.sin(cap) * a.dz) > 0.5;
      if (a?.type !== att || (k === 'j' && !gauche)) res.push(`cap ${capDeg}° ${k.toUpperCase()} → ${a?.type ?? 'rien'}`);
    }
  }
  verifier('clavier : I J K L relatives au joueur', res.length === 0, res.length ? res.join(' ; ') : 'I pousse, K talonne, J crochète à sa gauche, aux caps 0°, 90°, 180°, 270°');
}

// ── le pouce (second doigt) : les mêmes gestes que le stick droit de la manette ──
{
  const ecarts: string[] = [];
  for (const id of ['crochet', 'feinte', 'passement', 'roulette', 'talonnade', 'tirerArriere', 'pousser', 'petitPont']) {
    const E = ESSAIS[id];
    const pad1 = jouerSuite(E.S, E.suite, 'pad', 0).actions.map((a: Any) => a.type).join('/');
    // le pouce : le stick du second doigt (46 px = à fond) dans le même lecteur, sur le même monde
    const m = monde(E.S), L = creerLecteur(), j = m.joueurs[4];
    const out: string[] = [];
    let t = 0;
    for (const im of [{}, ...E.suite] as Image[]) {
      const [rx, ry] = im.rs ?? [0, 0];
      const g = stickDoigt(rx * 60, -ry * 60);
      const a = lireGesteStick(L, g.x, g.y, t, m, j, versJeu, (im.b ?? []).includes('LT'), (im.b ?? []).includes('R3'));
      if (a) out.push(a.type);
      const cap = E.S.cap ?? Math.PI, al = E.S.v ? 1 : 0;
      for (let k = 0; k < 2; k++) { pas(m, [{ dx: Math.sin(cap) * al, dz: Math.cos(cap) * al, allure: al, sprint: 0, action: null, regard: m.balle.p }, null]); m.evts.length = 0; }
      t += 1 / 60;
    }
    if (out.join('/') !== pad1) ecarts.push(`${id} : manette ${pad1} ≠ pouce ${out.join('/')}`);
  }
  verifier('mêmes gestes au pouce (second doigt)', ecarts.length === 0, ecarts.length ? ecarts.join(' ; ') : '8 gestes du stick droit, identiques');
}

// ── l'enchaînement : crochet → roulette → frappe (l'élan de la frappe part moins de 1,2 s après le crochet) ──
{
  const suite: Image[] = [
    ...sec(GA).map((im) => ({ ...im, ls: AV })),
    ...[AR, [-0.7071, 0.7071], GA, [0.7071, 0.7071], AV].flatMap((d) => tenir(2, { rs: d as [number, number], ls: AV })),
    ...tenir(10, { b: ['B'], ls: AV }), ...tenir(2, { ls: AV }),
  ];
  const r = jouerSuite(COURSE, suite, 'pad', 120);
  const t = (ty: string) => r.evts.find((e: Any) => e.type === ty && e.j === 4)?.t;
  const t0 = t('crochet'), t1 = t('roulette'), te = t('elan'), t2 = t('frappe');
  const ok = t0 != null && t1 != null && te != null && t2 != null && t0 < t1 && t1 < te && te - t0 < 1.2 && t2 - t0 < 1.5 && r.evts.some((e: Any) => e.type === 'enchaine');
  const f = (x?: number) => (x == null ? '—' : x.toFixed(2));
  verifier('enchaînement crochet → roulette → frappe', ok, `crochet ${f(t0)} s, roulette ${f(t1)} s, élan de la frappe ${f(te)} s (${t0 != null && te != null ? (te - t0).toFixed(2) : '—'} s, seuil 1,2), balle frappée ${f(t2)} s (seuil 1,5) ; la frappe a attendu en file : ${r.evts.some((e: Any) => e.type === 'enchaine')}`);
}

// ── (correctifs) la feinte de frappe « ○ puis ✕ » (bola-app#32 : ○ / B ; tenue, la frappe chargée attend armée, la
// feinte la coupe tant qu'elle n'est pas partie ; juste après le relâché, 1 image, aussi : l'impact tombe 0,05 s après) ──
{
  const rates: string[] = [];
  for (const [n, d] of [[25, -10], [25, -3], [25, 0], [25, 1]] as [number, number][]) {
    const suite = d < 0 ? [...tenir(n + d, { b: ['B'] }), ...tenir(2, { b: ['B', 'A'] }), ...tenir(3)] : [...tenir(n, { b: ['B'] }), ...tenir(d), ...tenir(2, { b: ['A'] })];
    const r = jouerSuite({}, suite, 'pad', 60);
    const fr = r.evts.some((e: Any) => e.type === 'frappe'), ff = r.evts.some((e: Any) => e.type === 'feinteFrappe');
    if (fr || !ff) rates.push(`A ${d} image(s) ${d < 0 ? 'avant' : 'après'} le relâché : frappe ${fr}, feinte ${ff}`);
  }
  verifier('feinte de frappe (○ puis ✕)', rates.length === 0, rates.length ? rates.join(' ; ') : 'A pendant la charge (10 et 3 images avant le relâché), au relâché, 1 image après : feinte, aucune frappe');
}

// ── (correctifs #26) B tenu dans le dos d'un porteur qui court : le tirage de maillot, pas un tacle debout ──
{
  const essai = (derriere: boolean) => {
    const m = monde({ defense: true });
    const p = m.joueurs[9], j = m.joueurs[4], b = m.balle;
    // le porteur court vers +z ; le n° 10 Noir colle derrière lui (ou devant lui, face à face)
    p.p.x = 0; p.p.z = 1; p.cap = 0; p.v.x = 0; p.v.z = 3;
    b.p.x = 0; b.p.z = 1.45; b.v.x = 0; b.v.z = 3; b.possesseur = 9;
    j.p.x = 0; j.p.z = derriere ? 0.4 : 2.0; j.cap = derriere ? 0 : Math.PI; j.v.x = 0; j.v.z = derriere ? 3 : 0;
    const c = creerCommande(), e = pad(); let t = 0; const evts: string[] = [], gestes: string[] = [];
    for (let i = 0; i < 40; i++) {
      e.b.fill(0); e.b[K.B] = i > 0 ? 1 : 0; e.ax[0] = 0; e.ax[1] = derriere ? 1 : 0; e.ax[2] = 0; e.ax[3] = 0;
      lireManette(c, e, t, m, 0, versJeu);
      for (let k = 0; k < 2; k++) { pas(m, [intentionDe(c), { dx: 0, dz: 1, allure: 0.85, sprint: 0 }]); for (const ev of m.evts) evts.push(ev.type); m.evts.length = 0; const g = j.g?.type; if (g && gestes[gestes.length - 1] !== g) gestes.push(g); }
      t += 1 / 60;
    }
    return { tirage: evts.includes('tirage'), tacle: gestes.includes('tacleDebout') };
  };
  const dos = essai(true), face = essai(false);
  verifier('B tenu dans le dos : tirage, de face : tacle debout', dos.tirage && !dos.tacle && face.tacle,
    `dans le dos : tirage ${dos.tirage}, tacle debout ${dos.tacle} ; de face : tacle debout ${face.tacle}`);
}

// ── aucun geste en défense ──
{
  const motifs: Image[][] = [sec(GA), sec(AV), sec(AR), [...tenir(30, { rs: AR }), ...tenir(3)], [...tenir(3, { rs: AR }), ...tenir(3, { rs: GA }), ...tenir(3, { rs: AV }), ...tenir(3)], tenir(60, { b: ['LB', 'RB'] }), [...tenir(3, { b: ['R3'] }), ...tenir(3)]];
  const GESTES = ['crochet', 'feinte', 'passement', 'roulette', 'talonnade', 'tirerArriere', 'pousser', 'petitPont', 'sombrero', 'jongle', 'semelle', 'feinteFrappe'];
  const vus: string[] = [];
  for (const su of motifs) {
    const r = jouerSuite({ defense: true }, su, 'pad', 20);
    for (const a of r.actions) if (GESTES.includes(a.type)) vus.push(a.type);
    for (const e of r.evts) if (GESTES.includes(e.type) && e.j === 4) vus.push(`ev ${e.type}`);
  }
  verifier('aucun geste en défense', vus.length === 0, vus.length ? vus.join(', ') : `${motifs.length} motifs du stick droit et des boutons : rien`);
}

// ── la table exportée ──
{
  const md = touchesMarkdown();
  const arg = process.argv.find((a) => a.startsWith('--touches='));
  if (arg) fs.writeFileSync(arg.slice(10), `# Les touches du jeu Bola (bola-app#26, lot 3)\n\nTiré de src/lib/jeu/entrees/touches.js par tools/jeu-banc-manettes.ts (chaque ligne avec une action est vérifiée sur la simulation).\n\n${md}`);
  verifier('tableau en Markdown', md.split('\n').filter((x: string) => x.startsWith('| ') && !x.startsWith('| Action')).length === TOUCHES.length, `${TOUCHES.length} lignes${arg ? ` → ${arg.slice(10)}` : ''}`);
}
// ══ bola-app#26, lot 4 : passer le ralenti du but, couper le son ══
{
  // A / ✕ passe le ralenti : en match seulement (pas dans le salon, où A range la manette), une fois par appui
  const pads: Any[] = [];
  const btn2 = (on: number[]) => Array.from({ length: 17 }, (_, i) => ({ pressed: on.includes(i), value: on.includes(i) ? 1 : 0 }));
  const g = (on: number[] = []) => ({ index: 0, id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', connected: true, mapping: 'standard', buttons: btn2(on), axes: [0, 0, 0, 0] });
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true, writable: true });
  const M = Man.creerManettes({ versJeu });
  let passes = 0; (M as Any).surPasser = () => { passes++; };
  const m2: Any = creerMonde({ graine: 3, humains: [true, false], aides: [0.5, 0] }); demarrer(m2, { intro: false });
  M.mode('salon'); pads[0] = g(); M.lire(0, null); pads[0] = g([0]); M.lire(0.02, null); pads[0] = g(); M.lire(0.04, null);
  const salon = passes;
  M.mode('match');
  let t = 1; const appui = () => { pads[0] = g([0]); M.lire(t, m2); t += 0.02; pads[0] = g([0]); M.lire(t, m2); t += 0.02; pads[0] = g(); M.lire(t, m2); t += 0.02; };
  appui(); appui();
  const tenu = passes;
  M.detruire();
  // le clavier : M coupe le son (rendu/son.js) et ne sert à aucune touche de jeu ; Entrée passe le ralenti, sans être une touche de jeu
  const { TOUCHES_JEU }: Any = Clv;
  const libre = !TOUCHES_JEU.has('m') && !TOUCHES_JEU.has('enter');
  verifier('ralenti passé à la manette, son coupé au clavier', salon === 0 && tenu === 2 && libre, `A dans le salon : ${salon} ; deux appuis de A en match (tenus 2 images) : ${tenu} ; M et Entrée libres dans le tableau du clavier : ${libre ? 'oui' : 'NON'}`);
}
// ── (correctifs) le A / ✕ qui passe le ralenti (phase « but ») ne devient pas une passe au coup d'envoi ──
{
  const pads: Any[] = [];
  const btn2 = (on: number[]) => Array.from({ length: 17 }, (_, i) => ({ pressed: on.includes(i), value: on.includes(i) ? 1 : 0 }));
  const g = (on: number[] = []) => ({ index: 0, id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', connected: true, mapping: 'standard', buttons: btn2(on), axes: [0, 0, 0, 0] });
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => pads }, configurable: true, writable: true });
  const M = Man.creerManettes({ versJeu });
  const m3: Any = creerMonde({ graine: 3, humains: [true, false], aides: [0.5, 0] }); demarrer(m3, { intro: false });
  M.mode('salon'); pads[0] = g(); M.lire(0, null); pads[0] = g([0]); M.lire(0.02, null); pads[0] = g(); M.lire(0.04, null);
  const rangee = M.equipes()[0] != null;
  M.mode('match');
  let t = 1; const lire = (on: number[] = []) => { pads[0] = g(on); M.lire(t, m3); t += 1 / 60; };
  m3.phase = 'but'; m3.phaseT = 0.5;
  lire(); for (let i = 0; i < 8; i++) lire([0]); lire();
  engagement(m3, 0); m3.phase = 'jeu'; m3.phaseT = 0;
  const evts: string[] = [];
  for (let k = 0; k < 60; k++) { lire(); for (let s2 = 0; s2 < 2; s2++) { pas(m3, [M.intention(0), null]); for (const ev of m3.evts) if (ev.type === 'passe' || ev.type === 'elan' || ev.type === 'frappe') evts.push(ev.type); m3.evts.length = 0; } }
  // (puis un vrai A en jeu fait bien une passe : la commande n'est pas cassée)
  for (let i = 0; i < 12; i++) { lire([0]); pas(m3, [M.intention(0), null]); pas(m3, [M.intention(0), null]); }
  let passeEnJeu = false;
  for (let k = 0; k < 90; k++) { lire(); for (let s2 = 0; s2 < 2; s2++) { pas(m3, [M.intention(0), null]); for (const ev of m3.evts) if (ev.type === 'passe' || ev.type === 'frappe') passeEnJeu = true; m3.evts.length = 0; } }
  M.detruire();
  verifier('A du ralenti oublié au coup d\'envoi', rangee && evts.length === 0 && passeEnJeu, `manette rangée ${rangee} ; 1 s de jeu après le A du ralenti : ${evts.join(', ') || 'rien'} ; un A en jeu ensuite : passe ${passeEnJeu}`);
}
console.log(echecs ? `\n${echecs} contrôle(s) en échec` : '\nTout est vert.');
process.exit(echecs ? 1 : 0);
