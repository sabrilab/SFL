// Les gestes de balle : conduite par touches, contrôle orienté, passes, lobs, frappes et finesse (bola-app#23).
//
// La balle n'est jamais collée au pied : « avoir la balle » veut dire être le dernier à l'avoir touchée et pouvoir la
// toucher de nouveau (balle.possesseur). Tout passe par des impulsions données quand le pied est à portée :
//   · conduite : une touche tombe sur un appui de la foulée (phase φ, corps.js) quand la balle est devant le pied ;
//     elle repart à v + Δv, Δv = √(2 a L(v)) pour qu'elle prenne au plus L(v) = 0,4 + 0,38 v mètres d'avance (0,9 m au
//     trot lent, 3 m en sprint) avant que le roulement ne la ramène, dans la direction voulue à θ_max près de sa course
//     (35° à l'arrêt, 12° en sprint), avec une erreur à graine qui grandit avec la vitesse, la pression et le
//     déséquilibre. En sprint, la balle part à 2,5-4 m : un défenseur peut s'interposer. À l'arrêt, la semelle
//     ramène la balle par petites touches ; en protégeant, la balle est gardée de l'autre côté du corps.
//   · contrôle orienté : la qualité q baisse avec la vitesse d'arrivée, l'angle de rotation, la pression, le
//     déséquilibre et la surface (pied, cuisse, poitrine, tête) ; la balle sortante mêle la sortie voulue (q) et le
//     rebond sur la surface (1 − q). Une passe à 22 m/s prise de travers rebondit sur le pied.
//   · passes et frappes : le geste (clip et rythme) est choisi pour que l'impact tombe dans 0,22 s, le joueur règle
//     ses derniers pas pour amener le pied à la balle, et à l'impact la balle part de là où elle est, si le pied est
//     à moins de 0,30 m d'elle (sinon frappe effleurée ou manquée, journalisée). Puissance = jauge (0..1) ; erreur à
//     graine σ = 0,6° + 5° p² + 4° pression + 3° v/7,4 + 4° angle/90° ; l'aide (pouce, manette) corrige la
//     direction d'une passe, jamais sa force.
import { PAS, G, BALLON, JEU, CORPS, BUT_DL, BUT_H, butDe, sens, LB, BX, BZ } from './constantes.js';
import { piedA, racineA, versMonde, lancerGeste, impactDe, libre, clamp, enrouler, duree } from './corps.js';
import { predire } from './ballon.js';
import { CLIPS } from './clips.js';
import { acos, atan2, cos, hypot, sin } from './maths.js';

const R = BALLON.R;
// la frappe en course : vitesse moyenne de son root motion au rythme 1 (strike_run, 2,97 hanches en 1,3 s)
const DEG = Math.PI / 180;
const t1 = { x: 0, y: 0, z: 0 }, t2 = { x: 0, y: 0, z: 0 };

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
  // le pied qui arrive frappe la balle quelque part entre 0,05 et 0,75 m devant le corps ; hors appui, seulement si
  // le joueur la rattrape et qu'elle va passer sous lui (le pied en l'air la prend au passage)
  const portee = avant > 0.05 && avant < 0.75 + s * 0.03 && Math.abs(cote) < 0.45;
  if (!portee) return;
  const rattrape = avant < 0.32 && (j.v.x - b.v.x) * fx + (j.v.z - b.v.z) * fz > 0.3;
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
export function pasControle(m, j) {
  const b = m.balle;
  if (!libre(j) || b.garde != null) return false;
  if (b.dernier === j.i && m.t - b.dernierT < 0.3) return false;
  if (b.possesseur === j.i) return false;
  const pos = b.possesseur != null ? m.joueurs[b.possesseur] : null;
  // la balle d'un porteur qui la conduit de près : c'est l'affaire du tacle, pas d'un contrôle
  // (pour la lui prendre, il faut un tacle ; une balle poussée loin devant, elle, se prend)
  if (pos && pos !== j && pos.e !== j.e && hypot(pos.p.x - b.p.x, pos.p.z - b.p.z) < 0.85 && (pos.mode === 'loco' || pos.mode === 'frein' || pos.mode === 'pivot')) return false;
  // une balle qui vient de changer de pied ne change pas de nouveau tout de suite
  if (b.dernier != null && m.joueurs[b.dernier].e !== j.e && m.t - b.dernierT < 0.25 && dhMax(m, j) < 0.3) return false;
  if (pos && pos !== j && pos.e === j.e && hypot(pos.p.x - b.p.x, pos.p.z - b.p.z) < 1.2) return false;
  if (b.p.y > 2.1) return false;
  const fx = j.p.x + sin(j.cap) * 0.22, fz = j.p.z + cos(j.cap) * 0.22;
  const dh = hypot(b.p.x - fx, b.p.z - fz);
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
  let q = 1 - Math.max(0, vin - 7) / 20 - 0.35 * (rot / Math.PI) - 0.2 * pr - 0.3 * j.d - (surface !== 'pied' ? 0.1 : 0) + 0.15 * aide;
  q = clamp(q, 0, 1);
  const rng = m.rng.touches;
  // le rebond sur la surface : la vitesse relative réfléchie (la normale fait face à la balle), amortie
  const ep = { pied: 0.35, cuisse: 0.45, poitrine: 0.3, tete: 0.6 }[surface];
  const bruit = (1 - q) * 0.25;
  const rfx = -vrx * ep + rng.normal() * bruit * vin * 0.3, rfz = -vrz * ep + rng.normal() * bruit * vin * 0.3;
  const rfy = Math.abs(vry) * ep * 0.5 + (surface === 'pied' ? 0 : 0.4);
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
  b.v.x = ox; b.v.y = oy; b.v.z = oz;
  if (b.p.y < R + 0.02 && oy <= 0) rouler(b); else { b.w.x *= 0.3; b.w.y *= 0.3; b.w.z *= 0.3; }
  const possede = q >= 0.35 || hypot(ox - j.v.x, oz - j.v.z) < 3;
  const etaitTir = b.tir;
  toucher(m, j, { possede });
  if (!possede) b.possesseur = null;
  j.toucheT = m.t;
  m.ev('controle', { j: j.i, q, vin, surface, possede, tir: !!etaitTir });
  // l'animation : un contrôle de la cuisse, de la poitrine ou de la tête se voit ; au pied, la course continue
  if (surface === 'cuisse' || surface === 'poitrine') lancerGeste(j, 'knee', { depuis: 0.05, taux: 1.4, fin: duree('knee') * 0.85, type: 'controle' });
  else if (surface === 'tete') lancerGeste(j, 'header', { depuis: 0.4, taux: 1.8, fin: duree('header') * 0.75, type: 'controle' });
  return true;
}

const dhMax = (m, j) => hypot(m.balle.v.x - j.v.x, m.balle.v.z - j.v.z);

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
    let gene = 0;
    for (const a of m.joueurs) {
      if (a.absent || a.e === j.e) continue;
      const t = clamp(((a.p.x - j.p.x) * ox + (a.p.z - j.p.z) * oz) / (d * d), 0, 1);
      const px = j.p.x + ox * t - a.p.x, pz = j.p.z + oz * t - a.p.z;
      if (hypot(px, pz) < 1.3) gene += 0.6;
    }
    const s = al * 1.4 - d * 0.03 - gene + (oz * sens(j.e) > 0 ? 0.25 : 0);
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
  if (d > 3.5 || b.p.y > 1.2) return false;
  if (j.demande && !j.aide) return true; // l'IA ne relance pas une demande en cours
  j.demande = { spec, t0: j.demande?.t0 ?? m.t };
  return true;
}

/** Le clip d'un geste de balle, selon la course, la hauteur de la balle et son côté. */
function clipFrappe(j, b, spec) {
  const frappe = spec.type === 'frappe' || spec.type === 'finesse' || spec.type === 'lobFrappe';
  const s = hypot(j.v.x, j.v.z);
  const fx = sin(j.cap), fz = cos(j.cap);
  const cote = (b.p.x - j.p.x) * fz - (b.p.z - j.p.z) * fx; // > 0 : à gauche
  // en course, si la cible n'est pas à plus de 70° de la course : la frappe en course ; sinon, sur appuis
  const hv = s > 0.3 ? atan2(j.v.x, j.v.z) : j.cap;
  const cb = spec._cible ?? null;
  const ecart = cb ? Math.abs(enrouler(atan2(cb.x - b.p.x, cb.z - b.p.z) - hv)) : 0;
  const course = s > 2.2 && ecart < (70 * Math.PI) / 180;
  const volee = b.p.y > 0.45;
  let nom = volee ? 'volley' : course ? 'strike_run' : frappe ? 'shoot' : 'pass';
  if (cote > 0.08 && !volee) nom += '_l';
  return { nom, course: course && !volee, taux: clamp(impactDe(nom) / 0.22, 0.8, 2.4), s };
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
  const c = clipFrappe(j, b, dm.spec);
  const T = impactDe(c.nom) / c.taux;
  const bx = b.p.x + b.v.x * T, bz = b.p.z + b.v.z * T;
  const hc = atan2(cible.x - bx, cible.z - bz);
  piedA(c.nom, impactDe(c.nom), CLIPS_PIED(c.nom), t1);
  versMonde(hc, t1.x, t1.z, t2);
  // où le corps doit être à l'impact
  const sx = bx - sin(hc) * (R + 0.04) - t2.x, sz = bz - cos(hc) * (R + 0.04) - t2.z;
  // où il sera : son élan (ou le root motion de la frappe en course)
  let ex = j.p.x + j.v.x * T, ez = j.p.z + j.v.z * T;
  if (c.course) {
    const ech = clamp(c.s / (2.19 * c.taux), 0.6, 2);
    racineA(c.nom, impactDe(c.nom), t1);
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
    const g = lancerGeste(j, c.nom, {
      taux: c.taux, rm: c.course, echelle: c.course ? clamp(c.s / (2.19 * c.taux), 0.6, 2) : 1,
      type: 'frappe', finApresImpact: 0.25, donnees: { spec: dm.spec, pied: CLIPS_PIED(c.nom) },
    });
    void g;
    return;
  }
  // aller au point de frappe
  const it = j.int;
  const dx = sx - j.p.x, dz = sz - j.p.z, L = hypot(dx, dz) || 1;
  it.dx = dx / L; it.dz = dz / L;
  it.allure = Math.max(it.allure, clamp(L / 1.5, 0.3, 1));
  if (L > 1.2) it.sprint = Math.max(it.sprint, 0.6);
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
    piedA(g.nom, g.impact, g.donnees.pied, t1);
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
  piedA(g.nom, g.impact, g.donnees.pied, t1);
  versMonde(j.cap, t1.x, t1.z, t2);
  const px = j.p.x + t2.x, pz = j.p.z + t2.z;
  const dp = hypot(b.p.x - px, b.p.z - pz);
  const dy = Math.abs(b.p.y - Math.max(R, t1.y));
  const portee = hypot(dp, dy);
  m.journal?.('impact', j.i, portee, g.nom, hypot(j.v.x, j.v.z), m.t - (g.donnees.t0 ?? 0));
  m.stats.impacts.push(portee);
  if (portee > 0.6) { m.ev('rate', { j: j.i, portee }); return; }
  const effleure = portee > JEU.porteeFrappe;
  lancer(m, j, spec, cible, effleure);
  m.ev(spec.type === 'frappe' || spec.type === 'finesse' || spec.type === 'lobFrappe' ? 'frappe' : 'passe', { j: j.i, p: spec.p, portee, effleure });
}

/** Le point visé (x, y, z) d'une demande : le partenaire et sa course, ou le but. */
function viser(m, j, spec, provisoire) {
  const b = m.balle;
  const out = spec._cible ?? (spec._cible = { x: 0, y: 0, z: 0, t: 0 });
  if (spec.type === 'frappe' || spec.type === 'finesse' || spec.type === 'lobFrappe') {
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
  const v0 = spec.type === 'lob' ? 14 : JEU.passeV0[0] + JEU.passeV0[1] * spec.p;
  const t = clamp(d0 / Math.max(5, v0 * 0.85), 0.2, 2);
  out.x = o.p.x + o.v.x * t; out.z = o.p.z + o.v.z * t;
  if (spec.type === 'profondeur') { const fwd = 4 + 6 * spec.p; out.z += sens(o.e) * fwd * 0.8; out.x += (o.v.x / (hypot(o.v.x, o.v.z) || 1)) * fwd * 0.2; }
  out.x = clamp(out.x, -BX + 0.8, BX - 0.8); out.z = clamp(out.z, -BZ + 0.8, BZ - 0.8);
  out.y = 0; out.t = t;
  return out;
}

/** Le départ de la balle. */
function lancer(m, j, spec, cible, effleure) {
  const b = m.balle, rng = m.rng.frappes;
  const p = clamp(spec.p ?? 0.5, 0, 1);
  const s = hypot(j.v.x, j.v.z);
  const pr = pression(m, j);
  const hx = cible.x - b.p.x, hz = cible.z - b.p.z, dist = hypot(hx, hz) || 1;
  let h = atan2(hx, hz);
  const angleCorps = Math.abs(enrouler(h - j.cap));
  const aide = j.aide ?? 0;
  let vx, vy, vz, w = null;
  const frappe = spec.type === 'frappe' || spec.type === 'finesse' || spec.type === 'lobFrappe';
  if (!frappe) {
    let sig = (1 + 3 * p * p + 3 * pr + 2 * (s / CORPS.vSprint)) * DEG * (1 - 0.5 * aide);
    h += rng.normal() * sig;
    if (spec.type === 'lob') {
      const th = clamp(28 + 17 * (dist / 25), 28, 45) * DEG;
      const voulu = dist * (0.8 + 0.4 * p);
      const v0 = chercherLob(b, h, th, voulu);
      vx = sin(h) * v0 * cos(th); vz = cos(h) * v0 * cos(th); vy = v0 * sin(th);
      w = { x: -cos(h) * 20, y: 0, z: sin(h) * 20 }; // rétro-effet
    } else {
      const v0 = JEU.passeV0[0] + JEU.passeV0[1] * p;
      vx = sin(h) * v0; vz = cos(h) * v0; vy = 0;
    }
  } else {
    const finesse = spec.type === 'finesse';
    const v0 = finesse ? JEU.finesseV0[0] + JEU.finesseV0[1] * p : JEU.frappeV0[0] + JEU.frappeV0[1] * p;
    let cx = cible.x;
    let wy = 0;
    if (finesse) {
      const ext = Math.sign(cx || 1) * (1 + 0.5 * p);
      cx += ext;
      const vzs = Math.sign(cible.z - b.p.z);
      wy = -Math.sign(ext) * vzs * (45 + 25 * p);
    }
    const yv = spec.type === 'lobFrappe' ? 2.2 : (spec.y ?? clamp(0.25 + ((1.6 - 0.25) * (p - 0.3)) / 0.6, 0.15, 2.6) + (p > 0.95 ? (p - 0.95) * 30 : 0));
    let sig = (0.6 + 5 * p * p + 4 * pr + 3 * (s / CORPS.vSprint) + 4 * (Math.min(angleCorps, Math.PI / 2) / (Math.PI / 2))) * DEG;
    if (finesse) sig *= 0.5;
    sig *= 1 - 0.3 * aide;
    h = atan2(cx - b.p.x, cible.z - b.p.z) + rng.normal() * sig;
    const dh = hypot(cx - b.p.x, cible.z - b.p.z);
    // la hauteur à la ligne : un premier jet sous gravité, puis deux corrections par l'intégrateur (traînée, effet)
    let t = dh / (v0 * 0.92);
    let vyv = (yv - b.p.y + 0.5 * G * t * t) / t;
    if (spec.type === 'lobFrappe') { vyv = Math.min(9, vyv + 4); }
    w = { x: -cos(h) * 8, y: wy, z: sin(h) * 8 };
    for (let k = 0; k < 2 && spec.type !== 'lobFrappe'; k++) {
      const vh = Math.sqrt(Math.max(1, v0 * v0 - vyv * vyv));
      const q = essai(b, sin(h) * vh, vyv, cos(h) * vh, w);
      const r = predire(q, (x) => (x.p.z - cible.z) * Math.sign(cible.z - b.p.z) >= 0, 2);
      if (!r) break;
      vyv += ((yv - r.p.y) / Math.max(0.2, r.t)) * 0.9;
    }
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
