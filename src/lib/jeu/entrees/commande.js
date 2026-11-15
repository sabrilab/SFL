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
// La disposition est celle des jeux de foot de rue console (convention de genre ; tableau complet et unique dans
// entrees/touches.js, exporté par le banc) :
//   stick gauche courir ; RT/R2 sprint analogique ; LT/L2 : sans stick protéger, avec le stick conduite serrée et
//   gestes fins (attaque) ou contenir (défense)
//   attaque : A/✕ passe (LB + : une-deux, la remise part quand LB est lâché), B/○ lobée (centre près de la ligne de
//             but, sur un côté), Y/△ profondeur, X/□ frappe ; RB + passe = tendue ; frappe + RB = brossée, + LB =
//             piqué, + LB + RB = à ras de terre, + LT = extérieur ; X puis A avant l'impact = feinte de frappe ;
//             R3 cliqué = semelle ; LB + RB tenus à l'arrêt = jonglage ; LB sans la balle = changer de joueur ;
//             stick droit = gestes techniques (entrees/geste-stick.js, relatifs au cap du joueur)
//   défense : A/✕ maintenu pressing, X/□ tacle glissé, B/○ tacle debout (maintenu : l'épaule, et derrière le porteur
//             le tirage de maillot), Y/△ maintenu sortie du gardien, RB/R1 maintenu pressing d'un coéquipier, LB/L1
//             changer de joueur, stick droit poussé : prendre le joueur de ce côté
//   (changement par rapport à #23 : en défense, B et X sont inversés, comme dans le genre)
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

/** Remet une intention de manette à zéro (mêmes champs que sim/ia.js intentionVide, plus ceux des humains). */
function vide(it) {
  it.dx = 0; it.dz = 0; it.allure = 0; it.sprint = 0; it.regard = null;
  it.contenir = false; it.protege = false; it.charge = false; it.tire = false; it.presse = false; it.renfort = false; it.sortie = false;
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
  cmd.jauge = null; cmd.p = 0; cmd.attente = null; cmd.changer = null;
  cmd.geste.actif = false; cmd.geste.fait = false;
  oublierLecteur(cmd.lecteur); cmd.r3 = null; cmd.uneDeux = null; cmd.jongle.t0 = null; cmd.frappeT = -9;
  cmd.vu = false;
}

/**
 * Lit l'état d'une manette pour l'équipe e, dans le monde M, à l'heure t (s).
 * versJeu(sx, sy) : l'écran (sx vers la droite, sy vers le haut) → le repère du jeu { x, z }, selon la caméra.
 */
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
  const attaque = p ? p.e === e : !!(j && Math.hypot(bl.p.x - j.p.x, bl.p.z - j.p.z) < 3.5 && bl.garde == null);
  const lt = gachette(b[B.LT] ?? 0) > 0.3;
  const sortir = (a) => { cmd.attente = a; cmd.dernier = a; };

  if (attaque) {
    // LT : sans stick, protéger la balle ; avec le stick, la conduite serrée (pas de sprint, allure tenue)
    it.protege = lt && p === j && st.amp < 0.2;
    if (lt && st.amp >= 0.2) { it.allure = Math.min(it.allure, 0.6); it.sprint = 0; }
    const lb = tenu(B.LB), rb = tenu(B.RB);
    // la feinte de frappe : A pendant qu'on charge la frappe, ou juste après l'avoir lâchée (avant l'impact)
    if (bas(B.A) && (cmd.jauge?.type === 'frappe' || (!cmd.jauge && t - cmd.frappeT < 0.35))) {
      cmd.jauge = null; cmd.p = 0; cmd.frappeT = -9;
      sortir({ type: 'feinteFrappe' });
    }
    // la jauge : un seul bouton à la fois ; la passe ou la frappe part au relâché
    const types = [[B.A, 'passe'], [B.B, 'lob'], [B.Y, 'profondeur'], [B.X, 'frappe']];
    if (!cmd.jauge && !cmd.attente) for (const [k, type] of types) if (bas(k)) { cmd.jauge = { bouton: k, t0: t, type, uneDeux: k === B.A && lb }; break; }
    if (cmd.jauge) {
      const jg = cmd.jauge;
      cmd.p = Math.min(1, (t - jg.t0) / JEU.jauge);
      if (haut(jg.bouton) || !tenu(jg.bouton)) {
        const f = jg.type === 'frappe';
        const pw = Math.max(f ? 0.2 : 0.12, cmd.p);
        let a;
        if (f) {
          // le côté du but que montre le stick (repère du jeu : x en travers)
          const x = dirStick ? Math.max(-1, Math.min(1, dirStick.x)) * (BUT_DL - 0.35) : 0;
          if (lb && rb) a = { type: 'frappe', p: pw, x, y: 0.15, ras: true };
          else a = { type: lb ? 'lobFrappe' : rb ? 'finesse' : lt ? 'exterieur' : 'frappe', p: pw, x };
          cmd.frappeT = t;
        } else {
          let type = jg.type;
          // le centre : B sur un côté, près de la ligne de but adverse
          if (type === 'lob' && j && Math.abs(j.p.x) > 3.8 && Math.abs(butDe(1 - e) - j.p.z) < 10) type = 'centre';
          const tendue = type === 'passe' && rb;
          a = { type, p: tendue ? Math.min(1, 0.45 + 0.55 * pw) : type === 'centre' ? Math.max(0.6, pw) : pw };
          if (dirStick) { a.dx = dirStick.x; a.dz = dirStick.z; }
          if (type === 'passe' && jg.uneDeux && j) { a.uneDeux = 'appel'; cmd.uneDeux = { t, de: j.i }; }
        }
        sortir(a);
        cmd.jauge = null; cmd.p = 0;
      }
    }
    // la remise du une-deux : quand LB n'est plus tenu et que le receveur (qu'on joue maintenant) a la balle
    const U = cmd.uneDeux;
    if (U && t - U.t > 3.5) cmd.uneDeux = null;
    else if (U && !lb && j && p === j && j.i !== U.de && !cmd.jauge && !cmd.attente) { sortir({ type: 'passe', p: 0.5, uneDeux: 'remise' }); cmd.uneDeux = null; }
    // LB sans la balle (balle libre près de nous) : changer de joueur
    if (bas(B.LB) && p !== j && !cmd.jauge) cmd.changer = true;
    // le jonglage : LB + RB tenus, à l'arrêt, balle au pied, sans rien d'autre
    const J = cmd.jongle;
    if (lb && rb && !cmd.jauge && st.amp === 0 && p === j) {
      if (J.t0 == null) J.t0 = t;
      if (t - J.t0 >= 0.4 && t >= J.prochain && !cmd.attente) { sortir({ type: 'jongle' }); J.prochain = t + 0.3; }
    } else J.t0 = null;
  } else {
    // en défense, une jauge ou un geste commencés en attaque sont perdus ; le une-deux, seulement si l'adversaire a la
    // balle (pendant la passe, personne ne l'a)
    cmd.jauge = null; cmd.p = 0; cmd.r3 = null;
    if (p && p.e !== e) cmd.uneDeux = null;
    oublierLecteur(cmd.lecteur);
    it.contenir = lt;
    it.presse = tenu(B.A);
    it.charge = tenu(B.B);
    it.tire = tenu(B.B);
    it.sortie = tenu(B.Y);
    it.renfort = tenu(B.RB);
    if (bas(B.X)) sortir({ type: 'tacle', glisse: true });
    else if (bas(B.B)) sortir({ type: 'tacle', glisse: false });
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
