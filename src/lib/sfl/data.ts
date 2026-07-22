// Données Saison 1 — portées depuis SFL_Statistiques_Base_Propre.xlsx.
// À terme, ces données viendront d'une base alimentée par l'interface admin.

import type { BoostCardData, Journee, MatchTeam, Player, UnratedPlayer } from "./engine";

export const PLAYERS: Player[] = [
  { name: "Smail", poste: "MC/MDC", pp: 22, matchs: 3, buts: 6, passes: 6, statut: "Actif", stats: { VIT: 76, TIR: 75, PAS: 76, DRI: 78, DEF: 87, PHY: 88 }, mvp: 0, impact: 1, def: 1 },
  { name: "Ilies", poste: "AD", pp: 19, matchs: 2, buts: 6, passes: 6, statut: "Actif", stats: { VIT: 84, TIR: 82, PAS: 83, DRI: 88, DEF: 77, PHY: 80 }, mvp: 1, impact: 1, def: 0 },
  { name: "Ilyes", poste: "MC/AT", pp: 18, matchs: 2, buts: 9, passes: 1, statut: "Actif", stats: { VIT: 81, TIR: 85, PAS: 86, DRI: 90, DEF: 72, PHY: 66 }, mvp: 1, impact: 1, def: 0 },
  { name: "Kader", poste: "MC/AT", pp: 17, matchs: 3, buts: 5, passes: 6, statut: "Actif", stats: { VIT: 78, TIR: 78, PAS: 79, DRI: 84, DEF: 80, PHY: 82 }, mvp: 1, impact: 1, def: 0 },
  { name: "Zakary", poste: "MC", pp: 17, matchs: 2, buts: 8, passes: 6, statut: "Actif", stats: { VIT: 73, TIR: 83, PAS: 83, DRI: 80, DEF: 88, PHY: 85 }, mvp: 0, impact: 1, def: 0 },
  { name: "Souley", poste: "AT", pp: 15, matchs: 2, buts: 7, passes: 4, statut: "Actif", stats: { VIT: 78, TIR: 80, PAS: 84, DRI: 86, DEF: 86, PHY: 91 }, mvp: 0, impact: 0, def: 0 },
  { name: "Naim", poste: "DC", pp: 11, matchs: 3, buts: 2, passes: 3, statut: "Actif", stats: { VIT: 65, TIR: 73, PAS: 78, DRI: 77, DEF: 76, PHY: 63 }, mvp: 0, impact: 0, def: 0 },
  { name: "Yamin", poste: "MC/MDC", pp: 11, matchs: 2, buts: 3, passes: 3, statut: "Actif", stats: { VIT: 85, TIR: 80, PAS: 82, DRI: 78, DEF: 80, PHY: 83 }, mvp: 0, impact: 0, def: 1 },
  { name: "Ibrahim", poste: "DC", pp: 9, matchs: 2, buts: 3, passes: 2, statut: "Actif", stats: { VIT: 72, TIR: 80, PAS: 79, DRI: 76, DEF: 83, PHY: 81 }, mvp: 0, impact: 0, def: 0 },
  { name: "Kylian", poste: "AT", pp: 9, matchs: 1, buts: 2, passes: 4, statut: "Blessure", stats: { VIT: 86, TIR: 82, PAS: 86, DRI: 84, DEF: 80, PHY: 75 }, mvp: 0, impact: 0, def: 0 },
  { name: "Anis", poste: "DC", pp: 8, matchs: 2, buts: 4, passes: 1, statut: "Actif", stats: { VIT: 72, TIR: 77, PAS: 71, DRI: 72, DEF: 80, PHY: 83 }, mvp: 0, impact: 0, def: 1 },
  { name: "Moussa", poste: "DC/MDC", pp: 8, matchs: 2, buts: 2, passes: 3, statut: "Actif", stats: { VIT: 77, TIR: 84, PAS: 75, DRI: 72, DEF: 89, PHY: 89 }, mvp: 0, impact: 0, def: 1 },
  { name: "Yanis", poste: "MC/MDC", pp: 8, matchs: 2, buts: 4, passes: 2, statut: "Actif", stats: { VIT: 73, TIR: 74, PAS: 77, DRI: 77, DEF: 79, PHY: 78 }, mvp: 0, impact: 0, def: 0 },
  { name: "Adil", poste: "MDC", pp: 7, matchs: 3, buts: 1, passes: 2, statut: "Actif", stats: { VIT: 77, TIR: 75, PAS: 72, DRI: 70, DEF: 77, PHY: 83 }, mvp: 0, impact: 1, def: 0 },
  { name: "Badis", poste: "MC/MDC", pp: 7, matchs: 1, buts: 1, passes: 1, statut: "Actif", stats: { VIT: 77, TIR: 76, PAS: 75, DRI: 78, DEF: 88, PHY: 90 }, mvp: 0, impact: 1, def: 0 },
  { name: "Omar", poste: "MC", pp: 7, matchs: 1, buts: 1, passes: 4, statut: "Blessure", stats: { VIT: 81, TIR: 79, PAS: 85, DRI: 88, DEF: 72, PHY: 64 }, mvp: 0, impact: 0, def: 0, absInj: 1 },
  { name: "Ryad", poste: "MC", pp: 7, matchs: 2, buts: 2, passes: 1, statut: "Actif", stats: { VIT: 77, TIR: 80, PAS: 79, DRI: 81, DEF: 77, PHY: 78 }, mvp: 0, impact: 0, def: 0 },
  { name: "Sidali", poste: "MC/AG", pp: 7, matchs: 2, buts: 2, passes: 2, statut: "Actif", stats: { VIT: 78, TIR: 77, PAS: 82, DRI: 85, DEF: 82, PHY: 77 }, mvp: 0, impact: 0, def: 1 },
  { name: "Yacine", poste: "MC/AT", pp: 7, matchs: 2, buts: 3, passes: 2, statut: "Actif", stats: { VIT: 79, TIR: 80, PAS: 83, DRI: 83, DEF: 79, PHY: 79 }, mvp: 0, impact: 0, def: 0 },
  { name: "Ayman", poste: "DD", pp: 6, matchs: 1, buts: 2, passes: 1, statut: "Actif", stats: { VIT: 74, TIR: 73, PAS: 75, DRI: 74, DEF: 77, PHY: 80 }, mvp: 0, impact: 0, def: 0 },
  { name: "Franz", poste: "MDC/MC", pp: 5, matchs: 1, buts: 1, passes: 0, statut: "Actif", stats: { VIT: 76, TIR: 80, PAS: 77, DRI: 74, DEF: 83, PHY: 80 }, mvp: 0, impact: 0, def: 1 },
  { name: "Zakaria", poste: "MC", pp: 5, matchs: 1, buts: 1, passes: 1, statut: "Actif", stats: { VIT: 77, TIR: 78, PAS: 77, DRI: 79, DEF: 77, PHY: 76 }, mvp: 0, impact: 0, def: 0 },
  { name: "Bilal", poste: "MC", pp: 4, matchs: 1, buts: 0, passes: 1, statut: "Actif", stats: { VIT: 76, TIR: 77, PAS: 74, DRI: 78, DEF: 77, PHY: 78 }, mvp: 0, impact: 0, def: 0 },
  { name: "Azzedine", poste: "DG", pp: 3, matchs: 1, buts: 2, passes: 0, statut: "Actif", stats: { VIT: 68, TIR: 67, PAS: 67, DRI: 65, DEF: 69, PHY: 72 }, mvp: 0, impact: 0, def: 0 },
  { name: "Wadi", poste: "AT", pp: 2, matchs: 1, buts: 0, passes: 1, statut: "Suspendu", stats: { VIT: 86, TIR: 80, PAS: 80, DRI: 78, DEF: 80, PHY: 80 }, mvp: 0, impact: 0, def: 0, absInj: 1 },
  { name: "Adrien", poste: "DD", pp: 1, matchs: 1, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 76, TIR: 71, PAS: 73, DRI: 73, DEF: 88, PHY: 78 }, mvp: 0, impact: 0, def: 0 },
  { name: "Abdel", poste: "MC", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 76, TIR: 80, PAS: 79, DRI: 79, DEF: 79, PHY: 80 }, mvp: 0, impact: 0, def: 0 },
  { name: "Adil Zerhoui", poste: "MD", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 79, TIR: 75, PAS: 77, DRI: 78, DEF: 93, PHY: 84 }, mvp: 0, impact: 0, def: 0 },
  { name: "Anas", poste: "MDC", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 82, TIR: 77, PAS: 78, DRI: 80, DEF: 85, PHY: 84 }, mvp: 0, impact: 0, def: 0 },
  { name: "Ariless", poste: "MC/AT", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 77, TIR: 82, PAS: 88, DRI: 89, DEF: 81, PHY: 79 }, mvp: 0, impact: 0, def: 0 },
  { name: "Farid", poste: "DG", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 77, TIR: 73, PAS: 74, DRI: 75, DEF: 81, PHY: 79 }, mvp: 0, impact: 0, def: 0 },
  { name: "Hasbi", poste: "G", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 85, TIR: 79, PAS: 79, DRI: 86, DEF: 92, PHY: 88 }, mvp: 0, impact: 0, def: 0 },
  { name: "Hugo", poste: "DG", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 77, TIR: 79, PAS: 76, DRI: 73, DEF: 77, PHY: 73 }, mvp: 0, impact: 0, def: 0 },
  { name: "Kais", poste: "DD", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 81, TIR: 77, PAS: 78, DRI: 77, DEF: 74, PHY: 80 }, mvp: 0, impact: 0, def: 0 },
  { name: "Kamil", poste: "MC", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 81, TIR: 78, PAS: 75, DRI: 79, DEF: 91, PHY: 82 }, mvp: 0, impact: 0, def: 0 },
  { name: "Marwan", poste: "MDC/MC", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 76, TIR: 79, PAS: 78, DRI: 77, DEF: 82, PHY: 82 }, mvp: 0, impact: 0, def: 0 },
  { name: "Mehdi", poste: "MDC", pp: 0, matchs: 1, buts: 1, passes: 0, statut: "Suspendu", stats: { VIT: 74, TIR: 73, PAS: 75, DRI: 76, DEF: 83, PHY: 88 }, mvp: 0, impact: 0, def: 0, absInj: 1 },
  { name: "Moustapha", poste: "DG", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 76, TIR: 77, PAS: 78, DRI: 73, DEF: 75, PHY: 78 }, mvp: 0, impact: 0, def: 0 },
  { name: "Rezki", poste: "MDC", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 75, TIR: 77, PAS: 76, DRI: 75, DEF: 85, PHY: 79 }, mvp: 0, impact: 0, def: 0 },
  { name: "Sami", poste: "MC", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 76, TIR: 77, PAS: 80, DRI: 78, DEF: 80, PHY: 79 }, mvp: 0, impact: 0, def: 0 },
  { name: "Selim laouadi", poste: "MC", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 69, TIR: 77, PAS: 85, DRI: 87, DEF: 83, PHY: 76 }, mvp: 0, impact: 0, def: 0 },
  { name: "Simon Ribeiro", poste: "MC", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 80, TIR: 84, PAS: 88, DRI: 84, DEF: 79, PHY: 86 }, mvp: 0, impact: 0, def: 0 },
  { name: "Soffiane", poste: "AT", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 80, TIR: 83, PAS: 84, DRI: 85, DEF: 76, PHY: 77 }, mvp: 0, impact: 0, def: 0 },
  { name: "Sofiane", poste: "AT", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 82, TIR: 81, PAS: 75, DRI: 77, DEF: 79, PHY: 80 }, mvp: 0, impact: 0, def: 0 },
  { name: "Sosso Abdel", poste: "DC", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 79, TIR: 79, PAS: 85, DRI: 86, DEF: 79, PHY: 86 }, mvp: 0, impact: 0, def: 0 },
  { name: "Sosso Coach", poste: "AT/BU", pp: 0, matchs: 0, buts: 0, passes: 0, statut: "Actif", stats: { VIT: 87, TIR: 82, PAS: 83, DRI: 83, DEF: 81, PHY: 88 }, mvp: 0, impact: 0, def: 0 },
];

// Joueurs de l'effectif pas encore notés (à révéler) : ils rejoignent
// PLAYERS avec des stats dès que tu les as vus jouer et notés.
export const UNRATED_PLAYERS: UnratedPlayer[] = [
  { name: "Jouneid", poste: "MC" },
  { name: "Hassan Abdel", poste: "MC" },
  { name: "Houssyne", poste: "G" },
  { name: "Adil Maimouni", poste: "DC" },
  { name: "Guillaume", poste: "DG" },
  { name: "Ziad", poste: "MDC" },
  { name: "Selim" },
  { name: "Chouaib", poste: "DEF" },
  { name: "Khadim", poste: "MDC" },
];

function team(id: string, name: string, score: number, players: [string, number, number][]): MatchTeam {
  return {
    id,
    name,
    score,
    players: players.map(([n, buts, passes]) => ({ name: n, buts, passes })),
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
];

export const NEXT_MATCH = {
  journee: 4,
  jour: "Dimanche",
  date: "13 juillet",
  heure: "13h00",
  lieu: "Terrain extérieur — 5 vs 5",
};

export const BAREME: [string, string][] = [
  ["Présence", "+1"],
  ["Victoire", "+2"],
  ["Victoire SFL Time", "+3"],
  ["But", "+1"],
  ["Passe décisive", "+1"],
  ["Clean sheet", "+3"],
  ["MVP · Impact · Défensive", "+1"],
  ["Absence non justifiée", "−1"],
];

// Cartes Boost officielles gagnées (figures de match).
export const BOOST_CARDS: BoostCardData[] = [
  { player: "Ilyes", type: "mvp", ovr: 85, poste: "MC", date: "J1 · 22 juin", stats: { VIT: 84, TIR: 93, PAS: 91, DRI: 96, DEF: 75, PHY: 69 } },
  { player: "Ilies", type: "mvp", ovr: 88, poste: "AD", date: "J2 · 29 juin", stats: { VIT: 89, TIR: 87, PAS: 91, DRI: 95, DEF: 80, PHY: 83 } },
  { player: "Kader", type: "mvp", ovr: 83, poste: "MC", date: "J1 · 22 juin", stats: { VIT: 80, TIR: 80, PAS: 81, DRI: 86, DEF: 82, PHY: 84 } },
  { player: "Smail", type: "impact", ovr: 85, poste: "MC/MDC", date: "J3 · 6 juil.", stats: { VIT: 79, TIR: 80, PAS: 81, DRI: 81, DEF: 92, PHY: 93 } },
  { player: "Zakary", type: "impact", ovr: 85, poste: "MC", date: "J1 · 22 juin", stats: { VIT: 75, TIR: 87, PAS: 89, DRI: 82, DEF: 90, PHY: 87 } },
  { player: "Smail", type: "def", ovr: 82, poste: "MC/MDC", date: "J1 · 22 juin", stats: { VIT: 79, TIR: 77, PAS: 78, DRI: 80, DEF: 89, PHY: 90 } },
  { player: "Anis", type: "def", ovr: 80, poste: "DC", date: "J2 · 29 juin", stats: { VIT: 74, TIR: 81, PAS: 73, DRI: 74, DEF: 88, PHY: 85 } },
  { player: "Yamin", type: "def", ovr: 85, poste: "MC/MDC", date: "J1 · 22 juin", stats: { VIT: 89, TIR: 84, PAS: 85, DRI: 80, DEF: 84, PHY: 89 } },
  { player: "Moussa", type: "def", ovr: 84, poste: "DC/MDC", date: "J1 · 22 juin", stats: { VIT: 79, TIR: 87, PAS: 78, DRI: 74, DEF: 93, PHY: 93 } },
  { player: "Franz", type: "def", ovr: 82, poste: "MDC", date: "J3 · 6 juil.", stats: { VIT: 78, TIR: 83, PAS: 79, DRI: 76, DEF: 88, PHY: 85 } },
  { player: "Sidali", type: "def", ovr: 81, poste: "MC", date: "J1 · 22 juin", stats: { VIT: 80, TIR: 77, PAS: 82, DRI: 85, DEF: 84, PHY: 79 } },
];
