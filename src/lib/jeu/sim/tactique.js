// Les tactiques et les postes du cinq (bola-app#32, lot B ; points 2, 3 et 14 de la demande, « stratégie visible » du
// retour de Sabri sur le streaming). Pur : ni three, ni DOM ; lu par l'IA (sim/ia.js), le monde (sim/monde.js : la
// possession, la croix des humains), la page (le libellé du plan) et les bancs.
//
// Ce qui vient des méthodes d'entraînement du futsal (recherche du 18/11, sources dans le compte rendu de #32) :
//   · les postes du cinq : un fixo (le dernier, l'équilibre), deux alas (la largeur), un pivot (la profondeur, l'appui
//     haut) ; en attaque, le losange 1-2-1 / 3-1 ; les postes sont des PLACES et non des joueurs : ils tournent (le fixo
//     qui monte avec la balle est remplacé derrière par l'ala le plus proche ; il y a toujours quelqu'un derrière la
//     balle) — postesAttaque, cibleAttaque ;
//   · la défense de zone : un presseur, un couvreur, la ligne de passe la plus dangereuse coupée, un joueur d'équilibre
//     côté faible ; le bloc compact, à la hauteur que donne le plan (pressing haut, bloc médian, bloc bas) et des
//     déclencheurs de pressing (porteur dos au but, contre le panneau, contrôle raté, passe en retrait) — PLANS ;
//   · les transitions : après la perte, le plus proche contre-presse un court instant, les autres rentrent au sprint
//     derrière la balle ; après la récupération, on cherche la verticale (phaseDe, la possession du monde).
//
// Les plans (PLANS) : la hauteur du bloc (bas : la place du dernier défenseur quand la balle est loin, en m d'avancée ;
// haut : le haut du bloc), l'endroit où le presseur sort sur le porteur (sortie : la balle à moins de « sortie » m
// d'avancée ; ailleurs il attend en haut du bloc, sur la ligne balle → but), le second presseur (double), la durée du
// contre-pressing après une perte (contre, s), la largeur du bloc (largeur, m) et la place du joueur qui coupe la ligne
// de passe (ligne : la part du chemin porteur → receveur). Les styles (STYLES) : le seuil de frappe (la chance de but
// estimée à partir de laquelle on tire), le goût de la progression, des passes longues et de la profondeur.
//
// Repère : pour l'équipe e, l'avancée a = z × sens(e) (−15 m sur sa propre ligne de but, +15 m sur celle d'en face) ;
// x est la largeur (± 10 m aux panneaux). Une équipe jouée par l'IA s'adapte au score et au temps (majTactiques : perdante
// dans le dernier tiers, pressing et jeu direct ; menante dans le dernier quart, bloc bas et jeu court) ; un humain choisit
// son plan à la croix (choisirPlan), son choix tient jusqu'à la fin du match.
import { BUT_DL, LB, sens, butDe } from './constantes.js';
import { atan2, exp, hypot, log } from './maths.js';

export const PLANS = {
  pressing: { id: 'pressing', nom: 'Pressing', bas: -1, haut: 12, sortie: 15, double: 'toujours', contre: 2.0, largeur: 13, ligne: 0.5, vPresse: 7.2 },
  equilibre: { id: 'equilibre', nom: 'Équilibre', bas: -8, haut: 1.5, sortie: 0.5, double: 'declencheur', contre: 1.0, largeur: 11, ligne: 0.72, vPresse: 6.6 },
  blocBas: { id: 'blocBas', nom: 'Bloc bas', bas: -11, haut: -4, sortie: -4.5, double: 'surface', contre: 0, largeur: 9, ligne: 0.82, vPresse: 6.4 },
};
export const ORDRE_PLANS = ['pressing', 'equilibre', 'blocBas'];
export const STYLES = {
  // court : la possession, la passe courte au pied, la frappe sur une vraie occasion
  court: { id: 'court', nom: 'Jeu court', seuilFrappe: 0.10, progression: 0.7, longue: 1.0, profondeur: 0.8, garder: 0.06 },
  // direct : la verticale, la profondeur et les passes longues, la frappe plus tôt
  direct: { id: 'direct', nom: 'Jeu direct', seuilFrappe: 0.07, progression: 1.25, longue: 0.45, profondeur: 1.35, garder: 0 },
};

/** La tactique d'une équipe : son plan et son style de départ, ce qu'elle joue maintenant. */
export function creerTactique(plan = 'equilibre', style = 'court') {
  return { base: plan, style0: style, plan, style, choisi: null, majT: -9 };
}

/** (lot B) La tactique d'une équipe de l'IA tirée de la graine (flux « tactique ») : un plan sur trois, un style sur deux. */
export function tactiqueTiree(rng) {
  const u = rng.u(), v = rng.u();
  return creerTactique(u < 0.4 ? 'equilibre' : u < 0.7 ? 'pressing' : 'blocBas', v < 0.55 ? 'court' : 'direct');
}

export const planDe = (m, e) => PLANS[m.tactique?.[e]?.plan] ?? PLANS.equilibre;
export const styleDe = (m, e) => STYLES[m.tactique?.[e]?.style] ?? STYLES.court;
/** L'avancée d'un z pour l'équipe e (−15 sur sa ligne de but, +15 sur celle d'en face), et l'inverse. */
export const av = (e, z) => z * sens(e);
export const zDe = (e, a) => a * sens(e);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** Un humain choisit le plan de son équipe (la croix ; 1 2 3 au clavier) : il tient jusqu'à la fin du match. */
export function choisirPlan(m, e, plan) {
  const T = m.tactique?.[e];
  if (!T || !PLANS[plan]) return false;
  T.choisi = plan;
  if (T.plan !== plan) { T.plan = plan; m.ev('tactique', { e, plan, style: T.style, auto: false }); }
  else m.ev('tactique', { e, plan, style: T.style, auto: false, meme: true });
  return true;
}

/**
 * Une fois par pas de jeu : la possession (qui a la balle, depuis quand ; la perte et la récupération de chaque
 * équipe), et, une fois par seconde, l'adaptation au score et au temps. La balle en route vers un receveur reste à son
 * équipe ; une balle libre laisse la possession à la dernière équipe qui l'a eue.
 */
export function majTactiques(m, p) {
  const b = m.balle;
  const P = (m.possession ??= { e: null, t: 0, perte: [-9, -9], recup: [-9, -9], pertePos: [null, null] });
  let e = null;
  if (p) e = p.e;
  else if (b.garde != null) e = m.joueurs[b.garde].e;
  else if (b.recepteur != null) e = m.joueurs[b.recepteur].e;
  if (e != null && e !== P.e) {
    if (P.e != null) { P.perte[P.e] = m.t; P.pertePos[P.e] = { x: b.p.x, z: b.p.z }; }
    P.recup[e] = m.t; P.e = e; P.t = m.t;
  }
  if (!m.tactique) return;
  for (const q of [0, 1]) {
    const T = m.tactique[q];
    if (m.t < T.majT) continue;
    T.majT = m.t + 1;
    const r = m.reste / (m.duree || 1), d = m.score[q] - m.score[1 - q];
    let plan = T.choisi ?? T.base, style = T.style0;
    if (d < 0 && r < 0.34) { if (!T.choisi) plan = 'pressing'; style = 'direct'; }
    else if (d <= -2 && r < 0.6) { if (!T.choisi) plan = 'pressing'; }
    else if (d > 0 && r < 0.25) { if (!T.choisi) plan = 'blocBas'; style = 'court'; }
    if (plan !== T.plan || style !== T.style) {
      T.plan = plan; T.style = style;
      m.stats.tactiques = (m.stats.tactiques ?? 0) + 1;
      m.ev('tactique', { e: q, plan, style, auto: !T.choisi });
    }
  }
}

/**
 * La phase de jeu de l'équipe e : 'attaque' (elle a la balle), 'transOff' (elle vient de la récupérer, 2,5 s),
 * 'defense', 'transDef' (elle vient de la perdre, 2,5 s), 'libre' (personne ne l'a encore eue).
 */
export function phaseDe(m, e) {
  const P = m.possession;
  if (!P || P.e == null) return 'libre';
  if (P.e === e) return m.t - P.recup[e] < 2.5 ? 'transOff' : 'attaque';
  return m.t - P.perte[e] < 2.5 ? 'transDef' : 'defense';
}

/** La balle, ou le porteur (sa position), vue par l'équipe e : x, avancée a. */
function balleVue(m, e, p) {
  const b = m.balle, q = p ?? (b.garde != null ? m.joueurs[b.garde] : null);
  const x = q ? q.p.x : b.p.x, z = q ? q.p.z : b.p.z;
  return { x, a: av(e, z) };
}

/** Le côté de la balle (−1 ou 1), tenu tant qu'elle est dans l'axe (à moins de 1,2 m du milieu). */
function coteBalle(m, e, x) {
  const C = (m._cote ??= [1, 1]);
  if (Math.abs(x) > 1.2) C[e] = x > 0 ? 1 : -1;
  return C[e];
}

const POSTES = ['fixo', 'aileBalle', 'aileFaible', 'pivot'];
/**
 * La place d'un poste d'attaque de l'équipe e (repère du jeu), pour la balle en (xB, aB) : le losange 1-2-1 qui suit la
 * balle. Le fixo 6,5 m derrière la balle, du côté de la balle (la passe en retrait, l'équilibre) ; l'ala côté balle
 * le long du panneau (x = ± 7,2 m), un peu devant la balle ; l'ala côté faible plus rentré, qui attaque le second
 * poteau quand la balle approche du but ; le pivot 6,5 m devant la balle, entre +4,5 et +11,5 m (le second point de
 * pénalty du futsal, à l'échelle), légèrement à l'opposé de la balle ; près du but, il s'écarte côté faible, ou attaque
 * le second poteau si la balle est sur un côté.
 */
export function placePoste(m, e, poste, xB, aB, out = { x: 0, z: 0 }) {
  const s = coteBalle(m, e, xB);
  let x, a;
  if (poste === 'fixo') { a = clamp(aB - 6.5, -10.5, 3); x = clamp(xB * 0.3, -3.5, 3.5); }
  else if (poste === 'pivot') {
    // (près du but, il s'écarte de l'axe d'un porteur central, côté faible : il ouvre l'angle de passe et l'espace de la
    // frappe ; le porteur sur un côté, il attaque le second poteau, pour le centre)
    const k = clamp((aB - 4) / 4, 0, 1), flanc = clamp((Math.abs(xB) - 2.5) / 2.5, 0, 1);
    a = clamp(aB + 6.5, 4.5, 11.5) + k * flanc; x = clamp(-xB * 0.25 * (1 - k) - s * k * (2.8 - 1.8 * flanc), -4, 4);
  }
  else if (poste === 'aileBalle') { a = clamp(aB + 2, -7, 10.5); x = s * 7.2; }
  else {
    const k = clamp((aB - 4) / 5, 0, 1);
    a = clamp(aB + 3.5, -5, 10) * (1 - k) + 11 * k; x = -s * (5.2 - 2.4 * k);
  }
  out.x = x; out.z = zDe(e, a);
  return out;
}

/**
 * La répartition des postes d'attaque de l'équipe e (toutes les 0,3 s) : le porteur tient le sien (le fixo s'il est le
 * dernier de son équipe, sinon le poste d'attaque le plus proche de lui) ; les autres prennent les postes restants par
 * la répartition de plus courte distance totale, et ne permutent que si elle est plus courte de 2,5 m au moins (les
 * rotations, sans hésitation). j.poste est le poste de chaque joueur de champ.
 */
export function postesAttaque(m, e, p) {
  const S = (m._postes ??= [{ t: -9 }, { t: -9 }])[e];
  if (m.t < S.t) return;
  S.t = m.t + 0.3;
  const B = balleVue(m, e, p);
  const js = [];
  for (const j of m.joueurs) if (j.e === e && !j.gardien && !j.absent) js.push(j);
  let postes = POSTES;
  const autres = [];
  const ici = { x: 0, z: 0 };
  const porteurE = p && p.e === e && !p.gardien ? p : null;
  for (const j of js) {
    if (j !== porteurE) { autres.push(j); continue; }
    let dernier = true;
    for (const o of js) if (o !== j && av(e, o.p.z) < av(e, j.p.z) - 0.5) dernier = false;
    let pp = 'fixo';
    if (!dernier) {
      let bd = Infinity;
      for (const k of POSTES) {
        if (k === 'fixo') continue;
        placePoste(m, e, k, B.x, B.a, ici);
        const d = hypot(ici.x - j.p.x, ici.z - j.p.z) - (j.poste === k ? 1.5 : 0);
        if (d < bd) { bd = d; pp = k; }
      }
    }
    j.poste = pp;
    postes = POSTES.filter((k) => k !== pp);
  }
  if (!autres.length) return;
  // les places des postes restants, puis la répartition la plus courte (au plus 4! = 24 permutations)
  const places = postes.map((k) => { const o = placePoste(m, e, k, B.x, B.a, { x: 0, z: 0 }); return { k, x: o.x, z: o.z }; });
  const n = autres.length;
  let best = null, bc = Infinity, cur = 0, curOk = true;
  const vus = new Set();
  for (const j of autres) {
    const pl = places.find((q) => q.k === j.poste);
    if (!pl || vus.has(j.poste)) { curOk = false; break; }
    vus.add(j.poste); cur += hypot(pl.x - j.p.x, pl.z - j.p.z);
  }
  const choix = new Array(n), pris = new Array(places.length).fill(false);
  const essayer = (i, c) => {
    if (c >= bc) return;
    if (i === n) { bc = c; best = choix.slice(); return; }
    for (let k = 0; k < places.length; k++) {
      if (pris[k]) continue;
      pris[k] = true; choix[i] = k;
      essayer(i + 1, c + hypot(places[k].x - autres[i].p.x, places[k].z - autres[i].p.z));
      pris[k] = false;
    }
  };
  essayer(0, 0);
  if (curOk && cur < bc + 2.5) return;
  for (let i = 0; i < n; i++) {
    const avant = autres[i].poste;
    autres[i].poste = places[best[i]].k;
    if (avant && avant !== autres[i].poste) m.stats.rotations = (m.stats.rotations ?? 0) + 1;
  }
}

/** La place du poste d'attaque du joueur j, pour la balle (ou le porteur p) maintenant. */
export function cibleAttaque(m, j, p, out = { x: 0, z: 0 }) {
  postesAttaque(m, j.e, p);
  const B = balleVue(m, j.e, p);
  return placePoste(m, j.e, j.poste ?? 'aileFaible', B.x, B.a, out);
}

/**
 * La chance de but d'une frappe depuis (x, z) pour l'équipe e (0 à 0,7) : l'angle du but ouvert et la distance
 * (0,9 × angle^1,2 × e^(−d/9) : 0,59 à 3 m dans l'axe, 0,20 à 6 m, 0,07 à 10 m, 0,04 à 13 m), × 0,6 par adversaire
 * de champ debout sur la ligne du but ; 0 derrière la ligne. Le banc (et l'IA) la lisent.
 */
export function chanceBut(m, e, x, z, sauf = null) {
  const zb = butDe(1 - e);
  const dz = Math.abs(zb - z);
  if ((z - zb) * Math.sign(zb) > -0.3) return 0;
  const a1 = atan2(-BUT_DL - x, dz), a2 = atan2(BUT_DL - x, dz);
  const ouvert = Math.abs(a2 - a1);
  if (ouvert < 0.02) return 0;
  const d = hypot(x, dz);
  let c = 0.9 * exp(1.2 * log(ouvert)) * exp(-d / 9);
  for (const o of m.joueurs) {
    if (o.absent || o.e === e || o.gardien || o === sauf || o.mode === 'sol') continue;
    const ex = -x, ez = zb - z, E = ex * ex + ez * ez || 1;
    const u = clamp(((o.p.x - x) * ex + (o.p.z - z) * ez) / E, 0, 1);
    if (u > 0.04 && hypot(o.p.x - x - ex * u, o.p.z - z - ez * u) < 0.8) c *= 0.6;
  }
  return clamp(c, 0, 0.7);
}

export { LB };
