// Deux saisons inventées pour la carte d'entraîneur (étude du 02/11/2026,
// branche coach-etude, troisième version) : Lucien, entraîneur de
// Bois-Blancs FC (une équipe de la démonstration du championnat,
// equipes-demo.ts), sept joueurs, 24 rencontres, de novembre 2026 à mai 2027.
// Ni la base, ni un vrai joueur : des faits plausibles, pour voir ce que donne
// le modèle (lib/sfl/entraineur.ts) et en tirer les chiffres de la carte.
//
// Ce qu'il s'y passe :
//   · saison 1 : l'équipe vient presque toujours au complet ; Samir, qui ne
//     joue plus, s'en va le 20 décembre ; le 9 janvier, Kevin, inscrit, ne
//     vient pas : 5 contre 4, le 3-3 devient 2-3 ; Nassim arrive fin décembre ;
//   · saison 2 : l'équipe vient au complet à chaque rencontre, et prend un peu
//     plus que sa force ne le promettait (l'Indice, lui, a monté).
// La carte qui en sort : rés 77, pré 78, coh 75 (Samir parti, une dette à
// rattraper), note 77.

import { PALETTE } from "@/lib/sfl/blason";
import type { CarriereEntraineur, EquipeEntraineur, MembreEntraineur, RencontreEntraineur } from "@/lib/sfl/entraineur";

const couleur = (id: string) => PALETTE.find((c) => c.id === id)!.hex;

export const MEMBRES_DEMO: MembreEntraineur[] = [
  { id: "bb-yanis", nom: "Yanis", arrivee: "2026-10-12" },
  { id: "bb-bilal", nom: "Bilal", arrivee: "2026-10-12" },
  { id: "bb-theo", nom: "Théo", arrivee: "2026-10-14" },
  { id: "bb-medhi", nom: "Medhi", arrivee: "2026-10-15" },
  { id: "bb-kevin", nom: "Kevin", arrivee: "2026-10-18" },
  { id: "bb-ryad", nom: "Ryad", arrivee: "2026-10-28" },
  { id: "bb-samir", nom: "Samir", arrivee: "2026-10-20", depart: { le: "2026-12-20", motif: "depart" } },
  { id: "bb-nassim", nom: "Nassim", arrivee: "2026-12-27" },
];

let n = 0;
/** Une rencontre : le jour, le score final, l'attendu (null tant que les Indices ne sont pas calés), les inscrits et les présents. */
const r = (le: string, [pour, contre]: [number, number], attendu: number | null, feuille: number, presents = feuille): RencontreEntraineur => ({
  id: `bb-${++n}`,
  le,
  forfait: false,
  pour,
  contre,
  attendu,
  feuille,
  presents,
});

export const RENCONTRES_DEMO: RencontreEntraineur[] = [
  // Saison 1 : l'Indice se cale sur les cinq premiers matchs.
  r("2026-11-07", [4, 3], null, 7),
  r("2026-11-14", [2, 2], null, 6),
  r("2026-11-21", [5, 2], null, 6),
  r("2026-11-28", [3, 4], null, 6),
  r("2026-12-05", [6, 4], null, 5),
  r("2026-12-12", [3, 1], 0.58, 5),
  r("2026-12-19", [4, 4], 0.4, 5),
  // Kevin, inscrit, ne vient pas : 5 contre 4, le 3-3 devient 2-3.
  r("2027-01-09", [2, 3], 0.62, 5, 4),
  r("2027-01-16", [5, 3], 0.35, 6),
  r("2027-01-23", [6, 2], 0.55, 6),
  r("2027-02-06", [3, 3], 0.3, 6),
  r("2027-02-13", [4, 2], 0.5, 6),
  // Saison 2 : l'Indice a monté, l'équipe est souvent donnée gagnante.
  r("2027-03-06", [5, 2], 0.6, 6),
  r("2027-03-13", [3, 3], 0.57, 6),
  r("2027-03-20", [4, 1], 0.62, 6),
  r("2027-03-27", [2, 1], 0.52, 6),
  r("2027-04-03", [3, 3], 0.64, 7),
  r("2027-04-10", [1, 2], 0.66, 7),
  r("2027-04-17", [2, 2], 0.48, 6),
  r("2027-04-24", [5, 5], 0.45, 6),
  r("2027-05-08", [3, 1], 0.28, 7),
  r("2027-05-15", [4, 3], 0.61, 6),
  r("2027-05-22", [3, 3], 0.63, 7),
  r("2027-05-29", [2, 2], 0.59, 6),
];

/** Lucien a signé comme entraîneur de Bois-Blancs FC le 24 octobre 2026. */
export const CARRIERE_DEMO: CarriereEntraineur = {
  arrivee: "2026-10-24",
  rencontres: RENCONTRES_DEMO,
  membres: MEMBRES_DEMO,
};

/** Bois-Blancs FC, son écusson de la démonstration (equipes-demo.ts) : ovale, coupé, blanc et vert forêt, ses initiales. */
export const EQUIPE_DEMO: EquipeEntraineur = {
  initiales: "BB",
  fond: "blanc",
  blason: { forme: "ovale", motif: "coupe", couleurs: [couleur("blanc"), couleur("foret"), couleur("foret")], embleme: "initiales" },
};
