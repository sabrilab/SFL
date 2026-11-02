// Le totem de l'Égypte (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// Le faucon pèlerin adulte, perché au bord d'un rebord de falaise, de profil,
// tourné vers la lune, un peu penché en avant, la tête levée : un faucon qu'on
// reconnaît au premier coup d'œil, à sa tête d'abord. Le casque sombre (le
// front, le crâne, la nuque, le côté du cou) d'où tombe, sous l'œil, la large
// moustache, arrondie au bout ; derrière elle, la joue blanche qui remonte
// jusque derrière l'œil ; la gorge blanche. Le grand œil noir, l'anneau de
// peau nue, et l'arcade du crâne qui en coupe le haut sans sortir du front :
// le regard du faucon. La cire, une bande claire au pied du bec, la narine
// haute contre l'arête ; le bec court et haut, d'acier sombre, le crochet
// noir et la dent. Puis le corps trapu, « large d'épaules » : le poitrail
// bombé, blanc en haut, moucheté, puis barré d'arcs qui font le tour du
// corps, plus fins et plus serrés vers le ventre ; la culotte barrée (les
// « flags » des fauconniers) qui tombe en franges sur le haut du tarse ; les
// sous-caudales blanches, finement barrées ; la queue ardoise, quatre barres
// claires et le bout blanc ; l'aile repliée, ardoise, en rangs de plumes
// (scapulaires, couvertures, tertiaires), et les longues rémiges sombres
// dont la pointe touche presque le bout de la queue ; le tarse court, les
// doigts longs à coussinets : les deux de devant passent par-dessus l'arête
// du rebord et la serrent, le pouce derrière, les serres noires.
// Les proportions viennent du vivant (tête H : crâne → doigts 4,5 H ; crâne →
// bout de queue 5,75 H ; poitrail → dos 2,3 H). On ne dessine que l'oiseau,
// sur son rocher : ni dieu, ni couronne, ni disque sur sa tête, ni trait
// prolongé de l'œil (ce serait l'œil d'Horus, un signe), ni socle : le
// rebord est un morceau de falaise, en surplomb sous les doigts, qui se perd
// vers le bas. L'aigle du Nigeria freine, celui du Mali plane : lui seul est
// posé.
//
// Il est fait comme le tulle bi telli d'Assiout (../egypte.tsx) : des
// lamelles d'argent nouées une à une sur le filet noir, chacune entière dans
// sa forme (jamais coupée), d'un point plus serré que le châle ; le dessin
// est ce qu'on laisse vide, et la valeur se règle par la densité. La brodeuse
// suit la forme : la tête et l'aile en rangs droits (le filet) ; le dessous
// en rangs qui font le tour du corps (des arcs, plus serrés au bord, comme un
// anneau vu de biais), jusqu'à la culotte, sous le feston des plumes du ventre
// qui la recouvrent ; la queue et les sous-caudales en rangs en travers de la
// queue. Les lamelles se penchent avec leur rang.
//   · le blanc (la joue, la gorge, le haut du poitrail) : plein, à peine
//     moucheté au-dessus de la première barre ;
//   · le dessous : plein, barré d'arcs vides (un pont de métal ici et là dans
//     les barres larges), qui s'affinent et se resserrent vers le ventre ;
//   · l'aile, l'ardoise : une lamelle sur trois ; le bout de chaque plume, son
//     liseré plein sous un feston de fil ; les rémiges, sombres : clairsemées,
//     le filet nu le long de chaque tige ;
//   · la queue : sombre (une lamelle sur cinq), barrée de rangs pleins, le
//     bout blanc ;
//   · le casque et la moustache, le noir : le filet nu, cerné ;
//   · le rocher : clairsemé, plein sur le dessus éclairé, vide sous le
//     surplomb, de plus en plus rare vers le bas, où son contour s'efface.
// Les petites pièces sont en métal plein, comme quand les lamelles serrées se
// touchent : la cire, claire ; le bec, acier plus sombre, le crochet noir ;
// le pied. Le contour de l'oiseau est un rang de lamelles posées bout à bout
// (pas un trait d'illustration) ; l'œil a son anneau et son éclat.
//   · au dos : le héros, grand, à gauche, sur son rocher, la tête levée vers
//     la lune (LUNE_EG) ; le skin écarte de lui, entiers, les losanges du
//     châle (distanceFauconEG) ;
//   · à la face : le même faucon en gaufrage dans le coin bas gauche du
//     portrait, le rocher qui s'efface sur la ligne de l'équerre, la queue à
//     droite de son bout.

import type { PropsTotem, TotemNation } from "../types";
import { alea, f } from "../outils";

/**
 * La lune, au-dessus du regard du faucon, en haut à droite (la rosace guillochée seule autour) :
 * l'anneau extérieur de la rosace (318 × d/300 + 26 = 153) reste à 25 du filet de la bordure
 * (x 926) et à plus de 40 du bec.
 */
export const LUNE_EG = { cx: 748, cy: 292, d: 120 } as const;
/** La pose du dos : le skin (../egypte.tsx) y écarte les losanges du châle. */
export const POSE_DOS_EG = { x: 36, y: 230, echelle: 1.2 } as const;

/* ------------------------------ Les tracés ------------------------------ */

type P = readonly [number, number] | readonly [number, number, number];
type Seg = [number, number, number, number, number, number, number, number];
type Pt = [number, number];

/** Des points posés à la main, liés en béziers tendus (un tiers de corde) ; 1 : un angle, 2 : un angle adouci. */
function segments(pts: readonly P[]): Seg[] {
  const n = pts.length;
  const at = (i: number) => pts[(i + n) % n];
  const tg = (i: number): Pt => {
    const p = at(i);
    if (p[2] === 1) return [0, 0];
    const [a, b] = [at(i - 1), at(i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = p[2] === 2 ? 0.5 : 1;
    return [((b[0] - a[0]) / l) * k, ((b[1] - a[1]) / l) * k];
  };
  return pts.map((p, i) => {
    const q = at(i + 1);
    const c = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3;
    const [u, v] = [tg(i), tg(i + 1)];
    return [p[0], p[1], p[0] + u[0] * c, p[1] + u[1] * c, q[0] - v[0] * c, q[1] - v[1] * c, q[0], q[1]];
  });
}

const lisse = (pts: readonly P[]) => {
  const s = segments(pts);
  return `M${f(s[0][0])} ${f(s[0][1])}${s.map((g) => `C${f(g[2])} ${f(g[3])} ${f(g[4])} ${f(g[5])} ${f(g[6])} ${f(g[7])}`).join("")}Z`;
};

/** Un trait ouvert, lissé (Catmull-Rom au tiers de corde). */
function trace(pts: readonly P[]): string {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b, c, e] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]];
    d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`;
  }
  return d;
}

/**
 * Une forme, pour savoir vite si un point est dedans : le tracé en polygone (un
 * point tous les 4 environ le long des courbes), ses côtés rangés par bandes
 * horizontales de 4 (un point ne regarde que les côtés de sa bande).
 */
class Forme {
  readonly pts: Pt[] = [];
  private readonly y0: number;
  private readonly bandes: number[][] = [];
  readonly x0: number;
  readonly x1: number;
  readonly y1: number;
  constructor(trac: readonly P[]) {
    for (const [a, b, c, d, e, g, h, k] of segments(trac)) {
      const n = Math.max(2, Math.ceil(Math.hypot(h - a, k - b) / 4));
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const u = 1 - t;
        this.pts.push([u * u * u * a + 3 * u * u * t * c + 3 * u * t * t * e + t * t * t * h, u * u * u * b + 3 * u * u * t * d + 3 * u * t * t * g + t * t * t * k]);
      }
    }
    const xs = this.pts.map((p) => p[0]);
    const ys = this.pts.map((p) => p[1]);
    [this.x0, this.x1, this.y0, this.y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (let i = 0, j = this.pts.length - 1; i < this.pts.length; j = i++) {
      const [ya, yb] = [this.pts[i][1], this.pts[j][1]];
      for (let b = Math.floor((Math.min(ya, yb) - this.y0) / 4); b <= Math.floor((Math.max(ya, yb) - this.y0) / 4); b++) (this.bandes[b] ??= []).push(i);
    }
  }
  /** Les abscisses où la ligne horizontale y coupe le contour, triées. */
  coupe(y: number): number[] {
    const out: number[] = [];
    const n = this.pts.length;
    for (const i of this.bandes[Math.floor((y - this.y0) / 4)] ?? []) {
      const a = this.pts[i];
      const e = this.pts[(i + n - 1) % n];
      if (a[1] > y !== e[1] > y) out.push(((e[0] - a[0]) * (y - a[1])) / (e[1] - a[1]) + a[0]);
    }
    return out.sort((p, q) => p - q);
  }
  dans(x: number, y: number): boolean {
    if (x < this.x0 || x > this.x1 || y < this.y0 || y > this.y1) return false;
    const bande = this.bandes[Math.floor((y - this.y0) / 4)];
    if (!bande) return false;
    const n = this.pts.length;
    let c = false;
    for (const i of bande) {
      const a = this.pts[i];
      const e = this.pts[(i + n - 1) % n];
      if (a[1] > y !== e[1] > y && x < ((e[0] - a[0]) * (y - a[1])) / (e[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
}

/** La fraction d'un nombre, toujours positive. */
const fr = (v: number) => v - Math.floor(v);

/*
 * Les points ont été posés l'oiseau droit (tête H 120), puis pliés une fois
 * pour toutes : le corps penché de 7° en avant autour des pieds, la tête levée
 * de 16° autour du cou (vers la lune). Les pattes et le rocher restent d'aplomb.
 */

// L'oiseau, d'un seul contour : le crochet, l'arête du bec, la cire, le front, le crâne, la nuque ; le dos, le
// manteau, le bord de l'aile jusqu'à la pointe des rémiges ; la queue et son bout arrondi ; les sous-caudales ;
// les franges de la culotte, la culotte, le ventre, le poitrail bombé, la gorge ; la mandibule, la dent.
const OISEAU: P[] = [
  [469, 167, 1], [469, 152], [462, 138], [453, 128], [440, 120], [428, 114], [416, 109], [407, 102], [393, 92], [375, 82],
  [354, 76], [330, 75], [306, 82], [286, 95], [274, 113], [269, 135], [267, 158], [260, 185], [244, 218], [219, 252],
  [194, 311], [175, 379], [159, 448], [144, 516], [128, 585], [114, 654], [104, 701, 1],
  [99, 719], [97, 737, 2], [104, 751, 2], [120, 757, 2], [133, 748],
  [145, 720], [164, 687], [189, 653], [216, 626], [242, 607], [266, 597], [290, 589, 2],
  [302, 587], [312, 591, 2], [320, 585], [329, 592, 2], [337, 586], [346, 592, 2], [354, 586], [363, 591, 2], [369, 583],
  [373, 572], [376, 555], [380, 539], [394, 503], [414, 451], [433, 393], [449, 334], [459, 294], [464, 249],
  [458, 214], [448, 193], [440, 183], [443, 178], [451, 176], [455, 170], [457, 164, 1], [460, 160], [464, 163],
];
/** La cire : une bande claire et étroite au pied du bec ; la narine, haute, contre l'arête. */
const CIRE: P[] = [[414, 105], [421, 109], [428, 114], [432, 127], [431, 140], [428, 150], [424, 153], [421, 142], [418, 127], [415, 114]];
const NARINE = { cx: 424, cy: 116, r: 2.3 };
const BEC: P[] = [
  [428, 114], [440, 120], [453, 128], [462, 138], [469, 152], [469, 167, 1], [464, 163], [460, 160], [457, 164, 1], [450, 160],
  [439, 157], [428, 153], [431, 140], [432, 127],
];
/** Le bout du crochet, plus sombre. */
const CROCHET: P[] = [[462, 138], [469, 152], [469, 167, 1], [464, 163], [460, 160], [457, 164, 1], [458, 150]];
const COMMISSURE: P[] = [[457, 164], [449, 160], [438, 157], [426, 154]];
/** La limite de la cire et du bec. */
const BORD_CIRE: P[] = [[428, 114], [432, 127], [431, 140], [428, 152]];
const OEIL = { cx: 389.3, cy: 118.5, r: 20 };
/** L'arcade : le rebord du crâne au-dessus de l'œil, qui en coupe le haut ; elle s'arrête au front, sans visière. */
const ARCADE: P[] = [[358, 116], [366, 100], [387, 90], [402, 93], [407, 101, 1], [394, 109], [372, 117]];
const BORD_ARCADE: P[] = [[360, 116], [374, 116], [394, 109], [406, 102]];
/** Le casque : le front, le crâne, la nuque, le côté du cou ; la joue blanche remonte derrière l'œil ; la moustache, arrondie au bout. */
const CAPUCHON: P[] = [
  [407, 102], [393, 92], [375, 82], [354, 76], [330, 75], [306, 82], [286, 95], [274, 113], [269, 135], [267, 158], [260, 185],
  [278, 192], [293, 186], [298, 167], [307, 149], [325, 137], [345, 136], [363, 145], [373, 168], [384, 194], [394, 215],
  [402, 228], [412, 235], [422, 230], [428, 212], [431, 190], [431, 168], [428, 154], [424, 153], [421, 142], [418, 127],
  [415, 114], [414, 105],
];
/** Le manteau, les scapulaires et l'aile repliée (l'ardoise) : du cou, l'épaule, le poignet, le bord bas, la pointe. */
const AILE: P[] = [
  [260, 185], [278, 192], [293, 186], [311, 198], [330, 215], [345, 237], [348, 267], [340, 299], [324, 347], [302, 400],
  [275, 457], [245, 514], [211, 575], [175, 629], [139, 675], [104, 701, 1], [114, 654], [128, 585], [144, 516], [159, 448],
  [175, 379], [194, 311], [219, 252], [244, 218],
];
/** Les rémiges primaires, sous les tertiaires, jusqu'à la pointe. */
const PRIMAIRES: P[] = [[235, 536], [211, 575], [175, 629], [139, 675], [104, 701, 1], [114, 654], [128, 585], [140, 532], [178, 537]];
/** Les bouts des rangs de plumes : couvertures, grandes couvertures, tertiaires. */
const RANGS: P[][] = [
  [[337, 310], [306, 321], [271, 320], [237, 308], [207, 288]],
  [[318, 368], [284, 384], [247, 386], [213, 372], [187, 350]],
  [[290, 430], [255, 451], [217, 455], [184, 439], [169, 419]],
  [[257, 495], [223, 518], [186, 522], [160, 506], [151, 487]],
];
/** La culotte : du ventre (l'arc du haut) aux franges qui tombent sur le tarse. */
const CULOTTE: P[] = [
  [381, 534], [358, 537], [334, 544], [312, 555], [298, 568], [292, 582], [293, 589, 2],
  [302, 587], [312, 591, 2], [320, 585], [329, 592, 2], [337, 586], [346, 592, 2], [354, 586], [363, 591, 2], [369, 583],
  [373, 572], [376, 555],
];
/**
 * Sous l'aile, en travers de la queue : les sous-caudales (du flanc, le long du
 * bord de l'aile) puis la queue, jusqu'à son bout.
 */
const SOUS_QUEUE: P[] = [
  [292, 588, 1], [268, 574], [246, 561], [224, 552, 1], [211, 575], [175, 629], [139, 675], [104, 701, 1],
  [99, 719], [97, 737, 2], [104, 751, 2], [120, 757, 2], [133, 748],
  [145, 720], [164, 687], [189, 653], [216, 626], [242, 607], [266, 597],
];

// La patte (d'aplomb) : le tarse court sous la culotte ; deux doigts devant, longs, à coussinets, qui passent
// par-dessus l'arête du rebord et la serrent (le plus loin sur le dessus, jusqu'au bord ; le plus proche sur
// l'arête de devant), le pouce derrière ; les serres noires, longues et courbes. L'autre patte est derrière.
const TARSE: P[] = [[338, 570], [352, 570], [354, 586], [357, 601, 2], [348, 605], [340, 604, 2], [336, 588]];
/** Le doigt du fond, sur le dessus du rebord jusqu'au bord : trois phalanges (les nœuds dessus, les coussinets dessous). */
const DOIGT_LOIN: P[] = [
  [351, 600.5], [362, 600], [371, 601.2], [380, 600.8], [389, 601.8], [397, 603], [404, 605.5], [408.5, 609.5, 2],
  [406, 612], [400, 610.2], [394, 611.4], [387, 609.6], [380, 611.2], [372, 609.8], [364, 611.6], [356, 611], [351, 609.5],
];
/** Le doigt de devant, sur l'arête avant du rebord, qu'il serre. */
const DOIGT_PRES: P[] = [
  [350, 606.5], [360, 608.6], [369, 611.8], [377, 614.6], [384, 618], [390.5, 622.5, 2], [388.5, 627.5], [382, 624.8],
  [376, 624], [369, 621.2], [362, 620.4], [355, 617.4], [350, 615],
];
const POUCE: P[] = [[343, 603], [336, 602.6], [328, 603.6], [321, 606, 2], [320, 611], [327, 610.8], [335, 610], [343, 610.5]];
/** Les serres : celle du doigt du fond passe devant le bord du rebord et le serre dessous, celle de devant sur son arête, celle du pouce derrière. */
const SERRES: P[][] = [
  [[403, 602], [411, 605], [417, 613], [418, 624], [413, 635], [405, 642, 1], [409, 633], [411, 624], [408, 615], [404, 610]],
  [[388, 621], [395, 624], [398, 632], [395, 641], [388, 648, 1], [391, 639], [391, 632], [387, 628]],
  [[321, 606], [314, 607], [308, 612], [305, 620], [307, 629, 1], [309, 621], [313, 615.5], [319, 612]],
];

/**
 * Le rocher : le rebord d'une falaise, pas un socle. Une corniche qui vient de
 * la gauche (de derrière la queue, qui pend devant elle), son dessus monte vers
 * l'avant jusqu'à la proue où le faucon se tient, en surplomb sur le vide ;
 * sous la corniche, la falaise rentre, puis se perd dans le noir : vers le bas
 * et vers la gauche, le contour et les lamelles s'effacent.
 */
/** Le dessus de la corniche, de derrière la queue jusqu'à la proue. */
const DESSUS: P[] = [
  [130, 643, 1], [150, 642, 1], [176, 635, 1], [214, 631, 1], [236, 632, 1], [262, 625, 1], [300, 620, 1], [322, 621, 1],
  [346, 615, 1], [372, 613, 1], [398, 610, 1], [412, 612, 1],
];
const PIERRE: P[] = [
  ...DESSUS, [421, 618, 1], [417, 628, 1], [412, 633, 1], [398, 640, 1], [384, 642, 1], [378, 650, 1],
  [373, 668, 1], [376, 684, 1], [368, 702, 1], [366, 724, 1], [360, 740, 1], [130, 740, 1],
];
/** Ses arêtes : le bord avant du dessus (que serre le doigt de devant), des fentes, une strate de la falaise. */
const ARETES: P[][] = [
  [[130, 653, 1], [140, 652, 1], [176, 646, 1], [216, 642, 1], [256, 636, 1], [296, 631, 1], [336, 627, 1], [372, 625, 1], [398, 624, 1], [412, 633, 1]],
  [[262, 635, 1], [258, 648, 1], [264, 660, 1], [259, 674, 1]],
  [[322, 629, 1], [318, 643, 1], [323, 654, 1]],
  [[176, 646, 1], [172, 662, 1], [178, 676, 1]],
  [[120, 684, 1], [160, 681, 1], [214, 686, 1], [270, 680, 1], [330, 684, 1], [372, 690, 1]],
];
/** Sous la corniche, dans l'ombre : le surplomb, et la falaise qui rentre. */
const SURPLOMB: P[] = [[412, 633, 1], [398, 640, 1], [384, 642, 1], [378, 650, 1], [373, 668, 1], [362, 668, 1], [368, 649, 1], [382, 638, 1], [400, 634, 1]];

const F_OISEAU = new Forme(OISEAU);
const F_CAPUCHON = new Forme(CAPUCHON);
const F_ARCADE = new Forme(ARCADE);
const F_CIRE = new Forme(CIRE);
const F_BEC = new Forme(BEC);
const F_AILE = new Forme(AILE);
const F_PRIMAIRES = new Forme(PRIMAIRES);
const F_CULOTTE = new Forme(CULOTTE);
const F_SOUS_QUEUE = new Forme(SOUS_QUEUE);
const F_PIERRE = new Forme(PIERRE);
const F_SURPLOMB = new Forme(SURPLOMB);
const PATTES = [DOIGT_LOIN, TARSE, POUCE, DOIGT_PRES];
/** Dans l'ordre où on les pose : le doigt du fond et sa serre, le tarse, le pouce et sa serre, le doigt de devant et sa serre. */
const PIED: [P[], P[] | null][] = [
  [DOIGT_LOIN, SERRES[0]],
  [TARSE, null],
  [POUCE, SERRES[2]],
  [DOIGT_PRES, SERRES[1]],
];
const F_PATTES = PATTES.map((p) => new Forme(p));

const D_OISEAU = lisse(OISEAU);
const D_AILE = lisse(AILE);
const D_CAPUCHON = lisse(CAPUCHON);
const D_PIERRE = lisse(PIERRE);
const D_PATTES = PATTES.map(lisse).join("");

/** La distance d'un point au segment [a, b]. */
function auSegment(x: number, y: number, a: Pt, b: Pt): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/**
 * La distance d'un point (repère de la boîte) au faucon, à ses pattes et à son
 * rocher : 0 dedans. Le skin (../egypte.tsx) s'en sert pour écarter du
 * faucon les motifs entiers du châle (jamais un motif coupé par sa silhouette).
 */
export function distanceFauconEG(x: number, y: number): number {
  let m = Infinity;
  for (const F of [F_OISEAU, F_PIERRE, ...F_PATTES]) {
    if (F.dans(x, y)) return 0;
    const p = F.pts;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) m = Math.min(m, auSegment(x, y, p[j], p[i]));
  }
  return m;
}

/* ------------------------------ Les lamelles ------------------------------ */

/** Le point de l'oiseau : plus serré que le châle (9 × 12), des lamelles presque jointives. */
const PX = 6.2;
const PY = 8.8;
const L = 5;
const HL = 7.3;

/** Une lamelle : son centre et son angle (radians ; 0, d'aplomb). */
type Lam = readonly [number, number, number];

/** Combien des quatre coins d'une lamelle (avec une marge de côté m) sont dans la forme. */
function coins(F: Forme, x: number, y: number, a: number, m: number): number {
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const [hx, hy] = [L / 2 + m, HL / 2];
  let n = 0;
  for (let k = 0; k < 4; k++) {
    const u = k === 0 || k === 3 ? -hx : hx;
    const v = k < 2 ? -hy : hy;
    if (F.dans(x + u * c - v * s, y + u * s + v * c)) n++;
  }
  return n;
}
/** Entière dans la forme : ses quatre coins dedans (jamais coupée au contour). */
const entiere = (F: Forme, x: number, y: number, a = 0, m = 0.5) => coins(F, x, y, a, m) === 4;
/** Tout à fait hors de la forme. */
const hors = (F: Forme, x: number, y: number, a = 0) => coins(F, x, y, a, 0.8) === 0;

/**
 * Les rangs de plumes de l'aile : sur chaque rang, des festons (∪), le bout des
 * plumes, posés à une largeur et un creux propres au rang ; le manteau et les
 * scapulaires, en petits rangs parallèles au premier.
 */
type Rang = { l: readonly P[]; large: number; creux: number; decale: number };
const RANGS_AILE: Rang[] = [
  ...[96, 64, 32].map((h, k) => ({ l: RANGS[0].map((p) => [p[0], p[1] - h] as P), large: 30, creux: 8, decale: (k % 2) * 15 })),
  { l: RANGS[0], large: 34, creux: 9, decale: 0 },
  { l: RANGS[1], large: 42, creux: 12, decale: 17 },
  { l: RANGS[2], large: 46, creux: 14, decale: 4 },
  { l: RANGS[3], large: 54, creux: 17, decale: 22 },
];

/** La hauteur d'un trait ouvert (tracé de gauche à droite ou l'inverse) à l'abscisse x : interpolation entre ses points. */
const tries = new WeakMap<readonly P[], P[]>();
function hauteur(l: readonly P[], x: number): number {
  let pts = tries.get(l);
  if (!pts) {
    pts = [...l].sort((a, b) => a[0] - b[0]);
    tries.set(l, pts);
  }
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * (x - pts[i - 1][0])) / (pts[i][0] - pts[i - 1][0]);
  return pts[pts.length - 1][1];
}

/** La hauteur du feston d'un rang à l'abscisse x (le bas de chaque arc touche le rang). */
function feston(r: Rang, x: number): number {
  const t = fr((x + r.decale) / r.large);
  const xa = x - t * r.large;
  const [ya, ym, yb] = [hauteur(r.l, xa) - r.creux, hauteur(r.l, xa + r.large / 2) + r.creux, hauteur(r.l, xa + r.large) - r.creux];
  return (1 - t) * (1 - t) * ya + 2 * t * (1 - t) * ym + t * t * yb;
}

function festons(r: Rang): string {
  const xs = r.l.map((p) => p[0]);
  let d = "";
  for (let xa = Math.min(...xs) - fr((Math.min(...xs) + r.decale) / r.large) * r.large - r.large; xa < Math.max(...xs) + r.large; xa += r.large) {
    const xm = xa + r.large / 2;
    d += `M${f(xa)} ${f(hauteur(r.l, xa) - r.creux)}Q${f(xm)} ${f(hauteur(r.l, xm) + r.creux)} ${f(xa + r.large)} ${f(hauteur(r.l, xa + r.large) - r.creux)}`;
  }
  return d;
}
const D_FESTONS = RANGS_AILE.map(festons).join("");
/** Le haut de la culotte : le bout des plumes du ventre qui la recouvre, en festons. */
const RANG_CULOTTE: Rang = { l: [[290, 584], [302, 568], [320, 556], [342, 548], [364, 543], [386, 540]], large: 17, creux: 4.5, decale: 4 };
const D_FESTONS_CULOTTE = festons(RANG_CULOTTE);
/** Les lames des rémiges : du bout de l'aile vers le haut, le long des tiges. */
const LAMES: P[][] = [
  [[104, 701], [124, 640], [146, 580], [160, 534]],
  [[104, 701], [136, 646], [166, 590], [190, 540]],
  [[104, 701], [146, 654], [184, 602], [214, 548]],
];
/** Les tiges, lues comme x(y). */
const TIGES = LAMES.map((l) => l.map((p) => [p[1], p[0]] as P));

/** Un tirage fixe par maille (le même sur toutes les cartes) : 0 → 1. */
function tirage(i: number, j: number): number {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Le blanc de la tête (la joue, la gorge) et l'ardoise de l'aile, en rangs droits : vrai, une lamelle. */
function droit(x: number, y: number, j: number, i: number): boolean {
  if (Math.hypot(x - OEIL.cx, y - OEIL.cy) < OEIL.r + 7) return false;
  if (F_ARCADE.dans(x, y) || F_CAPUCHON.dans(x, y)) return false;
  if (F_PRIMAIRES.dans(x, y)) {
    // Les rémiges, sombres : un rang sur deux, et le filet nu le long de chaque tige.
    if (TIGES.some((l) => Math.abs(x - hauteur(l, y)) < 4.2)) return false;
    return j % 2 === 0 && i % 2 === 0;
  }
  if (F_AILE.dans(x, y)) {
    // L'ardoise : une lamelle sur trois ; le bout de chaque plume, son liseré, plein ; sous chaque feston, son ombre.
    let lisere = false;
    for (const r of RANGS_AILE) {
      const e = y - feston(r, x);
      if (e > -2.5 && e < 6.5) return false;
      if (e > -8.5 && e <= -2.5) lisere = true;
    }
    return lisere || (i + 2 * j) % 3 === 0;
  }
  return true;
}

/** Le premier rang du dessous (rangs en arcs) : au-dessus, la tête, en rangs droits. */
const J_DESSOUS = 21;
const Y_DESSOUS = 60 + J_DESSOUS * PY;

/**
 * Les barres du dessous, du poitrail au ventre : après combien de rangs pleins
 * une barre, et sa largeur (le vide ajouté entre deux rangs). Larges et espacées
 * sur le poitrail, fines et serrées vers le ventre ; avant la première, le
 * poitrail moucheté.
 */
const BARRES_DESSOUS: readonly [number, number][] = [
  [10, 8.2], [3, 7.6], [3, 7], [3, 6.4], [2, 5.8], [2, 5.2], [2, 4.8], [2, 4.4], [2, 4], [2, 3.8], [2, 3.6], [2, 3.4], [2, 3.2], [2, 3],
];

/** Les bords du dessous à la hauteur y : le bord de l'aile (derrière), le contour (devant). */
function bordsDessous(y: number): [number, number] {
  const aile = F_AILE.coupe(y);
  const corps = F_OISEAU.coupe(y);
  const devant = corps.length ? corps[corps.length - 1] : 0;
  const derriere = aile.length ? aile[aile.length - 1] : corps.length ? corps[0] : devant;
  return [derriere, devant];
}

/**
 * Les rangs du dessous : chacun un arc qui fait le tour du corps (le milieu au
 * plus bas, les bouts relevés de a, comme un anneau vu un peu d'au-dessus), un
 * peu plus bas devant (le corps penché). a croît du poitrail au ventre ; les
 * rangs se serrent donc vers les bords, là où le corps tourne.
 */
function rangsDessous(out: Lam[]) {
  let b = Y_DESSOUS;
  let k = 0;
  let barre = 0;
  let avant = BARRES_DESSOUS[0][0];
  for (; b < 600; k++) {
    const [g, d] = bordsDessous(b);
    const xm = (g + d) / 2;
    const hw = Math.max(20, (d - g) / 2);
    const a = Math.min(14, k * 0.55);
    const pente = Math.min(0.1, k * 0.004);
    const j = J_DESSOUS + k;
    const gouttes = barre === 0 && k >= 4;
    const x0 = 80 + (j % 2 ? PX / 2 : 0);
    for (let i = Math.max(0, Math.floor((g - 10 - x0) / PX)); x0 + i * PX < d + 12; i++) {
      const x = x0 + i * PX;
      const u = Math.max(-1.15, Math.min(1.15, (x - xm) / hw));
      const y = b - a * u * u + pente * (x - xm);
      if (!F_OISEAU.dans(x, y) || F_AILE.dans(x, y) || F_SOUS_QUEUE.dans(x, y) || F_CAPUCHON.dans(x, y)) continue;
      const ang = Math.atan((-2 * a * u) / hw + pente);
      if (!entiere(F_OISEAU, x, y, ang)) continue;
      if (!hors(F_AILE, x, y, ang) || !hors(F_SOUS_QUEUE, x, y, ang) || !hors(F_CAPUCHON, x, y, ang)) continue;
      // Le haut de la culotte : le bout des plumes du ventre la recouvre, un feston et son ombre.
      const e = y - feston(RANG_CULOTTE, x);
      if (x > 290 && e > -6 && e < 3.5 && F_CULOTTE.dans(x, y + 8)) continue;
      // Le haut du poitrail, moucheté : une goutte ici et là, plus serrées à l'approche de la première barre.
      if (gouttes && tirage(i, j) < 0.04 + (k - 4) * 0.018) continue;
      out.push([x, y, ang]);
    }
    // La barre : un vide entre deux rangs ; dans les larges, un pont de métal ici et là (la barre de chaque plume).
    if (--avant === 0) {
      const [, large] = BARRES_DESSOUS[Math.min(barre, BARRES_DESSOUS.length - 1)];
      if (large > 6) {
        const yb = b + (PY + large) / 2;
        for (let x = 80 + ((barre * 3) % 7) * PX; x < d + 12; x += PX * 7) {
          if (x < g - 10) continue;
          const u = Math.max(-1.15, Math.min(1.15, (x - xm) / hw));
          const y = yb - a * u * u + pente * (x - xm);
          const ang = Math.atan((-2 * a * u) / hw + pente);
          if (entiere(F_OISEAU, x, y, ang) && hors(F_AILE, x, y, ang) && hors(F_CULOTTE, x, y, ang) && hors(F_SOUS_QUEUE, x, y, ang)) out.push([x, y, ang]);
        }
      }
      b += PY + large;
      barre++;
      avant = BARRES_DESSOUS[Math.min(barre, BARRES_DESSOUS.length - 1)][0];
    } else b += PY;
  }
}

/**
 * Sous l'aile, en travers de la queue (l'axe A, vers le bout) : les sous-caudales
 * blanches, barrées fin tous les deux rangs ; puis la queue, sombre (une lamelle
 * sur cinq), quatre rangs pleins (les barres claires), la bande sombre, le bout
 * blanc (du métal plein).
 */
const O_QUEUE: Pt = [256, 568];
const A_QUEUE: Pt = [-0.62, 0.785];
const N_QUEUE: Pt = [0.785, 0.62];
const S_QUEUE = 116;
/** La queue, rang par rang depuis S_QUEUE : 0, sombre ; 1, plein. */
const BANDES_QUEUE = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0];
/** Le bout blanc de la queue (au-delà de S_BOUT sur l'axe) : les lamelles serrées s'y touchent, du métal plein. */
const S_BOUT = 226;
const D_BOUT = (() => {
  const at = (s: number, t: number) => `${f(O_QUEUE[0] + s * A_QUEUE[0] + t * N_QUEUE[0])} ${f(O_QUEUE[1] + s * A_QUEUE[1] + t * N_QUEUE[1])}`;
  return `M${at(S_BOUT, -60)}L${at(S_BOUT, 60)} ${at(S_BOUT + 60, 60)} ${at(S_BOUT + 60, -60)}Z`;
})();

function rangsQueue(out: Lam[]) {
  const ang = Math.atan2(-A_QUEUE[0], A_QUEUE[1]);
  let s = 2;
  for (let r = 0; s < S_BOUT - PY / 2; r++) {
    const queue = s >= S_QUEUE;
    const bande = queue ? BANDES_QUEUE[Math.min(BANDES_QUEUE.length - 1, Math.round((s - S_QUEUE) / PY))] : 1;
    for (let c = -24; c <= 24; c++) {
      const t = c * PX + (r % 2 ? PX / 2 : 0);
      const x = O_QUEUE[0] + s * A_QUEUE[0] + t * N_QUEUE[0];
      const y = O_QUEUE[1] + s * A_QUEUE[1] + t * N_QUEUE[1];
      if (!F_SOUS_QUEUE.dans(x, y) || !entiere(F_SOUS_QUEUE, x, y, ang) || !entiere(F_OISEAU, x, y, ang)) continue;
      if (bande === 0 && (c + 24 + r) % 5 !== 0) continue;
      out.push([x, y, ang]);
    }
    // Les sous-caudales : une barre fine tous les deux rangs ; la queue : des rangs serrés.
    s += PY + (!queue && r % 2 === 1 ? 3.6 : 0);
  }
}

/** Les mailles de l'oiseau : le dessin, le même pour toutes les cartes, calculé une fois. */
let places: Lam[] | null = null;
function mailles(): Lam[] {
  if (places) return places;
  const out: Lam[] = [];
  // La tête et l'aile, en rangs droits (le filet).
  let j = 0;
  for (let y = 60; y < 760; y += PY, j++) {
    let i = 0;
    for (let x = 80 + (j % 2 ? PX / 2 : 0); x < 500; x += PX, i++) {
      if (!F_OISEAU.dans(x, y) || !entiere(F_OISEAU, x, y)) continue;
      if (F_CIRE.dans(x, y) || F_BEC.dans(x, y)) continue;
      const aile = F_AILE.dans(x, y);
      if (!aile && (j >= J_DESSOUS || !hors(F_SOUS_QUEUE, x, y) || !hors(F_CULOTTE, x, y))) continue;
      if (aile && !entiere(F_AILE, x, y, 0, -0.5)) continue;
      if (droit(x, y, j, i)) out.push([x, y, 0]);
    }
  }
  rangsDessous(out);
  rangsQueue(out);
  return (places = out);
}

/** Les mailles du rocher : plein sur le dessus éclairé, clairsemé sur les faces, vide sous le surplomb, de plus en plus rare vers le bas. */
let placesPierre: Lam[] | null = null;
function maillesPierre(): Lam[] {
  if (placesPierre) return placesPierre;
  const out: Lam[] = [];
  // Le dessus, éclairé : un rang plein le long de la corniche, penché avec elle.
  for (let x = 134; x < 418; x += PX) {
    const [a, b] = [hauteur(DESSUS, x), hauteur(ARETES[0], x)];
    const pente = (hauteur(DESSUS, x + 3) + hauteur(ARETES[0], x + 3) - a - b) / 6;
    const [y, ang] = [(a + b) / 2, Math.atan(pente)];
    if (entiere(F_PIERRE, x, y, ang, 0.2) && F_PATTES.every((p) => !p.dans(x, y))) out.push([x, y, ang]);
  }
  let j = 0;
  for (let y = 612; y < 740; y += PY, j++) {
    let i = 0;
    for (let x = 130 + (j % 2 ? PX / 2 : 0); x < 424; x += PX, i++) {
      if (!F_PIERRE.dans(x, y) || !entiere(F_PIERRE, x, y) || !hors(F_SURPLOMB, x, y)) continue;
      if (F_PATTES.some((p) => p.dans(x, y))) continue;
      // La face : un grain de pierre, par plaques, plus rare vers le bas (le reste s'efface au masque).
      if (y < hauteur(ARETES[0], x) + 4.5) continue;
      const plaque = 0.7 + 0.3 * Math.sin(x / 23 + y / 17) * Math.cos(y / 29 - x / 41);
      const fond = Math.max(0, Math.min(1, (y - 640) / 110));
      if (tirage(i, j) < 0.42 * plaque * (1 - 0.5 * fond)) out.push([x, y, 0]);
    }
  }
  return (placesPierre = out);
}

/** Les lamelles d'une carte : aux mêmes mailles, chacune un peu penchée par l'aplatissage (propre à la graine). */
function lamelles(places: Lam[], graine: number) {
  const rnd = alea(graine);
  let corps = "";
  let arete = "";
  for (const [x, y, a] of places) {
    const pen = (rnd() - 0.5) * 1.3;
    if (a === 0) {
      corps += `M${f(x - L / 2 + pen)} ${f(y - HL / 2)}h${L}l${f(-pen * 2)} ${HL}h${-L}Z`;
      arete += `M${f(x - L / 2 + pen + 0.5)} ${f(y - HL / 2 + 1)}h${f(L - 1.1)}`;
      continue;
    }
    // Penchée avec son rang : le premier coin, puis les côtés en relatif (des chemins courts).
    const [c, s] = [Math.cos(a), Math.sin(a)];
    const [x0, y0] = [f(x + (-L / 2 + pen) * c + (HL / 2) * s), f(y + (-L / 2 + pen) * s - (HL / 2) * c)];
    const [lx, ly, hx, hy] = [f(L * c), f(L * s), f(-HL * s - 2 * pen * c), f(HL * c - 2 * pen * s)];
    corps += `M${x0} ${y0}l${lx} ${ly} ${hx} ${hy} ${-lx} ${-ly}Z`;
    arete += `M${f(x0 + 0.5 * c - s)} ${f(y0 + 0.5 * s + c)}l${f((L - 1.1) * c)} ${f((L - 1.1) * s)}`;
  }
  return { corps, arete };
}

const deja = new Map<number, { oiseau: ReturnType<typeof lamelles>; pierre: ReturnType<typeof lamelles> }>();
function filet(graine: number) {
  let l = deja.get(graine);
  if (!l) {
    if (deja.size > 24) deja.clear();
    l = { oiseau: lamelles(mailles(), graine ^ 0xfa1c0), pierre: lamelles(maillesPierre(), graine ^ 0x5701e) };
    deja.set(graine, l);
  }
  return l;
}

const ARGENT = "228,230,234";
const NOIR = "#0b0b0d";

/** Le dos : le faucon en lamelles d'argent sur le filet noir, sur son rocher. */
function Telli({ graine, id }: PropsTotem) {
  const l = filet(graine);
  const fil = (a: number) => `rgba(${ARGENT},${a})`;
  const metal = (m: ReturnType<typeof lamelles>) => (
    <>
      <path d={m.corps} fill="rgba(0,0,0,0.8)" transform="translate(0.7 1.1)" />
      <path d={m.corps} fill={`url(#fe${id})`} />
      <path d={m.arete} stroke={fil(0.95)} strokeWidth={0.8} />
    </>
  );
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <defs>
        {/* L'argent : des bandes plus ou moins claires en biais, le scintillement des lamelles. */}
        <linearGradient id={`fe${id}`} gradientUnits="userSpaceOnUse" x1={60} y1={40} x2={540} y2={780}>
          {[0, 0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88, 1].map((o, i) => (
            <stop key={o} offset={o} stopColor={i % 2 ? "#eceef1" : "#b4b8bf"} />
          ))}
        </linearGradient>
        {/* Le métal plein des petites pièces (la cire, les pieds) : battu, plus clair au bord éclairé. */}
        <linearGradient id={`fp${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={60} y2={60} spreadMethod="reflect">
          <stop offset={0} stopColor="#f2f3f5" />
          <stop offset={1} stopColor="#a9adb5" />
        </linearGradient>
        {/* L'acier du bec : plus sombre, éclairé à la base, noir vers le crochet. */}
        <linearGradient id={`fb${id}`} gradientUnits="userSpaceOnUse" x1={428} y1={116} x2={466} y2={160}>
          <stop offset={0} stopColor="#aab0b9" />
          <stop offset={0.45} stopColor="#6d727b" />
          <stop offset={1} stopColor="#2c2f35" />
        </linearGradient>
        {/* Le rocher se perd vers la gauche et vers le bas : tout s'y efface (deux masques). */}
        <linearGradient id={`fx${id}`} gradientUnits="userSpaceOnUse" x1={118} y1={0} x2={170} y2={0}>
          <stop offset={0} stopColor="#000" />
          <stop offset={1} stopColor="#fff" />
        </linearGradient>
        <linearGradient id={`fy${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={662} x2={0} y2={738}>
          <stop offset={0} stopColor="#fff" />
          <stop offset={1} stopColor="#000" />
        </linearGradient>
        <mask id={`fmx${id}`} maskUnits="userSpaceOnUse" x={90} y={600} width={340} height={145}>
          <rect x={90} y={600} width={340} height={145} fill={`url(#fx${id})`} />
        </mask>
        <mask id={`fmy${id}`} maskUnits="userSpaceOnUse" x={90} y={600} width={340} height={145}>
          <rect x={90} y={600} width={340} height={145} fill={`url(#fy${id})`} />
        </mask>
        <clipPath id={`fa${id}`}>
          <path d={D_AILE} />
        </clipPath>
        <clipPath id={`fc${id}`}>
          <path d={D_OISEAU} />
        </clipPath>
      </defs>
      {/* Le rocher : le filet nu, ses lamelles, son contour, ses arêtes ; il s'efface vers la gauche et vers le bas. */}
      <g mask={`url(#fmx${id})`}>
        <g mask={`url(#fmy${id})`}>
          <path d={D_PIERRE} fill={NOIR} />
          {metal(l.pierre)}
          <path d={D_PIERRE} fill="none" stroke={fil(0.9)} strokeWidth={1.8} />
          <path d={ARETES.map(trace).join("")} fill="none" stroke={fil(0.7)} strokeWidth={1.3} />
        </g>
      </g>
      {/* La patte, en métal plein, sur le rocher (la culotte en couvre le haut) ; les serres. */}
      {PIED.map(([doigt, serre], k) => (
        <g key={k}>
          <path d={lisse(doigt)} fill={`url(#fp${id})`} stroke={NOIR} strokeWidth={1.5} />
          {serre && <path d={lisse(serre)} fill={NOIR} stroke={fil(0.95)} strokeWidth={1.2} />}
        </g>
      ))}
      {/* L'oiseau : le filet nu sous lui, ses lamelles. */}
      <path d={D_OISEAU} fill={NOIR} />
      {metal(l.oiseau)}
      {/* L'aile : le bout de chaque plume, un fil ; les tiges des rémiges. */}
      <g clipPath={`url(#fa${id})`} fill="none">
        <path d={D_FESTONS} stroke={fil(0.7)} strokeWidth={1.3} />
        <path d={LAMES.map(trace).join("")} stroke={fil(0.6)} strokeWidth={1.3} />
      </g>
      {/* Le bout blanc de la queue. */}
      <path d={D_BOUT} fill={`url(#fp${id})`} clipPath={`url(#fc${id})`} />
      {/* La culotte : le bout des plumes du ventre qui la recouvre. */}
      <g clipPath={`url(#fc${id})`} fill="none">
        <path d={D_FESTONS_CULOTTE} stroke={fil(0.85)} strokeWidth={1.5} />
      </g>
      {/* Les petites pièces en métal plein : la cire ; le bec, d'acier, le crochet noir. */}
      <path d={lisse(BEC)} fill={`url(#fb${id})`} />
      <path d={lisse(CROCHET)} fill={NOIR} />
      <path d={lisse(CIRE)} fill={`url(#fp${id})`} />
      {/* Le contour : un rang de lamelles bout à bout ; l'aile, le casque, la culotte, le bec. */}
      <g fill="none" stroke={fil(0.95)}>
        <path d={D_OISEAU} stroke="rgba(0,0,0,0.85)" strokeWidth={2.8} strokeDasharray="7 0.75" strokeLinecap="butt" transform="translate(0.6 0.9)" />
        <path d={D_OISEAU} stroke={`url(#fe${id})`} strokeWidth={2.8} strokeDasharray="7 0.75" strokeLinecap="butt" />
        <path d={D_AILE} strokeWidth={1.6} />
        <path d={D_CAPUCHON} strokeWidth={2} />
        <path d={trace(BORD_CIRE)} stroke={NOIR} strokeWidth={1.4} />
        <path d={trace(COMMISSURE)} stroke={NOIR} strokeWidth={1.8} />
      </g>
      {/* L'œil : grand et noir, l'anneau de peau nue, l'éclat ; l'arcade en coupe le haut. */}
      <circle cx={OEIL.cx} cy={OEIL.cy} r={OEIL.r} fill={NOIR} />
      <circle cx={OEIL.cx} cy={OEIL.cy} r={OEIL.r + 2.8} fill="none" stroke={`rgb(${ARGENT})`} strokeWidth={3.4} />
      <path d={lisse(ARCADE)} fill={NOIR} />
      <path d={trace(BORD_ARCADE)} fill="none" stroke={fil(0.9)} strokeWidth={1.8} />
      <circle cx={OEIL.cx + 6} cy={OEIL.cy + 1} r={3.2} fill={`rgb(${ARGENT})`} />
      <circle cx={NARINE.cx} cy={NARINE.cy} r={NARINE.r} fill={NOIR} />
    </g>
  );
}

/** La silhouette, que le gaufrage relève : l'oiseau et sa patte (le rocher à part : il s'efface). */
const SILHOUETTE = D_OISEAU + D_PATTES;

/** La face : le gaufrage (lumière en haut à gauche, ombre en bas à droite), le casque, l'aile et l'œil en creux ; le rocher s'efface vers le bas. */
function Gaufre({ photo, tons, id }: PropsTotem) {
  const ombre = photo ? "rgba(4,4,6,0.62)" : "rgba(0,0,0,0.6)";
  const lumiere = photo ? "rgba(232,234,238,0.55)" : `rgba(${tons.encre},0.4)`;
  const releve = (forme: string, cle: string) => (
    <>
      <defs>
        <mask id={`${cle}${id}`} maskUnits="userSpaceOnUse" x={60} y={40} width={460} height={740}>
          <rect x={60} y={40} width={460} height={740} fill="#fff" />
          <path d={forme} fill="#000" />
        </mask>
      </defs>
      <path d={forme} fill={photo ? "rgba(232,234,238,0.1)" : `rgba(${tons.encre},0.04)`} />
      <g mask={`url(#${cle}${id})`}>
        <path d={forme} stroke={ombre} strokeWidth={12} transform="translate(4 5)" />
        <path d={forme} stroke={lumiere} strokeWidth={12} transform="translate(-4 -5)" />
      </g>
    </>
  );
  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <linearGradient id={`gf${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={660} x2={0} y2={738}>
          <stop offset={0} stopColor="#fff" />
          <stop offset={1} stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        {/* Le rocher : derrière l'oiseau (jamais sur lui), et il s'efface vers le bas. */}
        <mask id={`gm${id}`} maskUnits="userSpaceOnUse" x={60} y={560} width={460} height={220}>
          <rect x={60} y={560} width={460} height={220} fill={`url(#gf${id})`} />
          <path d={SILHOUETTE} fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#gm${id})`}>
        {releve(D_PIERRE, "gp")}
        <path d={trace(ARETES[0])} stroke={ombre} strokeWidth={3} transform="translate(-1 -1.5)" />
        <path d={trace(ARETES[0])} stroke={lumiere} strokeWidth={3} transform="translate(1 1.5)" />
      </g>
      {releve(SILHOUETTE, "gs")}
      <path d={D_AILE + D_CAPUCHON} stroke={ombre} strokeWidth={4} transform="translate(-1.5 -2)" />
      <path d={D_AILE + D_CAPUCHON} stroke={lumiere} strokeWidth={4} transform="translate(1.5 2)" />
      <path d={D_CAPUCHON} fill={photo ? "rgba(4,4,6,0.22)" : "rgba(0,0,0,0.2)"} />
      <circle cx={OEIL.cx} cy={OEIL.cy} r={OEIL.r} fill={ombre} />
    </g>
  );
}

const totem: TotemNation = {
  nation: "eg",
  animal: "faucon",
  quoi: "Le faucon pèlerin perché au bord d'un rebord de falaise, de profil, la tête levée vers la lune : le casque noir, la moustache, la joue blanche, l'œil coupé par l'arcade ; le dessous barré d'arcs, la culotte, la queue barrée ; en lamelles d'argent nouées sur le filet noir comme un châle de telli, le casque laissé vide.",
  sources: [
    { titre: "CBC, Peregrine Profile : la moustache plus large et le capuchon plus sombre du pèlerin", url: "https://www.cbc.ca/manitoba/features/falcon/profile.html" },
    { titre: "U.S. Fish and Wildlife Service, faucon pèlerin : la moustache sombre détachée par la joue claire", url: "https://www.fws.gov/species/peregrine-falcon-falco-peregrinus" },
    { titre: "Stanford Birds, Prairie Falcon : le casque noir du pèlerin, du crâne et de la nuque au coin sous l'œil", url: "https://stanford.edu/group/stanfordbirds/text/species/Prairie_Falconss.html" },
    { titre: "Scottish Wildlife Trust : le pèlerin trapu, large d'épaules, les ailes qui touchent presque le bout de la queue", url: "https://montrose-species.scottishwildlifetrust.org.uk/?p=1865" },
    { titre: "The Falcon Project (UMass) : l'anatomie du pèlerin (cire, narines, mandibules, moustache), la dent du bec", url: "https://openbooks.library.umass.edu/thefalconproject/chapter/appearance/" },
    { titre: "Birds Outside My Window : la cire et les narines, le tubercule des faucons", url: "https://www.birdsoutsidemywindow.org/2009/12/26/anatomy-cere-and-nares/" },
    { titre: "Wildfowl Carving Magazine, The Fall and Rise of the Peregrine Falcon : les « flags » barrés, la culotte du pèlerin", url: "https://www.wildfowl-carving.com/Reference/Fall-and-Rise-of-the-Peregrine-Falcon/amp" },
    { titre: "birdphotography.com, faucon pèlerin : le dessous barré, la queue barrée au bout clair", url: "https://birdphotography.com/species-guides/peregrine-falcon/" },
    { titre: "USGS, identification du pèlerin", url: "https://www.mbr-pwrc.usgs.gov/id/htmid/h3560id.html" },
    { titre: "R. Porter, Journal of Ancient Egyptian Interconnections : les faucons d'Horus et les vrais faucons (pèlerin, lanier, crécerelle)", url: "https://journals.librarypublishing.arizona.edu/jaei/article/id/963/" },
    { titre: "Textile Research Centre (Leyde) : le tulle bi telli, des lamelles nouées sur le filet", url: "https://trc-leiden.nl/trc-needles/regional-traditions/middle-east-and-north-africa/pre-modern-middle-east-and-north-africa/tulle-bi-telli" },
  ],
  dessine: true,
  boite: { w: 520, h: 760 },
  pose: {
    // Au dos : grand, à gauche, sur son rocher, la tête levée vers la lune (LUNE_EG).
    dos: { ...POSE_DOS_EG, devant: true, lune: LUNE_EG },
    // À la face : dans le coin bas gauche du portrait, hors du visage (x < 262), le rocher qui s'efface sur la ligne
    // de l'équerre (y 950), la queue à 20 de son bout (x 114).
    face: { portrait: { x: 104, y: 723, echelle: 0.3 } },
  },
  Dessin: (p) => {
    if (p.couche === "dos") return <Telli {...p} />;
    if (p.couche === "face-portrait") return <Gaufre {...p} />;
    return null;
  },
};

export default totem;
