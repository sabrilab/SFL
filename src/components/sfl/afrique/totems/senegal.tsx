// Le totem du Sénégal (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// Le lion assis, le corps de profil vers la gauche, la tête tournée vers
// nous : le gardien qui accueille (la teranga), qui regarde celui qui
// retourne la carte. Ni le marcheur de profil du Maroc, ni le rugissant du
// Cameroun : ici, un visage de face, la tête portée haut au-dessus d'une
// crinière en cloche.
// La tête (repère du visage : le front en 0, le menton en 290, l'axe en
// x 0) : un félin, pas un chien. Le museau long : la truffe (66 de large,
// moins que l'écart des pupilles, 92) commence à 0,8 fois cet écart sous
// les yeux, le haut arrondi ; les coussinets des moustaches (± 90), tachetés,
// la lèvre arrêtée à ± 78 et qui tombe aux coins, le menton blanc. Les yeux
// sur quatre rangs, la paupière haute presque droite, l'iris ambre, la
// pupille ronde, le reflet de la lune du même côté dans les deux ; l'orbite
// creusée, le poil blanc au-dessus et au-dessous, la larme courte collée au
// chanfrein ; le front et le chanfrein plus clairs que les joues. Les
// oreilles rondes, le dos sombre, le creux et sa touffe claire, à moitié
// prises dans la crinière.
// La crinière : une masse en cloche, le visage dans son tiers haut ; une
// calotte continue au sommet (aucun palier), blonde entre les oreilles ;
// plus longue et plus sombre le long des joues, sur le cou, l'épaule et le
// poitrail, où elle finit en mèches pendantes de longueurs inégales. Quatre
// teintes, du brun dehors à la fraise blonde au ras du visage, passent de
// l'une à l'autre par des hachures de tapisserie (le bord avance et recule
// d'un rang à l'autre) ; des brins sombres et clairs suivent le fil du
// poil. Elle jette son ombre sur l'épaule et sur le poitrail.
// Le corps : la patte avant proche s'affine du coude (104) au poignet (68),
// le coussinet carpien derrière, le canon qui penche, le pied et ses trois
// doigts festonnés, des sillons courts qui ne touchent pas le sol ; la
// lointaine 76 en retrait, plus sombre, séparée par un jour fin. Le dos
// descend du garrot, se creuse derrière l'épaule, remonte au rein, puis la
// croupe tombe ; la cuisse ovale (sa lumière, son pli, l'ombre du flanc
// devant elle), le genou en avant, le jarret posé au sol à l'arrière, le
// métatarse couché jusqu'au pied arrière. La queue, ramenée vers l'avant
// sur le sol, dresse sa touffe contre la cuisse. La lune, en haut à droite,
// éclaire le dos, la croupe et le dessus de la cuisse.
// Il est tissé comme le pagne manjak (../senegal.tsx), en flottés de trame
// supplémentaire, sur un panneau de toile plus fine que le pagne, cousu
// dessus (PANNEAU_SENEGAL) : rang après rang (PR), au pas des fils de chaîne
// (PC), les bords en escalier, sans aucun cerne ; les flottés jointifs,
// tenus par un liage étroit, et le brillant du fil sur chacun. Les traits
// sont des jours (la toile nue : le pli de la cuisse, l'écart des pattes) ;
// l'œil, la truffe et la bouche sont d'un fil sombre.
//   · au dos : le héros, grand (1,12), en bas du panneau ; la lune en haut à
//     droite, dans son cercle cousu, la rosace à 24 au moins du filet (LUNE_SENEGAL) ;
//   · à la face : le même lion brodé dans le coin bas du portrait, un fil
//     écru et son ombre : le contour au point avant, la crinière et ses
//     mèches, ses brins au point lancé ; le visage sans ovale (le chanfrein
//     en deux traits, les coussinets, la lèvre qui tombe, l'arcade) ; les
//     yeux, la truffe et la touffe de la queue au passé plat ; les oreilles.
// Les tracés sont des points posés à la main, liés en béziers tendus ; le
// tissage en est tiré une fois (le même pour tous) : la graine n'y touche pas.

import type { PropsTotem, TotemNation } from "../types";
import { f } from "../outils";

/** La lune, en haut à droite au-dessus du dos du lion, sa rosace dans le panneau (le skin, ../senegal.tsx, la lit). */
export const LUNE_SENEGAL = { cx: 734, cy: 330, d: 150 } as const;
/** Le panneau de toile fine, cousu sur le pagne, où le lion est tissé (le skin le dessine). */
export const PANNEAU_SENEGAL = { x: 62, y: 100, l: 900, h: 1040, r: 36 } as const;

/* ------------------------------ Les tracés ------------------------------ */

/** Un point posé à la main ; 1 : un angle, 2 : un angle adouci. */
type P = readonly [number, number] | readonly [number, number, number];
type Seg = readonly [number, number, number, number, number, number, number, number];

/** Des points liés en béziers tendus : chaque point prend la tangente de ses voisins, les poignées valent un tiers de la corde. */
function segments(pts: readonly P[], ferme = true): Seg[] {
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
  const out: Seg[] = [];
  for (let i = 0; i < (ferme ? n : n - 1); i++) {
    const [p, q] = [at(i), at(i + 1)];
    const c = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3;
    const [u, v] = [tangente(i), tangente(i + 1)];
    out.push([p[0], p[1], p[0] + u[0] * c, p[1] + u[1] * c, q[0] - v[0] * c, q[1] - v[1] * c, q[0], q[1]]);
  }
  return out;
}
const lisse = (pts: readonly P[], ferme = true) => {
  const s = segments(pts, ferme);
  return `M${f(s[0][0])} ${f(s[0][1])}${s.map((g) => `C${f(g[2])} ${f(g[3])} ${f(g[4])} ${f(g[5])} ${f(g[6])} ${f(g[7])}`).join("")}${ferme ? "Z" : ""}`;
};
/** Le même tracé, aplati en polygone (pour le tissage). */
function polygone(pts: readonly P[], ferme = true): [number, number][] {
  const out: [number, number][] = [];
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segments(pts, ferme)) {
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const u = 1 - t;
      out.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    }
  }
  if (!ferme) {
    const l = pts[pts.length - 1];
    out.push([l[0], l[1]]);
  }
  return out;
}
/** Un trait ouvert, de largeur l au départ et l2 à l'arrivée, en polygone (un jour, une queue). */
function bande(pts: readonly P[], l: number, l2 = l): [number, number][] {
  const ligne = polygone(pts, false);
  const g: [number, number][] = [];
  const d: [number, number][] = [];
  for (let i = 0; i < ligne.length; i++) {
    const w = l + ((l2 - l) * i) / (ligne.length - 1);
    const [a, b] = [ligne[Math.max(0, i - 1)], ligne[Math.min(ligne.length - 1, i + 1)]];
    const n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [nx, ny] = [(b[1] - a[1]) / n, -(b[0] - a[0]) / n];
    g.push([ligne[i][0] + (nx * w) / 2, ligne[i][1] + (ny * w) / 2]);
    d.push([ligne[i][0] - (nx * w) / 2, ligne[i][1] - (ny * w) / 2]);
  }
  return [...g, ...d.reverse()];
}
/** La moitié droite d'un trait symétrique (du haut au bas, x ≥ 0), refermée par son miroir. */
function miroir(droite: readonly P[]): P[] {
  const gauche = droite
    .slice(1, -1)
    .reverse()
    .map((p): P => (p.length === 3 ? [-p[0], p[1], p[2]] : [-p[0], p[1]]));
  return [...droite, ...gauche];
}
/** Le reflet d'un trait de la moitié droite du visage sur sa moitié gauche. */
const sym = (pts: readonly P[]): P[] => pts.map((p): P => (p.length === 3 ? [-p[0], p[1], p[2]] : [-p[0], p[1]]));
/** Un trait du visage (son repère : le haut du front en 0, le menton en 290, l'axe en x 0) posé sur le lion. */
const VISAGE_POSE = { x: 288, y: 221, s: 0.8 };
const auVisage = (pts: readonly P[]): P[] =>
  pts.map((p): P => {
    const q: [number, number] = [VISAGE_POSE.x + p[0] * VISAGE_POSE.s, VISAGE_POSE.y + p[1] * VISAGE_POSE.s];
    return p.length === 3 ? [q[0], q[1], p[2]] : q;
  });

/**
 * Une mèche : sa racine (x, y), sa direction au départ et à la pointe
 * (degrés ; 90 : vers le bas), sa longueur, sa largeur. Son axe tourne
 * régulièrement de l'une à l'autre (la mèche se couche en tombant) ; elle
 * s'élargit au tiers, s'effile en flamme et finit par une pointe ronde
 * (les touffes des joues, la frange).
 */
type Meche = readonly [number, number, number, number, number, number];
/** Le point de l'axe d'une mèche (t : 0 la racine, 1 la pointe) et sa normale (à gauche de la direction). */
function axe([x, y, a0, a1, L]: Meche, t: number): { p: [number, number]; n: [number, number] } {
  const pas = Math.max(1, Math.ceil(12 * Math.abs(t)));
  let [px, py] = [x, y];
  for (let i = 0; i < pas; i++) {
    const a = ((a0 + ((a1 - a0) * (i + 0.5) * t) / pas) * Math.PI) / 180;
    px += (Math.cos(a) * L * t) / pas;
    py += (Math.sin(a) * L * t) / pas;
  }
  const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
  return { p: [px, py], n: [Math.sin(a), -Math.cos(a)] };
}
/** Le profil d'une mèche : sa demi-largeur (en part de la largeur) le long de l'axe. */
const PROFIL = [[0, 0.42], [0.34, 0.5], [0.68, 0.37], [0.9, 0.15]] as const;
function meche(m: Meche): P[] {
  const w = m[5];
  const bord = (s: number) =>
    PROFIL.map(([t, k]): P => {
      const { p, n } = axe(m, t);
      return [p[0] + n[0] * s * k * w, p[1] + n[1] * s * k * w];
    });
  return [axe(m, -0.1).p, ...bord(1), axe(m, 1).p, ...bord(-1).reverse()];
}

/* ------------------------------- Le corps ------------------------------- */

// Le repère : 1000 × 1000, le sol à y 950 ; la tête en haut à gauche, la croupe à droite.

/**
 * La patte avant proche : l'épaule sous la crinière, le coude (104 de large),
 * l'avant-bras qui s'affine jusqu'au poignet (68), le coussinet carpien
 * derrière le poignet, le canon qui penche vers l'avant, le gros pied et ses
 * trois doigts festonnés.
 */
const AVANT: P[] = [
  [206, 600], [198, 652], [200, 704], [206, 762], [212, 820], [214, 856], [206, 874],
  [197, 881], [191, 893], [180, 895], [173, 907], [162, 910], [154, 924], [154, 942], [164, 950, 1],
  [288, 950, 1], [297, 941], [298, 926], [293, 910], [288, 900], [294, 890], [297, 879], [291, 869], [282, 862],
  [280, 838], [283, 796], [291, 750], [300, 704], [306, 660], [308, 622], [300, 600],
];
/** La patte avant lointaine : la même, en retrait, plus sombre ; un jour fin la sépare de la proche. */
const RETRAIT = 76;
const AVANT_LOIN = AVANT.map((p): P => (p.length === 3 ? [p[0] + RETRAIT, p[1], p[2]] : [p[0] + RETRAIT, p[1]]));
/** Le bord arrière de la patte proche (le jour entre les deux pattes). */
const DOS_AVANT: P[] = [[306, 640], [302, 700], [292, 752], [284, 800], [282, 844], [292, 868], [297, 884], [290, 902], [297, 924], [292, 946]];
/** Les sillons des doigts : courts, du creux entre deux doigts vers le sol, sans le toucher. */
const SILLONS: P[][] = [
  [[191, 895], [195, 912], [197, 932]],
  [[173, 909], [176, 924], [177, 938]],
];
const SILLONS_LOIN = [[[RETRAIT + 222, 920], [RETRAIT + 224, 936]], [[RETRAIT + 246, 916], [RETRAIT + 248, 934]]] as P[][];
/**
 * Le corps assis : le garrot sous la crinière, le creux derrière l'épaule, la
 * remontée du rein, la croupe ronde, le jarret posé au sol à l'arrière, le
 * métatarse couché jusqu'au pied arrière, ses doigts, le genou en avant, le
 * ventre, le poitrail.
 */
const CORPS: P[] = [
  [420, 420], [480, 440], [516, 462], [548, 484], [578, 494], [606, 491], [636, 494], [666, 510], [694, 542], [716, 588], [731, 646], [739, 712], [742, 780], [738, 846], [730, 886], [718, 908],
  [715, 922], [722, 936], [712, 948, 2], [690, 950, 1], [474, 950, 1], [452, 950], [440, 947], [433, 938], [434, 926], [441, 917], [449, 909], [460, 905], [466, 894], [474, 884], [472, 866], [460, 850],
  [450, 834], [446, 812], [432, 790], [404, 766], [366, 738], [332, 714], [304, 696], [244, 650], [204, 590], [206, 480], [280, 420],
];
/** Les sillons du pied arrière. */
const SILLONS_ARRIERE: P[][] = [
  [[449, 911], [452, 925], [453, 937]],
  [[466, 900], [469, 916], [470, 931]],
];
/** La cuisse : sa lumière sur le dessus, du genou à la hanche ; l'ombre du flanc devant elle ; son pli, du genou au-dessus de la cuisse. */
const LUMIERE_CUISSE: P[] = [[468, 800], [484, 764], [516, 728], [562, 700], [616, 686], [668, 688], [706, 710], [728, 748], [734, 790], [710, 778], [672, 758], [624, 750], [576, 758], [532, 778], [496, 808]];
const OMBRE_FLANC: P[] = [[446, 812], [462, 768], [498, 722], [548, 688], [608, 668], [656, 664], [626, 646], [570, 650], [516, 672], [470, 708], [442, 754], [432, 790]];
const PLI_CUISSE: P[] = [[456, 812], [468, 772], [498, 732], [544, 700], [596, 682], [644, 678]];
/** L'ombre sous la croupe, vers le jarret : la cuisse ronde, éclairée d'en haut. */
const OMBRE_JARRET: P[] = [[740, 820], [734, 868], [720, 904], [716, 922], [722, 938], [706, 950], [690, 940], [698, 908], [712, 866], [722, 830]];
/** Le métatarse couché, sous la cuisse : son ombre, et le bas de la cuisse. */
const SOUS_CUISSE: P[] = [[474, 884], [530, 896], [600, 902], [664, 900], [706, 900], [722, 918], [722, 936], [706, 952], [474, 952]];
/** L'ombre sous le ventre, derrière la patte ; la lumière de la lune sur le dos et la croupe. */
const OMBRE_VENTRE: P[] = [[304, 694], [366, 734], [436, 786], [454, 806], [466, 830], [478, 856], [484, 878], [470, 870], [450, 840], [420, 812], [378, 786], [336, 758], [306, 732]];
const LUMIERE_DOS: P[] = [[516, 462], [578, 494], [606, 491], [636, 494], [666, 510], [694, 542], [716, 588], [731, 646], [739, 712], [742, 780], [738, 812], [728, 784], [722, 716], [710, 654], [690, 604], [662, 566], [628, 540], [592, 528], [552, 514], [516, 496]];
/** L'ombre portée de la crinière sur l'épaule et le flanc. */
const OMBRE_EPAULE: P[] = [[500, 452], [540, 474], [568, 524], [578, 584], [566, 640], [534, 690], [486, 728], [436, 756], [452, 716], [488, 668], [508, 608], [512, 540], [506, 488]];
/** L'ombre de la crinière sur le poitrail et le haut des pattes avant. */
const OMBRE_POITRAIL: P[] = [[140, 600], [200, 616], [260, 630], [320, 636], [380, 632], [440, 612], [470, 640], [446, 700], [420, 742], [388, 724], [354, 768], [318, 748], [284, 782], [250, 756], [214, 742], [180, 712], [150, 680]];
/** La patte proche : la lumière de la lune sur son bord arrière. */
const LUMIERE_AVANT: P[] = [[304, 640], [298, 700], [290, 752], [284, 800], [282, 836], [272, 828], [276, 784], [282, 734], [290, 680]];

/** La queue, couchée au sol et ramenée vers l'avant, sous la croupe ; sa touffe se dresse contre la cuisse, derrière le pied arrière. */
const QUEUE: P[] = [[668, 939], [624, 938], [584, 933], [554, 922], [535, 906]];
const TOUFFE: P[] = [[546, 920], [528, 908], [514, 890], [509, 868], [513, 846, 1], [526, 862], [539, 880], [550, 900], [554, 916]];

/* -------------------------------- La tête -------------------------------- */

// Dans le repère du visage (auVisage) : le haut du front en y 0, le menton en y 290 ; la moitié droite, x ≥ 0.

const VISAGE = miroir([[0, -8], [28, -6], [54, 4], [78, 22], [98, 50], [112, 88], [120, 128], [121, 164], [116, 198], [107, 228], [94, 254], [74, 272], [50, 284], [24, 289], [0, 291]]);
/** Les oreilles rondes, à moitié prises dans la crinière : le dos sombre, le creux, sa touffe crème. */
const OREILLE: P[] = [[80, 32], [80, 12], [86, -6], [98, -18], [112, -22], [126, -16], [134, -2], [136, 16], [130, 32], [116, 40], [96, 40]];
const OREILLE_DEDANS: P[] = [[92, 32], [92, 14], [98, 0], [108, -8], [120, -6], [126, 6], [124, 22], [114, 32], [102, 34]];
/** Les touffes des joues : le visage qui s'effiloche dans la crinière. */
const TOUFFES_JOUE: Meche[] = [
  [112, 126, 4, 40, 44, 22],
  [116, 166, 24, 62, 46, 22],
  [108, 206, 46, 80, 44, 22],
  [92, 240, 70, 92, 40, 20],
];
/** La frange : les mèches courtes du haut de la crinière, qui retombent sur le front. */
const FRANGE: Meche[] = [
  [16, -16, 100, 90, 28, 14],
  [48, -10, 112, 96, 32, 15],
  [78, 8, 122, 104, 34, 15],
];
/** L'ombre des joues, au bord du visage. */
const JOUE: P[] = [[106, 92], [118, 128], [118, 168], [110, 204], [96, 232], [100, 196], [104, 150], [104, 116]];
/** Le froncement entre les sourcils : le regard lourd. */
const FRONCE: P[] = [[6, 60], [14, 62], [16, 78], [12, 86], [6, 80]];
/** Le poil blanc au-dessus de l'œil, et dessous. */
const SOURCIL: P[] = [[14, 86], [26, 77], [44, 72], [62, 73], [80, 82], [64, 81], [46, 80], [28, 84]];
const CERNE: P[] = [[22, 116], [32, 124], [50, 128], [66, 122], [78, 106], [66, 116], [50, 121], [32, 120]];
/** L'orbite : l'ombre de l'arcade autour de l'œil, qui creuse le regard. */
const ORBITE: P[] = [[8, 104], [18, 90], [36, 82], [56, 81], [74, 87], [88, 100], [80, 110], [66, 118], [44, 124], [24, 120], [12, 112]];
/** L'œil : la paupière haute presque droite, le coin intérieur à peine plus bas ; l'iris ambre, la pupille ronde. */
const OEIL: P[] = [[18, 104, 2], [26, 94], [38, 89], [52, 88], [63, 90], [70, 100, 2], [62, 110], [48, 117], [34, 117], [24, 112]];
const IRIS: P[] = [[30, 103], [33, 94], [44, 91], [55, 94], [58, 103], [55, 112], [44, 115], [33, 112]];
const PUPILLE: P[] = [[40, 99], [48, 99], [48, 107], [40, 107]];
const REFLET: P[] = [[47, 94], [52, 94], [52, 99], [47, 99]];
/** La larme : un trait court, collé au chanfrein. */
const LARME: P[] = [[19, 106], [20, 114], [21, 121]];
/** Le front et le chanfrein, plus clairs que les joues : le poil ras du masque. */
const FRONT = miroir([[0, -8], [36, -4], [62, 12], [74, 40], [66, 66], [40, 76], [24, 84], [20, 110], [22, 140], [28, 168], [0, 172]]);
/** Le chanfrein, long et large, plus clair, qui s'élargit jusqu'à la truffe. */
const CHANFREIN = miroir([[0, 56], [14, 58], [17, 82], [18, 106], [21, 132], [26, 156], [32, 172], [0, 172]]);
/** La truffe : le haut arrondi, en pointe vers la lèvre. */
const TRUFFE = miroir([[0, 171], [14, 171.5], [26, 173.5], [32, 178], [33, 184], [29, 191], [20, 199], [10, 206], [0, 210]]);
/** Le coussinet des moustaches (le droit ; le gauche est son reflet), ses taches ; le menton ; la lèvre, qui tombe aux coins. */
const MUSEAU: P[] = [[0, 208], [12, 206], [24, 200], [33, 190], [50, 194], [70, 204], [86, 218], [90, 232], [82, 244], [64, 250], [42, 250], [22, 244], [8, 236], [0, 232]];
const TACHES: readonly (readonly [number, number])[] = [[52, 212], [65, 217], [77, 224], [48, 225], [62, 230], [74, 236], [56, 240]];
const MENTON = miroir([[0, 250], [16, 254], [30, 262], [34, 274], [26, 284], [12, 289], [0, 290]]);
const BOUCHE: P[] = [[-78, 264], [-70, 256], [-58, 252], [-42, 253], [-24, 248], [-10, 240], [0, 232], [10, 240], [24, 248], [42, 253], [58, 252], [70, 256], [78, 264]];
const PHILTRUM: P[] = [[0, 208], [0, 232]];

/* ------------------------------ La crinière ------------------------------ */

// Une masse en cloche (le visage dans son tiers haut) : courte et blonde sur
// le front, entre les oreilles ; plus longue et plus sombre en descendant le
// long des joues, sur le cou, l'épaule et le poitrail, où elle finit en
// mèches qui pendent. Les teintes passent de l'une à l'autre par des
// hachures ; des brins clairs et sombres suivent le fil du poil.
/** La silhouette (le brun) : la calotte, le cou et l'épaule à droite, le poitrail et ses mèches pendantes, le devant à gauche. */
const CRINIERE: P[] = [
  [292, 161], [323, 163], [340, 158, 2], [357, 170], [383, 183], [406, 205], [430, 212, 2], [430, 234], [444, 263], [466, 298, 2], [457, 310], [466, 343], [486, 382, 2],
  [475, 390], [484, 425], [504, 464, 2], [493, 472], [506, 507], [532, 562, 1], [512, 550], [514, 612, 1], [494, 578], [484, 652, 1], [466, 600], [450, 678, 1], [438, 624],
  [418, 710, 1], [404, 642], [388, 692, 1], [372, 650], [354, 732, 1], [336, 656], [318, 714, 1], [304, 662], [284, 744, 1], [266, 666], [248, 718, 1], [232, 652], [214, 702, 1],
  [198, 642], [176, 678, 1], [166, 612], [142, 642, 1], [138, 588], [112, 592, 1], [118, 560], [110, 536], [94, 526, 2], [102, 500], [104, 470], [92, 454, 2], [102, 430],
  [106, 396], [100, 372, 2], [112, 350], [122, 318], [126, 296, 2], [140, 282], [154, 256], [172, 230], [196, 206], [222, 186], [248, 170], [270, 163],
];
/** L'ocre : tout le milieu, ses lobes vers le dehors et le bas. */
const CRIN_OCRE: P[] = [
  [293, 178], [324, 179], [353, 190], [379, 209], [399, 232], [415, 263], [433, 292, 1], [424, 303], [437, 339], [457, 374, 1], [443, 381], [453, 419], [473, 458, 1],
  [461, 463], [472, 501], [490, 548, 1], [470, 530], [462, 592, 1], [446, 556], [430, 628, 1], [414, 580], [396, 660, 1], [382, 600], [364, 646, 1], [350, 610], [330, 684, 1],
  [316, 614], [298, 664, 1], [284, 616], [262, 690, 1], [248, 610], [228, 660, 1], [212, 600], [190, 640, 1], [182, 572], [154, 594, 1], [157, 512], [141, 490, 1], [150, 469],
  [146, 434], [130, 412, 1], [148, 398], [150, 361], [141, 341, 1], [159, 329], [166, 292], [159, 272, 1], [181, 261], [197, 234], [224, 210], [257, 187],
];
/** L'ocre clair : la fraise autour du visage, longue sous le menton (la gorge) ; la calotte blonde entre les oreilles. */
const CRIN_CLAIR: P[] = [
  [288, 194], [323, 198], [352, 210], [373, 230], [390, 261], [401, 301], [417, 330, 1], [404, 341], [404, 383], [415, 418, 1], [399, 425], [392, 461], [392, 508, 1],
  [374, 486], [362, 548, 1], [348, 500], [330, 576, 1], [314, 510], [294, 556, 1], [278, 506], [256, 570, 1], [244, 500], [220, 540, 1], [214, 484], [188, 490, 1], [190, 447],
  [175, 419], [159, 403, 1], [173, 383], [172, 347], [161, 325, 1], [177, 310], [184, 270], [203, 234], [224, 210], [253, 198],
];
/** La fraise blonde, au ras du visage : les joues, la barbe, le front. */
const FRAISE: P[] = [
  [288, 203], [319, 207], [344, 219], [363, 239], [377, 272], [384, 312], [395, 341, 1], [384, 354], [384, 398], [392, 427, 1], [375, 436], [363, 465], [361, 494, 1],
  [343, 472], [333, 510, 1], [319, 478], [303, 518, 1], [288, 483], [266, 514, 1], [257, 478], [235, 501, 1], [230, 465], [208, 461, 1], [204, 432], [192, 407],
  [183, 381, 1], [190, 356], [188, 312], [197, 272], [212, 239], [230, 219], [257, 207],
];
/** Les brins : le fil du poil, sombres dans l'ocre, clairs dans le brun ; du visage vers le dehors, couchés en tombant. */
const BRINS_SOMBRES: P[][] = [
  [[186, 281], [159, 312], [139, 352]], [[179, 349], [155, 392], [144, 439]], [[183, 403], [164, 458], [161, 509]], [[201, 456], [192, 507], [193, 554]],
  [[228, 489], [224, 538], [233, 583]], [[268, 507], [270, 558], [275, 599]], [[313, 509], [323, 559], [330, 605]], [[352, 494], [368, 541], [381, 589]],
  [[383, 458], [408, 507], [428, 556]], [[399, 398], [426, 447], [450, 501]], [[403, 341], [428, 383], [448, 430]], [[395, 279], [419, 312], [437, 352]],
  [[377, 230], [403, 252], [423, 279]], [[217, 227], [192, 249], [172, 278]], [[323, 187], [346, 194], [366, 207]], [[255, 187], [232, 196], [213, 210]],
];
const BRINS_CLAIRS: P[][] = [
  [[123, 419], [117, 465], [123, 510]], [[141, 538], [155, 583], [161, 619]], [[204, 583], [208, 629]], [[241, 585], [246, 639]], [[297, 599], [301, 643]],
  [[346, 583], [352, 632]], [[397, 583], [406, 634]], [[446, 556], [459, 599]], [[483, 498], [501, 541]], [[470, 403], [484, 447]], [[450, 325], [464, 363]],
  [[130, 338], [117, 374]], [[146, 265], [135, 292]],
];

/* ------------------------------ Le tissage ------------------------------- */

/** Le pas des rangs (la trame) et des fils de chaîne, dans la boîte (≈ 5,7 et 2,9 à la carte : une toile plus fine que le pagne). */
const PR = 6;
const PC = 3;
/** Le liage : le fil de chaîne qui tient le flotté, un jour étroit entre deux flottés. */
const LIAGE = 1.6;
const BOITE = { w: 1000, h: 1000 } as const;

/** Les fils : leur couleur, et les flottés (en fils de chaîne). */
interface Fil {
  couleur: string;
  flottes: readonly number[];
}
// L'écru du coton, les fauves, les ocres et les bruns de la teinture ; aucune teinte proche de l'or.
const FILS = {
  fauve: { couleur: "#be996c", flottes: [6, 4, 7, 5] },
  clair: { couleur: "#d4b68c", flottes: [7, 5, 8, 6] },
  ombre: { couleur: "#93704c", flottes: [3, 2, 4, 2] },
  loin: { couleur: "#6f553a", flottes: [2, 3, 2] },
  visage: { couleur: "#c9a577", flottes: [6, 5, 7] },
  joue: { couleur: "#b08c64", flottes: [4, 3, 4] },
  creme: { couleur: "#ece3cf", flottes: [6, 7, 5] },
  sombre: { couleur: "#160f0b", flottes: [14] },
  ambre: { couleur: "#c79c62", flottes: [9] },
  crin0: { couleur: "#b8875a", flottes: [5, 4, 6] },
  crin1: { couleur: "#a5764b", flottes: [5, 3, 6, 4] },
  crin2: { couleur: "#865a39", flottes: [4, 3, 5] },
  crin3: { couleur: "#5f3f2a", flottes: [3, 2, 3, 4] },
  touffe: { couleur: "#563a27", flottes: [3, 2, 3] },
} as const satisfies Record<string, Fil>;
type CleFil = keyof typeof FILS;
const CLES = Object.keys(FILS) as CleFil[];
const JOUR = 255;

/**
 * Les zones du tissage, de l'arrière vers l'avant ; `sur` : seulement par-dessus
 * ces fils (une bande de teinture, une ombre, un jour) ; `dents` : la hachure
 * de tapisserie, le bord qui avance et recule d'un rang à l'autre (en unités).
 */
type Zone = { poly: [number, number][]; fil: CleFil | "jour"; sur?: readonly CleFil[]; dents?: number };

function zones(): Zone[] {
  const fauves: CleFil[] = ["fauve", "clair", "ombre"];
  const crins: CleFil[] = ["crin1", "crin2", "crin3"];
  const peau: CleFil[] = ["fauve", "visage", "joue", "clair"];
  const face: CleFil[] = [...peau, "creme"];
  const v = (pts: readonly P[]) => polygone(auVisage(pts));
  const vb = (pts: readonly P[], l: number) => bande(auVisage(pts), l);
  const carre = ([x, y]: readonly [number, number], r = 3): P[] => [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]];
  const deux = (pts: readonly P[], fil: CleFil, sur?: readonly CleFil[]): Zone[] => [
    { poly: v(pts), fil, sur },
    { poly: v(sym(pts)), fil, sur },
  ];
  return [
    // la patte lointaine, le corps, ses ombres et ses lumières (hachées), le pied arrière
    { poly: polygone(AVANT_LOIN), fil: "loin" },
    ...SILLONS_LOIN.map((m): Zone => ({ poly: bande(m, 5), fil: "ombre", sur: ["loin"] })),
    { poly: polygone(CORPS), fil: "fauve" },
    { poly: polygone(LUMIERE_DOS), fil: "clair", sur: ["fauve"], dents: 14 },
    { poly: polygone(LUMIERE_CUISSE), fil: "clair", sur: ["fauve"], dents: 14 },
    { poly: polygone(OMBRE_FLANC), fil: "ombre", sur: ["fauve"], dents: 10 },
    { poly: polygone(OMBRE_VENTRE), fil: "ombre", sur: ["fauve"], dents: 10 },
    { poly: polygone(OMBRE_EPAULE), fil: "ombre", sur: ["fauve", "clair"], dents: 12 },
    { poly: polygone(SOUS_CUISSE), fil: "ombre", sur: ["fauve", "clair"], dents: 12 },
    { poly: polygone(OMBRE_JARRET), fil: "ombre", sur: ["fauve", "clair"], dents: 10 },
    { poly: bande(PLI_CUISSE, 5, 1.5), fil: "jour", sur: fauves },
    ...SILLONS_ARRIERE.map((m): Zone => ({ poly: bande(m, 8, 5), fil: "ombre", sur: fauves })),
    // la queue, couchée vers l'avant : un jour fin la détache du corps
    { poly: bande(QUEUE, 30, 24), fil: "jour", sur: ["ombre", "fauve", "clair"] },
    { poly: bande(QUEUE, 22, 17), fil: "fauve" },
    { poly: bande(QUEUE.map((p): P => [p[0], p[1] - 4]), 7, 5), fil: "clair", sur: ["fauve"] },
    { poly: polygone(TOUFFE), fil: "touffe" },
    // la patte proche, sa lumière, le jour qui la sépare de la lointaine, ses doigts
    { poly: polygone(AVANT), fil: "fauve" },
    { poly: polygone(LUMIERE_AVANT), fil: "clair", sur: ["fauve"], dents: 8 },
    { poly: bande(DOS_AVANT, 4), fil: "jour", sur: ["loin"] },
    { poly: polygone(OMBRE_POITRAIL), fil: "ombre", sur: ["fauve", "clair"], dents: 12 },
    ...SILLONS.map((m): Zone => ({ poly: bande(m, 8, 5), fil: "ombre", sur: fauves })),
    // la crinière : le brun, l'ocre, l'ocre clair, la fraise blonde ; les hachures entre les teintes ; les brins
    { poly: polygone(CRINIERE), fil: "crin3" },
    { poly: polygone(CRIN_OCRE), fil: "crin2", sur: ["crin3"], dents: 12 },
    ...BRINS_CLAIRS.map((m): Zone => ({ poly: bande(m, 6, 2), fil: "crin2", sur: ["crin3"] })),
    { poly: polygone(CRIN_CLAIR), fil: "crin1", sur: crins, dents: 12 },
    ...BRINS_SOMBRES.map((m): Zone => ({ poly: bande(m, 6, 2), fil: "crin3", sur: ["crin2"] })),
    { poly: polygone(FRAISE), fil: "crin0", sur: crins, dents: 9 },
    // les oreilles
    ...deux(OREILLE, "crin3"),
    ...deux(OREILLE_DEDANS, "joue", ["crin3"]),
    ...deux([[98, 32], [100, 20], [106, 10], [113, 18], [111, 32]], "creme", ["joue"]),
    // le visage
    ...TOUFFES_JOUE.flatMap((m) => deux(meche(m), "crin1")),
    { poly: v(VISAGE), fil: "fauve" },
    { poly: v(FRONT), fil: "visage", sur: ["fauve"], dents: 6 },
    ...FRANGE.flatMap((m) => deux(meche(m), "crin1", peau)),
    ...deux(JOUE, "joue", peau),
    ...deux(FRONCE, "joue", peau),
    { poly: v(CHANFREIN), fil: "clair", sur: peau },
    ...deux(ORBITE, "joue", peau),
    ...deux(SOURCIL, "creme", peau),
    ...deux(CERNE, "creme", peau),
    ...deux(MUSEAU, "creme"),
    { poly: v(MENTON), fil: "creme" },
    ...TACHES.flatMap((p) => deux(carre(p), "joue", ["creme"])),
    ...deux(OEIL, "sombre"),
    ...deux(IRIS, "ambre", ["sombre"]),
    ...deux(PUPILLE, "sombre", ["ambre"]),
    // le reflet de la lune, du même côté dans les deux yeux (l'œil gauche est à - 88)
    { poly: v(REFLET), fil: "creme", sur: ["ambre", "sombre"] },
    { poly: v(REFLET.map((p): P => [p[0] - 88, p[1]])), fil: "creme", sur: ["ambre", "sombre"] },
    { poly: vb(LARME, 3), fil: "crin2", sur: face },
    { poly: vb(sym(LARME), 3), fil: "crin2", sur: face },
    { poly: v(TRUFFE), fil: "sombre" },
    { poly: vb(PHILTRUM, 5), fil: "sombre" },
    { poly: vb(BOUCHE, 5), fil: "sombre" },
  ];
}

/** Les abscisses où une horizontale coupe un polygone (pair-impair), en paires [entrée, sortie]. */
function coupes(poly: [number, number][], y: number): [number, number][] {
  const xs: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [[x1, y1], [x2, y2]] = [poly[i], poly[j]];
    if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
  }
  xs.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < xs.length; k += 2) out.push([xs[k], xs[k + 1]]);
  return out;
}

/** Les dents d'une hachure : l'avancée du bord sur un rang (en part de la dent), à gauche (0) ou à droite (1). */
const DENTS = [1, -0.4, 0.6, -0.4, 0.85, -0.4, 0.4, -0.4] as const;
const dent = (r: number, cote: number) => DENTS[(r + cote * 3) % DENTS.length];

/**
 * Le tissage, tiré une fois : chaque rang est une ligne de cellules (une par
 * fil de chaîne) ; chaque zone peint les cellules qu'elle couvre, de
 * l'arrière vers l'avant (une zone à dents avance et recule d'un rang à
 * l'autre) ; puis chaque suite de cellules du même fil devient des flottés
 * jointifs, tenus par un liage étroit, décalés d'un rang à l'autre (les
 * liages ne s'alignent jamais). Des chemins relatifs, courts.
 */
function tisser(): Record<CleFil, string> {
  const out = Object.fromEntries(CLES.map((k) => [k, ""])) as Record<CleFil, string>;
  const colonnes = Math.ceil(BOITE.w / PC);
  const cellules = new Uint8Array(colonnes);
  const liste = zones().map((z) => ({ ...z, code: z.fil === "jour" ? JOUR : CLES.indexOf(z.fil) + 1, codesSur: z.sur?.map((k) => CLES.indexOf(k) + 1) }));
  for (let r = 0; r * PR < BOITE.h; r++) {
    const y = r * PR + PR / 2;
    cellules.fill(0);
    for (const z of liste) {
      for (const [a0, b0] of coupes(z.poly, y)) {
        const [a, b] = z.dents ? [a0 - z.dents * dent(r, 0), b0 + z.dents * dent(r, 1)] : [a0, b0];
        for (let c = Math.max(0, Math.ceil(a / PC - 0.5)); c <= Math.min(colonnes - 1, Math.floor(b / PC - 0.5)); c++) {
          const v = cellules[c];
          if (z.codesSur ? z.codesSur.includes(v) : z.code !== JOUR || v !== 0) cellules[c] = z.code;
        }
      }
    }
    let c = 0;
    while (c < colonnes) {
      const v = cellules[c];
      let e = c;
      while (e + 1 < colonnes && cellules[e + 1] === v) e++;
      if (v !== 0 && v !== JOUR) {
        const cle = CLES[v - 1];
        const motif = FILS[cle].flottes;
        let k = (r * 3) % motif.length;
        let x = c - ((r * 2) % 3);
        let fin: number | null = null;
        let d = "";
        while (x <= e) {
          const l = motif[k % motif.length];
          const [a, b] = [Math.max(x, c), Math.min(x + l - 1, e)];
          const xa = a === c ? a * PC + 0.3 : a * PC + LIAGE / 2;
          const xb = b === e ? (b + 1) * PC - 0.3 : (b + 1) * PC - LIAGE / 2;
          if (b >= a && xb > xa) {
            d += fin === null ? `M${f(xa)} ${y}h${f(xb - xa)}` : `m${f(xa - fin)} 0h${f(xb - xa)}`;
            fin = xb;
          }
          x += l;
          k++;
        }
        out[cle] += d;
      }
      c = e + 1;
    }
  }
  return out;
}
let TISSAGE: Record<CleFil, string> | null = null;
const tissage = () => (TISSAGE ??= tisser());

function Lion() {
  const t = tissage();
  return (
    <g fill="none" strokeLinecap="butt">
      {CLES.map((k) => (
        <path key={k} d={t[k]} stroke={FILS[k].couleur} strokeWidth={PR * 0.8} />
      ))}
      {/* Le brillant du fil : une lumière fine sur le haut de chaque flotté. */}
      <path d={CLES.filter((k) => k !== "sombre").map((k) => t[k]).join("")} stroke="#fff" strokeOpacity={0.14} strokeWidth={PR * 0.18} transform={`translate(0 ${-PR * 0.2})`} />
    </g>
  );
}

/* ------------------------------- La broderie ------------------------------ */

/** La broderie : le pli de la cuisse, arrêté avant le contour ; la touffe de la queue, une flamme effilée. */
const PLI_BRODE: P[] = [[478, 798], [490, 766], [520, 730], [566, 702], [614, 688]];
const TOUFFE_BRODEE: P[] = [[546, 920], [528, 908], [514, 890], [509, 868], [513, 842, 1], [526, 860], [539, 880], [550, 900], [554, 916]];
/** La crinière brodée : la même silhouette, ses mèches pendantes réduites à quelques flammes. */
const CRINIERE_BRODEE: P[] = [
  [292, 161], [323, 163], [340, 158, 2], [357, 170], [383, 183], [406, 205], [430, 212, 2], [430, 234], [444, 263], [466, 298, 2], [457, 310], [466, 343], [486, 382, 2],
  [475, 390], [484, 425], [504, 464, 2], [493, 472], [506, 507], [532, 562, 1], [504, 584], [486, 648, 1], [460, 632], [430, 700, 1], [402, 670], [356, 728, 1], [322, 684],
  [284, 742, 1], [250, 690], [214, 702, 1], [186, 660], [142, 642, 1], [138, 588], [112, 592, 1], [118, 560], [110, 536], [94, 526, 2], [102, 500], [104, 470], [92, 454, 2],
  [102, 430], [106, 396], [100, 372, 2], [112, 350], [122, 318], [126, 296, 2], [140, 282], [154, 256], [172, 230], [196, 206], [222, 186], [248, 170], [270, 163],
];
/** Le visage brodé, sans ovale : les deux traits du chanfrein, les deux arcs des coussinets, la lèvre qui tombe, l'arcade. */
const CHANFREIN_BRODE: P[] = [[16, 76], [17, 104], [21, 134], [28, 162]];
const COUSSINET_BRODE: P[] = [[40, 194], [62, 200], [80, 214]];
const LEVRE_BRODEE: P[] = [[-78, 266], [-62, 254], [-36, 254], [-14, 244], [0, 234], [14, 244], [36, 254], [62, 254], [78, 266]];
const ARCADE_BRODEE: P[] = [[20, 84], [36, 78], [54, 77], [72, 82]];

/**
 * La face : le lion brodé dans un coin du portrait, un fil écru et son ombre
 * sur la photo. Le contour au point avant (les arêtes cachées coupées par
 * des découpes « hors de ») ; les brins de la crinière au point lancé, qui
 * suivent le poil et s'arrêtent au visage ; le visage sans ovale : le
 * chanfrein en deux traits, les coussinets en deux arcs, la lèvre qui
 * tombe, l'arcade ; les yeux, la truffe et la touffe de la queue au passé
 * plat (des aplats de fil) ; les oreilles, leur bord et leur creux.
 */
function Broderie({ id, photo }: { id: string; photo: boolean }) {
  const c = (k: string) => `sn-b${k}-${id}`;
  const horsDe = (k: string, d: string) => (
    <clipPath id={c(k)}>
      <path d={`M-40 -40H1040V1040H-40Z${d}`} clipRule="evenodd" />
    </clipPath>
  );
  const fil = photo ? "rgba(240,232,214,0.92)" : "rgba(236,229,214,0.62)";
  const ombre = "rgba(0,0,0,0.5)";
  const point = (d: string, e = 14, pas = "30 14") => (
    <>
      <path d={d} fill="none" stroke={ombre} strokeWidth={e + 2} strokeDasharray={pas} transform="translate(4 5)" strokeLinecap="round" />
      <path d={d} fill="none" stroke={fil} strokeWidth={e} strokeDasharray={pas} strokeLinecap="round" />
    </>
  );
  const plat = (d: string) => (
    <>
      <path d={d} fill={ombre} transform="translate(4 5)" />
      <path d={d} fill={fil} />
    </>
  );
  const crin = lisse(CRINIERE_BRODEE);
  const visage = lisse(auVisage(VISAGE));
  const oreilles = lisse(auVisage(OREILLE)) + lisse(auVisage(sym(OREILLE)));
  const brins = BRINS_SOMBRES.filter((_, i) => i % 2 === 0)
    .map((m) => lisse(m, false))
    .join("");
  const yeux = lisse(auVisage(OEIL)) + lisse(auVisage(sym(OEIL)));
  const traits =
    lisse(auVisage(CHANFREIN_BRODE), false) +
    lisse(auVisage(sym(CHANFREIN_BRODE)), false) +
    lisse(auVisage(COUSSINET_BRODE), false) +
    lisse(auVisage(sym(COUSSINET_BRODE)), false) +
    lisse(auVisage(LEVRE_BRODEE), false) +
    lisse(auVisage(PHILTRUM), false);
  const arcades = lisse(auVisage(ARCADE_BRODEE), false) + lisse(auVisage(sym(ARCADE_BRODEE)), false);
  const creux = lisse(auVisage(OREILLE_DEDANS)) + lisse(auVisage(sym(OREILLE_DEDANS)));
  const doigts = [...SILLONS, ...SILLONS_ARRIERE].map((m) => lisse(m, false)).join("");
  return (
    <>
      <defs>
        {horsDe("c", lisse(CORPS))}
        {horsDe("a", lisse(AVANT))}
        {horsDe("m", crin)}
        {horsDe("v", visage)}
        {horsDe("o", oreilles)}
      </defs>
      <g clipPath={`url(#${c("m")})`}>
        <g clipPath={`url(#${c("c")})`}>
          <g clipPath={`url(#${c("a")})`}>{point(lisse(AVANT_LOIN))}</g>
        </g>
        <g clipPath={`url(#${c("a")})`}>{point(lisse(CORPS) + lisse(PLI_BRODE, false) + lisse(QUEUE, false))}</g>
        {point(lisse(AVANT))}
        {point(doigts, 10, "12 8")}
      </g>
      {plat(lisse(TOUFFE_BRODEE))}
      <g clipPath={`url(#${c("o")})`}>{point(crin)}</g>
      <g clipPath={`url(#${c("v")})`}>
        <g clipPath={`url(#${c("o")})`}>{point(brins, 10, "26 12")}</g>
      </g>
      {point(oreilles, 10, "14 8")}
      {point(creux, 8, "9 6")}
      {point(traits, 9, "12 7")}
      {point(arcades, 8, "10 6")}
      {plat(yeux)}
      {plat(lisse(auVisage(TRUFFE)))}
    </>
  );
}

function Dessin({ couche, id, photo }: PropsTotem) {
  if (couche === "dos") return <Lion />;
  if (couche === "face-portrait") return <Broderie id={id} photo={photo} />;
  return null;
}

const totem: TotemNation = {
  nation: "sn",
  animal: "lion",
  quoi: "Le lion assis, le corps de profil, la tête de face portée haut sur une crinière en cloche (calotte continue, mèches pendantes au poitrail et à l'épaule), tissé en flottés sur un panneau de toile fine (bords en escalier, jours, quatre teintes jointes par des hachures de tapisserie, la lune qui éclaire le dos) ; brodé au point avant dans le coin du portrait, le visage sans ovale.",
  sources: [
    { titre: "K. Goldfinger, Animal Anatomy for Artists (Oxford University Press, 2004) : planches du lion, squelette et muscles", url: "https://academic.oup.com/book/41965" },
    { titre: "Creative Bloq, How to draw a lion : le lion mâle, du squelette à la forme ; la mâchoire et la pommette sous l'œil", url: "https://www.creativebloq.com/how-to/how-to-draw-a-lion" },
    { titre: "Wacom, Monika Zagrobelna, How to draw a realistic lion : le corps, les os visibles (garrot, hanche, coude, talon), le poitrail de face", url: "https://community.wacom.com/en-us/how-to-draw-lion-monika-zagrobelna" },
    { titre: "Wildlife ACT, Lion whisker spots : les rangs de taches des vibrisses, propres à chaque lion", url: "https://wildlifeact.com/blog/lion-whisker-spots-identifying-individual-lions" },
    { titre: "Lion Landscapes, Identifying lions : la truffe qui se tache avec l'âge, les oreilles, la crinière qui encadre la face", url: "https://www.lionlandscapes.org/post/identifying-lions" },
    { titre: "The Met, Wrapper (Seru Njaago) : les flottés de trame sur bandes étroites, le tissage manjak", url: "https://www.metmuseum.org/art/collection/search/687565" },
    { titre: "American Tapestry Alliance, A. Lane, Glossary of Tapestry Terms : hatching et hachures, les dents de deux couleurs qui alternent d'une passée à l'autre", url: "https://americantapestryalliance.org/wp-content/uploads/2023/06/1-Glossary-of-Tapestry-Terms-Austin-Lane.pdf" },
  ],
  dessine: true,
  boite: BOITE,
  pose: {
    // Le lion (x 92 → 742, y 156 → 950 dans la boîte ; x 103 → 831, y 215 → 1104 à la carte) remplit le panneau (filet 78 → 946, 116 → 1124) ; la lune en haut à droite.
    dos: { x: 0, y: 40, echelle: 1.12, devant: true, lune: LUNE_SENEGAL },
    // Dans le coin bas gauche du portrait, à droite de l'équerre (x 72 → 112), sous le visage (x 116 → 277, y 774 → 969).
    face: { portrait: { x: 96, y: 738, echelle: 0.24 } },
  },
  Dessin,
};

export default totem;
