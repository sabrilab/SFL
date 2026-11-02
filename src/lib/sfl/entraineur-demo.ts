// Trois saisons inventées pour la carte d'entraîneur (étude du 02/11/2026,
// branche coach-etude, troisième version revue) : Lucien, entraîneur de Mons
// Academy (une équipe de la démonstration du championnat, equipes-demo.ts :
// le blason à tête plate, le chevron, le ballon), sept joueurs, 40
// rencontres, de novembre 2026 à septembre 2027. Ni la base, ni un vrai
// joueur : des faits plausibles, pour voir ce que donne le modèle
// (lib/sfl/entraineur.ts) et en tirer les chiffres de la carte.
//
// Ce qu'il s'y passe :
//   · avant lui, Mons Academy déclarait forfait : deux fois sur ses 16
//     dernières rencontres ;
//   · avec lui, plus un seul forfait ; le 9 janvier, Kevin, inscrit, ne vient
//     pas : 5 contre 4, le 3-3 du terrain devient 2-3 (rés lit le 3-3) ;
//   · l'équipe prend plus de points que ses cartes n'en promettaient : des
//     victoires contre plus fort (dont Lambersart, bien plus fort, en mai) ;
//   · Samir, inscrit aux deux premières rencontres puis laissé sur le banc,
//     s'en va le 20 décembre ; Nassim arrive fin décembre ; personne d'autre
//     ne part.
// La carte qui en sort : rés 78, pré 76, coh 75, note 77 (aucun des trois ne
// répète la note).

import { PALETTE } from "@/lib/sfl/blason";
import type { CarriereEntraineur, EquipeAvant, EquipeEntraineur, Inscrit, MembreEntraineur, RencontreEntraineur } from "@/lib/sfl/entraineur";

const couleur = (id: string) => PALETTE.find((c) => c.id === id)!.hex;

/** Les notes de carte de ses joueurs (elles ne bougent pas avec les matchs Team). */
const NOTES: Record<string, number> = {
  "ma-yanis": 79,
  "ma-bilal": 76,
  "ma-theo": 74,
  "ma-medhi": 77,
  "ma-kevin": 73,
  "ma-ryad": 75,
  "ma-samir": 72,
  "ma-nassim": 76,
};

export const MEMBRES_DEMO: MembreEntraineur[] = [
  { id: "ma-yanis", nom: "Yanis", arrivee: "2026-09-12", derniereFeuille: "2026-10-17" },
  { id: "ma-bilal", nom: "Bilal", arrivee: "2026-09-12", derniereFeuille: "2026-10-17" },
  { id: "ma-theo", nom: "Théo", arrivee: "2026-09-14", derniereFeuille: "2026-10-17" },
  { id: "ma-medhi", nom: "Medhi", arrivee: "2026-09-15", derniereFeuille: "2026-10-10" },
  { id: "ma-kevin", nom: "Kevin", arrivee: "2026-09-18", derniereFeuille: "2026-10-17" },
  { id: "ma-ryad", nom: "Ryad", arrivee: "2026-09-28", derniereFeuille: "2026-10-17" },
  { id: "ma-samir", nom: "Samir", arrivee: "2026-09-20", derniereFeuille: "2026-10-10", depart: { le: "2026-12-20", motif: "depart" } },
  { id: "ma-nassim", nom: "Nassim", arrivee: "2026-12-27" },
];

/** Les adversaires de la démonstration du championnat (leurs ids), et les notes de carte de leur feuille. */
const ADVERSES: Record<number, number[]> = {
  11: [85, 84, 83, 82, 81, 79], // Lambersart Athletic, bien plus fort
  12: [77, 76, 76, 75, 74],
  13: [78, 77, 75, 74, 74, 73],
  14: [76, 75, 75, 74, 73],
  15: [79, 77, 76, 76, 75, 72],
  16: [75, 74, 74, 73, 72, 71],
  17: [78, 78, 76, 75, 75],
  18: [77, 75, 74, 74, 73, 72],
  19: [81, 79, 78, 77, 76, 75],
  20: [74, 74, 73, 72, 72],
};

/** Sa feuille : ses joueurs inscrits, avec leur note de carte. */
const feuille = (...ids: string[]): Inscrit[] => ids.map((id) => ({ id: `ma-${id}`, note: NOTES[`ma-${id}`] }));
const AVANT_SAMIR = ["yanis", "bilal", "theo", "medhi", "kevin", "ryad"];
const AVEC_NASSIM = ["yanis", "bilal", "theo", "medhi", "kevin", "ryad", "nassim"];

const saison = (le: string) => (le < "2027-03-01" ? 1 : le < "2027-07-01" ? 2 : 3);
let n = 0;
/** Une rencontre : le jour, l'adversaire, le score du terrain, sa feuille ; un 5 contre 4 éventuel. */
const r = (le: string, adversaire: number, [pour, contre]: [number, number], inscrits: string[], cinqContreQuatre: RencontreEntraineur["cinqContreQuatre"] = null): RencontreEntraineur => ({
  id: `ma-${++n}`,
  le,
  saison: saison(le),
  adversaire,
  forfait: false,
  pour,
  contre,
  cinqContreQuatre,
  feuille: feuille(...inscrits),
  adverses: ADVERSES[adversaire],
});
const sauf = (qui: string, ids = AVEC_NASSIM) => ids.filter((x) => x !== qui);

export const RENCONTRES_DEMO: RencontreEntraineur[] = [
  // Saison 1 (novembre – février).
  r("2026-11-07", 12, [4, 3], [...AVANT_SAMIR, "samir"]),
  r("2026-11-14", 16, [2, 2], [...AVANT_SAMIR, "samir"]),
  r("2026-11-21", 13, [5, 2], AVANT_SAMIR),
  r("2026-11-28", 15, [3, 4], AVANT_SAMIR),
  r("2026-12-05", 14, [6, 4], sauf("theo", AVANT_SAMIR)),
  r("2026-12-12", 17, [3, 1], AVANT_SAMIR),
  r("2026-12-19", 18, [4, 4], sauf("kevin", AVANT_SAMIR)),
  // Kevin, inscrit, ne vient pas : 5 contre 4 ; le 3-3 du terrain devient 2-3 au championnat.
  r("2027-01-09", 20, [3, 3], ["yanis", "bilal", "medhi", "kevin", "ryad"], "nous"),
  r("2027-01-16", 19, [5, 3], AVEC_NASSIM),
  r("2027-01-23", 11, [2, 3], sauf("ryad")),
  r("2027-01-30", 12, [3, 3], AVEC_NASSIM),
  r("2027-02-06", 13, [4, 2], sauf("medhi")),
  r("2027-02-13", 16, [3, 1], AVEC_NASSIM),
  r("2027-02-20", 14, [2, 2], sauf("bilal")),
  // Saison 2 (mars – juin).
  r("2027-03-06", 15, [5, 2], AVEC_NASSIM),
  r("2027-03-13", 17, [3, 3], sauf("theo")),
  r("2027-03-20", 18, [4, 1], AVEC_NASSIM),
  r("2027-03-27", 19, [2, 1], sauf("kevin")),
  r("2027-04-03", 20, [3, 3], AVEC_NASSIM, "eux"),
  r("2027-04-10", 12, [1, 2], sauf("yanis")),
  r("2027-04-17", 13, [2, 2], AVEC_NASSIM),
  r("2027-04-24", 16, [5, 5], sauf("ryad")),
  r("2027-05-08", 11, [3, 1], AVEC_NASSIM),
  r("2027-05-15", 14, [4, 3], sauf("medhi")),
  r("2027-05-22", 15, [3, 3], AVEC_NASSIM),
  r("2027-05-29", 17, [2, 2], sauf("theo")),
  r("2027-06-05", 19, [4, 2], AVEC_NASSIM),
  r("2027-06-12", 18, [2, 3], sauf("nassim")),
  // Saison 3 (juillet – octobre), après trois semaines de pause.
  r("2027-07-03", 12, [3, 2], AVEC_NASSIM),
  r("2027-07-10", 20, [2, 2], sauf("bilal")),
  r("2027-07-17", 13, [2, 2], AVEC_NASSIM),
  r("2027-07-24", 11, [3, 3], sauf("kevin")),
  r("2027-08-28", 14, [3, 3], AVEC_NASSIM),
  r("2027-09-04", 15, [2, 1], sauf("yanis")),
  r("2027-09-11", 16, [2, 2], AVEC_NASSIM),
  r("2027-09-18", 17, [3, 2], sauf("ryad")),
  r("2027-09-25", 19, [2, 2], AVEC_NASSIM),
  r("2027-10-02", 18, [3, 3], sauf("theo")),
  r("2027-10-09", 12, [1, 1], AVEC_NASSIM),
  r("2027-10-16", 20, [3, 2], sauf("medhi")),
];

/** Mons Academy avant lui : 16 rencontres (deux forfaits), 840 jours-joueurs, un départ. */
export const AVANT_DEMO: EquipeAvant = { rencontres: 16, presence: (2 * -3) / 16, joursActifs: 840, departs: 1 };

/** Lucien a signé comme entraîneur de Mons Academy le 24 octobre 2026. */
export const CARRIERE_DEMO: CarriereEntraineur = {
  arrivee: "2026-10-24",
  rencontres: RENCONTRES_DEMO,
  membres: MEMBRES_DEMO,
  equipeAvant: AVANT_DEMO,
};

/** Mons Academy, son écusson de la démonstration (equipes-demo.ts) : le blason à tête plate, le chevron, le ballon. */
export const EQUIPE_DEMO: EquipeEntraineur = {
  nom: "Mons Academy",
  initiales: "MA",
  fond: "noir",
  blason: { forme: "blason", motif: "chevron", couleurs: [couleur("marine"), couleur("ciel"), couleur("blanc")], embleme: "ballon" },
};
