// Les corps des joueurs : élan, virages, pivots, orientation, gestes à root motion, chute et relevé (bola-app#23).
//
// La simulation décide des positions et des vitesses ; l'animation suit (rendu/animateur.js). Chaque joueur reçoit à
// chaque pas une intention (sim/commandes.js : direction, allure, sprint, regard, contenir, protéger…), la même pour le
// pouce, la manette et l'IA, et ce fichier la change en mouvement avec les limites d'un vrai corps :
//   · accélération a(v) = a0 (1 − v / 1,08 v_cible) : 0 → 7 m/s en 2,5 s environ ;
//   · virage : la direction de la course tourne d'au plus ω = min(9 ; a_lat / v) rad/s, donc un rayon v² / a_lat
//     (0,5 m à 2 m/s, 6,5 m à 7 m/s) ; au-delà de 45° d'écart, le joueur ralentit, au-delà de 90° il freine sur ses
//     appuis ; un demi-tour (plus de 150°) lancé passe par le freinage puis le pivot (turn180) ;
//   · orientation (cap) séparée de la vitesse : en contenant ou en protégeant, le joueur fait face au porteur ou dos
//     à l'adversaire et se déplace en pas chassés ou en arrière (3 m/s au plus) ;
//   · gestes à root motion (tacle, chute, roulette, frappe en course, relances du gardien) : la vitesse EST la courbe
//     du clip (sim/clips.js), mise à l'échelle de la vitesse d'entrée ; plus de geste joué sur place ;
//   · déséquilibre d (contacts.js) : il réduit vitesse et accélération, fait trébucher (≥ 0,65) ou tomber (≥ 1) ;
//   · la foulée : une phase φ ∈ [0 ; 2) qui avance de v / L(v) (L, longueur d'une foulée du clip voisin) ; le rendu
//     y cale les clips de course, et la conduite de balle y cale ses touches (un appui tous les 0,5 de phase).
// Pas fixe (constantes.js, PAS), aucune allocation par pas, rien de three.
import { CORPS as C } from './constantes.js';
import { CLIPS, FPS_CLIPS } from './clips.js';
import { atan2, cos, exp, hypot, sin } from './maths.js';

const TAU = Math.PI * 2;
export const enrouler = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ── lecture des tables de clips ──
function echantillon(tab, n, stride, off, t, dur) {
  const f = clamp(t / dur, 0, 1) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f)), a = f - i;
  return tab[i * stride + off] + (tab[(i + 1) * stride + off] - tab[i * stride + off]) * a;
}
/** Le root motion (m, repère du joueur) d'un clip au temps t : out.x, out.z. */
export function racineA(nom, t, out) {
  const c = CLIPS[nom];
  if (!c) { out.x = 0; out.z = 0; return out; }
  out.x = echantillon(c.root, c.n, 2, 0, t, c.dur);
  out.z = echantillon(c.root, c.n, 2, 1, t, c.dur);
  return out;
}
/** La vitesse du root motion (m/s, repère du joueur, au rythme 1). */
export function vitesseRacine(nom, t, out) {
  const c = CLIPS[nom];
  if (!c) { out.x = 0; out.z = 0; return out; }
  const h = 1 / FPS_CLIPS;
  const t0 = clamp(t - h / 2, 0, c.dur - h), t1 = t0 + h;
  const x0 = echantillon(c.root, c.n, 2, 0, t0, c.dur), z0 = echantillon(c.root, c.n, 2, 1, t0, c.dur);
  out.x = (echantillon(c.root, c.n, 2, 0, t1, c.dur) - x0) / h;
  out.z = (echantillon(c.root, c.n, 2, 1, t1, c.dur) - z0) / h;
  return out;
}
/** Le milieu d'un pied (0 = gauche, 1 = droit), en m, repère du joueur (sans le root motion), au temps t. */
export function piedA(nom, t, pied, out) {
  const c = CLIPS[nom];
  if (!c) { out.x = 0; out.y = 0; out.z = 0; return out; }
  out.x = echantillon(c.pieds, c.n, 6, pied * 3, t, c.dur) / 100;
  out.y = echantillon(c.pieds, c.n, 6, pied * 3 + 1, t, c.dur) / 100;
  out.z = echantillon(c.pieds, c.n, 6, pied * 3 + 2, t, c.dur) / 100;
  return out;
}
/** Le milieu des mains du gardien (m, repère du joueur, hanches comprises), au temps t. */
export function mainsA(nom, t, out) {
  const c = CLIPS[nom];
  if (!c?.mains) { out.x = 0; out.y = 0.8; out.z = 0.3; return out; }
  out.x = echantillon(c.mains, c.n, 3, 0, t, c.dur) / 100;
  out.y = echantillon(c.mains, c.n, 3, 1, t, c.dur) / 100;
  out.z = echantillon(c.mains, c.n, 3, 2, t, c.dur) / 100;
  return out;
}
export const duree = (nom) => CLIPS[nom]?.dur ?? 1;
/** L'instant d'impact d'un geste (s de clip) : le contact mesuré au pied, sinon l'impact noté. */
export const impactDe = (nom) => { const c = CLIPS[nom]; return c ? (c.impact ?? c.hit ?? 0.3) * c.dur : 0; };

/** Repère du joueur → monde (x, z) : le joueur regarde (sin cap, cos cap). */
export function versMonde(cap, lx, lz, out) {
  const c = cos(cap), s = sin(cap);
  out.x = lx * c + lz * s; out.z = -lx * s + lz * c;
  return out;
}

// ── la foulée ──
const L_JOG = 2.85 * 0.7333, L_RUN = 5.391 * 0.6333;
/** Longueur d'une foulée complète (deux pas) à la vitesse v : le jog raccourci au pas, le run au-delà de 5,4 m/s. */
export function longueurFoulee(v) {
  if (v < 2.85) return L_JOG * (0.55 + 0.45 * (v / 2.85));
  if (v < 5.39) return L_JOG + ((L_RUN - L_JOG) * (v - 2.85)) / (5.39 - 2.85);
  return L_RUN;
}

// ── un joueur ──
export function creerCorps(i, e, role) {
  const gardien = role === 'G';
  return {
    i, e, role, gardien, m: gardien ? C.masseGardien : C.masse,
    p: { x: 0, z: 0 }, v: { x: 0, z: 0 }, cap: 0,
    mode: 'loco',          // loco | frein | pivot | geste | sol | releve
    g: null,               // le geste en cours (voir lancerGeste)
    cible: 0,              // direction visée pendant un freinage avant pivot
    phase: 0,              // foulée, [0 ; 2)
    d: 0,                  // déséquilibre
    aLong: 0, aLat: 0,     // accélérations (m/s²), filtrées, pour le buste et le roulis
    solT: 0,               // temps passé au sol
    recup: 0,              // ne peut plus toucher la balle pendant ce temps (s)
    plante: 0,             // planté (après un tacle raté, une roulette subie) : s
    intouchable: 0,
    regard: null,          // vers où regarde la tête (x, z), pour le rendu
    int: null,             // l'intention du pas
    pieds: [{ x: 0, z: 0 }, { x: 0, z: 0 }],
  };
}

const tmp = { x: 0, y: 0, z: 0 };

/**
 * Un geste : nom du clip, rythme (taux), root motion appliqué ou non (avec son échelle), et ce qu'il fait (type,
 * données libres). Le temps du clip avance de dt × taux ; le rendu pose le clip à ce temps, sans le laisser avancer seul.
 */
export function lancerGeste(j, nom, { taux = 1, depuis = 0, rm = false, echelle = 1, type = nom, fin = null, finApresImpact = null, donnees = null } = {}) {
  j.mode = 'geste';
  j.g = {
    nom, type, t: depuis * duree(nom), taux, rm, echelle, cap0: j.cap, donnees,
    impact: impactDe(nom), fait: false,
    fin: fin ?? duree(nom),
    finApresImpact, // s de jeu après l'impact où le geste rend la main (le reste des clips de passe est trop long)
    age: 0,
  };
  return j.g;
}

/** Fin d'un geste : retour à la course (la vitesse reste celle du moment). */
export function finirGeste(j) {
  j.g = null;
  if (j.mode === 'geste') j.mode = 'loco';
}

/** La chute : le corps garde son élan (root motion de trip, borné à 6 m/s), puis reste au sol, puis se relève. */
export function tomber(j) {
  if (j.mode === 'sol' || j.mode === 'releve') return;
  const s = hypot(j.v.x, j.v.z);
  const h = s > 0.3 ? atan2(j.v.x, j.v.z) : j.cap;
  j.cap = h;
  lancerGeste(j, 'trip', { taux: 1.5, rm: true, echelle: clamp(s / 3.4, 0.5, 1.4), type: 'chute' });
  j.mode = 'sol';
  j.solT = 0;
  j.d = 0;
  j.recup = 3;
}

/** Trébucher : la première moitié de la chute, puis la course reprend. */
export function trebucher(j) {
  if (j.mode !== 'loco') return;
  const s = hypot(j.v.x, j.v.z);
  if (s > 0.3) j.cap = atan2(j.v.x, j.v.z);
  lancerGeste(j, 'trip', { taux: 1.6, rm: true, echelle: clamp(s / 3.4, 0.4, 1.1), type: 'trebuche', fin: 0.45 * duree('trip') });
  j.recup = Math.max(j.recup, 0.5);
}

function vitesseVoulue(j, it, balle) {
  let v = it.allure * C.vTrot + it.sprint * (C.vSprint - C.vTrot);
  if (balle) v = Math.min(v * C.balleV, C.vSprintBalle);
  if (it.contenir) v = Math.min(v, C.vChasse);
  if (it.protege) v = Math.min(v, C.vProtege);
  if (j.plante > 0) v = Math.min(v, 0.6);
  return v * (1 - 0.5 * clamp(j.d, 0, 1));
}

/**
 * La locomotion d'un pas : l'intention devient une vitesse et un cap, dans les limites du corps.
 * balle : le joueur conduit la balle (pénalités).
 */
export function pasCorps(j, dt, balle) {
  const it = j.int;
  const vx0 = j.v.x, vz0 = j.v.z;
  j.recup = Math.max(0, j.recup - dt);
  j.plante = Math.max(0, j.plante - dt);
  j.intouchable = Math.max(0, j.intouchable - dt);
  j.d = Math.max(0, j.d - C.retourDes * dt);

  if (j.mode === 'geste' || j.mode === 'sol' || j.mode === 'releve' || j.mode === 'pivot') pasGeste(j, dt);
  else {
    let s = hypot(j.v.x, j.v.z);
    let h = s > 0.05 ? atan2(j.v.x, j.v.z) : j.cap;
    const veut = it && (it.dx || it.dz) && it.allure > 0.02;
    const vc = veut ? vitesseVoulue(j, it, balle) : 0;
    const accF = 1 - 0.6 * clamp(j.d, 0, 1);
    const aLat = C.aLat * (balle ? C.balleLat : 1) * accF;
    if (j.mode === 'frein') {
      // freinage planté avant le pivot
      s = Math.max(0, s - C.freinPlante * dt);
      if (s <= C.pivotEntree) {
        j.v.x = sin(h) * s; j.v.z = cos(h) * s;
        j.cap = h;
        const g = lancerGeste(j, 'turn180', { taux: 1, type: 'pivot', donnees: { s0: s, h0: h, cible: j.cible } });
        j.mode = 'pivot';
        g.cap0 = h;
      } else { j.v.x = sin(h) * s; j.v.z = cos(h) * s; j.cap = h; }
    } else if (!veut) {
      s = Math.max(0, s - C.frein * dt);
      j.v.x = sin(h) * s; j.v.z = cos(h) * s;
    } else {
      const hv = atan2(it.dx, it.dz);
      const delta = enrouler(hv - h);
      const ad = Math.abs(delta);
      if (!it.contenir && !it.protege && s > C.pivotVitesse && ad > (150 * Math.PI) / 180) {
        j.mode = 'frein';
        j.cible = hv;
      } else {
        let vt = vc, freinage = C.frein;
        if (s < 0.4) h = hv; // au départ arrêté : on part dans la direction voulue
        else {
          if (ad > Math.PI / 2) { vt = Math.min(vc, 0.5 * s); freinage = C.freinPlante; }
          else if (ad > Math.PI / 4) vt = vc * (1 - (0.35 * (ad - Math.PI / 4)) / (Math.PI / 4));
          const om = Math.min(C.lacetMax, aLat / Math.max(0.1, s));
          h += clamp(delta, -om * dt, om * dt);
        }
        if (s < vt) s = Math.min(vt, s + C.a0 * accF * Math.max(0.15, 1 - s / (1.08 * vt)) * dt);
        else s = Math.max(vt, s - freinage * dt);
        j.v.x = sin(h) * s; j.v.z = cos(h) * s;
      }
    }
    // le cap : face à la course, ou au regard voulu quand on contient, protège ou piétine
    if (j.mode === 'loco') {
      const sp = hypot(j.v.x, j.v.z);
      let capVoulu = j.cap;
      const r = it?.regard;
      if ((it?.contenir || it?.protege || sp < 0.6) && r) capVoulu = atan2(r.x - j.p.x, r.z - j.p.z);
      else if (sp >= 0.6) capVoulu = atan2(j.v.x, j.v.z);
      if (it?.protege && r) capVoulu = enrouler(capVoulu + Math.PI); // dos à l'adversaire
      const dc = enrouler(capVoulu - j.cap);
      // en course, le buste suit la course (sinon le pied glisse) ; ailleurs, 6 rad/s au plus
      const maxc = sp >= 0.6 && !(it?.contenir || it?.protege) ? Math.max(C.capMax, Math.min(C.lacetMax, aLat / Math.max(0.1, sp)) * 1.5) : C.capMax;
      j.cap = enrouler(j.cap + clamp(dc, -maxc * dt, maxc * dt));
    }
  }

  j.bloqueT = 0;
  // l'intégration (semi-implicite : vitesse puis position)
  j.p.x += j.v.x * dt; j.p.z += j.v.z * dt;
  // accélérations dans le repère du cap, filtrées (8 Hz) pour le buste et le roulis
  const ax = (j.v.x - vx0) / dt, az = (j.v.z - vz0) / dt;
  const fx = sin(j.cap), fz = cos(j.cap);
  const k = 1 - exp(-dt * 2 * Math.PI * 8 / 2);
  j.aLong += (ax * fx + az * fz - j.aLong) * k;
  j.aLat += (ax * fz - az * fx - j.aLat) * k;
  // la foulée
  const s = hypot(j.v.x, j.v.z);
  if (j.mode === 'loco' || j.mode === 'frein') {
    const balleL = balle && s < 4.4 ? 2.2 / longueurFoulee(2.54) : 1; // la conduite : foulée du clip drib
    j.phase = (j.phase + (dt * s) / (longueurFoulee(s) * balleL)) % 2;
  }
}

/** Avance le geste en cours (et la chute, le relevé, le pivot). */
function pasGeste(j, dt) {
  const g = j.g;
  if (!g) { j.mode = 'loco'; return; }
  g.age += dt;
  g.t += dt * g.taux;
  if (g.rm) {
    vitesseRacine(g.nom, g.t, tmp);
    versMonde(g.cap0, tmp.x * g.taux * g.echelle, tmp.z * g.taux * g.echelle, tmp);
    j.v.x = tmp.x; j.v.z = tmp.z;
    // un autre corps devant (contacts.js) : le geste ne passe pas au travers
    if (j.bloqueT > 0) {
      const vn = j.v.x * j.bloque.x + j.v.z * j.bloque.z;
      if (vn > 0) { j.v.x -= vn * j.bloque.x; j.v.z -= vn * j.bloque.z; }
    }
  } else if (g.type === 'pivot') {
    // le pivot : la vitesse d'entrée meurt sur l'appui, puis le joueur repart dans l'autre sens
    const u = clamp(g.t / duree(g.nom), 0, 1), s0 = g.donnees.s0, h0 = g.donnees.h0;
    const c = CLIPS[g.nom];
    const lacet = c?.turn ? echantillon(c.turn, c.turn.length, 1, 0, u * duree(g.nom), duree(g.nom)) : -Math.PI * u;
    j.cap = enrouler(g.cap0 + lacet);
    if (u < 0.45) { const s = s0 * (1 - u / 0.45); j.v.x = sin(h0) * s; j.v.z = cos(h0) * s; }
    else { const s = 2.5 * ((u - 0.45) / 0.55); j.v.x = sin(j.cap) * s; j.v.z = cos(j.cap) * s; }
  } else {
    // geste sur place (passe arrêtée, frappe arrêtée, contrôle) : le joueur s'arrête sur ses appuis
    const s = hypot(j.v.x, j.v.z);
    if (s > 0) { const ns = Math.max(0, s - C.freinPlante * dt); j.v.x *= ns / s; j.v.z *= ns / s; }
  }
  // fin du geste
  const fini = g.t >= g.fin - 1e-6 || (g.finApresImpact != null && g.fait && g.age >= g.impactAge + g.finApresImpact);
  if (j.mode === 'sol') {
    if (g.nom === 'trip' && g.t >= duree('trip')) {
      // au sol : frottement 4 m/s²
      const s = hypot(j.v.x, j.v.z);
      if (s > 0) { const ns = Math.max(0, s - 4 * dt); j.v.x *= ns / s; j.v.z *= ns / s; }
      g.rm = false;
      g.t = duree('trip');
      j.solT += dt;
      if (j.solT > C.solChute) {
        lancerGeste(j, 'getup', { taux: 1.6, depuis: 0.72, type: 'releve' });
        j.mode = 'releve';
        j.v.x = 0; j.v.z = 0;
      }
    } else if (g.rm && g.t >= duree(g.nom)) { g.rm = false; }
    return;
  }
  if (j.mode === 'releve') {
    j.v.x = 0; j.v.z = 0;
    const u = (g.t / duree('getup') - 0.72) / 0.28;
    if (u >= 0.7) j.recup = Math.min(j.recup, 0.05);
    if (g.t >= duree('getup')) { j.g = null; j.mode = 'loco'; }
    return;
  }
  if (fini) {
    if (g.type === 'pivot') { j.g = null; j.mode = 'loco'; return; }
    finirGeste(j);
  }
}

/** Le joueur peut-il toucher la balle (ni au sol, ni en train de se relever, ni en plein geste qui l'occupe) ? */
export const libre = (j) => (j.mode === 'loco' || j.mode === 'frein') && j.recup <= 0;
