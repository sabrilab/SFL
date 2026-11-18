// Une manette → l'intention d'une équipe (bola-app#23, refaite par bola-app#26 lot 3), sans DOM : la même structure
// que le pouce et l'IA (direction, allure, sprint, regard, contenir, protéger, charger, tirer, presser, plus une action
// consommée une fois). Le banc node (tools/jeu-banc-manettes.ts) la nourrit d'états de manette inventés ; la page
// (entrees/manettes.js) de vraies ; le clavier (entrees/clavier.js) d'un état de manette fait de touches.
//
// L'état d'une manette est déjà rangé dans l'ordre « standard » de la Gamepad API : b[0..16] (0 A/✕, 1 B/○, 2 X/□,
// 3 Y/△, 4 LB/L1, 5 RB/R1, 6 LT/L2, 7 RT/R2, 8 Vue/Share, 9 Menu/Options, 10 L3, 11 R3, 12-15 croix haut, bas, gauche,
// droite, 16 accueil), valeurs de 0 à 1 ; ax = [gauche x, gauche y, droit x, droit y], y vers le bas, de -1 à 1.
//
// Lue une fois par image (lireManette, avec l'heure réelle de l'image), elle tient les commandes continues jusqu'à
// l'image suivante ; les actions (passe, frappe, tacle, geste, changer) partent au premier pas de simulation qui suit
// (intentionDe les consomme). La puissance d'une passe ou d'une frappe est la durée d'appui (JEU.jauge = 0,9 s pour
// la jauge pleine), lue au relâché.
//
// (bola-app#32) Chaque touche agit à l'appui : l'action part tout de suite (l'élan de la passe ou de la frappe démarre,
// sim/gestes.js), chargée tant que la touche est tenue (it.tenir, it.puissance : la jauge, 0,9 s pour la pleine ;
// it.viseX : le côté du but que montre le stick) ; au relâché la balle part ; un appui de moins de 0,15 s est bref
// (it.bref : la simulation prend la puissance juste, la passe dosée sur le receveur). Les actions portent `commande`,
// l'id de leur ligne dans entrees/touches.js (la table unique, exportée par le banc).
//
// La disposition (Sabri, bola-app#32, retour du 18/11 21:19 ; le reste : la disposition standard des jeux de foot
// console) :
//   stick gauche courir (il dirige d'abord la balle, aimantée au pied) ; R2/RT tenu sprint, avec ou sans la balle ;
//   L2/LT : sans stick protéger, avec le stick conduite serrée (attaque) ou contenir (défense)
//   attaque : ✕/A passe (R1 + : puissante, L1 + : une-deux, la remise part quand L1 est lâché) ; ○/B frappe (R2 + : à ras
//             de terre si la balle est au sol, acrobatique si elle est en l'air ; L1 + : piqué ; R1 + : enroulée ; L2 + :
//             extérieur ; ○ puis ✕ : feinte de frappe ; ○ de nouveau juste après le relâché : frappe parfaite) ;
//             □/X centre sur un côté, passe lobée ailleurs (L1 + : lobé, R1 + : tendu) ; △/Y profondeur (L1 + : lobée,
//             R1 + : appuyée) ; R3 semelle ; L1 + R1 tenus à l'arrêt jongler ; stick droit gestes techniques
//             (entrees/geste-stick.js) ; balle libre au sol : ○/B la prend (aimantée) ; L1 seul sans la balle : changer
//             vers le joueur le plus proche du ballon
//   défense : □/X tacle (glissé) ; ○/B récupérer du pied, sans tacler (maintenu : l'épaule, et derrière le porteur le
//             tirage de maillot) ; ✕/A maintenu pressing ; R1/RB maintenu pressing d'un coéquipier ; △/Y maintenu
//             sortie du gardien ; L1/LB changer vers le plus proche du ballon (R2 ne change jamais de joueur) ; stick
//             droit poussé : prendre le joueur de ce côté
//   Menu/Options : pause ; Vue/Share : les touches (lus par la page, pas ici)
import { JEU, BUT_DL, butDe } from '../sim/constantes.js';
import { creerLecteur, oublierLecteur, lireGesteStick, zoneMorte } from './geste-stick.js';
export { zoneMorte };
import { porteur } from '../sim/gestes.js';

/** Une gâchette lue en analogique, zone morte 0,08 remise à l'échelle. */
export const gachette = (v) => (v > 0.08 ? Math.min(1, (v - 0.08) / 0.92) : 0);

const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VUE: 8, MENU: 9, L3: 10, R3: 11, HAUT: 12, BAS: 13, GAUCHE: 14, DROITE: 15 };
export const BOUTONS = B;
const APPUI = 0.5;

/**
 * (bola-app#32) La commande d'une touche de face et de ses modificateurs, en attaque : l'id de sa ligne dans
 * entrees/touches.js (que garde la simulation, et que lit le rendu pour choisir le geste) et l'action de la simulation.
 *   ✕ / A passe (R1 puissante, L1 une-deux) ; ○ / B frappe (R2 selon la balle : ras de terre ou acrobatique, L1 piqué,
 *   R1 enroulée, L2 extérieur) ; □ / X centre sur un côté, passe lobée ailleurs (L1 lobé, R1 tendu) ; △ / Y profondeur
 *   (L1 lobée, R1 appuyée).
 */
export function commandeDe(k, { lb = false, rb = false, r2 = false, lt = false, flanc = false } = {}) {
  if (k === B.A) return lb ? { id: 'uneDeux', spec: { type: 'passe' } } : rb ? { id: 'passePuissante', spec: { type: 'passe', puissante: true } } : { id: 'passe', spec: { type: 'passe' } };
  if (k === B.B) {
    if (r2) return { id: 'ras', spec: { type: 'frappe', r2: true } };
    if (lb) return { id: 'pique', spec: { type: 'lobFrappe' } };
    if (rb) return { id: 'finesse', spec: { type: 'finesse' } };
    if (lt) return { id: 'exterieur', spec: { type: 'exterieur' } };
    return { id: 'frappe', spec: { type: 'frappe' } };
  }
  if (k === B.X) {
    if (lb) return { id: 'centreLobe', spec: { type: flanc ? 'centre' : 'lob', haut: true } };
    if (rb) return { id: 'centreTendu', spec: { type: 'centre', tendu: true } };
    return { id: 'centre', spec: { type: flanc ? 'centre' : 'lob' } };
  }
  if (lb) return { id: 'profondeurLobee', spec: { type: 'profondeur', lobe: true } };
  if (rb) return { id: 'profondeurTendue', spec: { type: 'profondeur', puissante: true } };
  return { id: 'profondeur', spec: { type: 'profondeur' } };
}
const estTir = (type) => type === 'frappe' || type === 'finesse' || type === 'lobFrappe' || type === 'exterieur';


/** Remet une intention de manette à zéro (mêmes champs que sim/ia.js intentionVide, plus ceux des humains). */
function vide(it) {
  it.dx = 0; it.dz = 0; it.allure = 0; it.sprint = 0; it.regard = null;
  it.contenir = false; it.protege = false; it.charge = false; it.tire = false; it.presse = false; it.renfort = false; it.sortie = false;
  it.tenir = false; it.puissance = null; it.bref = false; it.viseX = null;
  return it;
}

export function creerCommande() {
  return {
    it: vide({ action: null, changer: null }),
    prec: new Float64Array(17),
    vu: false,
    jauge: null,            // { bouton, t0, type } : une passe ou une frappe qu'on charge
    p: 0,                   // la jauge en cours, de 0 à 1 (pour l'anneau sous le joueur)
    geste: { actif: false, a: 0, fait: false },  // le stick droit en défense (choisir le joueur)
    lecteur: creerLecteur(), // le stick droit en attaque (gestes techniques)
    r3: null,               // { t0, geste } : R3 enfoncé (semelle au relâché, ou sombrero avec un coup sec avant)
    frappeT: -9,            // l'heure du relâché de la dernière frappe (feinte de frappe : A dans les 0,35 s)
    uneDeux: null,          // { t, de } : un une-deux demandé (LB + A) ; la remise part quand LB est lâché
    jongle: { t0: null, prochain: 0 },
    attente: null,          // l'action qui partira au prochain pas
    changer: null,
    dernier: null,          // la dernière action sortie (pour le banc et l'écran)
  };
}

/** L'action et le changement de joueur ne valent que pour un pas. */
export function intentionDe(cmd) {
  const it = cmd.it;
  it.action = cmd.attente; cmd.attente = null;
  it.changer = cmd.changer; cmd.changer = null;
  return it;
}

/** Oublie tout ce qui est en cours (manette débranchée, changement d'équipe, pause). */
export function oublier(cmd) {
  vide(cmd.it); cmd.it.action = null; cmd.it.changer = null;
  cmd.jauge = null; cmd.p = 0; cmd.attente = null; cmd.changer = null; cmd.lache = null;
  cmd.geste.actif = false; cmd.geste.fait = false;
  oublierLecteur(cmd.lecteur); cmd.r3 = null; cmd.uneDeux = null; cmd.jongle.t0 = null; cmd.frappeT = -9;
  cmd.vu = false;
}

/**
 * Lit l'état d'une manette pour l'équipe e, dans le monde M, à l'heure t (s).
 * versJeu(sx, sy) : l'écran (sx vers la droite, sy vers le haut) → le repère du jeu { x, z }, selon la caméra.
 */
/** L'équipe e attaque-t-elle (elle a la balle, ou son joueur tenu est à moins de 3,5 m d'une balle libre) ? */
export function enAttaque(M, e) {
  const p = porteur(M), bl = M.balle;
  const j = M.controle[e] != null ? M.joueurs[M.controle[e]] : null;
  return p ? p.e === e : !!(j && Math.hypot(bl.p.x - j.p.x, bl.p.z - j.p.z) < 3.5 && bl.garde == null);
}

/** (correctifs #26) Le joueur j est-il collé dans le dos du porteur p (à moins de 0,95 m, derrière sa course) ? */
function dansLeDos(j, p) {
  if (!j || !p || p.e === j.e) return false;
  const rx = j.p.x - p.p.x, rz = j.p.z - p.p.z, d = Math.hypot(rx, rz);
  const s = Math.hypot(p.v.x, p.v.z);
  const fx = s > 0.8 ? p.v.x / s : Math.sin(p.cap), fz = s > 0.8 ? p.v.z / s : Math.cos(p.cap);
  return d < 0.95 && d > 1e-6 && rx * fx + rz * fz < -0.35 * d;
}

export function lireManette(cmd, etat, t, M, e, versJeu) {
  const b = etat.b, ax = etat.ax, prec = cmd.prec;
  // à la première lecture, rien n'est un appui (un bouton tenu en arrivant ne déclenche rien)
  if (!cmd.vu) { for (let i = 0; i < 17; i++) prec[i] = b[i] ?? 0; cmd.vu = true; }
  const bas = (i) => (b[i] ?? 0) > APPUI && prec[i] <= APPUI;
  const haut = (i) => (b[i] ?? 0) <= APPUI && prec[i] > APPUI;
  const tenu = (i) => (b[i] ?? 0) > APPUI;

  const it = vide(cmd.it);
  const j = M.controle[e] != null ? M.joueurs[M.controle[e]] : null;
  const bl = M.balle;
  it.regard = bl.p;

  // stick gauche (et la croix, en secours : pleine allure)
  let sx = ax[0] ?? 0, sy = -(ax[1] ?? 0);
  const cx = (tenu(B.DROITE) ? 1 : 0) - (tenu(B.GAUCHE) ? 1 : 0), cy = (tenu(B.HAUT) ? 1 : 0) - (tenu(B.BAS) ? 1 : 0);
  let st = zoneMorte(sx, sy);
  if (!st.amp && (cx || cy)) { const L = Math.hypot(cx, cy); st = { x: cx / L, y: cy / L, amp: 1 }; }
  sx = st.x; sy = st.y;
  if (st.amp > 0) {
    const g = versJeu(sx, sy);
    it.dx = g.x; it.dz = g.z; it.allure = st.amp;
  }
  it.sprint = it.allure > 0 ? gachette(b[B.RT] ?? 0) : 0;
  const dirStick = st.amp > 0.3 ? versJeu(sx, sy) : null;

  const p = porteur(M);
  const attaque = enAttaque(M, e);
  const lt = gachette(b[B.LT] ?? 0) > 0.3;
  const sortir = (a) => { cmd.attente = a; cmd.dernier = a; };

  if (attaque) {
    // L2 / LT : sans stick, protéger la balle ; avec le stick, la conduite serrée (pas de sprint, allure tenue)
    it.protege = lt && p === j && st.amp < 0.2;
    if (lt && st.amp >= 0.2) { it.allure = Math.min(it.allure, 0.6); it.sprint = 0; }
    const lb = tenu(B.LB), rb = tenu(B.RB), r2 = gachette(b[B.RT] ?? 0) > 0.5;
    const viseX = dirStick ? Math.max(-1, Math.min(1, dirStick.x)) * (BUT_DL - 0.35) : 0;
    // (bola-app#32) une balle libre au sol, à portée de prise : ○ / B la prend (elle vient au pied)
    // (au pied, à moins de 0,9 m, elle se frappe : ○ est alors la frappe)
    const dLibre = j ? Math.hypot(bl.p.x - j.p.x, bl.p.z - j.p.z) : 99;
    const libreSol = !p && bl.garde == null && bl.p.y < 0.45 && Math.abs(bl.v.y) < 1.5 && dLibre > 0.9 && dLibre < JEU.aimant.prendre;
    if (bas(B.A) && (cmd.jauge?.type === 'frappe' || (!cmd.jauge && t - cmd.frappeT < 0.35))) {
      // la feinte de frappe : ✕ / A pendant qu'on charge la frappe, ou juste après l'avoir lâchée (avant l'impact)
      cmd.jauge = null; cmd.p = 0; cmd.frappeT = -9; cmd.lache = null;
      sortir({ type: 'feinteFrappe', commande: 'feinteFrappe' });
    } else if (bas(B.B) && !cmd.jauge && t - cmd.frappeT < 0.3) {
      // (bola-app#32, profondeur technique) le second appui de la frappe, juste après le relâché : la frappe parfaite
      // s'il tombe à 0,07 s de l'impact (sim/monde.js timing)
      cmd.frappeT = -9;
      sortir({ type: 'timing', commande: 'frappeParfaite' });
    } else if (!cmd.jauge && !cmd.attente) {
      // (bola-app#32) chaque touche agit à l'appui : l'action part tout de suite (l'élan démarre), chargée tant que la
      // touche est tenue ; la combinaison (L1, R1, R2, L2) est lue à l'appui
      for (const k of [B.A, B.B, B.X, B.Y]) {
        if (!bas(k)) continue;
        if (k === B.B && libreSol && !r2) { sortir({ type: 'prendre', commande: 'prendre' }); break; }
        const flanc = !!j && Math.abs(j.p.x) > 3.8 && Math.abs(butDe(1 - e) - j.p.z) < 10;
        const c = commandeDe(k, { lb, rb, r2, lt, flanc });
        const a = { ...c.spec, commande: c.id, charge: true, p: null };
        if (estTir(a.type)) a.x = viseX;
        else if (dirStick) { a.dx = dirStick.x; a.dz = dirStick.z; }
        if (c.id === 'uneDeux' && j) { a.uneDeux = 'appel'; cmd.uneDeux = { t, de: j.i }; }
        cmd.jauge = { bouton: k, t0: t, type: estTir(a.type) ? 'frappe' : a.type, commande: c.id };
        cmd.lache = null;
        sortir(a);
        break;
      }
    }
    // la charge : la jauge monte tant que la touche est tenue ; au relâché, la puissance est figée (un appui de moins
    // de 0,15 s est bref : la simulation prend la puissance juste)
    if (cmd.jauge) {
      const jg = cmd.jauge, dur = t - jg.t0;
      cmd.p = Math.min(1, dur / JEU.jauge);
      it.tenir = true; it.puissance = cmd.p; it.bref = false; it.viseX = viseX;
      if (!tenu(jg.bouton)) {
        it.tenir = false; it.bref = dur < JEU.bref;
        cmd.lache = { t, p: cmd.p, bref: it.bref, viseX };
        if (jg.type === 'frappe') cmd.frappeT = t;
        cmd.jauge = null; cmd.p = 0;
      }
    } else if (cmd.lache && t - cmd.lache.t < 1.5) { it.tenir = false; it.puissance = cmd.lache.p; it.bref = cmd.lache.bref; it.viseX = cmd.lache.viseX; }
    // la remise du une-deux : quand L1 n'est plus tenu et que le receveur (qu'on joue maintenant) a la balle
    const U = cmd.uneDeux;
    if (U && t - U.t > 3.5) cmd.uneDeux = null;
    else if (U && !lb && j && p === j && j.i !== U.de && !cmd.jauge && !cmd.attente) { sortir({ type: 'passe', p: 0.5, uneDeux: 'remise', commande: 'uneDeux' }); cmd.uneDeux = null; }
    // L1 / LB seul, sans la balle (balle libre près de nous) : changer vers le joueur le plus proche du ballon
    if (bas(B.LB) && p !== j && !cmd.jauge) cmd.changer = true;
    // le jonglage : L1 + R1 tenus, à l'arrêt, balle au pied, sans rien d'autre
    const J = cmd.jongle;
    if (lb && rb && !cmd.jauge && st.amp === 0 && p === j) {
      if (J.t0 == null) J.t0 = t;
      if (t - J.t0 >= 0.4 && t >= J.prochain && !cmd.attente) { sortir({ type: 'jongle', commande: 'jongle' }); J.prochain = t + 0.3; }
    } else J.t0 = null;
  } else {
    // en défense, une jauge ou un geste commencés en attaque sont perdus ; le une-deux, seulement si l'adversaire a la
    // balle (pendant la passe, personne ne l'a)
    cmd.jauge = null; cmd.p = 0; cmd.r3 = null; cmd.lache = null;
    if (p && p.e !== e) cmd.uneDeux = null;
    oublierLecteur(cmd.lecteur);
    it.contenir = lt;
    it.presse = tenu(B.A);
    it.charge = tenu(B.B);
    it.tire = tenu(B.B);
    it.sortie = tenu(B.Y);
    it.renfort = tenu(B.RB);
    if (bas(B.X)) sortir({ type: 'tacle', glisse: true, commande: 'tacle' });
    // (correctifs #26 : collé dans le dos du porteur, B ne tacle pas : tenu, c'est le tirage de maillot ; avant, le
    // premier appui partait toujours en tacle debout et le tirage n'arrivait jamais à la manette)
    else if (bas(B.B) && !dansLeDos(j, p)) sortir({ type: 'tacle', glisse: false, commande: 'recuperer' });
    if (bas(B.LB)) cmd.changer = true;
  }

  // stick droit : gestes en attaque (lecteur relatif au cap du joueur), choix du joueur en défense
  const rs = zoneMorte(ax[2] ?? 0, -(ax[3] ?? 0), 0.25);
  if (attaque && j) {
    // R3 : enfoncé, il attend ; un coup sec avant pendant qu'il est tenu fait le sombrero, sinon la semelle au relâché
    if (bas(B.R3)) cmd.r3 = { t0: t, geste: false };
    const a = lireGesteStick(cmd.lecteur, ax[2] ?? 0, -(ax[3] ?? 0), t, M, j, versJeu, lt, !!cmd.r3);
    if (a && p === j && !cmd.attente) { sortir(a); if (cmd.r3) cmd.r3.geste = true; }
    if (cmd.r3 && haut(B.R3)) {
      if (!cmd.r3.geste && t - cmd.r3.t0 < 0.5 && !cmd.attente) sortir({ type: 'semelle' });
      cmd.r3 = null;
    }
    cmd.geste.actif = false;
  } else {
    const ge = cmd.geste;
    if (rs.amp > 0.55) {
      if (!ge.actif) {
        ge.actif = true;
        const g = versJeu(rs.x, rs.y);
        cmd.changer = { dx: g.x, dz: g.z };
      }
    } else if (rs.amp < 0.3) ge.actif = false;
  }

  for (let i = 0; i < 17; i++) prec[i] = b[i] ?? 0;
  return it;
}
