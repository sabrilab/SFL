// Le totem du Maroc (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe […] le Maroc, c'est les lions de l'Atlas »).
//
// Le lion de l'Atlas (le lion de Barbarie) qui marche, de profil, vers la
// gauche, la tête portée haut : la patte avant proche levée, le poignet
// plié au-dessus du sol, la lointaine posée ; la patte arrière proche posée
// sous la hanche, le jarret net, la lointaine tendue en arrière, le talon
// levé ; la queue basse et sa touffe en flamme effilée. Les proportions d'un
// mâle : le tronc 1,25 fois la hauteur au garrot, les coudes à 0,4 de cette
// hauteur, la force à l'avant (des avant-bras épais, de gros pieds) ; un
// museau haut et carré, un long chanfrein, la truffe large et plate au ras
// du chanfrein ; l'arcade, un filet brun ; la lèvre qui descend au coin de
// la gueule (jamais un sourire).
// La crinière est celle de l'Atlas : sombre (brun-noir, une mèche verte de
// Fès sur quatre ou cinq), ample, posée en tuiles : des rangs de mèches
// épaisses (2,5 de long pour 1 de large, des longueurs inégales, quelques
// contre-courbes) qui pendent, de la poitrine à la crête du cou, chaque rang
// retombant sur les racines du rang d'en dessous, comme une pèlerine lourde ;
// la crête et le toupet couchés vers l'arrière ; sous le ventre, la frange en
// quatre paquets inégaux ; une fraise fauve claire encadre le visage. Chaque
// mèche finit par un bout rond, la moitié de sa largeur (des poils lourds, pas
// des piquants).
// Il est taillé en zellige (../maroc.tsx) : chaque mèche, chaque muscle est
// une pièce d'émail, bisautée (l'arête prend la lumière en haut à gauche,
// l'ombre en bas à droite), prise dans un joint de chaux de 4,5 ; les
// pièces du corps suivent l'anatomie (le grill costal, le flanc, la cuisse,
// la jambe, le canon et le pied ; la patte arrière lointaine n'a qu'un joint,
// au jarret) ; l'émail s'use (craquelures et piqûres,
// tirées de la graine), la silhouette ne bouge jamais.
//   · au dos : le héros. Il marche dans une niche de tadelakt (NICHE_MAROC),
//     posé sur le bandeau du logotype ; la lune et sa rosace de cèdre sont
//     montées au-dessus de lui, dans le panneau d'étoiles (LUNE_MAROC) ;
//   · à la face : le même lion, gaufré dans le coin bas du portrait, tourné
//     vers le joueur : une arête de lumière, une ombre, sans couleur, les
//     arêtes cachées coupées.
// Les tracés sont des points posés à la main, liés en béziers tendus
// (lisse), et des mèches (meche : la racine, la direction de départ et
// d'arrivée, la longueur, la largeur ; la retombée), posées une à une (la
// fraise, la frange) ou tirées d'un rang (RANGS : la crinière en tuiles).

import type { PropsTotem, TotemNation } from "../types";
import { alea, f } from "../outils";

/** La lune et sa rosace, montées au-dessus du lion, dans le panneau d'étoiles (le skin, ../maroc.tsx, les lit). */
export const LUNE_MAROC = { cx: 512, cy: 326, d: 200 } as const;
/** La niche de tadelakt où marche le lion : de y jusqu'au bandeau du logotype (le skin la dessine). */
export const NICHE_MAROC = { y: 612 } as const;

/* ------------------------------ Les tracés ------------------------------ */

/** Un point posé à la main ; 1 : un angle, 2 : un angle adouci. */
type P = readonly [number, number] | readonly [number, number, number];

/** Des points liés en béziers tendus : chaque point prend la tangente de ses voisins, les poignées valent un tiers de la corde. */
function lisse(pts: readonly P[], ferme = true): string {
  const n = pts.length;
  const at = (i: number) => (ferme ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const tangente = (i: number): [number, number] => {
    const p = at(i);
    if (p[2] === 1) return [0, 0];
    const [a, b] = !ferme && (i === 0 || i === n - 1) ? (i === 0 ? [at(0), at(1)] : [at(n - 2), at(n - 1)]) : [at(i - 1), at(i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = p[2] === 2 ? 0.5 : 1;
    return [((b[0] - a[0]) / l) * k, ((b[1] - a[1]) / l) * k];
  };
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < (ferme ? n : n - 1); i++) {
    const [p, q] = [at(i), at(i + 1)];
    const c = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3;
    const [u, v] = [tangente(i), tangente(i + 1)];
    d += `C${f(p[0] + u[0] * c)} ${f(p[1] + u[1] * c)} ${f(q[0] - v[0] * c)} ${f(q[1] - v[1] * c)} ${f(q[0])} ${f(q[1])}`;
  }
  return ferme ? `${d}Z` : d;
}

/**
 * Une mèche (une pièce de la crinière) : de sa racine (x, y), elle part dans
 * la direction a1 (degrés : 0 vers l'arrière, 90 vers le bas) et finit dans
 * la direction a2 (plus la retombée du rang, `courbe`), longue de l (la
 * corde), large de w à la racine ; elle s'amincit en flamme jusqu'au tiers
 * de sa largeur et finit par un bout rond (un demi-disque), jamais en
 * pointe : une crinière de poils lourds, pas d'épines. Les mèches qui
 * tombent ont a2 plus bas que a1.
 */
type Meche = readonly [x: number, y: number, a1: number, a2: number, l: number, w: number];
const rad = (a: number) => (a * Math.PI) / 180;
/** L'épine d'une mèche : la cubique de la racine au bout, son point et sa direction à t. */
function epine([x, y, a1, a2, l]: Meche, courbe: number) {
  const b2 = a2 + courbe;
  const ac = rad((a1 + b2) / 2);
  const [tx, ty] = [x + l * Math.cos(ac), y + l * Math.sin(ac)];
  const p1 = [x + (l / 3) * Math.cos(rad(a1)), y + (l / 3) * Math.sin(rad(a1))];
  const p2 = [tx - (l / 3) * Math.cos(rad(b2)), ty - (l / 3) * Math.sin(rad(b2))];
  const at = (t: number): [number, number] => {
    const u = 1 - t;
    return [u * u * u * x + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * tx, u * u * u * y + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * ty];
  };
  const dir = (t: number): [number, number] => {
    const u = 1 - t;
    const dx = 3 * u * u * (p1[0] - x) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (tx - p2[0]);
    const dy = 3 * u * u * (p1[1] - y) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (ty - p2[1]);
    const n = Math.hypot(dx, dy) || 1;
    return [dx / n, dy / n];
  };
  return { at, dir };
}
/** Le bout rond garde `fin` de la largeur de la racine (0,3 : une flamme ; plus, une mèche plus lourde). */
function meche(m: Meche, courbe = 0, fin = 0.3): string {
  const [, , , , l, w] = m;
  const { at, dir } = epine(m, courbe);
  const h = w / 2;
  const r = h * fin;
  const tc = 1 - r / l;
  const demi = (t: number) => (t < 0.12 ? h * (0.84 + 0.16 * Math.sin(((t / 0.12) * Math.PI) / 2)) : h * (1 - (1 - fin) * Math.min(1, (t - 0.12) / (tc - 0.12)) ** 1.25));
  const ts = [0, 0.12, 0.28, 0.44, 0.6, 0.74, tc * 0.92, tc];
  const cote = (s: number): P[] =>
    ts.map((t) => {
      const [dx, dy] = dir(t);
      const k = demi(t) * s;
      const [px, py] = at(t);
      return [px + dy * k, py - dx * k];
    });
  const g = cote(1);
  const d = cote(-1).reverse();
  const [cx, cy] = at(tc);
  const [ux, uy] = dir(tc);
  // le demi-disque du bout, de la gauche (−90°) à la droite (+90°) en passant devant
  const bout: P[] = [-50, 0, 50].map((a) => {
    const [c, s] = [Math.cos(rad(a)), Math.sin(rad(a))];
    return [cx + (ux * c - uy * s) * r, cy + (uy * c + ux * s) * r];
  });
  return lisse([[g[0][0], g[0][1], 1], ...g.slice(1), ...bout, ...d.slice(0, -1), [d[d.length - 1][0], d[d.length - 1][1], 1]]);
}

/* ------------------------------- Le corps ------------------------------- */

// Le repère : le sol à y 600, le garrot à y 220 (la hauteur H = 380) ; posé dans la boîte par ORIGINE.
const ORIGINE = "translate(-104 -134)";

/** Le corps, la cuisse et la patte arrière proche, posée sous la hanche (le grasset, le jarret, le canon). */
const CORPS = lisse([
  [370, 222], [450, 232], [520, 238], [610, 228], [664, 228], [704, 240], [732, 262], [754, 290], [762, 320], [758, 356], [746, 392], [732, 424], [724, 452],
  [722, 476], [725, 494, 2], [710, 510], [704, 534], [704, 562], [710, 584], [714, 600, 1], [646, 600, 1], [648, 588], [660, 574], [666, 548], [666, 520], [660, 500], [648, 478],
  [640, 456], [632, 434], [622, 422], [560, 424], [480, 432], [400, 436], [330, 420], [292, 380], [296, 320], [320, 262],
]);
/**
 * Les pièces du corps, posées dans le corps (elles débordent, le corps les
 * coupe) : le flanc derrière la dernière côte ; la cuisse, du grasset à la
 * fesse ; la jambe d'un seul tenant, du grasset aux doigts (pas de bande en
 * travers : le jarret se lit par son biseau). Les doigts : des joints courts.
 */
const FLANC = lisse([[556, 200, 1], [578, 270], [590, 340], [578, 400], [556, 460], [540, 700, 1], [900, 700, 1], [900, 200, 1]]);
const CUISSE = lisse([[676, 214], [646, 252], [624, 310], [618, 372], [628, 422], [640, 454], [674, 436], [712, 404], [748, 372], [790, 352, 1], [800, 214, 1]]);
const JAMBE = lisse([[600, 470, 1], [640, 454], [674, 436], [712, 404], [748, 372], [790, 352, 1], [800, 640, 1], [600, 640, 1]]);
const DOIGTS = "M660 600C660 590 664 584 670 580M676 600C676 590 680 584 686 581M798 600C798 592 800 587 804 584M302 600C301 589 306 581 313 577M321 600C321 590 325 583 332 579M276 584C283 580 288 573 289 564M295 589C302 584 306 577 307 568";

/** La patte arrière lointaine, tendue en arrière, le talon levé ; son canon, son pied. */
const ARRIERE_LOIN = lisse([[688, 430], [742, 428], [764, 452], [780, 474], [786, 498], [794, 530], [808, 562], [822, 586], [826, 600, 1], [786, 600, 1], [782, 588], [770, 562], [756, 532], [740, 500], [716, 470], [694, 450]]);
/** Le canon lointain, sous le seul joint de la patte : au jarret, en travers de la jambe. */
const ARRIERE_LOIN_CANON = lisse([[736, 516, 1], [790, 494, 1], [870, 470, 1], [870, 640, 1], [700, 640, 1]]);

/** La patte avant lointaine, posée ; son pied. */
const AVANT_LOIN = lisse([[318, 428], [390, 432], [388, 478], [380, 520], [374, 546, 2], [380, 566], [388, 586], [384, 600, 1], [282, 600, 1], [278, 586], [290, 571], [312, 565], [326, 550], [322, 500], [316, 462]]);


/** La patte avant proche, levée : l'avant-bras qui file en avant, le poignet plié, le pied replié dessous. */
const AVANT = lisse([[288, 440], [378, 456], [366, 488], [338, 514], [314, 532, 2], [322, 548], [324, 568], [314, 586], [292, 592], [272, 582], [262, 562], [258, 540, 2], [264, 506], [274, 472]]);
/** Le poignet plié : le pied, coupé de l'avant-bras par le pli. */
const AVANT_PIED = lisse([[236, 552, 1], [258, 540], [284, 531], [318, 530, 1], [352, 536, 1], [352, 612, 1], [236, 612, 1]]);

/** La queue, basse, en deux pièces, et sa touffe. */
const QUEUE = lisse([[718, 258], [760, 270], [796, 302], [820, 352], [834, 410], [840, 446], [828, 448], [820, 412], [806, 362], [784, 318], [752, 294], [714, 288]]);
const QUEUE_BOUT = lisse([[790, 340, 1], [830, 330, 1], [880, 470, 1], [800, 470, 1]]);
const TOUFFE = lisse([[826, 434], [845, 439], [856, 460], [858, 486], [852, 512], [843, 536, 1], [833, 510], [823, 484], [818, 458]]);

/* -------------------------------- La tête -------------------------------- */

/**
 * La tête, dessinée dans son repère (la truffe à gauche), posée par tete() :
 * le bout du museau vertical, la truffe en haut, la lèvre supérieure gonflée
 * qui tombe dessous, le menton en retrait ; l'arête du nez à peine bombée,
 * le stop sous l'arcade lourde, le front qui file sous le toupet.
 */
const tete = (pts: readonly P[]): P[] => pts.map((p) => (p.length === 3 ? [p[0] * 1.14 + 68.2, p[1] * 1.14 + 185.6, p[2]] : [p[0] * 1.14 + 68.2, p[1] * 1.14 + 185.6]));
const TETE = lisse(tete([[48, 82, 1], [66, 78], [88, 70], [106, 62], [118, 52], [134, 42], [150, 36], [166, 56], [176, 92], [176, 126], [166, 150], [146, 160], [118, 160], [94, 157], [78, 152], [66, 146], [58, 138], [52, 126], [49, 112], [48, 98]]));
/** La joue : la pièce derrière le coussinet, du coin de l'œil au coin de la gueule, jusqu'à la mâchoire. */
const JOUE_T = lisse(tete([[136, 64], [142, 90], [134, 114], [118, 134], [126, 166, 1], [200, 166, 1], [200, 50, 1]]));
/** Le museau, haut et carré : le dessus plat, le devant droit sous la truffe, le bas qui rentre vers le menton. */
const MUSEAU = lisse(tete([[50, 93, 1], [66, 91], [86, 93], [102, 99], [111, 111], [112, 126], [104, 135], [84, 138], [64, 136], [54, 129], [50, 114, 2]]));
const MENTON = lisse(tete([[66, 141], [84, 145], [104, 144], [118, 139], [124, 150], [110, 158], [90, 157], [74, 151]]));

/** La truffe : large et plate, au ras du chanfrein (son dessus suit le bord de la tête), le devant droit. */
const TRUFFE = lisse(tete([[48, 82, 1], [66, 78, 1], [72, 84], [68, 91], [57, 94], [49, 94, 1]]));
const OEIL = lisse(tete([[104, 71], [113, 63.5], [126, 61], [134, 63.5], [125, 70.5], [113, 73]]));
const IRIS = lisse(tete([[115, 67], [120.5, 63.5], [126.5, 64], [126, 69], [119.5, 70]]));
const PUPILLE = lisse(tete([[119.5, 66.8], [121.5, 65], [123.5, 66.5], [121.8, 68.6]]));
/** L'arcade : un filet brun, à peine, au-dessus de l'œil. */
const ARCADE = lisse(tete([[104, 60], [118, 55.5], [134, 56]]), false);
/** La lèvre : sous le coussinet, elle file vers l'arrière et descend au coin de la gueule (jamais un sourire). */
const LEVRE = lisse(tete([[56, 130], [72, 134.5], [88, 138], [103, 141.5]]), false);
/** Les vibrisses : trois rangs de piqûres sur le coussinet. */
const VIBRISSES = tete([[64, 110], [75, 111], [86, 115], [70, 120], [81, 123], [92, 127]])
  .map(([x, y]) => `M${f(x)} ${f(y)}h.1`)
  .join("");

/* ------------------------------ La crinière ------------------------------ */

// [racine x, y, direction de départ, d'arrivée, longueur, largeur], posés un à un (la frange, la fraise),
// ou tirés d'un rang (la crinière, en tuiles).
/** La frange sous le ventre : quatre paquets inégaux, accrochés au bas de la crinière, qui partent en arrière avec la marche. */
const FRANGE: Meche[] = [
  [426, 418, 80, 104, 74, 36], [446, 422, 72, 98, 54, 30],
  [486, 422, 74, 100, 62, 36], [500, 420, 68, 94, 46, 30], [472, 426, 84, 108, 40, 26],
  [548, 416, 70, 98, 46, 32], [562, 414, 64, 92, 34, 26],
  [604, 408, 66, 94, 30, 24],
];
/**
 * La crinière, en tuiles : des rangs de mèches qui pendent, posés de la poitrine (en bas, dessous) à la
 * crête du cou (en haut, par-dessus : chaque rang retombe sur les racines du rang d'en dessous), comme
 * une pèlerine lourde. Un rang : ses racines de `de` à `a` (n mèches), la direction de la première et de
 * la dernière (de plus en plus pendantes vers le bas), la longueur et la largeur (2,5 pour 1). La crête,
 * en haut, couche ses mèches vers l'arrière (le toupet aussi).
 */
interface Rang {
  de: readonly [number, number];
  a: readonly [number, number];
  n: number;
  dir: readonly [number, number];
  l: number;
  w: number;
}
const RANGS: readonly Rang[] = [
  { de: [200, 386], a: [300, 400], n: 5, dir: [100, 92], l: 76, w: 32 },
  { de: [236, 352], a: [452, 366], n: 8, dir: [92, 84], l: 88, w: 36 },
  { de: [256, 312], a: [466, 324], n: 8, dir: [82, 72], l: 94, w: 38 },
  { de: [266, 270], a: [474, 282], n: 8, dir: [72, 58], l: 98, w: 39 },
  { de: [272, 230], a: [470, 236], n: 8, dir: [56, 40], l: 94, w: 38 },
  { de: [252, 214], a: [418, 212], n: 6, dir: [34, 20], l: 88, w: 36 },
];
/** Les longueurs inégales (± 20 %), posées à la main : jamais deux voisines pareilles. */
const INEGAL = [1, 0.84, 1.16, 0.93, 1.2, 0.88, 1.08, 0.82, 1.12, 0.96, 1.18, 0.86, 1.04];
/** Un peu de jeu dans les directions (degrés). */
const GIGUE = [0, 5, -4, 2, -6, 3, -2, 6, -5, 1];
/** Les mèches à contre-courbe (le bout se relève un peu au lieu de retomber) : [rang, mèche], pas en rythme. */
const CONTRE: readonly (readonly [number, number])[] = [[1, 5], [2, 2], [3, 6], [4, 3]];
function rangDe(r: Rang, k: number): Meche[] {
  return Array.from({ length: r.n }, (_, i) => {
    const t = r.n > 1 ? i / (r.n - 1) : 0;
    const d = r.dir[0] + (r.dir[1] - r.dir[0]) * t + GIGUE[(i + k * 3) % GIGUE.length];
    const contre = CONTRE.some(([kk, ii]) => kk === k && ii === i);
    return [
      r.de[0] + (r.a[0] - r.de[0]) * t,
      r.de[1] + (r.a[1] - r.de[1]) * t,
      contre ? d + 8 : d - 6,
      contre ? d - 6 : d + 8,
      r.l * INEGAL[(i * 5 + k * 2) % INEGAL.length],
      r.w * (0.94 + (0.12 * ((i * 7 + k) % 5)) / 4),
    ];
  });
}
const CRINIERE: Meche[][] = RANGS.map(rangDe);
/** Derrière la fraise, le toupet couché vers l'arrière, au-dessus du front. */
const TOUPET: Meche = [246, 222, -14, 22, 56, 30];
/** La fraise, fauve claire : des mèches couchées le long du visage, de la gorge au front. */
const FRAISE: Meche[] = [
  [198, 356, 70, 104, 40, 28], [214, 353, 64, 100, 54, 30], [228, 345, 60, 98, 60, 32], [240, 332, 54, 94, 66, 32],
  [248, 316, 46, 90, 68, 32], [253, 298, 34, 84, 70, 32], [255, 278, 22, 76, 70, 32], [254, 258, 10, 68, 68, 32], [249, 242, -6, 58, 64, 30], [240, 234, -28, 44, 58, 28], [228, 236, -64, 18, 50, 26],
];
/** Le fond de la crinière, sous les mèches. */
const FOND_CRINIERE = lisse([[240, 226], [290, 200], [350, 200], [420, 220], [460, 250], [470, 300], [456, 360], [430, 410], [390, 430], [330, 446], [260, 440], [210, 410], [200, 380], [240, 340]]);

/**
 * La retombée (degrés ajoutés à l'arrivée) : les mèches de la crinière s'alourdissent un peu vers le
 * bout ; la frange du ventre part en arrière, avec la marche. Le bout de chaque mèche garde la moitié de
 * sa largeur (un bout rond et lourd, jamais une pointe).
 */
const RETOMBEE = { frange: -6, criniere: 6, fraise: 18 } as const;
const M = {
  frange: FRANGE.map((m) => meche(m, RETOMBEE.frange, 0.5)),
  // la crête (le dernier rang) retombe plus : ses mèches se couchent sur le rang d'en dessous
  criniere: CRINIERE.map((rg, k) => rg.map((m) => meche(m, k === RANGS.length - 1 ? 18 : RETOMBEE.criniere, 0.5))),
  toupet: meche(TOUPET, 10, 0.5),
  fraise: FRAISE.map((m) => meche(m, RETOMBEE.fraise, 0.5)),
};

/* ------------------------------- L'émail -------------------------------- */

// Le miel brun (jamais l'or), le noir et le vert de Fès, le fauve clair de la fraise, la chaux des joints.
const EMAIL = {
  cage: "#86613c",
  flanc: "#7f5c39",
  cuisse: "#8e683f",
  jambe: "#86623d",
  canon: "#7c5936",
  loin: "#5a3f27",
  loinBas: "#4f3721",
  queue: "#86613c",
  tete: "#a07650",
  joue: "#ab845d",
  museau: "#d6c4a2",
  menton: "#e2d5bb",
  fraise: ["#c4a47c", "#bd9d74", "#c9ab84"],
  iris: "#c2ae86",
};
const CRIN = ["#2a211b", "#211a15", "#234536", "#2d241d", "#1d1713", "#2a4739", "#261e18", "#31271f", "#1b1512"];
/** La teinte de chaque mèche : un indice de CRIN, posé à la main ; brun-noir, et une verte sur quatre ou cinq (2 et 5), de loin en loin. */
const TEINTES = [0, 3, 2, 1, 4, 6, 7, 5, 8, 3, 1, 2, 6, 4, 0, 5, 3, 1];
const NOIR = "#17191a";
const CHAUX = "#ece6da";
const JOINT = 4.5;

/** Une pièce d'émail : la couleur, la glaçure, le biseau (lumière en haut à gauche, ombre en bas à droite), dans `dans` (une découpe) s'il le faut. */
function Piece({ d, couleur, id, dans }: { d: string; couleur: string; id: string; dans?: string }) {
  const k = `${id}`;
  return (
    <g clipPath={dans ? `url(#${dans})` : undefined}>
      <clipPath id={k}>
        <path d={d} />
      </clipPath>
      <path d={d} fill={couleur} />
      <g clipPath={`url(#${k})`} fill="none" strokeLinejoin="round">
        <path d={d} stroke="#fff" strokeOpacity={0.24} strokeWidth={6} transform="translate(2.5 2.5)" />
        <path d={d} stroke="#000" strokeOpacity={0.22} strokeWidth={6} transform="translate(-2.5 -2.5)" />
      </g>
    </g>
  );
}

/** Les joints de chaux d'un groupe de tracés (dans une découpe s'il le faut). */
const Joints = ({ d, dans }: { d: string; dans?: string }) => (
  <path d={d} fill="none" stroke={CHAUX} strokeWidth={JOINT} strokeLinejoin="round" strokeLinecap="round" clipPath={dans ? `url(#${dans})` : undefined} />
);

/** L'usure de la glaçure (la graine) : des craquelures fines et des piqûres, sur le corps seulement. */
function usure(graine: number) {
  const rnd = alea(graine ^ 0x6d61);
  let craquelures = "";
  let piqures = "";
  for (let i = 0; i < 9; i++) {
    let [x, y] = [430 + rnd() * 320, 250 + rnd() * 170];
    let a = rnd() * Math.PI * 2;
    craquelures += `M${f(x)} ${f(y)}`;
    for (let k = 0; k < 4; k++) {
      a += (rnd() - 0.5) * 1.3;
      [x, y] = [x + 9 * Math.cos(a), y + 9 * Math.sin(a)];
      craquelures += `L${f(x)} ${f(y)}`;
    }
  }
  for (let i = 0; i < 26; i++) piqures += `M${f(330 + rnd() * 430)} ${f(240 + rnd() * 330)}h.1`;
  return { craquelures, piqures };
}

function Lion({ id, graine }: { id: string; graine: number }) {
  const c = (k: string) => `ma-${k}-${id}`;
  const u = usure(graine);
  const meches = (liste: string[], k: string, couleurs: readonly string[], c0 = 0) =>
    liste.map((d, i) => <Piece key={`${k}${i}`} d={d} couleur={couleurs[TEINTES[(i + c0) % TEINTES.length] % couleurs.length]} id={c(`${k}${i}`)} />);
  return (
    <g transform={ORIGINE}>
      <defs>
        <clipPath id={c("corps")}>
          <path d={CORPS} />
        </clipPath>
        <clipPath id={c("al")}>
          <path d={ARRIERE_LOIN} />
        </clipPath>
        <clipPath id={c("vl")}>
          <path d={AVANT_LOIN} />
        </clipPath>
        <clipPath id={c("av")}>
          <path d={AVANT} />
        </clipPath>
        <clipPath id={c("q")}>
          <path d={QUEUE} />
        </clipPath>
      </defs>
      {/* Les pattes lointaines, dans l'ombre. */}
      <Piece d={ARRIERE_LOIN} couleur={EMAIL.loin} id={c("al0")} />
      <Piece d={ARRIERE_LOIN_CANON} couleur={EMAIL.loinBas} id={c("al1")} dans={c("al")} />
      <Joints d={ARRIERE_LOIN_CANON} dans={c("al")} />
      <Joints d={ARRIERE_LOIN} />
      <Piece d={AVANT_LOIN} couleur={EMAIL.loin} id={c("vl0")} />
      <Joints d={AVANT_LOIN} />
      {/* La queue et sa touffe. */}
      <Piece d={QUEUE} couleur={EMAIL.queue} id={c("q0")} />
      <Piece d={QUEUE_BOUT} couleur={EMAIL.flanc} id={c("q1")} dans={c("q")} />
      <Joints d={QUEUE_BOUT} dans={c("q")} />
      <Joints d={QUEUE} />
      <Piece d={TOUFFE} couleur={NOIR} id={c("tf")} />
      <Joints d={TOUFFE} />
      {/* La frange du ventre, sous le corps : ses racines passent sous lui. */}
      {meches(M.frange, "fr", CRIN)}
      <Joints d={M.frange.join("")} />
      {/* Le corps, en pièces qui suivent l'anatomie. */}
      <Piece d={CORPS} couleur={EMAIL.cage} id={c("c0")} />
      <Piece d={FLANC} couleur={EMAIL.flanc} id={c("c1")} dans={c("corps")} />
      <Piece d={CUISSE} couleur={EMAIL.cuisse} id={c("c2")} dans={c("corps")} />
      <Piece d={JAMBE} couleur={EMAIL.jambe} id={c("c3")} dans={c("corps")} />
      <g clipPath={`url(#${c("corps")})`}>
        <path d={u.craquelures} fill="none" stroke="#2a1a0e" strokeOpacity={0.35} strokeWidth={1} strokeLinejoin="round" />
      </g>
      <Joints d={FLANC + CUISSE + JAMBE} dans={c("corps")} />
      <Joints d={CORPS} />
      {/* Le fond de la crinière, sous les rangs. */}
      <path d={FOND_CRINIERE} fill={CRIN[6]} />
      {/* La patte avant proche, levée. */}
      <Piece d={AVANT} couleur={EMAIL.cage} id={c("av0")} />
      <Piece d={AVANT_PIED} couleur={EMAIL.canon} id={c("av1")} dans={c("av")} />
      <Joints d={AVANT_PIED} dans={c("av")} />
      <Joints d={AVANT} />
      <path d={DOIGTS} fill="none" stroke={CHAUX} strokeWidth={3.2} strokeLinecap="round" />
      {/* La crinière, en tuiles : rang par rang, de la poitrine à la crête ; le toupet couché. */}
      {M.criniere.map((rg, k) => (
        <g key={`r${k}`}>
          {meches(rg, `r${k}x`, CRIN, k * 5)}
          <Joints d={rg.join("")} />
        </g>
      ))}
      <Piece d={M.toupet} couleur={CRIN[3]} id={c("tp")} />
      <Joints d={M.toupet} />
      {meches(M.fraise, "fs", EMAIL.fraise)}
      <Joints d={M.fraise.join("")} />
      {/* La tête. */}
      <clipPath id={c("tete")}>
        <path d={TETE} />
      </clipPath>
      <Piece d={TETE} couleur={EMAIL.tete} id={c("t0")} />
      <Piece d={JOUE_T} couleur={EMAIL.joue} id={c("t4")} dans={c("tete")} />
      <Piece d={MUSEAU} couleur={EMAIL.museau} id={c("t1")} />
      <Piece d={MENTON} couleur={EMAIL.menton} id={c("t2")} />
      <Joints d={JOUE_T} dans={c("tete")} />
      <Joints d={TETE + MUSEAU + MENTON} />
      <Piece d={TRUFFE} couleur={NOIR} id={c("t3")} />
      <Joints d={TRUFFE} />
      <path d={OEIL} fill={NOIR} />
      <path d={IRIS} fill={EMAIL.iris} />
      <path d={PUPILLE} fill={NOIR} />
      <g fill="none" stroke={NOIR} strokeLinecap="round">
        <path d={ARCADE} strokeWidth={2.2} stroke="#5b4128" />
        <path d={LEVRE} strokeWidth={3} />

        <path d={VIBRISSES} strokeWidth={3.4} stroke="#4a3725" />
      </g>
      <path d={u.piqures} stroke={CHAUX} strokeOpacity={0.7} strokeWidth={2.2} strokeLinecap="round" clipPath={`url(#${c("corps")})`} />
    </g>
  );
}

/* ------------------------------- Le gaufrage ------------------------------ */

/**
 * Le contour de la crinière pour le gaufrage, posé à la main sur les bouts
 * ronds des mèches et les creux doux entre eux (des festons, jamais des
 * pointes) : du front, par le toupet, la nuque et le dos, la frange du
 * ventre jusqu'à l'aine, puis le poitrail et la gorge.
 */
const CONTOUR_CRINIERE = lisse([
  [236, 238], [240, 200], [254, 170], [278, 158], [298, 170], [330, 160], [354, 172], [382, 166], [404, 182], [430, 184], [450, 202], [472, 212],
  [486, 232], [506, 250], [505, 274], [518, 296], [509, 318], [518, 340], [506, 360], [508, 382], [498, 400], [506, 416], [560, 414], [622, 418, 2],
  [624, 440], [610, 446], [597, 456], [585, 457], [574, 466], [557, 467], [544, 481], [532, 476], [521, 481], [504, 484], [489, 496], [476, 487],
  [465, 490], [446, 490], [424, 502], [404, 488], [386, 496], [368, 484], [350, 480], [334, 482], [318, 490], [300, 482], [284, 491], [264, 470],
  [245, 469], [228, 462], [212, 470], [196, 458], [182, 462], [166, 448], [160, 436], [184, 404], [212, 378], [240, 350], [254, 310], [256, 272], [250, 248],
]);

/** La ligne médiane d'une mèche (la même épine, la même retombée) : un brin, pour graver le sens du poil. */
function brin(m: Meche, courbe: number): string {
  const { at } = epine(m, courbe);
  const pts = [0, 0.3, 0.6, 0.88].map((t) => at(t));
  return `M${f(pts[0][0])} ${f(pts[0][1])}` + pts.slice(1).map(([x, y]) => `L${f(x)} ${f(y)}`).join("");
}
/** Quelques brins, du cou à l'épaule. */
const BRINS = [
  ...[CRINIERE[4][1], CRINIERE[4][4], CRINIERE[3][2], CRINIERE[3][6], CRINIERE[2][3], CRINIERE[1][5]].map((m) => brin(m, RETOMBEE.criniere)),
].join("");

/**
 * La face : le lion repoussé dans le portrait, sans couleur. Chaque arête est
 * tirée deux fois, une lumière en haut à gauche, une ombre en bas à droite ;
 * une arête n'est tirée que là où rien n'est devant elle (des découpes « hors
 * de ») : pas de pattes vues à travers le corps, pas de fraise en bande ; la
 * crinière se lit par son contour et quelques brins.
 */
function Gaufrage({ id, photo }: { id: string; photo: boolean }) {
  const c = (k: string) => `ma-g${k}-${id}`;
  const lumiere = photo ? "rgba(255,250,240,0.6)" : "rgba(255,255,255,0.95)";
  const ombre = photo ? "rgba(0,0,0,0.5)" : "rgba(70,58,40,0.34)";
  const voile = photo ? "rgba(255,248,236,0.08)" : "rgba(120,100,70,0.05)";
  const hors = (k: string, d: string) => (
    <clipPath id={c(k)}>
      <path d={`M0 0H1000V700H0Z${d}`} clipRule="evenodd" />
    </clipPath>
  );
  const dans = (k: string, d: string) => (
    <clipPath id={c(k)}>
      <path d={d} />
    </clipPath>
  );
  const arete = (d: string, e = 7) => (
    <>
      <path d={d} fill="none" stroke={ombre} strokeWidth={e} transform="translate(4 5)" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={lumiere} strokeWidth={e} transform="translate(-3.5 -3.5)" strokeLinejoin="round" strokeLinecap="round" />
    </>
  );
  return (
    <g transform={ORIGINE}>
      <defs>
        {hors("c", CORPS)}
        {hors("m", CONTOUR_CRINIERE)}
        {hors("a", AVANT)}
        {hors("t", TETE)}
        {dans("i", CONTOUR_CRINIERE)}
        {dans("k", CORPS)}
      </defs>
      <g fill={voile}>
        <path d={CORPS} />
        <path d={CONTOUR_CRINIERE} />
        <path d={TETE} />
      </g>
      {/* Les pattes lointaines et la queue : seulement ce qui dépasse du corps et de la crinière. */}
      <g clipPath={`url(#${c("c")})`}>
        <g clipPath={`url(#${c("a")})`}>
          <g clipPath={`url(#${c("m")})`}>{arete(ARRIERE_LOIN + AVANT_LOIN + QUEUE + TOUFFE)}</g>
        </g>
      </g>
      <g clipPath={`url(#${c("m")})`}>
        <g clipPath={`url(#${c("a")})`}>
          {arete(CORPS)}
          <g clipPath={`url(#${c("k")})`}>{arete(CUISSE, 5)}</g>
        </g>
      </g>
      <g clipPath={`url(#${c("m")})`}>{arete(AVANT)}</g>
      <g clipPath={`url(#${c("t")})`}>
        {arete(CONTOUR_CRINIERE)}
        <g clipPath={`url(#${c("i")})`}>{arete(BRINS, 4)}</g>
      </g>
      {arete(TETE)}
      {arete(TRUFFE + OEIL + ARCADE, 5)}
    </g>
  );
}

function Dessin({ couche, id, photo, graine }: PropsTotem) {
  if (couche === "dos") return <Lion id={id} graine={graine} />;
  if (couche === "face-portrait") return <Gaufrage id={id} photo={photo} />;
  return null;
}

const totem: TotemNation = {
  nation: "ma",
  animal: "lion de l'Atlas",
  quoi: "Le lion de l'Atlas qui marche, la patte levée, sa crinière sombre posée en tuiles de mèches épaisses qui pendent jusque sous le ventre, le museau carré, la truffe au ras du chanfrein, taillé en pièces de zellige bisautées ; gaufré dans le coin du portrait.",
  sources: [
    { titre: "Lion de l'Atlas (lion de Barbarie) : la crinière longue et sombre, des épaules jusque sous le ventre et aux coudes", url: "https://en.wikipedia.org/wiki/Barbary_lion" },
    { titre: "University of Kent, Barbary Lion Project : reconnaître le lion de Barbarie (crinière, ventre, coudes)", url: "https://blogs.kent.ac.uk/barbarylion/2014/08/14/spot-the-wannabees-are-they-barbaries/" },
    { titre: "Creative Bloq, How to draw a lion : le lion mâle de profil, du squelette à la forme", url: "https://www.creativebloq.com/how-to/how-to-draw-a-lion" },
    { titre: "Wacom, Monika Zagrobelna, How to draw a realistic lion : proportions de profil, le museau, la marche", url: "https://community.wacom.com/en-us/how-to-draw-lion-monika-zagrobelna" },
    { titre: "K. Goldfinger, Animal Anatomy for Artists (Oxford University Press, 2004) : planches du lion, squelette et muscles", url: "https://academic.oup.com/book/41965" },
  ],
  dessine: true,
  boite: { w: 760, h: 470 },
  pose: {
    dos: { x: 101, y: 637, echelle: 1.08, devant: true, lune: LUNE_MAROC },
    face: { portrait: { x: 70, y: 780, echelle: 0.3, miroir: true } },
  },
  Dessin,
};

export default totem;
