// Les finitions de la carte joueur : un seul endroit pour tout ce qui
// change son allure sans changer sa disposition (Sabri, 23/10 : « plutôt
// que de faire bleu ou or comme ça, réfléchis à un meilleur design, tout en
// gardant notre même disposition », et « que le derrière des cartes suive
// aussi la même couleur que l'avant, que ce soit vraiment une carte full
// color »).
//
// Deux choses s'y décident :
//   · l'édition, qui vient de la carte elle-même : la carte de saison
//     (base), ou une carte à titre, MVP, Impact ou Défensive ;
//   · l'habillage, qui vient du joueur : ce qu'il a débloqué dans la passe
//     et choisi de porter (fil « Missions », profiles.habillage). La
//     finition n'habille que la carte de saison : une carte à titre garde
//     sa matière. Signes, cran et rang vont sur toutes.
//
// L'une et l'autre donnent une matière (MATIERES), lue par la face
// (bola-card.tsx), la carte photo (carte-photo.tsx), le dos (dos-carte.tsx)
// et la 3D (card-3d-canvas.tsx : la tranche, le reflet) : une carte est de
// la même matière des deux côtés et sur sa tranche.
//
// Une matière, ce n'est plus un aplat : un métal ou un papier (dégradés qui
// accrochent la lumière), et un motif gravé ton sur ton, propre à chaque
// titre et tiré de son emblème (vitrine, badges 3D) :
//   · MVP, l'or : des rayons qui partent du portrait, la gloire ;
//   · Impact, le rouge : des ondes de choc autour de la note ;
//   · Défensive, le bleu : des alvéoles, la cotte de mailles ;
//   · nuit (passe, palier 4) : un ciel de nuit étoilé, l'encre d'argent ;
//   · chrome (palier 10) : un miroir, des reflets francs ;
//   · animée (palier 16) : la nacre irisée, et la lumière qui passe.
// Toutes les cotes sont dans le repère de la carte (1024 × 1656).

/** L'édition d'une carte : la carte de saison, ou une carte à titre. */
export type EditionCarte = "base" | "mvp" | "impact" | "def";

/** Les finitions de la passe : elles habillent la carte de saison. */
export type Finition = "nuit" | "chrome" | "animee";

/** Le traitement de la photo, sans IA. */
export type Traitement = "argentique" | "gravure" | "marbre";

/** Les signes distinctifs, à poser en plus. */
export type Signe = "lisere-argent" | "lisere-or" | "sceau" | "puce-or" | "nom-grave";

/** Le rang du joueur selon son XP, aux couleurs des rangs de mission. */
export type RangCarte = "B" | "A" | "S";

/**
 * Ce que le joueur porte sur sa carte, tout facultatif. Le fil « Missions »
 * dit ce qu'il a débloqué et choisi (useHabillage) ; l'écran de la passe en
 * passe un autre à PlayerCard pour l'essayer.
 */
export interface HabillageCarte {
  finition?: Finition;
  traitement?: Traitement;
  signes?: Signe[];
  /** Le cadre, construit coin par coin : de 0 (rien) à 4 (complet). */
  cran?: 0 | 1 | 2 | 3 | 4;
  rang?: RangCarte;
}

/** Les matières : les quatre éditions, les trois finitions, et l'ancienne rare. */
export type NomMatiere = EditionCarte | Finition | "rare";

/** Le motif gravé d'une matière (motif-carte.tsx le dessine). */
export type Motif =
  | { type: "rayons"; cx: number; cy: number; n: number }
  | { type: "ondes"; cx: number; cy: number }
  | { type: "alveoles"; cote: number }
  | { type: "etoiles" };

export interface Matiere {
  nom: NomMatiere;
  /** Ce que dit l'étiquette d'édition (en haut à gauche du portrait). */
  titre: string;
  /** L'encre du texte, « r,g,b ». */
  encre: string;
  /** Matière sombre : voile et ombres du texte en sombre. */
  sombre: boolean;
  /** Le fond de la carte, des deux côtés : couches CSS. */
  papier: string;
  /** Le motif gravé sur le papier, ses deux tons (clair, foncé) et sa force. */
  motif?: Motif & { clair: string; fonce: string };
  /** Le portrait sans photo, et sa lueur. */
  fond: string;
  lueur: string;
  /** Forces : rayures du portrait vide, microtexte, reflet, repères d'angle. */
  rayures: number;
  micro: number;
  reflet: number;
  coins: number;
  etiquette: { fond: string; bord: string; texte: string };
  /** Le symbole Bola du portrait. */
  symbole: string;
  /** Le liseré du portrait et le rebord de la carte : la lumière, puis l'ombre. */
  rebord: { lumiere: string; ombre: string };
  /** La puce : argent, ou dans le métal de la carte. */
  puce: string;
  /** La carte photo (petites tailles) : le serti autour de la photo, le voile du bas, l'onglet de la note. */
  cadre: string;
  voile: string;
  onglet: { fond: string; encre: string };
  /** La couleur franche (ronds des courbes, filets). */
  vive: string;
  /** La 3D : la tranche, et le reflet qui court sur la carte quand on la tourne. */
  tranche: { couleur: string; metal: number; rugosite: number };
  holo: { force: number; teinte: [number, number, number] | null };
  /** La lumière passe d'elle-même sur la carte (finition animée). */
  anime?: boolean;
}

const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * Les coins de la carte : 92 = 1024 ÷ φ⁵ (avant le 23/10 : 61, ÷ φ⁶). Le
 * portrait suit, concentrique (92 − 41 de marge). La 3D lit le même rapport.
 */
export const RAYON_CARTE = 1024 / PHI ** 5;
export const RAYON_PORTRAIT = RAYON_CARTE - 41;

// Le centre du portrait, et celui de la note (la carte complète).
const CENTRE_PORTRAIT = { cx: 512, cy: 512 };
const CENTRE_NOTE = { cx: 300, cy: 1300 };

const BLANC = "rgba(255,255,255,0.95)";

export const MATIERES: Record<NomMatiere, Matiere> = {
  // La carte de saison : le papier blanc cassé de la carte officielle.
  base: {
    nom: "base",
    titre: "base",
    encre: "8,9,11",
    sombre: false,
    papier: "linear-gradient(160deg, #fcfcfa 0%, #f1f1ed 55%, #e9e9e4 100%)",
    fond: "#ffffff",
    lueur: BLANC,
    rayures: 0.05,
    micro: 0.04,
    reflet: 0.35,
    coins: 0.55,
    etiquette: { fond: "transparent", bord: "rgba(8,9,11,0.5)", texte: "rgba(8,9,11,0.75)" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,0.9)", ombre: "rgba(8,9,11,0.12)" },
    puce: "linear-gradient(135deg, #f3f3f1, #b9bab5 45%, #e6e6e3 70%, #a7a8a3)",
    cadre: "#2a2b2f",
    voile: "rgba(0,0,0,0.5)",
    onglet: { fond: "#08090b", encre: "#f5f5f3" },
    vive: "#f5f5f3",
    tranche: { couleur: "#e4e4df", metal: 0.1, rugosite: 0.6 },
    holo: { force: 0.3, teinte: null },
  },
  // L'ancienne rare (argent, repères pleins), plus montrée depuis le 17/10.
  rare: {
    nom: "rare",
    titre: "rare",
    encre: "8,9,11",
    sombre: false,
    papier: "linear-gradient(160deg, #f6f6f3 0%, #e4e5e1 55%, #cfd0cb 100%)",
    fond: "#ffffff",
    lueur: BLANC,
    rayures: 0.07,
    micro: 0.06,
    reflet: 0.55,
    coins: 1,
    etiquette: { fond: "#08090b", bord: "#08090b", texte: "#f4f5f2" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,0.9)", ombre: "rgba(8,9,11,0.16)" },
    puce: "linear-gradient(135deg, #f3f3f1, #b9bab5 45%, #e6e6e3 70%, #a7a8a3)",
    cadre: "linear-gradient(150deg, #f6f6f3 0%, #c9cac5 50%, #9fa09b 100%)",
    voile: "rgba(0,0,0,0.5)",
    onglet: { fond: "#08090b", encre: "#f5f5f3" },
    vive: "#c9cac5",
    tranche: { couleur: "#b9bab5", metal: 0.35, rugosite: 0.45 },
    holo: { force: 1, teinte: null },
  },
  // MVP : la feuille d'or, l'encre brune, les rayons de la gloire.
  mvp: {
    nom: "mvp",
    titre: "MVP",
    encre: "38,24,4",
    sombre: false,
    papier: [
      "radial-gradient(90% 55% at 50% 31%, rgba(255,246,214,0.55) 0%, rgba(255,246,214,0) 70%)",
      "linear-gradient(180deg, rgba(120,78,10,0) 58%, rgba(120,78,10,0.22) 100%)",
      "linear-gradient(152deg, #fbe9b0 0%, #e9c46e 20%, #c99733 42%, #a8761f 58%, #d9b257 76%, #f3dc98 90%, #b98a2c 100%)",
    ].join(", "),
    motif: { type: "rayons", ...CENTRE_PORTRAIT, n: 56, clair: "rgba(255,247,222,0.34)", fonce: "rgba(110,70,8,0.12)" },
    fond: "#f1dfa6",
    lueur: "rgba(255,248,220,0.95)",
    rayures: 0.07,
    micro: 0.07,
    reflet: 0.5,
    coins: 0.85,
    etiquette: { fond: "#26180a", bord: "#26180a", texte: "#f6dc92" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,246,210,0.95)", ombre: "rgba(92,58,6,0.38)" },
    puce: "linear-gradient(135deg, #fff2c6, #c99733 45%, #f3dc98 70%, #9c6f1e)",
    cadre: "linear-gradient(152deg, #fbe9b0 0%, #e9c46e 22%, #b8862a 50%, #f0d58c 78%, #a07020 100%)",
    voile: "rgba(64,40,4,0.8)",
    onglet: { fond: "#e2b955", encre: "#241803" },
    vive: "#d4a73a",
    tranche: { couleur: "#c99a3c", metal: 0.55, rugosite: 0.32 },
    holo: { force: 0.85, teinte: [1, 0.86, 0.5] },
  },
  // Impact : le rouge laqué, l'encre blanche, les ondes autour de la note.
  impact: {
    nom: "impact",
    titre: "IMPACT",
    encre: "255,245,242",
    sombre: true,
    papier: [
      "radial-gradient(75% 45% at 29% 79%, rgba(255,110,96,0.45) 0%, rgba(255,110,96,0) 70%)",
      "linear-gradient(180deg, rgba(40,0,4,0) 45%, rgba(40,0,4,0.35) 100%)",
      "linear-gradient(152deg, #ff6a5c 0%, #e8242b 24%, #b5101c 48%, #82061a 64%, #c8182a 82%, #6a0414 100%)",
    ].join(", "),
    motif: { type: "ondes", ...CENTRE_NOTE, clair: "rgba(255,214,206,0.22)", fonce: "rgba(60,0,8,0.22)" },
    fond: "#a5121c",
    lueur: "rgba(255,140,140,0.35)",
    rayures: 0.07,
    micro: 0.08,
    reflet: 0.24,
    coins: 0.9,
    etiquette: { fond: "#fff5f2", bord: "#fff5f2", texte: "#9a0f16" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,190,180,0.75)", ombre: "rgba(40,0,6,0.5)" },
    puce: "linear-gradient(135deg, #ffd9d2, #c8182a 45%, #ff8a7e 70%, #7a0616)",
    cadre: "linear-gradient(152deg, #ff6a5c 0%, #e3222b 30%, #a5101a 58%, #ef4a50 80%, #6e0612 100%)",
    voile: "rgba(96,4,12,0.8)",
    onglet: { fond: "#d8212a", encre: "#fff7f6" },
    vive: "#e0262e",
    tranche: { couleur: "#b3141f", metal: 0.4, rugosite: 0.3 },
    holo: { force: 0.8, teinte: [1, 0.55, 0.5] },
  },
  // Défensive : le bleu de cobalt, l'encre blanche, les alvéoles.
  def: {
    nom: "def",
    titre: "DÉFENSIVE",
    encre: "242,247,255",
    sombre: true,
    papier: [
      "radial-gradient(85% 50% at 50% 31%, rgba(150,196,255,0.4) 0%, rgba(150,196,255,0) 70%)",
      "linear-gradient(180deg, rgba(2,8,30,0) 45%, rgba(2,8,30,0.4) 100%)",
      "linear-gradient(152deg, #79aaff 0%, #2f6ae4 24%, #1646b2 48%, #0b2a7a 64%, #2457cf 82%, #061b52 100%)",
    ].join(", "),
    motif: { type: "alveoles", cote: 34, clair: "rgba(200,222,255,0.2)", fonce: "rgba(0,10,40,0.25)" },
    fond: "#173f9c",
    lueur: "rgba(150,190,255,0.35)",
    rayures: 0.07,
    micro: 0.08,
    reflet: 0.24,
    coins: 0.9,
    etiquette: { fond: "#f2f7ff", bord: "#f2f7ff", texte: "#123c96" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(190,215,255,0.75)", ombre: "rgba(0,8,36,0.5)" },
    puce: "linear-gradient(135deg, #dce9ff, #2457cf 45%, #8db8ff 70%, #0b2a75)",
    cadre: "linear-gradient(152deg, #79aaff 0%, #2f6fe6 30%, #1544a8 58%, #4f8cf2 80%, #0b2a75 100%)",
    voile: "rgba(6,26,84,0.8)",
    onglet: { fond: "#2462d9", encre: "#f4f8ff" },
    vive: "#2a6ae6",
    tranche: { couleur: "#1c4cb4", metal: 0.4, rugosite: 0.3 },
    holo: { force: 0.8, teinte: [0.55, 0.75, 1] },
  },
  // Nuit : le ciel de nuit, l'encre d'argent, les étoiles.
  nuit: {
    nom: "nuit",
    titre: "nuit",
    encre: "232,236,244",
    sombre: true,
    papier: [
      "radial-gradient(70% 40% at 74% 12%, rgba(120,140,190,0.28) 0%, rgba(120,140,190,0) 70%)",
      "radial-gradient(110% 70% at 28% 22%, #1d2539 0%, #10141f 52%, #07080c 100%)",
    ].join(", "),
    motif: { type: "etoiles", clair: "rgba(236,240,255,0.9)", fonce: "rgba(170,186,230,0.5)" },
    fond: "#151a28",
    lueur: "rgba(150,170,220,0.22)",
    rayures: 0.06,
    micro: 0.07,
    reflet: 0.14,
    coins: 0.8,
    etiquette: { fond: "transparent", bord: "rgba(232,236,244,0.6)", texte: "rgba(232,236,244,0.85)" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(200,212,240,0.45)", ombre: "rgba(0,0,0,0.6)" },
    puce: "linear-gradient(135deg, #eef1f6, #8d95a6 45%, #d9dde6 70%, #5d6475)",
    cadre: "radial-gradient(110% 70% at 28% 22%, #26304a 0%, #121726 55%, #07080c 100%)",
    voile: "rgba(6,8,16,0.82)",
    onglet: { fond: "#0d111c", encre: "#e8ecf4" },
    vive: "#8fa2d6",
    tranche: { couleur: "#1b2130", metal: 0.3, rugosite: 0.4 },
    holo: { force: 0.55, teinte: [0.72, 0.8, 1] },
  },
  // Chrome : un miroir, des reflets francs, l'encre noire.
  chrome: {
    nom: "chrome",
    titre: "chrome",
    encre: "10,11,13",
    sombre: false,
    papier: [
      "linear-gradient(118deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.65) 46%, rgba(255,255,255,0) 54%)",
      "linear-gradient(172deg, #fbfcfd 0%, #dfe3e8 14%, #a7aeb7 30%, #59606a 43%, #2a2e34 49%, #c8cdd3 52%, #f1f3f5 63%, #b5bbc3 80%, #e8ebee 92%, #8b929b 100%)",
    ].join(", "),
    fond: "#e9ecef",
    lueur: BLANC,
    rayures: 0.06,
    micro: 0.06,
    reflet: 0.6,
    coins: 0.9,
    etiquette: { fond: "#0a0b0d", bord: "#0a0b0d", texte: "#f1f3f5" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,1)", ombre: "rgba(10,11,13,0.35)" },
    puce: "linear-gradient(135deg, #ffffff, #8b929b 45%, #f1f3f5 70%, #59606a)",
    cadre: "linear-gradient(172deg, #fbfcfd 0%, #a7aeb7 30%, #2a2e34 49%, #c8cdd3 52%, #f1f3f5 66%, #8b929b 100%)",
    voile: "rgba(0,0,0,0.55)",
    onglet: { fond: "#e9ecef", encre: "#0a0b0d" },
    vive: "#c8cdd3",
    tranche: { couleur: "#c3c8ce", metal: 0.85, rugosite: 0.18 },
    holo: { force: 1.1, teinte: [0.92, 0.95, 1] },
  },
  // Animée : la nacre irisée, et la lumière qui passe d'elle-même.
  animee: {
    nom: "animee",
    titre: "animée",
    encre: "8,9,11",
    sombre: false,
    papier: [
      "radial-gradient(80% 50% at 50% 30%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 72%)",
      "linear-gradient(135deg, #f6efff 0%, #e6f3ff 22%, #fdf0f4 44%, #eefaf1 66%, #fff6e6 84%, #efeaff 100%)",
    ].join(", "),
    fond: "#ffffff",
    lueur: BLANC,
    rayures: 0.05,
    micro: 0.05,
    reflet: 0.7,
    coins: 0.6,
    etiquette: { fond: "transparent", bord: "rgba(8,9,11,0.5)", texte: "rgba(8,9,11,0.75)" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,1)", ombre: "rgba(70,60,110,0.18)" },
    puce: "linear-gradient(135deg, #ffffff, #c9c3e6 40%, #d8f0ff 62%, #f6d9e8 82%, #b9b3d6)",
    cadre: "linear-gradient(135deg, #e9dcff 0%, #cfe8ff 30%, #ffd9e6 58%, #d6f7df 80%, #ece2ff 100%)",
    voile: "rgba(20,16,40,0.5)",
    onglet: { fond: "#f4f0ff", encre: "#08090b" },
    vive: "#b9a8f0",
    tranche: { couleur: "#e7e2f2", metal: 0.2, rugosite: 0.35 },
    holo: { force: 1.2, teinte: null },
    anime: true,
  },
};

/**
 * La matière d'une carte : son édition, sauf la carte de saison qui prend la
 * finition que le joueur porte.
 */
export function matiereDe(edition: EditionCarte | "rare", habillage?: HabillageCarte): Matiere {
  if (edition === "base" && habillage?.finition) return MATIERES[habillage.finition];
  return MATIERES[edition];
}

/** Un entier stable tiré d'un texte (la même carte garde le même microtexte et le même numéro). */
export function graine(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ (c.codePointAt(0) ?? 0), 16777619) >>> 0;
  return h;
}

/** Le numéro de série d'une carte, recto et verso. */
export function serieDe(nom: string): { serie: string; numero: string } {
  const seed = graine(nom);
  return { serie: `bola-fr-${String(seed % 1000000).padStart(6, "0")}`, numero: `n° ${(seed % 900) + 100} / ∞` };
}

/** Le microtexte « Matrix » de la carte officielle : toujours le même pour un joueur. */
export function microtexte(seed: number, n: number): string {
  const jeu = "0123456789bolaBOLA·/";
  let x = seed || 1;
  let s = "";
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s += jeu[(x >>> 0) % jeu.length];
  }
  return s;
}

// Le logo Bola (public/bola/logo-noir.svg, repère 1000 × 237) : le symbole,
// la lune, et le logotype, pour le dos de la carte.
export const LOGO_BOLA = {
  symbole:
    "M129.373,159.672c0-31.031-25.156-56.187-56.187-56.187s-56.186,25.156-56.186,56.187,25.155,56.186,56.186,56.186c2.52,0,5.001-.166,7.433-.487-16.402-2.773-28.894-17.047-28.894-34.238,0-19.178,15.547-34.725,34.725-34.725s34.725,15.547,34.725,34.725c0,3.507-.52,6.892-1.487,10.084,6.112-8.993,9.684-19.852,9.684-31.545Z",
  logotype:
    "M150.41,214.268h135.756c37.685,0,77.524-16.92,90.359-56.07,1.089,6.989,3.247,13.767,6.551,20.183,22.256,43.233,88.036,53.704,146.925,23.388,22.217-11.437,40.279-27.046,52.964-44.372l-16.428,56.871h187.534l18.794-31.682h66.27l2.906,31.682h91.654l-27.564-181.823h-116.486l-80.903,127.983h-52.168l42.861-127.983h-80.374l-16.212,56.123c-1.099-6.913-3.248-13.618-6.517-19.968-22.256-43.233-88.036-53.704-146.925-23.389-41.471,21.349-68.464,57.232-73.032,91.69-3.028-8.359-9.347-14.684-17.738-17.911l-7.439-2.861c22.822-7.486,49.416-26.571,49.416-53.124,0-24.206-25.65-30.559-45.101-30.559h-132.212l-72.887,181.823ZM460.577,102.781c15.468-20.581,40.511-27.866,55.936-16.274,15.425,11.593,15.391,37.675-.077,58.255-15.467,20.58-40.511,27.866-55.936,16.273-15.425-11.593-15.391-37.675.076-58.255ZM799.323,141.12l35.058-55.744,3.598,55.744h-38.656ZM261.801,139.198h25.214c4.877,0,8.904,5.1,8.904,10.132,0,10.874-11.926,19.419-18.462,19.419h-27.021l11.364-29.552ZM286.573,75.622h22.203c4.938,0,8.307,4.316,8.307,9.187,0,8.268-9.079,17.02-16.663,17.02h-23.917l10.07-26.207Z",
} as const;
