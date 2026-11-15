// Les contacts entre joueurs : corps contre corps, épaule contre épaule, déséquilibre, tacles debout et glissés
// (bola-app#23). Plus de « séparation » qui déplace les corps sans conséquence : les vitesses changent vraiment.
//
//   · corps : cylindres de 0,33 m (les épaules). Pour une paire qui se recouvre : correction de position au prorata
//     inverse des masses (95 % de la pénétration, 6 cm par pas et 4 cm par passe de démêlage au plus : jamais de saut ;
//     contre un panneau ou dans un coin, l'autre prend la part refusée), impulsion J = −(1 + e) v_rel·n / (1/m₁ + 1/m₂)
//     (e = 0,15) seulement s'ils se rapprochent, frottement tangent 0,3 J. Un joueur lancé dans un autre est freiné,
//     l'autre est poussé ; un choc fort déséquilibre.
//   · épaule : deux joueurs côte à côte, qui vont dans le même sens, dont un charge (bouton, ou l'IA qui va à la
//     balle). Le duel se gagne au moment m (v·n) + F dt (×1,3 pour qui protège la balle) ; le perdant prend du
//     déséquilibre et dérive de côté, le gagnant garde sa ligne.
//   · tacle glissé (bola-app#26) : le tacleur part au sol, couché sur le dos, pieds devant (clip « slide »), et
//     glisse de sa vitesse sur le gazon (4,5 m/s²) ; tant qu'il glisse hanches au sol (sous 0,25 m), ses deux pieds (table du clip)
//     balaient la balle et les jambes (0,22 m de rayon). Balle touchée d'abord : elle repart le long de la glissade.
//     Jambes du porteur d'abord : il tombe (balayé, ou croc-en-jambe par derrière). Les deux : la balle part et le
//     porteur est déséquilibré. De face, la balle passe presque toujours en premier ; par derrière, les jambes. Il se
//     relève du dos (getup_dos) dès que la glissade s'arrête : environ 2,3 s en tout.
//   · tacle debout : une extension de jambe (clip « shoot2 », rapide) de portée 0,9 m ; réussi si la balle est dans
//     le secteur, sinon un contact qui déséquilibre sans prendre la balle.
//   · le ballon contre les corps (balleCorps) : personne n'est traversé. Jambes et buste en capsules, corps couché ou qui
//     se relève ; la balle en ressort (e = 0,3, frottement 0,5), une frappe contrée n'est plus un tir ; un joueur debout
//     et libre qui la prend dans les jambes la contrôle (moins bien).
//   · (bola-app#26, lot 2) tirage de maillot : un défenseur collé dans le dos du porteur le tient (intention « tire »,
//     ou l'IA qui revient par derrière) : le porteur perd 15 % d'allure, les deux perdent de l'équilibre ; tenu plus de
//     0,8 s, c'est une faute. Protection : le porteur qui protège recule dans le défenseur collé dans son dos (poussée de
//     dos, 420 N) et le déséquilibre. Tacle debout : balle prise, balle contrée (les deux pieds dessus : elle gicle),
//     ou jambes. Fautes légères (JEU.fautes, règle à faire valider par Sabri) : des jambes touchées avant la balle sur
//     le porteur (tacle glissé, tacle debout qui le fait trébucher ou tomber) ou un tirage trop long ; l'arbitre laisse
//     l'avantage (monde.js, pasAvantage) : si l'équipe fautée garde ou reprend la balle dans les 2,5 s, le jeu continue,
//     sinon coup franc au point de la faute.
import { CORPS as C, BALLON, BALLE_CORPS as BC, BX, BZ, JEU, DUELS } from './constantes.js';
import { lancerGeste, tomber, trebucher, genreChute, piedA, hancheA, duree, versMonde, clamp, enrouler, libre } from './corps.js';
import { rouler, pasControle } from './gestes.js';
import { sortirBalle } from './ballon.js';
import { atan2, cos, hypot, sin } from './maths.js';

const t1 = { x: 0, y: 0, z: 0 }, t2 = { x: 0, y: 0, z: 0 };

/**
 * Applique un déséquilibre (et ses conséquences : trébucher, tomber). pousse : la direction où le corps est poussé
 * (x, z), qui choisit la chute (corps.js, genreChute) ; genre : une chute imposée (le balayage d'un tacle). Un
 * déséquilibre sous le seuil se voit aussi : le rendu joue le choc reçu (j.chocT, j.chocX, j.chocZ, j.chocF).
 */
export function desequilibrer(m, j, dd, pousse = null, genre = null) {
  if (j.mode === 'sol' || j.mode === 'releve' || dd <= 0) return;
  j.d += dd;
  if (pousse && dd > 0.08) { j.chocT = m.t; j.chocX = pousse.x; j.chocZ = pousse.z; j.chocF = Math.min(1, dd); }
  if (j.d >= C.chute) { const gc = genre ?? (pousse ? genreChute(j, pousse.x, pousse.z) : 'avant'); tomber(j, gc); m.ev('chute', { j: j.i, genre: gc }); }
  else if (j.d >= C.trebuche && j.mode === 'loco') { trebucher(j); m.ev('trebuche', { j: j.i }); }
}

/**
 * Une faute légère (bola-app#26, lot 2) de auteur sur victime : seulement si l'équipe de la victime avait la balle (le
 * porteur, ou une balle libre qu'elle a touchée en dernier à moins de 2 m de lui). L'arbitre regarde l'avantage
 * (monde.js) : la faute est notée avec son point, et le jeu continue. Renvoie vrai si la faute est notée.
 */
export function faute(m, auteur, victime, genre) {
  if (!JEU.fautes || auteur.e === victime.e || victime.gardien) return false;
  const b = m.balle;
  const aLaBalle = b.possesseur === victime.i
    || (b.possesseur == null && b.garde == null && b.dernier != null && m.joueurs[b.dernier].e === victime.e && hypot(b.p.x - victime.p.x, b.p.z - victime.p.z) < 2);
  if (!aLaBalle) return false;
  if (m.avantage || m.arret) return false; // (une faute à la fois : la suivante attend que celle-ci soit réglée)
  m.avantage = { e: victime.e, auteur: auteur.i, victime: victime.i, x: victime.p.x, z: victime.p.z, t0: m.t, genre };
  m.stats.fautes++;
  m.ev('faute', { j: auteur.i, o: victime.i, genre, x: victime.p.x, z: victime.p.z });
  return true;
}

/** Le joueur est-il contre un panneau dans la direction (dx, dz) ? */
function contreMur(j, dx, dz) {
  const lim = 0.36;
  return (dx > 0.3 && j.p.x >= BX - lim) || (dx < -0.3 && j.p.x <= -BX + lim) || (dz > 0.3 && j.p.z >= BZ - lim) || (dz < -0.3 && j.p.z <= -BZ + lim);
}

/**
 * Écarte A et B de corr le long de n (de A vers B), au prorata (pa, pb) ; un panneau ne se traverse pas : la part
 * qu'il refuse à l'un (sa composante vers le panneau) est donnée à l'autre, et dans un coin chacun glisse le long de
 * son panneau (deux corps coincés dans un coin ne restent plus l'un dans l'autre).
 */
const LIM_MUR = 0.35;
function bloque(j, dx, dz, out) {
  out.x = (dx > 0 && j.p.x >= BX - LIM_MUR - 1e-9) || (dx < 0 && j.p.x <= -BX + LIM_MUR + 1e-9) ? 0 : dx;
  out.z = (dz > 0 && j.p.z >= BZ - LIM_MUR - 1e-9) || (dz < 0 && j.p.z <= -BZ + LIM_MUR + 1e-9) ? 0 : dz;
  return out;
}
const ca = { x: 0, z: 0 }, cb = { x: 0, z: 0 };
function ecarter(A, B, nx, nz, corr, pa, pb) {
  bloque(A, -nx * corr * pa, -nz * corr * pa, ca);
  bloque(B, nx * corr * pb, nz * corr * pb, cb);
  let sa = -(ca.x * nx + ca.z * nz), sb = cb.x * nx + cb.z * nz;
  const manque = corr - sa - sb;
  if (manque > 1e-6) {
    // l'autre prend ce qui manque, dans les directions qui lui restent ouvertes
    if (sb > 1e-6 || pb === 0) { bloque(B, nx * corr, nz * corr, cb); sb = cb.x * nx + cb.z * nz; }
    if (sa + sb < corr - 1e-6) { bloque(A, -nx * corr, -nz * corr, ca); sa = -(ca.x * nx + ca.z * nz); }
    const tot = sa + sb;
    if (tot > 1e-6) { const k = Math.min(3, corr / tot); ca.x *= k; ca.z *= k; cb.x *= k; cb.z *= k; }
  }
  A.p.x += ca.x; A.p.z += ca.z; B.p.x += cb.x; B.p.z += cb.z;
}

/** Deux passes de plus sur les positions seules : trois corps serrés (contre un panneau) se démêlent ensemble. */
export function demeler(m) {
  const J = m.joueurs, rr = 2 * C.rayon;
  for (let it = 0; it < 2; it++) for (let a = 0; a < J.length; a++) for (let c = a + 1; c < J.length; c++) {
    const A = J[a], B = J[c];
    if (A.absent || B.absent || A.mode === 'sol' || B.mode === 'sol' || A.mode === 'releve' || B.mode === 'releve') continue;
    let nx = B.p.x - A.p.x, nz = B.p.z - A.p.z;
    const d = hypot(nx, nz);
    if (d >= rr || d < 1e-6) continue;
    nx /= d; nz /= d;
    // (au plus 4 cm par passe : deux corps emmêlés, un joueur qui se relève sur un autre, se démêlent en glissant, pas
    // d'un saut)
    // (lot 2 : un relevé emmêlé se démêle doucement, 2 cm par passe : il ne chasse pas l'autre dans un troisième)
    const ia = 1 / A.m, ib = 1 / B.m, corr = Math.min((A.leve ?? 0) > 0 || (B.leve ?? 0) > 0 ? 0.02 : 0.04, 0.95 * (rr - d));
    const murA = contreMur(A, -nx, -nz), murB = contreMur(B, nx, nz);
    const [pa, pb] = parts(A, B, murA, murB, ia, ib);
    ecarter(A, B, nx, nz, corr, pa, pb);
  }
}

/**
 * Qui recule, entre A et B (parts de la correction) : pas celui qui est contre un panneau ; (lot 2) celui qui vient de se
 * relever (j.leve, 0,5 s) se dégage seul, sans pousser l'autre dans un troisième (un relevé emmêlé dans un coin) ;
 * sinon au prorata inverse des masses.
 */
function parts(A, B, murA, murB, ia, ib) {
  if (murA) return [0, 1];
  if (murB) return [1, 0];
  const la = (A.leve ?? 0) > 0, lb = (B.leve ?? 0) > 0;
  if (la && !lb) return [1, 0];
  if (lb && !la) return [0, 1];
  return [ia / (ia + ib), ib / (ia + ib)];
}

/** Corps contre corps, pour toutes les paires (45 au plus). */
export function pasCorpsACorps(m, dt) {
  pasPaires(m, dt);
  tirages(m, dt);
  demeler(m);
}

/**
 * Le tirage de maillot (bola-app#26, lot 2) : le défenseur collé dans le dos du porteur (centres à moins de 0,78 m, il
 * est derrière lui), qui le veut (intention « tire », l'IA qui revient par derrière), le tient : le porteur perd 15 %
 * d'allure (corps.js, tireF), les deux perdent de l'équilibre ; tenu plus de 0,8 s : faute (si elle est sifflée), et le
 * défenseur lâche. Pour le rendu : j.tireCible (le défenseur tend le bras vers lui), j.tirePar (le porteur tiré).
 */
function tirages(m, dt) {
  const b = m.balle, T = DUELS.tirage;
  const p = b.possesseur != null ? m.joueurs[b.possesseur] : null;
  for (const o of m.joueurs) {
    if (o.absent || o.gardien) continue;
    const tient = p && o.e !== p.e && o.int?.tire && o.mode === 'loco' && p.mode !== 'sol' && p.mode !== 'releve' && m.t >= (o.tireRepos ?? -9);
    let ok = false;
    if (tient) {
      const rx = o.p.x - p.p.x, rz = o.p.z - p.p.z, d = hypot(rx, rz);
      // derrière lui : du côté opposé à sa course (ou à son cap s'il est arrêté)
      const s = hypot(p.v.x, p.v.z);
      const fx = s > 0.8 ? p.v.x / s : sin(p.cap), fz = s > 0.8 ? p.v.z / s : cos(p.cap);
      ok = d < T.portee && d > 1e-6 && (rx * fx + rz * fz) < -0.35 * d;
    }
    if (!ok) { if (o.tireCible != null) { o.tireCible = null; o.tireT = 0; } continue; }
    if (o.tireCible !== p.i) { o.tireCible = p.i; o.tireT = 0; m.ev('tirage', { j: o.i, o: p.i }); m.stats.tirages++; }
    o.tireT += dt;
    p.tireF = 0.12; p.tirePar = o.i; o.tireF = 0.12;
    // (au plus 0,6 de déséquilibre par le tirage : il gêne, il ne fait pas tomber)
    if (p.d < 0.6) desequilibrer(m, p, T.desPorteur * dt);
    if (o.d < 0.6) desequilibrer(m, o, T.desTireur * dt);
    if (o.tireT > T.faute) {
      faute(m, o, p, 'tirage');
      o.tireCible = null; o.tireT = 0; o.tireRepos = m.t + T.repos;
    }
  }
}

function pasPaires(m, dt) {
  const J = m.joueurs, rr = 2 * C.rayon;
  for (let a = 0; a < J.length; a++) for (let c = a + 1; c < J.length; c++) {
    const A = J[a], B = J[c];
    if (A.absent || B.absent) continue;
    // au sol (et pendant le relevé), on n'est plus qu'un obstacle bas : les autres l'enjambent
    if (A.mode === 'sol' || B.mode === 'sol' || A.mode === 'releve' || B.mode === 'releve') continue;
    let nx = B.p.x - A.p.x, nz = B.p.z - A.p.z;
    const d = hypot(nx, nz);
    if (d >= rr + 0.15 || d < 1e-6) continue;
    nx /= d; nz /= d;
    epaule(m, A, B, nx, nz, d, dt);
    dos(m, A, B, nx, nz, d, dt);
    if (d >= rr + 0.01) continue;
    const ia = 1 / A.m, ib = 1 / B.m;
    const pen = rr - d, corr = Math.max(0, Math.min((A.leve ?? 0) > 0 || (B.leve ?? 0) > 0 ? 0.02 : 0.06, 0.95 * pen));
    // (un corps collé à un panneau ne recule pas : l'autre prend toute la correction)
    const murA = contreMur(A, -nx, -nz), murB = contreMur(B, nx, nz);
    const [pa, pb] = parts(A, B, murA, murB, ia, ib);
    ecarter(A, B, nx, nz, corr, pa, pb);
    // (le prochain pas d'un geste à root motion ne poussera plus dans l'autre corps)
    if (pen > 0) { A.bloque = A.bloque ?? { x: 0, z: 0 }; A.bloque.x = nx; A.bloque.z = nz; B.bloque = B.bloque ?? { x: 0, z: 0 }; B.bloque.x = -nx; B.bloque.z = -nz; A.bloqueT = B.bloqueT = 1; }
    const rvx = B.v.x - A.v.x, rvz = B.v.z - A.v.z;
    const vn = rvx * nx + rvz * nz;
    // deux joueurs qui se poussent sur place (chacun voudrait passer) : ils se contournent, l'un de chaque côté
    if (pen > -0.005 && hypot(A.v.x, A.v.z) < 0.6 && hypot(B.v.x, B.v.z) < 0.6) {
      if ((A.int?.allure ?? 0) > 0.3) { A.v.x += -nz * 18 * dt; A.v.z += nx * 18 * dt; }
      if ((B.int?.allure ?? 0) > 0.3) { B.v.x -= -nz * 18 * dt; B.v.z -= nx * 18 * dt; }
    }
    if (vn >= 0) continue;
    const jn = (-(1 + C.restitution) * vn) / (ia + ib);
    A.v.x -= jn * nx * ia; A.v.z -= jn * nz * ia;
    B.v.x += jn * nx * ib; B.v.z += jn * nz * ib;
    // frottement tangent
    const tx = -nz, tz = nx, vt = rvx * tx + rvz * tz;
    const jt = clamp(-vt / (ia + ib), -C.frottementCorps * jn, C.frottementCorps * jn);
    A.v.x -= jt * tx * ia; A.v.z -= jt * tz * ia;
    B.v.x += jt * tx * ib; B.v.z += jt * tz * ib;
    // un choc fort déséquilibre (impulsion par unité de masse)
    // (entre coéquipiers, on s'évite : moitié moins)
    const f = A.e === B.e ? 0.5 : 1;
    const dva = jn * ia, dvb = jn * ib;
    if (dva > 1.4) desequilibrer(m, A, (f * (dva - 1.4)) / (2 * C.impDes), { x: -nx, z: -nz });
    if (dvb > 1.4) desequilibrer(m, B, (f * (dvb - 1.4)) / (2 * C.impDes), { x: nx, z: nz });
    if (jn * Math.max(ia, ib) > 1.2) m.ev('choc', { a: A.i, b: B.i, force: jn });
  }
}

/**
 * La poussée de dos (bola-app#26, lot 2) : le porteur qui protège la balle (dos à l'adversaire) recule dans le
 * défenseur collé derrière lui : le défenseur est repoussé (420 N) et perd un peu d'équilibre ; le porteur, lui, tient.
 */
function dos(m, A, B, nx, nz, d, dt) {
  if (A.e === B.e || A.gardien || B.gardien || d > 2 * C.rayon + 0.06) return;
  for (const [P, D, s] of [[A, B, 1], [B, A, -1]]) {
    if (!P.int?.protege || m.balle.possesseur !== P.i || D.mode === 'sol' || D.mode === 'releve') continue;
    // le défenseur est dans le dos du porteur (son cap regarde à l'opposé)
    const ux = s * nx, uz = s * nz; // du porteur vers le défenseur
    if (ux * sin(P.cap) + uz * cos(P.cap) > -0.4) continue;
    // (le défenseur contre un panneau ne recule plus : la poussée l'écraserait dans le coin)
    if (contreMur(D, ux, uz)) continue;
    const F = DUELS.dos.force;
    D.v.x += (F / D.m) * ux * dt; D.v.z += (F / D.m) * uz * dt;
    if (D.d < 0.5) desequilibrer(m, D, DUELS.dos.des * dt);
    if (m.t - (P.dosT ?? -9) > 0.8) { P.dosT = m.t; m.ev('dos', { j: P.i, o: D.i }); }
    P.appuiX = ux; P.appuiZ = uz; P.appuiF = 0.6; P.appuiT = m.t;
  }
}

function epaule(m, A, B, nx, nz, d, dt) {
  if (A.e === B.e || A.gardien || B.gardien) return;
  if (!(A.mode === 'loco' && B.mode === 'loco')) return;
  const sa = hypot(A.v.x, A.v.z), sb = hypot(B.v.x, B.v.z);
  if (sa < 1.5 || sb < 1.5) return;
  // côte à côte, dans le même sens
  const ca = (A.v.x * B.v.x + A.v.z * B.v.z) / (sa * sb);
  if (ca < cos((50 * Math.PI) / 180)) return;
  // côte à côte : la normale presque perpendiculaire à la course commune ; on ne garde que sa part latérale
  let ux = A.v.x + B.v.x, uz = A.v.z + B.v.z; const ul = hypot(ux, uz) || 1; ux /= ul; uz /= ul;
  const nu = nx * ux + nz * uz;
  if (Math.abs(nu) > 0.5) return;
  let lx = nx - nu * ux, lz = nz - nu * uz; const ll = hypot(lx, lz) || 1; lx /= ll; lz /= ll;
  nx = lx; nz = lz;
  const engA = A.int?.charge ? 1 : A.int?.vaBalle ? 0.6 : 0.15;
  const engB = B.int?.charge ? 1 : B.int?.vaBalle ? 0.6 : 0.15;
  const prA = A.int?.protege || m.balle.possesseur === A.i ? 1.3 : 1, prB = B.int?.protege || m.balle.possesseur === B.i ? 1.3 : 1;
  const Fa = C.forceEpaule * engA, Fb = C.forceEpaule * engB;
  // (pour le rendu : chacun s'appuie vers l'autre, buste penché selon la poussée qu'il reçoit et qu'il donne)
  A.appuiX = nx; A.appuiZ = nz; A.appuiF = (Fa + Fb) / (2 * C.forceEpaule); A.appuiT = m.t;
  B.appuiX = -nx; B.appuiZ = -nz; B.appuiF = A.appuiF; B.appuiT = m.t;
  // les deux se poussent l'un l'autre, de côté
  A.v.x -= (Fb / A.m) * nx * dt; A.v.z -= (Fb / A.m) * nz * dt;
  B.v.x += (Fa / B.m) * nx * dt; B.v.z += (Fa / B.m) * nz * dt;
  // qui gagne : le moment latéral, une part de l'élan (le plus lourd et le plus lancé tient sa ligne) et la force
  const mA = (A.m * (Math.max(0, A.v.x * nx + A.v.z * nz) + 0.15 * sa) + Fa * 0.1) * prA * (1 - 0.4 * A.d);
  const mB = (B.m * (Math.max(0, -(B.v.x * nx + B.v.z * nz)) + 0.15 * sb) + Fb * 0.1) * prB * (1 - 0.4 * B.d);
  const ecart = (mA - mB) / (mA + mB + 1e-6);
  const perdant = ecart > 0 ? B : A, gagnant = ecart > 0 ? A : B;
  const f = Math.abs(ecart);
  if (f > 0.08) {
    // dérive latérale du perdant
    const s = perdant === B ? 1 : -1;
    desequilibrer(m, perdant, f * 1.1 * dt * 6, { x: s * nx, z: s * nz });
    perdant.v.x += s * nx * f * 3 * dt; perdant.v.z += s * nz * f * 3 * dt;
  }
  if (m.t - (A.epauleT ?? -9) > 0.6 && (engA >= 1 || engB >= 1)) {
    A.epauleT = m.t; B.epauleT = m.t;
    m.ev('epaule', { a: A.i, b: B.i, gagnant: gagnant.i });
    m.stats.epaules++;
  }
}

/**
 * La portée des pieds pendant la glissade (hanches au sol) : le plus loin devant le corps (z, m) et leur écart moyen
 * de côté (x, m, repère du joueur : la jambe gauche, tendue, mène).
 */
let porteeG = null;
function porteeGlissade() {
  if (porteeG) return porteeG;
  let z = 0.8, sx = 0, n = 0;
  for (let t = 0; t <= duree('slide'); t += 1 / 30) {
    if (hancheA('slide', t) > 0.3) continue;
    for (let p = 0; p < 2; p++) { piedA('slide', t, p, t1); z = Math.max(z, t1.z); sx += t1.x; n++; }
  }
  return (porteeG = { z, x: n ? sx / n : 0 });
}

/** Demande un tacle (glissé ou debout). */
export function demanderTacle(m, j, glisse) {
  if (!libre(j) || j.gardien) return false;
  const s = hypot(j.v.x, j.v.z);
  const cible = m.balle;
  // vers la balle
  const h = atan2(cible.p.x - j.p.x, cible.p.z - j.p.z);
  if (glisse) {
    // (bola-app#26) le vrai tacle glissé : le corps part au sol, couché sur le dos, pieds devant (clip slide), et
    // glisse de sa vitesse sur le gazon (freinGlissade). La glissade vise où sera la balle quand les pieds y arrivent :
    // la portée des pieds devant le corps (table du clip, ~1 m) et la vitesse de départ (bornée) sont choisies pour ça.
    const { z: portee, x: decale } = porteeGlissade();
    const a = C.freinGlissade;
    const [vmin, vmax] = C.vGlissade;
    let v0 = clamp(s + 2, vmin, vmax), bx = cible.p.x, bz = cible.p.z, hb = j.cap;
    for (let k = 0; k < 3; k++) {
      // (le corps vise à côté de la balle : ce sont les pieds, décalés de côté, qui doivent passer dessus)
      const cx = bx - decale * cos(hb), cz = bz + decale * sin(hb);
      hb = atan2(cx - j.p.x, cz - j.p.z);
      const L = Math.max(0, hypot(cx - j.p.x, cz - j.p.z) - portee);
      // le temps pour couvrir L en glissant (v0 t − a t² / 2 = L), sinon le bout de la glissade
      const disc = v0 * v0 - 2 * a * L;
      const T = disc > 0 ? (v0 - Math.sqrt(disc)) / a : v0 / a;
      bx = cible.p.x + cible.v.x * T; bz = cible.p.z + cible.v.z * T;
      // la vitesse qu'il faut pour y être à T (bornée : on ne glisse ni sur place ni à plus de 8 m/s)
      const L2 = Math.max(0, hypot(bx - j.p.x, bz - j.p.z) - portee);
      v0 = clamp(Math.max(s + 1, Math.sqrt(2 * a * L2 * 1.2)), vmin, vmax);
    }
    j.cap = Math.abs(enrouler(hb - j.cap)) < 1.4 || s < 2 ? hb : j.cap;
    lancerGeste(j, 'slide', { taux: 1.15, type: 'tacle', donnees: { vLim: v0, glisse: { x: sin(j.cap), z: cos(j.cap) } } });
    j.mode = 'sol'; j.solT = 0; j.recup = 3;
    j.v.x = sin(j.cap) * v0; j.v.z = cos(j.cap) * v0;
  } else {
    j.cap = h;
    lancerGeste(j, 'shoot2', { taux: 1.6, type: 'tacleDebout', finApresImpact: 0.2, donnees: {} });
  }
  m.stats.tacles++;
  return true;
}

/** Pendant un tacle : le balayage du pied, et ses conséquences. */
export function pasTacle(m, j) {
  const g = j.g;
  if (!g) return;
  const b = m.balle;
  if (g.type === 'tacle') {
    // le balayage : tant que le tacleur est au sol et glisse (hanches sous 0,3 m, encore lancé), ses deux pieds
    // balaient la balle et les jambes des adversaires ; la balle touchée part le long de la glissade, les jambes
    // touchées tombent (balayé de côté ou de face, croc-en-jambe par derrière)
    if (g.donnees.fini) return;
    const sv = hypot(j.v.x, j.v.z);
    if (hancheA(g.nom, g.t) > 0.25) { if (g.t > duree(g.nom) * 0.5) { g.donnees.fini = true; finTacle(m, j); } return; }
    if (sv < 0.6) { g.donnees.fini = true; finTacle(m, j); return; }
    const rr = C.rayonJambes;
    for (let pied = 0; pied < 2; pied++) {
      piedA(g.nom, g.t, pied, t1);
      versMonde(j.cap, t1.x, t1.z, t2);
      const fx = j.p.x + t2.x, fz = j.p.z + t2.z;
      // la balle
      if (!g.donnees.balle && b.garde == null && b.p.y < 0.5 && hypot(b.p.x - fx, b.p.z - fz) < rr + BALLON.R) {
        g.donnees.balle = m.t; g.donnees.impactH = hancheA(g.nom, g.t);
        // (l'issue : la balle repart du pied, plus fort si le tacleur est lancé, déviée selon l'angle d'attaque)
        const sb = clamp(sv * 1.1 + 0.4 * hypot(b.v.x, b.v.z), 3.5, 7.5);
        const h = j.cap + (m.rng.contacts.u() - 0.5) * 0.7;
        b.v.x = sin(h) * sb; b.v.z = cos(h) * sb; b.v.y = 0.3 + m.rng.contacts.u() * 0.6;
        rouler(b);
        b.dernier = j.i; b.dernierT = m.t; b.possesseur = null; b.recepteur = null; b.tir = null;
        m.ev('tacleBalle', { j: j.i, h: g.donnees.impactH });
      }
      // les jambes des adversaires
      for (const o of m.joueurs) {
        if (o.absent || o.e === j.e || o.mode === 'sol' || o.gardien || g.donnees['j' + o.i]) continue;
        // (toute la jambe balaie : le segment du genou, 0,35 m devant les hanches, au pied)
        const kx = j.p.x + sin(j.cap) * 0.35, kz = j.p.z + cos(j.cap) * 0.35;
        const ex = fx - kx, ez = fz - kz, E = ex * ex + ez * ez || 1;
        const u = clamp(((o.p.x - kx) * ex + (o.p.z - kz) * ez) / E, 0, 1);
        if (hypot(o.p.x - kx - ex * u, o.p.z - kz - ez * u) < rr + C.rayonJambes) {
          g.donnees['j' + o.i] = m.t;
          const balleAvant = g.donnees.balle && g.donnees.balle < m.t;
          // par derrière (le porteur file dans le sens de la glissade) : croc-en-jambe ; sinon balayé
          const memeSens = o.v.x * sin(j.cap) + o.v.z * cos(j.cap) > 1.5;
          // (la faute : les jambes avant la balle ; elle se note avant la chute, quand le porteur a encore la balle)
          if (!balleAvant) faute(m, j, o, memeSens ? 'derriere' : 'glisse');
          desequilibrer(m, o, balleAvant ? 0.6 : 1.2, { x: sin(j.cap), z: cos(j.cap) }, memeSens ? 'croc' : 'balaye');
          m.ev('tacleJambes', { j: j.i, o: o.i, balleAvant: !!balleAvant, h: hancheA(g.nom, g.t) });
        }
      }
    }
  } else if (g.type === 'tacleDebout' && !g.fait && g.t >= g.impact) {
    g.fait = true; g.impactAge = g.age;
    const fx = sin(j.cap), fz = cos(j.cap);
    const rx = b.p.x - j.p.x, rz = b.p.z - j.p.z, d = hypot(rx, rz);
    const al = d > 0 ? (rx * fx + rz * fz) / d : 1;
    const p = b.possesseur != null ? m.joueurs[b.possesseur] : null;
    const dp = p && p.e !== j.e ? hypot(p.p.x - j.p.x, p.p.z - j.p.z) : 99;
    // (bola-app#26, lot 2) la balle sous le pied du porteur : les deux pieds la touchent ensemble, elle gicle (contrée)
    const dbp = p && p.e !== j.e ? hypot(b.p.x - p.p.x, b.p.z - p.p.z) : 99;
    if (b.garde == null && b.p.y < 0.6 && d < 0.9 + BALLON.R && al > 0.64 && d < dp - 0.05 && dbp < DUELS.contre.pied && m.rng.duels.u() < DUELS.contre.part) {
      const r = m.rng.duels;
      const h = atan2(fx, fz) + (r.u() < 0.5 ? -1 : 1) * (0.9 + r.u() * 1.2);
      const sv = 2.5 + r.u() * 2.5;
      b.v.x = sin(h) * sv; b.v.z = cos(h) * sv; b.v.y = 0.4 + r.u() * 1.4;
      b.w.x = (r.u() - 0.5) * 30; b.w.y = (r.u() - 0.5) * 20; b.w.z = (r.u() - 0.5) * 30;
      b.dernier = j.i; b.dernierT = m.t; b.possesseur = null; b.recepteur = null; b.tir = null;
      desequilibrer(m, p, 0.25, { x: fx, z: fz });
      desequilibrer(m, j, 0.15, { x: -fx, z: -fz });
      m.ev('tacleContre', { j: j.i, o: p.i });
      m.stats.contresTacle++;
    } else if (b.garde == null && b.p.y < 0.6 && d < 0.9 + BALLON.R && al > 0.64 && d < dp - 0.05) {
      const h = atan2(fx, fz) + (m.rng.contacts.u() - 0.5) * 1.2;
      const sv = 3 + m.rng.contacts.u() * 2;
      b.v.x = sin(h) * sv + j.v.x * 0.3; b.v.z = cos(h) * sv + j.v.z * 0.3; b.v.y = 0.2;
      rouler(b);
      b.dernier = j.i; b.dernierT = m.t; b.possesseur = j.i; b.recepteur = null; b.tir = null;
      m.ev('tacleBalle', { j: j.i, debout: true });
      m.stats.vols++;
    } else if (p && dp < 0.95) {
      // (les jambes sans la balle ; la faute se note avant le choc, balle encore à lui. Un contact jambe contre jambe qui le fait trébucher : l'arbitre siffle une fois sur deux par derrière ou de
      // côté, une fois sur sept de face ; toujours s'il tombe)
      const pv = hypot(p.v.x, p.v.z), pfx = pv > 0.8 ? p.v.x / pv : sin(p.cap), pfz = pv > 0.8 ? p.v.z / pv : cos(p.cap);
      const deFace = ((j.p.x - p.p.x) * pfx + (j.p.z - p.p.z) * pfz) > 0.3 * dp;
      // (le choc des jambes : 0,4 à 0,85 de déséquilibre)
      const dd = 0.4 + 0.45 * m.rng.duels.u();
      const u = m.rng.duels.u();
      if (p.d + dd >= C.chute || (p.d + dd >= C.trebuche && u < (deFace ? 0.15 : 0.5))) faute(m, j, p, 'debout');
      desequilibrer(m, p, dd, { x: fx, z: fz });
      m.ev('tacleJambes', { j: j.i, o: p.i, debout: true });
    } else {
      j.plante = 0.45;
    }
  }
}

function finTacle(m, j) {
  const g = j.g;
  if (g.donnees.balle) m.stats.vols++;
  if (!g.donnees.balle) j.plante = 0.45;
}

// ── le ballon contre les corps ──
const pc = { x: 0, y: 0, z: 0 };
/**
 * La balle ne traverse personne : jambes (capsule du sol à 0,9 m, r 0,14), buste (0,9 à 1,6 m, r 0,2), corps couché
 * (le long du cap, à 0,15 m) ou qui se relève. Une balle qui entre dans une capsule en ressort par la normale, sa vitesse
 * relative au corps réfléchie (e = 0,3) et freinée de côté (μ = 0,5). Ignorés : le porteur qui la conduit, un joueur
 * qui frappe ou tacle (ses gestes la touchent eux-mêmes), celui qui vient de la toucher (0,15 s), les gardiens
 * (gardien.js : mains et corps). Une frappe contrée n'est plus un tir ; le corps touché devient le dernier à l'avoir
 * jouée. Renvoie l'index du joueur touché, ou -1.
 */
export function balleCorps(m) {
  const b = m.balle;
  if (b.garde != null || b.p.y > 1.6 + BALLON.R + 0.2) return -1;
  const R = BALLON.R;
  for (const j of m.joueurs) {
    if (j.absent || j.gardien) continue;
    if (j.i === b.possesseur && j.mode !== 'sol' && j.mode !== 'releve') continue;
    if (j.demande || j.g?.type === 'frappe' || j.g?.type === 'tacle' || j.g?.type === 'tacleDebout') continue;
    if (b.dernier === j.i && m.t - b.dernierT < BC.ignore) continue;
    // (un petit pont réussi : ses jambes écartées laissent passer la balle, monde.js)
    if ((j.ouvertT ?? -9) > m.t) continue;
    const dx0 = b.p.x - j.p.x, dz0 = b.p.z - j.p.z;
    if (dx0 * dx0 + dz0 * dz0 > 1.2 * 1.2) continue;
    // le point le plus proche sur l'axe de la capsule touchée, et son rayon
    let r = 0;
    if (j.mode === 'sol') {
      const [hl, y, rr] = BC.sol;
      const fx = sin(j.cap), fz = cos(j.cap);
      const u = clamp(dx0 * fx + dz0 * fz, -hl, hl);
      pc.x = j.p.x + fx * u; pc.y = y; pc.z = j.p.z + fz * u; r = rr;
    } else {
      const caps = j.mode === 'releve' ? [BC.releve] : [BC.jambes, BC.buste];
      let best = Infinity;
      for (const [y0, y1, rr] of caps) {
        const y = clamp(b.p.y, y0, y1);
        const d = hypot(dx0, b.p.y - y, dz0) - rr;
        if (d < best) { best = d; pc.x = j.p.x; pc.y = y; pc.z = j.p.z; r = rr; }
      }
    }
    let nx = b.p.x - pc.x, ny = b.p.y - pc.y, nz = b.p.z - pc.z;
    const d = hypot(nx, ny, nz);
    if (d >= r + R || d < 1e-6) continue;
    // un joueur debout et libre qui la reçoit dans les jambes ou le buste : un contrôle (moins bon), pas un rebond
    if (j.mode !== 'sol' && j.mode !== 'releve' && b.p.y < 1.45 && pasControle(m, j, true)) return j.i;
    nx /= d; ny /= d; nz /= d;
    // hors de la capsule
    sortirBalle(b, pc.x, pc.y, pc.z, nx, ny, nz, r + R);
    // la vitesse relative au corps, réfléchie et freinée de côté
    const rx = b.v.x - j.v.x, ry = b.v.y, rz = b.v.z - j.v.z;
    const vn = rx * nx + ry * ny + rz * nz;
    if (vn >= 0) continue;
    const jn = -(1 + BC.e) * vn;
    let ox = rx + jn * nx, oy = ry + jn * ny, oz = rz + jn * nz;
    const tn = ox * nx + oy * ny + oz * nz;
    const tx = ox - tn * nx, ty = oy - tn * ny, tz = oz - tn * nz, tl = hypot(tx, ty, tz);
    if (tl > 1e-6) { const k = Math.max(0, 1 - (BC.mu * jn) / tl); ox = tn * nx + tx * k; oy = tn * ny + ty * k; oz = tn * nz + tz * k; }
    b.v.x = ox + j.v.x; b.v.y = oy; b.v.z = oz + j.v.z;
    b.w.x *= 0.4; b.w.y *= 0.4; b.w.z *= 0.4;
    const vin = -vn;
    // (un frôlement lent, une balle calée entre un corps et un panneau : le corps ne « joue » pas la balle, il reste
    // libre de la contrôler au pas suivant)
    if (vin < 1.5) continue;
    if (b.possesseur !== j.i) b.possesseur = null;
    if (b.tir && b.tir.e !== j.e) m.ev('contre', { j: j.i, v: vin });
    b.tir = null;
    if (b.recepteur != null && b.recepteur !== j.i) b.recepteur = null;
    b.dernier = j.i; b.dernierT = m.t;
    m.stats.contres = (m.stats.contres ?? 0) + 1;
    if (vin > 6) m.ev('balleCorps', { j: j.i, v: vin });
    return j.i;
  }
  return -1;
}
