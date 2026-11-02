// Le totem du Maroc (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe […] le Maroc, c'est les lions de l'Atlas »).
//
// Le lion de l'Atlas (le lion de Barbarie) qui marche, de profil, vers la
// gauche, la tête portée haut : la patte avant proche levée, le poignet
// plié au-dessus du sol, la lointaine posée ; la patte arrière proche posée
// sous la hanche, le jarret net, la lointaine tendue en arrière, le talon
// levé ; la queue basse et sa touffe. Les proportions d'un mâle : le tronc
// 1,25 fois la hauteur au garrot, les coudes à 0,4 de cette hauteur, un
// museau court, haut et carré (de la truffe à l'œil, 0,7 fois la hauteur
// de la tête), l'arête du nez à peine bombée, l'arcade lourde.
// La crinière est celle de l'Atlas : sombre, ample, en rangs de mèches qui
// partent de la joue, de la nuque, de l'épaule et du poitrail et tombent
// vers l'arrière, une mèche au-dessus du front, la frange qui court sous le
// ventre jusqu'à l'aine ; une fraise fauve claire encadre le visage.
// Il est taillé en zellige (../maroc.tsx) : chaque mèche, chaque muscle est
// une pièce d'émail, bisautée (l'arête prend la lumière en haut à gauche,
// l'ombre en bas à droite), prise dans un joint de chaux de 4,5 ; les
// pièces du corps suivent l'anatomie (le grill costal, le flanc, la cuisse,
// la jambe, le canon et le pied) ; l'émail s'use (craquelures et piqûres,
// tirées de la graine), la silhouette ne bouge jamais.
//   · au dos : le héros. Il marche dans une niche de tadelakt (NICHE_MAROC),
//     posé sur le bandeau du logotype ; la lune et sa rosace de cèdre sont
//     montées au-dessus de lui, dans le panneau d'étoiles (LUNE_MAROC) ;
//   · à la face : le même lion, gaufré dans le coin bas du portrait, tourné
//     vers le joueur : une arête de lumière, une ombre, sans couleur, les
//     arêtes cachées coupées.
// Les tracés sont des points posés à la main, liés en béziers tendus
// (lisse), et des mèches posées une à une (meche : la racine, la direction
// de départ et d'arrivée, la longueur, la largeur).

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
 * la direction a2, longue de l (la corde), large de w à la racine ; elle
 * s'effile en pointe. Les mèches qui tombent ont a2 plus bas que a1.
 */
type Meche = readonly [x: number, y: number, a1: number, a2: number, l: number, w: number];
function meche([x, y, a1, a2, l, w]: Meche): string {
  const rad = (a: number) => (a * Math.PI) / 180;
  const ac = rad((a1 + a2) / 2);
  const [tx, ty] = [x + l * Math.cos(ac), y + l * Math.sin(ac)];
  const p1 = [x + (l / 3) * Math.cos(rad(a1)), y + (l / 3) * Math.sin(rad(a1))];
  const p2 = [tx - (l / 3) * Math.cos(rad(a2)), ty - (l / 3) * Math.sin(rad(a2))];
  const at = (t: number, k: 0 | 1) => {
    const u = 1 - t;
    const [a, b, c, e] = k ? [y, p1[1], p2[1], ty] : [x, p1[0], p2[0], tx];
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * e;
  };
  const normale = (t: number) => {
    const u = 1 - t;
    const dx = 3 * u * u * (p1[0] - x) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (tx - p2[0]);
    const dy = 3 * u * u * (p1[1] - y) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (ty - p2[1]);
    const n = Math.hypot(dx, dy) || 1;
    return [dy / n, -dx / n];
  };
  const m = 0.14;
  const demi = (t: number) => (w / 2) * (t < m ? 0.82 + 0.18 * Math.sin(((t / m) * Math.PI) / 2) : ((1 - t) / (1 - m)) ** 0.8);
  const ts = [0, 0.12, 0.26, 0.42, 0.58, 0.73, 0.86, 0.94];
  const cote = (s: number): P[] =>
    ts.map((t) => {
      const [nx, ny] = normale(t);
      const h = demi(t) * s;
      return [at(t, 0) + nx * h, at(t, 1) + ny * h];
    });
  const g = cote(1);
  const d = cote(-1).reverse();
  return lisse([[g[0][0], g[0][1], 1], ...g.slice(1), [tx, ty, 2], ...d.slice(0, -1), [d[d.length - 1][0], d[d.length - 1][1], 1]]);
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
const DOIGTS = "M660 600C660 590 664 584 670 580M676 600C676 590 680 584 686 581M798 600C798 592 800 587 804 584M314 600C313 590 317 583 323 579M330 600C330 591 334 585 340 581M276 566C282 562 286 556 287 548M290 567C296 562 299 556 300 549";

/** La patte arrière lointaine, tendue en arrière, le talon levé ; son canon, son pied. */
const ARRIERE_LOIN = lisse([[688, 430], [742, 428], [764, 452], [780, 474], [786, 498], [794, 530], [808, 562], [822, 586], [826, 600, 1], [786, 600, 1], [782, 588], [770, 562], [756, 532], [740, 500], [716, 470], [694, 450]]);
/** Le jarret lointain : la jambe et le canon, coupés en biais par le talon. */
const ARRIERE_LOIN_CANON = lisse([[700, 540, 1], [738, 506], [770, 488], [792, 482, 1], [860, 486, 1], [860, 640, 1], [700, 640, 1]]);

/** La patte avant lointaine, posée ; son pied. */
const AVANT_LOIN = lisse([[326, 430], [380, 432], [378, 478], [368, 520], [362, 546, 2], [368, 566], [374, 586], [370, 600, 1], [298, 600, 1], [294, 588], [304, 576], [322, 570], [334, 552], [332, 500], [326, 462]]);


/** La patte avant proche, levée : l'avant-bras qui file en avant, le poignet plié, le pied replié dessous. */
const AVANT = lisse([[300, 444], [366, 456], [352, 482], [324, 502], [302, 520, 2], [308, 534], [310, 550], [302, 564], [286, 568], [272, 558], [266, 540], [264, 524, 2], [274, 498], [288, 470]]);
/** Le poignet plié : le pied, coupé de l'avant-bras par le pli. */
const AVANT_PIED = lisse([[240, 540, 1], [258, 528], [276, 518], [304, 516, 1], [340, 520, 1], [340, 600, 1], [240, 600, 1]]);

/** La queue, basse, en deux pièces, et sa touffe. */
const QUEUE = lisse([[718, 258], [760, 270], [796, 302], [820, 352], [834, 410], [840, 446], [828, 448], [820, 412], [806, 362], [784, 318], [752, 294], [714, 288]]);
const QUEUE_BOUT = lisse([[790, 340, 1], [830, 330, 1], [880, 470, 1], [800, 470, 1]]);
const TOUFFE = lisse([[828, 436], [846, 440], [856, 466], [852, 494], [836, 504], [822, 490], [820, 460]]);

/* -------------------------------- La tête -------------------------------- */

/**
 * La tête, dessinée dans son repère (la truffe à gauche), posée par tete() :
 * le bout du museau vertical, la truffe en haut, la lèvre supérieure gonflée
 * qui tombe dessous, le menton en retrait ; l'arête du nez à peine bombée,
 * le stop sous l'arcade lourde, le front qui file sous le toupet.
 */
const tete = (pts: readonly P[]): P[] => pts.map((p) => (p.length === 3 ? [p[0] * 1.14 + 68.2, p[1] * 1.14 + 185.6, p[2]] : [p[0] * 1.14 + 68.2, p[1] * 1.14 + 185.6]));
const TETE = lisse(tete([[47, 84, 1], [64, 77], [88, 68], [104, 61], [116, 52], [132, 42], [150, 36], [166, 56], [176, 92], [176, 126], [166, 150], [146, 160], [118, 160], [92, 156], [76, 150], [66, 143], [58, 136], [53, 126], [50, 112], [49, 100]]));
/** La joue : la pièce derrière le coussinet, du coin de l'œil au coin de la gueule, jusqu'à la mâchoire. */
const JOUE_T = lisse(tete([[136, 64], [142, 90], [134, 114], [118, 134], [126, 166, 1], [200, 166, 1], [200, 50, 1]]));
const MUSEAU = lisse(tete([[50, 102], [60, 96], [76, 96], [94, 102], [108, 112], [114, 124], [108, 134], [88, 139], [70, 139], [59, 133], [53, 120]]));
const MENTON = lisse(tete([[66, 141], [84, 142], [104, 140], [118, 136], [124, 148], [110, 156], [90, 155], [74, 149]]));

const TRUFFE = lisse(tete([[47, 84, 1], [66, 78], [74, 80], [72, 88], [64, 94], [56, 98], [49, 99], [45, 92]]));
const OEIL = lisse(tete([[104, 71], [113, 63.5], [126, 61], [134, 63.5], [125, 70.5], [113, 73]]));
const IRIS = lisse(tete([[115, 67], [120.5, 63.5], [126.5, 64], [126, 69], [119.5, 70]]));
const PUPILLE = lisse(tete([[119.5, 66.8], [121.5, 65], [123.5, 66.5], [121.8, 68.6]]));
const ARCADE = lisse(tete([[100, 60], [116, 54], [136, 54]]), false);
const LEVRE = lisse(tete([[62, 137], [82, 140], [102, 137], [114, 131]]), false);
/** Les vibrisses : trois rangs de piqûres sur le coussinet. */
const VIBRISSES = tete([[64, 110], [75, 111], [86, 115], [70, 120], [81, 123], [92, 127]])
  .map(([x, y]) => `M${f(x)} ${f(y)}h.1`)
  .join("");

/* ------------------------------ La crinière ------------------------------ */

// Les rangs, de l'arrière vers l'avant (le rang d'avant recouvre les racines du suivant) :
// [racine x, y, direction de départ, d'arrivée, longueur, largeur], posés un à un.
/** La frange sous le ventre, jusqu'à l'aine : des longueurs inégales, sur deux couches. */
const FRANGE: Meche[] = [
  [420, 420, 76, 104, 80, 30], [452, 422, 64, 96, 62, 26], [480, 420, 72, 102, 74, 28], [508, 420, 60, 92, 54, 24],
  [534, 418, 70, 100, 62, 26], [560, 414, 58, 90, 48, 22], [586, 410, 64, 94, 44, 20], [608, 404, 52, 82, 32, 18],
  [436, 420, 60, 92, 50, 26], [494, 418, 56, 88, 44, 24], [548, 414, 54, 84, 38, 22],
];
/** La pèlerine : du garrot sur l'épaule, jusqu'au coude. */
const PELERINE: Meche[] = [
  [360, 212, -18, 26, 150, 40], [372, 226, -8, 36, 160, 42], [384, 244, 2, 46, 162, 42], [394, 266, 12, 56, 160, 42], [402, 292, 22, 64, 156, 42],
  [406, 320, 32, 72, 146, 42], [404, 348, 42, 80, 134, 40], [398, 374, 52, 88, 116, 38], [386, 398, 62, 94, 96, 34],
];
/** La nuque et le cou, jusqu'au poitrail. */
const NUQUE: Meche[] = [
  [288, 196, -34, 8, 118, 36], [304, 196, -28, 14, 134, 38], [320, 206, -20, 22, 146, 40], [334, 226, -14, 30, 150, 40], [344, 252, -2, 42, 150, 40], [348, 280, 10, 54, 146, 40],
  [348, 310, 22, 64, 138, 40], [342, 338, 36, 74, 128, 38], [330, 364, 50, 84, 114, 36], [314, 388, 62, 90, 100, 34], [294, 404, 74, 96, 86, 32],
];
/** Derrière la fraise : du toupet, au-dessus du front, à la gorge. */
const JOUE: Meche[] = [
  [244, 220, -96, -40, 66, 30], [254, 212, -52, 4, 86, 32], [266, 214, -36, 12, 98, 34], [278, 228, -24, 22, 106, 34], [286, 248, -16, 32, 108, 34], [290, 270, -2, 46, 108, 34],
  [290, 294, 12, 58, 106, 34], [286, 318, 24, 68, 104, 34], [278, 340, 38, 78, 100, 34], [264, 360, 52, 88, 96, 32], [248, 376, 66, 96, 90, 32], [228, 386, 80, 100, 84, 30],
  [206, 390, 92, 104, 74, 28], [186, 386, 102, 110, 62, 26],
];
/** La fraise, fauve claire : des mèches couchées le long du visage, de la gorge au front. */
const FRAISE: Meche[] = [
  [174, 356, 100, 122, 40, 24], [186, 358, 94, 118, 46, 26], [200, 357, 88, 114, 52, 28], [214, 353, 80, 108, 58, 30], [228, 345, 70, 102, 62, 32], [240, 332, 58, 96, 66, 32],
  [248, 316, 46, 90, 68, 32], [253, 298, 34, 84, 70, 32], [255, 278, 22, 76, 70, 32], [254, 258, 10, 68, 68, 32], [249, 242, -6, 58, 64, 30], [240, 234, -28, 44, 58, 28], [228, 236, -64, 18, 50, 26],
];
/** Le fond de la crinière, sous les mèches. */
const FOND_CRINIERE = lisse([[240, 226], [290, 200], [350, 200], [420, 220], [460, 250], [470, 300], [456, 360], [430, 410], [390, 430], [330, 446], [260, 440], [210, 410], [200, 380], [240, 340]]);

const M = { frange: FRANGE.map(meche), pelerine: PELERINE.map(meche), nuque: NUQUE.map(meche), joue: JOUE.map(meche), fraise: FRAISE.map(meche) };

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
const CRIN = ["#1b1d1e", "#151718", "#203f34", "#1d2220", "#18201c", "#26473a", "#141616", "#1f2523", "#2a4a3c"];
/** La teinte de chaque mèche : un indice de CRIN, posé à la main pour que les verts tombent de loin en loin. */
const TEINTES = [0, 3, 2, 1, 4, 0, 7, 5, 3, 1, 6, 8, 0, 4, 2, 7, 1, 3];
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
      {/* La frange du ventre. */}
      <path d={FOND_CRINIERE} fill={CRIN[6]} />
      {meches(M.frange, "fr", CRIN)}
      <Joints d={M.frange.join("")} />
      {/* La patte avant proche, levée. */}
      <Piece d={AVANT} couleur={EMAIL.cage} id={c("av0")} />
      <Piece d={AVANT_PIED} couleur={EMAIL.canon} id={c("av1")} dans={c("av")} />
      <Joints d={AVANT_PIED} dans={c("av")} />
      <Joints d={AVANT} />
      <path d={DOIGTS} fill="none" stroke={CHAUX} strokeWidth={3.2} strokeLinecap="round" />
      {/* La crinière, rang par rang, de l'épaule vers le visage. */}
      {meches(M.pelerine, "pe", CRIN, 5)}
      <Joints d={M.pelerine.join("")} />
      {meches(M.nuque, "nu", CRIN, 9)}
      <Joints d={M.nuque.join("")} />
      {meches(M.joue, "jo", CRIN, 13)}
      <Joints d={M.joue.join("")} />
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
        <path d={ARCADE} strokeWidth={5} />
        <path d={LEVRE} strokeWidth={3.2} />

        <path d={VIBRISSES} strokeWidth={3.4} stroke="#4a3725" />
      </g>
      <path d={u.piqures} stroke={CHAUX} strokeOpacity={0.7} strokeWidth={2.2} strokeLinecap="round" clipPath={`url(#${c("corps")})`} />
    </g>
  );
}

/* ------------------------------- Le gaufrage ------------------------------ */

/**
 * Le contour de la crinière pour le gaufrage, posé à la main sur les pointes
 * des mèches (1) et les creux entre elles : du front, par la nuque et le dos,
 * la frange du ventre jusqu'à l'aine, puis le poitrail et la gorge.
 */
const CONTOUR_CRINIERE = lisse([
  [236, 238], [262, 170, 1], [284, 194], [333, 176, 1], [352, 194], [402, 170, 1], [418, 188], [438, 182, 1], [450, 202], [468, 210, 1], [480, 226],
  [510, 224, 1], [506, 246], [526, 266, 1], [514, 290], [530, 312, 1], [516, 334], [526, 356, 1], [508, 378], [514, 398, 1], [498, 414], [530, 422], [600, 412],
  [624, 418, 1], [620, 434, 1], [604, 436], [594, 452, 1], [582, 440], [572, 460, 1], [556, 446], [540, 480, 1], [528, 452], [521, 472, 1], [502, 452], [484, 494, 1],
  [470, 462], [463, 483, 1], [440, 462], [420, 500, 1], [404, 470], [376, 468, 1], [356, 462], [338, 485, 1], [320, 466], [301, 490, 1], [284, 460], [262, 466, 1],
  [246, 452], [228, 470, 1], [212, 452], [196, 463, 1], [182, 444], [169, 446, 1], [184, 404], [212, 378], [240, 350], [254, 310], [256, 272], [250, 248],
]);

/** La ligne médiane d'une mèche : un brin, pour graver le sens du poil. */
function brin([x, y, a1, a2, l]: Meche): string {
  const rad = (a: number) => (a * Math.PI) / 180;
  const ac = rad((a1 + a2) / 2);
  const [tx, ty] = [x + l * Math.cos(ac), y + l * Math.sin(ac)];
  return `M${f(x)} ${f(y)}C${f(x + (l / 3) * Math.cos(rad(a1)))} ${f(y + (l / 3) * Math.sin(rad(a1)))} ${f(tx - (l / 3) * Math.cos(rad(a2)))} ${f(ty - (l / 3) * Math.sin(rad(a2)))} ${f(tx - (l / 10) * Math.cos(rad(a2)))} ${f(ty - (l / 10) * Math.sin(rad(a2)))}`;
}
/** Quelques brins, du cou à l'épaule. */
const BRINS = [JOUE[3], JOUE[7], JOUE[10], NUQUE[2], NUQUE[5], NUQUE[8], PELERINE[1], PELERINE[4], PELERINE[7]].map(brin).join("");

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
  quoi: "Le lion de l'Atlas qui marche, la patte levée, sa crinière sombre en rangs de mèches jusque sous le ventre, taillé en pièces de zellige bisautées ; gaufré dans le coin du portrait.",
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
