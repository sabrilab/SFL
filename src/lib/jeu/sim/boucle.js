// La boucle à pas fixe du jeu (bola-app#23) : le temps réel de l'affichage est versé dans un accumulateur, la
// simulation avance par pas exacts de 1/120 s, et l'affichage interpole entre les deux derniers états (α = reste / pas).
// Rien ne dépend donc du nombre d'images par seconde : à 20, 60 ou 144 images/s, le même match se joue au même pas.
//   · au-delà de 0,25 s de retard (onglet caché, machine lente), le jeu ralentit au lieu d'enchaîner 30 pas d'un coup ;
//   · le ralenti du but agit sur le temps versé à l'accumulateur, jamais sur le pas.
// Sans three ni DOM : le banc (tools/jeu-banc.ts) l'emploie pour vérifier qu'un même match découpé en images de 1/60,
// 1/144 ou irrégulières donne la même empreinte.
import { PAS } from './constantes.js';
import { pas } from './monde.js';

const N_J = 10;

export function creerBoucle(monde) {
  const b = {
    m: monde, acc: 0,
    // l'état précédent, pour l'interpolation : par joueur x, z, cap ; la balle x, y, z
    prec: new Float64Array(N_J * 3 + 3),
    alpha: 0,
  };
  sauver(b);
  return b;
}

function sauver(b) {
  const P = b.prec, J = b.m.joueurs;
  for (let i = 0; i < J.length; i++) { P[i * 3] = J[i].p.x; P[i * 3 + 1] = J[i].p.z; P[i * 3 + 2] = J[i].cap; }
  const q = b.m.balle.p, k = N_J * 3;
  P[k] = q.x; P[k + 1] = q.y; P[k + 2] = q.z;
}

/**
 * Verse dt secondes réelles (× ralenti) et fait les pas qu'elles paient. entrees() rend les intentions humaines au
 * moment de chaque pas (lues une fois par image, tenues pendant ses pas). apres(n) est appelé après chaque pas.
 * Renvoie le nombre de pas faits.
 */
export function avancer(b, dt, entrees = null, ralenti = 1, apres = null) {
  b.acc += Math.min(0.25, Math.max(0, dt)) * ralenti;
  let n = 0;
  while (b.acc >= PAS) {
    sauver(b);
    pas(b.m, typeof entrees === 'function' ? entrees() : entrees);
    b.acc -= PAS;
    n++;
    apres?.(n);
  }
  b.alpha = b.acc / PAS;
  return n;
}

/** n pas exacts (banc, captures), sans toucher à l'accumulateur. */
export function avancerPas(b, n, entrees = null, apres = null) {
  for (let i = 0; i < n; i++) { sauver(b); pas(b.m, typeof entrees === 'function' ? entrees() : entrees); apres?.(i); }
  b.alpha = 1;
}

/** La position interpolée d'un joueur (x, z, cap) entre le pas précédent et le dernier. */
export function joueurInterpole(b, i, out) {
  const P = b.prec, j = b.m.joueurs[i], a = b.alpha;
  out.x = P[i * 3] + (j.p.x - P[i * 3]) * a;
  out.z = P[i * 3 + 1] + (j.p.z - P[i * 3 + 1]) * a;
  let d = j.cap - P[i * 3 + 2];
  while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  // un saut de cap (fin de plongeon, engagement) ne s'interpole pas
  out.cap = Math.abs(d) > 1.2 ? j.cap : P[i * 3 + 2] + d * a;
  if (Math.hypot(j.p.x - P[i * 3], j.p.z - P[i * 3 + 1]) > 1) { out.x = j.p.x; out.z = j.p.z; }
  return out;
}

/** La position interpolée du ballon. */
export function balleInterpolee(b, out) {
  const P = b.prec, q = b.m.balle.p, k = N_J * 3, a = b.alpha;
  out.x = P[k] + (q.x - P[k]) * a; out.y = P[k + 1] + (q.y - P[k + 1]) * a; out.z = P[k + 2] + (q.z - P[k + 2]) * a;
  if (Math.hypot(q.x - P[k], q.z - P[k + 2]) > 1) { out.x = q.x; out.y = q.y; out.z = q.z; }
  return out;
}
