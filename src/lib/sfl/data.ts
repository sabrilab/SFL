// Données Saison 1 — portées depuis refonte_STATS.xlsx (après la journée 5).
// Totaux (PP, matchs, buts, passes, MVP/Impact/Défensive) recalculés depuis la
// feuille SAISIE MATCH ; stats de carte et postes depuis JOUEURS & RÈGLES.
// Les joueurs invités sans carte renseignée dans le classeur ont une carte de
// base neutre (75) en attendant une notation officielle — poste « — ».
// À terme, ces données viendront d'une base alimentée par l'interface admin.

import type { BoostCardData, Journee, MatchTeam, Player } from "./engine";

export const PLAYERS: Player[] = [
  { name: "Ilyes", poste: "MC/AT", pp: 44, matchs: 4, buts: 20, passes: 6, statut: "Actif", stats: { VIT: 81, TIR: 85, PAS: 86, DRI: 90, DEF: 72, PHY: 66 }, mvp: 3, impact: 3, def: 0 },
  { name: "Ilies", poste: "AD", pp: 39, matchs: 4, buts: 14, passes: 10, statut: "Actif", stats: { VIT: 84, TIR: 82, PAS: 83, DRI: 88, DEF: 77, PHY: 80 }, mvp: 1, impact: 2, def: 0 },
  { name: "Anis", poste: "DC", pp: 28, matchs: 4, buts: 8, passes: 9, statut: "Actif", stats: { VIT: 72, TIR: 77, PAS: 71, DRI: 72, DEF: 80, PHY: 83 }, mvp: 0, impact: 0, def: 2 },
  { name: "Smail", poste: "MC/MDC", pp: 28, matchs: 4, buts: 9, passes: 6, statut: "Actif", stats: { VIT: 76, TIR: 75, PAS: 76, DRI: 78, DEF: 87, PHY: 88 }, mvp: 0, impact: 2, def: 1 },
  { name: "Yanis", poste: "MC/MDC", pp: 25, matchs: 4, buts: 10, passes: 6, statut: "Actif", stats: { VIT: 73, TIR: 74, PAS: 77, DRI: 77, DEF: 79, PHY: 78 }, mvp: 0, impact: 0, def: 0 },
  { name: "Kader", poste: "MC/AT", pp: 23, matchs: 4, buts: 8, passes: 7, statut: "Actif", stats: { VIT: 78, TIR: 78, PAS: 79, DRI: 84, DEF: 80, PHY: 82 }, mvp: 1, impact: 1, def: 0 },
  { name: "Badis", poste: "MC/MDC", pp: 22, matchs: 3, buts: 7, passes: 4, statut: "Actif", stats: { VIT: 77, TIR: 76, PAS: 75, DRI: 78, DEF: 88, PHY: 90 }, mvp: 0, impact: 2, def: 1 },
  { name: "Souley", poste: "AT", pp: 22, matchs: 3, buts: 10, passes: 5, statut: "Actif", stats: { VIT: 78, TIR: 80, PAS: 84, DRI: 86, DEF: 86, PHY: 91 }, mvp: 0, impact: 0, def: 0 },
  { name: "Sidali", poste: "MC/AG", pp: 21, matchs: 4, buts: 7, passes: 5, statut: "Actif", stats: { VIT: 78, TIR: 77, PAS: 82, DRI: 85, DEF: 82, PHY: 77 }, mvp: 0, impact: 0, def: 2 },
  { name: "Mehdi", poste: "MDC", pp: 18, matchs: 3, buts: 6, passes: 5, statut: "Actif", stats: { VIT: 74, TIR: 73, PAS: 75, DRI: 76, DEF: 83, PHY: 88 }, mvp: 0, impact: 0, def: 0 },
  { name: "Zakary", poste: "MC", pp: 18, matchs: 2, buts: 8, passes: 6, statut: "Actif", stats: { VIT: 73, TIR: 83, PAS: 83, DRI: 80, DEF: 88, PHY: 85 }, mvp: 0, impact: 1, def: 0 },
  { name: "Bilal", poste: "MC", pp: 17, matchs: 3, buts: 2, passes: 8, statut: "Actif", stats: { VIT: 76, TIR: 77, PAS: 74, DRI: 78, DEF: 78, PHY: 77 }, mvp: 0, impact: 0, def: 0 },
  { name: "Ryad", poste: "MC", pp: 18, matchs: 4, buts: 4, passes: 5, statut: "Actif", stats: { VIT: 77, TIR: 80, PAS: 79, DRI: 81, DEF: 77, PHY: 78 }, mvp: 0, impact: 0, def: 0 },
  { name: "Yamin", poste: "MC/MDC", pp: 17, matchs: 3, buts: 6, passes: 4, statut: "Actif", stats: { VIT: 85, TIR: 80, PAS: 82, DRI: 78, DEF: 80, PHY: 83 }, mvp: 0, impact: 0, def: 1 },
  { name: "Wadi", poste: "AT", pp: 16, matchs: 2, buts: 1, passes: 6, statut: "Actif", stats: { VIT: 86, TIR: 80, PAS: 80, DRI: 78, DEF: 80, PHY: 80 }, mvp: 1, impact: 1, def: 1 },
  { name: "Naim", poste: "DC", pp: 15, matchs: 4, buts: 3, passes: 3, statut: "Actif", stats: { VIT: 65, TIR: 73, PAS: 78, DRI: 77, DEF: 76, PHY: 63 }, mvp: 0, impact: 0, def: 0 },
  { name: "Jouneid", poste: "—", pp: 14, matchs: 1, buts: 6, passes: 2, statut: "Actif", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 1, impact: 1, def: 0 },
  { name: "Zakaria", poste: "MC", pp: 14, matchs: 3, buts: 3, passes: 2, statut: "Actif", stats: { VIT: 77, TIR: 78, PAS: 77, DRI: 79, DEF: 76, PHY: 77 }, mvp: 0, impact: 0, def: 0 },
  { name: "Ibrahim", poste: "DC", pp: 13, matchs: 3, buts: 3, passes: 4, statut: "Actif", stats: { VIT: 72, TIR: 80, PAS: 79, DRI: 76, DEF: 83, PHY: 81 }, mvp: 0, impact: 0, def: 0 },
  { name: "Sofiane", poste: "AT", pp: 13, matchs: 2, buts: 4, passes: 3, statut: "Actif", stats: { VIT: 82, TIR: 81, PAS: 75, DRI: 77, DEF: 79, PHY: 80 }, mvp: 0, impact: 0, def: 2 },
  { name: "Yacine", poste: "MC/AT", pp: 13, matchs: 4, buts: 3, passes: 4, statut: "Actif", stats: { VIT: 79, TIR: 80, PAS: 83, DRI: 83, DEF: 79, PHY: 79 }, mvp: 0, impact: 0, def: 0 },
  { name: "Moussa", poste: "DC/MDC", pp: 11, matchs: 3, buts: 2, passes: 4, statut: "Actif", stats: { VIT: 77, TIR: 84, PAS: 75, DRI: 72, DEF: 89, PHY: 89 }, mvp: 0, impact: 0, def: 1 },
  { name: "Ayman", poste: "DD", pp: 10, matchs: 3, buts: 3, passes: 1, statut: "Actif", stats: { VIT: 74, TIR: 73, PAS: 75, DRI: 74, DEF: 77, PHY: 80 }, mvp: 0, impact: 0, def: 1 },
  { name: "Azzedine", poste: "DG", pp: 10, matchs: 3, buts: 4, passes: 2, statut: "Actif", stats: { VIT: 68, TIR: 67, PAS: 67, DRI: 65, DEF: 69, PHY: 72 }, mvp: 0, impact: 0, def: 0 },
  { name: "Adil", poste: "MDC", pp: 9, matchs: 4, buts: 1, passes: 3, statut: "Actif", stats: { VIT: 77, TIR: 75, PAS: 72, DRI: 70, DEF: 77, PHY: 83 }, mvp: 0, impact: 0, def: 0 },
  { name: "Kamil", poste: "—", pp: 9, matchs: 1, buts: 3, passes: 2, statut: "Actif", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 0, impact: 1, def: 0 },
  { name: "Kylian", poste: "MC", pp: 9, matchs: 1, buts: 2, passes: 4, statut: "Blessure", stats: { VIT: 86, TIR: 82, PAS: 86, DRI: 84, DEF: 75, PHY: 80 }, mvp: 0, impact: 0, def: 0 },
  { name: "Omar", poste: "MC", pp: 9, matchs: 1, buts: 1, passes: 4, statut: "Blessure", stats: { VIT: 81, TIR: 79, PAS: 85, DRI: 88, DEF: 72, PHY: 64 }, mvp: 0, impact: 0, def: 0 },
  { name: "Anas", poste: "—", pp: 8, matchs: 1, buts: 1, passes: 2, statut: "Actif", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 1, impact: 1, def: 1 },
  { name: "Adrien", poste: "DD", pp: 7, matchs: 3, buts: 0, passes: 2, statut: "Actif", stats: { VIT: 76, TIR: 71, PAS: 73, DRI: 73, DEF: 78, PHY: 88 }, mvp: 0, impact: 0, def: 0 },
  { name: "Selim laouadi", poste: "—", pp: 6, matchs: 1, buts: 1, passes: 2, statut: "Actif", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 0, impact: 0, def: 0 },
  { name: "Abdel", poste: "—", pp: 5, matchs: 1, buts: 2, passes: 2, statut: "Actif", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 0, impact: 0, def: 0 },
  { name: "Franz", poste: "MDC/MC", pp: 5, matchs: 1, buts: 1, passes: 0, statut: "Actif", stats: { VIT: 76, TIR: 80, PAS: 77, DRI: 74, DEF: 83, PHY: 80 }, mvp: 0, impact: 0, def: 1 },
  { name: "Sami", poste: "—", pp: 5, matchs: 1, buts: 1, passes: 1, statut: "Actif", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 0, impact: 0, def: 0 },
  { name: "Kais", poste: "—", pp: 4, matchs: 1, buts: 2, passes: 1, statut: "Actif", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 0, impact: 0, def: 0 },
  { name: "Sosso Abdel", poste: "—", pp: 4, matchs: 1, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 0, impact: 0, def: 1 },
  { name: "Adil Maimouni", poste: "—", pp: 3, matchs: 1, buts: 0, passes: 1, statut: "Actif", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 0, impact: 1, def: 0 },
  { name: "Adil Zerhoui", poste: "—", pp: 3, matchs: 1, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 0, impact: 0, def: 0 },
  { name: "Hassan Abdel", poste: "—", pp: 2, matchs: 1, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 0, impact: 0, def: 1 },
  { name: "Ariless", poste: "MC/AT", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Blessure", stats: { VIT: 77, TIR: 82, PAS: 88, DRI: 89, DEF: 81, PHY: 79 }, mvp: 0, impact: 0, def: 0 },
  { name: "Hasbi", poste: "G", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 85, TIR: 79, PAS: 79, DRI: 86, DEF: 92, PHY: 88 }, mvp: 0, impact: 0, def: 0 },
  { name: "Marwan", poste: "MDC/MC", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 76, TIR: 79, PAS: 78, DRI: 77, DEF: 82, PHY: 82 }, mvp: 0, impact: 0, def: 0 },
  { name: "Rezki", poste: "MDC", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 75, TIR: 77, PAS: 76, DRI: 75, DEF: 85, PHY: 79 }, mvp: 0, impact: 0, def: 0 },
  { name: "Chouaib", poste: "—", pp: -2, matchs: 0, buts: 0, passes: 0, statut: "Suspendu", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 0, impact: 0, def: 0, absInj: 1 },
  { name: "Hugo", poste: "DG", pp: -2, matchs: 0, buts: 0, passes: 0, statut: "Suspendu", stats: { VIT: 77, TIR: 79, PAS: 76, DRI: 73, DEF: 77, PHY: 73 }, mvp: 0, impact: 0, def: 0, absInj: 1 },
  { name: "Khadim", poste: "—", pp: -2, matchs: 0, buts: 0, passes: 0, statut: "Suspendu", stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 }, mvp: 0, impact: 0, def: 0, absInj: 1 },
];

function team(
  id: string,
  name: string,
  score: number,
  players: [string, number, number, string?][]
): MatchTeam {
  return {
    id,
    name,
    score,
    players: players.map(([n, buts, passes, note]) => ({
      name: n,
      buts,
      passes,
      ...(note ? { note } : {}),
    })),
  };
}

export const JOURNEES: Journee[] = [
  {
    j: 1,
    date: "Dim. 22 juin",
    sflTime: true,
    faits: { buteur: "Ilyes — 4 buts", passeur: "Omar — 4 passes D." },
    matches: [
      {
        id: "j1-m1",
        label: "Match unique",
        teamA: team("j1-m1-a", "Équipe A", 5, [
          ["Ilyes", 4, 1], ["Smail", 2, 2], ["Omar", 1, 4], ["Badis", 1, 1], ["Naim", 1, 1],
        ]),
        teamB: team("j1-m1-b", "Équipe B", 3, [
          ["Kader", 2, 3], ["Sidali", 2, 2], ["Yanis", 2, 2], ["Adil", 1, 1], ["Mehdi", 1, 0],
        ]),
      },
    ],
  },
  {
    j: 2,
    date: "Dim. 29 juin",
    sflTime: false,
    faits: { buteur: "Zakary — 6 buts", passeur: "Souley — 3 passes D." },
    // Feuille de match pas encore renseignée : composition d'équipes inconnue,
    // pas de vote de figures possible pour cette journée.
    lignes: [
      ["Zakary", "-", 6, 2], ["Ilies", "-", 4, 1], ["Kader", "-", 3, 1], ["Anis", "-", 2, 1], ["Souley", "-", 2, 3],
      ["Smail", "-", 2, 2], ["Yamin", "-", 1, 2], ["Ibrahim", "-", 1, 1], ["Moussa", "-", 1, 1],
    ],
  },
  {
    j: 3,
    date: "Dim. 6 juil.",
    sflTime: false,
    faits: { buteur: "Ilyes & Souley — 5 buts", passeur: "Ilies — 5 passes D." },
    matches: [
      {
        id: "j3-m1",
        label: "Match 1",
        teamA: team("j3-m1-orange", "Orange", 9, [
          ["Smail", 2, 2], ["Kylian", 2, 4], ["Ibrahim", 2, 1], ["Franz", 1, 0], ["Ayman", 2, 1], ["Bilal", 0, 1],
        ]),
        teamB: team("j3-m1-bleu", "Bleu", 6, [
          ["Rezki", 0, 0], ["Kader", 0, 2], ["Ilyes", 5, 0], ["Moussa", 1, 2], ["Adil", 0, 0], ["Adrien", 0, 0],
        ]),
      },
      {
        id: "j3-m2",
        label: "Match 2",
        teamA: team("j3-m2-vert", "Vert", 8, [
          ["Badis", 0, 0], ["Zakary", 2, 4], ["Yacine", 3, 2], ["Anis", 2, 0], ["Naim", 1, 2], ["Soffiane", 0, 0],
        ]),
        teamB: team("j3-m2-jaune", "Jaune", 12, [
          ["Souley", 5, 1], ["Sidali", 0, 0], ["Ilies", 2, 5], ["Ryad", 2, 0], ["Yamin", 2, 1], ["Zakaria", 1, 1],
        ]),
      },
    ],
  },
  {
    j: 4,
    date: "Dim. 12 juil.",
    sflTime: false,
    faits: { buteur: "Ilyes — 8 buts", passeur: "Anis & Bilal — 6 passes D." },
    matches: [
      {
        id: "j4-m1",
        label: "Match 1",
        teamA: team("j4-m1-orange", "Orange", 19, [["Anis", 3, 6], ["Ilies", 6, 2], ["Bilal", 2, 6], ["Adrien", 0, 1], ["Ilyes", 8, 3]]),
        teamB: team("j4-m1-bleu", "Bleu", 11, [["Badis", 4, 2], ["Yamin", 3, 1], ["Ayman", 0, 0], ["Kader", 3, 1], ["Azzedine", 1, 2]]),
      },
      {
        id: "j4-m2",
        label: "Match 2",
        teamA: team("j4-m2-vert", "Vert", 9, [["Wadi", 1, 5], ["Zakaria", 0, 0], ["Mehdi", 2, 1], ["Yanis", 3, 1], ["Sidali", 3, 1]]),
        teamB: team("j4-m2-jaune", "Jaune", 5, [["Sofiane", 2, 0], ["Adil", 0, 1], ["Yacine", 0, 2], ["Moussa", 0, 1], ["Ryad", 0, 1], ["Smail", 3, 0]]),
      },
    ],
  },
  {
    j: 5,
    date: "Dim. 19 juil.",
    sflTime: false,
    faits: { buteur: "Jouneid — 6 buts", passeur: "Mehdi — 4 passes D." },
    matches: [
      {
        id: "j5-m1",
        label: "Match 1",
        teamA: team("j5-m1-orange", "Orange", 9, [["Badis", 2, 1], ["Sami", 1, 1], ["Ilies", 2, 2], ["Souley", 3, 1], ["Selim laouadi", 1, 2]]),
        teamB: team("j5-m1-bleu", "Bleu", 7, [["Abdel", 2, 2], ["Ibrahim", 0, 2], ["Sidali", 2, 1], ["Ilyes", 3, 2], ["Yacine", 0, 0]]),
      },
      {
        id: "j5-m2",
        label: "Match 2",
        teamA: team("j5-m2-vert", "Vert", 2, [["Bilal", 0, 1], ["Azzedine", 1, 0], ["Adil Maimouni", 0, 1], ["Ayman", 1, 0], ["Hassan Abdel", 0, 0]]),
        teamB: team("j5-m2-jaune", "Jaune", 16, [["Mehdi", 3, 4], ["Jouneid", 6, 2], ["Ryad", 2, 3], ["Yanis", 3, 3], ["Sofiane", 2, 3]]),
      },
      {
        id: "j5-m3",
        label: "Match 3",
        teamA: team("j5-m3-rouge", "Rouge", 4, [["Anas", 1, 2], ["Adrien", 0, 1], ["Kais", 2, 1], ["Yacine", 0, 0, "Extra time"]]),
        teamB: team("j5-m3-gris", "Gris", 6, [["Zakaria", 2, 1], ["Anis", 1, 2], ["Kamil", 3, 2], ["Adil Zerhoui", 0, 0], ["Sosso Abdel", 0, 0]]),
      },
    ],
  },
];

export const NEXT_MATCH = {
  journee: 8,
  jour: "Dimanche",
  date: "9 août",
  heure: "13h00",
  lieu: "Terrain extérieur — 5 vs 5",
};

export const BAREME: [string, string][] = [
  ["Présence", "+1"],
  ["Victoire", "+2"],
  ["Victoire SFL Time", "+3"],
  ["Match nul", "+1"],
  ["But", "+1"],
  ["Passe décisive", "+1"],
  ["Clean sheet", "+3"],
  ["MVP du match", "+2"],
  ["Joueur Impact · Défensive", "+1"],
  ["Retard non prévenu", "−1"],
  ["Absence injustifiée", "−2"],
];

// Cartes Boost officielles gagnées (figures de match) — une carte par honneur
// MVP / Impact / Défensive décerné dans la feuille SAISIE MATCH. Chaque carte
// part des stats simples du joueur puis applique un motif propre au type, plus
// la perf de la journée (+buts en TIR, +passes en PAS) :
//   • Impact    : 2 meilleures stats +3, autres +1
//   • MVP       : 2 meilleures stats +3, autres +2
//   • Défensive : +2 DEF, +2 PHY, +2 VIT (auto), +1 aux autres (TIR/PAS/DRI)
// Joueurs non encore évalués : base neutre 75. Plafond stat 99.
export const BOOST_CARDS: BoostCardData[] = [
  { player: "Kader", type: "mvp", ovr: 84, poste: "MC/AT", date: "J1 · 22 juin", stats: { VIT: 80, TIR: 82, PAS: 84, DRI: 87, DEF: 82, PHY: 85 } },
  { player: "Badis", type: "impact", ovr: 83, poste: "MC/MDC", date: "J1 · 22 juin", stats: { VIT: 78, TIR: 78, PAS: 77, DRI: 79, DEF: 91, PHY: 93 } },
  { player: "Kader", type: "impact", ovr: 83, poste: "MC/AT", date: "J1 · 22 juin", stats: { VIT: 79, TIR: 81, PAS: 83, DRI: 87, DEF: 81, PHY: 85 } },
  { player: "Sidali", type: "def", ovr: 83, poste: "MC/AG", date: "J1 · 22 juin", stats: { VIT: 80, TIR: 80, PAS: 85, DRI: 86, DEF: 84, PHY: 79 } },
  { player: "Smail", type: "def", ovr: 83, poste: "MC/MDC", date: "J1 · 22 juin", stats: { VIT: 78, TIR: 78, PAS: 79, DRI: 79, DEF: 89, PHY: 90 } },
  { player: "Ilies", type: "mvp", ovr: 86, poste: "AD", date: "J3 · 6 juil.", stats: { VIT: 87, TIR: 86, PAS: 90, DRI: 91, DEF: 79, PHY: 82 } },
  { player: "Ilyes", type: "mvp", ovr: 84, poste: "MC/AT", date: "J3 · 6 juil.", stats: { VIT: 83, TIR: 92, PAS: 89, DRI: 93, DEF: 74, PHY: 68 } },
  { player: "Ilies", type: "impact", ovr: 86, poste: "AD", date: "J3 · 6 juil.", stats: { VIT: 87, TIR: 85, PAS: 89, DRI: 91, DEF: 78, PHY: 81 } },
  { player: "Ilyes", type: "impact", ovr: 83, poste: "MC/AT", date: "J3 · 6 juil.", stats: { VIT: 82, TIR: 91, PAS: 89, DRI: 93, DEF: 73, PHY: 67 } },
  { player: "Smail", type: "impact", ovr: 83, poste: "MC/MDC", date: "J3 · 6 juil.", stats: { VIT: 77, TIR: 78, PAS: 79, DRI: 79, DEF: 90, PHY: 91 } },
  { player: "Zakary", type: "impact", ovr: 85, poste: "MC", date: "J3 · 6 juil.", stats: { VIT: 74, TIR: 86, PAS: 88, DRI: 81, DEF: 91, PHY: 88 } },
  { player: "Anis", type: "def", ovr: 78, poste: "DC", date: "J3 · 6 juil.", stats: { VIT: 74, TIR: 80, PAS: 72, DRI: 73, DEF: 82, PHY: 85 } },
  { player: "Franz", type: "def", ovr: 80, poste: "MDC/MC", date: "J3 · 6 juil.", stats: { VIT: 78, TIR: 82, PAS: 78, DRI: 75, DEF: 85, PHY: 82 } },
  { player: "Moussa", type: "def", ovr: 83, poste: "DC/MDC", date: "J3 · 6 juil.", stats: { VIT: 79, TIR: 86, PAS: 78, DRI: 73, DEF: 91, PHY: 91 } },
  { player: "Yamin", type: "def", ovr: 84, poste: "MC/MDC", date: "J3 · 6 juil.", stats: { VIT: 87, TIR: 83, PAS: 84, DRI: 79, DEF: 82, PHY: 85 } },
  { player: "Ilyes", type: "mvp", ovr: 85, poste: "MC/AT", date: "J4 · 12 juil.", stats: { VIT: 83, TIR: 95, PAS: 92, DRI: 93, DEF: 74, PHY: 68 } },
  { player: "Wadi", type: "mvp", ovr: 84, poste: "AT", date: "J4 · 12 juil.", stats: { VIT: 89, TIR: 84, PAS: 87, DRI: 80, DEF: 82, PHY: 82 } },
  { player: "Badis", type: "impact", ovr: 84, poste: "MC/MDC", date: "J4 · 12 juil.", stats: { VIT: 78, TIR: 81, PAS: 78, DRI: 79, DEF: 91, PHY: 93 } },
  { player: "Ilyes", type: "impact", ovr: 84, poste: "MC/AT", date: "J4 · 12 juil.", stats: { VIT: 82, TIR: 94, PAS: 92, DRI: 93, DEF: 73, PHY: 67 } },
  { player: "Smail", type: "impact", ovr: 83, poste: "MC/MDC", date: "J4 · 12 juil.", stats: { VIT: 77, TIR: 79, PAS: 77, DRI: 79, DEF: 90, PHY: 91 } },
  { player: "Wadi", type: "impact", ovr: 84, poste: "AT", date: "J4 · 12 juil.", stats: { VIT: 89, TIR: 84, PAS: 86, DRI: 79, DEF: 81, PHY: 81 } },
  { player: "Anis", type: "def", ovr: 79, poste: "DC", date: "J4 · 12 juil.", stats: { VIT: 74, TIR: 81, PAS: 78, DRI: 73, DEF: 82, PHY: 85 } },
  { player: "Ayman", type: "def", ovr: 77, poste: "DD", date: "J4 · 12 juil.", stats: { VIT: 76, TIR: 74, PAS: 76, DRI: 75, DEF: 79, PHY: 82 } },
  { player: "Sofiane", type: "def", ovr: 81, poste: "AT", date: "J4 · 12 juil.", stats: { VIT: 84, TIR: 84, PAS: 76, DRI: 78, DEF: 81, PHY: 82 } },
  { player: "Wadi", type: "def", ovr: 84, poste: "AT", date: "J4 · 12 juil.", stats: { VIT: 88, TIR: 82, PAS: 86, DRI: 79, DEF: 82, PHY: 82 } },
  { player: "Anas", type: "mvp", ovr: 78, poste: "—", date: "J5 · 19 juil.", stats: { VIT: 78, TIR: 79, PAS: 79, DRI: 77, DEF: 77, PHY: 77 } },
  { player: "Ilyes", type: "mvp", ovr: 84, poste: "MC/AT", date: "J5 · 19 juil.", stats: { VIT: 83, TIR: 90, PAS: 91, DRI: 93, DEF: 74, PHY: 68 } },
  { player: "Jouneid", type: "mvp", ovr: 79, poste: "—", date: "J5 · 19 juil.", stats: { VIT: 78, TIR: 84, PAS: 79, DRI: 77, DEF: 77, PHY: 77 } },
  { player: "Adil Maimouni", type: "impact", ovr: 77, poste: "—", date: "J5 · 19 juil.", stats: { VIT: 78, TIR: 78, PAS: 77, DRI: 76, DEF: 76, PHY: 76 } },
  { player: "Anas", type: "impact", ovr: 78, poste: "—", date: "J5 · 19 juil.", stats: { VIT: 78, TIR: 79, PAS: 78, DRI: 76, DEF: 76, PHY: 76 } },
  { player: "Ilies", type: "impact", ovr: 85, poste: "AD", date: "J5 · 19 juil.", stats: { VIT: 87, TIR: 85, PAS: 86, DRI: 91, DEF: 78, PHY: 81 } },
  { player: "Ilyes", type: "impact", ovr: 83, poste: "MC/AT", date: "J5 · 19 juil.", stats: { VIT: 82, TIR: 89, PAS: 91, DRI: 93, DEF: 73, PHY: 67 } },
  { player: "Jouneid", type: "impact", ovr: 78, poste: "—", date: "J5 · 19 juil.", stats: { VIT: 78, TIR: 84, PAS: 78, DRI: 76, DEF: 76, PHY: 76 } },
  { player: "Kamil", type: "impact", ovr: 78, poste: "—", date: "J5 · 19 juil.", stats: { VIT: 78, TIR: 81, PAS: 78, DRI: 76, DEF: 76, PHY: 76 } },
  { player: "Anas", type: "def", ovr: 77, poste: "—", date: "J5 · 19 juil.", stats: { VIT: 77, TIR: 77, PAS: 78, DRI: 76, DEF: 77, PHY: 77 } },
  { player: "Badis", type: "def", ovr: 83, poste: "MC/MDC", date: "J5 · 19 juil.", stats: { VIT: 79, TIR: 79, PAS: 77, DRI: 79, DEF: 90, PHY: 92 } },
  { player: "Hassan Abdel", type: "def", ovr: 77, poste: "—", date: "J5 · 19 juil.", stats: { VIT: 77, TIR: 76, PAS: 76, DRI: 76, DEF: 77, PHY: 77 } },
  { player: "Sidali", type: "def", ovr: 83, poste: "MC/AG", date: "J5 · 19 juil.", stats: { VIT: 80, TIR: 80, PAS: 84, DRI: 86, DEF: 84, PHY: 79 } },
  { player: "Sofiane", type: "def", ovr: 82, poste: "AT", date: "J5 · 19 juil.", stats: { VIT: 84, TIR: 84, PAS: 79, DRI: 78, DEF: 81, PHY: 82 } },
  { player: "Sosso Abdel", type: "def", ovr: 77, poste: "—", date: "J5 · 19 juil.", stats: { VIT: 77, TIR: 76, PAS: 76, DRI: 76, DEF: 77, PHY: 77 } },
];
