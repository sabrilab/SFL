// L'IA des joueurs de champ (bola-app#23) : elle écrit des intentions, comme le pouce ou la manette, et subit donc la
// même inertie, les mêmes virages, les mêmes touches de balle et les mêmes contrôles. Plus de triche : pas de balle
// collée, pas de demi-tour instantané, ses frappes passent par la même puissance et la même erreur.
//
// Ses décisions reprennent celles d'avant (placement par formation, chasseur et couvreur, porteur qui va au but,
// passes, tirs, tacles), avec trois changements : le chasseur est celui qui arrive le premier à la balle (temps
// d'arrivée, élan compris) ; le hasard vient de la graine (flux « ia ») ; le couvreur contient (pas chassés face au
// porteur) au lieu de foncer. Deux coéquipiers ne se collent plus (ecarterCoequipiers : 0,75 m au moins).
//
// (bola-app#26, lot 2) Le jeu collectif : appels de balle vers l'espace libre (grille de 2 m revue toutes les 0,25 s),
// une-deux (le passeur repart dans l'espace, le receveur lui remet en une touche si le couloir est libre), centres
// depuis les côtés, reprises de volée et de la tête ; en défense, un pressing coordonné (le chasseur, celui qui coupe
// la ligne de passe la plus dangereuse, le couvreur entre la balle et le but, et un second presseur sur un mauvais
// contrôle, un porteur dos au but ou contre un panneau) ; le défenseur collé dans le dos du porteur le tient parfois
// par le maillot (faute s'il insiste). Les décisions collectives tirent dans leur propre flux (« collectif »).
import { PAS, CORPS as C, FORMATION, LB, BX, BZ, BUT_DL, butDe, sens } from './constantes.js';
import { clamp, libre } from './corps.js';
import { porteur, choisirPartenaire, adversaireProche } from './gestes.js';
import { predire } from './ballon.js';
import { cos, hypot, sin } from './maths.js';

/** Remet une intention à zéro. */
export function intentionVide(it = {}) {
  it.dx = 0; it.dz = 0; it.allure = 0; it.sprint = 0; it.regard = null;
  it.contenir = false; it.protege = false; it.charge = false; it.vaBalle = false; it.action = null; it.recupere = false;
  it.tire = false;
  return it;
}

/** Aller vers (cx, cz) à vmax au plus, en freinant pour s'arrêter dessus. */
export function aller(j, it, cx, cz, vmax) {
  const dx = cx - j.p.x, dz = cz - j.p.z, d = hypot(dx, dz);
  if (d < 0.25) { it.dx = 0; it.dz = 0; it.allure = 0; it.sprint = 0; return; }
  const v = Math.min(vmax, Math.sqrt(2 * 5 * Math.max(0, d - 0.2)));
  it.dx = dx / d; it.dz = dz / d;
  if (v <= C.vTrot) { it.allure = v / C.vTrot; it.sprint = 0; }
  else { it.allure = 1; it.sprint = clamp((v - C.vTrot) / (C.vSprint - C.vTrot), 0, 1); }
}

/** Temps pour qu'un joueur arrive au point (x, z), compte tenu de son élan (approché). */
export function tempsArrivee(j, x, z) {
  const dx = x - j.p.x, dz = z - j.p.z, d = hypot(dx, dz);
  const s = hypot(j.v.x, j.v.z);
  const dans = s > 0.3 ? (j.v.x * dx + j.v.z * dz) / (s * (d || 1)) : 0; // cos de l'écart
  const demi = (1 - dans) * 0.35 * (s / 4); // il faut d'abord tourner ou freiner
  return d / 6 + demi + (j.mode === 'sol' || j.mode === 'releve' ? 2 : j.mode === 'geste' ? 0.6 : 0);
}

/** La distance du point (x, z) au segment (ax, az) → (bx, bz). */
function distSegment(x, z, ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az, E = ex * ex + ez * ez || 1;
  const u = clamp(((x - ax) * ex + (z - az) * ez) / E, 0, 1);
  return hypot(x - ax - ex * u, z - az - ez * u);
}
/** Le couloir de (ax, az) à (bx, bz) est-il libre d'adversaires de l'équipe e (à marge près) ? */
function couloirLibre(m, e, ax, az, bx, bz, marge = 1.1) {
  for (const o of m.joueurs) {
    if (o.absent || o.e === e || o.mode === 'sol') continue;
    if (distSegment(o.p.x, o.p.z, ax, az, bx, bz) < marge) return false;
  }
  return true;
}

/** (correctifs #26) Le porteur est-il derrière une ligne de but (la sienne ou celle d'en face), ou dans un coin ? */
function coinDe(j) {
  const az = Math.abs(j.p.z);
  return az > LB - 0.2 || (Math.abs(j.p.x) > BX - 3 && az > LB - 2.5);
}

/** L'intention d'un joueur de champ de l'IA. */
export function pasIA(m, j) {
  const it = intentionVide(j.int);
  const b = m.balle, rng = m.rng.ia;
  it.regard = b.p;
  if (!libre(j) && j.mode !== 'frein') return;
  const p = porteur(m);
  const notre = p ? p.e === j.e : b.garde != null ? m.joueurs[b.garde].e === j.e : null;
  j.decision = (j.decision ?? rng.u() * 0.3) - PAS;
  j.essai = (j.essai ?? 0) - PAS;

  if (p === j) { porteurIA(m, j, it); return; }

  // le placement de base, poussé vers l'avant quand l'équipe a la balle, attiré par la balle
  const fBalle = b.p.z / (sens(j.e) * LB);
  const [bx, bf] = FORMATION[j.role];
  const pousse = notre === true ? 0.32 : notre === false ? -0.12 : 0.05;
  let cx = bx + b.p.x * 0.35;
  let cz = sens(j.e) * clamp(bf + pousse + fBalle * 0.42, -0.9, 0.85) * LB;
  let vmax = 5.2;
  // (bola-app#26, lot 2) notre attaque : la balle à nous, ou notre passe en l'air
  const nousAvons = notre === true || (!p && b.garde == null && b.recepteur != null && m.joueurs[b.recepteur].e === j.e);
  if (notre !== true && b.garde == null) {
    const R = rolesDefense(m, j.e, p, notre);
    if (j.i === R.chasseur) {
      const t = Math.min(0.7, hypot(b.p.x - j.p.x, b.p.z - j.p.z) / 6.5);
      cx = b.p.x + b.v.x * t; cz = b.p.z + b.v.z * t;
      vmax = 6.6; it.vaBalle = true;
      const r = rdv(m, j);
      if (r) { cx = r.x; cz = r.z; }
      // (la remise du une-deux en une touche, si la passe est pour lui)
      if (j.i === b.recepteur && !j.demande) remise(m, j, it, true);
    } else if (j.i === R.couvreur && notre === false) {
      // la couverture : entre la balle et son but, à une marge qui grandit avec la vitesse du porteur, face à lui
      cx = R.cov.x; cz = R.cov.z;
      if (hypot(b.p.x - j.p.x, b.p.z - j.p.z) < 5) { it.contenir = true; it.regard = b.p; }
    } else if (j.i === R.double && p) {
      // le pressing à deux (mauvais contrôle, dos au but, contre un panneau) : il ferme le côté du milieu
      cx = p.p.x + R.ferme.x * 0.85; cz = p.p.z + R.ferme.z * 0.85; vmax = 6.4;
      it.regard = p.p;
      if (hypot(p.p.x - j.p.x, p.p.z - j.p.z) < 1.2) it.charge = true;
    } else if (j.i === R.ligne && notre === false) {
      // il coupe la ligne de passe la plus dangereuse
      cx = R.lane.x; cz = R.lane.z; vmax = 5.8; it.regard = b.p;
    }
    if (nousAvons && j.i !== R.chasseur) ({ cx, cz, vmax } = attaque(m, j, it, cx, cz, vmax, p));
  } else if (b.recepteur === j.i) {
    // une passe arrive : à sa rencontre
    cx = b.p.x + b.v.x * 0.3; cz = b.p.z + b.v.z * 0.3; vmax = 6; it.vaBalle = true;
    const r = rdv(m, j);
    if (r) { cx = r.x; cz = r.z; vmax = 6.6; }
  } else if (nousAvons) ({ cx, cz, vmax } = attaque(m, j, it, cx, cz, vmax, p));
  // (le chasseur va jusqu'au panneau : une balle collée au panneau du fond se joue aussi)
  const bord = it.vaBalle ? 0.38 : 0.5;
  cx = clamp(cx, -BX + bord, BX - bord); cz = clamp(cz, -BZ + bord + 0.1 * (bord === 0.5 ? 1 : 0), BZ - bord - 0.1 * (bord === 0.5 ? 1 : 0));
  aller(j, it, cx, cz, vmax);
  // tout près de la balle, il va dessus (au lieu de s'arrêter à côté) : son pied doit l'atteindre
  if (it.vaBalle) {
    const dx = b.p.x - j.p.x, dz = b.p.z - j.p.z, d = hypot(dx, dz);
    if (d < 0.9 && d > 1e-6) { it.dx = dx / d; it.dz = dz / d; it.allure = Math.max(it.allure, 0.35); }
  }
  ecarterCoequipiers(m, j, it);
  if (!it.vaBalle && !it.contenir) contourner(m, j, it);
  // (bola-app#26, lot 2) une balle aérienne qui arrive à sa portée : reprise de volée ou de la tête, ou dégagement
  reprise(m, j, it, notre);
  // le tacle, sur le porteur d'en face
  if (p && p.e !== j.e && j.essai <= 0) {
    const d = hypot(p.p.x - j.p.x, p.p.z - j.p.z);
    const db = hypot(b.p.x - j.p.x, b.p.z - j.p.z);
    if (d < 2.4) {
      j.essai = 0.7;
      // (correctifs #26) un porteur coincé dans un coin, presque à l'arrêt : on va au contact franchement
      const coince = hypot(p.v.x, p.v.z) < 1.2 && (Math.abs(p.p.x) > BX - 2.5 || Math.abs(p.p.z) > LB - 0.5) && Math.abs(p.p.z) > LB - 3;
      const ch = (m.controle[p.e] === p.i ? 0.3 : 0.2) * (coince ? 2.5 : 1);
      // le tacle debout : la balle devant lui, pas derrière les jambes du porteur
      const devant = (b.p.x - j.p.x) * sin(j.cap) + (b.p.z - j.p.z) * cos(j.cap) > 0.3;
      // (bola-app#26, lot 2) collé dans le dos du porteur, la balle hors d'atteinte : il le tient par le maillot
      const s = hypot(p.v.x, p.v.z), fx = s > 0.8 ? p.v.x / s : sin(p.cap), fz = s > 0.8 ? p.v.z / s : cos(p.cap);
      const derriere = ((j.p.x - p.p.x) * fx + (j.p.z - p.p.z) * fz) < -0.35 * d;
      // (une balle protégée derrière le porteur : le tacle debout passe par ses jambes et le déséquilibre)
      if (db < 1.1 && (devant || d < 0.8) && rng.u() < (devant ? ch : ch * 0.3)) it.action = { type: 'tacle', glisse: false };
      // (bola-app#26 : le vrai tacle glissé porte plus loin, pieds devant ; l'IA le tente moins souvent)
      else if (db < 2.2 && db > 1.2 && rng.u() < ch * 0.25) it.action = { type: 'tacle', glisse: true };
      else if (d < 1.0 && rng.u() < 0.3) it.charge = true;
      if (!it.action && derriere && d < 0.95 && !devant && m.rng.duels.u() < 0.14) j.tireJusque = m.t + 0.45 + m.rng.duels.u() * 0.7;
    }
  }
  if (p && p.e !== j.e && m.t < (j.tireJusque ?? -9)) {
    // il tient : il colle au dos du porteur
    it.tire = true;
    const s = hypot(p.v.x, p.v.z), fx = s > 0.8 ? p.v.x / s : sin(p.cap), fz = s > 0.8 ? p.v.z / s : cos(p.cap);
    const tx = p.p.x - fx * 0.6 - j.p.x, tz = p.p.z - fz * 0.6 - j.p.z, L = hypot(tx, tz);
    if (L > 0.05) { it.dx = tx / L; it.dz = tz / L; it.allure = 1; it.sprint = Math.max(it.sprint, clamp(L, 0, 1) * 0.6); }
    it.vaBalle = false;
  } else if (!p || p.e === j.e) j.tireJusque = -9;
}

/**
 * (lot 2) Le rendez-vous avec une balle en l'air (un centre, une balle levée) : le point où elle redescend à hauteur
 * de tête (1,55 m), revu toutes les 0,1 s ; null si la balle est au sol.
 */
function rdv(m, j) {
  const b = m.balle;
  if (b.garde != null || (b.p.y < 0.5 && b.v.y < 1)) { j.rdv = null; return null; }
  if (m.t >= (j.rdvT ?? -9)) {
    j.rdvT = m.t + 0.1;
    const r = predire(b, (q) => q.v.y < 0 && q.p.y < 1.55, 2);
    j.rdv = r ? { x: r.p.x, z: r.p.z } : null;
  }
  return j.rdv;
}

/**
 * La remise du une-deux (bola-app#26, lot 2) : le receveur d'une passe dont le passeur est reparti dans l'espace décide
 * une fois (75 %) s'il la lui remet ; puis, dès que le passeur est à sa hauteur ou devant et le couloir libre, il la
 * remet : en une touche si la balle arrive encore (unTouche), sinon après son contrôle (2 s au plus). Renvoie null
 * si rien ne se joue, faux s'il attend, vrai si la remise part.
 */
function remise(m, j, it, unTouche) {
  const b = m.balle, der = m.passes[m.passes.length - 1];
  if (!der || der.a !== j.i || m.t - der.t > 3.5) return null;
  const X = m.joueurs[der.de], U = X.uneDeux;
  if (j.remiseDe !== der.t) { j.remiseDe = der.t; j.remiseOui = !!U && m.rng.collectif.u() < 0.75; j.remiseT = m.t; }
  if (!j.remiseOui || !U || m.t - U.t > 3.5 || X.mode !== 'loco' || (!unTouche && m.t - j.remiseT > 2)) return null;
  if (unTouche) {
    // (la balle arrive : à moins de 3 m, et elle vient vers lui)
    const rx = j.p.x - b.p.x, rz = j.p.z - b.p.z, d = hypot(rx, rz);
    if (d > 3 || b.p.y > 0.4 || (rx * b.v.x + rz * b.v.z) < 0.5 * d) return false;
  }
  const t = 0.5, xx = X.p.x + X.v.x * t, xz = X.p.z + X.v.z * t;
  const aHauteur = (xz - j.p.z) * sens(j.e) > (unTouche ? -2.5 : -1.0);
  if (!aHauteur || !couloirLibre(m, j.e, b.p.x, b.p.z, xx, xz, 1.0)) {
    // (le mur attend : balle au pied, il ne file pas vers le but, il temporise)
    if (!unTouche) { it.allure = Math.min(it.allure, 0.25); it.sprint = 0; }
    return false;
  }
  // (la remise part devant le passeur lancé, assez forte pour qu'il la reprenne dans sa course : 5,5 m/s à l'arrivée)
  const d = hypot(xx - b.p.x, xz - b.p.z), v0 = Math.sqrt(5.5 * 5.5 + 2 * 1.35 * d);
  it.action = { type: 'passe', p: clamp((v0 - 6) / 12, 0.2, 1), cible: X.i, dx: xx - j.p.x, dz: xz - j.p.z };
  X.uneDeux = null; j.remiseOui = false; j.decision = 0.5;
  return true;
}

/** Le porteur de l'IA : vers le but en évitant le plus proche ; frappe, passe, centre, remise du une-deux. */
function porteurIA(m, j, it) {
  const rng = m.rng.ia, col = m.rng.collectif;
  const zb = butDe(1 - j.e);
  let cx = clamp(-j.p.x * 0.2, -3, 3), cz = zb;
  const { o: proche, d: dp } = adversaireProche(m, j);
  if (proche && dp < 3.5) cx = j.p.x + Math.sign(j.p.x - proche.p.x || 1) * 4;
  // le long d'un panneau, il revient vers le milieu (la balle coincée contre le panneau ne se joue plus)
  if (Math.abs(j.p.x) > BX - 2.2) cx = Math.sign(j.p.x) * (BX - 5);
  // (correctifs #26) derrière une ligne de but, ou dans un coin : il ressort vers le terrain (avant, il visait
  // la ligne de but et restait collé au coin avec trois défenseurs autour, 14 s sans que rien ne se passe)
  const coin = coinDe(j);
  if (coin) { cz = Math.sign(j.p.z) * (LB - 4.5); cx = Math.sign(j.p.x || 1) * Math.min(Math.abs(j.p.x), BX - 4.5); }
  cx = clamp(cx, -BX + 1.5, BX - 1.5);
  aller(j, it, cx, cz, 5.6);
  // il garde la balle : il court vers elle quand elle file devant
  conduire(m, j, it);
  // il protège un moment, puis s'en va de l'autre côté (dans un coin : vers le terrain, pas dans les panneaux)
  j.protegeT = proche && dp < 1.4 && hypot(j.v.x, j.v.z) < 2 ? (j.protegeT ?? 0) + PAS : 0;
  if (j.protegeT > 0 && j.protegeT < (coin ? 0.6 : 1.2)) { it.protege = true; it.regard = proche.p; }
  else if (j.protegeT > 0 && proche) {
    let ax = j.p.x - proche.p.x, az = j.p.z - proche.p.z, L = hypot(ax, az) || 1; ax /= L; az /= L;
    if (coin) { const tx = cx - j.p.x, tz = cz - j.p.z, T = hypot(tx, tz) || 1; ax = ax * 0.35 + tx / T; az = az * 0.35 + tz / T; L = hypot(ax, az) || 1; ax /= L; az /= L; }
    it.dx = ax; it.dz = az; it.allure = 0.8; if (j.protegeT > 2.4) j.protegeT = 0;
  }
  // (bola-app#26, lot 2) la remise du une-deux : le passeur est reparti dans l'espace, le couloir est libre → remise
  // en une touche, tout de suite (une fois par passe reçue)
  // (bola-app#26, lot 2) la remise du une-deux, en deux touches (en une, elle part avant le contrôle : pasIA)
  const r = remise(m, j, it, false);
  if (r !== null) return;
  if (j.decision > 0) return;
  j.decision = 0.28 + rng.u() * 0.15;
  const dBut = hypot(j.p.x, zb - j.p.z);
  // (correctifs #26) pas de frappe de derrière la ligne ni d'un angle fermé : il remet en retrait
  const ferme = (j.p.z - zb) * Math.sign(zb) > -0.3 || Math.abs(j.p.x) > BUT_DL + 2.2 * Math.abs(zb - j.p.z);
  if (!ferme && (dBut < 7.5 || (dBut < 10 && rng.u() < 0.6) || (dBut < 13 && Math.abs(j.p.x) < 6 && rng.u() < 0.28))) {
    // près d'un poteau (l'erreur de la frappe fait le reste : à côté, ou dedans)
    // le côté que le gardien couvre le moins
    const g = m.joueurs.find((o) => o.gardien && o.e !== j.e);
    const cote = g ? (g.p.x > 0 ? -1 : 1) : rng.u() < 0.5 ? -1 : 1;
    const x = (rng.u() < 0.75 ? cote : -cote) * (0.6 + rng.u() * (BUT_DL - 0.95));
    // (bola-app#26, lot 2) frappe, finesse (intérieur brossé) ou extérieur : un seul tirage, comme avant
    const u = rng.u();
    const type = u < 0.13 ? 'finesse' : u < 0.2 ? 'exterieur' : 'frappe';
    it.action = { type, p: 0.45 + rng.u() * 0.4, x, y: 0.3 + rng.u() * 1.1 };
    return;
  }
  // (bola-app#26, lot 2) le centre : sur un côté, près de la ligne de but, un coéquipier au point de penalty
  if (Math.abs(j.p.x) > 3.8 && Math.abs(zb - j.p.z) < 10) {
    let t = null;
    for (const o of m.joueurs) if (o.e === j.e && o !== j && !o.gardien && !o.absent && Math.abs(o.p.x) < 3.2 && Math.abs(zb - o.p.z) < 8 && hypot(o.p.x - j.p.x, o.p.z - j.p.z) > 4) t = o;
    if (t && col.u() < 0.55) { it.action = { type: 'centre', p: 0.9, cible: t.i, dx: t.p.x - j.p.x, dz: t.p.z - j.p.z }; return; }
  }
  if ((dp < 2.4 && rng.u() < 0.65) || (dp < 4 && rng.u() < 0.4) || rng.u() < 0.14 || Math.abs(j.p.x) > BX - 1.6 || coin || ferme) {
    const cible = choisirPartenaire(m, j, sin(j.cap), cos(j.cap) + sens(j.e) * 0.6);
    if (cible) {
      const d = hypot(cible.p.x - j.p.x, cible.p.z - j.p.z);
      const prof = rng.u() < 0.25;
      // la force qu'il faut pour que la passe arrive à 6 m/s (roulement 1,08 m/s² et l'air ; lot 2 : 4,5 m/s se faisait couper)
      const v0 = Math.sqrt(6 * 6 + 2 * 1.35 * d);
      const lob = d > 14 && rng.u() < 0.4;
      it.action = { type: lob ? 'lob' : prof ? 'profondeur' : 'passe', p: clamp((v0 - 6) / 12, 0.05, 1), cible: cible.i, dx: cible.p.x - j.p.x, dz: cible.p.z - j.p.z };
      // (bola-app#26, lot 2) le une-deux : après une passe courte, le passeur repart dans l'espace, devant, du côté
      // opposé au défenseur le plus proche, pour la redemander
      if (!lob && j.role !== 'D' && d < 10 && (j.p.z - butDe(j.e)) * sens(j.e) > LB * 0.6 && col.u() < 0.5) {
        const s = sens(j.e), lat = proche ? Math.sign(j.p.x - proche.p.x || 1) : 1;
        j.uneDeux = { t: m.t, cible: cible.i, x: clamp(j.p.x + lat * 1.6, -BX + 1.2, BX - 1.2), z: clamp(j.p.z + s * 5.5, -LB + 2, LB - 2) };
      }
    }
  }
}

/**
 * Les rôles de la défense de l'équipe e, calculés une fois par pas : le chasseur (le premier à la balle), le couvreur
 * (entre la balle et le but, à une marge qui grandit avec la vitesse du porteur), celui qui coupe la ligne de passe la
 * plus dangereuse, et, sur un déclencheur (mauvais contrôle, porteur dos au but, porteur contre un panneau), le second
 * presseur qui ferme le côté du milieu.
 */
function rolesDefense(m, e, p, notre) {
  m._roles ??= [{ pas: -1 }, { pas: -1 }];
  const R = m._roles[e];
  if (R.pas === m.pas) return R;
  R.pas = m.pas;
  const b = m.balle;
  // qui va chercher la balle : celui de l'équipe qui y arrive le premier (sauf le joueur humain, qui choisit)
  const humain = m.controle[e];
  const ia = m.joueurs.filter((o) => o.e === e && !o.gardien && !o.absent && o.i !== humain);
  const tb = (o) => tempsArrivee(o, b.p.x + b.v.x * 0.3, b.p.z + b.v.z * 0.3);
  ia.sort((a, c) => tb(a) - tb(c));
  const prochain = b.recepteur != null && m.joueurs[b.recepteur].e === e ? b.recepteur : null;
  const hj = humain != null ? m.joueurs[humain] : null;
  const humainPresse = hj && hypot(hj.p.x - b.p.x, hj.p.z - b.p.z) < 4;
  // (l'humain demande un renfort, RB / R1 : le plus proche de l'IA presse avec lui)
  const seul = humainPresse && !m.renfort?.[e];
  R.chasseur = prochain ?? (seul ? null : ia[0]?.i ?? null);
  let reste = ia.filter((o) => o.i !== R.chasseur);
  const avant0 = { couvreur: R.couvreur, ligne: R.ligne, double: R.double };
  R.couvreur = null; R.ligne = null; R.double = null;
  // (le plus près du point ; celui qui tenait déjà ce rôle garde 1,5 m d'avance : les rôles ne sautent pas d'un joueur à
  // l'autre à chaque pas)
  const avant = avant0;
  const plusPres = (pt, role) => { let best = null, bd = Infinity; for (const o of reste) { const d = hypot(o.p.x - pt.x, o.p.z - pt.z) - (o.i === avant[role] ? 1.5 : 0); if (d < bd) { bd = d; best = o; } } return best; };
  const zb = butDe(e);
  if (notre === false && p) {
    const sp = hypot(p.v.x, p.v.z), marge = clamp(2.4 + 0.3 * sp, 2.4, 4.4);
    const ux = -b.p.x, uz = zb - b.p.z, L = hypot(ux, uz) || 1;
    R.cov = { x: b.p.x + (ux / L) * marge, z: b.p.z + (uz / L) * marge };
    const c = plusPres(R.cov, 'couvreur');
    R.couvreur = c?.i ?? null;
    reste = reste.filter((o) => o !== c);
    // la ligne de passe la plus dangereuse : le receveur le plus près de notre but, démarqué
    let q = null, dq = -Infinity;
    for (const o of m.joueurs) {
      if (o.absent || o.e === e || o.gardien || o === p) continue;
      const danger = 1 - hypot(o.p.x, o.p.z - zb) / 30 + (couloirLibre(m, o.e, p.p.x, p.p.z, o.p.x, o.p.z, 1.0) ? 0.4 : 0) - hypot(o.p.x - p.p.x, o.p.z - p.p.z) / 40 + (o.i === R.cible ? 0.15 : 0);
      if (danger > dq) { dq = danger; q = o; }
    }
    // le déclencheur du pressing à deux
    const dos = cos(p.cap) * sens(p.e) < -0.4;
    const panneau = Math.abs(p.p.x) > BX - 1.5 || Math.abs(p.p.z) > BZ - 2;
    const rate = (p.controleQ ?? 1) < 0.55 && m.t - (p.controleT ?? -9) < 1;
    if ((dos || panneau || rate) && !seul && reste.length) {
      // le côté du milieu (perpendiculaire à la ligne porteur → but, vers x = 0)
      let nx = -(zb - p.p.z), nz = p.p.x - 0; const nl = hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      if (nx * -p.p.x < 0) { nx = -nx; nz = -nz; }
      R.ferme = { x: nx, z: nz };
      const d2 = plusPres({ x: p.p.x + nx, z: p.p.z + nz }, 'double');
      R.double = d2?.i ?? null;
      reste = reste.filter((o) => o !== d2);
    }
    if (q && reste.length) {
      R.lane = { x: p.p.x + (q.p.x - p.p.x) * 0.42, z: p.p.z + (q.p.z - p.p.z) * 0.42 };
      R.ligne = plusPres(R.lane, 'ligne')?.i ?? null;
      R.cible = q.i;
    }
  } else R.couvreur = seul ? ia[0]?.i ?? null : ia[1]?.i ?? null;
  return R;
}

/**
 * L'attaque sans la balle (bola-app#26, lot 2) : le passeur d'un une-deux file vers son espace ; les autres (sauf le
 * défenseur, qui reste derrière) font un appel de balle vers l'espace libre le plus utile autour de leur poste
 * (grille de 2 m, revue toutes les 0,25 s : loin des adversaires, couloir de passe ouvert, vers le but, pas sur un
 * coéquipier), au sprint quand le porteur relève la tête.
 */
function attaque(m, j, it, cx, cz, vmax, p) {
  const U = j.uneDeux;
  if (U && m.t - U.t < 3 && b0(m).recepteur !== j.i) {
    // (arrivé à son espace, il ne s'arrête pas : il continue vers le but, la remise doit le trouver lancé)
    if (hypot(U.x - j.p.x, U.z - j.p.z) < 1.5) { U.z = clamp(U.z + sens(j.e) * 2.5, -LB + 2, LB - 2); }
    it.regard = m.balle.p; return { cx: U.x, cz: U.z, vmax: 6.6 };
  }
  if (U && m.t - U.t >= 3) j.uneDeux = null;
  if (j.role === 'D') return { cx, cz, vmax };
  const a = appel(m, j, cx, cz, p);
  if (!a) return { cx, cz, vmax };
  const tete = p && (hypot(p.v.x, p.v.z) < 3.5 || (p.decision ?? 1) < 0.2);
  // (le pas de course de l'appel : 5,4 m/s, l'allure propre du clip de course ; au sprint quand le porteur relève la tête)
  return { cx: a.x, cz: a.z, vmax: tete ? 6.2 : 5.4 };
}
const b0 = (m) => m.balle;

function appel(m, j, cx0, cz0, p) {
  if (m.t < (j.appelT ?? -9) && j.appel) return j.appel;
  j.appelT = m.t + 0.25;
  const b = m.balle, s = sens(j.e), zg = butDe(1 - j.e);
  const ox = p ? p.p.x : b.p.x, oz = p ? p.p.z : b.p.z;
  let best = null, bs = -Infinity;
  for (let ix = -2; ix <= 2; ix++) for (let iz = -2; iz <= 2; iz++) {
    const x = clamp(cx0 + ix * 2, -BX + 1.2, BX - 1.2), z = clamp(cz0 + iz * 2, -LB + 1.5, LB - 1.5);
    let dmin = 9, coupe = 0;
    for (const o of m.joueurs) {
      if (o.absent || o.e === j.e || o.mode === 'sol') continue;
      dmin = Math.min(dmin, hypot(o.p.x - x, o.p.z - z));
      if (!o.gardien && distSegment(o.p.x, o.p.z, ox, oz, x, z) < 1.2) coupe++;
    }
    let sc = Math.min(dmin, 4) * 0.9 - coupe * 1.2 + (z - cz0) * s * 0.18 - hypot(x - cx0, z - cz0) * 0.12;
    for (const o of m.joueurs) if (o !== j && !o.absent && o.e === j.e && !o.gardien) { const d = hypot(o.p.x - x, o.p.z - z); if (d < 3) sc -= (3 - d) * 0.6; }
    if (hypot(x, z - zg) < 2.5) sc -= 2;
    if (hypot(x - ox, z - oz) < 2.5) sc -= 1.5;
    if (sc > bs) { bs = sc; best = { x, z, sc }; }
  }
  // (il ne change d'appel que pour un espace nettement meilleur, ou si le sien n'est plus près de son poste : pas
  // d'hésitation d'une case à l'autre)
  const garde = j.appel && hypot(j.appel.x - cx0, j.appel.z - cz0) < 4.5 && best && best.sc < (j.appel.sc ?? -Infinity) + 0.8;
  if (garde) { j.appel.sc = Math.max(j.appel.sc - 0.05, best.sc - 0.79); return j.appel; }
  if (best && j.appel && hypot(best.x - j.appel.x, best.z - j.appel.z) > 2.5) { m.stats.appels++; m.ev('appel', { j: j.i, x: best.x, z: best.z }); }
  j.appel = best;
  return best;
}

/**
 * La reprise d'une balle aérienne (bola-app#26, lot 2) : si la balle va passer à sa portée (1 m) entre 0,45 et 2 m de
 * haut dans 0,15 à 0,55 s, il la reprend de volée ou de la tête (le geste est choisi par la hauteur, gestes.js) : vers
 * le but s'il en est à moins de 12 m, en dégagement devant son but ; ailleurs, il la contrôle.
 */
function reprise(m, j, it, notre) {
  const b = m.balle;
  if (b.garde != null || j.demande || m.t < (j.airT ?? -9)) return;
  if (b.p.y < 0.5 && b.v.y < 1) return;
  if (b.possesseur != null && b.possesseur !== j.i && m.joueurs[b.possesseur].e === j.e) return;
  if (hypot(b.p.x - j.p.x, b.p.z - j.p.z) > 6) return;
  j.airT = m.t + 0.1;
  const r = predire(b, (q) => hypot(q.p.x - j.p.x, q.p.z - j.p.z) < 1.0 && q.p.y > 0.45 && q.p.y < 2.0, 0.6);
  if (!r || r.t < 0.15 || r.t > 0.55) return;
  const zg = butDe(1 - j.e), zn = butDe(j.e), col = m.rng.collectif;
  if (hypot(j.p.x, zg - j.p.z) < 12) {
    const g = m.joueurs.find((o) => o.gardien && o.e !== j.e);
    const cote = g ? (g.p.x > 0 ? -1 : 1) : 1;
    it.action = { type: 'frappe', p: 0.55 + col.u() * 0.3, x: cote * (0.5 + col.u() * 0.7), y: 0.4 + col.u() * 0.9 };
  } else if (hypot(j.p.x, zn - j.p.z) < 10 && notre !== true) {
    it.action = { type: 'passe', p: 0.95, dx: j.p.x > 0 ? 0.6 : -0.6, dz: sens(j.e) };
  }
}

/**
 * Deux coéquipiers ne se collent pas : sous 1,1 m l'un de l'autre (0,75 m au moins entre les centres), l'intention
 * s'écarte de l'autre, d'autant plus qu'ils sont près (le chasseur, qui va à la balle, s'écarte moins).
 */
export function ecarterCoequipiers(m, j, it) {
  let rx = 0, rz = 0;
  for (const o of m.joueurs) {
    if (o === j || o.absent || o.e !== j.e || o.mode === 'sol') continue;
    const dx = j.p.x - o.p.x, dz = j.p.z - o.p.z, d = hypot(dx, dz);
    if (d > 1.1 || d < 1e-6) continue;
    const w = (1.1 - d) / (1.1 - 0.75 * 0.5);
    rx += (dx / d) * w; rz += (dz / d) * w;
  }
  if (!(rx || rz)) return;
  const k = it.vaBalle ? 0.6 : 1.5;
  const vx = it.dx * it.allure + rx * k, vz = it.dz * it.allure + rz * k, L = hypot(vx, vz);
  if (L < 0.02) return;
  it.dx = vx / L; it.dz = vz / L;
  it.allure = clamp(Math.max(it.allure, Math.min(0.6, L)), 0, 1);
}

/**
 * (lot 2) Contourner un adversaire planté devant soi (à moins de 1,1 m dans la direction voulue) : la course s'incline
 * vers la tangente, du côté choisi une fois (gardé tant qu'il est là), d'autant plus qu'il est droit devant et près ; le
 * changement de direction reste progressif (le cap suit la course : pas de pieds qui glissent).
 */
export function contourner(m, j, it) {
  if (!(it.dx || it.dz) || it.allure < 0.2) return;
  let best = null, bw = 0;
  for (const o of m.joueurs) {
    if (o.absent || o.e === j.e || o.mode === 'sol') continue;
    const rx = o.p.x - j.p.x, rz = o.p.z - j.p.z, d = hypot(rx, rz);
    if (d > 1.1 || d < 1e-6) continue;
    const devant = (rx * it.dx + rz * it.dz) / d;
    const w = clamp((devant - 0.25) / 0.35, 0, 1) * clamp((1.1 - d) / 0.4, 0, 1);
    if (w > bw) { bw = w; best = { ux: rx / d, uz: rz / d, d }; }
  }
  if (!best) return;
  const { ux, uz, d } = best;
  // le côté : choisi au début du contournement (celui de la course voulue), gardé tant que l'obstacle est là (et 0,4 s
  // après) : pas d'hésitation d'un côté à l'autre
  if (m.t > (j.contourneT ?? -9)) j.contourneCote = (uz * it.dx - ux * it.dz) >= 0 ? 1 : -1;
  j.contourneT = m.t + 0.4;
  const s = j.contourneCote ?? 1;
  const tx = -uz * s, tz = ux * s;
  const k = d < 0.72 ? 0.3 : 0.1;
  let nx = tx - ux * k, nz = tz - uz * k; const L = hypot(nx, nz) || 1; nx /= L; nz /= L;
  const vx = it.dx * (1 - bw) + nx * bw, vz = it.dz * (1 - bw) + nz * bw, V = hypot(vx, vz) || 1;
  it.dx = vx / V; it.dz = vz / V; it.allure = Math.max(it.allure, 0.6);
}

/** Aide de conduite (IA et humains) : la course se règle sur la balle qui file devant, pour la rattraper. */
export function conduire(m, j, it) {
  const b = m.balle;
  if (!(it.dx || it.dz)) return;
  const rx = b.p.x - j.p.x, rz = b.p.z - j.p.z, d = hypot(rx, rz);
  if (d > 5) return;
  // la balle est restée à côté de lui ou derrière (il l'a dépassée) : il ralentit et revient dessus, au lieu de
  // l'abandonner en continuant tout droit
  const al0 = d > 1e-6 ? (rx * it.dx + rz * it.dz) / d : 1;
  if (d > 0.3 && d < 1.4 && al0 < 0.35 && b.p.y < 0.4 && hypot(b.v.x, b.v.z) < hypot(j.v.x, j.v.z) + 0.5) {
    it.dx = rx / d; it.dz = rz / d; it.allure = Math.min(Math.max(it.allure, 0.4), 0.6); it.sprint = 0;
    it.recupere = true; // (ce n'est pas un demi-tour demandé : monde.js ne le change pas en crochet)
    return;
  }
  if (d < 0.35) return;
  const al = al0;
  if (al < 0.35) return;
  // viser un peu derrière la balle, sur sa course
  const t = 0.12;
  const tx = b.p.x + b.v.x * t - j.p.x, tz = b.p.z + b.v.z * t - j.p.z, L = hypot(tx, tz) || 1;
  const w = clamp((d - 0.35) / 1.2, 0.3, 0.85);
  let ux = it.dx * (1 - w) + (tx / L) * w, uz = it.dz * (1 - w) + (tz / L) * w;
  const n = hypot(ux, uz) || 1;
  it.dx = ux / n; it.dz = uz / n;
  // la balle file : on accélère pour la rejoindre
  if (d > 1.6) it.allure = Math.max(it.allure, 1);
}
