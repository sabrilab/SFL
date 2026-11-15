// Les gestes de balle : conduite par touches, contrôle orienté, passes, lobs, frappes et finesse (bola-app#23).
//
// La balle n'est jamais collée au pied : « avoir la balle » veut dire être le dernier à l'avoir touchée et pouvoir la
// toucher de nouveau (balle.possesseur). Tout passe par des impulsions données quand le pied est à portée :
//   · conduite : une touche tombe sur un appui de la foulée (phase φ, corps.js) quand le pied prévu (piedLoco, la table
//     des pieds du clip de course à cette phase) est à moins de 0,25 m du centre du ballon ;
//     elle repart à v + Δv, Δv = √(2 a L(v)) pour qu'elle prenne au plus L(v) = 0,4 + 0,38 v mètres d'avance (0,9 m au
//     trot lent, 3 m en sprint) avant que le roulement ne la ramène, dans la direction voulue à θ_max près de sa course
//     (35° à l'arrêt, 12° en sprint), avec une erreur à graine qui grandit avec la vitesse, la pression et le
//     déséquilibre. En sprint, la balle part à 2,5-4 m : un défenseur peut s'interposer. À l'arrêt, la semelle
//     ramène la balle par petites touches ; en protégeant, la balle est gardée de l'autre côté du corps.
//   · contrôle orienté (à portée : 0,35 m du pied prévu, de la cuisse ou du buste ; une balle qui vient de changer de
//     camp ne se reprend pas avant 0,25 s) : la qualité q baisse avec la vitesse d'arrivée, l'angle de rotation, la pression, le
//     déséquilibre et la surface (pied, cuisse, poitrine, tête) ; la balle sortante mêle la sortie voulue (q) et le
//     rebond sur la surface (1 − q). Une passe à 22 m/s prise de travers rebondit sur le pied.
//   · passes et frappes : le geste (clip et rythme) est choisi pour que l'impact tombe dans 0,22 s, le joueur règle
//     ses derniers pas pour amener le pied à la balle, et à l'impact la balle part de là où elle est, si le pied est
//     à moins de 0,30 m d'elle (sinon frappe effleurée ou manquée, journalisée). Puissance = jauge (0..1) ; erreur à
//     graine σ = 0,6° + 5° p² + 4° pression + 3° v/7,4 + 4° angle/90° ; l'aide (pouce, manette) corrige la
//     direction d'une passe, jamais sa force.
//   · (bola-app#26, lot 2) l'effet suit le pied : l'intérieur du pied droit (finesse) enroule vers la gauche de la
//     course (ω_y > 0), celui du gauche vers la droite ; l'extérieur (exterieur) fait l'inverse ; la visée de ces
//     frappes est corrigée par l'intégrateur (traînée, Magnus) pour que la courbe finisse sur la cible. Un contrôle
//     raté (q < 0,35) part vraiment : la balle repart de la surface avec 40 à 70 % de sa vitesse, dans la réflexion,
//     et le contrôleur lancé trébuche sous 0,15. Un joueur qui a demandé une frappe ne contrôle pas la balle aérienne
//     qui arrive : il la reprend de volée ou de la tête. Les deux dernières passes sont gardées (m.passes) : la
//     remise du receveur au passeur, reprise par lui, est un une-deux (m.stats.uneDeux).
import { PAS, G, BALLON, JEU, CORPS, BUT_DL, BUT_H, butDe, sens, LB, BX, BZ } from './constantes.js';
import { piedA, teteA, piedLoco, racineA, versMonde, lancerGeste, impactDe, libre, clamp, enrouler, duree, trebucher } from './corps.js';
import { predire } from './ballon.js';
import { CLIPS, FPS_CLIPS } from './clips.js';
import { acos, atan2, cos, hypot, sin } from './maths.js';

const R = BALLON.R;
/** (bola-app#26, lot 2) les gestes qui visent le but : frappe, finesse (intérieur brossé), extérieur, piqué */
export const estFrappe = (type) => type === 'frappe' || type === 'finesse' || type === 'lobFrappe' || type === 'exterieur';
// (les gestes aériens : la volée et la tête, pour les statistiques)
const AERIENS = /^(head_std|header2|volley|bicycle|shoot2)/;
// la frappe en course : vitesse moyenne de son root motion au rythme 1 (strike_run, 2,97 hanches en 1,3 s)
const DEG = Math.PI / 180;
const t1 = { x: 0, y: 0, z: 0 }, t2 = { x: 0, y: 0, z: 0 }, f0 = { x: 0, y: 0, z: 0 }, f1 = { x: 0, y: 0, z: 0 };

/** La distance (au sol) du pied prévu le plus proche au centre du ballon, et ce pied (0 ou 1). */
export function piedProche(j, b, balle) {
  piedLoco(j, balle, 0, f0); piedLoco(j, balle, 1, f1);
  const d0 = hypot(b.p.x - f0.x, b.p.z - f0.z), d1 = hypot(b.p.x - f1.x, b.p.z - f1.z);
  return d0 <= d1 ? { d: d0, pied: 0 } : { d: d1, pied: 1 };
}

/** La balle roule sans glisser dans la direction de sa vitesse (rotation de roulement). */
export function rouler(b) {
  b.w.z = -b.v.x / R; b.w.x = b.v.z / R;
}

/** L'adversaire le plus proche de j, et sa distance. */
export function adversaireProche(m, j) {
  let best = null, bd = Infinity;
  for (const o of m.joueurs) {
    if (o.absent || o.e === j.e || o.mode === 'sol') continue;
    const d = hypot(o.p.x - j.p.x, o.p.z - j.p.z);
    if (d < bd) { bd = d; best = o; }
  }
  return { o: best, d: bd };
}
const pression = (m, j) => (adversaireProche(m, j).d < 1.2 ? 1 : 0);

/** Le porteur : le dernier à avoir contrôlé la balle, tant qu'elle reste à sa portée de course. */
export function porteur(m) {
  const b = m.balle;
  if (b.garde != null) return null;
  const j = b.possesseur != null ? m.joueurs[b.possesseur] : null;
  if (!j) return null;
  const d = hypot(b.p.x - j.p.x, b.p.z - j.p.z);
  if (d > 5 || m.t - b.dernierT > 2.2 || j.mode === 'sol') { b.possesseur = null; return null; }
  return j;
}

function toucher(m, j, { possede = true } = {}) {
  const b = m.balle;
  b.dernier = j.i; b.dernierT = m.t;
  if (possede) b.possesseur = j.i;
  b.tir = null;
  if (b.recepteur != null && b.recepteur !== j.i) b.recepteur = null;
  if (b.recepteur === j.i) b.recepteur = null;
}

// ── la conduite ──
const classe = (v) => (v < 2 ? 0 : v < 4.6 ? 1 : v < 6.2 ? 2 : 3);

/**
 * Une touche de conduite, si le pied qui arrive est à portée et que la balle n'est pas déjà assez loin devant.
 * appui : un pied vient de se poser (la phase a passé un multiple de 0,5).
 */
export function pasConduite(m, j, appui) {
  const b = m.balle, it = j.int;
  if (b.p.y > 0.4 || !libre(j)) return;
  const s = hypot(j.v.x, j.v.z);
  const fx = sin(j.cap), fz = cos(j.cap);
  const rx = b.p.x - j.p.x, rz = b.p.z - j.p.z;
  const avant = rx * fx + rz * fz, cote = rx * fz - rz * fx;
  // direction voulue (sinon la course, sinon le cap)
  let ux = it?.dx ?? 0, uz = it?.dz ?? 0;
  if (!(ux || uz) || (it?.allure ?? 0) < 0.05) { if (s > 0.5) { ux = j.v.x / s; uz = j.v.z / s; } else { ux = fx; uz = fz; } }
  const bv = hypot(b.v.x, b.v.z);

  if (it?.protege) {
    // protéger : la balle derrière le corps par rapport à l'adversaire, à 0,55 m, par petites touches
    const { o } = adversaireProche(m, j);
    if (!o) return;
    if (m.t - (j.toucheT ?? -9) < 0.18) return;
    const ox = j.p.x - o.p.x, oz = j.p.z - o.p.z, L = hypot(ox, oz) || 1;
    const cx = j.p.x + (ox / L) * 0.55, cz = j.p.z + (oz / L) * 0.55;
    const d = hypot(b.p.x - cx, b.p.z - cz);
    if (hypot(rx, rz) > 1.0) return;
    if (d > 0.12) {
      j.toucheT = m.t;
      b.v.x = j.v.x + clamp((cx - b.p.x) * 3, -1.5, 1.5); b.v.z = j.v.z + clamp((cz - b.p.z) * 3, -1.5, 1.5);
      rouler(b); toucher(m, j);
    }
    return;
  }

  if (s < 0.8) {
    // la semelle : petites touches qui ramènent la balle devant le pied
    if (hypot(rx, rz) > 0.95 || m.t - (j.toucheT ?? -9) < 0.2) return;
    // vers où il veut repartir (sinon devant lui)
    const veut = (it?.allure ?? 0) > 0.05 && (it.dx || it.dz);
    const cx = j.p.x + (veut ? ux : fx) * 0.42, cz = j.p.z + (veut ? uz : fz) * 0.42;
    const d = hypot(b.p.x - cx, b.p.z - cz);
    if (d > 0.1 || bv > 0.6) {
      j.toucheT = m.t;
      b.v.x = j.v.x + clamp((cx - b.p.x) * 2.5, -1.5, 1.5); b.v.z = j.v.z + clamp((cz - b.p.z) * 2.5, -1.5, 1.5);
      rouler(b); toucher(m, j);
    }
    return;
  }
  // la touche part du pied : le pied prévu (table du clip de course, à la phase de la foulée) doit être à moins de
  // porteeTouche (0,25 m) du centre du ballon, devant le corps ; un appui qui tombe à portée, ou un pied en l'air qui
  // la rattrape au passage
  if (!(avant > 0.0 && avant < 1.2 && Math.abs(cote) < 0.5)) return;
  const pp = piedProche(j, b, true);
  if (pp.d > JEU.porteeTouche) return;
  const rattrape = (j.v.x - b.v.x) * fx + (j.v.z - b.v.z) * fz > 0.3;
  if (!appui && !rattrape) return;
  // la balle file déjà assez devant : pas besoin de la toucher à cet appui
  const k = classe(s);
  const bAvant = (b.v.x * ux + b.v.z * uz);
  if (avant > 0.35 && bAvant > s + 0.4) return;
  // la touche
  const pr = pression(m, j);
  const v7 = s / CORPS.vSprint;
  const rng = m.rng.touches;
  const sigT = (2 + 4 * v7 * v7 + 6 * pr + 8 * j.d) * DEG;
  const sigL = 0.06 + 0.12 * v7 * v7;
  // direction : la voulue, à θ_max près de la course actuelle de la balle (ou du joueur)
  let hb = bv > 1 ? atan2(b.v.x, b.v.z) : atan2(j.v.x, j.v.z);
  const hv = atan2(ux, uz);
  const tmax = JEU.touche.thetaMax[k] * DEG;
  const h = hb + clamp(enrouler(hv - hb), -tmax, tmax) + rng.normal() * sigT;
  // la longueur de la touche : la balle prend d'avance au plus L(v) = 0,4 + 0,38 v mètres (3 m en sprint) avant que
  // le roulement (1,1 m/s²) ne la ramène à la vitesse du joueur ; d'où l'écart de vitesse Δv = √(2 a L) (λ = Δv / v)
  const Lt = 0.4 + 0.38 * s;
  const dv = Math.sqrt(2 * 1.1 * Lt);
  const vt = (s + dv) * (1 + rng.normal() * sigL);
  b.v.x = sin(h) * vt; b.v.z = cos(h) * vt; b.v.y = 0;
  rouler(b);
  j.toucheT = m.t;
  toucher(m, j);
  m.journal?.('touche', j.i, vt);
}

// ── le contrôle ──
/**
 * Un joueur qui veut la balle et l'a à portée la contrôle (ou la rate). Renvoie vrai s'il l'a touchée.
 */
export function pasControle(m, j, contact = false) {
  const b = m.balle;
  // (un amorti lancé d'avance, pasAnticipation, attend la balle : il peut la contrôler)
  if (!(libre(j) || (j.g?.type === 'amorti' && j.recup <= 0)) || b.garde != null) return false;
  if (b.dernier === j.i && m.t - b.dernierT < 0.3) return false;
  if (b.possesseur === j.i) return false;
  const pos = b.possesseur != null ? m.joueurs[b.possesseur] : null;
  // la balle d'un porteur qui la conduit de près : c'est l'affaire du tacle, pas d'un contrôle
  // (pour la lui prendre, il faut un tacle ; une balle poussée loin devant, elle, se prend)
  if (pos && pos !== j && pos.e !== j.e && hypot(pos.p.x - b.p.x, pos.p.z - b.p.z) < 0.85 && (pos.mode === 'loco' || pos.mode === 'frein' || pos.mode === 'pivot')) return false;
  // une balle qui vient de changer de pied ne change pas de nouveau tout de suite (plus de possession en ping-pong)
  if (b.dernier != null && m.joueurs[b.dernier].e !== j.e && m.t - b.dernierT < 0.25) return false;
  if (pos && pos !== j && pos.e === j.e && hypot(pos.p.x - b.p.x, pos.p.z - b.p.z) < 1.2) return false;
  if (b.p.y > 2.0) return false;
  // (bola-app#26, lot 2) il a demandé une reprise : la balle aérienne se frappe, elle ne se contrôle pas
  if (j.demande && b.p.y > 0.35 && !contact) return false;
  // (après un coup franc, les adversaires ne la touchent pas tant qu'elle n'est pas jouée)
  if (m.ecart?.e === j.e) return false;
  // la portée se mesure depuis la surface qui touche : le pied prévu le plus proche, la cuisse (0,15 m devant le
  // corps), le buste ou la tête (l'axe du corps)
  let dh;
  if (b.p.y < 0.35) dh = piedProche(j, b, false).d;
  else if (b.p.y < 0.95) dh = hypot(b.p.x - j.p.x - sin(j.cap) * 0.15, b.p.z - j.p.z - cos(j.cap) * 0.15);
  else dh = hypot(b.p.x - j.p.x, b.p.z - j.p.z);
  // (contact : la balle vient de heurter ses jambes ou son buste, contacts.js ; il la contrôle de là, moins bien)
  if (contact) dh = Math.min(dh, 0.3);
  if (dh > JEU.porteeControle) return false;
  const vrx = b.v.x - j.v.x, vry = b.v.y, vrz = b.v.z - j.v.z;
  const vin = hypot(vrx, vry, vrz);
  // la balle s'éloigne déjà du joueur : rien
  if ((b.p.x - j.p.x) * vrx + (b.p.z - j.p.z) * vrz > 0.2 && vin > 1.5 && dh > 0.3) return false;
  const surface = b.p.y < 0.35 ? 'pied' : b.p.y < 0.95 ? 'cuisse' : b.p.y < 1.45 ? 'poitrine' : 'tete';
  const it = j.int ?? {};
  const aide = j.aide ?? 0;
  const pr = pression(m, j);
  // la sortie voulue : le stick (sinon vers l'avant du jeu)
  let ux = it.dx ?? 0, uz = it.dz ?? 0;
  if (!(ux || uz) || (it.allure ?? 0) < 0.03) { ux = 0; uz = sens(j.e); }
  const L = hypot(ux, uz) || 1; ux /= L; uz /= L;
  const sj = hypot(j.v.x, j.v.z);
  const vs = sj < 0.8 ? 0.5 : sj + 1;
  const bh = hypot(b.v.x, b.v.z);
  const rot = bh > 0.5 ? Math.abs(enrouler(atan2(ux, uz) - atan2(b.v.x, b.v.z))) : 0;
  let q = (contact ? 1 - 0.15 * clamp((vin - 10) / 8, 0, 1) : 1) - Math.max(0, vin - 7) / 20 - 0.35 * (rot / Math.PI) - 0.2 * pr - 0.3 * j.d - (surface !== 'pied' ? 0.1 : 0) + 0.15 * aide;
  q = clamp(q, 0, 1);
  const rng = m.rng.touches;
  // le rebond sur la surface : la vitesse relative réfléchie (la normale fait face à la balle), amortie
  const ep = { pied: 0.35, cuisse: 0.45, poitrine: 0.3, tete: 0.6 }[surface];
  const bruit = (1 - q) * 0.25;
  const rfx = -vrx * ep + rng.normal() * bruit * vin * 0.3, rfz = -vrz * ep + rng.normal() * bruit * vin * 0.3;
  // (la cuisse ne relève presque plus la balle, la poitrine la laisse tomber : elle retombe sous la gravité)
  const rfy = surface === 'poitrine' ? 0 : Math.abs(vry) * ep * 0.5 + (surface === 'cuisse' ? 0.15 : 0);
  let ox, oy, oz;
  if (surface === 'tete') {
    // une tête : la balle repart vers où il veut, à 0,55 de sa vitesse, un peu levée
    const sv = 0.55 * vin + 2;
    ox = q * ux * sv + (1 - q) * rfx + j.v.x * 0.3; oz = q * uz * sv + (1 - q) * rfz + j.v.z * 0.3; oy = 1.2 + rng.u() * 1.5;
  } else {
    ox = q * (ux * vs) + (1 - q) * rfx + j.v.x * (1 - q);
    oz = q * (uz * vs) + (1 - q) * rfz + j.v.z * (1 - q);
    oy = (1 - q) * rfy;
  }
  let rate = false;
  if (q < 0.35 && vin > 4) {
    // (bola-app#26, lot 2) le contrôle raté part vraiment : la balle repart de la surface, dans la réflexion de sa
    // vitesse relative (bruitée), avec 40 % (q = 0,35) à 70 % (q = 0) de cette vitesse
    const part = 0.4 + 0.3 * (0.35 - q) / 0.35;
    let rx = -vrx, rz = -vrz;
    const rl = hypot(rx, rz) || 1;
    const dev = rng.normal() * 0.45;
    const c = cos(dev), sn = sin(dev);
    const dx = (rx / rl) * c + (rz / rl) * sn, dz = -(rx / rl) * sn + (rz / rl) * c;
    const sv = part * vin;
    ox = j.v.x + dx * sv; oz = j.v.z + dz * sv; oy = surface === 'pied' ? 0.3 + rng.u() * 0.8 : Math.abs(vry) * 0.3 + 0.5;
    rate = true;
  }
  b.v.x = ox; b.v.y = oy; b.v.z = oz;
  if (b.p.y < R + 0.02 && oy <= 0) rouler(b); else { b.w.x *= 0.3; b.w.y *= 0.3; b.w.z *= 0.3; }
  const possede = !rate && (q >= 0.35 || hypot(ox - j.v.x, oz - j.v.z) < 3);
  j.controleQ = q; j.controleT = m.t;
  // (lancé, raté de très peu : il trébuche sur la balle qui part)
  if (rate && q < 0.15 && sj > 5) { trebucher(j); m.ev('trebuche', { j: j.i }); }
  const etaitTir = b.tir;
  toucher(m, j, { possede });
  if (!possede) b.possesseur = null;
  j.toucheT = m.t;

  // l'animation (bola-app#26) : chaque surface a son geste, au pied qui touche (côté de la balle) ; un amorti déjà
  // lancé par l'anticipation (pasAnticipation) continue, calé pour que son contact tombe maintenant
  let clip = null;
  // (lot 2) un amorti anticipé qui ne va plus : la balle arrive de l'autre côté, ou le joueur a été poussé et court
  // (plus de 1,6 m/s) : il est repris par le geste juste
  if (j.g?.type === 'amorti') {
    const ga = (b.p.x - j.p.x) * cos(j.cap) - (b.p.z - j.p.z) * sin(j.cap) > 0;
    const pa = CLIPS[j.g.nom]?.piedImpact?.pied;
    if (sj > 1.6 || (pa && (pa === 'g') !== ga && Math.abs((b.p.x - j.p.x) * cos(j.cap) - (b.p.z - j.p.z) * sin(j.cap)) > 0.05)) { j.g = null; j.mode = 'loco'; }
  }
  if (j.g?.type !== 'amorti') {
    const c = clipControle(j, b, surface, sj, vin, possede);
    if (c) { clip = c.nom; lancerGeste(j, c.nom, { depuis: Math.max(0, c.impact - 0.06) / duree(c.nom), taux: c.taux, fin: Math.min(duree(c.nom), c.impact + c.apres), type: 'controle', donnees: { surface } }); }
  } else { clip = j.g.nom; j.g.type = 'controle'; j.g.donnees = { ...j.g.donnees, surface }; }
  m.ev('controle', { j: j.i, q, vin, surface, possede, rate, tir: !!etaitTir, clip, sj, gauche: (b.p.x - j.p.x) * cos(j.cap) - (b.p.z - j.p.z) * sin(j.cap) > 0 });
  // (le une-deux : la passe de j à X, puis la remise de X à j, reprise par j dans les 4,5 s)
  const [p1, p2] = m.passes;
  if (possede && p1 && p2 && !p2.compte && p1.de === j.i && p2.de === p1.a && p2.a === j.i && m.t - p1.t < 4.5) {
    p2.compte = true; m.stats.uneDeux++; m.ev('uneDeux', { j: j.i, o: p1.a });
  }
  return true;
}


// ── les gestes du contrôle (bola-app#26) ──
/**
 * Le clip d'un contrôle : au pied, l'amorti sur place (trap) quand le joueur est presque arrêté, la réception en
 * course (receive) sur une balle forte en courant, rien (la course continue) sinon ; pied levé (stall) pour une balle
 * entre 0,35 et 0,7 m ; la cuisse (knee) de 0,7 à 0,95 m ; la poitrine (trap, buste en arrière : couche du rendu) ;
 * la tête debout (head_std). Le clip est celui du pied (ou de la cuisse) du côté de la balle. impact : l'instant du
 * contact dans le clip (s), apres : ce que la simulation en joue après (s de clip : 0,25 à 0,3, le joueur rejoue
 * vite ; le rendu laisse le clip finir pendant son fondu vers la course).
 */
export function clipControle(j, b, surface, sj, vin, possede = true) {
  const fx = sin(j.cap), fz = cos(j.cap);
  const gauche = (b.p.x - j.p.x) * fz - (b.p.z - j.p.z) * fx > 0; // la balle à gauche du joueur
  const cote = (base, piedDuBase) => {
    // base touche du pied piedDuBase (« g » ou « d ») ; son miroir est base_l (ou l'inverse)
    const veut = gauche ? 'g' : 'd';
    const alt = base.endsWith('_l') ? base.slice(0, -2) : base + '_l';
    return veut === piedDuBase || !CLIPS[alt] ? base : alt;
  };
  const pied = (n) => CLIPS[n]?.piedImpact?.pied ?? 'd';
  const imp = (n) => impactDe(n);
  let nom = null, taux = 1.2, apres = 0.5;
  // (une balle presque arrêtée à ses pieds, l'engagement : elle se prend sans geste)
  if (vin < 2.5 && surface === 'pied') return null;
  if (surface === 'pied') {
    if (b.p.y > 0.22 && sj < 2.5) { nom = cote('stall', pied('stall')); apres = 0.3; }
    else if (sj < 1.6) { nom = cote('trap', pied('trap')); taux = 1.25; apres = 0.25; }
    else if (sj < 2 && vin > 7 && possede) return { nom: 'receive', impact: 3 / 30, taux: 1.3, apres: 0.55 };
  } else if (surface === 'cuisse') {
    nom = b.p.y < 0.7 && sj < 2.5 ? cote('stall', pied('stall')) : cote('knee', pied('knee'));
    taux = 1.4; apres = 0.25;
  } else if (surface === 'poitrine') { nom = cote('trap', pied('trap')); taux = 1.2; apres = 0.3; }
  else if (surface === 'tete') { nom = 'head_std'; taux = 1.5; apres = 0.3; }
  if (!nom || !CLIPS[nom]) return null;
  return { nom, impact: imp(nom), taux, apres };
}

/**
 * L'anticipation du contrôle : le receveur d'une passe, presque arrêté, lance son amorti avant que la balle n'arrive,
 * pour que le contact du clip tombe à son arrivée (le pied s'avance, la poitrine s'ouvre) ; la balle est prédite
 * (sans hasard) toutes les 0,05 s. S'il ne la touche pas, l'amorti finit seul et la course reprend.
 */
export function pasAnticipation(m, j) {
  const b = m.balle;
  if (b.recepteur !== j.i || !libre(j) || b.garde != null || j.gardien || j.demande) return;
  const sj = hypot(j.v.x, j.v.z);
  if (sj > 1.6 || m.t < (j.anticipeT ?? 0)) return;
  j.anticipeT = m.t + 0.05;
  const bv = hypot(b.v.x, b.v.y, b.v.z);
  if (bv < 2) return;
  const r = predire(b, (q) => hypot(q.p.x - j.p.x, q.p.z - j.p.z) < 0.45, 1.2);
  if (!r) return;
  const surface = r.p.y < 0.35 ? 'pied' : r.p.y < 0.95 ? 'cuisse' : r.p.y < 1.45 ? 'poitrine' : 'tete';
  // (la balle prédite, placée au point de contact, pour choisir le côté)
  const q = { p: r.p };
  const c = clipControle(j, q, surface, sj, hypot(r.v.x, r.v.y, r.v.z), true);
  if (!c || c.nom === 'receive') return;
  const avance = (c.impact - Math.max(0, c.impact - 0.35)) / c.taux; // l'amorti part 0,35 s de clip avant le contact
  if (r.t > avance + 0.02) return;
  const depuis = Math.max(0, c.impact - r.t * c.taux);
  lancerGeste(j, c.nom, { depuis: depuis / duree(c.nom), taux: c.taux, fin: Math.min(duree(c.nom), c.impact + c.apres), type: 'amorti', donnees: { surface } });
  m.ev('amorti', { j: j.i, nom: c.nom, dans: r.t });
}

// ── passes et frappes ──
/** Le partenaire dans la direction (dx, dz), au cône d'aide près ; sinon le meilleur devant. */
export function choisirPartenaire(m, j, dx, dz, cone = Math.PI) {
  let best = null, score = -Infinity;
  const L = hypot(dx, dz) || 1;
  for (const o of m.joueurs) {
    if (o.absent || o.e !== j.e || o === j || o.gardien) continue;
    const ox = o.p.x - j.p.x, oz = o.p.z - j.p.z, d = hypot(ox, oz) || 1;
    const al = (ox * dx + oz * dz) / (d * L);
    if (acos(clamp(al, -1, 1)) > cone) continue;
    let gene = 0, libreO = 9;
    for (const a of m.joueurs) {
      if (a.absent || a.e === j.e) continue;
      const t = clamp(((a.p.x - j.p.x) * ox + (a.p.z - j.p.z) * oz) / (d * d), 0, 1);
      const px = j.p.x + ox * t - a.p.x, pz = j.p.z + oz * t - a.p.z;
      if (hypot(px, pz) < 1.3) gene += 0.8;
      if (!a.gardien) libreO = Math.min(libreO, hypot(a.p.x - o.p.x, a.p.z - o.p.z));
    }
    // (lot 2) un receveur démarqué vaut mieux (jusqu'à +0,4 à 3 m de tout adversaire)
    const s = al * 1.4 - d * 0.03 - gene + (oz * sens(j.e) > 0 ? 0.25 : 0) + 0.4 * Math.min(libreO, 3) / 3;
    if (s > score) { score = s; best = o; }
  }
  return best;
}

/**
 * Demande un geste de balle au joueur j. spec : { type: 'passe' | 'lob' | 'profondeur' | 'frappe' | 'finesse' |
 * 'lobFrappe', p (0..1), dx, dz (la direction visée, stick), cible (index d'un partenaire, facultatif) }.
 * La demande attend (0,45 s au plus) que le pied puisse arriver à la balle : pendant ce temps, le joueur règle sa
 * course sur le point de frappe (pasDemande) ; puis le geste part.
 */
export function demanderFrappe(m, j, spec) {
  const b = m.balle;
  if (!libre(j) || b.garde != null) return false;
  const d = hypot(b.p.x - j.p.x, b.p.z - j.p.z);
  // (bola-app#26 : une balle aérienne se reprend de volée ou de la tête, jusqu'à 2,2 m)
  // (lot 2 : une balle en l'air qui arrive se demande de plus loin, 6 m : le temps de régler la reprise)
  if (d > (b.p.y > 0.5 && b.garde == null ? 6 : 3.5) || b.p.y > 2.6) return false;
  if (j.demande && !j.aide) return true; // l'IA ne relance pas une demande en cours
  j.demande = { spec, t0: j.demande?.t0 ?? m.t };
  return true;
}

/** La surface qui frappe au temps t d'un clip (pied 0 / 1, ou « tete »), repère du joueur (m). */
function surfaceA(nom, t, pied, out) {
  if (pied === 'tete') return teteA(nom, t, out);
  return piedA(nom, t, pied, out);
}

/** La hauteur de la balle dans T s (gravité seule, sans rebond : assez pour choisir le geste). */
const hauteurDans = (b, T) => Math.max(R, b.p.y + b.v.y * T - 0.5 * G * T * T);

/**
 * Le clip d'un geste de balle, selon la course, la hauteur de la balle à l'impact et son côté (bola-app#26) :
 *   · au sol : frappe en course (strike_run, la frappe puissante), frappe arrêtée (shoot), passe et finesse de
 *     l'intérieur du pied arrêté (pass, jouée plus vite pour la finesse) ;
 *   · volée basse (0,3 à 0,65 m) : la jambe tendue de kick_soccerball (1) (shoot2) ; volée haute (0,65 à 1,8 m) :
 *     le ciseau (volley) ; dos au but entre 0,7 et 1,2 m : le retourné (bicycle) ; tête (1,25 m et plus, face au
 *     jeu) : la tête debout (head_std) ou en extension (header2) ;
 *   · le pied du côté de la balle (_l : le miroir) ; l'instant d'impact est l'image où la surface (pied ou tête) est
 *     à la hauteur de la balle, pour les gestes aériens.
 */
function clipFrappe(j, b, spec) {
  const frappe = estFrappe(spec.type);
  const s = hypot(j.v.x, j.v.z);
  const fx = sin(j.cap), fz = cos(j.cap);
  const cote = (b.p.x - j.p.x) * fz - (b.p.z - j.p.z) * fx; // > 0 : à gauche
  // en course, si la cible n'est pas à plus de 70° de la course : la frappe en course ; sinon, sur appuis
  const hv = s > 0.3 ? atan2(j.v.x, j.v.z) : j.cap;
  const cb = spec._cible ?? null;
  const ecart = cb ? Math.abs(enrouler(atan2(cb.x - b.p.x, cb.z - b.p.z) - hv)) : 0;
  const course = s > 2.2 && ecart < (70 * Math.PI) / 180;
  // la hauteur de la balle à l'impact (un premier jet à 0,22 s)
  const yb = hauteurDans(b, 0.22);
  if (yb > 0.3 || b.p.y > 0.45) {
    const choix = [];
    if (yb > 1.25 && ecart < 1.9) choix.push('head_std', 'header2');
    if (yb > 0.7 && yb < 1.25 && ecart > 1.9 && CLIPS.bicycle) choix.push('bicycle');
    if (yb > 0.65) choix.push('volley');
    if (yb < 0.7) choix.push('shoot2');
    let best = null;
    for (const n0 of choix) {
      const tete = /^head/.test(n0);
      const n = !tete && n0 !== 'bicycle' && n0 !== 'volley' && cote > 0.08 && CLIPS[n0 + '_l'] ? n0 + '_l' : n0;
      const c = CLIPS[n];
      if (!c) continue;
      const pied = tete ? 'tete' : CLIPS_PIED(n);
      if (tete && !c.tete) continue;
      // l'image où la surface est à la hauteur de la balle (dans les deux premiers tiers du clip)
      for (let i = 3; i < (c.n * 2) / 3; i++) {
        const t = i / FPS_CLIPS;
        const y = surfaceA(n, t, pied, t1).y;
        const taux = clamp(t / 0.25, 0.8, 2.2);
        const err = Math.abs(y - hauteurDans(b, t / taux)) + (tete && n0 === 'header2' && yb < 1.5 ? 0.2 : 0);
        if (!best || err < best.err) best = { nom: n, impact: t, taux, pied, err };
      }
    }
    if (best && best.err < 0.35) return { nom: best.nom, course: false, taux: best.taux, s, impact: best.impact, pied: best.pied, cote };
  }
  let nom = course ? 'strike_run' : frappe && spec.type !== 'finesse' ? 'shoot' : 'pass';
  if (cote > 0.08) nom += '_l';
  const taux = clamp(impactDe(nom) / (spec.type === 'finesse' && !course ? 0.18 : 0.22), 0.8, 2.4);
  return { nom, course, taux, s, impact: impactDe(nom), pied: CLIPS_PIED(nom), cote };
}

/**
 * Une demande en attente : si le pied peut arriver à la balle à l'impact, le geste part ; sinon le joueur va au
 * point de frappe (son intention est remplacée), et au bout de 0,45 s il frappe quand même (souvent effleurée).
 */
export function pasDemande(m, j) {
  const dm = j.demande;
  if (!dm) return;
  const b = m.balle;
  const p = porteur(m);
  if (!libre(j) || b.garde != null || (p && p.e !== j.e && p !== j) || m.t - dm.t0 > 1.0) { j.demande = null; return; }
  const cible = viser(m, j, dm.spec, true);
  // (lot 2) une balle en l'air : la reprise se cale sur l'instant où elle passe à sa portée (prédiction complète)
  if (b.p.y > 0.45 || b.v.y > 1.5) { if (reprendre(m, j, dm, cible) !== null) return; }
  const c = clipFrappe(j, b, dm.spec);
  const T = c.impact / c.taux;
  const bx = b.p.x + b.v.x * T, bz = b.p.z + b.v.z * T;
  const hc = atan2(cible.x - bx, cible.z - bz);
  surfaceA(c.nom, c.impact, c.pied, t1);
  versMonde(hc, t1.x, t1.z, t2);
  // où le corps doit être à l'impact
  const sx = bx - sin(hc) * (R + 0.04) - t2.x, sz = bz - cos(hc) * (R + 0.04) - t2.z;
  // où il sera : son élan (ou le root motion de la frappe en course)
  let ex = j.p.x + j.v.x * T, ez = j.p.z + j.v.z * T;
  if (c.course) {
    const ech = clamp(c.s / (2.19 * c.taux), 0.6, 2);
    racineA(c.nom, c.impact, t1);
    versMonde(hc, t1.x * ech, t1.z * ech, t1);
    ex = j.p.x + t1.x; ez = j.p.z + t1.z;
  } else { const s = c.s, fr = Math.min(T, s / CORPS.freinPlante); const L = s || 1; ex = j.p.x + (j.v.x / L) * (s * fr - 0.5 * CORPS.freinPlante * fr * fr); ez = j.p.z + (j.v.z / L) * (s * fr - 0.5 * CORPS.freinPlante * fr * fr); }
  // le point de frappe hors du terrain (balle collée à un panneau) : impossible, l'IA renonce
  if (Math.abs(sx) > BX - 0.3 || Math.abs(sz) > BZ - 0.3) { if (!j.aide) { j.demande = null; j.decision = 0.8; return; } }
  const err = hypot(sx - ex, sz - ez);
  if (m.t - dm.t0 > 0.9 && !j.aide) { j.demande = null; return; }
  if (err < 0.1 + 0.8 * T || m.t - dm.t0 > 0.9) {
    j.demande = null;
    // la course de frappe part dans la direction de la cible : le root motion du clip suit ce cap
    if (c.course) j.cap = hc;
    lancerGeste(j, c.nom, {
      taux: c.taux, rm: c.course, echelle: c.course ? clamp(c.s / (2.19 * c.taux), 0.6, 2) : 1,
      type: 'frappe', finApresImpact: 0.25, impact: c.impact, donnees: { spec: dm.spec, pied: c.pied },
    });
    // (pour le banc : le geste choisi, le pied qui frappe et le côté de la balle à l'élan)
    const aerien = AERIENS.test(c.nom) && b.p.y > 0.3;
    if (aerien) m.stats.aeriens++;
    m.ev('elan', { j: j.i, nom: c.nom, pied: c.pied, cote: c.cote, y: b.p.y, aerien, geste: dm.spec.type });
    return;
  }
  // aller au point de frappe
  const it = j.int;
  const dx = sx - j.p.x, dz = sz - j.p.z, L = hypot(dx, dz) || 1;
  it.dx = dx / L; it.dz = dz / L;
  it.allure = Math.max(it.allure, clamp(L / 1.5, 0.3, 1));
  if (L > 1.2) it.sprint = Math.max(it.sprint, 0.6);
}

/**
 * La reprise d'une balle aérienne (bola-app#26, lot 2) : la trajectoire prédite (traînée, effet, rebonds) donne
 * l'instant tc et le point où elle passe au plus près du joueur (dans 1 s) ; le geste est choisi par la hauteur de ce
 * point (tête au-dessus de 1,25 m, ciseau de 0,65 à 1,8 m, jambe tendue sous 0,7 m, retourné dos au but), son image de
 * contact à cette hauteur, et son rythme pour que le contact tombe à tc (0,8 à 2,2 fois la capture) ; le joueur va au
 * point de rencontre en attendant. Renvoie null si la balle ne passe pas à sa portée (le cas général reprend la
 * main), sinon vrai.
 */
function reprendre(m, j, dm, cible) {
  const b = m.balle;
  if (m.t >= (dm.predT ?? -9)) {
    dm.predT = m.t + 0.04;
    // le point de passage le plus proche du joueur (sa course comprise), hauteur jouable
    let best = null;
    predire(b, (q, t) => {
      const px = j.p.x + j.v.x * Math.min(t, 0.4), pz = j.p.z + j.v.z * Math.min(t, 0.4);
      const d = hypot(q.p.x - px, q.p.z - pz);
      if (q.p.y > 0.25 && q.p.y < 2.3 && (!best || d < best.d)) best = { d, t, x: q.p.x, y: q.p.y, z: q.p.z };
      return false;
    }, 1.0);
    dm.pred = best && best.d < 1.6 ? best : null;
  }
  const P = dm.pred;
  if (!P) return null;
  const tc = P.t - (m.t - (dm.predT - 0.04));
  if (tc <= 0.05) return null;
  const fx = sin(j.cap), fz = cos(j.cap);
  const cote = (P.x - j.p.x) * fz - (P.z - j.p.z) * fx;
  const hv = hypot(j.v.x, j.v.z) > 0.3 ? atan2(j.v.x, j.v.z) : j.cap;
  const ecart = Math.abs(enrouler(atan2(cible.x - P.x, cible.z - P.z) - hv));
  const choix = [];
  // (la tête debout jusqu'à 1,65 m ; au-dessus, la tête en extension, sautée)
  if (P.y > 1.25 && ecart < 1.9) choix.push(P.y < 1.65 ? 'head_std' : 'header2');
  if (P.y > 0.7 && P.y < 1.25 && ecart > 1.9 && CLIPS.bicycle) choix.push('bicycle');
  if (P.y > 0.65 && P.y < 1.8) choix.push('volley');
  if (P.y < 0.75) choix.push('shoot2');
  let g = null;
  for (const n0 of choix) {
    const tete = /^head/.test(n0);
    const n = !tete && n0 !== 'bicycle' && n0 !== 'volley' && cote > 0.08 && CLIPS[n0 + '_l'] ? n0 + '_l' : n0;
    const c = CLIPS[n];
    if (!c || (tete && !c.tete)) continue;
    const pied = tete ? 'tete' : CLIPS_PIED(n);
    for (let i = 3; i < (c.n * 2) / 3; i++) {
      const t = i / FPS_CLIPS, taux = t / tc;
      if (taux < 0.8 || taux > 2.2) continue;
      // (la tête doit être à la balle à 0,2 m près : sinon c'est la poitrine ou les mains qui la prennent)
      const err = Math.abs(surfaceA(n, t, pied, t1).y - P.y) * (tete ? 1.75 : 1);
      if (!g || err < g.err) g = { nom: n, impact: t, taux, pied, err };
    }
  }
  // le point de rencontre : là où le corps doit être pour que la surface touche la balle
  const hc = atan2(cible.x - P.x, cible.z - P.z);
  const it = j.int;
  if (g && g.err < 0.35) {
    surfaceA(g.nom, g.impact, g.pied, t1);
    versMonde(hc, t1.x, t1.z, t2);
    const sx = P.x - sin(hc) * (R + 0.04) - t2.x, sz = P.z - cos(hc) * (R + 0.04) - t2.z;
    const ex = j.p.x + j.v.x * tc, ez = j.p.z + j.v.z * tc;
    // (pasFrappe rattrape jusqu'à 1,2 m/s pendant l'élan)
    if (hypot(sx - ex, sz - ez) < 0.2 + 1.1 * tc) {
      j.demande = null;
      j.cap = hc;
      lancerGeste(j, g.nom, { taux: g.taux, rm: false, type: 'frappe', finApresImpact: 0.25, impact: g.impact, donnees: { spec: dm.spec, pied: g.pied } });
      const aerien = AERIENS.test(g.nom);
      if (aerien) m.stats.aeriens++;
      m.ev('elan', { j: j.i, nom: g.nom, pied: g.pied, cote, y: P.y, aerien, geste: dm.spec.type });
      return true;
    }
    const dx = sx - j.p.x, dz = sz - j.p.z, L = hypot(dx, dz) || 1;
    it.dx = dx / L; it.dz = dz / L; it.allure = Math.max(it.allure, clamp(L / 1.2, 0.3, 1)); if (L > 1) it.sprint = Math.max(it.sprint, 0.7);
    return true;
  }
  // pas encore de geste qui tombe juste : il va sous la balle
  const dx = P.x - j.p.x, dz = P.z - j.p.z, L = hypot(dx, dz) || 1;
  if (L > 0.3) { it.dx = dx / L; it.dz = dz / L; it.allure = Math.max(it.allure, clamp(L / 1.2, 0.3, 1)); }
  return true;
}

/** le pied qui frappe dans ce clip (0 = gauche, 1 = droit), mesuré par tools/jeu-clips.mjs */
const CLIPS_PIED = (nom) => (CLIPS[nom]?.piedImpact?.pied === 'g' ? 0 : 1);

/**
 * Pendant l'élan d'une frappe : le joueur règle ses derniers pas pour amener le pied à la balle, et tourne vers la
 * cible ; à l'impact, la balle part (ou la frappe est manquée).
 */
export function pasFrappe(m, j, dt) {
  const g = j.g, b = m.balle;
  if (!g || g.type !== 'frappe' || g.fait) return;
  const spec = g.donnees.spec;
  const reste = (g.impact - g.t) / g.taux;
  const cible = viser(m, j, spec, true);
  // tourner vers la cible, au rythme du buste
  const hc = atan2(cible.x - b.p.x, cible.z - b.p.z);
  const dc = enrouler(hc - j.cap);
  const rot = clamp(dc, -9 * dt, 9 * dt);
  j.cap = enrouler(j.cap + rot);
  if (!g.rm) g.cap0 = j.cap; else g.cap0 = enrouler(g.cap0 + rot);
  if (reste > 0) {
    // où doit être le corps à l'impact pour que le pied soit derrière la balle
    surfaceA(g.nom, g.impact, g.donnees.pied, t1);
    versMonde(j.cap, t1.x, t1.z, t2);
    const hx = sin(hc), hz = cos(hc);
    const bx = b.p.x + b.v.x * reste, bz = b.p.z + b.v.z * reste;
    const px = bx - hx * (R + 0.04) - t2.x, pz = bz - hz * (R + 0.04) - t2.z;
    let qx = j.p.x + j.v.x * reste, qz = j.p.z + j.v.z * reste;
    if (g.rm) {
      racineA(g.nom, g.impact, t1); const ax = t1.x, az = t1.z;
      racineA(g.nom, g.t, t1);
      versMonde(g.cap0, (ax - t1.x) * g.echelle, (az - t1.z) * g.echelle, t1);
      qx = j.p.x + t1.x; qz = j.p.z + t1.z;
    }
    const ex = px - qx, ez = pz - qz;
    const corr = Math.min(g.rm ? 2 : 1.2, hypot(ex, ez) / Math.max(reste, 0.05));
    const L = hypot(ex, ez) || 1;
    j.p.x += (ex / L) * corr * dt; j.p.z += (ez / L) * corr * dt;
    return;
  }
  // l'impact
  g.fait = true; g.impactAge = g.age;
  surfaceA(g.nom, g.impact, g.donnees.pied, t1);
  versMonde(j.cap, t1.x, t1.z, t2);
  const px = j.p.x + t2.x, pz = j.p.z + t2.z;
  const dp = hypot(b.p.x - px, b.p.z - pz);
  const dy = Math.abs(b.p.y - Math.max(R, t1.y));
  const portee = hypot(dp, dy);
  m.journal?.('impact', j.i, portee, g.nom, hypot(j.v.x, j.v.z), m.t - (g.donnees.t0 ?? 0));
  m.stats.impacts.push(portee);
  if (portee > 0.6) { m.ev('rate', { j: j.i, portee }); return; }
  const effleure = portee > JEU.porteeFrappe;
  lancer(m, j, spec, cible, effleure, g.donnees.pied, g.nom);
  m.ev(estFrappe(spec.type) ? 'frappe' : 'passe', { j: j.i, p: spec.p, portee, effleure });
}

/** Le point visé (x, y, z) d'une demande : le partenaire et sa course, ou le but. */
function viser(m, j, spec, provisoire) {
  const b = m.balle;
  const out = spec._cible ?? (spec._cible = { x: 0, y: 0, z: 0, t: 0 });
  if (estFrappe(spec.type)) {
    const zb = butDe(1 - j.e);
    out.x = spec.x ?? 0; out.z = zb; out.y = spec.y ?? 0.8;
    return out;
  }
  let o = spec.cible != null ? m.joueurs[spec.cible] : null;
  if (!o) {
    const cone = j.aide >= 1 ? JEU.coneAide.pouce : j.aide > 0 ? JEU.coneAide.manette : Math.PI / 3;
    o = choisirPartenaire(m, j, spec.dx ?? sin(j.cap), spec.dz ?? cos(j.cap), cone) ?? choisirPartenaire(m, j, spec.dx ?? 0, spec.dz ?? sens(j.e));
    if (o && !provisoire) spec.cible = o.i;
  }
  if (!o) { out.x = b.p.x + (spec.dx ?? 0) * 10; out.z = b.p.z + (spec.dz ?? sens(j.e)) * 10; out.y = 0; return out; }
  const d0 = hypot(o.p.x - b.p.x, o.p.z - b.p.z);
  const v0 = spec.type === 'lob' ? 14 : spec.type === 'centre' ? 13 : JEU.passeV0[0] + JEU.passeV0[1] * spec.p;
  const t = clamp(d0 / Math.max(5, v0 * 0.85), 0.2, 2);
  out.x = o.p.x + o.v.x * t; out.z = o.p.z + o.v.z * t;
  if (spec.type === 'profondeur') { const fwd = 4 + 6 * spec.p; out.z += sens(o.e) * fwd * 0.8; out.x += (o.v.x / (hypot(o.v.x, o.v.z) || 1)) * fwd * 0.2; }
  out.x = clamp(out.x, -BX + 0.8, BX - 0.8); out.z = clamp(out.z, -BZ + 0.8, BZ - 0.8);
  out.y = 0; out.t = t;
  return out;
}

/** Le départ de la balle. */
function lancer(m, j, spec, cible, effleure, pied = 1, nom = '') {
  const b = m.balle, rng = m.rng.frappes;
  const p = clamp(spec.p ?? 0.5, 0, 1);
  const s = hypot(j.v.x, j.v.z);
  const pr = pression(m, j);
  const hx = cible.x - b.p.x, hz = cible.z - b.p.z, dist = hypot(hx, hz) || 1;
  let h = atan2(hx, hz);
  const angleCorps = Math.abs(enrouler(h - j.cap));
  const aide = j.aide ?? 0;
  let vx, vy, vz, w = null;
  const frappe = estFrappe(spec.type);
  if (!frappe) {
    let sig = (1 + 3 * p * p + 3 * pr + 2 * (s / CORPS.vSprint)) * DEG * (1 - 0.5 * aide);
    h += rng.normal() * sig;
    if (spec.type === 'centre') {
      // (bola-app#26, lot 2) le centre : plus tendu qu'un lob (24 à 34°), il arrive à hauteur de tête (1,5 m) sur le
      // receveur, pour une reprise de volée ou de la tête ; v0 cherché sur l'intégrateur (traînée, léger rétro-effet)
      const th = clamp(24 + dist * 0.6, 24, 34) * DEG;
      const w0 = { x: -cos(h) * 10, y: 0, z: sin(h) * 10 };
      let a = 6, c = 24;
      for (let k = 0; k < 12; k++) {
        const v0 = (a + c) / 2;
        const q = essai(b, sin(h) * v0 * cos(th), v0 * sin(th), cos(h) * v0 * cos(th), w0);
        const r = predire(q, (x) => hypot(x.p.x - b.p.x, x.p.z - b.p.z) >= dist || (x.v.y < 0 && x.p.y < 0.3), 2.5);
        const ok = r && hypot(r.p.x - b.p.x, r.p.z - b.p.z) >= dist - 0.05;
        if (!ok || r.p.y < 1.5) a = v0; else c = v0;
      }
      const v0 = (a + c) / 2;
      vx = sin(h) * v0 * cos(th); vz = cos(h) * v0 * cos(th); vy = v0 * sin(th);
      w = w0;
    } else if (spec.type === 'lob') {
      // un vrai lob : 42 à 55° selon la distance (65° au plus), un sommet d'au moins 2,5 m, et 2,3 m au-dessus de
      // l'adversaire le plus proche sur la ligne (à moins de 5 m)
      let th = clamp(42 + 13 * (dist / 25), 42, 55) * DEG;
      const voulu = dist * (0.8 + 0.4 * p);
      let v0 = chercherLob(b, h, th, voulu);
      // l'adversaire le plus proche sur la ligne, à moins de 5 m : la balle doit y passer à 2,3 m au moins
      let xo = 0;
      for (const o of m.joueurs) {
        if (o.absent || o.e === j.e || o.mode === 'sol') continue;
        const rx = o.p.x - b.p.x, rz = o.p.z - b.p.z, along = rx * sin(h) + rz * cos(h), lat = Math.abs(rx * cos(h) - rz * sin(h));
        if (along > 0.5 && along < 5 && lat < 1.2 && (!xo || along < xo)) xo = along;
      }
      for (let k = 0; k < 6; k++) {
        // (le sommet et la hauteur au-dessus de l'adversaire sont prédits avec l'intégrateur : traînée et rétro-effet)
        let q = essai(b, sin(h) * v0 * cos(th), v0 * sin(th), cos(h) * v0 * cos(th), { x: -cos(h) * 20, y: 0, z: sin(h) * 20 });
        const sommet = predire(q, (x) => x.v.y <= 0, 3);
        let haut = !sommet || sommet.p.y >= 2.5;
        if (haut && xo) {
          q = essai(b, sin(h) * v0 * cos(th), v0 * sin(th), cos(h) * v0 * cos(th), { x: -cos(h) * 20, y: 0, z: sin(h) * 20 });
          const r = predire(q, (x) => hypot(x.p.x - b.p.x, x.p.z - b.p.z) >= xo, 2);
          haut = !r || r.p.y >= 2.3;
        }
        if (haut || th >= 65 * DEG) break;
        th = Math.min(65 * DEG, th + 4 * DEG); v0 = chercherLob(b, h, th, voulu);
      }
      vx = sin(h) * v0 * cos(th); vz = cos(h) * v0 * cos(th); vy = v0 * sin(th);
      w = { x: -cos(h) * 20, y: 0, z: sin(h) * 20 }; // rétro-effet
    } else {
      const v0 = JEU.passeV0[0] + JEU.passeV0[1] * p;
      vx = sin(h) * v0; vz = cos(h) * v0; vy = 0;
    }
  } else {
    const finesse = spec.type === 'finesse', ext = spec.type === 'exterieur', brosse = finesse || ext;
    // (lot 2) une tête part bien moins fort qu'une frappe du pied (8 à 15 m/s), une volée un peu moins, et moins juste
    const tete = /^head/.test(nom), volee = /^(volley|bicycle|shoot2)/.test(nom) && b.p.y > 0.3;
    let v0 = finesse ? JEU.finesseV0[0] + JEU.finesseV0[1] * p : ext ? JEU.exterieurV0[0] + JEU.exterieurV0[1] * p : JEU.frappeV0[0] + JEU.frappeV0[1] * p;
    if (tete) v0 = 8 + 7 * p; else if (volee) v0 *= 0.85;
    const cx = cible.x;
    let wy = 0;
    if (brosse) {
      // (bola-app#26, lot 2) l'effet suit le pied : l'intérieur du droit (ou l'extérieur du gauche) enroule vers la
      // gauche de la course (ω_y > 0 : Magnus ω × v vers la gauche), l'intérieur du gauche (ou l'extérieur du droit)
      // vers la droite ; la visée est ensuite corrigée pour que la courbe finisse sur la cible
      const sc = (finesse ? 1 : -1) * (pied === 0 ? -1 : 1);
      wy = sc * (finesse ? 45 + 25 * p : 34 + 18 * p);
    }
    const yv = spec.type === 'lobFrappe' ? 2.2 : (spec.y ?? clamp(0.25 + ((1.6 - 0.25) * (p - 0.3)) / 0.6, 0.15, 2.6) + (p > 0.95 ? (p - 0.95) * 30 : 0));
    let sig = (0.6 + 5 * p * p + 4 * pr + 3 * (s / CORPS.vSprint) + 4 * (Math.min(angleCorps, Math.PI / 2) / (Math.PI / 2))) * DEG;
    if (finesse) sig *= 0.5; else if (ext) sig *= 0.8;
    if (tete) sig += 3 * DEG; else if (volee) sig += 4 * DEG;
    sig *= 1 - 0.3 * aide;
    const bruitH = rng.normal() * sig;
    h = atan2(cx - b.p.x, cible.z - b.p.z);
    const dh = hypot(cx - b.p.x, cible.z - b.p.z);
    // la hauteur à la ligne : un premier jet sous gravité, puis deux corrections par l'intégrateur (traînée, effet) ;
    // (une frappe brossée : la direction aussi, trois fois, pour que la courbe finisse sur la cible)
    let t = dh / (v0 * 0.92);
    let vyv = (yv - b.p.y + 0.5 * G * t * t) / t;
    if (spec.type === 'lobFrappe') { vyv = Math.min(9, vyv + 4); }
    const nk = spec.type === 'lobFrappe' ? 0 : brosse ? 3 : 2;
    for (let k = 0; k < nk; k++) {
      const vh = Math.sqrt(Math.max(1, v0 * v0 - vyv * vyv));
      const q = essai(b, sin(h) * vh, vyv, cos(h) * vh, { x: -cos(h) * 8, y: wy, z: sin(h) * 8 });
      const r = predire(q, (x) => (x.p.z - cible.z) * Math.sign(cible.z - b.p.z) >= 0, 2);
      if (!r) break;
      vyv += ((yv - r.p.y) / Math.max(0.2, r.t)) * 0.9;
      if (brosse && Math.abs(cos(h)) > 0.3) h = enrouler(h - (r.p.x - cx) / (cos(h) * dh));
    }
    h += bruitH;
    w = { x: -cos(h) * 8, y: wy, z: sin(h) * 8 };
    vyv += rng.normal() * sig * v0 * 0.4;
    const vh = Math.sqrt(Math.max(1, v0 * v0 - vyv * vyv));
    vx = sin(h) * vh; vz = cos(h) * vh; vy = vyv;
  }
  if (effleure) {
    const dev = (rng.u() * 2 - 1) * 25 * DEG, c = cos(dev), sn = sin(dev);
    const nx = vx * c + vz * sn, nz = -vx * sn + vz * c;
    vx = nx * 0.4; vz = nz * 0.4; vy *= 0.3;
  }
  const n = hypot(vx, vy, vz);
  if (n > BALLON.vMax) { vx *= BALLON.vMax / n; vy *= BALLON.vMax / n; vz *= BALLON.vMax / n; }
  b.v.x = vx; b.v.y = vy; b.v.z = vz;
  if (w) { b.w.x = w.x; b.w.y = w.y; b.w.z = w.z; } else rouler(b);
  b.dernier = j.i; b.dernierT = m.t; b.possesseur = null;
  b.recepteur = !frappe && spec.cible != null ? spec.cible : null;
  // (les deux dernières passes, pour le une-deux)
  if (!frappe && spec.cible != null) { m.passes.push({ de: j.i, a: spec.cible, t: m.t }); if (m.passes.length > 2) m.passes.shift(); }
  b.tir = frappe ? { e: j.e, t0: m.t, j: j.i } : null;
  j.recup = 0.3;
  m.stats[frappe ? 'tirs' : 'passes']++;
}

const essaiB = { p: { x: 0, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, w: { x: 0, y: 0, z: 0 }, garde: null, sol: false };
function essai(b, vx, vy, vz, w) {
  essaiB.p.x = b.p.x; essaiB.p.y = Math.max(R + 0.005, b.p.y); essaiB.p.z = b.p.z;
  essaiB.v.x = vx; essaiB.v.y = vy; essaiB.v.z = vz;
  essaiB.w.x = w.x; essaiB.w.y = w.y; essaiB.w.z = w.z;
  return essaiB;
}

/** v0 d'un lob qui retombe à la distance voulue (dichotomie sur l'intégrateur, traînée comprise). */
function chercherLob(b, h, th, voulu) {
  let a = 3, c = 26;
  const w = { x: -cos(h) * 20, y: 0, z: sin(h) * 20 };
  for (let k = 0; k < 12; k++) {
    const v0 = (a + c) / 2;
    const q = essai(b, sin(h) * v0 * cos(th), v0 * sin(th), cos(h) * v0 * cos(th), w);
    let monte = false;
    const r = predire(q, (x) => { if (x.v.y > 0) monte = true; return monte && x.p.y <= R + 0.02; }, 3);
    const dd = r ? hypot(r.p.x - b.p.x, r.p.z - b.p.z) : 99;
    if (dd < voulu) a = v0; else c = v0;
  }
  return (a + c) / 2;
}

export { LB, BUT_DL, BUT_H, PAS };
