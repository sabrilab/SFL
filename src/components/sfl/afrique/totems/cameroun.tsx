// Le totem du Cameroun (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// Le lion qui rugit, en buste, de profil, tourné vers la droite : il ne marche pas (Maroc), il ne
// veille pas assis de face (Sénégal), il rugit. La tête n'est levée que de 19° et la gueule s'ouvre de
// 54° : la mâchoire tombe et le rugissement part devant lui, pas vers le ciel (la tête levée haut et la
// gueule entrouverte, c'est le loup qui hurle à la lune). En noir, à 45 px, on lit un lion : la crinière
// ronde et pleine, l'oreille ronde, le museau carré, les crocs.
// La tête est construite comme un squelette, dans son repère (la truffe en 0 0, 300 de la truffe à
// l'occiput) : la mâchoire du bas, tout entière dans son propre repère (J), tourne autour de son
// articulation (T), puis toute la tête se lève autour du même point. D'où ce qui fait un lion :
//   · le crâne bombé au-dessus de l'arcade, l'oreille ronde et sa conque posées derrière ;
//   · le museau haut et carré, la truffe large en coin, le gros coussinet des vibrisses et son repli ;
//   · la lèvre du haut retroussée au-dessus du croc ; devant lui trois incisives, derrière lui deux
//     prémolaires et la carnassière ; le croc de l'autre côté, un ton plus sombre, en retrait ;
//   · la mâchoire du bas : le menton 1,3 fois plus profond que son milieu (de la gencive au dessous),
//     arrondi vers le bas, qui s'arrête juste devant le croc du bas ; sa lèvre noire, épaisse, qui pend
//     de la commissure jusque derrière ce croc et laisse voir la gencive et deux prémolaires ;
//   · la langue en gouttière (deux bords relevés, un sillon), plus sombre vers la gorge, la pointe levée
//     derrière le croc du bas, sans ombre portée ;
//   · l'œil plissé : l'angle intérieur tourné vers le bas et l'avant, la ligne lacrymale qui descend vers
//     le coussinet, l'iris d'ocre ; l'arcade, deux rides de froncement, trois plis sur le chanfrein ;
//   · la joue : la pommette, son poil gravé qui part de sous l'œil vers l'arrière, et son bord en
//     flammèches de poil (jamais un coin vif) qui passent sur la fraise ; le pli de la commissure.
// Les dents sont dessinées après la dalle qui les porte et hors d'elle (un masque) : aucune ombre portée
// ne les voile.
// La crinière est une masse d'argile taillée en touffes, posées une à une de l'arrière vers l'avant : le
// socle (le fond, sombre : entre deux touffes, jamais le mur), le rang du fond (la crête derrière
// l'oreille, le cou, le poitrail : leurs pointes font le bord), le rang du milieu, la gorge sous la
// mâchoire, puis la fraise, une collerette ronde et pleine qui encadre la face. Chaque touffe : une âme
// que la pesanteur courbe, 4 à 6 sillons parallèles de la racine jusque dans le bout, un bout fendu en
// deux ou trois pointes inégales (la fraise : un bout plein, arrondi, à peine fendu), un crochet de 15°
// au plus ; sa racine sort de l'ombre du fond (un dégradé), son arête de lumière en haut à gauche, son
// ombre courte sur la touffe de dessous ; aucun sillon fermé autour d'elle (ce serait une feuille).
// Les valeurs : la face lissée bien plus claire que le mur (L* 86 à 88 contre 76 à 79), la fraise plus
// sombre (70), la crinière plus sombre encore (58).
//   · au dos : le héros, au milieu à gauche, la crinière qui frôle le bord ; la lune et la coupole montées
//     en haut à droite (LUNE_CAMEROUN, que le skin lit) : 42 de jour devant la truffe, 36 au bord droit ;
//     le buste s'arrête au-dessus de l'enduit lissé du logotype ;
//   · à la face : un sceau d'argile pressé dans le coin bas du portrait : la même silhouette en arêtes et
//     en ombres, l'oreille et sa conque, l'œil, la gueule et ses crocs.
// Il est taillé dans l'argile du teleuk (../cameroun.tsx), comme les reliefs de la case obus musgum.
// Les tracés sont des points posés à la main, liés en béziers tendus (lisse), et des touffes posées une à
// une ; la graine ne touche pas la silhouette.
//
// Le mode d'emploi est en tête de ../totem.tsx.

import type { ReactNode } from "react";
import type { PropsTotem, TotemNation } from "../types";
import { f } from "../outils";

/** La lune et la coupole, montées en haut à droite, vers où il rugit (le skin, ../cameroun.tsx, les lit). */
export const LUNE_CAMEROUN = { cx: 768, cy: 292, d: 162 } as const;

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

/** Une matrice affine [a b c d e f] : x' = a x + c y + e, y' = b x + d y + f. */
type Mat = readonly [number, number, number, number, number, number];
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const tr = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
function ro(deg: number, cx = 0, cy = 0): Mat {
  const a = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return mul(tr(cx, cy), mul([c, s, -s, c, 0, 0], tr(-cx, -cy)));
}
const pt = (m: Mat, p: P): [number, number] => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const app = (m: Mat, pts: readonly P[]): P[] =>
  pts.map((p) => {
    const q = pt(m, p);
    return p.length === 3 ? [q[0], q[1], p[2]] : q;
  });

/* -------------------------------- La tête -------------------------------- */

/** L'articulation de la mâchoire, dans le repère de la tête (la truffe en 0 0, 300 de la truffe à l'occiput). */
const T: P = [-178, 58];
/** La tête levée, la gueule ouverte, à l'échelle, l'articulation posée dans la boîte. */
const REGLAGE = { leve: -19, gueule: 54, s: 1.4, x: 360, y: 372 };

/** Le bord de la face contre la crinière, du sommet du crâne à la gorge : des touffes de poil de joue, pointe vers l'arrière et le bas. */
const LISIERE: P[] = [[-194, -116], [-203, -90], [-209, -62], [-211, -33], [-209, -4], [-204, 24], [-196, 50], [-186, 72]];
/** La lèvre du haut, retroussée au-dessus du croc, de la commissure aux incisives. */
const LEVRE_HAUT: P[] = [[-150, 84], [-130, 76], [-110, 70], [-92, 66], [-76, 61], [-64, 54], [-54, 44], [-44, 39], [-34, 39], [-26, 44], [-18, 50]];
/** La lèvre du bas, noire, qui pend de la commissure jusque derrière le croc (repère de la mâchoire). */
const LEVRE_BAS: P[] = [[-128, 82], [-108, 90], [-88, 92], [-70, 88], [-57, 79], [-48, 69]];

/** Les touffes de la lisière : leur saillie et leur glissement vers le bas, une par une (de la tempe à la gorge). */
const JOUE: readonly (readonly [number, number])[] = [[12, 0.26], [17, 0.34], [14, 0.3], [20, 0.38], [16, 0.32], [21, 0.4], [17, 0.34]];

function touffesDe(base: readonly P[]): P[] {
  // Entre deux points de la lisière, une touffe de poil de joue : un bord qui sort en s'arrondissant, une pointe poussée
  // vers l'extérieur (à gauche du sens de parcours) et vers le bas, puis un creux doux avant la suivante.
  const r: P[] = [];
  for (let i = 0; i < base.length - 1; i++) {
    const [p, q] = [base[i], base[i + 1]];
    const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
    const l = Math.hypot(dx, dy) || 1;
    const [nx, ny] = [dy / l, -dx / l];
    const [sortie, glisse] = JOUE[i % JOUE.length];
    r.push([p[0], p[1], 2], [p[0] + dx * 0.32 - nx * sortie * 0.5, p[1] + dy * 0.32 - ny * sortie * 0.5]);
    r.push([p[0] + dx * (0.5 + glisse) - nx * sortie, p[1] + dy * (0.5 + glisse) - ny * sortie, 1]);
    r.push([p[0] + dx * (0.88 + glisse * 0.2) - nx * sortie * 0.3, p[1] + dy * (0.88 + glisse * 0.2) - ny * sortie * 0.3]);
  }
  r.push(base[base.length - 1]);
  return r;
}

function construireTete(r = REGLAGE) {
  const { leve, gueule, s, x, y } = r;
  const M: Mat = mul(tr(x, y), mul([s, 0, 0, s, 0, 0], mul(ro(leve), tr(-T[0], -T[1]))));
  const J: Mat = mul(M, ro(gueule, T[0], T[1]));
  const h = (p: readonly P[]) => app(M, p);
  const b = (p: readonly P[]) => app(J, p);
  // La commissure : le coin de la gueule, posé sur la mâchoire ouverte.
  const K = pt(J, [-146, 72]);
  const k1: P = [K[0], K[1], 1];
  const HAUT: P[] = [
    ...h([[-12, 52, 1], [-6, 46], [-2, 34], [2, 20], [6, 8], [7, -3], [4, -12], [-2, -18, 2]]),
    ...h([[-20, -31.5], [-40, -44.5], [-60, -57], [-78, -67.5], [-94, -76], [-110, -84], [-126, -93.5], [-144, -103], [-162, -111], [-180, -116]]),
    ...h(touffesDe(LISIERE)),
    ...h([[-176, 86]]),
    k1,
    ...h(LEVRE_HAUT),
  ];
  const BAS: P[] = [
    k1,
    ...b(LEVRE_BAS),
    ...b([[-40, 64], [-28, 63], [-14, 63, 2], [-8, 72], [-6, 88], [-8, 102], [-13, 113], [-22, 121], [-36, 126], [-54, 127]]),
    ...b([[-80, 123], [-108, 118], [-136, 113], [-160, 107], [-178, 98], [-190, 86], [-194, 72], [-186, 60], [-170, 62], [-154, 68]]),
  ];
  return {
    K,
    oeilC: pt(M, [-114, -42]),
    // Le modelé : la pommette (lumière), le creux sous elle, le flanc du museau, la joue qui tourne vers la fraise (ombres).
    modele: ([[-132, -12, 46, 22, 1], [-128, 44, 62, 16, 0], [-66, -18, 34, 12, 0], [-196, 10, 22, 84, 0]] as const).map(([cx, cy, rx, ry, l]) => ({ c: pt(M, [cx, cy]), rx: rx * s, ry: ry * s, l })),
    commissure: lisse([K, [K[0] - 9, K[1] + 7], [K[0] - 14, K[1] + 19]], false),
    iris: pt(M, [-111, -40]),
    poilsBas: ([
      [[-150, 98], [-130, 102], [-110, 104]], [[-118, 106], [-98, 108], [-78, 109]], [[-86, 110], [-66, 112], [-46, 114]],
      [[-160, 84], [-140, 90], [-122, 94]], [[-56, 100], [-38, 104], [-22, 110]], [[-40, 118], [-26, 120], [-16, 116]],
    ] satisfies P[][]).map((l) => lisse(b(l), false)),
    papilles: b([[-118, 88], [-104, 92], [-90, 93], [-77, 91], [-65, 85]]).map(([px, py]) => `M${f(px)} ${f(py)}h.1`).join(""),
    levreHaut: lisse([K, ...h(LEVRE_HAUT), ...h([[-12, 52]])], false),
    levreBas: lisse([K, ...b(LEVRE_BAS), ...b([[-40, 64]])], false),
    paupiere: lisse(h([[-92, -28], [-104, -31], [-117, -35], [-130, -40]]), false),
    repli: lisse(h([[-8, 4], [-24, 2], [-44, 6], [-62, 16], [-74, 30]]), false),
    // L'ombre du croc sur sa face avant (la lumière vient d'en haut à gauche).
    crocOmbre: lisse(h([[-30, 42, 1], [-30.5, 56], [-32, 70], [-34.5, 82], [-37.5, 91], [-39.5, 95, 1], [-40.5, 86], [-41.2, 72], [-40.8, 58], [-39.5, 43, 1]])),
    crocBasOmbre: lisse(b([[-28, 64, 1], [-28.5, 54], [-30, 44], [-32, 35], [-34.5, 27, 1], [-35.5, 36], [-36.2, 46], [-36.5, 56], [-36.5, 65, 1]])),
    haut: lisse(HAUT),
    bas: lisse(BAS),
    // Le fond de la gueule : de la lèvre du haut à celle du bas.
    gorge: lisse([k1, ...h(LEVRE_HAUT), ...h([[-12, 52, 1]]), ...b([[-14, 63, 1], [-40, 64], ...[...LEVRE_BAS].reverse()])]),
    langue: lisse(b([[-150, 72], [-130, 63], [-106, 58], [-84, 56], [-68, 54], [-58, 51], [-52, 45], [-48, 37], [-45, 32, 2], [-41, 34], [-39, 42], [-40, 54], [-48, 64], [-74, 78], [-114, 82], [-150, 80]])),
    rebord: lisse(b([[-134, 69], [-108, 64], [-86, 62], [-70, 60], [-60, 57], [-53, 51], [-49, 43], [-46, 36]]), false),
    sillonLangue: lisse(b([[-130, 66], [-106, 61], [-86, 59], [-70, 57], [-60, 54]]), false),
    incisives: lisse(h([[-10, 50, 1], [-10.5, 55], [-12.5, 59, 1], [-15, 55.5], [-15.5, 50, 1]])) + lisse(h([[-16, 50, 1], [-16.5, 56], [-18.5, 60, 1], [-21, 56.5], [-21.5, 50, 1]])) + lisse(h([[-22, 48, 1], [-22.5, 56], [-25, 62.5, 1], [-27.5, 56], [-28, 47, 1]])),
    croc: lisse(h([[-30, 42, 1], [-30.5, 56], [-32, 70], [-34.5, 82], [-37.5, 91], [-39.5, 95, 1], [-42.5, 86], [-45.5, 72], [-47.5, 58], [-49, 43, 1]])),
    crocLoin: lisse(h([[-40, 44, 1], [-42, 58], [-44, 70], [-47, 82, 1], [-51, 70], [-53, 58], [-54, 46, 1]])),
    premolaires: lisse(h([[-52, 47, 1], [-53.5, 52], [-55.5, 55, 1], [-57.5, 52], [-58.5, 49, 1]])) + lisse(h([[-60, 54, 1], [-62, 61], [-65.5, 66, 1], [-69, 61], [-71, 56, 1]])) + lisse(h([[-78, 60, 1], [-81, 67], [-84, 70, 1], [-87.5, 66, 1], [-92, 78, 1], [-98, 69, 1], [-104, 72, 1], [-110, 66, 1]])),
    incBas: lisse(b([[-12, 63, 1], [-12.5, 58], [-14.5, 54.5, 1], [-16.5, 58], [-17, 63, 1]])) + lisse(b([[-17.5, 63, 1], [-18, 58], [-20, 54, 1], [-22, 58], [-22.5, 63, 1]])) + lisse(b([[-23, 64, 1], [-23.5, 59], [-25.5, 54.5, 1], [-27.5, 59], [-28, 64, 1]])),
    crocBas: lisse(b([[-28, 64, 1], [-28.5, 54], [-30, 44], [-32, 35], [-34.5, 27, 1], [-38, 33], [-41, 42], [-43.5, 53], [-45, 65, 1]])),
    crocBasLoin: lisse(b([[-38, 66, 1], [-39.5, 57], [-41.5, 48], [-44, 40, 1], [-47.5, 48], [-50, 57], [-51.5, 68, 1]])),
    premBas: lisse(b([[-60, 74, 1], [-62, 67], [-65, 62, 1], [-68, 67], [-70, 75, 1]])) + lisse(b([[-78, 77, 1], [-80, 69], [-83.5, 64, 1], [-87, 68, 2], [-90, 65, 1], [-93, 70], [-95, 78, 1]])),
    coussinet: lisse(h([[2, 18], [-6, 6], [-18, -1], [-34, -4], [-52, -1], [-68, 8], [-80, 22], [-86, 38], [-82, 52], [-76, 61], [-64, 54], [-54, 44], [-44, 39], [-34, 39], [-26, 44], [-18, 50], [-12, 52], [-6, 46], [-2, 34]])),
    truffe: lisse(h([[7, -3], [6, 7], [0, 14], [-9, 15], [-19, 10], [-28, 1], [-33, -9], [-27, -18], [-12, -20], [1, -15]])),
    narine: lisse(h([[3, 4], [-3, 9], [-12, 8], [-19, 2], [-15, -1], [-8, 3], [-2, 2]])),
    plis: ([
      [[-36, -30], [-40, -21], [-39, -12]],
      [[-50, -34], [-55, -24], [-54, -13]],
      [[-64, -39], [-70, -28], [-70, -16]],
    ] satisfies P[][]).map((l) => lisse(h(l), false)),
    oeil: lisse(h([[-88, -31, 1], [-96, -38], [-106, -46], [-118, -51], [-131, -51], [-140, -47, 1], [-130, -43], [-118, -40], [-106, -37], [-96, -34]])),
    larme: lisse(h([[-89, -31], [-85, -25], [-82, -18]]), false),
    arcade: lisse(h([[-80, -50], [-96, -60], [-114, -65], [-132, -63], [-146, -56]]), false),
    rides: ([
      [[-84, -58], [-95, -63], [-106, -66]],
      [[-98, -68], [-110, -73], [-122, -77]],
    ] satisfies P[][]).map((l) => lisse(h(l), false)),
    poils: ([
      [[-110, -24], [-124, -22], [-138, -17]], [[-132, -27], [-147, -25], [-161, -18]], [[-154, -29], [-169, -25], [-183, -16]],
      [[-98, -6], [-114, -3], [-130, 3]], [[-122, -9], [-139, -5], [-155, 2]], [[-146, -11], [-163, -6], [-180, 3]],
      [[-96, 12], [-112, 17], [-128, 25]], [[-120, 9], [-138, 15], [-154, 24]], [[-144, 7], [-162, 14], [-178, 24]],
      [[-108, 32], [-124, 38], [-140, 47]], [[-134, 30], [-152, 37], [-168, 47]],
    ] satisfies P[][]).map((l) => lisse(h(l), false)),
    vibrisses: h([[-22, 18], [-34, 16], [-46, 17], [-58, 20], [-70, 25], [-28, 30], [-40, 29], [-52, 31], [-64, 34], [-76, 38], [-36, 41], [-48, 42], [-60, 44]])
      .map(([px, py]) => `M${f(px)} ${f(py)}h.1`)
      .join(""),
    oreille: lisse(h([[-164, -112], [-168, -136], [-178, -156], [-194, -168], [-210, -164], [-219, -148], [-218, -128], [-210, -112]])),
    conque: lisse(h([[-174, -120], [-178, -138], [-188, -152], [-201, -155], [-208, -143], [-206, -127], [-199, -118]])),
  };
}

const TETE = construireTete();

/* ------------------------------ La crinière ------------------------------ */

/**
 * Une touffe : de sa racine (x, y), son âme part dans la direction a (degrés : 0 vers la droite, 90 vers le
 * bas), longue de l, large de w ; elle quitte la racine tournée de d1 et arrive tournée de d2 (la pesanteur),
 * son bout tourne encore du crochet (15° au plus) et se fend en deux ou trois pointes inégales (fente, FENTES).
 */
type Touffe = readonly [x: number, y: number, a: number, l: number, w: number, d1: number, d2: number, crochet: number, fente: number];
const rad = (a: number) => (a * Math.PI) / 180;

/** Le bout d'une touffe : ses pointes (1) et ses creux (2), en (s le long de l'âme, k en demi-largeurs), de son bord k > 0 à son bord k < 0. */
const FENTES: (readonly [number, number, number])[][] = [
  [[0.88, 0.44, 1], [0.79, 0.18, 2], [1, -0.02, 1], [0.81, -0.22, 2], [0.91, -0.46, 1]],
  [[1, 0.14, 1], [0.8, -0.14, 2], [0.9, -0.44, 1]],
  [[0.92, 0.46, 1], [0.8, 0.2, 2], [1, 0, 1], [0.78, -0.2, 2], [0.86, -0.44, 1]],
  [[0.88, 0.42, 1], [0.78, 0.12, 2], [1, -0.12, 1]],
  // la fraise : un bout plein, arrondi, à peine pointu (une collerette, pas des épines)
  [[0.8, 0.84, 0], [0.92, 0.56, 0], [0.99, 0.22, 1], [0.92, 0.02, 2], [0.98, -0.28, 1], [0.88, -0.66, 0]],
];

function touffe([x, y, a, l, w, d1, d2, crochet, fente]: Touffe) {
  const E: [number, number] = [x + l * Math.cos(rad(a)), y + l * Math.sin(rad(a))];
  const P1 = [x + (l / 3) * Math.cos(rad(a + d1)), y + (l / 3) * Math.sin(rad(a + d1))];
  const P2 = [E[0] - (l / 3) * Math.cos(rad(a + d2)), E[1] - (l / 3) * Math.sin(rad(a + d2))];
  const at = (t: number): [number, number] => {
    const u = 1 - t;
    return [u * u * u * x + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * E[0], u * u * u * y + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * E[1]];
  };
  const tan = (t: number): [number, number] => {
    const u = 1 - t;
    const dx = 3 * u * u * (P1[0] - x) + 6 * u * t * (P2[0] - P1[0]) + 3 * t * t * (E[0] - P2[0]);
    const dy = 3 * u * u * (P1[1] - y) + 6 * u * t * (P2[1] - P1[1]) + 3 * t * t * (E[1] - P2[1]);
    const n = Math.hypot(dx, dy) || 1;
    return [dx / n, dy / n];
  };
  // Le crochet : le bout tourne autour de l'âme à 55 %, de plus en plus.
  const pivot = at(0.55);
  const point = (s: number, k: number, coin = 0): P => {
    const [px, py] = at(Math.min(1, s));
    const [tx, ty] = tan(Math.min(1, s));
    let [qx, qy] = [px - ty * k * (w / 2), py + tx * k * (w / 2)];
    if (s > 0.55) {
      const g = rad(crochet * ((s - 0.55) / 0.45));
      const [dx, dy] = [qx - pivot[0], qy - pivot[1]];
      [qx, qy] = [pivot[0] + dx * Math.cos(g) - dy * Math.sin(g), pivot[1] + dx * Math.sin(g) + dy * Math.cos(g)];
    }
    return coin ? [qx, qy, coin] : [qx, qy];
  };
  const plein = fente === 4;
  const bord = plein ? ([[0, 1], [0.18, 1.02], [0.36, 1.03], [0.52, 1.01], [0.66, 0.96]] as const) : ([[0, 1], [0.16, 1.03], [0.32, 1.04], [0.5, 1.01], [0.64, 0.9], [0.75, 0.72]] as const);
  const forme = lisse([
    point(0, 1, 1),
    ...bord.slice(1).map(([s, k]) => point(s, k)),
    ...FENTES[fente].map(([s, k, c]) => point(s, k, c)),
    ...[...bord].reverse().slice(0, -1).map(([s, k]) => point(s, -k)),
    point(0, -1, 1),
  ]);
  // Les sillons : de 4 à 6 traits parallèles, de la racine jusque dans le bout, qui se serrent avec lui.
  const n = w >= 64 ? 6 : w >= 46 ? 5 : 4;
  const enveloppe = plein
    ? (s: number) => (s <= 0.66 ? 1 : 1 - ((s - 0.66) / 0.34) * 0.8)
    : (s: number) => (s <= 0.5 ? 1 : s <= 0.75 ? 1 - ((s - 0.5) / 0.25) * 0.3 : 0.7 * (1 - (s - 0.75) / 0.3));
  let sillons = "";
  for (let i = 0; i < n; i++) {
    const k = -0.66 + (1.32 * i) / (n - 1);
    const fin = 0.72 + 0.12 * (1 - Math.abs(k) / 0.66);
    const ss = [0.05, 0.2, 0.36, 0.52, 0.64, fin];
    sillons += lisse(ss.map((s) => point(s, k * enveloppe(s))), false);
  }
  // La racine sort du fond de la crinière : un dégradé de l'ombre vers l'argile, sur le premier quart.
  const racine = [x, y, x + 0.26 * l * Math.cos(rad(a)), y + 0.26 * l * Math.sin(rad(a))].map(f);
  return { forme, sillons, racine };
}

// Les touffes, posées une à une, de l'arrière vers l'avant (celle du dessus couvre) :
// [racine x, y, direction, longueur, largeur, départ, arrivée, crochet, fente].
/** Le socle : la crinière profonde, sous toutes les touffes (entre deux touffes, on voit le fond, jamais le mur). */
const SOCLE = lisse([
  [258, 150], [232, 118], [178, 108], [126, 120], [92, 150], [80, 196], [70, 252], [68, 310], [72, 370], [82, 436], [102, 504], [134, 566], [178, 620], [238, 660], [305, 680], [378, 682],
  [444, 668], [494, 640], [520, 608], [500, 580], [470, 556], [420, 520], [384, 450], [372, 412], [356, 394], [310, 342], [276, 272], [256, 200],
]);
/** Le rang du fond : la crête derrière l'oreille, le dos du cou, le poitrail ; leurs pointes font le bord de la crinière. */
const FOND: Touffe[] = [
  [270, 154, 245, 104, 62, 12, -22, -8, 0], [244, 155, 236, 132, 70, 12, -22, -8, 2], [219, 169, 225, 152, 76, 12, -22, -8, 1], [203, 188, 212, 166, 80, 12, -22, -8, 3], [189, 212, 199, 172, 82, 12, -22, -8, 0], [183, 249, 187, 176, 82, 12, -22, -8, 2], [180, 294, 176, 178, 82, 12, -22, -8, 1], [180, 339, 165, 180, 82, 12, -22, -8, 3], [182, 386, 154, 182, 82, 12, -22, -8, 0], [191, 438, 144, 184, 82, 12, -22, -8, 2], [209, 486, 134, 186, 82, 12, -22, -8, 1], [237, 531, 124, 184, 80, 12, -22, -8, 3], [279, 566, 114, 180, 78, 12, -22, -8, 0], [332, 589, 104, 172, 76, 5, -9, -8, 2], [386, 597, 95, 162, 72, 5, -9, -8, 1], [438, 592, 86, 150, 66, -5, 9, 8, 3], [482, 581, 78, 134, 60, -5, 9, 8, 0], [512, 567, 70, 112, 54, -5, 9, 8, 2],
];
/** Le rang du milieu, entre la fraise et le fond. */
const MILIEU: Touffe[] = [
  [240, 140, 232, 120, 60, 11, -20, -8, 1], [222, 172, 214, 130, 70, 11, -20, -8, 0], [212, 212, 196, 134, 76, 11, -20, -8, 3], [216, 254, 180, 136, 78, 11, -20, -8, 2], [230, 294, 166, 136, 78, 11, -20, -8, 1], [248, 332, 154, 136, 78, 11, -20, -8, 0], [268, 368, 144, 136, 78, 11, -20, -8, 3], [292, 404, 134, 160, 78, 11, -20, -8, 2], [318, 438, 124, 160, 76, 11, -20, -8, 1], [318, 456, 128, 156, 78, 8, -14, -8, 3], [348, 470, 114, 160, 74, 5, -9, -8, 0], [352, 492, 112, 152, 76, 5, -9, -8, 2], [378, 520, 104, 124, 70, 5, -9, -8, 3], [410, 550, 96, 118, 66, 5, -9, -8, 2], [442, 566, 88, 110, 60, -5, 9, 8, 1], [472, 576, 80, 96, 54, -5, 9, 8, 0],
];
/** La gorge : sous la mâchoire, des touffes qui pendent (leurs racines sous elle). */
const GORGE: Touffe[] = [
  [392, 436, 108, 106, 60, 4, -7, 6, 2], [412, 466, 100, 108, 60, 4, -7, 6, 0], [436, 492, 94, 106, 58, 4, -7, 6, 3], [462, 514, 88, 100, 54, -4, 7, -6, 1], [488, 530, 82, 92, 48, -4, 7, -6, 2],
];
/** La fraise : de courtes touffes qui partent de sous la lisière de la face et l'encadrent. */
const FRAISE: Touffe[] = [
  [270, 150, 222, 78, 64, 12, -20, -4, 4], [266, 178, 202, 90, 72, 12, -20, -4, 4], [268, 208, 189, 86, 68, 12, -20, -4, 4], [274, 238, 176, 98, 74, 12, -18, -4, 4],
  [284, 268, 166, 90, 68, 10, -16, -4, 4], [297, 297, 157, 100, 76, 10, -16, -4, 4], [312, 325, 148, 92, 70, 10, -14, -4, 4], [330, 352, 139, 100, 74, 8, -12, -4, 4],
  [350, 376, 130, 94, 70, 8, -10, -4, 4], [370, 398, 121, 100, 72, 6, -8, -4, 4],
];

const CRINIERE = {
  fond: FOND.map(touffe),
  milieu: MILIEU.map(touffe),
  gorge: GORGE.map(touffe),
  fraise: FRAISE.map(touffe),
  get toutes() {
    return [...this.fond, ...this.milieu, ...this.gorge, ...this.fraise];
  },
};
/** La masse de la crinière : l'union de ses touffes et du socle (un seul chemin ; tous tournent dans le même sens, rien ne s'annule). */
const MASSE = CRINIERE.toutes.map((m) => m.forme).join("") + SOCLE;

/* -------------------------------- Le modelé -------------------------------- */

/**
 * Des touffes taillées dans la masse, chacune : son ombre courte sur la touffe de dessous et son arête de lumière
 * (prises dans la masse), son argile qui sort de l'ombre du fond, ses sillons incisés. Jamais de sillon autour d'elle.
 */
function Meches({ liste, corps, masse, id }: { liste: { forme: string; sillons: string; racine: number[] }[]; corps: string; masse: string; id: string }) {
  return (
    <>
      {liste.map((m, i) => (
        <g key={i}>
          <linearGradient id={`${id}-${i}`} gradientUnits="userSpaceOnUse" x1={m.racine[0]} y1={m.racine[1]} x2={m.racine[2]} y2={m.racine[3]}>
            <stop offset="0" stopColor="#6a4c30" />
            <stop offset="1" stopColor={corps} />
          </linearGradient>
          <path d={m.forme} fill="rgba(46,26,10,0.34)" transform="translate(3.5 4.6)" clipPath={`url(#${masse})`} />
          <path d={m.forme} fill="rgba(255,246,228,0.55)" transform="translate(-1.6 -2.1)" clipPath={`url(#${masse})`} />
          <path d={m.forme} fill={`url(#${id}-${i})`} />
          <path d={m.sillons} fill="none" stroke="rgba(255,246,228,0.5)" strokeWidth={1.6} strokeLinecap="round" transform="translate(0.9 1.2)" />
          <path d={m.sillons} fill="none" stroke="rgba(58,34,16,0.55)" strokeWidth={1.8} strokeLinecap="round" />
        </g>
      ))}
    </>
  );
}

/** Le galbe d'une dalle (en boîte de la forme) : la lumière en haut à gauche. */
function Galbe({ id, force = 0.36 }: { id: string; force?: number }) {
  return (
    <radialGradient id={id} cx="0.3" cy="0.26" r="0.85">
      <stop offset="0" stopColor="#fff8ea" stopOpacity={force} />
      <stop offset="0.6" stopColor="#fff8ea" stopOpacity={force * 0.2} />
      <stop offset="1" stopColor="#3a2412" stopOpacity={0.12} />
    </radialGradient>
  );
}

/** Une dalle d'argile posée : son ombre portée (franche, puis un halo), l'argile, son galbe, le biseau du bord. k : l'épaisseur du biseau. */
function Dalle({ d, corps, id, galbe, e = 1, k = 1, enfants }: { d: string; corps: string; id: string; galbe: string; e?: number; k?: number; enfants?: ReactNode }) {
  return (
    <>
      <path d={d} fill="rgba(46,26,10,0.16)" transform={`translate(${f(9 * e)} ${f(12 * e)})`} />
      <path d={d} fill="rgba(46,26,10,0.48)" transform={`translate(${f(4 * e)} ${f(5.4 * e)})`} />
      <path d={d} fill={corps} />
      <path d={d} fill={`url(#${galbe})`} />
      <clipPath id={id}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${id})`} fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path d={d} stroke="#fff6e4" strokeOpacity={0.6} strokeWidth={f(5 * k)} transform={`translate(${f(2.2 * k)} ${f(2.8 * k)})`} />
        <path d={d} stroke="#3a2412" strokeOpacity={0.32} strokeWidth={f(8 * k)} transform={`translate(${f(-3 * k)} ${f(-4 * k)})`} />
        {enfants}
      </g>
    </>
  );
}

const INCISE = "rgba(58,34,16,0.8)";
const LUMIERE = "rgba(255,247,232,0.9)";
/** Un trait incisé : le creux prend l'ombre, sa lèvre basse la lumière. */
const Incise = ({ d, l, o = 1 }: { d: string; l: number; o?: number }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={o}>
    <path d={d} stroke={LUMIERE} strokeWidth={f(l * 0.85)} transform={`translate(${f(l * 0.45)} ${f(l * 0.6)})`} />
    <path d={d} stroke={INCISE} strokeWidth={l} />
  </g>
);

// L'argile : la crinière plus sombre que le mur (#cdb28b), la face lissée bien plus claire ; la gueule, la langue, les dents.
const ARGILE = {
  fond: "#a07e57", milieu: "#ab8860", gorge: "#b08d66", fraise: "#c2a278", socle: "#7a5a3a",
  tete: "#e5d0ab", machoire: "#dcc49e", coussinet: "#ead7b4", truffe: "#a07e5c", oreille: "#d4b78e", conque: "#8d6b48",
  langue: "#8b553e", gencive: "#74432f", levre: "#3e2718", dents: "#f3ead6", loin: "#cdb999", oeil: "#2a170b",
};

function Buste({ id }: { id: string }) {
  const t = TETE;
  const c = (k: string) => `cm-${k}-${id}`;
  const g = c("galbe");
  const masse = c("masse");
  // Hors d'une ou de plusieurs formes (des chemins séparés : deux contours de sens contraires ne s'annulent pas).
  const hors = (k: string, ds: string[]) => (
    <mask id={c(k)} maskUnits="userSpaceOnUse" x={0} y={0} width={700} height={760}>
      <rect x={0} y={0} width={700} height={760} fill="#fff" />
      {ds.map((d, i) => (
        <path key={i} d={d} fill="#000" />
      ))}
    </mask>
  );
  return (
    <>
      <defs>
        <Galbe id={g} />
        <clipPath id={masse}>
          <path d={MASSE} />
        </clipPath>
        <linearGradient id={c("gueule")} gradientUnits="userSpaceOnUse" x1={f(t.K[0])} y1={f(t.K[1])} x2={f(t.K[0] + 170)} y2={f(t.K[1] - 20)}>
          <stop offset="0" stopColor="#1e1008" />
          <stop offset="0.55" stopColor="#3a2014" />
          <stop offset="1" stopColor="#56301f" />
        </linearGradient>
        <linearGradient id={c("langue")} gradientUnits="userSpaceOnUse" x1={f(t.K[0])} y1={f(t.K[1])} x2={f(t.K[0] + 150)} y2={f(t.K[1] + 50)}>
          <stop offset="0" stopColor="#5a2f20" />
          <stop offset="0.5" stopColor="#7d4732" />
          <stop offset="1" stopColor="#9a5f46" />
        </linearGradient>
        <radialGradient id={c("bosse")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffaf0" stopOpacity="0.42" />
          <stop offset="1" stopColor="#fffaf0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={c("creux")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#5a3a20" stopOpacity="0.2" />
          <stop offset="1" stopColor="#5a3a20" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={c("orbite")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#3a2412" stopOpacity="0.42" />
          <stop offset="1" stopColor="#3a2412" stopOpacity="0" />
        </radialGradient>
        {hors("hh", [t.haut])}
        {hors("hb", [t.bas, t.haut])}
      </defs>
      {/* La crinière : une masse posée sur le mur (son ombre, son arête de lumière), le fond, puis les touffes, de l'arrière vers l'avant. */}
      <path d={MASSE} fill="rgba(46,26,10,0.18)" transform="translate(12 16)" />
      <path d={MASSE} fill="rgba(46,26,10,0.45)" transform="translate(5 7)" />
      <path d={MASSE} fill="rgba(255,246,228,0.85)" transform="translate(-2.4 -3)" />
      <path d={SOCLE} fill={ARGILE.socle} />
      <Meches liste={CRINIERE.fond} corps={ARGILE.fond} masse={masse} id={c("f")} />
      <Meches liste={CRINIERE.milieu} corps={ARGILE.milieu} masse={masse} id={c("m")} />
      <Meches liste={CRINIERE.gorge} corps={ARGILE.gorge} masse={masse} id={c("g")} />
      {/* La gueule : le fond, la langue en gouttière (sans ombre portée), plus sombre vers la gorge. */}
      <path d={t.gorge} fill={`url(#${c("gueule")})`} />
      <path d={t.langue} fill={`url(#${c("langue")})`} />
      <clipPath id={c("la")}>
        <path d={t.langue} />
      </clipPath>
      <g clipPath={`url(#${c("la")})`} fill="none" strokeLinecap="round">
        <path d={t.langue} stroke="#c88a6c" strokeOpacity={0.55} strokeWidth={4} transform="translate(1.5 2.2)" />
        <path d={t.sillonLangue} stroke="#4a2416" strokeOpacity={0.7} strokeWidth={2.6} />
        <path d={t.rebord} stroke="#c98d70" strokeOpacity={0.75} strokeWidth={3.2} />
      </g>
      {/* La mâchoire, sa lèvre noire qui pend ; puis les dents du bas, hors d'elle. */}
      <Dalle
        d={t.bas}
        corps={ARGILE.machoire}
        id={c("ba")}
        galbe={g}
        e={1.1}
        k={1.1}
        enfants={
          <>
            <path d={t.levreBas} stroke={ARGILE.levre} strokeWidth={14} fill="none" />
            <path d={t.papilles} stroke={ARGILE.levre} strokeWidth={5} strokeLinecap="round" fill="none" />
          </>
        }
      />
      <g mask={`url(#${c("hb")})`}>
        <path d={t.levreBas} stroke={ARGILE.gencive} strokeWidth={9} fill="none" strokeLinecap="round" />
        <path d={t.crocBasLoin} fill={ARGILE.loin} />
        <path d={t.premBas + t.incBas} fill={ARGILE.dents} stroke="rgba(90,60,36,0.45)" strokeWidth={1} />
        <path d={t.crocBas} fill={ARGILE.dents} stroke="rgba(90,60,36,0.45)" strokeWidth={1} />
        <path d={t.crocBasOmbre} fill="rgba(120,92,62,0.3)" />
      </g>
      {t.poilsBas.map((d, i) => (
        <Incise key={i} d={d} l={2} o={0.42} />
      ))}
      <Meches liste={CRINIERE.fraise} corps={ARGILE.fraise} masse={masse} id={c("r")} />
      <Dalle d={t.oreille} corps={ARGILE.oreille} id={c("or")} galbe={g} e={0.8} k={0.7} enfants={<path d={t.conque} fill={ARGILE.conque} fillOpacity={0.7} />} />
      {/* La tête : la dalle la plus haute, sa lèvre noire ; le poil de la joue, l'œil, les rides, le chanfrein plissé. */}
      <Dalle
        d={t.haut}
        corps={ARGILE.tete}
        id={c("ha")}
        galbe={g}
        e={1.3}
        k={1.4}
        enfants={
          <>
            {t.modele.map((m, i) => (
              <ellipse key={i} cx={f(m.c[0])} cy={f(m.c[1])} rx={f(m.rx)} ry={f(m.ry)} transform={`rotate(${REGLAGE.leve} ${f(m.c[0])} ${f(m.c[1])})`} fill={`url(#${c(m.l ? "bosse" : "creux")})`} />
            ))}
            <path d={t.levreHaut} stroke={ARGILE.levre} strokeWidth={9} fill="none" />
          </>
        }
      />
      <Incise d={t.commissure} l={3.4} o={0.85} />
      {t.poils.map((d, i) => (
        <Incise key={i} d={d} l={2.2} o={0.5} />
      ))}
      <ellipse cx={f(t.oeilC[0])} cy={f(t.oeilC[1])} rx={34} ry={22} transform={`rotate(-20 ${f(t.oeilC[0])} ${f(t.oeilC[1])})`} fill={`url(#${c("orbite")})`} />
      <path d={t.arcade} fill="none" stroke="rgba(255,248,234,0.85)" strokeWidth={5} strokeLinecap="round" transform="translate(-2 -3)" />
      <Incise d={t.arcade} l={4.2} o={0.9} />
      {t.rides.map((d, i) => (
        <Incise key={i} d={d} l={3.2} o={0.8} />
      ))}
      <path d={t.larme} fill="none" stroke={ARGILE.oeil} strokeWidth={4} strokeLinecap="round" />
      <path d={t.oeil} fill={ARGILE.oeil} />
      <clipPath id={c("oe")}>
        <path d={t.oeil} />
      </clipPath>
      <g clipPath={`url(#${c("oe")})`}>
        <circle cx={f(t.iris[0])} cy={f(t.iris[1])} r={11} fill="#a8783f" />
        <circle cx={f(t.iris[0])} cy={f(t.iris[1])} r={5.5} fill="#1c0e06" />
        <circle cx={f(t.iris[0] - 3)} cy={f(t.iris[1] - 3.5)} r={2} fill="#fff4e0" />
      </g>
      <path d={t.paupiere} fill="none" stroke="rgba(255,248,234,0.9)" strokeWidth={2.4} strokeLinecap="round" />
      {t.plis.map((d, i) => (
        <Incise key={i} d={d} l={3.4} o={0.85} />
      ))}
      <Dalle d={t.coussinet} corps={ARGILE.coussinet} id={c("co")} galbe={g} e={0.6} k={0.6} enfants={<Incise d={t.repli} l={3} o={0.7} />} />
      <path d={t.vibrisses} stroke="rgba(58,34,16,0.7)" strokeWidth={4.2} strokeLinecap="round" />
      <Dalle d={t.truffe} corps={ARGILE.truffe} id={c("tr")} galbe={g} e={0.45} k={0.4} />
      <path d={t.narine} fill="rgba(36,20,10,0.9)" />
      {/* Les dents du haut, après la tête et hors d'elle : rien ne les couvre ; le croc de l'autre côté, plus sombre, en retrait. */}
      <g mask={`url(#${c("hh")})`}>
        <path d={t.levreHaut} stroke={ARGILE.gencive} strokeWidth={10} fill="none" strokeLinecap="round" />
        <path d={t.crocLoin} fill={ARGILE.loin} />
        <path d={t.premolaires + t.incisives} fill={ARGILE.dents} stroke="rgba(90,60,36,0.45)" strokeWidth={1} />
        <path d={t.croc} fill={ARGILE.dents} stroke="rgba(90,60,36,0.45)" strokeWidth={1} />
        <path d={t.crocOmbre} fill="rgba(120,92,62,0.35)" />
      </g>
    </>
  );
}

/**
 * La face : un sceau d'argile pressé dans le coin du portrait, le même buste en petit, rien que des arêtes (la
 * lumière en haut à gauche, l'ombre en bas à droite) : le bord du buste, la collerette, la face, l'oreille ; le
 * corps à peine teinté ; la gueule en creux, les crocs, l'œil et la truffe.
 */
function Sceau({ id, photo }: { id: string; photo: boolean }) {
  const t = TETE;
  const c = (k: string) => `cm-s${k}-${id}`;
  const corps = photo ? "rgba(214,190,152,0.22)" : "rgba(196,165,125,0.2)";
  const lum = photo ? "rgba(255,247,232,0.86)" : "rgba(255,250,240,0.95)";
  const omb = photo ? "rgba(40,24,12,0.68)" : "rgba(78,52,30,0.52)";
  // Des listes de chemins, jamais un seul chemin : deux contours de sens contraires s'annuleraient (règle non nulle).
  const visage = [t.bas, t.haut, t.oreille];
  const tout = [MASSE, ...visage];
  const fraise = CRINIERE.fraise.map((m) => m.forme);
  /** Hors d'une forme : les arêtes ne se voient qu'autour d'elle, jamais à travers le corps teinté. */
  const hors = (k: string, ds: string[]) => (
    <mask id={c(k)} maskUnits="userSpaceOnUse" x={-20} y={-20} width={740} height={800}>
      <rect x={-20} y={-20} width={740} height={800} fill="#fff" />
      {ds.map((d, i) => (
        <path key={i} d={d} fill="#000" />
      ))}
    </mask>
  );
  const aretes = (ds: string[], e: number) => (
    <>
      <g fill={omb} transform={`translate(${e} ${f(e * 1.25)})`}>
        {ds.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill={lum} transform={`translate(${-e} ${f(-e * 1.25)})`}>
        {ds.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </>
  );
  return (
    <>
      <defs>
        {hors("tout", tout)}
        {hors("visage", visage)}
        {hors("fraise", [...fraise, ...visage])}
      </defs>
      <g mask={`url(#${c("tout")})`}>{aretes(tout, 7)}</g>
      {/* La crinière : ses mèches posées comme au dos, opaques entre elles (chacune cache celle de dessous), le tout à peine teinté. */}
      <g mask={`url(#${c("visage")})`} opacity={photo ? 0.34 : 0.3}>
        <path d={SOCLE} fill={photo ? "#8a6a48" : "#9c7c58"} />
        {[...CRINIERE.fond, ...CRINIERE.milieu, ...CRINIERE.gorge, ...CRINIERE.fraise].map((m, i) => (
          <g key={i}>
            <path d={m.forme} fill={photo ? "#e9d8bb" : "#e6d3b2"} />
            <path d={m.forme} fill="none" stroke={photo ? "#2a1a0e" : "#5a3d24"} strokeWidth={3.5} strokeLinejoin="round" />
          </g>
        ))}
      </g>
      {/* La collerette, puis la face et l'oreille, se détachent de la crinière : leurs arêtes sur elle. */}
      <g mask={`url(#${c("fraise")})`}>{aretes(fraise, 4)}</g>
      <g mask={`url(#${c("visage")})`}>{aretes(visage, 5.5)}</g>
      <g fill={corps}>
        {visage.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <path d={t.conque} fill={omb} />
      <path d={t.gorge} fill={omb} />
      <path d={t.croc + t.crocBas} fill={lum} />
      <path d={t.oeil} fill={omb} stroke={omb} strokeWidth={7} strokeLinejoin="round" />
      <path d={t.truffe} fill={omb} />
      <path d={t.coussinet} fill="none" stroke={lum} strokeWidth={4} transform="translate(-2 -2.5)" />
    </>
  );
}

function Dessin({ couche, id, photo }: PropsTotem): ReactNode {
  if (couche === "dos") return <Buste id={id} />;
  if (couche === "face-portrait") return <Sceau id={id} photo={photo} />;
  return null;
}

const totem: TotemNation = {
  nation: "cm",
  animal: "lion",
  quoi: "Le lion qui rugit en buste, de profil, la tête à peine levée, la gueule grande ouverte, la crinière taillée en touffes dans une masse d'argile du teleuk, la fraise en collerette autour de la face ; un sceau d'argile dans le coin du portrait.",
  sources: [
    { titre: "How2DrawAnimals : le lion qui rugit de profil (la gueule, les crocs, la lèvre, le nez plissé)", url: "https://how2drawanimals.com/8-animals/478-draw-lion-roaring-color.html?start=3" },
    { titre: "Envato Tuts+ : dessiner un lion qui rugit (la mâchoire qui tombe, la commissure)", url: "https://design.tutsplus.com/tutorials/how-to-draw-a-roaring-lion-step-by-step--cms-28155" },
    { titre: "M. Lailme : le lion gueule ouverte (la lèvre du bas plus épaisse, le croc du bas juste devant celui du haut)", url: "https://michellelailme.blogspot.com/2022/02/how-to-draw-lion-with-its-mouth-open.html" },
    { titre: "K. Goldfinger, Animal Anatomy for Artists (Oxford University Press, 2004) : planches du lion, squelette et muscles", url: "https://academic.oup.com/book/41965" },
    { titre: "La chasse au lion d'Assurbanipal (British Museum) : la crinière en touffes taillées, rangées en rangs", url: "https://en.wikipedia.org/wiki/Lion_Hunt_of_Ashurbanipal" },
    { titre: "Earth Architecture : les reliefs en V des cases obus musgum", url: "https://eartharchitecture.org/?cat=143" },
  ],
  dessine: true,
  boite: { w: 700, h: 760 },
  pose: {
    dos: { x: -10, y: 290, echelle: 1.1, devant: true, lune: LUNE_CAMEROUN },
    face: { portrait: { x: 84, y: 748, echelle: 0.215 } },
  },
  Dessin,
};

export default totem;
