// Les contacts entre joueurs : corps contre corps, épaule contre épaule, déséquilibre, tacles debout et glissés
// (bola-app#23). Plus de « séparation » qui déplace les corps sans conséquence : les vitesses changent vraiment.
//
//   · corps : cylindres de 0,30 m au sol. Pour une paire qui se recouvre : correction de position au prorata inverse
//     des masses (80 % de la pénétration, 5 cm par pas au plus), impulsion J = −(1 + e) v_rel·n / (1/m₁ + 1/m₂)
//     (e = 0,15) seulement s'ils se rapprochent, frottement tangent 0,3 J. Un joueur lancé dans un autre est freiné,
//     l'autre est poussé ; un choc fort déséquilibre.
//   · épaule : deux joueurs côte à côte, qui vont dans le même sens, dont un charge (bouton, ou l'IA qui va à la
//     balle). Le duel se gagne au moment m (v·n) + F dt (×1,3 pour qui protège la balle) ; le perdant prend du
//     déséquilibre et dérive de côté, le gagnant garde sa ligne.
//   · tacle glissé : le corps glisse sur la courbe du clip « tackle » ; à l'impact, le pied (table des clips) balaie
//     un segment de 0,22 m de rayon. Balle touchée d'abord : elle repart le long du balayage. Jambes du porteur
//     d'abord : il tombe. Les deux : la balle part et le porteur est déséquilibré. De face, la balle passe presque
//     toujours en premier ; par derrière, les jambes. Le tacleur reste au sol jusqu'au bout du clip : environ 2 s.
//   · tacle debout : une extension de jambe (clip « shoot2 », rapide) de portée 0,9 m ; réussi si la balle est dans
//     le secteur, sinon un contact qui déséquilibre sans prendre la balle.
// Aucune faute n'est sifflée (décision proposée à Sabri : la chute suffit comme punition).
import { CORPS as C, BALLON, BX, BZ } from './constantes.js';
import { lancerGeste, tomber, trebucher, piedA, racineA, impactDe, versMonde, clamp, enrouler, libre } from './corps.js';
import { rouler } from './gestes.js';
import { atan2, cos, hypot, sin } from './maths.js';

const t1 = { x: 0, y: 0, z: 0 }, t2 = { x: 0, y: 0, z: 0 };

/** Applique un déséquilibre (et ses conséquences : trébucher, tomber). */
export function desequilibrer(m, j, dd) {
  if (j.mode === 'sol' || j.mode === 'releve' || dd <= 0) return;
  j.d += dd;
  if (j.d >= C.chute) { tomber(j); m.ev('chute', { j: j.i }); }
  else if (j.d >= C.trebuche && j.mode === 'loco') { trebucher(j); m.ev('trebuche', { j: j.i }); }
}

/** Le joueur est-il contre un panneau dans la direction (dx, dz) ? */
function contreMur(j, dx, dz) {
  const lim = 0.36;
  return (dx > 0.3 && j.p.x >= BX - lim) || (dx < -0.3 && j.p.x <= -BX + lim) || (dz > 0.3 && j.p.z >= BZ - lim) || (dz < -0.3 && j.p.z <= -BZ + lim);
}

/** Corps contre corps, pour toutes les paires (45 au plus). */
export function pasCorpsACorps(m, dt) {
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
    if (d >= rr + 0.01) continue;
    const ia = 1 / A.m, ib = 1 / B.m;
    const pen = rr - d, corr = Math.max(0, Math.min(0.2, 0.8 * pen));
    // (un corps collé à un panneau ne recule pas : l'autre prend toute la correction)
    const murA = contreMur(A, -nx, -nz), murB = contreMur(B, nx, nz);
    const pa = murA ? 0 : murB ? 1 : ia / (ia + ib), pb = murB ? 0 : murA ? 1 : ib / (ia + ib);
    A.p.x -= nx * corr * pa; A.p.z -= nz * corr * pa;
    B.p.x += nx * corr * pb; B.p.z += nz * corr * pb;
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
    if (dva > 1.4) desequilibrer(m, A, (f * (dva - 1.4)) / (2 * C.impDes));
    if (dvb > 1.4) desequilibrer(m, B, (f * (dvb - 1.4)) / (2 * C.impDes));
    if (jn * Math.max(ia, ib) > 1.2) m.ev('choc', { a: A.i, b: B.i, force: jn });
  }
}

function epaule(m, A, B, nx, nz, d, dt) { // eslint-disable-line no-param-reassign
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
    desequilibrer(m, perdant, f * 1.1 * dt * 6);
    // dérive latérale du perdant
    const s = perdant === B ? 1 : -1;
    perdant.v.x += s * nx * f * 3 * dt; perdant.v.z += s * nz * f * 3 * dt;
  }
  if (m.t - (A.epauleT ?? -9) > 0.6 && (engA >= 1 || engB >= 1)) {
    A.epauleT = m.t; B.epauleT = m.t;
    m.ev('epaule', { a: A.i, b: B.i, gagnant: gagnant.i });
    m.stats.epaules++;
  }
}

/** Demande un tacle (glissé ou debout). */
export function demanderTacle(m, j, glisse) {
  if (!libre(j) || j.gardien) return false;
  const s = hypot(j.v.x, j.v.z);
  const cible = m.balle;
  // vers la balle
  const h = atan2(cible.p.x - j.p.x, cible.p.z - j.p.z);
  if (glisse) {
    // la glissade vise où sera la balle à l'impact : cap et longueur de glissade (échelle du root motion) choisis pour
    // que le pied du clip arrive dessus ; bornés (on ne glisse ni de travers ni deux fois plus loin que le clip)
    // le rythme : l'impact tombe quand la balle et le pied se rejoignent (une balle qui vient vers lui : plus vite)
    const ti = impactDe('tackle');
    racineA('tackle', ti, t1);
    piedA('tackle', ti, 1, t2);
    const portee = t1.z + t2.z; // ce que la glissade couvre jusqu'à l'impact, à l'échelle 1
    const rx = cible.p.x - j.p.x, rz = cible.p.z - j.p.z, d0 = hypot(rx, rz) || 1;
    const vient = -(cible.v.x * rx + cible.v.z * rz) / d0; // vitesse de la balle vers lui
    let taux = 1.3;
    for (let k = 0; k < 3; k++) { const T = ti / taux; const reste = d0 - vient * T; taux = clamp(ti / Math.max(0.2, (T * reste) / Math.max(0.3, portee)), 1.0, 2.6); }
    const T = ti / taux;
    const bx = cible.p.x + cible.v.x * T, bz = cible.p.z + cible.v.z * T;
    const hb = atan2(bx - j.p.x, bz - j.p.z);
    j.cap = Math.abs(enrouler(hb - j.cap)) < 1.4 || s < 2 ? hb : j.cap;
    const dist = hypot(bx - j.p.x, bz - j.p.z);
    // (et jamais plus de 6,5 m/s de glissade : un rythme rapide raccourcit la glissade au lieu de l'accélérer)
    const echelle = Math.min(clamp((dist - t2.z) / Math.max(0.5, t1.z), 0.6, 1.6), 6.5 / (4.2 * taux));
    lancerGeste(j, 'tackle', { taux, rm: true, echelle, type: 'tacle', donnees: { touche: null } });
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
    const a = g.impact - 0.1, z = g.impact + 0.15;
    if (g.donnees.fini || g.t < a) return;
    if (g.t > z) { g.donnees.fini = true; j.recup = Math.max(j.recup, (g.fin - g.t) / g.taux); finTacle(m, j); return; }
    piedA('tackle', g.t, 1, t1);
    versMonde(g.cap0, t1.x, t1.z, t2);
    const fx = j.p.x + t2.x, fz = j.p.z + t2.z;
    const rr = C.rayonJambes;
    // la balle
    if (!g.donnees.balle && b.garde == null && b.p.y < 0.5 && hypot(b.p.x - fx, b.p.z - fz) < rr + BALLON.R) {
      g.donnees.balle = m.t;
      const sv = clamp(hypot(j.v.x, j.v.z) * 1.1, 4, 7);
      const h = g.cap0 + (m.rng.contacts.u() - 0.5) * 0.6;
      b.v.x = sin(h) * sv; b.v.z = cos(h) * sv; b.v.y = 0.4;
      rouler(b);
      b.dernier = j.i; b.dernierT = m.t; b.possesseur = null; b.recepteur = null; b.tir = null;
      m.ev('tacleBalle', { j: j.i });
    }
    // les jambes des adversaires
    for (const o of m.joueurs) {
      if (o.absent || o.e === j.e || o.mode === 'sol' || o.gardien || g.donnees['j' + o.i]) continue;
      if (hypot(o.p.x - fx, o.p.z - fz) < rr + C.rayonJambes) {
        g.donnees['j' + o.i] = m.t;
        const balleAvant = g.donnees.balle && g.donnees.balle < m.t;
        desequilibrer(m, o, balleAvant ? 0.6 : 1.2);
        m.ev('tacleJambes', { j: j.i, o: o.i, balleAvant: !!balleAvant });
      }
    }
  } else if (g.type === 'tacleDebout' && !g.fait && g.t >= g.impact) {
    g.fait = true; g.impactAge = g.age;
    const fx = sin(j.cap), fz = cos(j.cap);
    const rx = b.p.x - j.p.x, rz = b.p.z - j.p.z, d = hypot(rx, rz);
    const al = d > 0 ? (rx * fx + rz * fz) / d : 1;
    const p = b.possesseur != null ? m.joueurs[b.possesseur] : null;
    const dp = p && p.e !== j.e ? hypot(p.p.x - j.p.x, p.p.z - j.p.z) : 99;
    if (b.garde == null && b.p.y < 0.6 && d < 0.9 + BALLON.R && al > 0.64 && d < dp - 0.05) {
      const h = atan2(fx, fz) + (m.rng.contacts.u() - 0.5) * 1.2;
      const sv = 3 + m.rng.contacts.u() * 2;
      b.v.x = sin(h) * sv + j.v.x * 0.3; b.v.z = cos(h) * sv + j.v.z * 0.3; b.v.y = 0.2;
      rouler(b);
      b.dernier = j.i; b.dernierT = m.t; b.possesseur = j.i; b.recepteur = null; b.tir = null;
      m.ev('tacleBalle', { j: j.i, debout: true });
      m.stats.vols++;
    } else if (p && dp < 0.95) {
      desequilibrer(m, p, 0.7);
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
