// Le hasard du jeu, à graine : la même graine rejoue le même match, au pas près (banc, captures, vidéo).
// Générateur xoshiro128** (32 bits, entiers seulement : identique dans tous les moteurs JavaScript), amorcé par
// splitmix32. Un flux par usage (« ia », « touches », « frappes », « gardiens »…) : ajouter un tirage à l'IA ne change
// pas les touches de balle. Plus aucun Math.random dans la simulation.
import { cos, log } from './maths.js';

function splitmix32(a) {
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

function hacher(texte) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/** Un flux : u() dans [0 ; 1), entre(a, b), normal() (loi normale centrée réduite), choix(tableau). */
export function creerFlux(graine, nom) {
  const sm = splitmix32((graine >>> 0) ^ hacher(nom));
  const s = new Uint32Array([sm(), sm(), sm(), sm()]);
  if (!(s[0] | s[1] | s[2] | s[3])) s[0] = 1;
  const rotl = (x, k) => (x << k) | (x >>> (32 - k));
  const suivant = () => {
    const r = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
    const t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
    s[2] ^= t; s[3] = rotl(s[3], 11);
    return r;
  };
  const f = {
    u: () => suivant() / 4294967296,
    entre: (a, b) => a + (b - a) * f.u(),
    normal: () => {
      // Box-Muller (une seule valeur par appel : pas d'état caché à sauver)
      const u1 = Math.max(1e-12, f.u()), u2 = f.u();
      return Math.sqrt(-2 * log(u1)) * cos(2 * Math.PI * u2);
    },
    choix: (t) => t[Math.floor(f.u() * t.length) % t.length],
    etat: () => Array.from(s),
  };
  return f;
}

/** Les flux d'un match. */
export function creerHasard(graine) {
  return {
    graine,
    ia: creerFlux(graine, 'ia'),
    touches: creerFlux(graine, 'touches'),
    frappes: creerFlux(graine, 'frappes'),
    gardiens: creerFlux(graine, 'gardiens'),
    contacts: creerFlux(graine, 'contacts'),
    fetes: creerFlux(graine, 'fetes'),
    // (bola-app#26, lot 2) les duels (tirage, issue des tacles, fautes) et les décisions collectives de l'IA (appels,
    // une-deux, pressing) : des flux à part, pour ne pas décaler les tirages des autres
    duels: creerFlux(graine, 'duels'),
    collectif: creerFlux(graine, 'collectif'),
  };
}
