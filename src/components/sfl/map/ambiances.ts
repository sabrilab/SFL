// Les ambiances du plan et les zones Bola (30/10, Sabri : « changer de
// couleur la carte, faire en sorte qu'elle représente plus la data de
// Bola »). Trois essais, posés sur le même plan (map/style-snap.ts) sans
// recharger le style : on repeint ses couches.
//
//   · « territoire » : le plan crème de la Snap Map, mais hors des zones
//     ouvertes, un voile de papier hachuré, comme une terre pas encore
//     jouée ; chaque zone cernée d'un trait d'encre sur un liseré blanc,
//     comme un sticker découpé.
//   · « nuit » : le plan passe au noir ; les zones restent éclairées, comme
//     un terrain sous ses projecteurs, d'autant plus fort qu'on y joue et
//     qu'on y vit (la chaleur : lieux de match et villes des joueurs).
//   · « encre » : le noir et blanc de la carte de joueur, papier et encre ;
//     la data en encre plus dense là où vit Bola, chaque zone cernée d'un
//     double filet, comme le cadre imprimé d'une carte.
//
//   · « brume » (30/10 au soir, Sabri : « un bel effet de brume, des
//     nuages […] il faut qu'on voie qu'il y a des zones ») : hors des zones,
//     le plan s'efface sous une brume blanche et des nuages ; la zone reste
//     nette, bordée d'une lueur.
//   · « rouge » et « braise » (« peut-être que ça peut être rouge […] une
//     frontière ») : la zone teintée et bordée d'une frontière de couleur
//     franche qui luit, le dehors grisé. Le rouge est réservé aux cartes
//     Impact : la braise est l'essai de rechange.
//   · « nuit-brume » et « nuit-braise » (Sabri, 30/10 : « tester aussi des
//     modes nuit ») : les mêmes sur le plan noir ; la brume y devient une
//     fumée sombre traversée de nuées pâles.
//
//   · « nuit-encre » (31/10, d'après les écrans de navigation que Sabri a
//     épinglés : un plan presque noir, les rues en fils gris, une seule
//     couleur qui brille) : le noir d'un tableau de bord, les bâtiments en
//     volumes noirs, les noms à peine ; la braise seule luit, à la frontière
//     de la zone et sur le trajet jusqu'au match.
//
//   · « jour » et « aube » (02/11, Sabri : « le côté dark […] ça fait fuir
//     un peu ») : le plan revient à la lumière. « jour » prend la charte
//     (parcs et terrains au vert sauge, grands axes au mauve, eau bleu
//     ciel, sol crème) ; « aube » est le plan clair et neutre d'une app de
//     plans, les grands axes en jaune pâle. Les zones y gardent le voile
//     gris clair du dehors.
//
// « classique » : le plan d'avant, sans zones. Seul l'essai « rouge »
// prend une couleur réservée (Impact), pour que Sabri tranche.
// Les zones en attente (des joueurs, pas encore de match) sont en
// pointillé dans les trois.

import type { Map as PlanMap } from "maplibre-gl";
import { chaleur, contoursDesZones, FONDU_PAS, voilesEnFondu, type Zone } from "@/lib/sfl/zones";

export type Ambiance =
  | "jour" | "aube" | "classique" | "territoire" | "nuit" | "encre" | "brume" | "rouge" | "braise" | "nuit-brume" | "nuit-braise" | "nuit-encre"
  | "bulle" | "nuit-chaleur" | "trace" | "sticker" | "nuit-pelouse" | "gravure"
  | "bulle-gomme" | "nuit-bulle" | "bulle-peche" | "bulle-lilas" | "bulle-encre" | "bulle-verre" | "nuit-verre";
/** Les essais montrés dans l'aperçu (l'encre reste par l'adresse). */
export const AMBIANCES: Ambiance[] = ["jour", "aube", "nuit-encre", "brume", "rouge", "braise", "nuit-brume", "nuit-braise", "nuit", "territoire", "classique"];
export const TOUTES_AMBIANCES: Ambiance[] = [...AMBIANCES, "encre", "bulle", "nuit-chaleur", "trace", "sticker", "nuit-pelouse", "gravure", "bulle-gomme", "nuit-bulle", "bulle-peche", "bulle-lilas", "bulle-encre", "bulle-verre", "nuit-verre"];
/** Les ambiances sur le plan noir. */
export const estNuit = (a: Ambiance) => a.startsWith("nuit");

interface Palette {
  terre: string;
  quartier: string;
  parc: string;
  bois: string;
  terrain: string;
  eau: string;
  eauBord: string;
  rue: string;
  rueBord: string;
  grande: string;
  grandeBord: string;
  bati: string;
  volume: string;
  rail: string;
  ombre: string;
  texte: string;
  texteRues: string;
  texteEau: string;
  halo: string;
}

/** Le plan d'avant (map/style-snap.ts) : « territoire » le garde. */
const SNAP: Palette = {
  terre: "#f3f0e8",
  quartier: "#efebe1",
  parc: "#c6ecb0",
  bois: "#b4e2a0",
  terrain: "#9fe08e",
  eau: "#9bd8f6",
  eauBord: "#82cbf0",
  rue: "#ffffff",
  rueBord: "#e2dbcf",
  grande: "#fff3c4",
  grandeBord: "#ecd9a0",
  bati: "#e8e3da",
  volume: "#f7f4ef",
  rail: "#d6d0c6",
  ombre: "rgba(92, 84, 70, 0.55)",
  texte: "#6b6d72",
  texteRues: "#6d6a64",
  texteEau: "#3d8fbf",
  halo: "#ffffff",
};

/** Le jour de la charte : sauge, mauve, crème, bleu ciel (02/11). */
const JOUR: Palette = {
  terre: "#f5f2ea",
  quartier: "#f0ece2",
  parc: "#d3e7cc",
  bois: "#c3dfba",
  terrain: "#a9cba9",
  eau: "#b7dcef",
  eauBord: "#a3d0e8",
  rue: "#ffffff",
  rueBord: "#e6dfd3",
  grande: "#f6dbe8",
  grandeBord: "#e0b3cb",
  bati: "#ebe6dc",
  volume: "#fbf8f3",
  rail: "#d9d2c6",
  ombre: "rgba(92, 84, 70, 0.45)",
  texte: "#55575c",
  texteRues: "#7a776f",
  texteEau: "#3f87b0",
  halo: "#ffffff",
};

/** L'aube : le plan clair et neutre d'une app de plans (02/11). */
const AUBE: Palette = {
  terre: "#f4f4f1",
  quartier: "#efefeb",
  parc: "#d7ebcf",
  bois: "#cde4c4",
  terrain: "#b9dcae",
  eau: "#aed6f1",
  eauBord: "#9ccbea",
  rue: "#ffffff",
  rueBord: "#dedcd6",
  grande: "#ffe9b0",
  grandeBord: "#ecd08a",
  bati: "#e9e8e4",
  volume: "#f9f9f7",
  rail: "#d4d2cc",
  ombre: "rgba(60, 60, 60, 0.35)",
  texte: "#4b4d52",
  texteRues: "#6f7075",
  texteEau: "#3a82b5",
  halo: "#ffffff",
};

const NUIT: Palette = {
  terre: "#111214",
  quartier: "#15171a",
  parc: "#16201a",
  bois: "#141d17",
  terrain: "#1f3b25",
  eau: "#0b0d10",
  eauBord: "#0b0d10",
  rue: "#2a2d32",
  rueBord: "#1b1d21",
  grande: "#3a3d43",
  grandeBord: "#22252a",
  bati: "#1a1c20",
  volume: "#26292e",
  rail: "#2b2e33",
  ombre: "rgba(0, 0, 0, 0.6)",
  texte: "#b9bcc1",
  texteRues: "#8d9096",
  texteEau: "#6e7278",
  halo: "#0a0b0d",
};

const ENCRE: Palette = {
  terre: "#f2f1ec",
  quartier: "#ebe9e3",
  parc: "#e1e3dc",
  bois: "#d9dcd4",
  terrain: "#cdd2c7",
  eau: "#dcdedd",
  eauBord: "#cfd2d1",
  rue: "#ffffff",
  rueBord: "#dcd9d1",
  grande: "#ffffff",
  grandeBord: "#c9c5bc",
  bati: "#e2e0da",
  volume: "#f7f6f2",
  rail: "#cfccc4",
  ombre: "rgba(40, 40, 40, 0.45)",
  texte: "#3a3b3e",
  texteRues: "#5b5c60",
  texteEau: "#6f7275",
  halo: "#ffffff",
};

/** Le tableau de bord : du noir, des fils gris, rien qui ne brille sauf la braise. */
const TABLEAU: Palette = {
  terre: "#0a0a0b",
  quartier: "#0c0c0d",
  parc: "#0f1110",
  bois: "#0e100f",
  terrain: "#15241a",
  // L'eau en bleu nuit (Sabri, 31/10 : « quand on dézoome, tout est noir et
  // on comprend pas […] avoir l'eau d'une couleur pertinente ») : on lit
  // les côtes, les lacs et les fleuves, sans que rien d'autre ne brille.
  eau: "#122436",
  eauBord: "#1a3047",
  rue: "#26272a",
  rueBord: "#0a0a0b",
  grande: "#38393d",
  grandeBord: "#0a0a0b",
  bati: "#0f0f11",
  volume: "#161719",
  rail: "#1c1d20",
  ombre: "rgba(0, 0, 0, 0.7)",
  texte: "#7b7e84",
  texteRues: "#45484d",
  texteEau: "#5a7a96",
  halo: "#0a0a0b",
};

/* Les plans des styles 12 à 17 (02/11 au soir, Sabri : « inspire-toi de la
   carte de Snap, d'Uber, de Zenly […] une surcouche qui la rend plus belle et
   plus dynamique »). Chaque style d'interface à l'essai a son plan
   (styles-ui.css pour la surcouche animée, app/map/page.tsx pour le lien). */
const BULLE: Palette = {
  terre: "#eaf6f0", quartier: "#e3f2ea", parc: "#b9ecc4", bois: "#a6e3b4", terrain: "#8fdc9f",
  eau: "#a6def2", eauBord: "#8dd2ec", rue: "#ffffff", rueBord: "#d3e7dc", grande: "#ffe1ef", grandeBord: "#f3bfd8",
  bati: "#dff0e6", volume: "#ffffff", rail: "#cfe0d6", ombre: "rgba(60, 96, 84, 0.42)",
  texte: "#4c6a5e", texteRues: "#6b8479", texteEau: "#3a8db3", halo: "#ffffff",
};
const CHALEUR: Palette = {
  terre: "#16111b", quartier: "#1a1420", parc: "#1d2820", bois: "#1a251d", terrain: "#2a4630",
  eau: "#0f141c", eauBord: "#131a24", rue: "#2b2432", rueBord: "#1f1925", grande: "#47313f", grandeBord: "#2d212c",
  bati: "#211a27", volume: "#2a2231", rail: "#2a2330", ombre: "rgba(0, 0, 0, 0.6)",
  texte: "#9a8fa3", texteRues: "#786d80", texteEau: "#6c7a8c", halo: "#120e16",
};
const TRACE: Palette = {
  terre: "#f2f2f1", quartier: "#eeeeed", parc: "#e0e6de", bois: "#dbe1d9", terrain: "#cdd7ca",
  eau: "#d8dde2", eauBord: "#ccd2d8", rue: "#ffffff", rueBord: "#dedede", grande: "#ffffff", grandeBord: "#c4c4c4",
  bati: "#e5e5e4", volume: "#fafafa", rail: "#cfcfcf", ombre: "rgba(0, 0, 0, 0.32)",
  texte: "#666666", texteRues: "#8a8a8a", texteEau: "#7a8590", halo: "#ffffff",
};
const STICKER: Palette = {
  terre: "#fff6e5", quartier: "#fff0d9", parc: "#b8f0a8", bois: "#a2e692", terrain: "#7fdc72",
  eau: "#97dcff", eauBord: "#76cdf6", rue: "#ffffff", rueBord: "#efdbbe", grande: "#ffd6ec", grandeBord: "#f1a8ce",
  bati: "#ffe8ca", volume: "#fff9ee", rail: "#e8d4b8", ombre: "rgba(120, 80, 40, 0.38)",
  texte: "#6b5a48", texteRues: "#8a7660", texteEau: "#2f8fc0", halo: "#ffffff",
};
const PELOUSE: Palette = {
  terre: "#2d6a3b", quartier: "#2a6337", parc: "#377a45", bois: "#317140", terrain: "#4a9858",
  eau: "#20493a", eauBord: "#1c4233", rue: "#4f8d5a", rueBord: "#275a32", grande: "#6fae78", grandeBord: "#285c33",
  bati: "#285b34", volume: "#3a7746", rail: "#3c7547", ombre: "rgba(0, 20, 5, 0.5)",
  texte: "#e8f3e6", texteRues: "#cfe6cc", texteEau: "#bfe0d0", halo: "#1b4626",
};
const GRAVURE: Palette = {
  terre: "#f6f1e6", quartier: "#f2ecdf", parc: "#e5e8d5", bois: "#dee2cc", terrain: "#cdd8bd",
  eau: "#e3e5e2", eauBord: "#c7cac2", rue: "#fffdf7", rueBord: "#cdc4b2", grande: "#fffdf7", grandeBord: "#8c8270",
  bati: "#ebe4d5", volume: "#fbf8f0", rail: "#b7ae9e", ombre: "rgba(60, 50, 35, 0.4)",
  texte: "#3d372e", texteRues: "#6f6656", texteEau: "#6f7670", halo: "#fbf8f0",
};

/* Les variations de Bulle, styles 18 à 23 (Sabri, 03/11 : « j'aime le style 12, fais des variations »). */
const BULLE_GOMME: Palette = {
  terre: "#e6f7ee", quartier: "#ddf3e7", parc: "#a9ecba", bois: "#94e3a8", terrain: "#78d98f",
  eau: "#9fe3ee", eauBord: "#83d6e4", rue: "#ffffff", rueBord: "#c6e6d3", grande: "#ffd9ec", grandeBord: "#f5b3d4",
  bati: "#d6efe0", volume: "#ffffff", rail: "#c4dccd", ombre: "rgba(50, 110, 80, 0.45)",
  texte: "#3f6455", texteRues: "#5f8173", texteEau: "#2e8b9c", halo: "#ffffff",
};
const NUIT_BULLE: Palette = {
  terre: "#10221d", quartier: "#132722", parc: "#1a3a2c", bois: "#183428", terrain: "#2b6046",
  eau: "#0d1a1c", eauBord: "#112224", rue: "#20403a", rueBord: "#16302a", grande: "#5a3550", grandeBord: "#3a2436",
  bati: "#183029", volume: "#21413a", rail: "#1f3a33", ombre: "rgba(0, 0, 0, 0.55)",
  texte: "#9cc9b5", texteRues: "#76a291", texteEau: "#6aa7a5", halo: "#0c1a16",
};
const BULLE_PECHE: Palette = {
  terre: "#fff3ea", quartier: "#ffeee2", parc: "#c9efc4", bois: "#b6e7b0", terrain: "#9fdf98",
  eau: "#bfe9ec", eauBord: "#a6dfe3", rue: "#ffffff", rueBord: "#f3dccb", grande: "#ffd5c4", grandeBord: "#f7b9a4",
  bati: "#fde6d6", volume: "#fffaf5", rail: "#ead6c7", ombre: "rgba(150, 90, 60, 0.38)",
  texte: "#7a5a4a", texteRues: "#977a6a", texteEau: "#3f969c", halo: "#ffffff",
};
const BULLE_LILAS: Palette = {
  terre: "#f3effc", quartier: "#eee9fa", parc: "#cdeccf", bois: "#bce4c0", terrain: "#a7dcae",
  eau: "#cfe3f3", eauBord: "#bcd6ec", rue: "#ffffff", rueBord: "#ddd5ef", grande: "#e4d5fa", grandeBord: "#c9b4f2",
  bati: "#e8e2f7", volume: "#ffffff", rail: "#d7cfea", ombre: "rgba(90, 70, 140, 0.36)",
  texte: "#5d5379", texteRues: "#7d7398", texteEau: "#5a86a8", halo: "#ffffff",
};
const BULLE_ENCRE: Palette = {
  terre: "#fff8ec", quartier: "#fff3e2", parc: "#b4ecc0", bois: "#a0e3af", terrain: "#86da9a",
  eau: "#b4e6ef", eauBord: "#1a1714", rue: "#ffffff", rueBord: "#1a1714", grande: "#ffd9ec", grandeBord: "#1a1714",
  bati: "#fbe9d2", volume: "#ffffff", rail: "#1a1714", ombre: "rgba(26, 23, 20, 0.5)",
  texte: "#1a1714", texteRues: "#3d362f", texteEau: "#1a1714", halo: "#ffffff",
};
const BULLE_VERRE: Palette = {
  terre: "#dff5ec", quartier: "#d7f1e6", parc: "#99e8b1", bois: "#86e0a2", terrain: "#62d585",
  eau: "#8fe0f0", eauBord: "#72d4e8", rue: "#ffffff", rueBord: "#bfe4d3", grande: "#ffc9e6", grandeBord: "#f3a6cf",
  bati: "#cfeee0", volume: "#ffffff", rail: "#b9dccb", ombre: "rgba(40, 120, 90, 0.4)",
  texte: "#305848", texteRues: "#4f7767", texteEau: "#1f8496", halo: "#ffffff",
};
const NUIT_VERRE: Palette = {
  terre: "#0e1c18", quartier: "#11201c", parc: "#173a2b", bois: "#153427", terrain: "#265f44",
  eau: "#0f2a2c", eauBord: "#143436", rue: "#24403a", rueBord: "#172d28", grande: "#4d3346", grandeBord: "#33222f",
  bati: "#162b25", volume: "#1f3a33", rail: "#1d362f", ombre: "rgba(0, 0, 0, 0.55)",
  texte: "#a6cfbd", texteRues: "#7ea797", texteEau: "#79b6b0", halo: "#0a1613",
};
const PALETTES: Record<Ambiance, Palette> = { jour: JOUR, aube: AUBE, classique: SNAP, territoire: SNAP, nuit: NUIT, encre: ENCRE, brume: SNAP, rouge: SNAP, braise: SNAP, "nuit-brume": NUIT, "nuit-braise": NUIT, "nuit-encre": TABLEAU,
  bulle: BULLE, "nuit-chaleur": CHALEUR, trace: TRACE, sticker: STICKER, "nuit-pelouse": PELOUSE, gravure: GRAVURE,
  "bulle-gomme": BULLE_GOMME, "nuit-bulle": NUIT_BULLE, "bulle-peche": BULLE_PECHE, "bulle-lilas": BULLE_LILAS, "bulle-encre": BULLE_ENCRE, "bulle-verre": BULLE_VERRE, "nuit-verre": NUIT_VERRE };

/** Les halos de chaleur des styles 12 à 17, façon Snap Map, sans or, bleu ni rouge (réservés aux cartes). */
const HALOS: Partial<Record<Ambiance, unknown[]>> = {
  bulle: ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.2, "rgba(255,214,234,0.25)", 0.55, "rgba(255,190,222,0.42)", 0.85, "rgba(190,240,200,0.55)", 1, "rgba(255,255,255,0.7)"],
  "nuit-chaleur": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(224,179,203,0)", 0.15, "rgba(224,179,203,0.16)", 0.45, "rgba(224,179,203,0.42)", 0.75, "rgba(169,203,169,0.6)", 1, "rgba(255,250,235,0.78)"],
  trace: ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.3, "rgba(0,0,0,0.03)", 1, "rgba(0,0,0,0.08)"],
  sticker: ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.2, "rgba(255,255,255,0.35)", 0.6, "rgba(255,214,236,0.5)", 1, "rgba(255,255,255,0.8)"],
  "nuit-pelouse": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.2, "rgba(240,255,236,0.08)", 0.6, "rgba(240,255,236,0.2)", 1, "rgba(250,255,248,0.4)"],
  "bulle-gomme": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.2, "rgba(255,206,230,0.3)", 0.55, "rgba(255,180,216,0.5)", 0.85, "rgba(170,240,190,0.6)", 1, "rgba(255,255,255,0.75)"],
  "nuit-bulle": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(143,214,164,0)", 0.15, "rgba(143,214,164,0.14)", 0.45, "rgba(143,214,164,0.38)", 0.75, "rgba(243,191,216,0.55)", 1, "rgba(255,250,240,0.8)"],
  "bulle-peche": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.2, "rgba(255,214,196,0.3)", 0.55, "rgba(255,196,176,0.45)", 0.85, "rgba(255,226,236,0.6)", 1, "rgba(255,255,255,0.75)"],
  "bulle-lilas": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.2, "rgba(220,204,250,0.3)", 0.55, "rgba(205,184,246,0.45)", 0.85, "rgba(196,236,206,0.55)", 1, "rgba(255,255,255,0.75)"],
  "bulle-encre": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.2, "rgba(255,217,236,0.35)", 0.6, "rgba(255,200,228,0.55)", 1, "rgba(255,255,255,0.8)"],
  "bulle-verre": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.2, "rgba(255,255,255,0.3)", 0.5, "rgba(255,201,230,0.5)", 0.8, "rgba(160,240,200,0.6)", 1, "rgba(255,255,255,0.85)"],
  "nuit-verre": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(127,217,154,0)", 0.15, "rgba(127,217,154,0.14)", 0.45, "rgba(127,217,154,0.34)", 0.75, "rgba(245,179,212,0.5)", 1, "rgba(255,250,240,0.75)"],
  gravure: ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(61,55,46,0)", 0.2, "rgba(61,55,46,0.04)", 0.6, "rgba(61,55,46,0.1)", 1, "rgba(61,55,46,0.2)"],
};

/** La couleur de frontière des essais « rouge » et « braise ». */
const FRONTIERE: Partial<Record<Ambiance, string>> = { rouge: "#E3262E", braise: "#FF6A1A", "nuit-braise": "#FF6A1A", "nuit-encre": "#FF6A1A" };

/** Les libellés d'une ambiance (le fond satellite garde son blanc sur noir). */
export function couleurLibelle(ambiance: Ambiance, id: string, satellite: boolean): { texte: string; halo: string } {
  if (satellite) return { texte: "#f4f5f2", halo: "rgba(10, 11, 13, 0.85)" };
  const p = PALETTES[ambiance];
  return { texte: id === "noms-rues" ? p.texteRues : id === "noms-eau" ? p.texteEau : p.texte, halo: p.halo };
}

const ROUTES: [string, keyof Palette, keyof Palette][] = [
  ["chemins", "rue", "rueBord"],
  ["ruelles", "rue", "rueBord"],
  ["rues", "rue", "rueBord"],
  ["avenues", "grande", "grandeBord"],
  ["autoroutes", "grande", "grandeBord"],
];

/** Repeindre le plan dans une ambiance. */
export function peindre(map: PlanMap, ambiance: Ambiance) {
  const p = PALETTES[ambiance];
  const nuit = estNuit(ambiance);
  const set = (id: string, prop: string, v: unknown) => map.getLayer(id) && map.setPaintProperty(id, prop, v);
  set("terre", "background-color", p.terre);
  set("quartiers", "fill-color", p.quartier);
  set("bois", "fill-color", p.bois);
  set("herbe", "fill-color", p.parc);
  set("parcs", "fill-color", p.parc);
  set("terrains", "fill-color", p.terrain);
  set("terrains", "fill-outline-color", ambiance === "nuit-encre" ? "#2a4a31" : nuit ? "#2c5a35" : "#ffffff");
  set("ombrage", "hillshade-shadow-color", p.ombre);
  set("ombrage", "hillshade-highlight-color", nuit ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.6)");
  set("rivieres", "line-color", p.eau);
  set("eau", "fill-color", p.eau);
  set("eau", "fill-outline-color", p.eauBord);
  set("rails", "line-color", p.rail);
  for (const [id, c, b] of ROUTES) {
    set(id, "line-color", p[c]);
    set(`${id}-bord`, "line-color", p[b]);
  }
  set("chemins", "line-color", ambiance === "nuit-encre" ? "#1a1b1d" : nuit ? "#1f2125" : ambiance === "encre" ? "#f8f8f5" : "#fbfaf6");
  set("bati", "fill-color", p.bati);
  set("volumes", "fill-extrusion-color", p.volume);
}

/* ------------------------------ Les zones ------------------------------ */

const AVANT = "noms-rues";

/** Les hachures du voile « territoire » : un trait d'encre en biais, très léger. */
function hachures(): { width: number; height: number; data: Uint8Array } {
  const n = 14;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.abs(((x + y) % n) - n / 2);
      const a = d < 0.9 ? 34 : d < 1.6 ? 14 : 0;
      const i = (y * n + x) * 4;
      data[i] = 10;
      data[i + 1] = 11;
      data[i + 2] = 13;
      data[i + 3] = a;
    }
  return { width: n, height: n, data };
}

/**
 * Les nuages de « brume » : un bruit de valeur fractal qui se raccorde sur
 * ses bords (256 px), blanc, dont l'alpha suit la densité.
 */
function nuages(): { width: number; height: number; data: Uint8Array } {
  const n = 256;
  const hash = (x: number, y: number, p: number) => {
    const h = Math.sin(((x % p) + p) % p * 127.1 + (((y % p) + p) % p) * 311.7 + p * 74.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const lisse = (t: number) => t * t * (3 - 2 * t);
  const bruit = (x: number, y: number, p: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = lisse(x - xi), v = lisse(y - yi);
    const a = hash(xi, yi, p), b = hash(xi + 1, yi, p), c = hash(xi, yi + 1, p), d = hash(xi + 1, yi + 1, p);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let f = 0, amp = 0.55, tot = 0;
      for (let o = 0, p = 4; o < 5; o++, p *= 2, amp *= 0.5) {
        f += amp * bruit((x / n) * p, (y / n) * p, p);
        tot += amp;
      }
      f /= tot;
      const a = Math.max(0, Math.min(1, (f - 0.38) / 0.32));
      const i = (y * n + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(lisse(a) * 235);
    }
  return { width: n, height: n, data };
}

/** L'aire de chaque zone ouverte (son contour fermé), pour la teinter. */
function airesDesZones(zones: Zone[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: zones
      .filter((z) => z.ouverte && z.contour.length > 3)
      .map((z) => ({ type: "Feature", properties: { id: z.id }, geometry: { type: "Polygon", coordinates: [z.contour] } })),
  };
}

/** Les couches des zones, une fois, sous les libellés (et donc sous les terrains possibles et les repères). */
export function poserZones(map: PlanMap, zones: Zone[]) {
  if (map.getSource("zones-voile")) return;
  if (!map.hasImage("hachures")) map.addImage("hachures", hachures(), { pixelRatio: 2 });
  if (!map.hasImage("nuages")) map.addImage("nuages", nuages(), { pixelRatio: 1 });
  map.addSource("zones-chaleur", { type: "geojson", data: chaleur(zones) });
  map.addSource("zones-voile", { type: "geojson", data: voilesEnFondu(zones) });
  map.addSource("zones-traits", { type: "geojson", data: contoursDesZones(zones) });
  map.addSource("zones-aires", { type: "geojson", data: airesDesZones(zones) });
  map.addLayer({ id: "zones-teinte", type: "fill", source: "zones-aires", paint: { "fill-opacity": 0, "fill-antialias": false } }, AVANT);
  map.addLayer({ id: "zones-voile", type: "fill", source: "zones-voile", paint: { "fill-opacity": 0, "fill-antialias": false } }, AVANT);
  map.addLayer(
    { id: "zones-nuages", type: "fill", source: "zones-voile", filter: [">=", ["get", "k"], 3], paint: { "fill-pattern": "nuages", "fill-opacity": 0, "fill-antialias": false } },
    AVANT
  );
  map.addLayer({ id: "zones-hachures", type: "fill", source: "zones-voile", paint: { "fill-pattern": "hachures", "fill-opacity": 0, "fill-antialias": false } }, AVANT);
  // L'eau par-dessus le voile, de loin seulement (Sabri, 31/10 : dézoomé,
  // « tout est noir et on comprend pas ») : les terres s'éteignent loin des
  // zones, la mer et les lacs restent lisibles. De près, l'eau du plan
  // reprend la main (les ponts passent au-dessus).
  map.addLayer(
    {
      id: "eau-de-loin",
      type: "fill",
      source: "osm",
      "source-layer": "water",
      maxzoom: 12,
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-opacity": 0, "fill-antialias": false },
    },
    AVANT
  );
  map.addLayer(
    {
      id: "zones-chaleur",
      type: "heatmap",
      source: "zones-chaleur",
      maxzoom: 16,
      paint: {
        "heatmap-weight": ["get", "poids"],
        "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 4, 14, 9, 60, 12, 220, 15, 900],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 12, 1.1],
        "heatmap-opacity": 0,
      },
    },
    AVANT
  );
  map.addLayer(
    {
      id: "zones-lueur",
      type: "line",
      source: "zones-traits",
      filter: ["get", "ouverte"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#ffffff", "line-width": 0, "line-blur": 0, "line-opacity": 0 },
    },
    AVANT
  );
  map.addLayer(
    {
      id: "zones-lisere",
      type: "line",
      source: "zones-traits",
      filter: ["get", "ouverte"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#ffffff", "line-width": 0, "line-opacity": 0 },
    },
    AVANT
  );
  map.addLayer(
    {
      id: "zones-trait",
      type: "line",
      source: "zones-traits",
      filter: ["get", "ouverte"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#0a0b0d", "line-width": 0, "line-opacity": 0 },
    },
    AVANT
  );
  map.addLayer(
    {
      id: "zones-attente",
      type: "line",
      source: "zones-traits",
      filter: ["!", ["get", "ouverte"]],
      layout: { "line-join": "round", "line-cap": "butt" },
      paint: { "line-color": "#0a0b0d", "line-width": 1.4, "line-opacity": 0, "line-dasharray": [2, 2.5] },
    },
    AVANT
  );
}

/** De nouvelles zones (un match ouvert ailleurs, une ville de plus). */
export function majZones(map: PlanMap, zones: Zone[]) {
  const set = (id: string, data: GeoJSON.GeoJSON) => {
    const s = map.getSource(id);
    if (s && "setData" in s) (s as { setData: (d: GeoJSON.GeoJSON) => void }).setData(data);
  };
  set("zones-chaleur", chaleur(zones));
  set("zones-voile", voilesEnFondu(zones));
  set("zones-traits", contoursDesZones(zones));
  set("zones-aires", airesDesZones(zones));
}

/** Le ton des zones, selon l'ambiance (et le fond : la photo satellite n'a pas de voile). */
export function teinterZones(map: PlanMap, ambiance: Ambiance, satellite: boolean) {
  if (!map.getLayer("zones-voile")) return;
  const set = (id: string, prop: string, v: unknown) => map.setPaintProperty(id, prop, v);
  const sans = ambiance === "classique";
  // Le voile en fondu (zones.ts, voilesEnFondu) : seize voiles empilés, de
  // plus en plus larges ; l'opacité est celle de chacun. Plus de trait ni de
  // hachures (Sabri, 30/10 : « pas une fracture […] que ça se fonde ») : hors
  // des zones le plan se grise peu à peu, dedans il reste clair.
  const nuit = estNuit(ambiance);
  const brume = ambiance === "brume" || ambiance === "nuit-brume";
  const frontiere = FRONTIERE[ambiance];
  const voile =
    sans || satellite ? 0 : (brume ? (nuit ? 0.24 : 0.2) : frontiere ? (nuit ? 0.2 : 0.17) : ambiance === "territoire" ? 0.15 : ambiance === "nuit" ? 0.18 : 0.12) * (10 / FONDU_PAS);
  set("zones-voile", "fill-color", nuit ? "#030304" : ambiance === "encre" ? "#cfcec8" : brume ? "#f6f7f8" : frontiere ? "#bfc0bc" : "#c9cac6");
  set("zones-voile", "fill-opacity", voile);
  set("zones-hachures", "fill-opacity", 0);
  set("eau-de-loin", "fill-color", PALETTES[ambiance].eau);
  set("eau-de-loin", "fill-opacity", ambiance === "nuit-encre" && !satellite ? ["interpolate", ["linear"], ["zoom"], 9, 1, 11.5, 0] : 0);
  // La brume : des nuages blancs qui s'épaississent en s'éloignant de la zone.
  set("zones-nuages", "fill-opacity", brume && !satellite ? (nuit ? 0.028 : 0.14) : 0);
  // La zone teintée de sa couleur, à peine (« rouge », « braise »).
  set("zones-teinte", "fill-color", frontiere ?? "#ffffff");
  set("zones-teinte", "fill-opacity", frontiere && !satellite && ambiance !== "nuit-encre" ? (nuit ? 0.09 : 0.07) : 0);
  // Les halos : de la lumière là où l'on joue et d'où l'on vient, plus
  // forte la nuit ; à l'encre, une encre plus dense.
  set("zones-chaleur", "heatmap-opacity", sans || satellite ? 0 : 1);
  set(
    "zones-chaleur",
    "heatmap-color",
    HALOS[ambiance] ??
    (ambiance === "encre"
      ? ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(10,11,13,0)", 0.15, "rgba(10,11,13,0.04)", 0.5, "rgba(10,11,13,0.1)", 1, "rgba(10,11,13,0.22)"]
      : nuit
        ? ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.15, "rgba(255,255,255,0.06)", 0.5, "rgba(246,247,242,0.2)", 1, "rgba(246,247,242,0.42)"]
        : ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.15, "rgba(255,255,253,0.18)", 0.5, "rgba(255,255,253,0.38)", 1, "rgba(255,255,253,0.6)"])
  );
  for (const id of ["zones-trait", "zones-lisere", "zones-attente", "zones-lueur"]) set(id, "line-opacity", 0);
  // La frontière (« rouge », « braise ») : un trait franc sur une lueur
  // large et floue ; la brume : seulement une ombre douce, celle d'un banc
  // de nuages posé au bord de la zone.
  if (!satellite && (frontiere || brume)) {
    const largeur = ["interpolate", ["linear"], ["zoom"], 6, 1.6, 10, 3, 14, 4.5];
    set("zones-lueur", "line-color", frontiere ?? (nuit ? "#f4f5f2" : "#3a3d42"));
    set("zones-lueur", "line-width", ["interpolate", ["linear"], ["zoom"], 6, 10, 10, 26, 14, 44]);
    set("zones-lueur", "line-blur", ["interpolate", ["linear"], ["zoom"], 6, 8, 10, 20, 14, 34]);
    set("zones-lueur", "line-opacity", frontiere ? (nuit ? 0.5 : 0.38) : nuit ? 0.1 : 0.16);
    if (frontiere) {
      set("zones-lisere", "line-color", nuit ? "#0a0b0d" : "#ffffff");
      set("zones-lisere", "line-width", ["interpolate", ["linear"], ["zoom"], 6, 3.6, 10, 6, 14, 8.5]);
      set("zones-lisere", "line-opacity", 0.9);
      set("zones-trait", "line-color", frontiere);
      set("zones-trait", "line-width", largeur);
      set("zones-trait", "line-opacity", 1);
    }
  }
  // Les terrains possibles, de loin : des points cerclés, à peine la nuit.
  if (map.getLayer("possibles-points") && !satellite) {
    map.setPaintProperty("possibles-points", "circle-stroke-color", nuit ? "rgba(246,247,242,0.35)" : "#ffffff");
    map.setPaintProperty("possibles-points", "circle-color", ["case", ["get", "horsZone"], nuit ? "#84D68C" : "#1F8A45", nuit ? "#5d6067" : ambiance === "encre" ? "#6b6c70" : "#8a8c91"]);
  }
}
