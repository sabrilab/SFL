// Le totem de la Côte d'Ivoire (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// L'éléphant de savane, un mâle, de profil, qui marche vers la gauche. Ses
// mesures sont celles de l'animal : le dessous du ventre à 48 % de la hauteur
// au garrot, la longueur du front à la croupe 1,3 fois cette hauteur ; le dos
// en selle (le garrot au plus haut, un creux, la bosse de la hanche, puis la
// croupe qui tombe franchement jusqu'à la queue) ; le dôme unique du crâne,
// le front fuyant que la trompe prolonge ; l'oreille immense, celle qui dit
// « Afrique » : son bord haut passe au-dessus de la ligne du cou, son bord
// arrière ondule, sa pointe basse pend sous la mâchoire, devant la jambe ;
// la trompe qui s'affine (de 84 à 26) et finit en crochet, loin du sol ; la
// défense qui part en avant puis remonte ; un vrai pas : la jambe avant
// proche portée en avant, l'avant loin d'aplomb, l'arrière proche sous la
// hanche, le genou marqué, l'arrière loin rejeté en arrière ; des pieds
// ronds, les ongles devant. Le savane plutôt que le forêt : Korhogo est au
// nord, dans la savane, près du parc de la Comoé.
// Il est peint comme sur la toile de Korhogo (../cote-d-ivoire.tsx) : la
// boue brun-noir sur le coton écru, au pinceau, d'une main qui tremble un
// peu (le même tremblement que les cases de la toile) ; le contour à
// épaisseur variable (5 à 8), doublé à l'intérieur d'une bande de coton nu
// et d'un rang de points ; chaque partie a sa géométrie : des hachures
// reprises au pinceau (2 à 4), d'un sens sur le flanc, de l'autre sur la
// cuisse que le pli de la hanche sépare ; des anneaux pour les jambes et la
// trompe ; des rangs de points pour la tête ; dans l'oreille, des nervures
// qui partent de sa racine, des points entre elles ; les jambes du côté loin
// pleines de boue, des points de coton réservés ; la défense est le coton
// nu ; la sole pleine, les ongles réservés.
//   · au dos : le héros, sur le grand champ de la toile, sous le cercle de
//     coton de la lune (LUNE_CI) ; il marche sur une bande peinte (SOL_CI) ;
//     le skin les dessine ;
//   · à la face : le même éléphant, retourné vers la photo, en gaufrage dans
//     le coin bas gauche du portrait, à droite de l'équerre : une arête de
//     lumière, une ombre.
// Les tracés sont des points posés à la main, liés en béziers tendus ; la
// graine ne fait que trembler le pinceau (le contour, les hachures, les
// points), jamais la silhouette.

import type { PropsTotem, TotemNation } from "../types";
import { alea, f } from "../outils";

/** La lune, au-dessus du dos de l'éléphant (le skin, ../cote-d-ivoire.tsx, y pose son cercle de coton). */
export const LUNE_CI = { cx: 512, cy: 392, d: 240 } as const;
/** La bande peinte où marche l'éléphant, au dos (le skin la dessine). */
export const SOL_CI = { y: 1118 } as const;

/* ------------------------------ Les tracés ------------------------------ */

type P = readonly [number, number] | readonly [number, number, number];
type Seg = [number, number, number, number, number, number, number, number];
type Rnd = () => number;

/**
 * Des points posés à la main, liés en béziers tendus : chaque point prend la
 * tangente de son voisin d'avant vers son voisin d'après, les poignées valent
 * un tiers de la corde (la courbe ne déborde pas). Un point marqué 1 est un
 * angle, 2 un angle adouci. Ouvert : les deux bouts sans tangente.
 */
function segments(pts: readonly P[], ferme = true): Seg[] {
  const n = pts.length;
  const at = (i: number) => pts[ferme ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  const tangente = (i: number): [number, number] => {
    const p = at(i);
    if (p[2] === 1 || (!ferme && (i <= 0 || i >= n - 1))) return [0, 0];
    const [a, b] = [at(i - 1), at(i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = p[2] === 2 ? 0.5 : 1;
    return [((b[0] - a[0]) / l) * k, ((b[1] - a[1]) / l) * k];
  };
  const out: Seg[] = [];
  for (let i = 0; i < (ferme ? n : n - 1); i++) {
    const [p, q] = [at(i), at(i + 1)];
    const c = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3;
    const [u, v] = [tangente(i), tangente(i + 1)];
    out.push([p[0], p[1], p[0] + u[0] * c, p[1] + u[1] * c, q[0] - v[0] * c, q[1] - v[1] * c, q[0], q[1]]);
  }
  return out;
}

function lisse(pts: readonly P[], ferme = true): string {
  const s = segments(pts, ferme);
  return `M${f(s[0][0])} ${f(s[0][1])}${s.map((g) => `C${f(g[2])} ${f(g[3])} ${f(g[4])} ${f(g[5])} ${f(g[6])} ${f(g[7])}`).join("")}${ferme ? "Z" : ""}`;
}

/** Un échantillon du tracé : la position, la normale (à gauche de la marche : le dehors d'un tracé horaire), l'abscisse. */
type Ech = [number, number, number, number, number];

/** Le tracé lissé, échantillonné au pas donné (les normales prises sur les voisins : les angles s'arrondissent à peine). */
function echantillons(pts: readonly P[], pas: number, ferme = true): Ech[] {
  const fin: [number, number][] = [];
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segments(pts, ferme))
    for (let k = fin.length ? 1 : 0; k <= 24; k++) {
      const t = k / 24;
      const u = 1 - t;
      fin.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    }
  const cum = [0];
  for (let i = 1; i < fin.length; i++) cum.push(cum[i - 1] + Math.hypot(fin[i][0] - fin[i - 1][0], fin[i][1] - fin[i - 1][1]));
  const L = cum[cum.length - 1];
  const n = Math.max(2, Math.round(L / pas));
  const pos: [number, number, number][] = [];
  let j = 0;
  for (let k = 0; k < (ferme ? n : n + 1); k++) {
    const s = (k / n) * L;
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    pos.push([fin[j][0] + (fin[j + 1][0] - fin[j][0]) * t, fin[j][1] + (fin[j + 1][1] - fin[j][1]) * t, s]);
  }
  const m = pos.length;
  return pos.map(([x, y, s], i) => {
    const a = pos[ferme ? (i - 1 + m) % m : Math.max(0, i - 1)];
    const b = pos[ferme ? (i + 1) % m : Math.min(m - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [x, y, (b[1] - a[1]) / l, -(b[0] - a[0]) / l, s];
  });
}

/** Une onde lente, tirée de la graine : sur un tracé fermé, elle se referme sur elle-même. */
function onde(L: number, rnd: Rnd, ferme: boolean, parts: [number, number][]): (s: number) => number {
  const o = parts.map(([l, a]) => ({ k: ferme ? Math.max(1, Math.round(L / l)) : L / l, a, p: rnd() * Math.PI * 2 }));
  return (s) => o.reduce((acc, { k, a, p }) => acc + a * Math.sin((2 * Math.PI * k * s) / L + p), 0);
}

/** Un coup de pinceau : la forme tremblée (pour remplir, couper) et le ruban du trait, d'épaisseur variable. */
interface Coup {
  forme: string;
  ruban: string;
  ech: Ech[];
  dep: number[];
}

/**
 * Le pinceau : le tracé tremble le long de sa normale (une onde lente, la
 * main), le trait s'épaissit et s'amincit (la charge du pinceau), et, ouvert,
 * s'effile aux deux bouts. Stable pour une même graine.
 */
function pinceau(pts: readonly P[], rnd: Rnd, o: { ferme?: boolean; amp?: number; w: [number, number]; pas?: number }): Coup {
  const ferme = o.ferme ?? true;
  const ech = echantillons(pts, o.pas ?? 5, ferme);
  const L = ech[ech.length - 1][4] + (ferme ? o.pas ?? 5 : 0);
  const amp = o.amp ?? 2.6;
  const tremble = onde(L, rnd, ferme, [[150, amp * 0.6], [52, amp * 0.42], [21, amp * 0.18]]);
  const charge = onde(L, rnd, ferme, [[190, 1], [70, 0.45]]);
  const [w0, w1] = o.w;
  const dep = ech.map((e) => tremble(e[4]));
  const larg = ech.map((e) => {
    const c = Math.max(0, Math.min(1, 0.5 + charge(e[4]) * 0.36));
    let w = w0 + (w1 - w0) * c;
    if (!ferme) w *= Math.min(1, Math.pow(Math.min(e[4], L - e[4]) / 16, 0.7)) * 0.85 + 0.15;
    return w / 2;
  });
  const g: string[] = [];
  const d: string[] = [];
  const c: string[] = [];
  ech.forEach(([x, y, nx, ny], i) => {
    g.push(`${f(x + nx * (dep[i] + larg[i]))} ${f(y + ny * (dep[i] + larg[i]))}`);
    d.push(`${f(x + nx * (dep[i] - larg[i]))} ${f(y + ny * (dep[i] - larg[i]))}`);
    c.push(`${f(x + nx * dep[i])} ${f(y + ny * dep[i])}`);
  });
  const forme = `M${c.join("L")}${ferme ? "Z" : ""}`;
  const ruban = ferme ? `M${g.join("L")}ZM${d.reverse().join("L")}Z` : `M${g.join("L")}L${d.reverse().join("L")}Z`;
  return { forme, ruban, ech, dep };
}

/** Un point posé au pinceau : un petit disque un peu inégal. */
function point(x: number, y: number, r: number, rnd: Rnd): string {
  const rx = r * (0.84 + rnd() * 0.32);
  const ry = r * (0.84 + rnd() * 0.32);
  return `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0`;
}

/** Un trait court au pinceau, d'un bout à l'autre, le milieu qui s'écarte. */
function trait(x1: number, y1: number, x2: number, y2: number, rnd: Rnd, amp: number): string {
  const j = () => (rnd() - 0.5) * amp;
  return `M${f(x1 + j())} ${f(y1 + j())}Q${f((x1 + x2) / 2 + j() * 1.6)} ${f((y1 + y2) / 2 + j() * 1.6)} ${f(x2 + j())} ${f(y2 + j())}`;
}

/** Des hachures d'angle a (degrés), au pas p, sur un rectangle, reprises au pinceau (une ligne en un, deux ou trois coups), en trois épaisseurs. */
function hachures(x0: number, y0: number, x1: number, y1: number, a: number, p: number, rnd: Rnd): [string, string, string] {
  const t = (a * Math.PI) / 180;
  const [ux, uy] = [Math.cos(t), Math.sin(t)];
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const R = Math.hypot(x1 - x0, y1 - y0) / 2;
  const out: [string, string, string] = ["", "", ""];
  for (let k = -R; k <= R; k += p * (0.88 + rnd() * 0.24)) {
    const [mx, my] = [cx - uy * k, cy + ux * k];
    let s = -R;
    while (s < R) {
      const l = 50 + rnd() * 140;
      const e = Math.min(R, s + l);
      out[Math.floor(rnd() * 3)] += trait(mx + ux * s, my + uy * s, mx + ux * e, my + uy * e, rnd, 3.4);
      s = e + 3 + rnd() * 5;
    }
  }
  return out;
}

// Le repère : les points sont posés le sol à y 556, le garrot à y 57 (500 de haut), puis ramenés
// par DECALE dans la boîte 776 × 512 qui serre l'éléphant (de la pointe de la défense à la queue).
const SOL = 556;
const DECALE = "translate(-146 -48)";
const BOITE = { w: 776, h: 512 } as const;

// Le corps, du dôme du crâne, dans le sens des aiguilles d'une montre : la nuque, le garrot,
// le dos en selle, la hanche, la croupe, la cuisse, la jambe arrière proche (le genou, le pied),
// le ventre, la jambe avant proche (le coude, le pied), la gorge, la lèvre ; puis la trompe
// (tirée de son axe, plus bas) et le front.
const PTS_TETE_DOS: P[] = [
  [348, 82], [376, 96], [398, 116], [428, 116], [458, 98], [482, 72], [504, 58], [540, 60], [585, 70], [630, 77], [675, 73], [718, 66], [756, 64],
  [796, 73], [830, 93], [856, 122], [874, 156], [885, 192], [888, 228], [884, 264], [873, 296], [858, 322],
  // la jambe arrière proche, sous la hanche : le bord arrière, le talon, la sole, l'ongle, le genou, le pli du grasset
  [836, 360], [812, 398], [792, 432], [776, 462], [766, 492], [762, 520, 2], [767, 540], [760, 556, 1], [662, 556, 1],
  [652, 549], [648, 535], [653, 518], [661, 494], [667, 468], [668, 444], [662, 418, 2], [668, 392], [684, 366], [706, 344, 2],
  // le ventre
  [680, 330], [640, 323], [596, 320], [552, 320], [512, 324], [484, 332, 2],
  // la jambe avant proche, portée en avant : le coude, le poignet, le pied rond
  [474, 356], [466, 392], [457, 430], [448, 466], [440, 496], [438, 518], [443, 538], [446, 550], [438, 556, 1], [338, 556, 1],
  [327, 550], [322, 537], [326, 520], [334, 496], [343, 466], [352, 432], [361, 398], [370, 366], [378, 342],
  // la gorge, le menton, la lèvre
  [374, 322], [364, 310], [352, 304], [338, 302], [328, 296],
];

/** L'axe de la trompe, de sa racine (dans la face) au bout recourbé : [x, y, demi-largeur]. */
const AXE_TROMPE: [number, number, number][] = [
  [300, 236, 42], [292, 282, 37.5], [284, 326, 32.5], [277, 370, 27.5], [271, 410, 23.5], [267, 442, 20.5], [263, 466, 18.5],
  [256, 486, 17], [244, 501, 15.5], [228, 507, 14.5], [213, 503, 13.5], [203, 491, 13], [201, 477, 12.5],
];

/** Le front, du bord avant de la trompe au dôme. */
const PTS_FRONT: P[] = [[262, 196], [272, 160], [287, 128], [308, 104], [328, 89]];

/** La trompe : ses deux bords tirés de l'axe ; le bout, un crochet arrondi. */
function trompe(): { arriere: P[]; avant: P[]; bout: P[] } {
  const nrm = AXE_TROMPE.map((_, i) => {
    const a = AXE_TROMPE[Math.max(0, i - 1)];
    const b = AXE_TROMPE[Math.min(AXE_TROMPE.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    // la normale à droite de la descente : le dos de la trompe (puis le dessous du crochet)
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l] as const;
  });
  const arriere: P[] = [];
  const avant: P[] = [];
  AXE_TROMPE.forEach(([x, y, w], i) => {
    const [nx, ny] = nrm[i];
    if (y > 292) arriere.push([x - nx * w, y - ny * w]);
    avant.push([x + nx * w, y + ny * w]);
  });
  const [tx, ty] = AXE_TROMPE[AXE_TROMPE.length - 1];
  const bout: P[] = [[tx - 13, ty + 4], [tx - 12, ty - 8], [tx - 2, ty - 15], [tx + 10, ty - 10]];
  return { arriere, avant: avant.reverse(), bout };
}

const T = trompe();
const PTS_CORPS: P[] = [...PTS_TETE_DOS, [322, 292], ...T.arriere, ...T.bout, ...T.avant.filter((p) => p[1] > 200), ...PTS_FRONT];

// L'oreille : la racine derrière l'œil, le bord haut au-dessus du cou, le bord arrière qui ondule,
// le lobe qui pend sous la mâchoire, devant la jambe.
const PTS_OREILLE: P[] = [
  [384, 130], [400, 104], [434, 76], [478, 63], [524, 63], [562, 76], [587, 100], [598, 132], [597, 166], [589, 194], [594, 226],
  [589, 260], [576, 292], [556, 322], [528, 350], [494, 372], [458, 390], [422, 402], [390, 412], [362, 422], [342, 432, 2],
  [337, 418], [342, 392], [350, 364], [360, 334], [368, 296], [373, 252], [376, 206], [378, 164],
];
/** Les jambes du côté loin : l'avant d'aplomb, l'arrière rejeté en arrière. */
const PTS_AV_LOIN: P[] = [
  [496, 330, 1], [568, 330, 1], [571, 380], [574, 430], [577, 480], [580, 515], [584, 538, 2], [589, 550], [582, 556, 1], [500, 556, 1],
  [491, 550], [487, 536], [491, 518], [494, 480], [495, 430], [496, 380],
];
const PTS_AR_LOIN: P[] = [
  [762, 344, 1], [846, 330], [862, 366], [874, 410], [885, 460], [894, 500], [901, 530, 2], [906, 546], [900, 556, 1], [818, 556, 1],
  [808, 549], [804, 535], [807, 518], [803, 480], [796, 440], [786, 400], [774, 368],
];
/** La défense : du fourreau de la lèvre, en avant puis vers le haut. */
const AXE_DEFENSE: [number, number, number][] = [[324, 268, 13], [298, 290, 12.5], [264, 304, 11], [228, 308, 9.5], [196, 302, 7.5], [171, 289, 5], [154, 274, 1.5]];
/** Le pourtour de la défense, tiré de son axe. */
const PTS_DEFENSE: P[] = (() => {
  const bord = (s: 1 | -1) =>
    AXE_DEFENSE.map(([x, y, w], i, a) => {
      const [b, c] = [a[Math.min(a.length - 1, i + 1)], a[Math.max(0, i - 1)]];
      const l = Math.hypot(b[0] - c[0], b[1] - c[1]) || 1;
      return [x - s * ((b[1] - c[1]) / l) * w, y + s * ((b[0] - c[0]) / l) * w] as const;
    });
  return [...bord(1), ...bord(-1).reverse()];
})();
/** La queue : sa racine sous la croupe, son pinceau de crins. */
const PTS_QUEUE: P[] = [[866, 144], [884, 178], [898, 232], [904, 290], [906, 346], [912, 352], [911, 296], [906, 230], [893, 172], [876, 136]];
const CRINS: [number, number, number, number][] = [[904, 344, 896, 398], [908, 346, 906, 404], [911, 344, 916, 398], [906, 345, 901, 404]];
/** L'œil (en amande), sa paupière ; la lèvre ; les plis du coude, du grasset, de la hanche ; le fourreau de la défense. */
const OEIL = "M291 176C298 168 312 167 320 173C312 180 298 182 291 176Z";
const PLIS: P[][] = [
  [[284, 166], [296, 158], [312, 157], [324, 163]],
  [[738, 142], [722, 196], [712, 250], [711, 300], [706, 344]],
  [[470, 330], [486, 316], [508, 312]],
  [[324, 296], [336, 288], [346, 292]],
  [[312, 262], [322, 278], [326, 294]],
];
/** Les zones peintes de leur géométrie (coupées au corps) : la tête, les jambes, la cuisse. */
const ZONE_TETE = lisse([[230, 60], [372, 70], [384, 330], [330, 310], [312, 290], [236, 290]]);
/** Le flanc : le corps derrière la racine de l'oreille, au-dessus des jambes. */
const ZONE_FLANC = "M376 30L760 30L760 352L376 352Z";
const ZONE_JAMBES = "M310 344L486 334L486 600L310 600ZM640 334C680 334 704 344 716 352L800 360L800 600L640 600Z";
const ZONE_CUISSE = lisse([[744, 60], [900, 60], [900, 330], [706, 344], [711, 300], [712, 250], [722, 196], [738, 142]]);

/* ------------------------------ La peinture ------------------------------ */

const deja = new Map<number, ReturnType<typeof peindre>>();

function peindre(graine: number) {
  const rnd = alea(graine ^ 0x656c65);
  const corps = pinceau(PTS_CORPS, rnd, { w: [5, 8], amp: 2.8 });
  const oreille = pinceau(PTS_OREILLE, rnd, { w: [5, 7.5], amp: 2.6 });
  const avLoin = pinceau(PTS_AV_LOIN, rnd, { w: [4.5, 6.5], amp: 2.2 });
  const arLoin = pinceau(PTS_AR_LOIN, rnd, { w: [4.5, 6.5], amp: 2.2 });
  const queue = pinceau(PTS_QUEUE, rnd, { w: [3, 4.5], amp: 1.2, pas: 4 });
  const defense = pinceau(PTS_DEFENSE, rnd, { w: [3.6, 5.4], amp: 1, pas: 4 });
  const plis = PLIS.map((p) => pinceau(p, rnd, { ferme: false, w: [2.6, 4.2], amp: 1.6, pas: 4 }).ruban).join("");
  // Les nervures de l'oreille : de la racine (le bord avant) vers le bord, en éventail, une fourche à mi-chemin.
  const veines: [number, number, number, number][] = [
    [392, 140, 470, 84], [394, 170, 548, 92], [396, 202, 584, 156], [396, 236, 588, 228], [394, 270, 568, 300], [390, 302, 514, 360], [384, 330, 446, 392], [376, 356, 388, 406],
  ];
  let nervures = "";
  let pointsOreille = "";
  veines.forEach(([ax, ay, bx, by], i) => {
    const [mx, my] = [ax + (bx - ax) * 0.48 + (by - ay) * 0.06, ay + (by - ay) * 0.48 - (bx - ax) * 0.06];
    const [ex, ey] = [ax + (bx - ax) * 0.88, ay + (by - ay) * 0.88];
    nervures += pinceau([[ax, ay], [mx, my], [ex, ey]], rnd, { ferme: false, w: [2.4, 4], amp: 1.6, pas: 4 }).ruban;
    // la fourche
    const [fx, fy] = [mx + (bx - mx) * 0.72 + (by - my) * 0.2, my + (by - my) * 0.72 - (bx - mx) * 0.2];
    nervures += pinceau([[mx, my], [mx + (fx - mx) * 0.5 + 2, my + (fy - my) * 0.5], [fx, fy]], rnd, { ferme: false, w: [1.8, 3], amp: 1.2, pas: 4 }).ruban;
    // des points entre les nervures
    if (i < veines.length - 1) {
      const [cx1, cy1, cx2, cy2] = veines[i + 1];
      for (let t = 0.3; t < 0.84; t += 0.13) {
        const [ux, uy] = [(ax + cx1) / 2, (ay + cy1) / 2];
        const [vx, vy] = [(bx + cx2) / 2, (by + cy2) / 2];
        pointsOreille += point(ux + (vx - ux) * t + (rnd() - 0.5) * 3, uy + (vy - uy) * t + (rnd() - 0.5) * 3, 2.2 + t * 1.8, rnd);
      }
    }
  });
  // Les hachures : le flanc d'un sens, la cuisse de l'autre ; les anneaux des jambes ; les rangs de points de la tête.
  const flanc = hachures(360, 40, 760, 360, -52, 12, rnd);
  const cuisse = hachures(700, 40, 910, 360, 38, 12, rnd);
  let anneaux = "";
  for (const [x0, x1, y0] of [[316, 480, 360], [646, 800, 366]] as [number, number, number][])
    for (let y = y0, i = 0; y < 532; y += 15 + rnd() * 3, i++) anneaux += trait(x0, y + (i % 2) * 2, x1, y + 4 + rnd() * 2, rnd, 3.2);
  let trompeAnneaux = "";
  for (let i = 1; i < AXE_TROMPE.length - 2; i++) {
    const [x, y, w] = AXE_TROMPE[i];
    const [xn, yn] = AXE_TROMPE[i + 1];
    for (let t = 0; t < 1; t += 0.34) {
      const [cx2, cy2, ww] = [x + (xn - x) * t, y + (yn - y) * t, w * 0.96];
      trompeAnneaux += `M${f(cx2 - ww)} ${f(cy2 + (rnd() - 0.5) * 2)}Q${f(cx2 + (rnd() - 0.5) * 3)} ${f(cy2 + 8)} ${f(cx2 + ww)} ${f(cy2 + 1 + (rnd() - 0.5) * 2)}`;
    }
  }
  let tete = "";
  for (let y = 108, i = 0; y < 296; y += 14, i++)
    for (let x = 236 + (i % 2) * 7; x < 372; x += 14) tete += point(x + (rnd() - 0.5) * 2.4, y + (rnd() - 0.5) * 2.4, 2.3, rnd);
  let loin = "";
  for (const [x0, x1, k] of [[502, 570, 0.05], [822, 886, 0.2]] as [number, number, number][])
    for (let y = 372, i = 0; y < 532; y += 17, i++) loin += point((x0 + x1) / 2 + (i % 2 ? 10 : -10) + (rnd() - 0.5) * 3 + (y - 372) * k, y, 3, rnd);
  // Le contour doublé : un rang de points le long du bord, en dedans.
  let bordCorps = "";
  corps.ech.forEach(([x, y, nx, ny], i) => {
    if (i % 3) return;
    bordCorps += point(x + nx * (corps.dep[i] - 12), y + ny * (corps.dep[i] - 12), 2.1, rnd);
  });
  let bordOreille = "";
  oreille.ech.forEach(([x, y, nx, ny], i) => {
    if (i % 3) return;
    bordOreille += point(x + nx * (oreille.dep[i] - 13), y + ny * (oreille.dep[i] - 13), 2.4, rnd);
  });
  // Les pieds : la sole pleine, les ongles réservés (trois devant, sur l'arrondi).
  let soles = "";
  let ongles = "";
  for (const [a, b] of [[322, 446], [648, 768], [487, 589], [804, 906]] as [number, number][]) {
    soles += `M${a + 4} ${SOL - 9}Q${(a + b) / 2} ${SOL - 12 + rnd() * 2} ${b - 3} ${SOL - 9}L${b - 6} ${SOL}L${a + 8} ${SOL}Z`;
    for (let k = 0; k < 3; k++) {
      const x = a + 8 + k * 17;
      ongles += `M${f(x)} ${SOL - 13}Q${f(x + 7)} ${SOL - 23} ${f(x + 14)} ${SOL - 13}Z`;
    }
  }
  return { corps, oreille, avLoin, arLoin, queue, defense, plis, nervures, pointsOreille, flanc, cuisse, anneaux, trompeAnneaux, tete, loin, bordCorps, bordOreille, soles, ongles };
}

function peinture(graine: number) {
  let p = deja.get(graine);
  if (!p) {
    if (deja.size > 24) deja.clear();
    p = peindre(graine);
    deja.set(graine, p);
  }
  return p;
}

const COTON = "#ebe2cf";
const LAVIS = "#7a5b3e";
const LARGEURS = [2, 2.9, 3.8];

/** Le dos : l'éléphant peint, en entier. */
function Peint({ tons, graine, id }: PropsTotem) {
  const p = peinture(graine);
  const boue = `rgb(${tons.encre})`;
  return (
    <g transform={DECALE} strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <clipPath id={`ec${id}`}>
          <path d={p.corps.forme} />
        </clipPath>
        <clipPath id={`eo${id}`}>
          <path d={p.oreille.forme} />
        </clipPath>
        <clipPath id={`ej${id}`}>
          <path d={ZONE_JAMBES} />
        </clipPath>
        <clipPath id={`eu${id}`}>
          <path d={ZONE_CUISSE} />
        </clipPath>
        <clipPath id={`eh${id}`}>
          <path d={ZONE_TETE} />
        </clipPath>
        <clipPath id={`ef${id}`}>
          <path d={ZONE_FLANC} />
        </clipPath>
      </defs>
      {/* Les jambes du côté loin : la boue pleine, des points réservés ; la queue devant elles. */}
      <path d={p.avLoin.forme + p.arLoin.forme} fill={COTON} />
      <path d={p.avLoin.forme + p.arLoin.forme} fill={boue} opacity={0.82} />
      <path d={p.loin} fill={COTON} opacity={0.9} />
      <path d={p.avLoin.ruban + p.arLoin.ruban} fill={boue} />
      <path d={p.queue.forme} fill={COTON} />
      <path d={p.queue.ruban} fill={boue} />
      {CRINS.map(([x0, y0, x1, y1], i) => (
        <path key={i} d={`M${x0} ${y0}Q${(x0 + x1) / 2 + (i % 2 ? 3 : -3)} ${(y0 + y1) / 2} ${x1} ${y1}`} stroke={boue} strokeWidth={3.2 - i * 0.3} fill="none" />
      ))}
      {/* Le corps : le coton, puis chaque zone peinte de sa géométrie. */}
      <path d={p.corps.forme} fill={COTON} />
      <g clipPath={`url(#ec${id})`} fill="none">
        <path d={p.corps.forme} fill={LAVIS} opacity={0.09} />
        <g clipPath={`url(#ef${id})`}>
          {p.flanc.map((d, i) => (
            <path key={i} d={d} stroke={boue} strokeWidth={LARGEURS[i]} opacity={0.78} />
          ))}
        </g>
        <g clipPath={`url(#eu${id})`}>
          <rect x={690} y={40} width={230} height={330} fill={COTON} />
          <path d={ZONE_CUISSE} fill={LAVIS} opacity={0.09} />
          {p.cuisse.map((d, i) => (
            <path key={i} d={d} stroke={boue} strokeWidth={LARGEURS[i]} opacity={0.78} />
          ))}
        </g>
        <g clipPath={`url(#ej${id})`}>
          <rect x={320} y={322} width={490} height={250} fill={COTON} />
          <path d={p.anneaux} stroke={boue} strokeWidth={2.8} opacity={0.82} />
        </g>
        <g clipPath={`url(#eh${id})`}>
          <rect x={200} y={50} width={190} height={290} fill={COTON} />
          <path d={p.tete} fill={boue} opacity={0.8} />
        </g>
        <path d={p.trompeAnneaux} stroke={boue} strokeWidth={2.6} opacity={0.85} />
        {/* Le contour doublé : une bande de coton nu sous le trait, un rang de points. */}
        <path d={p.corps.forme} stroke={COTON} strokeWidth={28} />
        <path d={p.bordCorps} fill={boue} />
        <path d={p.soles} fill={boue} />
        <path d={p.ongles} fill={COTON} />
      </g>
      <path d={p.plis} fill={boue} />
      <path d={p.corps.ruban} fill={boue} />
      {/* L'oreille : ses nervures, ses points, son bord doublé, son trait. */}
      <path d={p.oreille.forme} fill={COTON} />
      <g clipPath={`url(#eo${id})`}>
        <path d={p.oreille.forme} fill={LAVIS} opacity={0.12} />
        <path d={p.nervures} fill={boue} opacity={0.88} />
        <path d={p.pointsOreille} fill={boue} opacity={0.8} />
        <path d={p.oreille.forme} fill="none" stroke={COTON} strokeWidth={30} />
        <path d={p.bordOreille} fill={boue} />
      </g>
      <path d={p.oreille.ruban} fill={boue} />
      {/* La défense, le coton nu ; l'œil. */}
      <path d={p.defense.forme} fill={COTON} />
      <path d={p.defense.ruban} fill={boue} />
      <path d={OEIL} fill={boue} />
    </g>
  );
}

/**
 * La face : le gaufrage, un relief sans encre. La silhouette entière (son
 * pourtour seul, les jambes du côté loin comprises) relevée : la lumière sur
 * le bord haut gauche, l'ombre portée sur le bord bas droit, un voile à peine
 * dedans ; l'oreille, la défense et l'œil marqués en creux. Sur la photo,
 * l'ombre et la lumière sont plus franches.
 */
const FORME = lisse(PTS_AV_LOIN) + lisse(PTS_AR_LOIN) + lisse(PTS_CORPS) + lisse(PTS_QUEUE);
const CREUX = lisse(PTS_OREILLE) + lisse(PTS_DEFENSE) + PLIS.map((p) => lisse(p, false)).join("");

function Gaufre({ photo, tons, id }: PropsTotem) {
  const ombre = photo ? "rgba(16,11,8,0.6)" : `rgba(${tons.encre},0.34)`;
  const lumiere = photo ? "rgba(255,250,240,0.7)" : "rgba(255,253,248,1)";
  return (
    <g transform={DECALE} fill="none" strokeLinejoin="round" strokeLinecap="round">
      <defs>
        {/* Le dehors de la silhouette : l'ombre et la lumière n'y débordent que sur son pourtour. */}
        <mask id={`eg${id}`} maskUnits="userSpaceOnUse" x={100} y={20} width={840} height={560}>
          <rect x={100} y={20} width={840} height={560} fill="#fff" />
          <path d={FORME} fill="#000" />
        </mask>
      </defs>
      <path d={FORME} fill={photo ? "rgba(255,250,240,0.12)" : `rgba(${tons.encre},0.05)`} />
      <g mask={`url(#eg${id})`}>
        <path d={FORME} stroke={ombre} strokeWidth={10} transform="translate(3 4)" />
        <path d={FORME} stroke={lumiere} strokeWidth={10} transform="translate(-3 -4)" />
      </g>
      <path d={CREUX} stroke={ombre} strokeWidth={4} transform="translate(-1.5 -2)" />
      <path d={CREUX} stroke={lumiere} strokeWidth={4} transform="translate(1.5 2)" />
      <path d={OEIL} fill={ombre} />
    </g>
  );
}

const totem: TotemNation = {
  nation: "ci",
  animal: "éléphant",
  quoi: "L'éléphant de savane, de profil, qui marche, l'oreille d'Afrique au-dessus du cou : peint à la boue sur le coton comme une toile de Korhogo, d'un pinceau qui tremble, le trait doublé de points, hachures, anneaux et nervures.",
  sources: [
    { titre: "San Diego Zoo, fiche de l'éléphant d'Afrique : garrot au plus haut, dos en selle, dôme unique, oreilles", url: "https://ielc.libguides.com/sdzg/factsheets/african_elephant/characteristics" },
    { titre: "Tsavo Trust, l'anatomie de l'éléphant d'Afrique", url: "https://tsavotrust.org/the-anatomy-of-the-african-elephant/" },
    { titre: "SANParks, éléphant d'Afrique et d'Asie : le dos creux, l'oreille, les deux doigts de la trompe", url: "https://www.sanparks.org/conservation/parks/kruger/letaba-elephant-hall/learn-more/african-vs-asian-elephants" },
    { titre: "Animal Anatomy for Artists (Oxford University Press) : le milieu du dos concave de l'éléphant d'Afrique", url: "https://academic.oup.com/book/41965/chapter/355234547" },
    { titre: "Pachyderm, les éléphants de Côte d'Ivoire (savane de la Comoé, forêt de Taï)", url: "https://pachydermjournal.org/index.php/pachyderm/article/view/1222" },
    { titre: "Baltimore Museum of Art, toile de Korhogo peinte : oiseaux, éléphant, quadrupède", url: "https://artbma.org/artwork/decorative-cloth-2/" },
    { titre: "Spencer Museum of Art, toile de Korhogo d'un artiste sénoufo non nommé", url: "https://spencerart.ku.edu/art/collections-online/object/38480" },
  ],
  dessine: true,
  boite: BOITE,
  pose: {
    // Au dos : centré, les pieds sur la bande peinte (SOL_CI) ; la lune au-dessus du dos.
    dos: { x: 512 - (BOITE.w * 0.95) / 2, y: SOL_CI.y - (SOL - 48) * 0.95, echelle: 0.95, devant: true, lune: LUNE_CI },
    // À la face : retourné vers la photo, dans le coin bas gauche du portrait, à droite de l'équerre (x 71 → 114).
    face: { portrait: { x: 124, y: 936 - (SOL - 48) * 0.3, echelle: 0.3, miroir: true } },
  },
  Dessin: (p) => {
    if (p.couche === "dos") return <Peint {...p} />;
    if (p.couche === "face-portrait") return <Gaufre {...p} />;
    return null;
  },
};

export default totem;
