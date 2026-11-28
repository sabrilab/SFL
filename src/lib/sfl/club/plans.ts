// Bola Club : le terrain de chaque exercice. Demande de Bola (28/11/2026) :
// chaque exercice présenté « avec des terrains, les limites des terrains » :
// la zone à baliser à sa vraie taille, les plots, les joueurs (deux équipes,
// les jokers, le gardien, l'entraîneur), le ballon, les buts et les
// mini-buts, les haies, les cerceaux, l'échelle, et ce qui se passe (la
// course, la passe, la conduite). Le dessin est dans
// components/sfl/club/terrain-exercice.tsx.
//
// Tout est en mètres, l'origine en haut à gauche de la zone, x vers la
// droite, y vers le bas ; une zone est toujours dessinée en largeur (l ≥ h).
// `cadre` dit ce qui entoure la zone : un rectangle de plots (zone), ou les
// lignes d'un vrai terrain (demi, surface, largeur). Un exercice du club
// sans plan reçoit celui de son thème (planDe). Pur.

import type { Exercice, ThemeExercice } from "./types";

export type Pt = readonly [number, number];
export type Equipe = "a" | "b" | "j" | "g" | "c";

export interface Plan {
  /** La zone, en mètres (largeur × profondeur). */
  l: number;
  h: number;
  /** zone : un rectangle balisé ; demi / surface / largeur : les lignes d'un vrai terrain ; libre : sans limite. */
  cadre: "zone" | "demi" | "surface" | "largeur" | "libre" | "cercle" | "triangle";
  /** La taille dite sous le dessin : « 20 × 20 m ». */
  dit: string;
  plots?: Pt[];
  joueurs?: { p: Pt; e: Equipe }[];
  ballons?: Pt[];
  /** Un but (b) ou un mini-but (m), son centre et le côté où il regarde. */
  buts?: { p: Pt; cote: "haut" | "bas" | "gauche" | "droite"; m?: boolean }[];
  fleches?: { de: Pt; a: Pt; t: "course" | "passe" | "conduite" | "tir"; par?: Pt }[];
  haies?: Pt[];
  cerceaux?: Pt[];
  echelle?: { p: Pt; l: number };
  /** Des sous-zones en pointillé (couloirs, carrés, ateliers). */
  zones?: { p: Pt; l: number; h: number }[];
}

const coins = (l: number, h: number, x = 0, y = 0): Pt[] => [
  [x, y],
  [x + l, y],
  [x + l, y + h],
  [x, y + h],
];
const ligne = (n: number, de: Pt, a: Pt): Pt[] =>
  Array.from({ length: n }, (_, i) => [de[0] + ((a[0] - de[0]) * i) / Math.max(1, n - 1), de[1] + ((a[1] - de[1]) * i) / Math.max(1, n - 1)] as const);
const equipe = (e: Equipe, pts: Pt[]) => pts.map((p) => ({ p, e }));

export const PLANS: Record<string, Plan> = {
  /* ------------------------------ Échauffement ------------------------------ */
  "b-echauffement-prevention": {
    l: 26,
    h: 16,
    cadre: "zone",
    dit: "Deux lignes de plots à 20 m",
    plots: [...ligne(5, [3, 2], [3, 14]), ...ligne(5, [23, 2], [23, 14])],
    joueurs: equipe("a", [
      [5, 3.5],
      [10, 6.5],
      [6.5, 9.5],
      [12, 12.5],
    ]),
    fleches: [
      { de: [5.8, 3.5], a: [21, 3.5], t: "course" },
      { de: [10.8, 6.5], a: [21, 6.5], t: "course" },
      { de: [7.3, 9.5], a: [21, 9.5], t: "course" },
      { de: [12.8, 12.5], a: [21, 12.5], t: "course" },
    ],
  },
  "b-rondo-4c1": {
    l: 12,
    h: 10,
    cadre: "zone",
    dit: "Carré de 8 × 8 m",
    plots: coins(8, 8, 2, 1),
    joueurs: [
      ...equipe("a", [
        [6, 1],
        [10, 5],
        [6, 9],
        [2, 5],
      ]),
      { p: [6, 5], e: "b" },
    ],
    ballons: [[6.8, 1.6]],
    fleches: [
      { de: [6, 1], a: [10, 5], t: "passe" },
      { de: [10, 5], a: [2, 5], t: "passe", par: [6, 7.5] },
    ],
  },
  "b-passe-et-suis": {
    l: 16,
    h: 14,
    cadre: "zone",
    dit: "Carré de 12 × 12 m",
    plots: coins(12, 12, 2, 1),
    joueurs: equipe("a", [
      [1, 0.5],
      [0, -0.2],
      [15, 0.5],
      [15, 13.5],
      [16, 14.2],
      [1, 13.5],
    ]),
    ballons: [
      [2.6, 1.6],
      [13.4, 12.4],
    ],
    fleches: [
      { de: [2, 1], a: [14, 1], t: "passe" },
      { de: [2, 1.6], a: [13.4, 1.8], t: "course", par: [8, 3.4] },
      { de: [14, 13], a: [2, 13], t: "passe" },
    ],
  },
  "b-mobilite-ballon": {
    l: 40,
    h: 20,
    cadre: "largeur",
    dit: "Une largeur de terrain",
    joueurs: equipe("a", ligne(5, [3, 3], [3, 17])),
    ballons: ligne(5, [4.4, 3], [4.4, 17]),
    fleches: ligne(5, [5, 3], [5, 17]).map((p) => ({ de: p, a: [36, p[1]] as Pt, t: "conduite" as const })),
  },
  "b-chat-ballon": {
    l: 24,
    h: 22,
    cadre: "zone",
    dit: "Rectangle de 20 × 20 m",
    plots: coins(20, 20, 2, 1),
    joueurs: [
      ...equipe("a", [
        [5, 4],
        [12, 6],
        [18, 4],
        [6, 15],
        [15, 17],
        [19, 12],
        [9, 10],
      ]),
      ...equipe("b", [
        [11, 12],
        [16, 9],
        [7, 18],
      ]),
    ],
    ballons: [
      [5.8, 4.6],
      [12.8, 6.6],
      [18.8, 4.6],
      [6.8, 15.6],
      [15.8, 17.6],
      [19.8, 12.6],
      [9.8, 10.6],
    ],
    fleches: [
      { de: [11, 12], a: [9.6, 10.8], t: "course" },
      { de: [16, 9], a: [18.4, 11.4], t: "course" },
    ],
  },

  /* ------------------------------- Technique -------------------------------- */
  "b-controle-oriente": {
    l: 16,
    h: 12,
    cadre: "triangle",
    dit: "Triangle de 10 m de côté",
    plots: [
      [3, 10],
      [13, 10],
      [8, 1.3],
    ],
    joueurs: equipe("a", [
      [2, 11],
      [14, 11],
      [8, 0.4],
    ]),
    ballons: [[3, 10.4]],
    fleches: [
      { de: [3, 10], a: [12.6, 10], t: "passe" },
      { de: [13, 10], a: [8.4, 2], t: "conduite" },
      { de: [8, 1.6], a: [3.4, 9.6], t: "passe" },
    ],
  },
  "b-conduite-slalom": {
    l: 26,
    h: 12,
    cadre: "zone",
    dit: "Couloirs de 20 m",
    zones: [
      { p: [3, 1], l: 20, h: 4.5 },
      { p: [3, 6.5], l: 20, h: 4.5 },
    ],
    plots: [...ligne(6, [6, 3.25], [21, 3.25]), ...ligne(6, [6, 8.75], [21, 8.75])],
    joueurs: equipe("a", [
      [1.4, 3.25],
      [0.2, 3.25],
      [1.4, 8.75],
      [0.2, 8.75],
    ]),
    ballons: [
      [2.4, 3.6],
      [2.4, 9.1],
    ],
    fleches: [{ de: [3, 3.25], a: [22, 3.25], t: "conduite" }],
  },
  "b-une-deux": {
    l: 29,
    h: 13,
    cadre: "zone",
    dit: "Couloir de 25 × 10 m",
    plots: coins(25, 10, 2, 1.5),
    joueurs: [
      ...equipe("a", [
        [2, 6.5],
        [0.6, 6.5],
      ]),
      { p: [14.5, 3], e: "j" },
    ],
    ballons: [[2.8, 6.9]],
    fleches: [
      { de: [2.6, 6.5], a: [14, 3.4], t: "passe" },
      { de: [3, 6.5], a: [20, 6.5], t: "course" },
      { de: [14.5, 3.4], a: [20, 6], t: "passe" },
    ],
  },
  "b-jeu-long": {
    l: 54,
    h: 14,
    cadre: "zone",
    dit: "Deux carrés de 10 m à 30 m l'un de l'autre",
    zones: [
      { p: [2, 2], l: 10, h: 10 },
      { p: [42, 2], l: 10, h: 10 },
    ],
    plots: [...coins(10, 10, 2, 2), ...coins(10, 10, 42, 2)],
    joueurs: equipe("a", [
      [5, 5],
      [9, 9],
      [5, 10],
      [45, 5],
      [49, 9],
      [48, 4],
    ]),
    ballons: [[5.8, 5.6]],
    fleches: [{ de: [6, 5], a: [45, 6], t: "passe", par: [26, -6] }],
  },
  "b-tete": {
    l: 20,
    h: 14,
    cadre: "zone",
    dit: "Un coin de terrain, par trois",
    plots: coins(16, 8, 2, 6),
    joueurs: equipe("a", [
      [4, 10],
      [10, 10],
      [16, 10],
    ]),
    ballons: [[4.6, 9.6]],
    fleches: [
      { de: [4.4, 9.6], a: [9.6, 9.6], t: "passe", par: [7, 4] },
      { de: [10.4, 9.6], a: [15.6, 9.6], t: "passe", par: [13, 6] },
    ],
  },
  "b-dribble-1c1": {
    l: 19,
    h: 14,
    cadre: "zone",
    dit: "Couloir de 15 × 10 m, deux mini-buts",
    plots: coins(15, 10, 2, 2),
    buts: [
      { p: [2, 7], cote: "droite", m: true },
      { p: [17, 7], cote: "gauche", m: true },
    ],
    joueurs: [
      ...equipe("a", [
        [4, 0.8],
        [2.6, 0.8],
      ]),
      ...equipe("b", [
        [15, 13.2],
        [16.4, 13.2],
      ]),
    ],
    ballons: [[14.4, 12.6]],
    fleches: [
      { de: [14.6, 12.6], a: [4.4, 2], t: "passe" },
      { de: [4, 1.6], a: [15.6, 7], t: "conduite" },
      { de: [15, 12.6], a: [12, 8], t: "course" },
    ],
  },

  /* ---------------------------------- Jeu ----------------------------------- */
  "b-conservation-5c5": {
    l: 34,
    h: 29,
    cadre: "zone",
    dit: "Rectangle de 30 × 25 m",
    plots: coins(30, 25, 2, 2),
    joueurs: [
      ...equipe("a", [
        [6, 6],
        [17, 4],
        [28, 8],
        [10, 18],
        [24, 22],
      ]),
      ...equipe("b", [
        [11, 9],
        [20, 10],
        [15, 16],
        [25, 15],
        [7, 23],
      ]),
      ...equipe("j", [
        [17, 27],
        [2, 14],
      ]),
    ],
    ballons: [[6.8, 6.6]],
    fleches: [
      { de: [6.6, 6.4], a: [16.4, 4.4], t: "passe" },
      { de: [17.4, 4.6], a: [27.4, 7.6], t: "passe" },
    ],
  },
  "b-match-4-buts": {
    l: 39,
    h: 29,
    cadre: "zone",
    dit: "Terrain de 35 × 25 m, quatre mini-buts",
    plots: coins(35, 25, 2, 2),
    buts: [
      { p: [2, 6], cote: "droite", m: true },
      { p: [2, 23], cote: "droite", m: true },
      { p: [37, 6], cote: "gauche", m: true },
      { p: [37, 23], cote: "gauche", m: true },
    ],
    joueurs: [
      ...equipe("a", [
        [10, 8],
        [10, 20],
        [17, 14],
        [24, 6],
      ]),
      ...equipe("b", [
        [29, 10],
        [29, 20],
        [22, 16],
        [14, 23],
      ]),
    ],
    ballons: [[17.8, 14.6]],
    fleches: [
      { de: [17.6, 14.4], a: [23.6, 6.6], t: "passe" },
      { de: [24.6, 6.4], a: [36, 6], t: "tir" },
    ],
  },
  "b-transition-3c2": {
    l: 45,
    h: 34,
    cadre: "demi",
    dit: "Demi-terrain, deux buts",
    buts: [
      { p: [22.5, 0], cote: "bas" },
      { p: [22.5, 34], cote: "haut" },
    ],
    joueurs: [
      ...equipe("a", [
        [14, 26],
        [22.5, 24],
        [31, 26],
      ]),
      ...equipe("b", [
        [18, 12],
        [27, 12],
      ]),
      ...equipe("g", [
        [22.5, 1.5],
        [22.5, 32.5],
      ]),
    ],
    ballons: [[23.3, 24.6]],
    fleches: [
      { de: [22.5, 24], a: [22.5, 15], t: "conduite" },
      { de: [14, 26], a: [12, 9], t: "course" },
      { de: [31, 26], a: [33, 9], t: "course" },
    ],
  },
  "b-pressing-6s": {
    l: 34,
    h: 34,
    cadre: "zone",
    dit: "Rectangle de 30 × 30 m",
    plots: coins(30, 30, 2, 2),
    joueurs: [
      ...equipe("a", [
        [8, 8],
        [26, 9],
        [17, 20],
        [9, 27],
        [27, 27],
      ]),
      ...equipe("b", [
        [14, 14],
        [21, 13],
        [12, 22],
        [22, 24],
        [17, 6],
      ]),
    ],
    ballons: [[17.8, 20.6]],
    fleches: [
      { de: [12, 22], a: [16.2, 20.4], t: "course" },
      { de: [22, 24], a: [18, 21.2], t: "course" },
      { de: [14, 14], a: [16.4, 18.6], t: "course" },
    ],
  },
  "b-match-theme": {
    l: 50,
    h: 34,
    cadre: "demi",
    dit: "Demi-terrain ou terrain réduit",
    buts: [
      { p: [0, 17], cote: "droite" },
      { p: [50, 17], cote: "gauche" },
    ],
    joueurs: [
      ...equipe("a", [
        [10, 9],
        [10, 25],
        [20, 17],
        [30, 8],
        [30, 26],
      ]),
      ...equipe("b", [
        [40, 10],
        [40, 24],
        [30, 17],
        [19, 7],
        [19, 27],
      ]),
      ...equipe("g", [
        [1.5, 17],
        [48.5, 17],
      ]),
    ],
    ballons: [[20.8, 17.6]],
  },
  "b-sortie-de-balle": {
    l: 45,
    h: 30,
    cadre: "demi",
    dit: "Tiers de terrain, une ligne à atteindre",
    buts: [{ p: [22.5, 30], cote: "haut" }],
    zones: [{ p: [2, 2], l: 41, h: 0.01 }],
    plots: ligne(6, [2, 2], [43, 2]),
    joueurs: [
      { p: [22.5, 28.5], e: "g" },
      ...equipe("a", [
        [10, 24],
        [35, 24],
        [16, 15],
        [29, 15],
      ]),
      ...equipe("b", [
        [22.5, 18],
        [12, 19],
        [33, 19],
      ]),
    ],
    ballons: [[23.3, 28]],
    fleches: [
      { de: [22.5, 28], a: [10.6, 24.4], t: "passe" },
      { de: [10, 24], a: [16, 15.6], t: "passe" },
      { de: [16, 15], a: [20, 3], t: "conduite" },
    ],
  },
  "b-jeu-endurance": {
    l: 34,
    h: 24,
    cadre: "zone",
    dit: "Terrain de 30 × 20 m, deux buts",
    plots: coins(30, 20, 2, 2),
    buts: [
      { p: [2, 12], cote: "droite", m: true },
      { p: [32, 12], cote: "gauche", m: true },
    ],
    joueurs: [
      ...equipe("a", [
        [8, 7],
        [8, 17],
        [15, 12],
        [22, 7],
      ]),
      ...equipe("b", [
        [26, 8],
        [26, 17],
        [19, 13],
        [12, 19],
      ]),
    ],
    ballons: [[15.8, 12.6]],
  },
  "b-match-5c5-intermittent": {
    l: 44,
    h: 24,
    cadre: "zone",
    dit: "Terrain de foot à 5 (40 × 20 m)",
    plots: coins(40, 20, 2, 2),
    buts: [
      { p: [2, 12], cote: "droite" },
      { p: [42, 12], cote: "gauche" },
    ],
    joueurs: [
      ...equipe("a", [
        [11, 7],
        [11, 17],
        [20, 12],
        [28, 8],
      ]),
      ...equipe("b", [
        [33, 8],
        [33, 16],
        [24, 13],
        [16, 18],
      ]),
      ...equipe("g", [
        [3.4, 12],
        [40.6, 12],
      ]),
    ],
    ballons: [[20.8, 12.6]],
  },

  /* -------------------------------- Finition -------------------------------- */
  "b-frappe-apres-controle": {
    l: 40,
    h: 28,
    cadre: "surface",
    dit: "Entrée de la surface",
    buts: [{ p: [20, 0], cote: "bas" }],
    joueurs: [
      { p: [20, 1.5], e: "g" },
      { p: [20, 19], e: "j" },
      ...equipe("a", [
        [20, 26],
        [21.4, 27],
        [18.6, 27],
      ]),
    ],
    ballons: [[20.8, 25.4]],
    fleches: [
      { de: [20, 25.4], a: [20, 19.8], t: "passe" },
      { de: [20.6, 19.6], a: [24, 18], t: "conduite" },
      { de: [24, 18], a: [22, 0.6], t: "tir" },
    ],
  },
  "b-centre-reprise": {
    l: 45,
    h: 34,
    cadre: "surface",
    dit: "Un côté du terrain et la surface",
    buts: [{ p: [22.5, 0], cote: "bas" }],
    joueurs: [
      { p: [22.5, 1.5], e: "g" },
      ...equipe("a", [
        [41, 30],
        [18, 28],
        [27, 28],
      ]),
    ],
    ballons: [[41.6, 29.4]],
    fleches: [
      { de: [41, 30], a: [41, 8], t: "conduite" },
      { de: [41, 8], a: [24, 5], t: "passe", par: [33, 2] },
      { de: [18, 28], a: [20, 6], t: "course" },
      { de: [27, 28], a: [26, 9], t: "course" },
    ],
  },
  "b-face-au-gardien": {
    l: 45,
    h: 34,
    cadre: "demi",
    dit: "Demi-terrain",
    buts: [{ p: [22.5, 0], cote: "bas" }],
    joueurs: [
      { p: [22.5, 1.5], e: "g" },
      ...equipe("a", [
        [22.5, 32],
        [24, 33],
      ]),
    ],
    ballons: [[23.3, 31.4]],
    fleches: [
      { de: [22.5, 31.4], a: [22.5, 9], t: "conduite" },
      { de: [22.5, 1.5], a: [22.5, 6], t: "course" },
      { de: [22.5, 9], a: [19, 0.6], t: "tir" },
    ],
  },
  "b-duel-surface": {
    l: 40,
    h: 20,
    cadre: "surface",
    dit: "Surface de réparation",
    buts: [{ p: [20, 0], cote: "bas" }],
    joueurs: [
      { p: [20, 1.5], e: "g" },
      ...equipe("a", [
        [15, 10],
        [25, 12],
      ]),
      ...equipe("b", [
        [17, 7],
        [23, 9],
      ]),
      { p: [38, 18], e: "c" },
    ],
    ballons: [[37.4, 17.4]],
    fleches: [{ de: [37.4, 17.4], a: [25.6, 12], t: "passe" }],
  },

  /* -------------------------------- Physique -------------------------------- */
  "b-vitesse-reaction": {
    l: 22,
    h: 12,
    cadre: "zone",
    dit: "Couloirs de 15 m",
    zones: [
      { p: [3, 1], l: 15, h: 4.5 },
      { p: [3, 6.5], l: 15, h: 4.5 },
    ],
    plots: [...coins(15, 4.5, 3, 1), ...coins(15, 4.5, 3, 6.5)],
    joueurs: [
      ...equipe("a", [
        [4, 2.4],
        [4, 7.9],
      ]),
      ...equipe("b", [
        [4, 3.8],
        [4, 9.4],
      ]),
      { p: [20.5, 6], e: "c" },
    ],
    fleches: [
      { de: [4.6, 2.4], a: [17.4, 2.4], t: "course" },
      { de: [4.6, 3.8], a: [17.4, 3.8], t: "course" },
    ],
  },
  "b-intermittent": {
    l: 44,
    h: 16,
    cadre: "largeur",
    dit: "Une largeur de terrain, un plot tous les 10 m",
    plots: [...ligne(5, [2, 14], [42, 14])],
    joueurs: equipe("a", ligne(4, [2, 3], [2, 11])),
    fleches: ligne(4, [3, 3], [3, 11]).map((p, i) => ({ de: p, a: [22 + i * 3, p[1]] as Pt, t: "course" as const })),
  },
  "b-appuis-echelle": {
    l: 22,
    h: 8,
    cadre: "zone",
    dit: "Parcours de 15 m",
    echelle: { p: [3, 4], l: 6 },
    plots: ligne(4, [11.5, 4], [17.5, 4]),
    joueurs: equipe("a", [
      [1.4, 4],
      [0.2, 4],
    ]),
    fleches: [
      { de: [2, 4], a: [9.4, 4], t: "course" },
      { de: [10, 4], a: [19.5, 4], t: "course", par: [14.5, 1] },
    ],
  },
  "b-test-vma": {
    l: 60,
    h: 36,
    cadre: "zone",
    dit: "Un tour balisé tous les 25 m",
    plots: [...ligne(3, [5, 3], [55, 3]), ...ligne(3, [5, 33], [55, 33]), [5, 18], [55, 18]],
    joueurs: equipe("a", [
      [9, 3],
      [12, 3],
      [15, 3],
    ]),
    fleches: [
      { de: [16, 3], a: [53, 3], t: "course" },
      { de: [55, 5], a: [55, 31], t: "course" },
    ],
  },
  "b-intermittent-30-30": {
    l: 44,
    h: 16,
    cadre: "largeur",
    dit: "Un plot par joueur à sa distance",
    plots: [
      [33, 3],
      [36, 6.5],
      [31, 10],
      [38, 13.5],
    ],
    joueurs: equipe("a", ligne(4, [2, 3], [2, 13.5])),
    fleches: [
      { de: [3, 3], a: [32, 3], t: "course" },
      { de: [3, 6.5], a: [35, 6.5], t: "course" },
      { de: [3, 10], a: [30, 10], t: "course" },
      { de: [3, 13.5], a: [37, 13.5], t: "course" },
    ],
  },
  "b-repetition-sprints": {
    l: 26,
    h: 10,
    cadre: "zone",
    dit: "20 m, demi-tour au milieu",
    plots: [
      [3, 5],
      [13, 5],
      [23, 5],
    ],
    joueurs: equipe("a", [
      [1.4, 3.6],
      [1.4, 6.4],
    ]),
    fleches: [
      { de: [2, 3.6], a: [12.6, 3.6], t: "course" },
      { de: [12.6, 3.6], a: [3.4, 4.4], t: "course", par: [8, 1.6] },
      { de: [2, 6.4], a: [22.4, 6.4], t: "course" },
    ],
  },
  "b-relais-vitesse": {
    l: 22,
    h: 14,
    cadre: "zone",
    dit: "Couloirs de 15 m",
    zones: [
      { p: [3, 1], l: 15, h: 5.5 },
      { p: [3, 7.5], l: 15, h: 5.5 },
    ],
    plots: [
      [18, 3.75],
      [18, 10.25],
    ],
    joueurs: [
      ...equipe("a", [
        [2, 3.75],
        [0.8, 3.75],
        [-0.4, 3.75],
      ]),
      ...equipe("b", [
        [2, 10.25],
        [0.8, 10.25],
        [-0.4, 10.25],
      ]),
    ],
    ballons: [
      [2.8, 4.4],
      [2.8, 10.9],
    ],
    fleches: [
      { de: [3, 3.2], a: [17.4, 3.2], t: "course" },
      { de: [17.4, 4.4], a: [3.4, 4.4], t: "conduite" },
    ],
  },

  /* ------------------------------- Motricité -------------------------------- */
  "b-parcours-motricite": {
    l: 22,
    h: 10,
    cadre: "zone",
    dit: "Un parcours de 15 m",
    cerceaux: [
      [4, 5],
      [6, 4],
      [8, 5],
    ],
    plots: ligne(3, [11, 5], [14, 5]),
    haies: [[17, 5]],
    joueurs: equipe("a", [
      [1.6, 5],
      [0.4, 5],
    ]),
    ballons: [[20, 5]],
    fleches: [{ de: [2.4, 5], a: [19.4, 5], t: "course", par: [11, 1.5] }],
  },
  "b-jonglerie-defis": {
    l: 20,
    h: 12,
    cadre: "libre",
    dit: "Libre, un ballon chacun",
    joueurs: equipe("a", [
      [3, 3],
      [10, 2.5],
      [17, 3.5],
      [5, 9],
      [12, 9.5],
      [18, 8.5],
    ]),
    ballons: [
      [3.8, 2.2],
      [10.8, 1.7],
      [17.8, 2.7],
      [5.8, 8.2],
      [12.8, 8.7],
      [18.8, 7.7],
    ],
  },
  "b-equilibre-duels": {
    l: 20,
    h: 12,
    cadre: "libre",
    dit: "Par deux, face à face",
    joueurs: [
      ...equipe("a", [
        [4, 3],
        [14, 3],
        [4, 9],
        [14, 9],
      ]),
      ...equipe("b", [
        [6, 3],
        [16, 3],
        [6, 9],
        [16, 9],
      ]),
    ],
  },

  /* ------------------------------ Renforcement ------------------------------ */
  "b-gainage": {
    l: 20,
    h: 10,
    cadre: "largeur",
    dit: "Au bord du terrain",
    joueurs: equipe("a", ligne(6, [3, 6], [17, 6])),
  },
  "b-circuit-poids-corps": {
    l: 24,
    h: 14,
    cadre: "zone",
    dit: "Six ateliers au bord du terrain",
    zones: [
      { p: [1, 1], l: 6.5, h: 5.5 },
      { p: [8.75, 1], l: 6.5, h: 5.5 },
      { p: [16.5, 1], l: 6.5, h: 5.5 },
      { p: [1, 7.5], l: 6.5, h: 5.5 },
      { p: [8.75, 7.5], l: 6.5, h: 5.5 },
      { p: [16.5, 7.5], l: 6.5, h: 5.5 },
    ],
    plots: [
      [4.25, 1],
      [12, 1],
      [19.75, 1],
      [4.25, 7.5],
      [12, 7.5],
      [19.75, 7.5],
    ],
    joueurs: equipe("a", [
      [4.25, 3.8],
      [12, 3.8],
      [19.75, 3.8],
      [4.25, 10.3],
      [12, 10.3],
      [19.75, 10.3],
    ]),
    fleches: [
      { de: [7.8, 3.8], a: [8.6, 3.8], t: "course" },
      { de: [15.6, 3.8], a: [16.4, 3.8], t: "course" },
    ],
  },
  "b-ischios-nordiques": {
    l: 20,
    h: 10,
    cadre: "largeur",
    dit: "Par deux, sur l'herbe",
    joueurs: [
      ...equipe("a", [
        [4, 4],
        [10, 4],
        [16, 4],
      ]),
      ...equipe("b", [
        [4, 6],
        [10, 6],
        [16, 6],
      ]),
    ],
  },
  "b-pliometrie-basse": {
    l: 22,
    h: 8,
    cadre: "zone",
    dit: "Une ligne de haies basses",
    haies: ligne(5, [5, 4], [17, 4]),
    joueurs: equipe("a", [
      [1.6, 4],
      [0.4, 4],
    ]),
    fleches: [{ de: [2.4, 4], a: [20, 4], t: "course" }],
  },
  "b-musculation-encadree": {
    l: 20,
    h: 12,
    cadre: "zone",
    dit: "Salle ou bord de terrain",
    zones: [
      { p: [1, 1], l: 8.5, h: 10 },
      { p: [10.5, 1], l: 8.5, h: 10 },
    ],
    joueurs: [
      ...equipe("a", [
        [3.5, 4],
        [7, 4],
        [3.5, 8],
        [13, 4],
        [16.5, 4],
        [13, 8],
      ]),
      { p: [10, 9.5], e: "c" },
    ],
  },

  /* --------------------------------- Gardien -------------------------------- */
  "b-gardien-prise": {
    l: 24,
    h: 16,
    cadre: "surface",
    dit: "Le but",
    buts: [{ p: [12, 0], cote: "bas" }],
    joueurs: [
      { p: [12, 2], e: "g" },
      { p: [12, 11], e: "c" },
    ],
    ballons: [[12.8, 10.4]],
    fleches: [{ de: [12, 10.4], a: [12, 2.8], t: "passe" }],
  },
  "b-gardien-sorties": {
    l: 40,
    h: 20,
    cadre: "surface",
    dit: "La surface",
    buts: [{ p: [20, 0], cote: "bas" }],
    joueurs: [
      { p: [20, 1.5], e: "g" },
      { p: [37, 10], e: "a" },
    ],
    ballons: [[36.4, 9.4]],
    fleches: [
      { de: [36.4, 9.4], a: [21, 5], t: "passe", par: [29, 0] },
      { de: [20, 1.5], a: [20.6, 4.4], t: "course" },
    ],
  },
  "b-gardien-relance": {
    l: 45,
    h: 34,
    cadre: "demi",
    dit: "Demi-terrain, trois cibles",
    buts: [
      { p: [22.5, 34], cote: "haut" },
      { p: [10, 18], cote: "bas", m: true },
      { p: [32, 9], cote: "bas", m: true },
      { p: [22.5, 0.5], cote: "bas", m: true },
    ],
    joueurs: [{ p: [22.5, 32], e: "g" }],
    ballons: [[23.3, 31.4]],
    fleches: [
      { de: [22.5, 31.4], a: [10.4, 18.6], t: "passe" },
      { de: [22.5, 31.4], a: [31.8, 9.6], t: "passe", par: [30, 22] },
    ],
  },
  "b-gardien-appuis": {
    l: 24,
    h: 14,
    cadre: "surface",
    dit: "Le but",
    buts: [{ p: [12, 0], cote: "bas" }],
    plots: [
      [8, 2.5],
      [16, 2.5],
    ],
    joueurs: [
      { p: [12, 2.5], e: "g" },
      { p: [12, 11], e: "c" },
    ],
    ballons: [[12.8, 10.4]],
    fleches: [
      { de: [12, 2.5], a: [8.6, 2.5], t: "course" },
      { de: [12, 10.4], a: [15, 1.4], t: "tir" },
    ],
  },

  /* ---------------------------- Retour au calme ----------------------------- */
  "b-etirements": {
    l: 40,
    h: 16,
    cadre: "largeur",
    dit: "Au centre du terrain",
    joueurs: equipe("a", ligne(6, [5, 8], [35, 8])),
  },
  "b-mobilite-respiration": {
    l: 40,
    h: 16,
    cadre: "largeur",
    dit: "Au centre du terrain",
    joueurs: [...equipe("a", ligne(5, [8, 6], [32, 6])), ...equipe("a", ligne(5, [8, 11], [32, 11])), { p: [20, 14.6], e: "c" }],
  },
  "b-tirs-au-but": {
    l: 40,
    h: 20,
    cadre: "surface",
    dit: "Le point de penalty",
    buts: [{ p: [20, 0], cote: "bas" }],
    joueurs: [
      { p: [20, 1.5], e: "g" },
      ...equipe("a", [
        [20, 12],
        [16, 18],
        [18, 18],
        [22, 18],
        [24, 18],
      ]),
    ],
    ballons: [[20, 11]],
    fleches: [{ de: [20, 11], a: [23, 0.6], t: "tir" }],
  },
  "b-cercle": {
    l: 16,
    h: 14,
    cadre: "cercle",
    dit: "En cercle",
    joueurs: [...equipe("a", Array.from({ length: 9 }, (_, i) => [8 + 5 * Math.cos((i / 9) * 2 * Math.PI), 7 + 5 * Math.sin((i / 9) * 2 * Math.PI)] as const)), { p: [8, 2], e: "c" }],
  },
  "b-auto-massage": {
    l: 20,
    h: 10,
    cadre: "largeur",
    dit: "Vestiaire ou bord de terrain",
    joueurs: equipe("a", ligne(5, [3, 6], [17, 6])),
  },
};

/** Un plan par thème, pour un exercice écrit par le club. */
const PAR_THEME: Record<ThemeExercice, string> = {
  echauffement: "b-chat-ballon",
  motricite: "b-parcours-motricite",
  technique: "b-une-deux",
  jeu: "b-match-theme",
  finition: "b-frappe-apres-controle",
  physique: "b-intermittent",
  renforcement: "b-circuit-poids-corps",
  gardien: "b-gardien-prise",
  retour: "b-etirements",
};

export function planDe(e: Pick<Exercice, "id" | "theme" | "espace">): Plan {
  const p = PLANS[e.id];
  if (p) return p;
  return { ...PLANS[PAR_THEME[e.theme]], dit: e.espace };
}
