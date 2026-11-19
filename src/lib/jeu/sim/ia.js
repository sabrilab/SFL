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
//
// (bola-app#32, lot B : placements de foot à 5, tactiques ; principes du futsal et sources dans le compte rendu de #32)
//   · plus de formation fixe : en attaque, chaque joueur tient un POSTE du losange 1-2-1 (sim/tactique.js : fixo derrière
//     la balle, ala côté balle le long du panneau, ala côté faible, pivot devant), qui suit la balle et TOURNE (le
//     porteur tient le sien, les autres prennent les postes restants au plus court) ; les appels se cherchent autour du
//     poste ; le pivot ou l'ala côté faible part dans le dos du dernier défenseur quand le porteur peut la donner ; sur un
//     côté près du but, ils attaquent le second poteau et le point de pénalty ;
//   · en défense, un bloc de zone en losange (defenseEquipe) qui coulisse avec la balle, à la hauteur du plan (pressing
//     haut, équilibre, bloc bas), avec le presseur (qui attend en haut du bloc hors de sa zone de sortie), le couvreur,
//     la ligne de passe coupée et le second presseur sur déclencheur (rolesDefense) ; celui qui ne peut pas couper une
//     passe va presser le receveur à la réception ;
//   · les transitions : après la perte, le repli au sprint derrière la balle (en la contournant) ; après la
//     récupération, les appels au sprint ;
//   · pas de ruée : sans rôle sur la balle, personne ne vient à moins de 7 m d'elle (ANNEAU) ; le couvreur et celui qui
//     coupe la ligne de passe se tiennent à 6 m du porteur hors du pressing haut ;
//   · le porteur choisit sur des critères (decider : chance de but, progression, démarquage, couloir, espace devant) et
//     utilise les commandes de la table (piqué, enroulée, ras de terre, passe puissante, profondeur lobée, centre lobé,
//     centre tendu) ; la variété vient d'un bruit borné à graine ;
//   · le tacle à bon escient (point 15) : pas en série, la récupération au pied de face, le glissé de côté (tacleIA).
import { PAS, CORPS as C, LB, BX, BZ, BUT_DL, JEU, butDe, sens } from './constantes.js';
import { av, zDe, planDe, styleDe, phaseDe, cibleAttaque, chanceBut } from './tactique.js';
import { clamp, libre } from './corps.js';
import { porteur, adversaireProche, aimantee } from './gestes.js';
import { predire } from './ballon.js';
import { cos, hypot, sin } from './maths.js';

/** Remet une intention à zéro. */
export function intentionVide(it = {}) {
  it.dx = 0; it.dz = 0; it.allure = 0; it.sprint = 0; it.regard = null;
  it.contenir = false; it.protege = false; it.charge = false; it.vaBalle = false; it.action = null; it.recupere = false;
  it.tire = false;
  // (correctifs #32, D6 du contrôle du code) la charge d'un humain : sans cela, un joueur repris par l'IA pendant qu'on
  // chargeait (manette débranchée, « IA contre IA » depuis la pause) gardait la touche « tenue » et l'élan armé 1,25 s
  it.tenir = false; it.bref = false; it.puissance = null; it.viseX = null; it.stickHumain = 0;
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

  // (bola-app#26, lot 2) notre attaque : la balle à nous, ou notre passe en l'air
  const nousAvons = notre === true || (!p && b.garde == null && b.recepteur != null && m.joueurs[b.recepteur].e === j.e);
  // (bola-app#32, lot B) la place de base : le poste d'attaque du losange (sim/tactique.js : fixo, alas, pivot, qui
  // tournent) quand l'équipe a la balle, ou l'a eue en dernier (balle libre) ; la place du bloc de zone sinon
  const enAttaqueE = nousAvons || (notre == null && b.recepteur == null && m.possession?.e === j.e);
  const phase = phaseDe(m, j.e), plan = planDe(m, j.e);
  let cx, cz, vmax = 5.4;
  if (enAttaqueE) { const c = cibleAttaque(m, j, p, (j._cible ??= { x: 0, z: 0 })); cx = c.x; cz = c.z; j.intention = 'poste'; }
  else {
    const D = defenseEquipe(m, j.e, p, notre);
    const c = D.poste[j.i];
    if (c) { cx = c.x; cz = c.z; j.intention = c.nom; vmax = hypot(c.x - j.p.x, c.z - j.p.z) > 4 ? 6.4 : 5.4; }
    else { cx = j.p.x; cz = j.p.z; }
  }
  if (notre !== true && b.garde == null) {
    const R = rolesDefense(m, j.e, p, notre);
    if (j.i === R.chasseur && R.attente) {
      // (lot B) hors de sa zone de sortie (le plan), le presseur attend en haut du bloc, sur la ligne balle → but : il
      // cadre le porteur, il ne court pas après lui
      cx = R.attente.x; cz = R.attente.z; vmax = 6.2; j.intention = 'cadre';
      if (p && hypot(p.p.x - j.p.x, p.p.z - j.p.z) < 4.5 && hypot(p.v.x, p.v.z) < 3) { it.contenir = true; it.regard = p.p; }
    } else if (j.i === R.chasseur) {
      const t = Math.min(0.7, hypot(b.p.x - j.p.x, b.p.z - j.p.z) / 6.5);
      cx = b.p.x + b.v.x * t; cz = b.p.z + b.v.z * t;
      vmax = notre === false ? plan.vPresse : 6.6; it.vaBalle = true; j.intention = notre === false ? 'presse' : 'balle';
      // (lot B) près du porteur, il vient se placer côté balle, devant elle (la balle entre lui et le porteur) : c'est de
      // là qu'on la récupère du pied
      if (p && notre === false && hypot(p.p.x - j.p.x, p.p.z - j.p.z) < 4) {
        const ux = b.p.x - p.p.x, uz = b.p.z - p.p.z, L = hypot(ux, uz);
        if (L > 0.15) { cx = b.p.x + (ux / L) * 0.55 + b.v.x * 0.15; cz = b.p.z + (uz / L) * 0.55 + b.v.z * 0.15; }
      }
      const r = rdv(m, j);
      if (r) { cx = r.x; cz = r.z; }
      // (lot B) une passe adverse en route : il ne court après la balle que s'il peut la couper ; sinon il va presser le
      // receveur à la réception, côté but (il arrive avec la balle, pas derrière elle)
      const R2 = b.recepteur != null ? m.joueurs[b.recepteur] : null;
      if (!r && R2 && R2.e !== j.e && !p) {
        const c = couper(m, j);
        if (c) { cx = c.x; cz = c.z; j.intention = 'coupe'; }
        else { const zg = butDe(j.e), L = hypot(-R2.p.x, zg - R2.p.z) || 1; cx = R2.p.x - (R2.p.x / L) * 1.4; cz = R2.p.z + ((zg - R2.p.z) / L) * 1.4; it.vaBalle = false; j.intention = 'presse'; }
      }
      // (la remise du une-deux en une touche, si la passe est pour lui)
      if (j.i === b.recepteur && !j.demande) remise(m, j, it, true);
    } else if (j.i === R.couvreur && notre === false) {
      // la couverture : entre la balle et son but, à une marge qui grandit avec la vitesse du porteur, face à lui
      cx = R.cov.x; cz = R.cov.z; j.intention = 'couvre';
      // (lot B : en pas chassés seulement tout près, ou face à un porteur lent ; sinon il recule en courant pour tenir sa
      // distance de couverture)
      const dB = hypot(b.p.x - j.p.x, b.p.z - j.p.z), sp = p ? hypot(p.v.x, p.v.z) : 0;
      if (dB < 3 || (dB < 5 && sp < 3)) { it.contenir = true; it.regard = b.p; }
    } else if (j.i === R.double && p) {
      // le pressing à deux (mauvais contrôle, dos au but, contre un panneau ; en pressing haut, une passe en retrait) :
      // il ferme le côté du milieu
      cx = p.p.x + R.ferme.x * 0.85; cz = p.p.z + R.ferme.z * 0.85; vmax = 6.4; j.intention = 'double';
      it.regard = p.p;
      if (hypot(p.p.x - j.p.x, p.p.z - j.p.z) < 1.2) it.charge = true;
    } else if (j.i === R.ligne && notre === false) {
      // il coupe la ligne de passe la plus dangereuse
      cx = R.lane.x; cz = R.lane.z; vmax = 5.8; it.regard = b.p; j.intention = 'ligne';
    }
    if (nousAvons && j.i !== R.chasseur) ({ cx, cz, vmax } = attaque(m, j, it, cx, cz, vmax, p));
  } else if (b.recepteur === j.i) {
    // une passe arrive : à sa rencontre (bola-app#32, lot A : au-devant, au premier point de sa course qu'il atteint
    // avant elle ; avant : la balle dans 0,3 s)
    cx = b.p.x + b.v.x * 0.3; cz = b.p.z + b.v.z * 0.3; vmax = 6; it.vaBalle = true; j.intention = 'recoit';
    const r = auDevant(m, j);
    if (r) { cx = r.x; cz = r.z; vmax = 7; }
  } else if (nousAvons) ({ cx, cz, vmax } = attaque(m, j, it, cx, cz, vmax, p));
  // (lot B) la transition défensive : celui qui est devant la balle rentre au sprint derrière elle (le repli), en la
  // contournant (il ne repasse pas sur le porteur : si sa course passe à moins de 5,5 m de la balle, il fait le tour à
  // 7,5 m de côté)
  const q = p ?? b;
  if (!nousAvons && phase === 'transDef' && !it.vaBalle && j.intention !== 'cadre' && j.intention !== 'couvre' && j.intention !== 'double') {
    const aB = av(j.e, q.p.z);
    // (en équilibre et en bloc bas, celui dont la place est à plus de 4 m derrière lui rentre aussi au sprint)
    if (av(j.e, j.p.z) <= aB - 1 && plan.id !== 'pressing' && av(j.e, j.p.z) - av(j.e, cz) > 4) { vmax = Math.max(vmax, 7.2); j.intention = 'repli'; }
    else if (av(j.e, j.p.z) > aB - 1) {
      vmax = Math.max(vmax, 7.4); j.intention = 'repli';
      if (distSegment(q.p.x, q.p.z, j.p.x, j.p.z, cx, cz) < 5.5) { cx = clamp(q.p.x + (j.p.x >= q.p.x ? 1 : -1) * 7.5, -BX + 1, BX - 1); cz = q.p.z + (butDe(j.e) - q.p.z) * 0.25; }
    }
  }
  // (lot B) pas de ruée : sans rôle sur la balle (presseur, couvreur, second presseur, receveur, une-deux), on ne vient
  // pas à moins de 7 m d'elle (ANNEAU) ; la place visée est repoussée hors de ce rond
  const surBalle = it.vaBalle || j.intention === 'couvre' || j.intention === 'double' || j.intention === 'cadre' || j.intention === 'uneDeux' || j.intention === 'ligne' || j.intention === 'poteau' || j.intention === 'penalty';
  if (!surBalle) {
    const rx = cx - q.p.x, rz = cz - q.p.z, d = hypot(rx, rz);
    // (déjà dans le rond : il en sort vite, en visant plus loin que son bord, sans ralentir avant d'en être sorti)
    const dedans = hypot(j.p.x - q.p.x, j.p.z - q.p.z) < ANNEAU;
    if (d < ANNEAU || (dedans && d < ANNEAU + 2)) {
      if (dedans) vmax = Math.max(vmax, 7);
      const r0 = dedans ? ANNEAU + 2 : ANNEAU;
      const ux = d > 0.3 ? rx / d : (j.p.x - q.p.x) / (hypot(j.p.x - q.p.x, j.p.z - q.p.z) || 1), uz = d > 0.3 ? rz / d : (j.p.z - q.p.z) / (hypot(j.p.x - q.p.x, j.p.z - q.p.z) || 1);
      cx = q.p.x + ux * r0; cz = q.p.z + uz * r0;
      // (contre un panneau ou une ligne de but, le rond se contourne de côté)
      if (Math.abs(cz) > BZ - 1 || Math.abs(cx) > BX - 1) {
        const sx = (j.p.x >= q.p.x ? 1 : -1) * (Math.abs(q.p.x) > BX - ANNEAU - 1 ? -Math.sign(q.p.x) * (j.p.x >= q.p.x ? 1 : -1) : 1);
        cx = q.p.x + sx * r0; cz = q.p.z;
      }
    }
  }
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
  if (p && p.e !== j.e && j.essai <= 0) tacleIA(m, j, it, p);
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
 * (lot B) Le rond de la balle : sans rôle sur elle, on reste à 7 m (la distance de soutien du futsal, à l'échelle du
 * terrain de 30 × 20 m). Réglé au banc (reprise du lot B) : à 6 m, 3,26 joueurs de champ à moins de 5 m de la balle
 * et trois d'une même équipe 31 % du temps ; à 7 m, avec la couverture et la ligne à 6 m et le repli élargi, 2,86 et
 * 21 % (avant le lot B : 3,11 et 19 %).
 */
const ANNEAU = 7.0;

/**
 * (bola-app#32, lot B ; point 15 : « l'IA tacle à bon escient ») Le tacle de l'IA sur le porteur d'en face, à moins de
 * 2,4 m : pas de tacles en série (le tacleur attend 2,5 s après un glissé, 0,7 s après un tacle debout ; son équipe 0,7 s
 * entre deux tentatives) ; le porteur de face → la récupération au pied (tacle debout), jamais le glissé ; le glissé
 * seulement de côté ou de dos, la balle à 1,2-2,2 m, et jamais dans sa propre surface (le coup franc y serait trop cher).
 * La part de hasard est celle d'avant (le flux « ia »), sur ces seules situations.
 */
function tacleIA(m, j, it, p) {
  const b = m.balle, rng = m.rng.ia;
  const d = hypot(p.p.x - j.p.x, p.p.z - j.p.z);
  if (d >= 2.4) return;
  const T = (m._tacleT ??= [-9, -9]);
  if (m.t - T[j.e] < 0.7) return;
  const db = hypot(b.p.x - j.p.x, b.p.z - j.p.z);
  // (correctifs #26) un porteur coincé dans un coin, presque à l'arrêt : on va au contact franchement
  const coince = hypot(p.v.x, p.v.z) < 1.2 && (Math.abs(p.p.x) > BX - 2.5 || Math.abs(p.p.z) > LB - 0.5) && Math.abs(p.p.z) > LB - 3;
  const ch = (m.controle[p.e] === p.i ? 0.3 : 0.2) * (coince ? 2.5 : 1);
  // le tacle debout : la balle devant lui, pas derrière les jambes du porteur
  const devant = (b.p.x - j.p.x) * sin(j.cap) + (b.p.z - j.p.z) * cos(j.cap) > 0.3;
  // la course (ou le cap) du porteur, et d'où vient le défenseur : de face, de côté, de dos
  const s = hypot(p.v.x, p.v.z), fx = s > 0.8 ? p.v.x / s : sin(p.cap), fz = s > 0.8 ? p.v.z / s : cos(p.cap);
  const vers = ((j.p.x - p.p.x) * fx + (j.p.z - p.p.z) * fz) / (d || 1);
  const deFace = vers > 0.5, derriere = vers < -0.35;
  const surface = hypot(p.p.x, p.p.z - butDe(j.e)) < 7;
  // (une balle protégée derrière le porteur : le tacle debout passe par ses jambes et le déséquilibre)
  // (lot B : la récupération au pied seulement quand la balle est entre lui et le porteur, plus près de lui que le
  // porteur ; de face, il la tente plus volontiers ; la balle derrière les jambes du porteur, presque jamais)
  const entre = db < d - 0.1;
  const debout = db < 1.1 && devant && entre, jambes = db < 1.1 && d < 0.8 && !entre, glisse = !deFace && !surface && db < 2.2 && db > 1.2;
  // (lot B : le délai de 0,7 s ne court qu'après une vraie occasion ; avant, il partait dès 2,4 m et le porteur lancé
  // passait avant la suivante)
  if (debout || jambes || glisse || d < 1.0) j.essai = 0.7;
  if (debout && rng.u() < ch * (deFace ? 2 : 1.2)) { it.action = { type: 'tacle', glisse: false }; T[j.e] = m.t; }
  else if (jambes && rng.u() < ch * 0.12) { it.action = { type: 'tacle', glisse: false }; T[j.e] = m.t; }
  // (bola-app#26 : le vrai tacle glissé porte plus loin, pieds devant ; lot B : jamais de face, ni dans sa surface)
  else if (glisse && rng.u() < ch * 0.3) { it.action = { type: 'tacle', glisse: true }; T[j.e] = m.t; j.essai = 2.5; }
  else if (d < 1.0 && rng.u() < 0.3) it.charge = true;
  // (bola-app#26, lot 2) collé dans le dos du porteur, la balle hors d'atteinte : il le tient par le maillot
  if (!it.action && derriere && d < 0.95 && !devant && m.rng.duels.u() < 0.14) j.tireJusque = m.t + 0.45 + m.rng.duels.u() * 0.7;
}

/**
 * (bola-app#32, lot B) Le bloc de zone de l'équipe e quand elle défend, une fois par pas : quatre places en losange qui
 * coulissent avec la balle (haut : sur la ligne balle → but, au plus haut du bloc ; couverture côté balle, 3 m plus bas ;
 * côté faible, à 3,2 m de l'axe de la balle ; bas : le dernier, devant le but), à la hauteur du plan (sim/tactique.js),
 * resserrées dans la largeur du plan. Le joueur côté faible prend l'attaquant qui entre dans sa zone (côté but). Les
 * joueurs de l'IA qui n'ont pas de rôle (presseur, couvreur, ligne, second presseur : rolesDefense) prennent les places
 * restantes, au plus court ; le gardien adverse qui tient la balle n'est pas pressé.
 */
// (correctifs #32, D9 du contrôle du code : les tampons du bloc sont gardés d'un pas à l'autre — places, postes, files —
// au lieu d'être recréés à chaque pas de 1/120 s pour les deux équipes)
function blocVide() {
  const pl = () => ({ nom: '', x: 0, z: 0 });
  return { pas: -1, poste: new Array(16).fill(null), de: new Array(16).fill(null), deAvant: new Array(16).fill(null), pl: [pl(), pl(), pl(), pl()], places: null, pris: new Set(), occupe: new Set(), libres: [], restes: [], ordre: [] };
}
function defenseEquipe(m, e, p, notre) {
  m._bloc ??= [blocVide(), blocVide()];
  const D = m._bloc[e];
  if (D.pas === m.pas) return D;
  D.pas = m.pas;
  const b = m.balle, plan = planDe(m, e);
  const q = p ?? (b.garde != null ? m.joueurs[b.garde] : null);
  const xB = q ? q.p.x : b.p.x, aB = av(e, q ? q.p.z : b.p.z);
  const s = xB > 0.8 ? 1 : xB < -0.8 ? -1 : (D.s ?? 1);
  D.s = s;
  const L = plan.largeur / 2;
  const aHaut = Math.min(aB - 1.8, plan.haut);
  const tH = clamp((aB - aHaut) / (aB + LB || 1), 0.05, 0.95);
  const zg = butDe(e);
  // (correctifs #32, D9 du contrôle du jeu : en bloc bas, tant que la balle n'a pas passé le milieu, la couverture et le
  // côté faible restent sous −8 m ; seul le haut du bloc attend le porteur ; avant, bloc bas et équilibre ne différaient que
  // de 0,9 m en hauteur moyenne)
  const plafond = plan.id === 'blocBas' && aB > -2 ? -8 : Infinity;
  const places = D.pl;
  const poser = (P, nom, x, z) => { P.nom = nom; P.x = x; P.z = z; };
  poser(places[0], 'haut', xB + (0 - xB) * tH, zDe(e, aHaut));
  poser(places[1], 'couverture', clamp(xB * 0.55, xB - L, xB + L), zDe(e, Math.max(-13, Math.min(aB - 5.5, aHaut - 3, plafond))));
  poser(places[2], 'faible', clamp(xB * 0.25 - s * 3.2, xB - L, xB + L), zDe(e, Math.max(-13, Math.min(aB - 5, aHaut - 3.5, plafond))));
  poser(places[3], 'bas', clamp(xB * 0.2, -3, 3), zDe(e, Math.max(-13, Math.min(aB - 7.5, plan.bas))));
  // (la zone côté faible : un attaquant qui y entre, plus bas qu'elle, est pris côté but)
  const F = places[2];
  let menace = null, am = Infinity;
  for (const o of m.joueurs) {
    if (o.absent || o.e === e || o.gardien || o === q) continue;
    const ao = av(e, o.p.z);
    // (en pressing haut, il ne descend pas sous le dernier défenseur : le pivot adverse resté au fond est à celui-ci)
    if (o.p.x * s < 1 && ao < av(e, F.z) + 2 && ao < am && (plan.id !== 'pressing' || ao > plan.bas - 1)) { am = ao; menace = o; }
  }
  if (menace) { F.x = menace.p.x * 0.75; F.z = menace.p.z + (zg - menace.p.z) * 0.12; }
  D.places = places;
  // qui prend quoi : les rôles d'abord (balle en jeu), puis les places libres au plus court
  const humain = m.controle[e];
  const pris = D.pris, libres = D.libres;
  pris.clear(); libres.length = 0;
  D.poste.fill(null);
  const estIA = (o) => o.e === e && !o.gardien && !o.absent && o.i !== humain;
  if (b.garde == null && notre !== true) {
    const R = rolesDefense(m, e, p, notre);
    if (R.chasseur != null) pris.add('haut');
    if (R.couvreur != null && notre === false) pris.add('couverture');
    if (R.double != null) pris.add('haut');
    for (const o of m.joueurs) if (estIA(o) && o.i !== R.chasseur && !(o.i === R.couvreur && notre === false) && o.i !== R.double && !(o.i === R.ligne && notre === false)) libres.push(o);
    // (celui qui coupe la ligne de passe tient la place la plus proche de son point)
    if (R.ligne != null && notre === false && R.lane) {
      let bk = null, bd = Infinity;
      for (const P of places) { if (pris.has(P.nom)) continue; const dd = hypot(P.x - R.lane.x, P.z - R.lane.z); if (dd < bd) { bd = dd; bk = P.nom; } }
      if (bk) pris.add(bk);
    }
  } else for (const o of m.joueurs) if (estIA(o)) libres.push(o);
  const restes = D.restes;
  restes.length = 0;
  for (const P of places) if (!pris.has(P.nom)) restes.push(P);
  // (au plus court, une place chacun ; celui qui la tenait déjà garde 1,5 m d'avance : pas de va-et-vient)
  const avant = D.de;
  D.de = D.deAvant; D.deAvant = avant;
  D.de.fill(null);
  const ordre = D.ordre;
  ordre.length = 0;
  for (const o of libres) ordre.push(o);
  ordre.sort((a, c) => a.i - c.i);
  const occupe = D.occupe;
  occupe.clear();
  for (let n = 0; n < ordre.length; n++) {
    let best = null, bj = null, bd = Infinity;
    for (const o of ordre) {
      if (D.de[o.i]) continue;
      for (const P of restes) {
        if (occupe.has(P.nom)) continue;
        const dd = hypot(P.x - o.p.x, P.z - o.p.z) - (avant[o.i] === P.nom ? 1.5 : 0);
        if (dd < bd) { bd = dd; best = P; bj = o; }
      }
    }
    if (!best) break;
    occupe.add(best.nom); D.de[bj.i] = best.nom; D.poste[bj.i] = best;
  }
  // (sans place libre, il double la couverture, côté faible)
  for (const o of ordre) if (!D.poste[o.i]) D.poste[o.i] = places[2];
  return D;
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
 * (bola-app#32, lot A) Au-devant de la passe : le premier point de la course prédite de la balle au sol (roulement
 * JEU.passeRoule) que le receveur atteint avant elle, en 0,05 à 2,5 s ; une balle en l'air : son point de chute à
 * hauteur de tête (rdv). null si la balle ne roule plus vers lui.
 */
export function auDevant(m, j) {
  const b = m.balle;
  if (b.garde != null) return null;
  if (b.p.y > 0.6 || b.v.y > 2) return rdv(m, j);
  const v = hypot(b.v.x, b.v.z);
  if (v < 0.6) return { x: b.p.x, z: b.p.z };
  const ux = b.v.x / v, uz = b.v.z / v, a = JEU.passeRoule;
  let x = b.p.x, z = b.p.z;
  for (let t = 0.05; t <= 2.5; t += 0.05) {
    const vt = Math.max(0, v - a * t), dist = (v * v - vt * vt) / (2 * a);
    x = clamp(b.p.x + ux * dist, -BX + 0.4, BX - 0.4); z = clamp(b.p.z + uz * dist, -BZ + 0.4, BZ - 0.4);
    if (tempsArrivee(j, x, z) <= t || vt === 0) break;
  }
  return { x, z };
}

/**
 * (bola-app#32, lot B) Couper une passe adverse au sol : le premier point de sa course (roulement JEU.passeRoule) que le
 * défenseur atteint 0,15 s avant elle, avant les deux derniers mètres (le receveur la contrôle) ; null s'il n'y en a pas.
 */
function couper(m, j) {
  const b = m.balle, R2 = m.joueurs[b.recepteur];
  if (b.p.y > 0.6 || b.v.y > 2) return null;
  const v = hypot(b.v.x, b.v.z);
  if (v < 1) return null;
  const ux = b.v.x / v, uz = b.v.z / v, a = JEU.passeRoule;
  const dR = hypot(R2.p.x - b.p.x, R2.p.z - b.p.z);
  for (let t = 0.05; t <= 2; t += 0.05) {
    const vt = Math.max(0, v - a * t), dist = (v * v - vt * vt) / (2 * a);
    if (dist > dR - 2 || vt === 0) break;
    const x = b.p.x + ux * dist, z = b.p.z + uz * dist;
    if (tempsArrivee(j, x, z) <= t - 0.15) return { x, z };
  }
  return null;
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
  // (bola-app#32, lot A : le passeur court plus vite ; la remise vise où il sera quand elle arrive, et non 0,5 s devant)
  let t = 0.5, xx = X.p.x + X.v.x * t, xz = X.p.z + X.v.z * t;
  for (let k = 0; k < 3; k++) { const dd = hypot(xx - b.p.x, xz - b.p.z); t = clamp(dd / 6.5, 0.4, 1.3); xx = X.p.x + X.v.x * t; xz = X.p.z + X.v.z * t; }
  const aHauteur = (xz - j.p.z) * sens(j.e) > (unTouche ? -2.5 : -1.0);
  if (!aHauteur || !couloirLibre(m, j.e, b.p.x, b.p.z, xx, xz, 1.0)) {
    // (le mur attend : balle au pied, il ne file pas vers le but, il temporise)
    if (!unTouche) { it.allure = Math.min(it.allure, 0.25); it.sprint = 0; }
    return false;
  }
  // (la remise part devant le passeur lancé, assez forte pour qu'il la reprenne dans sa course : 5,5 m/s à l'arrivée)
  const d = hypot(xx - b.p.x, xz - b.p.z), v0 = Math.sqrt(5.5 * 5.5 + 2 * 1.35 * d);
  it.action = { type: 'passe', p: clamp((v0 - 6) / 12, 0.2, 1), v0, cible: X.i, dx: xx - j.p.x, dz: xz - j.p.z };
  X.uneDeux = null; j.remiseOui = false; j.decision = 0.5;
  return true;
}

/**
 * Le porteur de l'IA : il conduit vers le but en évitant le plus proche (ou protège), joue la remise du une-deux, et,
 * toutes les 0,16 à 0,38 s (plus vite sous pression), choisit (bola-app#32, lot B : decider) entre frappe, passe (au
 * sol, profondeur, lobée, puissante, centre), conduite et dribble, sur des critères — plus de tirage au sort nu.
 */
function porteurIA(m, j, it) {
  const rng = m.rng.ia;
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
  // (bola-app#26, lot 2) la remise du une-deux, en deux touches (en une, elle part avant le contrôle : pasIA)
  const r = remise(m, j, it, false);
  if (r !== null) return;
  // (lot B) le tireur d'un coup franc a levé la tête pendant que la balle était posée : il la joue de là, sans la
  // conduire d'abord (la balle qui quitte son point lève la garde des 3 m, monde.js tenirEcart, et l'adversaire la
  // reprenait avant qu'il l'ait jouée)
  const tireur = !!m.ecart && m.ecart.e !== j.e && m.ecart.tireur === j.i;
  if (tireur) { it.dx = 0; it.dz = 0; it.allure = 0; it.protege = false; j.porteurT = -9; }
  // (lot B) le temps de lever la tête : 0,3 s après la prise de balle (0,12 s sous pression), avant le premier choix
  if (m.t - (j.porteurVu ?? -9) > 0.1 && !tireur) j.porteurT = m.t;
  j.porteurVu = m.t;
  if (m.t - j.porteurT < (dp < 2.2 ? 0.12 : 0.3)) return;
  if (j.decision > 0) return;
  j.decision = (dp < 2.4 ? 0.16 : 0.26) + rng.u() * 0.12;
  decider(m, j, it, proche, dp, coin);
}

/** (lot B) L'espace devant le porteur j vers le but : le premier adversaire de champ dans un cône de 40° (8 m au plus). */
function espaceDevant(m, j, ux, uz) {
  let d0 = 8;
  for (const o of m.joueurs) {
    if (o.absent || o.e === j.e || o.mode === 'sol') continue;
    const rx = o.p.x - j.p.x, rz = o.p.z - j.p.z, d = hypot(rx, rz);
    if (d < 1e-6 || d > d0) continue;
    if ((rx * ux + rz * uz) / d > 0.77) d0 = d;
  }
  return d0;
}

/**
 * (bola-app#32, lot B) Le choix du porteur de l'IA, sur des critères :
 *   · frappe : la chance de but (sim/tactique.js chanceBut : angle, distance, corps sur la ligne), moins sous pression ;
 *     tirée si elle passe le seuil du style (direct plus tôt que court ; perdant en fin de match, plus tôt encore) ;
 *     le geste suit la situation : piqué sur un gardien sorti, enroulée d'un angle, frappe à ras de terre de près ;
 *   · passe à chaque coéquipier : progression, chance de but du receveur, démarquage, couloir libre, longueur ; le type
 *     suit la situation : profondeur dans la course d'un receveur lancé avec de l'espace devant lui, par-dessus
 *     (profondeur lobée, passe lobée) si le couloir est fermé, puissante de loin en jeu direct, centre (tendu, ou lobé si
 *     des corps sont sur la ligne) d'un côté vers un receveur dans l'axe près du but ; pas de ping-pong ;
 *   · conduite : l'espace devant lui ; dribble (crochet ; feinte arrêté) : un seul défenseur de face, de 1,1 à 2,6 m.
 * La variété vient d'un bruit borné (0 à 0,12) tiré dans le flux « ia », ajouté à chaque note : jamais d'un tirage nu.
 */
function decider(m, j, it, proche, dp, coin) {
  const rng = m.rng.ia, col = m.rng.collectif, e = j.e, zb = butDe(1 - e), s = sens(e);
  const T = styleDe(m, e);
  const aJ = av(e, j.p.z);
  const presse = clamp((2.6 - dp) / 1.6, 0, 1);
  const perdTard = m.score[e] < m.score[1 - e] && m.reste < m.duree * 0.2;
  // (correctifs #26) pas de frappe de derrière la ligne ni d'un angle fermé : il remet en retrait
  const ferme = (j.p.z - zb) * Math.sign(zb) > -0.3 || Math.abs(j.p.x) > BUT_DL + 2.2 * Math.abs(zb - j.p.z);
  const xg = ferme ? 0 : chanceBut(m, e, j.p.x, j.p.z) * (1 - 0.35 * presse);
  // (la patience : plus la possession dure, plus la frappe se tente ; à 4 s, le seuil baisse d'un tiers, à 7 s de moitié)
  const P = m.possession, dure = P && P.e === e ? m.t - P.t : 0;
  const seuil = T.seuilFrappe * (perdTard ? 0.65 : 1) * (dure > 7 ? 0.5 : dure > 4 ? 0.67 : 1);
  const bruit = () => rng.u() * 0.12;
  const coupFranc = !!m.ecart && m.ecart.e !== e;
  let best = { k: 'conduite', v: -Infinity };
  // la frappe
  // (au-dessus du seuil, elle passe avant presque tout ; en dessous, de 0,03 à lui, elle se compare aux autres choix)
  if (xg >= seuil) best = { k: 'frappe', v: 0.7 + xg * 2 + bruit() };
  else if (xg >= 0.03) best = { k: 'frappe', v: 0.15 + xg * 4.5 + bruit() };
  // les passes
  const der = m.passes[m.passes.length - 1];
  for (const o of m.joueurs) {
    if (o.absent || o.e !== e || o === j || o.gardien || o.mode === 'sol') continue;
    const ox = o.p.x - j.p.x, oz = o.p.z - j.p.z, d = hypot(ox, oz);
    if (d < 4) continue;
    let libreO = 9;
    for (const a of m.joueurs) if (!a.absent && a.e !== e && !a.gardien) libreO = Math.min(libreO, hypot(a.p.x - o.p.x, a.p.z - o.p.z));
    const ouvert = couloirLibre(m, e, j.p.x, j.p.z, o.p.x, o.p.z, 1.0);
    const dA = av(e, o.p.z) - aJ;
    const xgO = chanceBut(m, e, o.p.x, o.p.z);
    let v = clamp(dA, -8, 10) * 0.05 * T.progression + xgO * 2.5 + 0.11 * Math.min(libreO, 4) + presse * 0.25 + T.garder;
    if (d > 13) v -= (d - 13) * 0.06 * T.longue;
    if (libreO < 1.3) v -= 0.5;
    // (le coup franc : les adversaires tenus à 3 m, la passe sûre d'abord, au pied d'un coéquipier libre)
    if (coupFranc) v += ouvert && libreO > 2.2 ? 0.5 : -0.6;
    // (pas de ping-pong : on ne la rend pas tout de suite à celui qui vient de la donner, sauf le une-deux)
    if (der && der.de === o.i && der.a === j.i && m.t - der.t < 2.5 && !o.uneDeux) v -= 0.2;
    const avance = o.v.z * s;
    let k = null;
    if (ouvert) {
      if (avance > 2.5 && dA > 1 && espaceDevant(m, o, 0, s) > 3) k = { k: 'profondeur', v: v + 0.25 * T.profondeur };
      else k = { k: 'passe', v, puissante: d > 11 && T.id === 'direct' };
    } else if (!coupFranc && d > 8 && libreO > 3.5 && (dA > 2 ? o.prof && m.t < o.prof.t : d > 10)) k = { k: dA > 2 ? 'profondeurLobee' : 'lob', v: v - 0.5 };
    // le centre : d'un côté, près du but, vers un receveur dans l'axe
    if (Math.abs(j.p.x) > 3.8 && Math.abs(zb - j.p.z) < 10 && Math.abs(o.p.x) < 3.4 && Math.abs(zb - o.p.z) < 8.5 && d > 4 && libreO > 1.5) {
      const c = { k: 'centre', v: v + xgO - (ouvert ? 0 : 0.2), haut: !ouvert, tendu: ouvert && d < 9 };
      if (!k || c.v > k.v) k = c;
    }
    if (!k) continue;
    k.v += bruit(); k.o = o; k.d = d;
    if (k.v > best.v) best = k;
  }
  // la conduite et le dribble
  const ux = -j.p.x * 0.15, L0 = hypot(ux, s) || 1;
  const esp = espaceDevant(m, j, ux / L0, s / L0);
  const vConduite = 0.08 * Math.min(esp, 6) + (aJ < 4 ? 0.05 : esp > 3 ? 0.12 : 0) - presse * 0.5 - (coin ? 1 : 0) - (Math.abs(j.p.x) > BX - 1.6 ? 0.3 : 0) + bruit();
  if (vConduite > best.v) best = { k: 'conduite', v: vConduite };
  if (proche && !proche.gardien && dp > 1.1 && dp < 2.6 && hypot(j.v.x, j.v.z) > 1 && m.t - (j.dribbleT ?? -9) > 2.5 && aJ > -8) {
    const rx = proche.p.x - j.p.x, rz = proche.p.z - j.p.z;
    const deFace = (rx * sin(j.cap) + rz * cos(j.cap)) / dp > 0.6;
    let seul = true;
    for (const o of m.joueurs) if (o !== proche && !o.absent && o.e !== e && !o.gardien && hypot(o.p.x - proche.p.x, o.p.z - proche.p.z) < 3) seul = false;
    if (deFace && seul) { const vD = 0.34 + 0.1 * Math.min(esp, 3) / 3 + bruit(); if (vD > best.v) best = { k: 'dribble', v: vD, o: proche }; }
  }
  if (best.k === 'conduite') return;
  if (best.k === 'frappe') { frapperIA(m, j, it, xg); return; }
  if (best.k === 'dribble') {
    // (le crochet de l'autre côté du défenseur, vers le but ; arrêté : la feinte de corps)
    const o = best.o, rx = o.p.x - j.p.x, rz = o.p.z - j.p.z, L = hypot(rx, rz) || 1;
    let dx = -rz / L, dz = rx / L;
    if (Math.abs(j.p.x) > 1 ? dx * -j.p.x < 0 : col.u() < 0.5) { dx = -dx; dz = -dz; }
    j.dribbleT = m.t;
    it.action = hypot(j.v.x, j.v.z) > 2.2 ? { type: 'crochet', dx, dz } : { type: 'feinte', dx, dz };
    m.stats.dribblesIA = (m.stats.dribblesIA ?? 0) + 1; compter(m, it.action.type);
    return;
  }
  const o = best.o, d = best.d;
  // la force qu'il faut pour que la passe arrive à 9 m/s (bola-app#32, lot A : la vitesse donnée telle quelle, v0) ;
  // la passe puissante, 25 % de plus
  const v0 = Math.sqrt(JEU.passeArrivee * JEU.passeArrivee + 2 * JEU.passeRoule * d) * (best.puissante ? 1.25 : 1);
  const base = { p: clamp((v0 - 6) / 12, 0.05, 1), v0, cible: o.i, dx: o.p.x - j.p.x, dz: o.p.z - j.p.z };
  if (best.k === 'profondeur') it.action = { type: 'profondeur', ...base };
  else if (best.k === 'profondeurLobee') it.action = { type: 'profondeur', lobe: true, ...base };
  else if (best.k === 'lob') it.action = { type: 'lob', haut: d > 12, ...base };
  else if (best.k === 'centre') it.action = { type: 'centre', haut: !!best.haut, tendu: !!best.tendu, ...base, p: 0.9 };
  else it.action = { type: 'passe', puissante: !!best.puissante, ...base };
  compter(m, it.action.type + (it.action.lobe ? 'Lobee' : it.action.puissante ? 'Puissante' : it.action.haut ? 'Haut' : it.action.tendu ? 'Tendu' : ''));
  // (bola-app#26, lot 2) le une-deux : après une passe courte, le passeur repart dans l'espace, devant, du côté opposé
  // au défenseur le plus proche, pour la redemander (lot B : voulu quand un défenseur le presse de face)
  if (it.action.type === 'passe' && j.poste !== 'fixo' && d < 10 && aJ > -6 && col.u() < (dp < 2.6 ? 0.7 : 0.35)) {
    const lat = proche ? Math.sign(j.p.x - proche.p.x || 1) : 1;
    j.uneDeux = { t: m.t, cible: o.i, x: clamp(j.p.x + lat * 1.6, -BX + 1.2, BX - 1.2), z: clamp(j.p.z + s * 5.5, -LB + 2, LB - 2) };
  }
}

/**
 * (lot B) La frappe de l'IA : vers le côté que le gardien couvre le moins (trois fois sur quatre) ; le geste suit la
 * situation : piqué (L1 + ○) sur un gardien sorti de plus de 2,4 m, de 5 à 12 m ; enroulée (R1 + ○) d'un angle (à plus
 * de 2,2 m de l'axe, de 5,5 à 12 m), vers le second poteau ; à ras de terre (R2 + ○) de près (moins de 8 m) une fois
 * sur deux ; sinon la frappe du cou-de-pied, à mi-hauteur.
 */
function frapperIA(m, j, it, xg) {
  const rng = m.rng.ia, zb = butDe(1 - j.e);
  const g = m.joueurs.find((o) => o.gardien && o.e !== j.e);
  const dBut = hypot(j.p.x, zb - j.p.z);
  const cote = g ? (g.p.x > 0 ? -1 : 1) : rng.u() < 0.5 ? -1 : 1;
  const x = (rng.u() < 0.75 ? cote : -cote) * (0.6 + rng.u() * (BUT_DL - 0.95));
  const sorti = g && Math.abs(g.p.z - zb) > 2.4;
  let a;
  if (sorti && dBut > 5 && dBut < 12) a = { type: 'lobFrappe', p: 0.45, x: x * 0.6 };
  else if (Math.abs(j.p.x) > 2.2 && dBut > 5.5 && dBut < 12) a = { type: 'finesse', p: 0.5 + rng.u() * 0.3, x: -Math.sign(j.p.x) * (0.7 + rng.u() * 0.6), y: 0.5 + rng.u() * 0.8 };
  else if (dBut < 8 && rng.u() < 0.5) a = { type: 'frappe', ras: true, p: 0.8, x, y: 0.15 };
  else a = { type: 'frappe', p: 0.45 + rng.u() * 0.4, x, y: 0.3 + rng.u() * 1.1 };
  it.action = a;
  compter(m, a.type + (a.ras ? 'Ras' : ''));
  void xg;
}

/** (lot B) Les choix du porteur de l'IA, comptés pour le banc (m.choixIA, hors de m.stats : rien n'y est sommé). */
function compter(m, cle) { m.choixIA ??= {}; m.choixIA[cle] = (m.choixIA[cle] ?? 0) + 1; }

/**
 * Les rôles de la défense de l'équipe e, calculés une fois par pas : le chasseur (le premier à la balle), le couvreur
 * (entre la balle et le but, à une marge qui grandit avec la vitesse du porteur), celui qui coupe la ligne de passe la
 * plus dangereuse, et, sur un déclencheur (mauvais contrôle, porteur dos au but, porteur contre un panneau), le second
 * presseur qui ferme le côté du milieu.
 * (bola-app#32, lot B) Le plan de l'équipe (sim/tactique.js) règle la sortie du chasseur : hors de sa zone de sortie, et
 * sans déclencheur, contre-pressing ni porteur sur lui, il attend en haut du bloc (R.attente), et le couvreur se règle
 * sur ce point ; le second presseur sort sur tout déclencheur en pressing haut (et sur une passe en retrait), seulement
 * près du but en bloc bas ; la ligne de passe est coupée à mi-chemin en pressing, plus près du receveur en bloc bas.
 */
function rolesDefense(m, e, p, notre) {
  m._roles ??= [{ pas: -1 }, { pas: -1 }];
  const R = m._roles[e];
  if (R.pas === m.pas) return R;
  R.pas = m.pas;
  const b = m.balle, plan = planDe(m, e);
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
  // (lot B : celui qui presse déjà garde le rôle, sauf si un autre arrive 0,4 s avant lui : pas de relais à chaque pas)
  let premier = ia[0] ?? null;
  const ancien = R.chasseur != null ? ia.find((o) => o.i === R.chasseur) : null;
  if (ancien && premier && ancien !== premier && tb(ancien) < tb(premier) + 0.4) premier = ancien;
  R.chasseur = prochain ?? (seul ? null : premier?.i ?? null);
  let reste = ia.filter((o) => o.i !== R.chasseur);
  const avant0 = { couvreur: R.couvreur, ligne: R.ligne, double: R.double };
  R.couvreur = null; R.ligne = null; R.double = null; R.attente = null;
  // (le plus près du point ; celui qui tenait déjà ce rôle garde 1,5 m d'avance : les rôles ne sautent pas d'un joueur à
  // l'autre à chaque pas)
  const avant = avant0;
  const plusPres = (pt, role) => { let best = null, bd = Infinity; for (const o of reste) { const d = hypot(o.p.x - pt.x, o.p.z - pt.z) - (o.i === avant[role] ? 1.5 : 0); if (d < bd) { bd = d; best = o; } } return best; };
  const zb = butDe(e);
  if (notre === false && p) {
    const aB = av(e, p.p.z);
    // le déclencheur du pressing à deux
    const dos = cos(p.cap) * sens(p.e) < -0.4;
    const panneau = Math.abs(p.p.x) > BX - 1.5 || Math.abs(p.p.z) > BZ - 2;
    const rate = (p.controleQ ?? 1) < 0.55 && m.t - (p.controleT ?? -9) < 1;
    // (lot B) une passe en retrait vient d'arriver au porteur (pressing haut : le signal de la sortie)
    const der = m.passes[m.passes.length - 1];
    const retrait = !!der && der.a === p.i && m.t - der.t < 1.5 && av(p.e, m.joueurs[der.de].p.z) > av(p.e, p.p.z) + 2;
    const declencheur = dos || panneau || rate || (plan.double === 'toujours' && retrait);
    // (lot B) la sortie du presseur : dans sa zone (le plan), sur un déclencheur, au contre-pressing, ou si le porteur
    // est déjà sur lui ; sinon il attend en haut du bloc
    const P = m.possession, contre = P && m.t - P.perte[e] < plan.contre;
    const c0 = R.chasseur != null ? m.joueurs[R.chasseur] : null;
    // (en bloc bas, au-dessus du haut du bloc, le porteur sur lui ne le fait pas sortir : il recule avec lui)
    const surLui = c0 && hypot(c0.p.x - p.p.x, c0.p.z - p.p.z) < 2.6 && (plan.id !== 'blocBas' || aB < plan.haut + 2);
    const tirable = chanceBut(m, p.e, p.p.x, p.p.z) > 0.07;
    // (un déclencheur ne fait sortir le presseur que près de sa zone : partout en pressing haut, 4 m au-delà de la ligne
    // de sortie en équilibre, au haut du bloc en bloc bas)
    const portee = plan.id === 'pressing' ? 99 : plan.id === 'equilibre' ? plan.sortie + 4 : plan.haut;
    const sort = aB < plan.sortie || (declencheur && aB < portee) || contre || surLui || tirable || prochain != null;
    let px = b.p.x, pz = b.p.z;
    if (!sort && c0) {
      const aH = Math.min(aB - 3.5, plan.haut), t = clamp((aB - aH) / (aB + LB || 1), 0.05, 0.9);
      R.attente = { x: p.p.x + (0 - p.p.x) * t, z: p.p.z + (zb - p.p.z) * t };
      px = R.attente.x; pz = R.attente.z;
    }
    const sp = hypot(p.v.x, p.v.z), m0 = plan.id === 'pressing' ? 2.8 : 6.0, marge = clamp(m0 + 0.3 * sp, m0, m0 + 1.6);
    const ux = -px, uz = zb - pz, L = hypot(ux, uz) || 1;
    R.cov = { x: px + (ux / L) * marge, z: pz + (uz / L) * marge };
    const c = plusPres(R.cov, 'couvreur');
    R.couvreur = c?.i ?? null;
    reste = reste.filter((o) => o !== c);
    // la ligne de passe la plus dangereuse : le receveur le plus près de notre but, démarqué
    let q = null, dq = -Infinity;
    for (const o of m.joueurs) {
      if (o.absent || o.e === e || o.gardien || o === p) continue;
      // (hors du pressing haut, on ne suit pas un receveur au-dessus du haut du bloc : la zone le prendra s'il descend)
      if (plan.id !== 'pressing' && av(e, o.p.z) > plan.haut + 3) continue;
      const danger = 1 - hypot(o.p.x, o.p.z - zb) / 30 + (couloirLibre(m, o.e, p.p.x, p.p.z, o.p.x, o.p.z, 1.0) ? 0.4 : 0) - hypot(o.p.x - p.p.x, o.p.z - p.p.z) / 40 + (o.i === R.cible ? 0.15 : 0);
      if (danger > dq) { dq = danger; q = o; }
    }
    const double = declencheur && (plan.double !== 'surface' || aB < -8);
    if (double && sort && !seul && reste.length) {
      // le côté du milieu (perpendiculaire à la ligne porteur → but, vers x = 0)
      let nx = -(zb - p.p.z), nz = p.p.x - 0; const nl = hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      if (nx * -p.p.x < 0) { nx = -nx; nz = -nz; }
      R.ferme = { x: nx, z: nz };
      const d2 = plusPres({ x: p.p.x + nx, z: p.p.z + nz }, 'double');
      // (lot B : le piège à deux se referme avec celui qui est déjà là, à 6 m au plus ; personne ne traverse le terrain)
      if (d2 && hypot(d2.p.x - p.p.x, d2.p.z - p.p.z) < 6) { R.double = d2.i; reste = reste.filter((o) => o !== d2); }
    }
    if (q && reste.length) {
      // (hors du pressing haut, il se tient plus près du receveur que du porteur : à 6 m du porteur au moins, à
      // 0,8 m du receveur au plus près)
      const dq0 = hypot(q.p.x - p.p.x, q.p.z - p.p.z) || 1;
      const f = plan.id === 'pressing' ? plan.ligne : clamp(Math.max(plan.ligne, 6.0 / dq0), 0, Math.max(plan.ligne, 1 - 0.8 / dq0));
      R.lane = { x: p.p.x + (q.p.x - p.p.x) * f, z: p.p.z + (q.p.z - p.p.z) * f };
      R.ligne = plusPres(R.lane, 'ligne')?.i ?? null;
      R.cible = q.i;
    }
  } else R.couvreur = seul ? ia[0]?.i ?? null : ia[1]?.i ?? null;
  return R;
}

/**
 * L'attaque sans la balle (bola-app#26, lot 2) : le passeur d'un une-deux file vers son espace ; les autres font un appel
 * de balle vers l'espace libre le plus utile autour de leur poste (grille de 2 m, revue toutes les 0,25 s : loin des
 * adversaires, couloir de passe ouvert, vers le but, pas sur un coéquipier), au sprint quand le porteur relève la tête.
 * (bola-app#32, lot B) Autour du POSTE (sim/tactique.js), et non plus du rôle fixe : le fixo reste derrière la balle
 * (soutien, il ne cherche que de côté) ; aucun appel à moins de 4,5 m du porteur (la distance de soutien : la fin de la
 * ruée) ; le pivot ou l'ala côté faible part dans le dos du dernier défenseur quand le porteur peut la lui donner
 * (appelProfondeur), un seul à la fois ; en transition offensive, les appels se font au sprint.
 */
function attaque(m, j, it, cx, cz, vmax, p) {
  const U = j.uneDeux;
  if (U && m.t - U.t < 3 && b0(m).recepteur !== j.i) {
    // (arrivé à son espace, il ne s'arrête pas : il continue vers le but, la remise doit le trouver lancé)
    if (hypot(U.x - j.p.x, U.z - j.p.z) < 1.5) { U.z = clamp(U.z + sens(j.e) * 2.5, -LB + 2, LB - 2); }
    it.regard = m.balle.p; j.intention = 'uneDeux'; return { cx: U.x, cz: U.z, vmax: 6.6 };
  }
  if (U && m.t - U.t >= 3) j.uneDeux = null;
  const phase = phaseDe(m, j.e), poste = j.poste;
  // (lot B) le porteur sur un côté, près du but (là d'où il centre) : le pivot attaque le second poteau, l'ala côté
  // faible le point de pénalty ; ils vont au but, pas dans l'espace libre
  // (correctifs #32, D7 : seulement quand le porteur est vraiment en position de centrer, à moins de 7 m de la ligne de
  // but ; avant 10 m, et l'ala côté faible quittait sa largeur pour le point de pénalty dès le milieu de la moitié adverse)
  if ((poste === 'pivot' || poste === 'aileFaible') && p && p.e === j.e && Math.abs(p.p.x) > 3.8 && Math.abs(butDe(1 - j.e) - p.p.z) < 7) {
    const sc = Math.sign(p.p.x) || 1, a = poste === 'pivot' ? 12.5 : 10.3, x = -sc * (poste === 'pivot' ? 1 : 2.6);
    it.regard = m.balle.p; j.intention = poste === 'pivot' ? 'poteau' : 'penalty';
    return { cx: x, cz: zDe(j.e, a), vmax: 6.4 };
  }
  if ((poste === 'pivot' || poste === 'aileFaible') && p && p.e === j.e) {
    const P = appelProfondeur(m, j, p, phase);
    if (P) { it.regard = m.balle.p; j.intention = 'profondeur'; return { cx: P.x, cz: P.z, vmax: 7.0 }; }
  }
  // (correctifs #32, D7 du contrôle du jeu) les alas tiennent la largeur : leur appel reste dans le couloir de leur côté
  // (à 1 m près de leur poste vers l'axe) ; ce sont le fixo et le pivot qui viennent en soutien du porteur pressé ; une ala
  // marquée de près (à moins de 2,2 m) se démarque où elle peut
  const ala = (poste === 'aileBalle' || poste === 'aileFaible') && p && p.e === j.e && adversaireProche(m, j).d > 2.2;
  const a = appel(m, j, cx, cz, p, poste === 'fixo', ala);
  j.intention = poste === 'fixo' ? 'soutien' : poste === 'aileBalle' ? 'ecartement' : poste === 'pivot' ? 'pivot' : 'diagonale';
  if (!a) return { cx, cz, vmax };
  const tete = p && (hypot(p.v.x, p.v.z) < 3.5 || (p.decision ?? 1) < 0.2);
  // (le pas de course de l'appel : 5,4 m/s, l'allure propre du clip de course ; au sprint quand le porteur relève la
  // tête, et en transition offensive)
  return { cx: a.x, cz: a.z, vmax: phase === 'transOff' ? 7.0 : tete ? 6.2 : 5.4 };
}
const b0 = (m) => m.balle;

/**
 * (bola-app#32, lot B) L'appel en profondeur (la relation « près / loin » du futsal) : le porteur a la tête levée
 * (personne à moins de 2,6 m) ou l'équipe est en transition offensive ; il y a de l'espace dans le dos du dernier
 * défenseur (2,5 m derrière lui, hors de la surface du gardien : 12,3 m au plus) ; personne d'autre ne court déjà.
 * La course dure 1,6 s ; ensuite 2 s de repos. Le style règle sa fréquence (direct plus que court), tirée dans le flux
 * « collectif ».
 */
function appelProfondeur(m, j, p, phase) {
  if (j.prof && m.t < j.prof.t) return j.prof;
  if (j.prof) { j.prof = null; j.profRepos = m.t + 2; }
  if (m.t < (j.profRepos ?? -9)) return null;
  const e = j.e;
  const { d: dp } = adversaireProche(m, p);
  if (dp < 2.6 && phase !== 'transOff') return null;
  let aDer = -99;
  for (const o of m.joueurs) if (o.e !== e && !o.gardien && !o.absent && o.mode !== 'sol') aDer = Math.max(aDer, av(e, o.p.z));
  const cible = Math.min(12.3, aDer + 2.5), aJ = av(e, j.p.z);
  if (cible < aJ + 2 || cible < av(e, p.p.z) + 3) return null;
  for (const o of m.joueurs) if (o !== j && o.e === e && o.prof && m.t < o.prof.t) return null;
  j.profRepos = m.t + 0.6;
  if (m.rng.collectif.u() > 0.3 * styleDe(m, e).profondeur) return null;
  // (correctifs #32, D7 : une ala libre fait son appel dans son couloir ; le pivot, ou une ala marquée, vers l'axe)
  const x = (j.poste === 'aileBalle' || j.poste === 'aileFaible') && adversaireProche(m, j).d > 2.2 ? clamp(j.p.x, -6.5, 6.5) : clamp(j.p.x * 0.7, -6.5, 6.5);
  j.prof = { x, z: zDe(e, cible), t: m.t + 1.6 };
  m.stats.profondeurs = (m.stats.profondeurs ?? 0) + 1;
  m.ev('appel', { j: j.i, x, z: j.prof.z, profondeur: true });
  return j.prof;
}

function appel(m, j, cx0, cz0, p, fixo = false, largeur = false) {
  if (m.t < (j.appelT ?? -9) && j.appel) return j.appel;
  j.appelT = m.t + 0.25;
  const b = m.balle, s = sens(j.e), zg = butDe(1 - j.e);
  const ox = p ? p.p.x : b.p.x, oz = p ? p.p.z : b.p.z;
  const aB = av(j.e, oz);
  let best = null, bs = -Infinity;
  for (let ix = -2; ix <= 2; ix++) for (let iz = fixo ? 0 : -2; iz <= (fixo ? 0 : 2); iz++) {
    const x = clamp(cx0 + ix * 2, -BX + 1.2, BX - 1.2), z = clamp(cz0 + iz * 2, -LB + 1.5, LB - 1.5);
    // (le fixo reste derrière la balle : la passe en retrait, l'équilibre)
    if (fixo && av(j.e, z) > aB - 3.5) continue;
    // (une ala tient son couloir)
    if (largeur && (x * cx0 < 0 || Math.abs(x) < Math.abs(cx0) - 1)) continue;
    let dmin = 9, coupe = 0;
    for (const o of m.joueurs) {
      if (o.absent || o.e === j.e || o.mode === 'sol') continue;
      dmin = Math.min(dmin, hypot(o.p.x - x, o.p.z - z));
      if (!o.gardien && distSegment(o.p.x, o.p.z, ox, oz, x, z) < 1.2) coupe++;
    }
    let sc = Math.min(dmin, 4) * 0.9 - coupe * 1.2 + (fixo ? 0 : (z - cz0) * s * 0.18) - hypot(x - cx0, z - cz0) * 0.12;
    for (const o of m.joueurs) if (o !== j && !o.absent && o.e === j.e && !o.gardien) { const d = hypot(o.p.x - x, o.p.z - z); if (d < 3.5) sc -= (3.5 - d) * 0.6; }
    if (hypot(x, z - zg) < 2.5) sc -= 2;
    // (lot B) la distance de soutien : pas d'appel à moins de 4,5 m du porteur (avant : 2,5 m)
    const dpo = hypot(x - ox, z - oz);
    if (dpo < 4.5) sc -= (4.5 - dpo) * 0.7;
    if (sc > bs) { bs = sc; best = { x, z, sc }; }
  }
  if (!best) return null;
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
  // (bola-app#32, lot A) la balle aimantée suit le joueur : il n'a plus à courir après elle
  if (aimantee(m, j)) return;
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
