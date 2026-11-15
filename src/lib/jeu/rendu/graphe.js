// Le graphe d'animation d'un joueur (bola-app#26) : une machine à états qui dit, à chaque image, quels clips jouer,
// à quel temps et avec quel poids. Sans three : rendu/animateur.js l'applique au squelette, tools/jeu-banc-anim.ts le
// contrôle hors navigateur.
//
// Les transitions viennent de la simulation (le mode du corps et son geste : sim/corps.js) ; le graphe n'invente
// rien de ce qui change le jeu. Il ajoute seulement trois états de rendu, pris dans la locomotion quand la
// simulation ne joue aucun geste, et toujours calés sur le mouvement réel :
//   · départ (two_cycle_sprint) : un joueur arrêté qui démarre fort ; le temps du clip suit la distance parcourue
//     (la table de son root motion, inversée), pas l'horloge : les pieds ne glissent pas, quelle que soit l'accélération ;
//   · arrêt (run_to_stop) : un joueur lancé qui freine pour s'arrêter ; le temps suit la distance qui reste
//     jusqu'à l'arrêt (v² / 2 a) ;
//   · demi-tour sur place (quick_180_turn, lacet retiré) : un joueur presque arrêté qui se retourne ; le temps suit
//     l'angle déjà tourné par la simulation (la courbe de lacet du clip, inversée).
//
// États (catégorie) : loco, depart, arret, demitour, geste (passe, frappe, contrôle, roulette…), chute, tacle, sol,
// releve, pivot, fete, gardien (plongeons, arrêts, relances). Chaque changement d'état fond les clips l'un dans
// l'autre (jamais de poids qui saute, sauf quand la racine du corps saute : fin de plongeon) :
//   · l'entrée prend la durée de FONDUS[de][vers] ;
//   · la sortie vers la course est calée sur la phase du pas : elle finit quand le pied qui porte le corps dans la
//     dernière pose du geste est aussi en appui dans le cycle de course (dureeSortie), entre 0,12 et 0,35 s (0,6 à
//     0,8 s au trot lent) ;
//   · pendant son fondu de sortie, un clip continue à son rythme (le geste se termine, il ne se fige pas).
import { CLIPS } from '../sim/clips.js';
import { longueurFoulee } from '../sim/corps.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** Les durées de fondu (s) d'une catégorie à l'autre ; « * » : toute autre. */
export const FONDUS = {
  loco: { geste: 0.1, chute: 0.08, tacle: 0.1, pivot: 0.1, depart: 0.12, arret: 0.15, demitour: 0.12, fete: 0.3, gardien: 0.08, '*': 0.12 },
  depart: { loco: 0.22, '*': 0.1 },
  arret: { loco: 0.25, depart: 0.15, '*': 0.1 },
  demitour: { loco: 0.2, depart: 0.15, '*': 0.1 },
  geste: { geste: 0.1, chute: 0.06, tacle: 0.08, '*': 0.1 },
  chute: { sol: 0.2, releve: 0.3, '*': 0.15 },
  tacle: { releve: 0.3, '*': 0.15 },
  sol: { releve: 0.3, '*': 0.2 },
  releve: { loco: 0.3, '*': 0.2 },
  pivot: { loco: 0.15, '*': 0.1 },
  fete: { '*': 0.3 },
  gardien: { gardien: 0.1, '*': 0.15 },
};
export const fondu = (de, vers) => (FONDUS[de]?.[vers] ?? FONDUS[de]?.['*'] ?? 0.12);

/** La catégorie d'un geste de la simulation (type du geste, et mode du corps). */
export function categorie(mode, type) {
  if (mode === 'releve' || type === 'releve') return 'releve';
  if (type === 'tacle') return 'tacle';
  if (mode === 'sol' || type === 'chute') return 'chute';
  if (mode === 'pivot' || type === 'pivot') return 'pivot';
  if (type === 'fete') return 'fete';
  if (type === 'plongeon' || type === 'arret' || type === 'relance' || type === 'battu') return 'gardien';
  return 'geste';
}

/** Le pied (0, 1) est-il en appui à la part u d'un clip (table des appuis, sim/clips.js) ? */
export function enAppui(nom, u, pied) {
  const iv = CLIPS[nom]?.appuis?.[pied];
  if (!iv) return false;
  for (const [a, b] of iv) { if (a <= b ? u >= a && u <= b : u >= a || u <= b) return true; }
  return false;
}
/** Le décalage de phase d'un cycle : l'instant (part du clip) où le pied gauche se pose. */
export function calage(nom) {
  return CLIPS[nom]?.appuis?.[0]?.[0]?.[0] ?? 0;
}
/** La part du cycle nom à la phase de foulée φ (comme corps.js, piedLoco). */
export function partCycle(nom, phase) {
  return nom === 'drib' ? (((phase / 2) + calage(nom)) % 1 + 1) % 1 : ((phase % 1) + calage(nom)) % 1;
}
/** La hauteur (m) du pied p d'un clip au temps t (table des pieds). */
export function hauteurPied(nom, t, p) {
  const c = CLIPS[nom];
  if (!c) return 0;
  const f = clamp(t / c.dur, 0, 1) * (c.n - 1), i = Math.min(c.n - 2, Math.floor(f)), a = f - i;
  const y0 = c.pieds[i * 6 + p * 3 + 1], y1 = c.pieds[(i + 1) * 6 + p * 3 + 1];
  return (y0 + (y1 - y0) * a) / 100;
}

/**
 * La durée du fondu de sortie d'un geste vers la course : le pied le plus bas de la dernière pose du geste (celui qui
 * porte le corps) doit être en appui dans le cycle de course quand le fondu finit. On cherche ce moment dans les 0,35 s
 * qui viennent, à la cadence actuelle (la phase avance de dPhase par seconde) ; sinon 0,25 s.
 */
export function dureeSortie(geste, tGeste, cycle, phase, dPhase) {
  if (!cycle || !CLIPS[cycle]?.appuis || dPhase < 0.2) return { duree: 0.25, pied: -1, trouve: false };
  const h0 = hauteurPied(geste, tGeste, 0), h1 = hauteurPied(geste, tGeste, 1);
  // (les deux pieds posés dans la pose du geste, à 3 cm près : l'un ou l'autre convient)
  const pieds = Math.abs(h0 - h1) < 0.03 ? [0, 1] : [h0 <= h1 ? 0 : 1];
  // (plus le pas est lent, plus on attend l'appui : jusqu'à 0,6 s au trot lent)
  const dMax = dPhase > 1.5 ? 0.35 : dPhase > 1 ? 0.6 : 0.8;
  for (let d = 0.12; d <= dMax; d += 1 / 60) {
    for (const pied of pieds) if (enAppui(cycle, partCycle(cycle, phase + dPhase * d), pied)) return { duree: d, pied, trouve: true };
  }
  return { duree: 0.25, pied: pieds[0], trouve: false };
}

/** La vitesse de la phase de foulée (par seconde) à la vitesse s, balle au pied ou non (comme corps.js). */
export function vitessePhase(s, balle) {
  if (s <= 0) return 0;
  const balleL = balle && s < 4.4 ? 2.2 / longueurFoulee(2.54) : 1;
  return s / (longueurFoulee(s) * balleL);
}

/** Une courbe de lacet (turn) sans saut de 2π (le dernier point d'un clip miroir peut en porter un). */
const lacets = new Map();
function lacetPropre(nom) {
  if (lacets.has(nom)) return lacets.get(nom);
  const tr = CLIPS[nom]?.turn;
  if (!tr) return null;
  const out = [tr[0]];
  for (let i = 1; i < tr.length; i++) { let d = tr[i] - tr[i - 1]; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; out.push(out[i - 1] + d); }
  lacets.set(nom, out);
  lacetsAbs.set(nom, out.map(Math.abs));
  return out;
}
const lacetsAbs = new Map();

/** Inverse d'une courbe croissante échantillonnée (tab, n images sur dur s) : le temps où elle vaut v. */
function inverser(tab, n, stride, off, v, dur) {
  if (!tab) return 0;
  const v0 = tab[off], vn = tab[(n - 1) * stride + off];
  const sens = vn >= v0 ? 1 : -1;
  for (let i = 1; i < n; i++) {
    const a = tab[(i - 1) * stride + off] * sens, b = tab[i * stride + off] * sens;
    if (b >= v * sens) return ((i - 1) + clamp((v * sens - a) / ((b - a) || 1e-9), 0, 1)) / (n - 1) * dur;
  }
  return dur;
}

/**
 * Crée la machine d'un joueur. maj(e, dt) → { etat, clip: { nom, t } | null, saut } : l'état de rendu choisi et le clip
 * à jouer à ce temps (null : la locomotion seule). e : l'état d'animation (rendu/etat.js).
 */
export function creerGraphe({ gardien = false } = {}) {
  const g = { etat: 'loco', depuis: 0, clip: null, d0: 0, cap0: 0, tour: 0, dist: 0, repos: 9 };
  let sPrec = 0, capPrec = null;
  // (correctifs #26) repos : le temps depuis la sortie d'un état autre que la course (geste, départ, arrêt…) ; on n'y
  // rentre (départ, arrêt, demi-tour) pas avant 0,3 s, et on y reste 0,12 à 0,15 s au moins (sinon six états en
  // 0,12 s entre 0,3 et 0,9 m/s : le graphe hésitait)
  const rend = (etat, clip) => { if (etat !== g.etat) { if (g.etat !== 'loco') g.repos = 0; g.etat = etat; g.depuis = 0; } g.clip = clip; return g; };

  function maj(e, dt) {
    g.depuis += dt; g.repos += dt;
    const reposOk = g.repos > 0.3;
    const s = Math.hypot(e.vx, e.vz);
    let dcap = 0;
    if (capPrec != null) { dcap = e.cap - capPrec; while (dcap > Math.PI) dcap -= 2 * Math.PI; while (dcap < -Math.PI) dcap += 2 * Math.PI; }
    capPrec = e.cap;
    const sP = sPrec; sPrec = s;
    // un geste de la simulation : il commande
    if (e.geste) return rend(categorie(e.mode, e.geste.type), { nom: e.geste.nom, t: e.geste.t });
    if (gardien) return rend('loco', null);
    const libre = e.mode === 'loco' || e.mode === 'frein';
    // le départ : arrêté (sous 0,6 m/s), il accélère fort (sans balle : la conduite a son cycle)
    if (g.etat !== 'depart' && reposOk && libre && !e.balle && CLIPS.start && sP < 0.6 && s >= 0.6 && (e.aLong ?? 0) > 2.5) { g.dist = 0; rend('depart', null); }
    if (g.etat === 'depart') {
      g.dist += s * dt;
      const c = CLIPS.start;
      const t = inverser(c.root, c.n, 2, 1, g.dist, c.dur);
      // (il sort du départ après deux appuis, à 5 m/s, sur un changement de direction ou en freinant)
      // (correctifs #26 : tenu 0,15 s au moins, sauf s'il n'est plus libre ou prend la balle)
      if (!libre || e.balle || (g.depuis >= 0.15 && (t > 0.72 * c.dur || s > 5.2 || (e.aLong ?? 0) < -1 || Math.abs(dcap) > 3 * dt))) return rend('loco', null);
      return rend('depart', { nom: 'start', t });
    }
    // l'arrêt : lancé (plus de 2,5 m/s), il freine fort (le frein de la simulation, sans intention)
    if (g.etat !== 'arret' && reposOk && libre && !e.balle && CLIPS.stop && s > 2.2 && s < 4.5 && (e.aLong ?? 0) < -5 && e.mode === 'loco') {
      g.d0 = (s * s) / (2 * Math.max(4, -(e.aLong ?? 8)));
      rend('arret', null);
    }
    if (g.etat === 'arret') {
      const c = CLIPS.stop;
      const total = Math.hypot(c.root[(c.n - 1) * 2], c.root[(c.n - 1) * 2 + 1]);
      const reste = (s * s) / (2 * Math.max(4, -(e.aLong ?? 8)));
      const u = clamp(1 - reste / Math.max(0.05, g.d0), 0, 1);
      const t = inverser(c.root, c.n, 2, 1, u * total, c.dur);
      // (correctifs #26 : il sort aussi dès qu'il ne freine plus, ou que l'arrêt s'éloigne ; avant, le clip d'arrêt
      // jouait 0,6 s sur un joueur qui filait à 3,2 m/s, les deux pieds patinaient)
      const plusDeFrein = (e.aLong ?? 0) > -1.5 && g.depuis > 0.12;
      if (!libre || e.balle || (g.depuis >= 0.12 && ((s < 0.15 && g.depuis > 0.3) || (e.aLong ?? 0) > 1.5 || plusDeFrein || reste > g.d0 * 1.15 || g.depuis > 1.5))) return rend('loco', null);
      return rend('arret', { nom: 'stop', t: Math.min(t, c.dur * 0.98) });
    }
    // le demi-tour sur place : presque arrêté, le cap tourne vite (la simulation tourne le corps : 6 rad/s)
    if (g.etat !== 'demitour' && reposOk && libre && CLIPS.turn180_std && s < 0.9 && Math.abs(dcap) > 3.5 * dt) { g.tour = 0; rend('demitour', null); }
    if (g.etat === 'demitour') {
      g.tour += dcap;
      // (le clip tourne vers sa droite, lacet négatif ; son miroir, turn180_std_l, vers sa gauche)
      const nom = g.tour > 0 && CLIPS.turn180_std_l ? 'turn180_std_l' : 'turn180_std';
      const c = CLIPS[nom], tr = lacetPropre(nom), tour = Math.abs(g.tour);
      // (la courbe de lacet du clip : 17 points ; le temps où le clip aurait tourné de ce qu'a tourné le corps)
      let t = c.dur * clamp(tour / Math.PI, 0, 1);
      if (tr) { const fin = Math.abs(tr[tr.length - 1]) || Math.PI; t = inverser(lacetsAbs.get(nom), tr.length, 1, 0, tour * fin / Math.PI, c.dur); }
      // (correctifs #26 : sur place seulement, sous 1,1 m/s ; le clip ne se déplace pas, au-delà les pieds patinent)
      if (!libre || (g.depuis >= 0.15 && (s > 1.1 || tour >= Math.PI * 0.98 || (Math.abs(dcap) < 0.5 * dt && g.depuis > 0.25) || g.depuis > 1.2))) return rend('loco', null);
      return rend('demitour', { nom, t });
    }
    return rend('loco', null);
  }
  return { maj, get etat() { return g.etat; } };
}
