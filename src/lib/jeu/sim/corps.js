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
//   · déséquilibre d (contacts.js) : il réduit vitesse et accélération, fait trébucher (≥ 0,65) ou tomber (≥ 1) ; le
//     corps qui tombe garde au plus sa vitesse d'avant le contact plus 0,5 m/s, freine dès le contact (4 m/s²), ne
//     réaccélère jamais et frotte au sol à 7 m/s² ;
//   · la foulée : une phase φ ∈ [0 ; 2) qui avance de v / L(v) (L, longueur d'une foulée du clip voisin) ; le rendu
//     y cale les clips de course ; piedLoco donne, à cette phase, où est chaque pied (la touche de balle et le
//     contrôle se mesurent depuis lui).
// Pas fixe (constantes.js, PAS), aucune allocation par pas, rien de three.
import { CORPS as C, DUELS } from './constantes.js';
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
/** La tête (m, repère du joueur) d'un clip de tête au temps t ; à défaut, le haut du corps. */
export function teteA(nom, t, out) {
  const c = CLIPS[nom];
  if (!c?.tete) { out.x = 0; out.y = 1.6; out.z = 0.1; return out; }
  out.x = echantillon(c.tete, c.n, 3, 0, t, c.dur) / 100;
  out.y = echantillon(c.tete, c.n, 3, 1, t, c.dur) / 100;
  out.z = echantillon(c.tete, c.n, 3, 2, t, c.dur) / 100;
  return out;
}
/** La hauteur des hanches (m) d'un clip au temps t (1 m si le clip n'est pas mesuré). */
export function hancheA(nom, t) {
  const c = CLIPS[nom];
  return c?.hanche ? echantillon(c.hanche, c.n, 1, 0, t, c.dur) / 100 : 1;
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

/**
 * Le pied (0 gauche, 1 droit) d'un joueur qui court, dans le monde (x, y, z) : la table des pieds du clip de course que
 * montre le rendu (drib balle au pied sous 4,4 m/s, jog, run), posée à la phase de foulée φ avec le même calage que
 * rendu/animateur.js. C'est le pied « prévu » : la touche de balle et le contrôle se mesurent depuis lui, pas depuis
 * le centre du corps.
 */
export function piedLoco(j, balle, pied, out) {
  const s = hypot(j.v.x, j.v.z);
  const nom = balle && s < 4.4 ? 'drib' : s < 2.85 ? 'jog' : 'run';
  const c = CLIPS[nom];
  const cal = c?.appuis?.[0]?.[0]?.[0] ?? 0;
  const u = nom === 'drib' ? ((j.phase / 2 + cal) % 1 + 1) % 1 : ((j.phase % 1) + cal) % 1;
  piedA(nom, u * duree(nom), pied, out);
  const lx = out.x, lz = out.z;
  const cs = cos(j.cap), sn = sin(j.cap);
  out.x = j.p.x + lx * cs + lz * sn; out.z = j.p.z - lx * sn + lz * cs;
  return out;
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
    crochetT: 0, crochetH: 0, // un crochet en cours (monde.js) : le virage très court sur les appuis, vers crochetH
    regard: null,          // vers où regarde la tête (x, z), pour le rendu
    figure: null,          // un geste technique joué en couche par le rendu (passement, talon, sombrero) : { type, t0, duree, cote }
    int: null,             // l'intention du pas
    pieds: [{ x: 0, z: 0 }, { x: 0, z: 0 }],
  };
}

const tmp = { x: 0, y: 0, z: 0 };

/**
 * Un geste : nom du clip, rythme (taux), root motion appliqué ou non (avec son échelle), et ce qu'il fait (type,
 * données libres). Le temps du clip avance de dt × taux ; le rendu pose le clip à ce temps, sans le laisser avancer seul.
 */
export function lancerGeste(j, nom, { taux = 1, depuis = 0, rm = false, echelle = 1, type = nom, fin = null, finApresImpact = null, donnees = null, impact = null } = {}) {
  j.mode = 'geste';
  j.g = {
    nom, type, t: depuis * duree(nom), taux, rm, echelle, cap0: j.cap, donnees,
    impact: impact ?? impactDe(nom), fait: false,
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

// ── les chutes et les relevés (bola-app#26) ──
// La chute dépend du contact : poussé de face (en arrière, fall_back), de côté (coup d'épaule, fall_side), par
// derrière (croc-en-jambe, fall_trip, sur le ventre), balayé par un tacle (fall_sweep) ; sans direction, la chute en
// avant lancée (trip, avec son root motion). Le relevé suit la pose au sol : du dos (getup_dos) ou du ventre
// (getup_ventre, à la place de getting_up, 8,6 s joué depuis 72 %).
export const CHUTES = { avant: 'trip', cote: 'fall_side', arriere: 'fall_back', balaye: 'fall_sweep', croc: 'fall_trip' };
const AU_SOL = /^(volley|bicycle)/;
const RELEVES = { volley: 'getup_dos', bicycle: 'getup_dos', trip: 'getup_ventre', fall_trip: 'getup_ventre', fall_side: 'getup_dos', fall_back: 'getup_dos', fall_sweep: 'getup_dos', slide: 'getup_dos' };
// le relevé : depuis (part du clip), rythme, et la part du clip où il est debout (il peut rejouer la balle)
const RELEVE = { getup_dos: { depuis: 0.04, taux: 1.9, debout: 0.62 }, getup_ventre: { depuis: 0.05, taux: 1.6, debout: 0.5, fin: 0.72 }, getup: { depuis: 0.72, taux: 1.6, debout: 0.92 } };
// le rythme des chutes sans root motion (la simulation fait glisser le corps) : au sol en 0,7 à 1,1 s
const TAUX_CHUTE = { fall_side: 1.5, fall_back: 1.45, fall_sweep: 1.35, fall_trip: 1.5 };
// (correctifs #26) balayé ou croché, le corps part tout de suite : ces deux clips restent debout près d'une seconde
// avant de basculer (hanches à 0,8 m jusqu'à 1,1 s) ; ils sont pris à partir de 36 % (au sol en ~0,3 s)
const DEPUIS_CHUTE = { fall_sweep: 0.36, fall_trip: 0.36 };

/** Le genre de chute que donne une poussée (px, pz : la direction où le corps est poussé), dans son repère. */
export function genreChute(j, px, pz) {
  const L = hypot(px, pz);
  if (L < 1e-6) return 'avant';
  const av = (px * sin(j.cap) + pz * cos(j.cap)) / L;
  if (av > 0.5) return hypot(j.v.x, j.v.z) > 2.5 ? 'croc' : 'avant';
  if (av < -0.5) return 'arriere';
  return 'cote';
}

/**
 * La chute : le corps garde son élan (borné, 6 m/s au plus), freine dès le contact et frotte au sol, puis se relève.
 * genre : voir CHUTES. La chute en avant suit le root motion de trip ; les autres clips sont sur place : le corps
 * glisse de sa vitesse, freiné de 4 m/s² puis de 7 m/s² une fois les hanches au sol.
 */
export function tomber(j, genre = 'avant') {
  if (j.mode === 'sol' || j.mode === 'releve') return;
  const nom = CHUTES[genre] && CLIPS[CHUTES[genre]] ? CHUTES[genre] : 'trip';
  const s = hypot(j.v.x, j.v.z);
  const h = s > 0.3 ? atan2(j.v.x, j.v.z) : j.cap;
  // (la vitesse du corps qui tombe ne dépasse jamais celle d'avant le contact plus 0,5 m/s, puis ne fait que baisser)
  if (nom === 'trip') {
    j.cap = h;
    lancerGeste(j, 'trip', { taux: 1.5, rm: true, echelle: clamp(s / 3.4, 0.5, 1.4), type: 'chute', donnees: { vLim: s + 0.5 } });
  } else {
    // (de côté ou en arrière : le corps garde son cap, il est emporté par sa course)
    lancerGeste(j, nom, { taux: TAUX_CHUTE[nom] ?? 1.4, depuis: DEPUIS_CHUTE[nom] ?? 0, type: 'chute', donnees: { vLim: Math.min(6, s + 0.5), glisse: { x: s > 0.3 ? j.v.x / s : 0, z: s > 0.3 ? j.v.z / s : 0 } } });
  }
  j.mode = 'sol';
  j.solT = 0;
  j.d = 0;
  j.recup = 3;
}

/** Le relevé, selon la pose au sol du clip qui finit. */
export function relever(j, apres) {
  const nom = RELEVES[apres] && CLIPS[RELEVES[apres]] ? RELEVES[apres] : 'getup';
  const r = RELEVE[nom];
  lancerGeste(j, nom, { taux: r.taux, depuis: r.depuis, type: 'releve', fin: (r.fin ?? 1) * duree(nom), donnees: { debout: r.debout } });
  j.mode = 'releve';
  j.v.x = 0; j.v.z = 0;
}

/**
 * Trébucher (déséquilibre sans chute) : le déséquilibre en course de shove_reaction (le corps part en avant, se
 * rattrape sur ses appuis, reste debout), à la vitesse d'avant le contact au plus, puis la course reprend.
 */
export function trebucher(j) {
  if (j.mode !== 'loco') return;
  const s = hypot(j.v.x, j.v.z);
  if (s > 0.3) j.cap = atan2(j.v.x, j.v.z);
  const nom = CLIPS.stagger ? 'stagger' : 'trip';
  if (nom === 'trip') lancerGeste(j, 'trip', { taux: 1.6, rm: true, echelle: clamp(s / 3.4, 0.4, 1.1), type: 'trebuche', fin: 0.45 * duree('trip'), donnees: { vLim: s + 0.5 } });
  else {
    // (le clip avance de 2,5 m en 2,4 s : son root motion est mis à l'échelle de la course, 1,1 s de clip à 1,5 fois)
    const fin = 1.1, vClip = Math.max(0.3, racineA('stagger', fin, tmp).z / fin);
    lancerGeste(j, 'stagger', { taux: 1.5, rm: true, echelle: clamp((0.8 * s) / (vClip * 1.5), 0.3, 3), type: 'trebuche', fin, donnees: { vLim: s + 0.5 } });
  }
  j.recup = Math.max(j.recup, 0.5);
}

function vitesseVoulue(j, it, balle) {
  let v = it.allure * C.vTrot + it.sprint * (C.vSprint - C.vTrot);
  if (balle) v = Math.min(v * C.balleV, C.vSprintBalle);
  if (it.contenir) v = Math.min(v, C.vChasse);
  if (it.protege) v = Math.min(v, C.vProtege);
  if (j.plante > 0) v = Math.min(v, 0.6);
  // (bola-app#26, lot 2) tenu par le maillot (ou en train de tenir) : 15 % d'allure en moins
  if (j.tireF > 0) v *= 1 - DUELS.tirage.frein;
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
  j.crochetT = Math.max(0, (j.crochetT ?? 0) - dt);
  if (j.tireF > 0) { j.tireF = Math.max(0, j.tireF - dt); if (j.tireF === 0) j.tirePar = null; }
  if (j.leve > 0) j.leve = Math.max(0, j.leve - dt); // (lot 2) vient de se relever : il se dégage seul des autres
  j.d = Math.max(0, j.d - C.retourDes * dt);

  if (j.mode === 'geste' || j.mode === 'sol' || j.mode === 'releve' || j.mode === 'pivot') pasGeste(j, dt);
  else {
    let s = hypot(j.v.x, j.v.z);
    let h = s > 0.05 ? atan2(j.v.x, j.v.z) : j.cap;
    const veut = (it && (it.dx || it.dz) && it.allure > 0.02) || j.crochetT > 0;
    const vc = veut ? vitesseVoulue(j, it, balle) : 0;
    const accF = 1 - 0.6 * clamp(j.d, 0, 1);
    const aLat = C.aLat * (balle ? C.balleLat : 1) * accF;
    if (j.mode === 'frein') {
      // freinage planté avant le pivot
      s = Math.max(0, s - C.freinPlante * dt);
      if (s <= C.pivotEntree) {
        j.v.x = sin(h) * s; j.v.z = cos(h) * s;
        j.cap = h;
        // (joué 1,3 fois plus vite que la capture : sa mise en garde, jambes écartées, ne dure plus 0,4 s)
        const g = lancerGeste(j, 'turn180', { taux: 1.3, type: 'pivot', donnees: { s0: s, h0: h, cible: j.cible } });
        j.mode = 'pivot';
        g.cap0 = h;
      } else { j.v.x = sin(h) * s; j.v.z = cos(h) * s; j.cap = h; }
    } else if (!veut) {
      s = Math.max(0, s - C.frein * dt);
      j.v.x = sin(h) * s; j.v.z = cos(h) * s;
    } else {
      // (le crochet : la course va vers crochetH, quoi que dise le stick, le temps de virer)
      const hv = j.crochetT > 0 ? j.crochetH : atan2(it.dx, it.dz);
      const delta = enrouler(hv - h);
      const ad = Math.abs(delta);
      if (j.crochetT > 0) {
        // virage sur les appuis : 8 rad/s au plus, vitesse tenue sous 4 m/s
        h += clamp(delta, -8 * dt, 8 * dt);
        s = Math.min(Math.max(s, 1.5), 4);
        j.v.x = sin(h) * s; j.v.z = cos(h) * s;
      } else if (!it.contenir && !it.protege && s > C.pivotVitesse && ad > (150 * Math.PI) / 180) {
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
      const maxc = j.crochetT > 0 ? 10 : sp >= 0.6 && !(it?.contenir || it?.protege) ? Math.max(C.capMax, Math.min(C.lacetMax, aLat / Math.max(0.1, sp)) * 1.5) : C.capMax;
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
    // une chute (ou un trébuchement) : bornée à la vitesse d'avant le contact (+ 1 m/s), et jamais de réaccélération
    const lim = g.donnees?.vLim;
    if (lim != null) {
      const sv = hypot(j.v.x, j.v.z);
      if (sv > lim) { j.v.x *= lim / sv; j.v.z *= lim / sv; }
      // (le corps qui tombe freine dès le contact : 4 m/s², puis le frottement au sol ; il ne glisse plus en plongeon)
      g.donnees.vLim = Math.max(0, Math.min(lim, sv) - 4 * dt);
    }
    // un autre corps devant (contacts.js) : le geste ne passe pas au travers
    if (j.bloqueT > 0) {
      const vn = j.v.x * j.bloque.x + j.v.z * j.bloque.z;
      if (vn > 0) { j.v.x -= vn * j.bloque.x; j.v.z -= vn * j.bloque.z; }
    }
  } else if (g.donnees?.glisse) {
    // une chute (ou une glissade de tacle) sans root motion : le corps file dans sa direction, freiné de 4 m/s², de
    // 7 m/s² (5 pour la glissade, sur le dos) une fois les hanches au sol ; jamais de réaccélération
    const G = g.donnees.glisse, auSol = hancheA(g.nom, g.t) < 0.4;
    const sv = Math.max(0, Math.min(g.donnees.vLim, hypot(j.v.x, j.v.z)) - (auSol ? (g.type === 'tacle' ? C.freinGlissade : 7) : 4) * dt);
    g.donnees.vLim = sv;
    j.v.x = G.x * sv; j.v.z = G.z * sv;
    // (une chute ne passe pas à travers un corps debout ; la glissade du tacle, elle, passe dessous : ce sont ses
    // jambes qui touchent, contacts.js)
    if (j.bloqueT > 0 && g.type !== 'tacle') {
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
    if (g.t >= duree(g.nom)) {
      // au sol : la pose de fin tenue, frottement 7 m/s² (le root motion est fini), puis le relevé
      g.t = duree(g.nom);
      if (g.rm) g.rm = false;
      if (!g.donnees?.glisse) { const sv = hypot(j.v.x, j.v.z); if (sv > 0) { const ns = Math.max(0, sv - 7 * dt); j.v.x *= ns / sv; j.v.z *= ns / sv; } }
      j.solT += dt;
      // (la glissade du tacle : relevé dès que le corps s'arrête ; une chute : après solChute au sol)
      const arrete = hypot(j.v.x, j.v.z) < (g.type === 'tacle' ? 0.9 : 0.3);
      if (g.type === 'tacle' ? arrete && j.solT > 0.1 : j.solT > C.solChute) relever(j, g.nom);
    }
    return;
  }
  if (j.mode === 'releve') {
    j.v.x = 0; j.v.z = 0;
    if (g.t >= (g.donnees?.debout ?? 0.9) * duree(g.nom)) j.recup = Math.min(j.recup, 0.05);
    if (g.t >= g.fin - 1e-6) { j.g = null; j.mode = 'loco'; j.leve = 0.5; }
    return;
  }
  if (fini) {
    if (g.type === 'pivot') { j.g = null; j.mode = 'loco'; return; }
    // (correctifs #26) le ciseau et le retourné finissent au sol : le clip va au bout, couché, puis le relevé du dos
    // (avant : debout en 0,13 s, sans relevé)
    if (g.type === 'frappe' && AU_SOL.test(g.nom)) { j.mode = 'sol'; j.solT = 0; j.recup = 3; return; }
    finirGeste(j);
  }
}

/** Le joueur peut-il toucher la balle (ni au sol, ni en train de se relever, ni en plein geste qui l'occupe) ? */
export const libre = (j) => (j.mode === 'loco' || j.mode === 'frein') && j.recup <= 0;
