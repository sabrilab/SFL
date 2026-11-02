// Une saison inventée pour la carte d'entraîneur (étude du 02/11/2026,
// branche coach-etude) : Lucien, entraîneur de Bois-Blancs FC (une équipe
// de la démonstration du championnat, equipes-demo.ts), sept joueurs, douze
// rencontres de la saison 1 (novembre 2026 à février 2027). Ni la base, ni
// un vrai joueur : des noms et des faits plausibles, pour voir ce que donne
// le modèle (lib/sfl/entraineur.ts) et en tirer les chiffres de la carte.
//
// Ce qu'il s'y passe : l'Indice de Force se cale sur les cinq premiers
// matchs ; ensuite l'équipe gagne un peu plus que prévu, avec deux contre-
// performances. Un 5 contre 4 en janvier, quelques retards, un forfait
// évité de justesse. Samir part le 20 décembre, Nassim arrive. Lucien fait
// tourner son cinq de départ, moins en décembre. Une note fair-play de 3,
// le soir d'une défaite.

import type { MouvementEffectif, PresentEntraineur, RencontreEntraineur } from "@/lib/sfl/entraineur";

/** Les joueurs et la note de leur carte au début de la saison. */
export const JOUEURS_DEMO: Record<string, number> = {
  Yanis: 84,
  Bilal: 81,
  Théo: 79,
  Medhi: 78,
  Kevin: 76,
  Ryad: 75,
  Samir: 74,
  Nassim: 75,
};

type Ligne = [nom: string, titulaire: 0 | 1, buts: number, passes: number, distinction?: PresentEntraineur["distinction"]];

const venus = (lignes: Ligne[], retard: string[] = []): PresentEntraineur[] =>
  lignes.map(([nom, t, buts, passes, distinction]) => ({ nom, titulaire: !!t, buts, passes, aLHeure: !retard.includes(nom), ...(distinction && { distinction }) }));

const r = (
  n: number,
  le: string,
  [pour, contre]: [number, number],
  attendu: number,
  presents: PresentEntraineur[],
  autres: Partial<RencontreEntraineur> = {}
): RencontreEntraineur => ({
  id: `bb-${n}`,
  le,
  classee: true,
  forfait: false,
  pour,
  contre,
  attendu,
  indiceCale: n > 5,
  presents,
  absentsInscrits: 0,
  fairPlay: 5,
  sanctions: 0,
  litigeFautif: false,
  ...autres,
});

export const RENCONTRES_DEMO: RencontreEntraineur[] = [
  r(1, "2026-11-07", [4, 3], 0.55, venus([["Yanis", 1, 2, 0, "MJ"], ["Bilal", 1, 1, 1], ["Théo", 1, 0, 1], ["Medhi", 1, 0, 0, "MD"], ["Kevin", 1, 1, 0], ["Ryad", 0, 0, 1], ["Samir", 0, 0, 0]])),
  r(2, "2026-11-14", [2, 2], 0.48, venus([["Yanis", 1, 1, 0], ["Bilal", 0, 0, 1], ["Théo", 1, 0, 0], ["Medhi", 1, 0, 0], ["Kevin", 0, 0, 0], ["Ryad", 1, 1, 0, "MD"], ["Samir", 1, 0, 0]], ["Kevin"]), { fairPlay: 4.1 }),
  r(3, "2026-11-21", [5, 2], 0.6, venus([["Yanis", 0, 1, 1], ["Bilal", 1, 2, 0, "MJ"], ["Théo", 1, 1, 1], ["Medhi", 0, 0, 0], ["Kevin", 1, 0, 1], ["Ryad", 1, 1, 0], ["Samir", 1, 0, 1, "MD"]])),
  r(4, "2026-11-28", [3, 4], 0.52, venus([["Yanis", 1, 2, 0], ["Bilal", 1, 0, 1], ["Théo", 0, 0, 0], ["Medhi", 1, 0, 0, "MD"], ["Kevin", 1, 1, 0], ["Ryad", 1, 0, 1]]), { fairPlay: 4.4 }),
  r(5, "2026-12-05", [6, 4], 0.45, venus([["Yanis", 1, 3, 1, "MJ"], ["Bilal", 1, 1, 2], ["Théo", 1, 1, 0], ["Medhi", 1, 0, 1], ["Kevin", 1, 1, 0, "MD"], ["Ryad", 0, 0, 0], ["Samir", 0, 0, 0]])),
  r(6, "2026-12-12", [3, 1], 0.58, venus([["Yanis", 1, 1, 1], ["Bilal", 1, 1, 0], ["Théo", 1, 0, 1, "MD"], ["Medhi", 1, 0, 0], ["Kevin", 1, 1, 0, "MJ"], ["Ryad", 0, 0, 0], ["Samir", 0, 0, 0]], ["Ryad"])),
  r(7, "2026-12-19", [4, 4], 0.4, venus([["Yanis", 1, 2, 0], ["Bilal", 1, 1, 1, "MJ"], ["Théo", 1, 1, 1], ["Medhi", 1, 0, 0, "MD"], ["Kevin", 1, 0, 1], ["Ryad", 0, 0, 0]]), { fairPlay: 4.2 }),
  r(8, "2027-01-09", [2, 3], 0.62, venus([["Yanis", 1, 1, 0], ["Bilal", 1, 1, 0], ["Théo", 1, 0, 1, "MD"], ["Medhi", 1, 0, 0]]), { absentsInscrits: 1, fairPlay: 3.1 }),
  r(9, "2027-01-16", [5, 3], 0.35, venus([["Yanis", 0, 1, 1], ["Bilal", 1, 2, 0, "MJ"], ["Théo", 1, 1, 1], ["Medhi", 1, 0, 1], ["Kevin", 1, 1, 0, "MD"], ["Ryad", 1, 0, 1], ["Nassim", 0, 0, 0]])),
  r(10, "2027-01-23", [6, 2], 0.55, venus([["Yanis", 1, 2, 1, "MJ"], ["Bilal", 0, 1, 1], ["Théo", 1, 0, 1], ["Medhi", 1, 0, 0, "MD"], ["Kevin", 0, 1, 0], ["Ryad", 1, 1, 0], ["Nassim", 1, 1, 0]])),
  r(11, "2027-02-06", [3, 3], 0.3, venus([["Yanis", 1, 1, 1], ["Bilal", 1, 1, 0], ["Théo", 0, 0, 1], ["Medhi", 1, 0, 0, "MD"], ["Kevin", 1, 1, 0, "MJ"], ["Ryad", 0, 0, 0], ["Nassim", 1, 0, 1]]), { fairPlay: 4.6 }),
  r(12, "2027-02-13", [4, 2], 0.5, venus([["Yanis", 1, 1, 1], ["Bilal", 1, 1, 0], ["Théo", 1, 1, 1, "MJ"], ["Medhi", 0, 0, 0], ["Kevin", 1, 0, 1], ["Ryad", 0, 1, 0, "MD"], ["Nassim", 1, 0, 0]])),
];

export const MOUVEMENTS_DEMO: MouvementEffectif[] = [{ le: "2026-12-20", nom: "Samir", quoi: "depart" }];

/** Le jour où Lucien a signé comme entraîneur de Bois-Blancs FC. */
export const ARRIVEE_DEMO = "2026-11-01";
