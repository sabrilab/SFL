// La carte de gardien (Sabri, 31/10/2026) : « quand on a un gardien (donc,
// pour les gardiens, leur poste est marqué G), leur faire une carte de
// gardien avec des statistiques de gardien, pas les mêmes stats que les
// joueurs » ; Raouf, le premier.
//
// Un gardien garde les six cases de la carte (la base de sa fiche, les
// jauges d'evolution.ts, la note = moyenne arrondie au-dessus), mais chaque
// case porte une stat de gardien, à la manière des cartes de gardien du jeu
// vidéo :
//   VIT → PLO  plongeon       · +1 quand réflexes et placement prennent un
//                               point dans la même mise à jour ;
//   TIR → RÉF  réflexes       · 1 cran par arrêt ;
//   PAS → DÉG  dégagement     · 1 cran par passe décisive ou par but ;
//   DRI → JMA  jeu à la main  · 3 crans par titre Impact ; +1 quand placement
//                               et physique prennent un point ensemble ;
//   DEF → PLA  placement      · 3 crans par match sans encaisser, 3 par titre
//                               Défensive, 1 pour 2 interceptions ;
//   PHY → PHY  physique       · la série de présence, comme tout le monde.
// Les cases restent rangées sous les mêmes clés partout (Stats, base, votes,
// classements) : seuls les libellés et le barème changent. Une case de
// gardien ne se compare donc jamais à celle d'un joueur de champ.

import type { StatKey } from "./engine";

/** Le poste d'un gardien, tel que l'effectif l'écrit (lib/sfl/inscription.ts). */
export function estGardien(poste: string | null | undefined): boolean {
  return (poste ?? "").trim().toUpperCase() === "G";
}

/** Les libellés courts de la carte, case par case. */
export const ABREGES_GARDIEN: Record<StatKey, string> = {
  VIT: "PLO",
  TIR: "RÉF",
  PAS: "DÉG",
  DRI: "JMA",
  DEF: "PLA",
  PHY: "PHY",
};

/** Les noms en toutes lettres (page Évolution, profil, fiche admin). */
export const NOMS_GARDIEN: Record<StatKey, string> = {
  VIT: "Plongeon",
  TIR: "Réflexes",
  PAS: "Dégagement",
  DRI: "Jeu à la main",
  DEF: "Placement",
  PHY: "Physique",
};

export const NOMS_JOUEUR: Record<StatKey, string> = {
  VIT: "Vitesse",
  TIR: "Tir",
  PAS: "Passe",
  DRI: "Dribble",
  DEF: "Défense",
  PHY: "Physique",
};

/** Le libellé court d'une case : « TIR », ou « RÉF » pour un gardien. */
export function abrege(k: StatKey, gardien: boolean): string {
  return gardien ? ABREGES_GARDIEN[k] : k;
}

/** Le nom d'une case : « Tir », ou « Réflexes » pour un gardien. */
export function nomStat(k: StatKey, gardien: boolean): string {
  return (gardien ? NOMS_GARDIEN : NOMS_JOUEUR)[k];
}
