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
//   · nuit (Passe Bola, palier 5) : un ciel de nuit étoilé, l'encre d'argent ;
//   · chrome (palier 10) : un miroir, des reflets francs ;
//   · animée (palier 15) : la nacre irisée, et la lumière qui passe ;
//   · onyx (offerte, finitions-offertes.ts ; la première, à la carte de
//     Sabri, 24/10 : « une espèce de skin noir ultra stylé ») : la pierre
//     noire polie, ses bandes ondulées gravées comme un guilloché, l'encre
//     d'argent, une tranche de métal noir et un reflet d'argent quand on la
//     tourne ; palier 16 du Passe Bola ;
//   · verre (offerte, la deuxième à la carte de Sabri, 24/10 : « transparente
//     comme du verre, mais que tu gardes un peu les détails de motif […] et
//     que tu trouves un truc stylé pour les chiffres ») : une plaque de verre
//     fumé qui laisse voir ce qu'il y a derrière (la page, et en 3D la
//     tranche de l'autre côté), le guilloché de l'onyx gravé dedans comme un
//     dépoli, l'encre blanche ; la note et le numéro taillés en biseau,
//     creux, leur arête accrochant la lumière (chiffres: "biseau") ;
//   · les skins du Passe Bola (lib/sfl/passe.ts, 24/10), dans
//     skins-passe.ts et motifs-passe.tsx : givre, carbone, marbre, tes
//     couleurs (le pays choisi, HabillageCarte.pays), néon, aurore, ki et
//     météorite ; sans or, sans bleu, sans rouge, qui restent aux cartes à
//     titre (Sabri, 24/10).
//
// Les éditions d'époque (Sabri, 24/10 : « récupérer, pour les joueurs de
// la saison 0, les designs qu'on avait à ce moment-là […] un truc qui
// respecte notre carte actuelle, mais qui fait penser à ça ») : une carte
// d'une saison close garde la disposition d'aujourd'hui, dans les visuels
// de son temps. La saison 0 (été 2026), d'après les visuels officiels du
// 12/07 et les cartes Boost qui ont suivi :
//   · la carte de saison, la « Standard parchemin » : le papier crème, trois
//     coups de pinceau en diagonale (orange, noir, orange) derrière la note
//     et le nom, le sigle SFL souligné d'orange, le poste en braise, les
//     libellés en capitales brunes, un losange au ballon pour puce ;
//   · les cartes à titre, les cartes Boost : MVP du match (l'or), Joueur
//     Impact (la braise), Défensive (la glace) — le fond sombre, sa lumière
//     (des rayons, une traînée, un halo), les particules, le cadre de métal
//     et son filet, l'emblème (couronne, flamme, bouclier).
// Elles ne portent ni la finition ni les signes d'aujourd'hui : une carte
// d'époque est restée telle qu'elle a été émise (lib/sfl/epoques.ts, sa
// date et son numéro, écrits dans sa ligne de série). Les cartes de la
// saison en cours ne changent pas.
// Toutes les cotes sont dans le repère de la carte (1024 × 1656).

import {
  MATIERES_PASSE,
  matiereCouleurs,
  PAYS_PAR_DEFAUT,
  type FinitionPasse,
  type MotifPasse,
} from "@/components/sfl/skins-passe";
import { MATIERE_ARBITRE, MATIERES_ARBITRE, type FinitionArbitre, type MotifArbitre } from "@/components/sfl/skins-arbitre";

/** L'édition d'une carte : la carte de saison, ou une carte à titre. */
export type EditionCarte = "base" | "mvp" | "impact" | "def";

/** Les finitions de la passe, ou offertes : elles habillent la carte de saison. */
export type Finition = "nuit" | "chrome" | "animee" | "onyx" | "verre" | FinitionPasse;

/** Le traitement de la photo, sans IA. */
export type Traitement = "argentique" | "gravure" | "marbre";

/** Les signes distinctifs, à poser en plus. */
// Sans or depuis le 24/10 (Sabri : l'or, le bleu et le rouge restent aux cartes à titre) : le liseré
// or est devenu le double liseré platine, la puce dorée la puce noire.
// Le sifflet et les cartons ne sont qu'aux arbitres (passe-arbitre.ts).
export type Signe = "lisere-argent" | "lisere-platine" | "sceau" | "puce-noire" | "nom-grave" | "sifflet" | "cartons";

/** Le rang du joueur selon son XP, aux couleurs des rangs de mission. */
export type RangCarte = "B" | "A" | "S";

/**
 * Ce que le joueur porte sur sa carte, tout facultatif. Le fil « Missions »
 * dit ce qu'il a débloqué et choisi (useHabillage) ; l'écran de la passe en
 * passe un autre à PlayerCard pour l'essayer.
 */
export interface HabillageCarte {
  finition?: Finition;
  /** « Tes couleurs » : le pays choisi (COULEURS_PAYS, skins-passe.ts). */
  pays?: string;
  traitement?: Traitement;
  signes?: Signe[];
  /** Le cadre, construit coin par coin : de 0 (rien) à 4 (complet). */
  cran?: 0 | 1 | 2 | 3 | 4;
  rang?: RangCarte;
}

/** Les éditions d'époque : les cartes de la saison 0, dans ses visuels. */
export type EditionEpoque = "s0" | "s0-mvp" | "s0-impact" | "s0-def";

/** Les matières : les quatre éditions, les finitions, l'ancienne rare, et les éditions d'époque. */
export type NomMatiere = EditionCarte | Finition | "rare" | EditionEpoque | "arbitre" | FinitionArbitre;

/** Le motif gravé d'une matière (motif-carte.tsx le dessine). */
export type Motif =
  | { type: "rayons"; cx: number; cy: number; n: number }
  | { type: "ondes"; cx: number; cy: number }
  | { type: "alveoles"; cote: number }
  | { type: "etoiles" }
  | { type: "guilloche" }
  /** Les coups de pinceau de la saison 0, centrés en (cx, cy) : orange (clair → foncé), noir, orange. */
  | { type: "pinceau"; cx: number; cy: number; noir: string }
  /** Les particules des cartes Boost de la saison 0. */
  | { type: "particules" }
  /** Les fines rayures de la tenue, sur la carte d'arbitre. */
  | { type: "tenue" }
  | MotifPasse
  | MotifArbitre;

/**
 * Ce qu'une carte d'époque reprend des visuels de son temps, sur la
 * disposition d'aujourd'hui (bola-card.tsx, carte-photo.tsx, dos-carte.tsx,
 * marques-carte.tsx les dessinent).
 */
export interface Epoque {
  saison: number;
  /** Le sigle SFL du coin (à la place du symbole Bola), et la barre dessous. */
  sigle: string;
  barre: string;
  /** L'accent d'alors : le poste, la frange de la note. */
  accent: string;
  /** Le nom. */
  nom: string;
  /** Les libellés en capitales (les stats), le pseudo, la série. */
  libelle: string;
  /** Le cadre de la carte : son métal (du haut à gauche au bas à droite), son épaisseur. */
  bord: { couleurs: string[]; epaisseur: number };
  /** Le filet intérieur des cartes Boost. */
  filet?: string;
  /** L'emblème du coin des cartes Boost. */
  embleme?: "couronne" | "flamme" | "bouclier";
  /** Le losange au ballon, à la place de la puce. */
  losange: { fond: string; trait: string; ballon: string };
}

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
  /**
   * Une matière qu'on voit au travers (le verre) : la face floute un peu ce
   * qu'il y a derrière, la 3D garde la transparence du papier et du dos.
   */
  transparente?: boolean;
  /** La note et le numéro taillés en biseau : creux, une arête de lumière, une ombre portée. */
  chiffres?: "biseau";
  /** Une édition d'époque : ce qu'elle reprend de son temps. */
  epoque?: Epoque;
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
    holo: { force: 0.5, teinte: [1, 0.86, 0.5] },
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
    holo: { force: 0.5, teinte: [1, 0.55, 0.5] },
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
    holo: { force: 0.5, teinte: [0.55, 0.75, 1] },
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
    holo: { force: 0.45, teinte: [0.72, 0.8, 1] },
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
    holo: { force: 0.7, teinte: [0.92, 0.95, 1] },
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
    holo: { force: 0.8, teinte: null },
    anime: true,
  },
  // Onyx : la pierre noire polie et ses bandes en guilloché, l'encre
  // d'argent, la tranche en métal noir, un reflet d'argent froid à peine
  // irisé quand elle tourne (en plein arc-en-ciel, il teintait le visage).
  onyx: {
    nom: "onyx",
    titre: "onyx",
    encre: "236,237,240",
    sombre: true,
    papier: [
      "linear-gradient(118deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.045) 44%, rgba(255,255,255,0) 54%)",
      "radial-gradient(90% 55% at 50% 30%, #1b1c20 0%, #0c0c0f 55%, #050506 100%)",
    ].join(", "),
    motif: { type: "guilloche", clair: "rgba(255,255,255,0.085)", fonce: "rgba(0,0,0,0.55)" },
    fond: "#0d0e11",
    lueur: "rgba(255,255,255,0.06)",
    rayures: 0.04,
    micro: 0.06,
    reflet: 0.1,
    coins: 0.7,
    etiquette: { fond: "#050506", bord: "rgba(236,237,240,0.45)", texte: "rgba(236,237,240,0.9)" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,255,255,0.32)", ombre: "rgba(0,0,0,0.75)" },
    puce: "linear-gradient(135deg, #6a6e77, #17181b 45%, #9a9ea7 70%, #0b0c0e)",
    cadre: "linear-gradient(152deg, #2b2c31 0%, #0d0d10 38%, #1c1d21 62%, #060607 100%)",
    voile: "rgba(4,4,6,0.85)",
    onglet: { fond: "#060607", encre: "#ecedf0" },
    vive: "#c8cbd2",
    tranche: { couleur: "#15161a", metal: 0.85, rugosite: 0.2 },
    holo: { force: 0.38, teinte: [0.86, 0.9, 1] },
  },
  // Verre : une plaque de verre fumé. Le teint laisse passer ce qu'il y a
  // derrière (plus clair en haut, où la lumière entre), un reflet en deux
  // bandes comme sur une vitre, le guilloché de l'onyx gravé en dépoli
  // (clair) avec son ombre dans l'épaisseur, une tranche polie qui brille.
  // Sans couleur : ni or, ni bleu, ni rouge.
  verre: {
    nom: "verre",
    titre: "verre",
    encre: "242,244,247",
    sombre: true,
    papier: [
      "linear-gradient(118deg, rgba(255,255,255,0) 28%, rgba(255,255,255,0.13) 40%, rgba(255,255,255,0.02) 45%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0) 60%)",
      "radial-gradient(130% 70% at 20% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 55%)",
      "linear-gradient(165deg, rgba(40,44,50,0.2) 0%, rgba(16,18,21,0.34) 58%, rgba(8,9,11,0.46) 100%)",
    ].join(", "),
    motif: { type: "guilloche", clair: "rgba(255,255,255,0.17)", fonce: "rgba(0,0,0,0.2)" },
    fond: "rgba(18,20,24,0.55)",
    lueur: "rgba(255,255,255,0.1)",
    rayures: 0.05,
    micro: 0.08,
    reflet: 0.12,
    coins: 0.8,
    etiquette: { fond: "rgba(255,255,255,0.08)", bord: "rgba(242,244,247,0.6)", texte: "rgba(242,244,247,0.95)" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,255,255,0.6)", ombre: "rgba(0,0,0,0.55)" },
    puce: "linear-gradient(135deg, rgba(255,255,255,0.7), rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.5) 70%, rgba(255,255,255,0.08))",
    cadre: "linear-gradient(152deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.14) 38%, rgba(255,255,255,0.42) 64%, rgba(255,255,255,0.1) 100%)",
    voile: "rgba(6,7,9,0.72)",
    onglet: { fond: "rgba(8,9,11,0.7)", encre: "#f2f4f7" },
    vive: "#e4e8ec",
    tranche: { couleur: "#9aa2aa", metal: 0.9, rugosite: 0.06 },
    holo: { force: 0.38, teinte: [0.9, 0.94, 1] },
    transparente: true,
    chiffres: "biseau",
  },
  // L'arbitre : le jaune fluo de sa chasuble (Sabri, 24/10 : « même sa carte
  // principale à lui soit soit jaune, soit orange fluo »), dessiné dans
  // skins-arbitre.ts avec ses skins.
  arbitre: MATIERE_ARBITRE,
  // Saison 0, la carte de saison : la « Standard parchemin » du 12/07. Le
  // papier crème, ses coups de pinceau derrière la note et le nom.
  s0: {
    nom: "s0",
    titre: "saison 0",
    encre: "24,19,16",
    sombre: false,
    papier: [
      "radial-gradient(90% 55% at 50% 30%, rgba(255,251,240,0.5) 0%, rgba(255,251,240,0) 70%)",
      "linear-gradient(170deg, #f1e6cb 0%, #eadbb8 55%, #e2cfa6 100%)",
    ].join(", "),
    motif: { type: "pinceau", cx: 512, cy: 1290, noir: "#181310", clair: "#c86428", fonce: "#9a4517" },
    fond: "#f3e9d0",
    lueur: "rgba(255,250,236,0.9)",
    rayures: 0.05,
    micro: 0.05,
    reflet: 0.26,
    coins: 0.55,
    etiquette: { fond: "transparent", bord: "rgba(138,100,55,0.6)", texte: "#8a6437" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,251,240,0.9)", ombre: "rgba(92,62,20,0.24)" },
    puce: "linear-gradient(135deg, #f1e6cb, #c9b488 45%, #eadbb8 70%, #a8915f)",
    cadre: "linear-gradient(160deg, #f4ead2 0%, #e6d5ae 55%, #d2bd8c 100%)",
    voile: "rgba(40,26,10,0.74)",
    onglet: { fond: "linear-gradient(90deg, #c05a1e, #7a340f)", encre: "#f6eedc" },
    vive: "#f39a5c",
    tranche: { couleur: "#e2cfa6", metal: 0.05, rugosite: 0.8 },
    holo: { force: 0.18, teinte: [1, 0.86, 0.68] },
    epoque: {
      saison: 0,
      sigle: "#181310",
      barre: "linear-gradient(90deg, #c05a1e, #7a340f)",
      accent: "#b4551f",
      nom: "#181310",
      libelle: "#8a6437",
      bord: { couleurs: ["#dccb9f", "#c9b488", "#b49e6d"], epaisseur: 7 },
      losange: { fond: "#e2cfa6", trait: "#b49e6d", ballon: "#181310" },
    },
  },
  // Saison 0, les cartes Boost : le fond sombre et sa lumière, les
  // particules, le cadre de métal et son filet, l'emblème. MVP du match : l'or.
  "s0-mvp": {
    nom: "s0-mvp",
    titre: "MVP du match",
    encre: "244,228,166",
    sombre: true,
    papier: [
      "linear-gradient(180deg, rgba(6,4,2,0.45) 0%, rgba(6,4,2,0) 20%, rgba(6,4,2,0) 60%, rgba(6,4,2,0.7) 80%, rgba(6,4,2,0.9) 100%)",
      "conic-gradient(from 210deg at 50% 31%, rgba(244,197,66,0.55), rgba(244,197,66,0) 40%, rgba(244,197,66,0.32) 60%, rgba(244,197,66,0) 82%)",
      "radial-gradient(130% 110% at 50% 8%, #241a06 0%, #120c03 48%, #060402 100%)",
    ].join(", "),
    motif: { type: "particules", clair: "#f4c542", fonce: "rgba(244,197,66,0.45)" },
    fond: "#1a1305",
    lueur: "rgba(244,197,66,0.22)",
    rayures: 0.05,
    micro: 0.06,
    reflet: 0.14,
    coins: 0.8,
    etiquette: { fond: "#0c0804", bord: "rgba(244,197,66,0.75)", texte: "#fcebb0" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,243,198,0.5)", ombre: "rgba(0,0,0,0.6)" },
    puce: "linear-gradient(135deg, #fff3c6, #c9962e 45%, #fbe9a8 70%, #8a5a12)",
    cadre: "linear-gradient(160deg, #fff3c6 0%, #f4c542 22%, #8a5a12 50%, #fbe9a8 75%, #c9962e 100%)",
    voile: "rgba(18,12,3,0.86)",
    onglet: { fond: "#0c0804", encre: "#f4c542" },
    vive: "#f4c542",
    tranche: { couleur: "#c9962e", metal: 0.6, rugosite: 0.3 },
    holo: { force: 0.5, teinte: [1, 0.85, 0.45] },
    epoque: {
      saison: 0,
      sigle: "#ffffff",
      barre: "linear-gradient(90deg, #ffcf5c, #8a5a12)",
      accent: "#f4c542",
      nom: "#f4c542",
      libelle: "#b98f32",
      bord: { couleurs: ["#fff3c6", "#f4c542", "#8a5a12", "#fbe9a8", "#c9962e"], epaisseur: 14 },
      filet: "rgba(244,197,66,0.34)",
      embleme: "couronne",
      losange: { fond: "#0c0804", trait: "#f4c542", ballon: "#f4c542" },
    },
  },
  // Joueur Impact : la braise, et sa traînée de lumière en diagonale.
  "s0-impact": {
    nom: "s0-impact",
    titre: "Joueur Impact",
    encre: "252,233,221",
    sombre: true,
    papier: [
      "linear-gradient(180deg, rgba(10,4,2,0.45) 0%, rgba(10,4,2,0) 20%, rgba(10,4,2,0) 60%, rgba(10,4,2,0.7) 80%, rgba(10,4,2,0.9) 100%)",
      "linear-gradient(115deg, rgba(255,90,31,0) 25%, rgba(255,90,31,0.5) 45%, rgba(255,160,70,0.7) 55%, rgba(255,90,31,0.38) 65%, rgba(255,90,31,0) 82%)",
      "radial-gradient(130% 110% at 50% 6%, #360c02 0%, #1a0601 50%, #0a0402 100%)",
    ].join(", "),
    motif: { type: "particules", clair: "#ff8a4a", fonce: "rgba(255,138,74,0.45)" },
    fond: "#240802",
    lueur: "rgba(255,138,74,0.22)",
    rayures: 0.05,
    micro: 0.06,
    reflet: 0.14,
    coins: 0.8,
    etiquette: { fond: "#1a0601", bord: "rgba(255,122,63,0.75)", texte: "#fee3d2" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,184,138,0.5)", ombre: "rgba(0,0,0,0.6)" },
    puce: "linear-gradient(135deg, #ffb88a, #b33e0e 45%, #ff8a4a 70%, #7a1e05)",
    cadre: "linear-gradient(160deg, #ffb88a 0%, #ff5a1f 25%, #7a1e05 50%, #ff8a4a 75%, #b33e0e 100%)",
    voile: "rgba(26,6,1,0.86)",
    onglet: { fond: "#1a0601", encre: "#ff8a4a" },
    vive: "#ff8a4a",
    tranche: { couleur: "#b33e0e", metal: 0.5, rugosite: 0.3 },
    holo: { force: 0.5, teinte: [1, 0.6, 0.4] },
    epoque: {
      saison: 0,
      sigle: "#ffffff",
      barre: "linear-gradient(90deg, #ff8a4a, #7a1e05)",
      accent: "#ff8a4a",
      nom: "#ff8a4a",
      libelle: "#c77c4e",
      bord: { couleurs: ["#ffb88a", "#ff5a1f", "#7a1e05", "#ff8a4a", "#b33e0e"], epaisseur: 14 },
      filet: "rgba(255,122,63,0.34)",
      embleme: "flamme",
      losange: { fond: "#1a0601", trait: "#ff7a3f", ballon: "#ff8a4a" },
    },
  },
  // Défensive : la glace, et son halo derrière le portrait.
  "s0-def": {
    nom: "s0-def",
    titre: "Défensive",
    encre: "226,244,255",
    sombre: true,
    papier: [
      "linear-gradient(180deg, rgba(3,10,16,0.45) 0%, rgba(3,10,16,0) 20%, rgba(3,10,16,0) 60%, rgba(3,10,16,0.7) 80%, rgba(3,10,16,0.9) 100%)",
      "radial-gradient(70% 50% at 50% 34%, rgba(80,190,255,0.5), rgba(80,190,255,0) 62%)",
      "radial-gradient(130% 110% at 50% 14%, #0f2c42 0%, #081a28 50%, #04070f 100%)",
    ].join(", "),
    motif: { type: "particules", clair: "#7fd4ff", fonce: "rgba(127,212,255,0.45)" },
    fond: "#0b2133",
    lueur: "rgba(127,212,255,0.22)",
    rayures: 0.05,
    micro: 0.06,
    reflet: 0.14,
    coins: 0.8,
    etiquette: { fond: "#081a28", bord: "rgba(127,212,255,0.75)", texte: "#e2f4ff" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(216,241,255,0.5)", ombre: "rgba(0,0,0,0.6)" },
    puce: "linear-gradient(135deg, #d8f1ff, #2e6e99 45%, #a6e3ff 70%, #1c4e77)",
    cadre: "linear-gradient(160deg, #d8f1ff 0%, #7fd4ff 25%, #1c4e77 50%, #a6e3ff 75%, #2e6e99 100%)",
    voile: "rgba(8,26,40,0.86)",
    onglet: { fond: "#081a28", encre: "#7fd4ff" },
    vive: "#7fd4ff",
    tranche: { couleur: "#2e6e99", metal: 0.5, rugosite: 0.3 },
    holo: { force: 0.5, teinte: [0.6, 0.85, 1] },
    epoque: {
      saison: 0,
      sigle: "#ffffff",
      barre: "linear-gradient(90deg, #7fd4ff, #1c4e77)",
      accent: "#7fd4ff",
      nom: "#a6e3ff",
      libelle: "#5b8fb5",
      bord: { couleurs: ["#d8f1ff", "#7fd4ff", "#1c4e77", "#a6e3ff", "#2e6e99"], epaisseur: 14 },
      filet: "rgba(127,212,255,0.34)",
      embleme: "bouclier",
      losange: { fond: "#081a28", trait: "#7fd4ff", ballon: "#7fd4ff" },
    },
  },
  // Les skins du Passe Bola (skins-passe.ts) ; « Tes couleurs » au pays par
  // défaut, celui du joueur passe par matiereDe.
  ...MATIERES_PASSE,
  ...MATIERES_ARBITRE,
  couleurs: matiereCouleurs(PAYS_PAR_DEFAUT),
};

/**
 * Les saisons closes qui ont leur édition d'époque : la matière de chacune
 * de leurs éditions (Sabri, 24/10). La saison 0 seulement, pour l'instant.
 */
const EDITIONS_D_EPOQUE: Partial<Record<number, Record<EditionCarte | "rare", EditionEpoque>>> = {
  0: { base: "s0", rare: "s0", mvp: "s0-mvp", impact: "s0-impact", def: "s0-def" },
};

/** Les cartes de cette saison ont-elles leur édition d'époque ? */
export function aSonEpoque(saison: number | null | undefined): saison is number {
  return saison != null && EDITIONS_D_EPOQUE[saison] != null;
}

/**
 * La matière d'une carte : son édition, sauf la carte de saison qui prend la
 * finition que le joueur porte (« Tes couleurs » au pays de son habillage).
 * Une carte d'une saison qui a son édition d'époque (`saison`) prend la
 * matière de son temps, sans finition.
 */
export function matiereDe(edition: EditionCarte | "rare", habillage?: HabillageCarte, saison?: number | null): Matiere {
  if (aSonEpoque(saison)) return MATIERES[EDITIONS_D_EPOQUE[saison]![edition]];
  if (edition === "base" && habillage?.finition)
    return habillage.finition === "couleurs" ? matiereCouleurs(habillage.pays) : MATIERES[habillage.finition];
  return MATIERES[edition];
}

/** La matière d'un nom (data-matiere, que lit la 3D), « Tes couleurs » au pays de l'habillage ; null si inconnu. */
export function matiereDuNom(nom: string, habillage?: HabillageCarte): Matiere | null {
  if (nom === "couleurs") return matiereCouleurs(habillage?.pays);
  return nom in MATIERES ? MATIERES[nom as NomMatiere] : null;
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

/** Les métaux des signes (liserés, crans, puce) : un dégradé qui accroche la lumière, du haut à gauche au bas à droite. */
export const METAUX = {
  argent: ["#ffffff", "#c9ccd2", "#8a9099", "#eef0f3", "#a3a8b0"],
  or: ["#fff4cc", "#e7c46a", "#a8761f", "#f6dc92", "#b98a2c"],
  /** Le platine : plus blanc et plus froid que l'argent ; le liseré platine est double. */
  platine: ["#ffffff", "#eceef2", "#b6bac2", "#ffffff", "#d3d6dc"],
} as const;
export type Metal = keyof typeof METAUX;

/** La puce noire (signe « puce-noire ») : du noir laqué, ses contacts en argent. */
export const PUCE_NOIRE = "linear-gradient(135deg, #4a4b51, #0c0c0e 42%, #2b2c31 68%, #050506)";

/**
 * Les couleurs des rangs, recopiées de actus/missions.css (.fiche--S, --A,
 * --B : la lueur, le feu, le sombre) : l'insigne de la carte est celui des
 * fiches de mission. S l'or, A le mauve, B l'argent.
 */
export const RANGS: Record<RangCarte, { lueur: string; feu: string; sombre: string }> = {
  S: { lueur: "240,196,92", feu: "255,238,196", sombre: "#5a3f06" },
  A: { lueur: "228,150,198", feu: "253,232,243", sombre: "#5b2141" },
  B: { lueur: "222,227,236", feu: "246,248,252", sombre: "#3d434d" },
};

/** Le liseré porté : le platine (double) remplace l'argent. */
export function lisereDe(habillage?: HabillageCarte): Metal | null {
  const s = habillage?.signes ?? [];
  return s.includes("lisere-platine") ? "platine" : s.includes("lisere-argent") ? "argent" : null;
}

/** Les initiales du sceau : la première lettre des deux premiers mots du nom. */
export function initiales(nom: string): string {
  return nom
    .trim()
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((m) => m.slice(0, 1).toUpperCase())
    .join("");
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

/**
 * Le microtexte, son nom gravé dedans (signe « nom-grave ») : des morceaux
 * de microtexte, et le nom glissé tous les ~70 signes, à trouver de près.
 */
export function microtexteGrave(seed: number, n: number, nom: string): { texte: string; nom: boolean }[] {
  const brut = microtexte(seed, n);
  const mot = `·${nom.toUpperCase().replace(/\s+/g, "·")}·`;
  const out: { texte: string; nom: boolean }[] = [];
  let i = 0;
  let k = 0;
  while (i < brut.length) {
    const pas = 52 + ((seed >>> (k % 24)) % 37);
    out.push({ texte: brut.slice(i, i + pas), nom: false }, { texte: mot, nom: true });
    i += pas;
    k++;
  }
  return out;
}

// Le logo Bola (public/bola/logo-noir.svg, repère 1000 × 237) : le symbole,
// la lune, et le logotype, pour le dos de la carte.
export const LOGO_BOLA = {
  symbole:
    "M129.373,159.672c0-31.031-25.156-56.187-56.187-56.187s-56.186,25.156-56.186,56.187,25.155,56.186,56.186,56.186c2.52,0,5.001-.166,7.433-.487-16.402-2.773-28.894-17.047-28.894-34.238,0-19.178,15.547-34.725,34.725-34.725s34.725,15.547,34.725,34.725c0,3.507-.52,6.892-1.487,10.084,6.112-8.993,9.684-19.852,9.684-31.545Z",
  logotype:
    "M150.41,214.268h135.756c37.685,0,77.524-16.92,90.359-56.07,1.089,6.989,3.247,13.767,6.551,20.183,22.256,43.233,88.036,53.704,146.925,23.388,22.217-11.437,40.279-27.046,52.964-44.372l-16.428,56.871h187.534l18.794-31.682h66.27l2.906,31.682h91.654l-27.564-181.823h-116.486l-80.903,127.983h-52.168l42.861-127.983h-80.374l-16.212,56.123c-1.099-6.913-3.248-13.618-6.517-19.968-22.256-43.233-88.036-53.704-146.925-23.389-41.471,21.349-68.464,57.232-73.032,91.69-3.028-8.359-9.347-14.684-17.738-17.911l-7.439-2.861c22.822-7.486,49.416-26.571,49.416-53.124,0-24.206-25.65-30.559-45.101-30.559h-132.212l-72.887,181.823ZM460.577,102.781c15.468-20.581,40.511-27.866,55.936-16.274,15.425,11.593,15.391,37.675-.077,58.255-15.467,20.58-40.511,27.866-55.936,16.273-15.425-11.593-15.391-37.675.076-58.255ZM799.323,141.12l35.058-55.744,3.598,55.744h-38.656ZM261.801,139.198h25.214c4.877,0,8.904,5.1,8.904,10.132,0,10.874-11.926,19.419-18.462,19.419h-27.021l11.364-29.552ZM286.573,75.622h22.203c4.938,0,8.307,4.316,8.307,9.187,0,8.268-9.079,17.02-16.663,17.02h-23.917l10.07-26.207Z",
} as const;
