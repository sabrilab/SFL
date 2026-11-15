// Le banc des manettes du jeu Bola (bola-app#23), sans navigateur : entrees/commande.js (zone morte, jauges, gestes du
// stick droit, défense) et entrees/manettes.js (marques, ordre standard, table de secours de la DualShock 4) sur la
// vraie simulation (sim/monde.js). Des manettes inventées jouent ; chaque contrôle imprime sa mesure, et le banc sort
// en erreur (code 1) si un critère manque.
//
//   npx tsx tools/jeu-banc-manettes.ts
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
{
  const P = partie(5);
  const vus: Any[] = P.actions;
  appui(P, K.A, 12); // 0,2 s
  const passe = vus.find((a) => a.type === 'passe');
  P.images(90);
  engagement(P.m, 0); P.m.phase = 'jeu';
  vus.length = 0;
  appui(P, K.X, 27); // 0,45 s
  const frappe = vus.find((a) => a.type === 'frappe');
  P.images(30);
  verifier('passe à l\'appui', !!passe && Math.abs(passe.p - 12 / 60 / 0.9) < 0.04 && P.evts.some((e: Any) => e.type === 'passe'), `0,2 s → p = ${f2(passe?.p ?? -1)}, passe jouée : ${P.evts.some((e: Any) => e.type === 'passe')}`);
  verifier('frappe à l\'appui', !!frappe && Math.abs(frappe.p - 0.5) < 0.04 && P.evts.some((e: Any) => e.type === 'frappe'), `0,45 s → p = ${f2(frappe?.p ?? -1)}, frappe partie : ${P.evts.some((e: Any) => e.type === 'frappe')}`);
  // lobée, profondeur, finesse, frappe lobée, passe tendue : le bon type
  const types: string[] = [];
  for (const [b, mod] of [[K.B, -1], [K.Y, -1], [K.X, K.RB], [K.X, K.LB], [K.A, K.RB]] as [number, number][]) {
    engagement(P.m, 0); P.m.phase = 'jeu'; vus.length = 0;
    appui(P, b, 20, (e) => { if (mod >= 0) e[0].b[mod] = 1; });
    types.push(vus[0] ? `${vus[0].type}${vus[0].p > 0.6 ? '+' : ''}` : 'rien');
    P.images(60);
  }
  verifier('lobée, profondeur, finesse, frappe lobée, tendue', types.join(',') === 'lob,profondeur,finesse,lobFrappe,passe+', types.join(', '));
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
  const avant = j();
  P.images(2, (e) => { e[0].b[K.B] = 1; });
  const glisse = avant.g?.type === 'tacle' || P.evts.some((e: Any) => e.type === 'tacleBalle' || e.type === 'tacleJambes');
  verifier('tacle glissé (B)', glisse, `geste ${avant.g?.type ?? 'aucun'}`);
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
  const REF = '7919334a';
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

console.log(echecs ? `\n${echecs} contrôle(s) en échec` : '\nTout est vert.');
process.exit(echecs ? 1 : 0);
