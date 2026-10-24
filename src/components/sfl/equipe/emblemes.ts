// Les emblèmes des écussons de Bola Team (equipe/ecusson.tsx), dessinés à la
// main dans la boîte de l'écusson (100 × 106, cœur en 50 ; 53).
//
// Depuis le 24/10 au soir (Sabri : « les animaux des écussons […] avec des
// formes plus minimalistes, plus classiques qu'enfantines », et « mettre
// autre chose que des têtes de lion ou des animaux, comme des logos de
// forme »), tout est dessiné comme un insigne de club d'aujourd'hui : une
// seule pièce de métal, des courbes tendues, et les détails taillés à jour
// dans la pièce (œil, naseau, crinière, plumes) : on voit le fond de
// l'écusson au travers, comme sur un logo découpé. Plus de facettes.
//
// Trois familles (lib/sfl/blason.ts, EMBLEMES) :
//   · les figures : étoile, ballon, couronne, éclair ;
//   · les formes, des logos géométriques : lune (le croissant des phases
//     du logo BOLA), anneau, losange, chevrons, bandes, delta, hexagone,
//     damier ;
//   · les animaux : cheval, lion, aigle, loup, taureau, coq. Les profils
//     regardent à gauche, comme en héraldique ; les têtes de face sont
//     symétriques (sym()).
// Une figure se lit en règle « pair-impair » (evenodd) : chaque contour
// posé dans un autre le creuse, un troisième le remplit à nouveau. Aucune
// image importée : des points et des courbes.

import type { Embleme } from "@/lib/sfl/blason";

export interface Dessin {
  /** La pièce, ses jours compris (evenodd). */
  d: string;
  /** Des gravures en creux, sans percer la pièce (le ballon, la couronne). */
  creux?: string;
}

type P = [number, number];
const f = (v: number) => Math.round(v * 100) / 100;
const poly = (pts: P[]) => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + "Z";
/** La moitié gauche d'une figure de face, du haut au bas, complétée par symétrie. */
const sym = (gauche: P[]): P[] => [...gauche, ...gauche.slice().reverse().map(([x, y]): P => [100 - x, y])];
const miroir = (pts: P[]): P[] => pts.map(([x, y]) => [100 - x, y]);
const cercle = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}A${r} ${r} 0 1 0 ${f(cx + r)} ${f(cy)}A${r} ${r} 0 1 0 ${f(cx - r)} ${f(cy)}Z`;
/** Une courbe de Bézier cubique en points (sans le premier), pour dessiner en courbes ce qu'on symétrise. */
const bez = (a: P, b: P, c: P, d: P, n = 8): P[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n;
    const u = 1 - t;
    return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]];
  });
/** Une forme rapprochée de son centre (pour un jour qui suit le contour). */
const reduit = (pts: P[], k: number, c: P = [50, 53]): P[] => pts.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]);
const polygone = (n: number, r: number, rot: number, c: P = [50, 53]): P[] =>
  Array.from({ length: n }, (_, k) => {
    const a = ((rot + (k * 360) / n) * Math.PI) / 180;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  });

// ---- Les figures ----

const etoile = { d: poly(Array.from({ length: 10 }, (_, k) => polygone(10, k % 2 === 0 ? 27 : 11, -90)[k])) };

// Le ballon : le pentagone du cœur et ses coutures, gravés.
const ballon = (() => {
  const c: P = [50, 53];
  const coeur = polygone(5, 8, -90);
  const coutures = coeur.map(([x, y]) => {
    const a = Math.atan2(y - c[1], x - c[0]);
    const [ex, ey] = [c[0] + 21.5 * Math.cos(a), c[1] + 21.5 * Math.sin(a)];
    const nx = -Math.sin(a) * 0.9, ny = Math.cos(a) * 0.9;
    return poly([[x + nx, y + ny], [ex + nx, ey + ny], [ex - nx, ey - ny], [x - nx, y - ny]]);
  });
  const bords = coeur.map((_, k) => {
    const a = ((-90 + 36 + k * 72) * Math.PI) / 180;
    return poly(polygone(5, 6.2, -90 + 36 + k * 72 + 180, [c[0] + 22 * Math.cos(a), c[1] + 22 * Math.sin(a)]));
  });
  return { d: cercle(50, 53, 23), creux: poly(coeur) + coutures.join("") + bords.join("") };
})();

// La couronne : trois fleurons sur un bandeau, le bandeau détaché à jour.
const couronne = {
  d:
    poly([[26, 66], [23, 38], [37, 50], [50, 30], [63, 50], [77, 38], [74, 66]]) +
    poly([[25, 70], [75, 70], [75, 78], [25, 78]]) +
    cercle(23, 35, 3.4) +
    cercle(50, 26.5, 3.6) +
    cercle(77, 35, 3.4),
  creux: cercle(37, 74, 1.9) + poly([[50, 71.4], [52.6, 74], [50, 76.6], [47.4, 74]]) + cercle(63, 74, 1.9),
};

const eclair = { d: poly([[59, 24], [33, 59], [48, 59], [41, 82], [68, 45], [53, 45]]) };

// ---- Les formes ----

// La lune : le croissant des phases du logo BOLA, ouvert à droite.
const lune = (() => {
  const [cx, cy, r] = [50, 53, 25];
  const [dx, r2] = [11, 21];
  // Les deux pointes : où les deux cercles se croisent.
  const x = (dx * dx + r * r - r2 * r2) / (2 * dx);
  const y = Math.sqrt(r * r - x * x);
  const h: P = [cx + x, cy - y];
  const b: P = [cx + x, cy + y];
  return { d: `M${f(h[0])} ${f(h[1])}A${r} ${r} 0 1 0 ${f(b[0])} ${f(b[1])}A${r2} ${r2} 0 1 1 ${f(h[0])} ${f(h[1])}Z` };
})();

const anneau = { d: cercle(50, 53, 25) + cercle(50, 53, 17) + cercle(50, 53, 7.5) };

const losange = (() => {
  const l = (k: number) => reduit([[50, 23], [75, 53], [50, 83], [25, 53]], k);
  return { d: poly(l(1)) + poly(l(0.78)) + poly(l(0.5)) };
})();

// Trois chevrons qui montent.
const chevrons = {
  d: [0, 1, 2]
    .map((i) => {
      const y = 31 + i * 15;
      return poly([[50, y], [75, y + 15], [75, y + 25], [50, y + 10], [25, y + 25], [25, y + 15]]);
    })
    .join(""),
};

// Trois bandes en biais, coupées droit en haut et en bas.
const bandes = {
  d: [-1, 0, 1]
    .map((i) => {
      const x = 50 + i * 15.5;
      return poly([[x - 1, 26], [x + 9, 26], [x + 1, 80], [x - 9, 80]]);
    })
    .join(""),
};

// Le delta : un triangle et son jour, une pointe pleine au cœur.
const delta = (() => {
  const t = (k: number) => reduit([[50, 22], [78, 76], [22, 76]], k, [50, 58]);
  return { d: poly(t(1)) + poly(t(0.72)) + poly(t(0.34)) };
})();

const hexagone = (() => ({ d: poly(polygone(6, 27, -90)) + poly(polygone(6, 20, -90)) + poly(polygone(6, 12, -90)) }))();

// Le damier : un carré sur la pointe, cinq cases pleines sur neuf.
const damier = (() => {
  const c = 50, m = 53, s = 12.7; // le côté d'une case (sur la pointe : sa diagonale fait s√2)
  const u = s / Math.SQRT2;
  const caseEn = (i: number, j: number) => {
    // (i, j) dans le carré, de -1 à 1 ; le carré est tourné de 45°.
    const x = c + (i - j) * u;
    const y = m + (i + j) * u;
    return poly([[x, y - u], [x + u, y], [x, y + u], [x - u, y]]);
  };
  const pleines = [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]].map(([i, j]) => caseEn(i, j)).join("");
  const bord = reduit([[c, m - 3 * u - 3.4], [c + 3 * u + 3.4, m], [c, m + 3 * u + 3.4], [c - 3 * u - 3.4, m]], 1);
  const jour = reduit(bord, (3 * u + 1.2) / (3 * u + 3.4), [c, m]);
  return { d: poly(bord) + poly(jour) + pleines };
})();

// ---- Les animaux ----

// Le cheval, tête et encolure de profil, la tête qui plonge : la crinière
// en mèches sur le bord de l'encolure, détachée d'un trait ; l'œil, le
// naseau et la ganache taillés à jour.
const cheval = {
  d:
    poly([
      [50, 15.5], [55.6, 27.6],
      [66, 32.4], [64, 36.4], [71.6, 41.2], [68.8, 44.6], [75.6, 51.6], [72.6, 54.8], [78.2, 63.4], [75.2, 66.4], [79, 76.4], [78.4, 86],
      [52.4, 86],
      ...bez([52.4, 86], [52.4, 78.6], [51.4, 72.4], [49.2, 67.4], 5),
      ...bez([49.2, 67.4], [47.6, 70.6], [42.6, 70.6], [38.4, 70.8], 4),
      [34.6, 71.4], [33.4, 69.8], [31.6, 72.2],
      ...bez([31.6, 72.2], [27.2, 73.6], [22.4, 71.4], [22.6, 66.4], 5),
      ...bez([22.6, 66.4], [24.6, 55.4], [34.6, 39.6], [44.6, 29.8], 7),
      [47.6, 27.4],
    ]) +
    // la crinière, détachée de l'encolure
    "M57.8 32.4C64.8 41.4 69.6 56.6 70.4 86H68C67.2 58 62.6 43.6 56 34.2Z" +
    // l'œil, le naseau, la ganache
    poly([[38.6, 42.6], [45.6, 38.8], [44.6, 43.2]]) +
    "M25.2 64.8C25.8 62.4 27.6 61 29.6 61.2C28.8 63 27.4 64.4 25.2 64.8Z" +
    "M50.2 63.6C49.6 55.6 45.4 50 38.8 49.2C44 51.6 47.4 56.6 47.8 64.2Z",
};

// Le loup, tête de profil, taillé droit : l'oreille dressée, le museau long,
// la collerette en pointes.
const loup = {
  d:
    poly([
      [55, 16.5], [62.5, 32], [71, 39.5], [77, 51], [79.5, 64], [73.5, 66], [77.5, 75], [69.5, 74], [71, 84.5],
      [62, 78.5], [57, 86.5], [53, 75.5], [46, 69.5], [37.5, 65], [31, 62.5], [24.5, 59], [20.5, 55.5],
      [33.5, 46.5], [41, 40], [45.5, 31.5], [49.5, 29],
    ]) +
    // l'œil, la gueule, l'oreille, la joue
    poly([[40.5, 43.4], [49.4, 40.6], [45.6, 45]]) +
    poly([[23.6, 57.6], [37.6, 61.6], [37.2, 63.2]]) +
    poly([[54.6, 23], [59.2, 32.4], [54.2, 31.6]]) +
    "M56.6 40.4C63.4 47.4 65 57.4 61.8 68.4L59.8 67.8C62.6 57.8 61 48.6 55 42Z",
};

// Le lion, tête de face : la crinière en mèches rondes, plus longues sous
// le menton, détachée du masque par un jour ; l'arcade, les yeux, le mufle
// et la bouche taillés dans le masque.
const lion = (() => {
  const c: P = [50, 53];
  const n = 12;
  const pt = (deg: number, r: number) => `${f(c[0] + r * Math.cos((deg * Math.PI) / 180))} ${f(c[1] + r * Math.sin((deg * Math.PI) / 180))}`;
  const bas = (deg: number) => Math.max(0, Math.sin((deg * Math.PI) / 180));
  // Chaque mèche part d'un creux, s'enfle et finit en pointe tournée vers le
  // bas (vers la droite à droite, vers la gauche à gauche), comme une flamme
  // qui retombe ; celle du sommet reste droite.
  let criniere = "";
  for (let k = 0; k < n; k++) {
    const a = -90 - 180 / n + (k * 360) / n;
    const b = a + 360 / n;
    const m = (a + b) / 2;
    const cote = Math.abs(Math.cos((m * Math.PI) / 180)) < 0.2 ? 0 : Math.sign(Math.cos((m * Math.PI) / 180));
    const R = 30.5 + 4 * bas(m);
    const pointe = m + 9 * cote;
    const ra = 23.5 + 2 * bas(a), rb = 23.5 + 2 * bas(b);
    criniere +=
      (k === 0 ? "M" + pt(a, ra) : "") +
      `Q${pt((a + pointe) / 2 - 4 * cote, R + 1.5)} ${pt(pointe, R)}` +
      `Q${pt((pointe + b) / 2, R - 4.5)} ${pt(b, rb)}`;
  }
  criniere += "Z";
  const masque: P[] = sym([[50, 32.5], [44, 33], [38.5, 34.5], [35.2, 39.5], [34.4, 46], [35.4, 53], [37.8, 60], [41.4, 66.5], [45.4, 71], [50, 73]]);
  const jour = reduit(masque, 1.15, [50, 52.5]);
  const oeil: P[] = [[37.6, 46.6], [46.8, 47.6], [43.6, 51.4]];
  const arcade: P[] = [[39.6, 41.6], [48, 42.6], [48, 44.2], [39, 43.8]];
  return {
    d:
      criniere +
      poly(jour) +
      poly(masque) +
      poly(oeil) +
      poly(miroir(oeil)) +
      poly(arcade) +
      poly(miroir(arcade)) +
      poly([[43.8, 57.2], [56.2, 57.2], [50, 63.6]]) +
      poly([[49.2, 63], [50.8, 63], [50.8, 65.6], [56.4, 68.6], [55.8, 70], [50, 67], [44.2, 70], [43.6, 68.6], [49.2, 65.6]]),
  };
})();

// Le taureau, de face : les cornes en croissant, les oreilles, le mufle.
const taureau = (() => {
  const g: P[] = [
    [50, 37],
    [42, 36.5],
    ...bez([42, 36.5], [35, 35], [27.5, 30], [25, 17.5], 7),
    ...bez([25, 17.5], [19.5, 25], [19.5, 34], [29.5, 41.5], 7),
    [20.5, 42.5], [24.5, 47.5], [34.5, 48],
    ...bez([34.5, 48], [36, 58], [39, 66], [38, 74], 5),
    ...bez([38, 74], [37, 81], [43, 86], [50, 86], 5),
  ];
  const oeil: P[] = [[37.6, 52.6], [45.4, 54.6], [42.6, 57.4]];
  return {
    d:
      poly(sym(g)) +
      poly(oeil) +
      poly(miroir(oeil)) +
      cercle(44.4, 78.4, 2.3) +
      cercle(55.6, 78.4, 2.3) +
      poly([[39.6, 70.4], [50, 68.8], [60.4, 70.4], [60.2, 71.8], [50, 70.4], [39.8, 71.8]]),
  };
})();

// L'aigle, ailes déployées et levées, la tête de profil : quatre rémiges
// larges par aile, un trait qui détache l'aile du corps, la queue en éventail.
const aigle = (() => {
  const aile: P[] = [
    [45, 41], [35, 33.4], [23, 26.4], [10.6, 23.6],
    [18.4, 32.6], [10, 37.4], [19.8, 43.4], [12.8, 50.2], [23.6, 52.8], [20.6, 59], [32, 58.6], [41.4, 61.4],
    [39, 75], [44.2, 72.6], [44, 83], [48.2, 78.2],
  ];
  const tete: P[] = [[45, 41], [43.6, 35], [39.4, 34], [35.4, 34.8], [34, 30.6], [37.4, 26.4], [42.8, 23], [49, 21.8], [54.6, 24.4], [56.8, 30], [56, 36.4], [55, 41]];
  const contour: P[] = [[50, 84], ...aile.slice().reverse(), ...tete.slice(1, -1), ...miroir(aile)];
  const trait: P[] = [[46.4, 43.4], [43.2, 49.4], [42.6, 57.6], [44.2, 57.6], [44.8, 50], [48, 44.2]];
  return {
    d:
      poly(contour) +
      cercle(45, 28, 1.6) +
      poly(trait) +
      poly(miroir(trait)) +
      poly([[49.2, 66], [50.8, 66], [50.8, 79], [49.2, 79]]),
  };
})();

// Le coq gaulois, debout : la crête, le bec, le barbillon, trois faucilles
// de queue, une patte.
const coq = (() => {
  const contour: P[] = [
    [27, 35.2], [32, 32.4],
    [33, 28], [35.4, 24.4], [38, 27.4], [40.2, 22.4], [43, 26.6], [46.4, 23.6], [47.8, 29.4],
    [49.4, 34], [51.4, 40.4], [57.6, 46.4], [61.6, 44.6],
    ...bez([61.6, 44.6], [61, 34], [65, 24], [76, 19.5], 6),
    ...bez([76, 19.5], [70.4, 26], [68.6, 33], [69, 40], 4),
    ...bez([69, 40], [72.4, 33.6], [78, 30.6], [86, 31.6], 5),
    ...bez([86, 31.6], [79, 35], [75.4, 40], [74.4, 46], 4),
    ...bez([74.4, 46], [78, 44.6], [82.6, 45.6], [86.4, 48.4], 4),
    ...bez([86.4, 48.4], [79, 50], [75.6, 56], [71, 62.4], 5),
    [63, 69], [57.2, 70.6], [57.4, 79.4], [63.4, 83.6], [57.2, 83.2], [55.4, 84.8], [53.6, 83.2], [48.4, 83.6], [53.6, 79.4], [52.6, 70.6],
    ...bez([52.6, 70.6], [43, 69], [36.6, 61], [36.6, 52], 6),
    [37.8, 45.6], [37.6, 42.6], [35.6, 45.2], [33.6, 43.4], [34.6, 38.6], [31.4, 37.4],
  ];
  return {
    d:
      poly(contour) +
      cercle(41.2, 31.4, 1.5) +
      // l'aile, détachée du corps
      "M45.4 50.4C52.6 48.8 60.4 51.6 64.6 57.4C59 55.4 52.6 55.6 47.2 59.2C47.6 56 46.8 53 45.4 50.4Z",
  };
})();

export const DESSINS: Record<Exclude<Embleme, "initiales">, Dessin> = {
  etoile,
  ballon,
  couronne,
  eclair,
  lune,
  anneau,
  losange,
  chevrons,
  bandes,
  delta,
  hexagone,
  damier,
  cheval,
  lion,
  aigle,
  loup,
  taureau,
  coq,
};
