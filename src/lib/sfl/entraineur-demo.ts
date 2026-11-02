// Deux saisons inventées pour la carte d'entraîneur (étude du 02/11/2026,
// branche coach-etude) : Lucien, entraîneur de Bois-Blancs FC (une équipe
// de la démonstration du championnat, equipes-demo.ts), sept joueurs, 24
// rencontres, de novembre 2026 à mai 2027. Ni la base, ni un vrai joueur :
// des faits plausibles, pour voir ce que donne le modèle
// (lib/sfl/entraineur.ts) et en tirer les chiffres de la carte.
//
// Ce qu'il s'y passe :
//   · saison 1 : l'équipe vient presque toujours au complet ; Lucien laisse
//     Samir sur le banc en décembre, et Samir s'en va le 20 ; un 5 contre 4
//     le 9 janvier ; Ryad, la recrue d'octobre, s'installe ; Nassim arrive
//     fin décembre ;
//   · saison 2 : tout le monde joue sa part, l'équipe vient au complet, à
//     l'heure, prend un peu plus que sa force ne le promettait (l'Indice,
//     lui, a monté), et les capitaines adverses saluent son fair-play.

import { PALETTE } from "@/lib/sfl/blason";
import type { CarriereEntraineur, EquipeEntraineur, LigneEffectif, MembreEntraineur, RencontreEntraineur } from "@/lib/sfl/entraineur";

const couleur = (id: string) => PALETTE.find((c) => c.id === id)!.hex;

/** Les joueurs, dans l'ordre des lignes ci-dessous. */
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

/**
 * Une ligne par joueur, dans l'ordre de MEMBRES_DEMO : h inscrit et à
 * l'heure, r inscrit et en retard, a inscrit et absent, i absence annoncée,
 * n disponible mais pas inscrit, - pas (ou pas encore) dans l'effectif.
 */
const lignes = (codes: string): LigneEffectif[] =>
  [...codes].flatMap((c, i) =>
    c === "-" ? [] : [{ id: MEMBRES_DEMO[i].id, inscrit: "hra".includes(c), indisponible: c === "i", venu: c === "h" ? "heure" : c === "r" ? "retard" : null }]
  );

let n = 0;
const r = (
  le: string,
  [pour, contre]: [number, number],
  attendu: number | null,
  codes: string,
  fairPlay: [number, number] | null,
  autres: Partial<RencontreEntraineur> = {}
): RencontreEntraineur => ({
  id: `bb-${++n}`,
  le,
  forfait: false,
  pour,
  contre,
  attendu,
  effectif: lignes(codes),
  fairPlay: fairPlay && { note: fairPlay[0], habitude: fairPlay[1] },
  sanctions: { joueurs: 0, entraineur: 0 },
  ...autres,
});

//                                              Y B T M K R S N
export const RENCONTRES_DEMO: RencontreEntraineur[] = [
  // Saison 1 : l'Indice se cale sur les six premiers matchs.
  r("2026-11-07", [4, 3], null, "hhhhhhh-", [4.6, 4.1]),
  r("2026-11-14", [2, 2], null, "hhhhrhi-", [4.3, 4.2]),
  r("2026-11-21", [5, 2], null, "hhhihhh-", [4.8, 4.3]),
  r("2026-11-28", [3, 4], null, "hhhhhhn-", [4.4, 4.4]),
  r("2026-12-05", [6, 4], null, "hhhhhnn-", [4.5, 4.2]),
  r("2026-12-12", [3, 1], 0.58, "hhhhhrn-", [4.4, 4.2]),
  r("2026-12-19", [4, 4], 0.4, "hhhhhni-", [4.2, 4.3]),
  // Kevin, inscrit, ne vient pas : 5 contre 4, le 3-3 devient 2-3.
  r("2027-01-09", [2, 3], 0.62, "hhhhai-i", [3.4, 4.0]),
  r("2027-01-16", [5, 3], 0.35, "hhhhhh-h", [4.7, 4.2]),
  r("2027-01-23", [6, 2], 0.55, "hhhhrh-h", [4.6, 4.3]),
  r("2027-02-06", [3, 3], 0.3, "hhhhhh-h", [4.9, 4.4]),
  r("2027-02-13", [4, 2], 0.5, "hhhihh-h", [4.5, 4.1]),
  // Saison 2 : l'Indice a monté, l'équipe est souvent donnée gagnante.
  r("2027-03-06", [5, 2], 0.6, "hhhhhh-h", [4.8, 4.2]),
  r("2027-03-13", [3, 3], 0.57, "hhnhhh-h", [4.6, 4.4]),
  r("2027-03-20", [4, 1], 0.62, "hhhhhh-h", [4.9, 4.3]),
  r("2027-03-27", [2, 1], 0.52, "nhhhhh-h", [4.5, 4.0]),
  r("2027-04-03", [3, 3], 0.64, "hhhhhh-h", [4.7, 4.1]),
  r("2027-04-10", [1, 2], 0.66, "hhhhrh-h", [4.2, 4.2]),
  r("2027-04-17", [2, 2], 0.48, "hhhnhh-h", [4.8, 4.4]),
  r("2027-04-24", [5, 5], 0.45, "hhhrhh-h", [4.6, 4.1]),
  r("2027-05-08", [3, 1], 0.28, "hhhhhh-h", [4.9, 4.5]),
  r("2027-05-15", [4, 3], 0.61, "hhihhh-h", [4.7, 4.2]),
  r("2027-05-22", [3, 3], 0.63, "hhhhhh-h", [4.8, 4.3]),
  r("2027-05-29", [2, 2], 0.59, "hhhhha-h", [4.5, 4.2]),
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
