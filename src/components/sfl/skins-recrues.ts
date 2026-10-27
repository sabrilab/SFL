// Les skins des recrues (Sabri, 27/10/2026) : ce que gagne celui qui fait
// venir des joueurs, une fois qu'ils ont vraiment joué (lib/sfl/recrues.ts ;
// supabase/schema.sql, recrues). Une seule table, PALIERS_RECRUES, que lisent
// la page Inviter, Personnaliser ma carte et le déblocage (use-habillage.ts) :
//   · 1 recrue active : +100 XP, et autant pour chaque suivante, sans plafond ;
//   · 3 : Recruteur, le papier blanc de la carte de saison, des rosaces
//     guillochées autour de la note, les repères d'angle appuyés ; au dos,
//     l'inverse, papier noir et encre blanche ;
//   · 5 : Filigrane, un papier blanc presque plat, le nom du joueur en
//     filigrane, ton sur ton, comme dans le papier d'un billet ;
//   · 10 : Fondateur, la carte seule (aucun autre avantage), numérotée
//     « FONDATEUR · N° 097 / 500 » dans l'ordre où chacun atteint 10, jamais
//     réémise : ceux qui ont lancé la première grande vague de Bola.
// Noir et blanc strict : ni or, ni bleu cobalt, ni rouge laqué (ils restent
// aux cartes MVP, Défensive et Impact). Le luxe, c'est le métier de
// l'imprimeur (guilloché, rosace, microtexte, numéro de série, repères de
// coupe), jamais des paillettes ni des dégradés de couleur.
//
// Ce fichier n'importe que des types de finitions-carte.ts : c'est elle qui
// l'importe (pas de cycle). Les motifs sont dans motifs-recrues.tsx.

import type { Matiere } from "@/components/sfl/finitions-carte";

export type FinitionRecrue = "recruteur" | "filigrane" | "fondateur";

/** Les motifs des skins des recrues (motifs-recrues.tsx les dessine). */
export type MotifRecrue = { type: "recruteur" } | { type: "filigrane" } | { type: "fondateur" };

const TYPES_MOTIF_RECRUE = new Set<string>(["recruteur", "filigrane", "fondateur"]);

export function estMotifRecrue(m: { type: string }): m is MotifRecrue {
  return TYPES_MOTIF_RECRUE.has(m.type);
}

export const FINITIONS_RECRUES: readonly FinitionRecrue[] = ["recruteur", "filigrane", "fondateur"];

/** Les places de Fondateur : au-delà, fermé pour toujours. */
export const FONDATEURS_MAX = 500;

/** XP par recrue active. */
export const XP_RECRUE = 100;

export interface PalierRecrues {
  /** Les recrues actives qu'il faut. */
  n: number;
  titre: string;
  /** Ce qu'il donne, en court (la page Inviter). */
  donne: string;
  finition?: FinitionRecrue;
}

export const PALIERS_RECRUES: readonly PalierRecrues[] = [
  { n: 1, titre: "Première recrue", donne: `+${XP_RECRUE} XP par recrue` },
  { n: 3, titre: "Recruteur", donne: "Skin Recruteur", finition: "recruteur" },
  { n: 5, titre: "Filigrane", donne: "Skin Filigrane", finition: "filigrane" },
  { n: 10, titre: "Fondateur", donne: `Carte Fondateur · n° sur ${FONDATEURS_MAX}`, finition: "fondateur" },
];

/** Ce que Personnaliser ma carte dit d'un skin des recrues. */
export const SKINS_RECRUES: Readonly<Record<FinitionRecrue, { titre: string; quoi: string; n: number }>> = {
  recruteur: { titre: "Recruteur", quoi: "Rosaces guillochées, le dos en noir.", n: 3 },
  filigrane: { titre: "Filigrane", quoi: "Ton nom en filigrane dans le papier.", n: 5 },
  fondateur: { titre: "Fondateur", quoi: `Numérotée sur ${FONDATEURS_MAX}, jamais réémise.`, n: 10 },
};

/** Les skins qu'ouvrent `actives` recrues actives, et le numéro de Fondateur. */
export function finitionsRecrues(actives: number, fondateur: number | null | undefined): FinitionRecrue[] {
  const out: FinitionRecrue[] = [];
  for (const p of PALIERS_RECRUES) if (p.finition && p.finition !== "fondateur" && actives >= p.n) out.push(p.finition);
  // Le Fondateur tient à son numéro, posé une fois pour toutes : il reste même
  // si des recrues partent ensuite.
  if (fondateur) out.push("fondateur");
  return out;
}

/** La ligne de série d'une carte Fondateur : « FONDATEUR · N° 097 / 500 ». */
export function numeroFondateur(n: number): string {
  return `FONDATEUR · N° ${String(n).padStart(3, "0")} / ${FONDATEURS_MAX}`;
}

// Les tons : l'encre de la carte (#08090b) et ses blancs, rien d'autre.
const BLANC = "rgba(255,255,255,0.95)";
const PAPIER_BLANC = "linear-gradient(160deg, #fcfcfa 0%, #f1f1ed 55%, #e9e9e4 100%)";
const PUCE_ARGENT = "linear-gradient(135deg, #f3f3f1, #b9bab5 45%, #e6e6e3 70%, #a7a8a3)";

export const MATIERES_RECRUES: Record<FinitionRecrue, Matiere> = {
  // Recruteur : la carte de saison, des rosaces guillochées à l'encre noire
  // autour de la note, les repères d'angle appuyés, l'étiquette en noir
  // plein ; au dos, papier noir, encre blanche.
  recruteur: {
    nom: "recruteur",
    titre: "recruteur",
    encre: "8,9,11",
    sombre: false,
    papier: PAPIER_BLANC,
    motif: { type: "recruteur", clair: "rgba(8,9,11,0.085)", fonce: "rgba(255,255,255,0.8)" },
    fond: "#ffffff",
    lueur: BLANC,
    rayures: 0.05,
    micro: 0.05,
    reflet: 0.3,
    coins: 0.85,
    etiquette: { fond: "#08090b", bord: "#08090b", texte: "#f5f5f3" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,0.9)", ombre: "rgba(8,9,11,0.14)" },
    puce: PUCE_ARGENT,
    cadre: "#08090b",
    voile: "rgba(0,0,0,0.5)",
    onglet: { fond: "#08090b", encre: "#f5f5f3" },
    vive: "#f5f5f3",
    tranche: { couleur: "#0b0c0e", metal: 0.2, rugosite: 0.55 },
    holo: { force: 0.22, teinte: [0.95, 0.96, 0.97] },
    dos: {
      encre: "244,244,240",
      sombre: true,
      papier: "#0a0b0d",
      micro: 0.06,
      reflet: 0.12,
      rebord: { lumiere: "rgba(255,255,255,0.32)", ombre: "rgba(0,0,0,0.7)" },
    },
  },
  // Filigrane : un papier blanc presque plat, le nom du joueur en capitales,
  // en rangs décalés, ton sur ton (une arête blanche sur une ombre à peine
  // marquée : dans le papier, pas imprimé dessus).
  filigrane: {
    nom: "filigrane",
    titre: "filigrane",
    encre: "8,9,11",
    sombre: false,
    papier: "#fbfbf8",
    motif: { type: "filigrane", clair: "rgba(255,255,255,0.92)", fonce: "rgba(8,9,11,0.055)" },
    fond: "#ffffff",
    lueur: BLANC,
    rayures: 0.03,
    micro: 0.025,
    reflet: 0.25,
    coins: 0.6,
    etiquette: { fond: "transparent", bord: "rgba(8,9,11,0.35)", texte: "rgba(8,9,11,0.7)" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,0.95)", ombre: "rgba(8,9,11,0.1)" },
    puce: PUCE_ARGENT,
    cadre: "#f4f4f1",
    voile: "rgba(0,0,0,0.45)",
    onglet: { fond: "#08090b", encre: "#f5f5f3" },
    vive: "#f5f5f3",
    tranche: { couleur: "#f2f2ee", metal: 0.05, rugosite: 0.7 },
    holo: { force: 0.18, teinte: [0.95, 0.96, 0.97] },
  },
  // Fondateur : le papier blanc, gravé d'un guilloché graphite et d'une
  // grande rosace sous les stats, le microtexte plus présent, les repères de
  // coupe pleins, l'étiquette en noir ; la série dit son numéro
  // (numeroFondateur, bola-card.tsx et dos-carte.tsx).
  fondateur: {
    nom: "fondateur",
    titre: "fondateur",
    encre: "8,9,11",
    sombre: false,
    papier: PAPIER_BLANC,
    motif: { type: "fondateur", clair: "rgba(8,9,11,0.07)", fonce: "rgba(255,255,255,0.85)" },
    fond: "#ffffff",
    lueur: BLANC,
    rayures: 0.05,
    micro: 0.07,
    reflet: 0.3,
    coins: 1,
    etiquette: { fond: "#08090b", bord: "#08090b", texte: "#f5f5f3" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,0.9)", ombre: "rgba(8,9,11,0.16)" },
    puce: PUCE_ARGENT,
    cadre: "#08090b",
    voile: "rgba(0,0,0,0.5)",
    onglet: { fond: "#08090b", encre: "#f5f5f3" },
    vive: "#f5f5f3",
    tranche: { couleur: "#e4e4df", metal: 0.1, rugosite: 0.6 },
    holo: { force: 0.2, teinte: [0.95, 0.96, 0.97] },
  },
};
