// Une manette → l'intention d'une équipe (bola-app#23), sans DOM : la même structure que le pouce et l'IA (direction,
// allure, sprint, regard, contenir, protéger, charger, presser, plus une action consommée une fois). Le banc node
// (tools/jeu-banc-manettes.ts) la nourrit d'états de manette inventés ; la page (entrees/manettes.js) de vraies.
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
// Les touches (tableau complet dans le compte rendu de bola-app#23) :
//   stick gauche courir ; RT/R2 sprint analogique ; LT/L2 protéger (attaque) ou contenir (défense)
//   attaque : A/✕ passe, B/○ lobée, Y/△ profondeur, X/□ frappe ; RB/R1 + passe = tendue, + frappe = finesse ;
//             LB/L1 + frappe = frappe lobée ; stick droit : quart de tour ou coup sec = crochet de ce côté,
//             demi-cercle = roulette, R3 = arrêt sur la semelle
//   défense : A/✕ maintenu pressing, B/○ tacle glissé, X/□ tacle debout (maintenu : l'épaule), Y/△ maintenu sortie
//             du gardien, RB/R1 maintenu pressing d'un coéquipier, LB/L1 changer de joueur, stick droit poussé :
//             prendre le joueur de ce côté
//   Menu/Options : pause (lu par la page, pas ici)
import { JEU, BUT_DL } from '../sim/constantes.js';
import { porteur } from '../sim/gestes.js';

/** Zone morte radiale (0,18) remise à l'échelle, puis courbe s^1,4 : { x, y, amp } (amp de 0 à 1). */
export function zoneMorte(x, y, mort = 0.18) {
  const L = Math.hypot(x, y);
  if (!(L > mort)) return { x: 0, y: 0, amp: 0 };
  const s = Math.min(1, (L - mort) / (1 - mort - 0.05));
  const amp = Math.pow(s, 1.4);
  return { x: x / L, y: y / L, amp };
}

/** Une gâchette lue en analogique, zone morte 0,08 remise à l'échelle. */
export const gachette = (v) => (v > 0.08 ? Math.min(1, (v - 0.08) / 0.92) : 0);

const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VUE: 8, MENU: 9, L3: 10, R3: 11, HAUT: 12, BAS: 13, GAUCHE: 14, DROITE: 15 };
export const BOUTONS = B;
const APPUI = 0.5;
const DEMI_CERCLE = (150 * Math.PI) / 180;

/** Remet une intention de manette à zéro (mêmes champs que sim/ia.js intentionVide, plus ceux des humains). */
function vide(it) {
  it.dx = 0; it.dz = 0; it.allure = 0; it.sprint = 0; it.regard = null;
  it.contenir = false; it.protege = false; it.charge = false; it.presse = false; it.renfort = false; it.sortie = false;
  return it;
}

export function creerCommande() {
  return {
    it: vide({ action: null, changer: null }),
    prec: new Float64Array(17),
    vu: false,
    jauge: null,            // { bouton, t0, type } : une passe ou une frappe qu'on charge
    p: 0,                   // la jauge en cours, de 0 à 1 (pour l'anneau sous le joueur)
    geste: { actif: false, a: 0, balayage: 0, fait: false, dx: 0, dz: 0 },
    attente: null,          // l'action qui partira au prochain pas
    changer: null,
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

  if (attaque) {
    it.protege = lt && p === j;
    // la jauge : un seul bouton à la fois ; la passe ou la frappe part au relâché
    const types = [[B.A, 'passe'], [B.B, 'lob'], [B.Y, 'profondeur'], [B.X, 'frappe']];
    if (!cmd.jauge) for (const [k, type] of types) if (bas(k)) { cmd.jauge = { bouton: k, t0: t, type }; break; }
    if (cmd.jauge) {
      const jg = cmd.jauge;
      cmd.p = Math.min(1, (t - jg.t0) / JEU.jauge);
      if (haut(jg.bouton) || !tenu(jg.bouton)) {
        const f = jg.type === 'frappe';
        const pw = Math.max(f ? 0.2 : 0.12, cmd.p);
        let a;
        if (f) {
          const finesse = tenu(B.RB), lobee = tenu(B.LB);
          // le côté du but que montre le stick (repère du jeu : x en travers)
          const x = dirStick ? Math.max(-1, Math.min(1, dirStick.x)) * (BUT_DL - 0.35) : 0;
          a = { type: lobee ? 'lobFrappe' : finesse ? 'finesse' : 'frappe', p: pw, x };
        } else {
          const tendue = jg.type === 'passe' && tenu(B.RB);
          a = { type: jg.type, p: tendue ? Math.min(1, 0.45 + 0.55 * pw) : pw };
          if (dirStick) { a.dx = dirStick.x; a.dz = dirStick.z; }
        }
        cmd.attente = a;
        cmd.jauge = null; cmd.p = 0;
      }
    }
    if (bas(B.R3)) cmd.attente = { type: 'semelle' };
  } else {
    // en défense, une jauge commencée en attaque est perdue
    cmd.jauge = null; cmd.p = 0;
    it.contenir = lt;
    it.presse = tenu(B.A);
    it.charge = tenu(B.X);
    it.sortie = tenu(B.Y);
    it.renfort = tenu(B.RB);
    if (bas(B.B)) cmd.attente = { type: 'tacle', glisse: true };
    else if (bas(B.X)) cmd.attente = { type: 'tacle', glisse: false };
    if (bas(B.LB)) cmd.changer = true;
  }

  // stick droit : gestes en attaque, choix du joueur en défense
  const rs = zoneMorte(ax[2] ?? 0, -(ax[3] ?? 0), 0.25);
  const ge = cmd.geste;
  if (rs.amp > 0.55) {
    const a = Math.atan2(rs.y, rs.x);
    const g = versJeu(rs.x, rs.y);
    if (!ge.actif) {
      ge.actif = true; ge.a = a; ge.balayage = 0; ge.fait = false;
      if (!attaque) { cmd.changer = { dx: g.x, dz: g.z }; ge.fait = true; }
    } else {
      let d = a - ge.a;
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      ge.balayage += d; ge.a = a;
      if (attaque && !ge.fait && Math.abs(ge.balayage) >= DEMI_CERCLE) { cmd.attente = { type: 'roulette', dx: g.x, dz: g.z }; ge.fait = true; }
    }
    ge.dx = g.x; ge.dz = g.z;
  } else if (rs.amp < 0.3 && ge.actif) {
    // relâché sans demi-cercle : le crochet, du côté où le stick est allé
    if (attaque && !ge.fait && p === j) cmd.attente = { type: 'crochet', dx: ge.dx, dz: ge.dz };
    ge.actif = false; ge.fait = false;
  }

  for (let i = 0; i < 17; i++) prec[i] = b[i] ?? 0;
  return it;
}
