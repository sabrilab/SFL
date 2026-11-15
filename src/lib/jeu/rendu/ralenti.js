// Le ralenti du but en plusieurs angles (bola-app#26, lot 4). Sans three ni DOM : le banc (tools/jeu-banc.ts) le
// fait tourner contre la vraie simulation.
//
// LA RÈGLE : le ralenti ne fait JAMAIS avancer la simulation. Il relit un tampon de ce que l'écran a montré (les corps
// posés : chaque os, la racine, le ballon), enregistré à 30 images par seconde de temps de jeu sur les 4,6 dernières
// secondes. Pendant la lecture, match.js ne fait plus aucun pas (simGelee) ; le match reprend ensuite exactement où il
// était, au pas près (même empreinte qu'un match sans ralenti : contrôlé par le banc).
//
// Le tampon (creerTampon) est générique : une image = `taille` nombres, décrits par `genres` (0 : valeur interpolée en
// ligne droite ; 1 : début d'un quaternion, interpolé sur la sphère ; 2 : angle, interpolé par le plus court chemin ;
// 3 : drapeau, celui de l'image la plus proche). match.js y écrit les os ; le banc, ce qu'il veut.
//
// Le metteur en scène (creerRalenti) : un but arme le ralenti ; le tampon se fige 0,9 s après la ligne (le filet qui
// bouge, le buteur qui part) ; quand la célébration a été vue (phase « but » presque finie), match.js lance la lecture :
//   1. dans le but, tout contre le filet du fond, la balle qui arrive sur la caméra : de 2,2 s avant le but à 0,6 s
//      après, à 0,6× ;
//   2. au ras du gazon, de côté, à mi-chemin du buteur et du but : de 1,0 s avant à 0,4 s après, à 0,4× ;
//   3. du cube, à la verticale : de 0,8 s avant à 0,5 s après, à 0,5× ;
// un fondu au noir de 0,18 s entre deux plans (par l'exposition : aucune passe de plus). Un toucher, A / ✕, Entrée ou
// Espace passe le ralenti. Mouvement réduit : jamais de ralenti (ni de plan qui bouge).

export const PLANS_RALENTI = [
  { nom: 'derriere', de: -2.2, a: 0.6, vitesse: 0.6 },
  { nom: 'rasant', de: -1.0, a: 0.4, vitesse: 0.4 },
  { nom: 'cube', de: -0.8, a: 0.5, vitesse: 0.5 },
];
export const RALENTI = { duree: 4.6, frequence: 30, apres: 0.9, fondu: 0.18 };

// ─────────────────────────── le tampon ───────────────────────────
export function creerTampon(taille, genres, { duree = RALENTI.duree, frequence = RALENTI.frequence } = {}) {
  const cap = Math.ceil(duree * frequence) + 2;
  return { taille, genres, cap, frequence, data: new Float32Array(cap * taille), t: new Float64Array(cap), debut: 0, n: 0, fige: false };
}
export function viderTampon(T) { T.debut = 0; T.n = 0; T.fige = false; }
const idx = (T, k) => (T.debut + k) % T.cap;
export const tempsDebut = (T) => (T.n ? T.t[idx(T, 0)] : NaN);
export const tempsFin = (T) => (T.n ? T.t[idx(T, T.n - 1)] : NaN);

/**
 * Une image au temps de jeu t, si 1/frequence s'est écoulé depuis la dernière (un temps qui recule vide le tampon :
 * un nouveau match). ecrire(data, debut) remplit les `taille` nombres. Renvoie true si l'image a été prise.
 */
export function enregistrer(T, t, ecrire) {
  if (T.fige) return false;
  if (T.n && t < tempsFin(T) - 1e-6) viderTampon(T);
  if (T.n && t - tempsFin(T) < 1 / T.frequence - 1e-6) return false;
  let k;
  if (T.n < T.cap) { k = idx(T, T.n); T.n++; } else { k = T.debut; T.debut = (T.debut + 1) % T.cap; }
  T.t[k] = t;
  ecrire(T.data, k * T.taille);
  return true;
}

/** L'image au temps t (bornée au tampon), interpolée, écrite dans out (Float32Array de `taille`). */
export function lireTampon(T, t, out) {
  if (!T.n) return false;
  let i0 = 0;
  if (t <= tempsDebut(T)) { out.set(T.data.subarray(idx(T, 0) * T.taille, idx(T, 0) * T.taille + T.taille)); return true; }
  if (t >= tempsFin(T)) { const k = idx(T, T.n - 1); out.set(T.data.subarray(k * T.taille, k * T.taille + T.taille)); return true; }
  // (recherche par dichotomie : le tampon est trié)
  let lo = 0, hi = T.n - 1;
  while (hi - lo > 1) { const mi = (lo + hi) >> 1; if (T.t[idx(T, mi)] <= t) lo = mi; else hi = mi; }
  i0 = lo;
  const a = idx(T, i0), b = idx(T, i0 + 1), ta = T.t[a], tb = T.t[b];
  const u = tb > ta ? (t - ta) / (tb - ta) : 0;
  const A = a * T.taille, B = b * T.taille, D = T.data, G = T.genres;
  for (let i = 0; i < T.taille; i++) {
    const g = G[i];
    if (g === 1) {
      // quaternion : nlerp par le plus court chemin (deux images à 1/30 s : l'écart est petit)
      let bx = D[B + i], by = D[B + i + 1], bz = D[B + i + 2], bw = D[B + i + 3];
      const ax = D[A + i], ay = D[A + i + 1], az = D[A + i + 2], aw = D[A + i + 3];
      if (ax * bx + ay * by + az * bz + aw * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
      let x = ax + (bx - ax) * u, y = ay + (by - ay) * u, z = az + (bz - az) * u, w = aw + (bw - aw) * u;
      const l = Math.hypot(x, y, z, w) || 1;
      out[i] = x / l; out[i + 1] = y / l; out[i + 2] = z / l; out[i + 3] = w / l;
      i += 3;
    } else if (g === 2) {
      let d = D[B + i] - D[A + i];
      d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
      out[i] = D[A + i] + d * u;
    } else if (g === 3) out[i] = u < 0.5 ? D[A + i] : D[B + i];
    else out[i] = D[A + i] + (D[B + i] - D[A + i]) * u;
  }
  return true;
}

// ─────────────────────────── le metteur en scène ───────────────────────────
/**
 * etat : 'direct' (rien) → 'arme' (un but : le tampon enregistre encore 0,9 s) → 'pret' (tampon figé) → 'lecture'
 * → 'direct'. reduit : jamais de ralenti.
 */
export function creerRalenti({ reduit = false, plans = PLANS_RALENTI } = {}) {
  return { reduit, plans, etat: 'direct', tBut: 0, info: null, plan: -1, tPlan: 0, lu: 0, fondu: 0, passe: false };
}

/** Un but au temps de jeu t (info : qui, d'où, vers quel but ; pour les plans). */
export function armerRalenti(R, t, info) {
  if (R.reduit) return false;
  R.etat = 'arme'; R.tBut = t; R.info = info; R.plan = -1;
  return true;
}

/** À chaque image du direct : fige le tampon quand il a assez d'après-but. */
export function suivreRalenti(R, T, t) {
  if (R.etat === 'arme' && t >= R.tBut + RALENTI.apres) { T.fige = true; R.etat = 'pret'; }
}

/** Les plans réellement jouables (bornés au tampon), avec leurs durées à l'écran. */
export function plansJouables(R, T) {
  const d = tempsDebut(T), f = tempsFin(T), out = [];
  for (const p of R.plans) {
    const de = Math.max(d, R.tBut + p.de), a = Math.min(f, R.tBut + p.a);
    if (a - de > 0.25) out.push({ ...p, de, a, ecran: (a - de) / p.vitesse });
  }
  return out;
}

/** La lecture commence (le tampon doit être prêt). Renvoie false s'il n'y a rien à montrer. */
export function lancerRalenti(R, T) {
  if (R.etat !== 'pret') return false;
  R.liste = plansJouables(R, T);
  if (!R.liste.length) { R.etat = 'direct'; T.fige = false; return false; }
  R.etat = 'lecture'; R.plan = 0; R.tPlan = 0; R.lu = 0; R.passe = false;
  return true;
}

/** La simulation est-elle gelée ? (pendant la lecture, et seulement) */
export const simGelee = (R) => R.etat === 'lecture';

/** Passer : la lecture s'arrête à l'image suivante (fondu de sortie court). */
export function passerRalenti(R) { if (R.etat === 'lecture') R.passe = true; }

/**
 * Une image de lecture, dtReel en secondes réelles. Renvoie { plan, t (temps de jeu à montrer), noir (0..1, le fondu
 * entre deux plans), fini } ; fini : le direct reprend (R.etat = 'direct', tampon libéré).
 */
export function avancerRalenti(R, T, dtReel, out = {}) {
  out.fini = false;
  if (R.etat !== 'lecture') { out.fini = true; return out; }
  if (R.passe) { R.etat = 'direct'; T.fige = false; out.fini = true; out.noir = 0; return out; }
  R.tPlan += dtReel; R.lu += dtReel;
  let p = R.liste[R.plan];
  if (R.tPlan >= p.ecran) {
    R.plan++; R.tPlan = 0;
    if (R.plan >= R.liste.length) { R.etat = 'direct'; T.fige = false; out.fini = true; out.noir = 0; return out; }
    p = R.liste[R.plan];
  }
  const F = RALENTI.fondu;
  const avant = R.plan > 0 ? Math.max(0, 1 - R.tPlan / F) : 0; // l'entrée d'un plan (sauf le premier)
  const apres = Math.max(0, 1 - (p.ecran - R.tPlan) / F);
  out.plan = p; out.t = p.de + Math.min(p.ecran, R.tPlan) * p.vitesse; out.noir = Math.max(avant, apres) * 0.92;
  out.u = R.tPlan / p.ecran;
  return out;
}

/** Durée à l'écran de toute la lecture (s). */
export const dureeRalenti = (R) => (R.liste ?? []).reduce((s, p) => s + p.ecran, 0);

// ─────────────────────────── les caméras des plans ───────────────────────────
/**
 * La caméra d'un plan (repère du jeu), qui suit la balle par un filtre doux (aucun tremblement) : c garde l'état
 * ({ pos, regard } et la balle suivie), remis à zéro au début de chaque plan (premier = true).
 * info : { zBut (la ligne du but marqué), xBut, buteur {x, z} (au moment du but) }.
 */
export function cameraPlan(c, plan, info, balle, dt, premier) {
  const s = Math.sign(info.zBut) || 1;
  const suivi = (c.suivi ??= { x: 0, y: 0, z: 0 });
  if (premier) { suivi.x = balle.x; suivi.y = balle.y; suivi.z = balle.z; }
  else {
    const k = 1 - Math.exp(-dt * (plan.nom === 'cube' ? 6 : 12)); // (le tampon est déjà lisse : un suivi serré garde la balle dans le cadre)
    suivi.x += (balle.x - suivi.x) * k; suivi.y += (balle.y - suivi.y) * k; suivi.z += (balle.z - suivi.z) * k;
  }
  const pos = (c.pos ??= { x: 0, y: 0, z: 0 }), regard = (c.regard ??= { x: 0, y: 0, z: 0 });
  if (plan.nom === 'derriere') {
    // dans le but, à hauteur de poitrine, tout contre le filet du fond : la balle arrive sur la caméra ; le regard
    // reste au moins 3 m devant la ligne (jamais à la verticale)
    pos.x = Math.max(-1.1, Math.min(1.1, -info.xBut * 0.6)); pos.y = 1.05; pos.z = info.zBut + s * 0.72;
    const loin = Math.max(2, Math.abs(suivi.z - info.zBut));
    regard.x = suivi.x; regard.y = Math.max(0.4, Math.min(1.4, suivi.y)); regard.z = info.zBut - s * loin;
    c.fov = 62;
  } else if (plan.nom === 'rasant') {
    // au ras du gazon, de côté, à mi-chemin entre le buteur et le but : le tir passe devant
    const bx = info.buteur.x, bz = info.buteur.z;
    const cote = bx >= 0 ? 1 : -1, mz = (bz + info.zBut) / 2;
    pos.x = Math.max(-8.5, Math.min(8.5, cote * (Math.abs(bx) + 3.6))); pos.y = 0.5; pos.z = mz;
    regard.x = suivi.x; regard.y = 0.55; regard.z = suivi.z * 0.7 + mz * 0.3;
    c.fov = 50;
  } else {
    // du cube : en plongée entre le buteur et le but, la balle au centre
    pos.x = suivi.x * 0.6 + 0.01; pos.y = 10.5; pos.z = (suivi.z + info.zBut) / 2 - s * 2.2;
    regard.x = suivi.x; regard.y = 0; regard.z = (suivi.z * 2 + info.zBut) / 3;
    c.fov = 46;
  }
  return c;
}
