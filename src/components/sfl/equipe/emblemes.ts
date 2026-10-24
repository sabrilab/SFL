// Les emblèmes des écussons de Bola Team (equipe/ecusson.tsx), dessinés à la
// main dans la boîte de l'écusson (100 × 106, cœur en 50 ; 52) : les figures
// (étoile, ballon, couronne, éclair) et, depuis le 24/10 (Sabri : « il peut
// y avoir aussi des emblèmes, comme des animaux, un cheval »), six animaux
// de club : le cheval, le lion, l'aigle, le loup, le taureau, le coq.
//
// Chacun est taillé comme une pièce de métal frappée : une silhouette (d),
// des facettes tournées vers la lumière (ton 1, en haut à gauche) ou à
// l'ombre (ton -1), et des creux (yeux, naseaux, coutures) gravés dans le
// métal. Les têtes de face sont symétriques (sym()), les profils regardent
// à gauche, comme en héraldique. Aucune image importée : des points.

import type { Embleme } from "@/lib/sfl/blason";

export interface Dessin {
  d: string;
  facettes?: { d: string; ton: 1 | -1 }[];
  creux?: string;
}

type P = [number, number];
const f = (v: number) => Math.round(v * 100) / 100;
const poly = (pts: P[]) => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + "Z";
/** La moitié gauche d'une figure de face, du haut au bas, complétée par symétrie. */
const sym = (gauche: P[]): P[] => [...gauche, ...gauche.slice().reverse().map(([x, y]): P => [100 - x, y])];
const miroir = (pts: P[]): P[] => pts.map(([x, y]) => [100 - x, y]);
const cercle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;

// ---- Les figures ----

// L'étoile à cinq branches, taillée en pointe de diamant : chaque branche a
// une face claire et une face sombre selon la lumière.
const etoile = (() => {
  const c: P = [50, 53];
  const pt = (k: number, r: number): P => {
    const a = ((-90 + k * 36) * Math.PI) / 180;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  };
  const tour = Array.from({ length: 10 }, (_, k) => pt(k, k % 2 === 0 ? 27 : 11));
  const facettes = tour.map((p, k) => {
    const q = tour[(k + 1) % 10];
    const mx = (p[0] + q[0]) / 2 - c[0];
    const my = (p[1] + q[1]) / 2 - c[1];
    const n = Math.hypot(mx, my);
    const lum = (-0.6 * mx - 0.8 * my) / n;
    return { d: poly([c, p, q]), ton: (lum > 0 ? 1 : -1) as 1 | -1, lum };
  });
  return {
    d: poly(tour),
    facettes: facettes.filter((x) => Math.abs(x.lum) > 0.15).map(({ d, ton }) => ({ d, ton })),
  };
})();

// Le ballon : une sphère (un croissant d'ombre, un reflet), le pentagone du
// cœur et ses coutures gravés.
const ballon = (() => {
  const c: P = [50, 53];
  const penta = (r: number, rot: number, cx = c[0], cy = c[1]) =>
    Array.from({ length: 5 }, (_, k): P => {
      const a = ((rot + k * 72) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
  const coeur = penta(8, -90);
  const coutures = coeur.map(([x, y]) => {
    const a = Math.atan2(y - c[1], x - c[0]);
    const [ex, ey] = [c[0] + 21.5 * Math.cos(a), c[1] + 21.5 * Math.sin(a)];
    const nx = -Math.sin(a) * 0.9, ny = Math.cos(a) * 0.9;
    return poly([[x + nx, y + ny], [ex + nx, ey + ny], [ex - nx, ey - ny], [x - nx, y - ny]]);
  });
  // Les pentagones coupés par le bord, entre deux coutures.
  const bords = coeur.map((_, k) => {
    const a = ((-90 + 36 + k * 72) * Math.PI) / 180;
    return poly(penta(6.2, -90 + 36 + k * 72 + 180, c[0] + 22 * Math.cos(a), c[1] + 22 * Math.sin(a)));
  });
  return {
    d: cercle(50, 53, 23),
    facettes: [
      // le croissant d'ombre, en bas à droite (la sphère moins elle-même décalée)
      { d: cercle(50, 53, 23) + cercle(45.5, 48, 23), ton: -1 as const },
      { d: cercle(42, 44, 6.5), ton: 1 as const },
    ],
    creux: poly(coeur) + coutures.join("") + bords.join(""),
  };
})();

// La couronne : trois fleurons perlés sur un bandeau orné de pierres.
const couronne = {
  d:
    poly([[26, 67], [23, 37], [37, 49], [50, 29], [63, 49], [77, 37], [74, 67]]) +
    poly([[25, 70], [75, 70], [75, 79], [25, 79]]) +
    cercle(23, 35, 3.6) +
    cercle(50, 27, 3.8) +
    cercle(77, 35, 3.6),
  facettes: [
    { d: poly([[50, 29], [63, 49], [50, 67]]), ton: -1 as const },
    { d: poly([[50, 29], [37, 49], [50, 67]]), ton: 1 as const },
    { d: poly([[77, 37], [74, 67], [63, 49]]), ton: -1 as const },
    { d: poly([[23, 37], [26, 67], [37, 49]]), ton: 1 as const },
    { d: poly([[25, 75], [75, 75], [75, 79], [25, 79]]), ton: -1 as const },
  ],
  creux: cercle(37, 74.5, 2.2) + poly([[50, 71.6], [53, 74.5], [50, 77.4], [47, 74.5]]) + cercle(63, 74.5, 2.2),
};

// L'éclair : deux lames, chacune claire d'un côté, sombre de l'autre.
const eclair = {
  d: poly([[59, 24], [33, 59], [48, 59], [41, 82], [68, 45], [53, 45]]),
  facettes: [
    { d: poly([[59, 24], [48, 59], [33, 59]]), ton: 1 as const },
    { d: poly([[53, 45], [68, 45], [41, 82]]), ton: -1 as const },
  ],
};

// ---- Les animaux ----

// Le cheval, tête de profil, crinière en mèches.
const cheval = (() => {
  const tour: P[] = [
    [49, 19], [45, 30], [39, 35], [30, 49], [23.5, 59], [27, 64.5], [31, 68.5], [40, 67.5], [48, 63],
    [51, 58.5], [52.5, 70], [54, 85], [77, 85], [76.5, 72], [72.5, 70], [74.5, 59.5], [70, 58], [70.5, 47.5],
    [66, 46], [64.5, 38.5], [60, 38], [57.5, 31.5], [54.5, 31],
  ];
  return {
    d: poly(tour),
    facettes: [
      { d: poly([[45, 30], [39, 35], [30, 49], [36.5, 51.5], [46.5, 40]]), ton: 1 as const },
      { d: poly([[30, 49], [23.5, 59], [27, 64.5], [33, 58.5], [36.5, 51.5]]), ton: 1 as const },
      { d: poly([[27, 64.5], [31, 68.5], [40, 67.5], [33, 58.5]]), ton: -1 as const },
      { d: poly([[48, 63], [51, 58.5], [52.5, 70], [54, 85], [63, 85], [57.5, 62]]), ton: -1 as const },
      { d: poly([[57.5, 31.5], [60, 38], [64.5, 38.5], [66, 46], [70.5, 47.5], [70, 58], [74.5, 59.5], [72.5, 70], [76.5, 72], [77, 85], [70, 85], [68, 66], [63, 50], [56, 38]]), ton: -1 as const },
      { d: poly([[49, 19], [50.5, 29.5], [46.5, 29.5]]), ton: -1 as const },
    ],
    creux: poly([[37, 42.5], [43.5, 40.5], [42, 44.5]]) + poly([[26, 58.5], [29.5, 56], [29.5, 59.5]]),
  };
})();

// Le loup, tête de face : oreilles dressées, joues en touffes, museau étroit.
const loup = (() => {
  const g: P[] = [[50, 35], [41, 38], [30, 20], [25, 43], [20.5, 50], [26.5, 53], [20, 61], [28, 62.5], [25.5, 69.5], [35.5, 73], [42, 81], [50, 85]];
  return {
    d: poly(sym(g)),
    facettes: [
      { d: poly([[30, 20], [41, 38], [33, 41], [27.5, 37]]), ton: 1 as const },
      { d: poly(miroir([[30, 20], [41, 38], [33, 41], [27.5, 37]])), ton: -1 as const },
      { d: poly([[50, 35], [50, 85], [42, 81], [35.5, 73], [44, 60]]), ton: 1 as const },
      { d: poly(miroir([[50, 35], [50, 85], [42, 81], [35.5, 73], [44, 60]])), ton: -1 as const },
      { d: poly(miroir([[25.5, 69.5], [35.5, 73], [44, 60], [28, 62.5]])), ton: -1 as const },
    ],
    creux:
      poly([[34, 51], [44.5, 54], [41.5, 57.5]]) +
      poly(miroir([[34, 51], [44.5, 54], [41.5, 57.5]])) +
      poly([[45, 75.5], [55, 75.5], [50, 81]]),
  };
})();

// Le lion, tête de face : la crinière en flammes qui tournent vers le bas,
// les oreilles rondes, l'arcade, le mufle large et sa bouche.
const lion = (() => {
  const c: P = [50, 52];
  // La moitié gauche de la crinière, du haut (-90°) au bas (90°) par la gauche :
  // chaque mèche pointe un peu vers le bas, comme une flamme qui tombe.
  const moitie: P[] = [];
  const n = 8;
  for (let k = 0; k <= n; k++) {
    const a = ((-90 - (k * 180) / n) * Math.PI) / 180;
    const pointe = ((-90 - (k * 180) / n - 9) * Math.PI) / 180;
    const r = k === 0 ? 30 : k === n ? 33 : 31.5;
    if (k > 0) moitie.push([c[0] + 21.5 * Math.cos(a + (10 * Math.PI) / 180), c[1] + 22 * Math.sin(a + (10 * Math.PI) / 180)]);
    moitie.push([c[0] + r * Math.cos(k === 0 ? a : pointe), c[1] + r * 1.02 * Math.sin(k === 0 ? a : pointe)]);
  }
  const criniere = [...moitie, ...moitie.slice(1, -1).reverse().map(([x, y]): P => [100 - x, y])];
  const visage: P[] = sym([[50, 33], [43, 34.5], [40, 29.5], [34.5, 31.5], [34.5, 38.5], [33.5, 45], [32, 52.5], [34, 60], [38, 67], [42.5, 72], [50, 75.5]]);
  return {
    d: poly(criniere),
    facettes: [
      { d: poly(criniere.slice(0, moitie.length)), ton: 1 as const },
      { d: poly([...moitie.slice(-1), ...criniere.slice(moitie.length)]), ton: -1 as const },
      { d: poly(visage), ton: -1 as const },
      { d: poly([[50, 33], [43, 34.5], [40, 29.5], [34.5, 31.5], [34.5, 38.5], [33.5, 45], [32, 52.5], [34, 60], [38, 67], [42.5, 72], [50, 75.5]]), ton: 1 as const },
      { d: poly([[50, 61], [44.5, 62], [40, 65.5], [41, 70], [45, 72.5], [50, 72]]), ton: 1 as const },
      { d: poly(miroir([[50, 61], [44.5, 62], [40, 65.5], [41, 70], [45, 72.5], [50, 72]])), ton: 1 as const },
      { d: poly([[36, 44], [47, 43.5], [47.5, 46], [37, 47.5]]), ton: -1 as const },
      { d: poly(miroir([[36, 44], [47, 43.5], [47.5, 46], [37, 47.5]])), ton: -1 as const },
    ],
    creux:
      poly([[38.5, 49], [46.5, 49.5], [44, 52.5]]) +
      poly(miroir([[38.5, 49], [46.5, 49.5], [44, 52.5]])) +
      poly([[44.5, 57.5], [55.5, 57.5], [53, 62], [50, 63.5], [47, 62]]) +
      poly([[49.3, 63], [50.7, 63], [50.7, 66.5], [49.3, 66.5]]) +
      poly([[50.7, 66], [55, 68.5], [54.4, 69.6], [50, 67.3], [45.6, 69.6], [45, 68.5], [49.3, 66]]) +
      poly([[39, 31.5], [37, 33.5], [37.5, 37], [40.5, 35]]) +
      poly(miroir([[39, 31.5], [37, 33.5], [37.5, 37], [40.5, 35]])),
  };
})();

// Le taureau, de face : les cornes en croissant, les oreilles, le mufle large.
const taureau = (() => {
  const g: P[] = [
    [50, 36], [41, 36], [33.5, 33], [26, 25.5], [22.5, 17], [20, 26], [24.5, 35.5], [33, 41.5],
    [21, 42.5], [26.5, 48], [35, 48.5], [37.5, 63], [39.5, 72], [37.5, 78.5], [42, 84], [50, 85.5],
  ];
  return {
    d: poly(sym(g)),
    facettes: [
      { d: poly([[22.5, 17], [26, 25.5], [33.5, 33], [41, 36], [33, 41.5], [24.5, 35.5], [20, 26]]), ton: 1 as const },
      { d: poly(miroir([[22.5, 17], [26, 25.5], [33.5, 33], [41, 36], [33, 41.5], [24.5, 35.5], [20, 26]])), ton: -1 as const },
      { d: poly([[50, 36], [50, 73], [39.5, 72], [37.5, 63], [35, 48.5], [41, 36]]), ton: 1 as const },
      { d: poly(miroir([[50, 36], [50, 73], [39.5, 72], [37.5, 63], [35, 48.5], [41, 36]])), ton: -1 as const },
      { d: poly(miroir([[21, 42.5], [26.5, 48], [35, 48.5], [33, 41.5]])), ton: -1 as const },
    ],
    creux:
      poly([[38.5, 52], [45.5, 54], [43, 57]]) +
      poly(miroir([[38.5, 52], [45.5, 54], [43, 57]])) +
      cercle(44.5, 79, 2.3) +
      cercle(55.5, 79, 2.3),
  };
})();

// L'aigle, tête de profil : le bec crochu qui plonge sous la mandibule,
// l'arcade qui couvre l'œil, le cou hérissé de plumes.
const aigle = (() => {
  const tour: P[] = [
    [47, 24], [60, 24.5], [69, 29], [74, 38], [71.5, 41], [78, 49], [71, 51], [77, 60], [69.5, 61], [74.5, 71],
    [66, 69], [68.5, 82], [60, 74], [54, 84], [51, 70], [46, 63.5], [41, 60.5], [35, 59.5], [31, 59.5], [29.6, 57.2],
    [27.4, 62.5], [23.4, 58.4], [21.6, 51], [24.2, 43.6], [30.4, 37], [37.5, 32.2], [42, 28.6],
  ];
  return {
    d: poly(tour),
    facettes: [
      { d: poly([[42, 28.6], [37.5, 32.2], [30.4, 37], [24.2, 43.6], [21.6, 51], [30, 50.2], [41.5, 40], [47, 33]]), ton: 1 as const },
      { d: poly([[21.6, 51], [23.4, 58.4], [27.4, 62.5], [29.6, 57.2], [30, 50.2]]), ton: -1 as const },
      { d: poly([[47, 24], [60, 24.5], [69, 29], [62, 36], [52, 33], [47, 33], [42, 28.6]]), ton: 1 as const },
      { d: poly([[40.5, 35.4], [53.5, 32.6], [52.6, 36.4], [42.6, 38.6]]), ton: -1 as const },
      { d: poly([[41, 60.5], [46, 63.5], [51, 70], [54, 84], [60, 74], [58, 56], [50, 50]]), ton: -1 as const },
      { d: poly([[74, 38], [71.5, 41], [78, 49], [71, 51], [77, 60], [69.5, 61], [74.5, 71], [66, 69], [68.5, 82], [62, 64], [64, 46], [69, 29]]), ton: -1 as const },
    ],
    creux:
      poly([[45, 38.8], [51.6, 37.4], [49.6, 41.2]]) +
      poly([[30.2, 56.4], [41.2, 59.4], [41, 60.6], [30, 58]]) +
      poly([[31.5, 41.2], [35.5, 40], [34.2, 42.6]]),
  };
})();

// Le coq, debout : la crête, le bec, le barbillon, le poitrail, trois
// faucilles de queue, les pattes.
const coq = (() => {
  const tour: P[] = [
    [37, 23], [40, 27.5], [42.5, 21.5], [45.5, 27], [49, 22], [50, 29], [47.5, 34], [49.5, 40], [56, 46], [61.5, 44.5],
    // les trois faucilles, de la plus haute à la plus basse
    [62, 34], [66.5, 24.5], [74, 19.5], [69.5, 27], [68.5, 36.5], [74, 29], [82, 27.5], [75.5, 33.5], [73, 41.5],
    [80, 38.5], [86, 41.5], [78.5, 44.5], [75.5, 51],
    [70.5, 61], [61.5, 68], [58, 69.5], [60, 80], [64.5, 82.5], [55.5, 82.5], [54.5, 70], [49.5, 70], [50.5, 80],
    [55, 82.5], [46, 82.5], [45.5, 69], [38.5, 63.5], [35.5, 54], [37.5, 45.5], [36.5, 41], [32.5, 41.5], [34, 39],
    [27, 37.5], [34, 35], [35.5, 29],
  ];
  return {
    d: poly(tour),
    facettes: [
      { d: poly([[37, 23], [40, 27.5], [42.5, 21.5], [45.5, 27], [49, 22], [50, 29], [44, 30], [35.5, 29]]), ton: -1 as const },
      { d: poly([[62, 34], [66.5, 24.5], [74, 19.5], [69.5, 27], [68.5, 36.5], [74, 29], [82, 27.5], [75.5, 33.5], [73, 41.5], [80, 38.5], [86, 41.5], [78.5, 44.5], [75.5, 51], [66, 45]]), ton: -1 as const },
      { d: poly([[47.5, 34], [49.5, 40], [56, 46], [50, 56], [42, 56], [37.5, 45.5]]), ton: 1 as const },
      { d: poly([[56, 46], [61.5, 44.5], [66, 45], [75.5, 51], [70.5, 61], [61.5, 68], [58, 69.5], [50, 56]]), ton: -1 as const },
    ],
    creux:
      cercle(42, 30.8, 1.6) +
      poly([[34.5, 38.6], [37.2, 36.6], [37.6, 43.5], [35.4, 44.5]]) +
      poly([[66.6, 36], [70.5, 29.5], [71, 30], [67.6, 36.6]]) +
      poly([[72.4, 42.5], [78, 36.8], [78.6, 37.4], [73.4, 43.2]]),
  };
})();

export const DESSINS: Record<Exclude<Embleme, "initiales">, Dessin> = {
  etoile,
  ballon,
  couronne,
  eclair,
  cheval,
  lion,
  aigle,
  loup,
  taureau,
  coq,
};
