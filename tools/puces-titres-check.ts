// Vérifie les puces des titres d'un match (lib/sfl/puces-titres.ts) : dorée
// pour le MVP, rouge pour l'Impact, bleue pour la Défensive (Ilyes,
// 02/11/2026), de la J1 à la J4 et pour toute journée à venir. Une puce
// n'apparaît qu'une fois le titre attribué : elle se lit dans la saison où
// les votes fermés sont posés (appliquerVotes), jamais pendant le vote.
//   npx tsx tools/puces-titres-check.ts
import assert from "node:assert/strict";
import { computeJournees } from "../src/lib/sfl/saisie/engine";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import type { MatchEntry } from "../src/lib/sfl/saisie/types";
import { titresDeLigne, titresDuJoueur, titresDuJour } from "../src/lib/sfl/puces-titres";
import { appliquerVotes, type VoteFigure } from "../src/lib/sfl/votes";

const ligne = (j: number, player: string, team: string | null, t: Partial<MatchEntry> = {}): MatchEntry => ({
  j,
  player,
  team,
  statut: "Présent",
  result: "Victoire",
  sflTime: false,
  buts: 0,
  passes: 0,
  cleanSheet: false,
  mvp: false,
  impact: false,
  def: false,
  retard: false,
  ...t,
});

/* --------------------------- La J1 à la J4 de la saison --------------------------- */

const brute = seedSaison();
const journees = computeJournees(brute);
for (const j of [1, 2, 3, 4]) {
  const jour = journees.find((x) => x.j === j)!;
  assert.ok(jour, `la J${j} existe`);
  const lignes = brute.entries.filter((e) => e.j === j && !e.extraTime && !e.vitrine);
  // Chaque titre écrit sur une ligne a sa puce, sur la carte de ce match-là.
  for (const m of jour.matches ?? []) {
    const equipes = [m.teamA.name, m.teamB.name] as const;
    const parNom = titresDuJour(brute.entries, j, equipes);
    for (const p of [...m.teamA.players, ...m.teamB.players]) {
      const e = lignes.find((x) => x.player === p.name && equipes.includes(x.team as string));
      const attendu = p.extraTime ? [] : e ? titresDeLigne(e) : [];
      assert.deepEqual(titresDuJoueur(brute.entries, j, p.name, equipes), attendu, `J${j} ${p.name}`);
      assert.deepEqual(parNom.get(p.name.toLowerCase()) ?? [], attendu, `J${j} ${p.name} (le terrain entier)`);
    }
  }
  // Toutes les puces d'une journée = tous ses titres, ni plus ni moins.
  const n = [...titresDuJour(brute.entries, j).values()].reduce((s, t) => s + t.length, 0);
  const titres = lignes.reduce((s, e) => s + titresDeLigne(e).length, 0);
  assert.equal(n, titres, `J${j} : autant de puces que de titres`);
}
// La J2 n'a aucun titre écrit : aucune puce.
assert.equal(titresDuJour(brute.entries, 2).size, 0, "la J2 sans titre n'a aucune puce");
// La J4 : Wadie, MVP, Impact et Défensive à la fois, porte trois puces dans l'ordre.
assert.deepEqual(titresDuJoueur(brute.entries, 4, "Wadie"), ["mvp", "impact", "def"]);
// La J3 : Ilyes, MVP et Impact, dans cet ordre.
assert.deepEqual(titresDuJoueur(brute.entries, 3, "Ilyes"), ["mvp", "impact"]);
// La J1 : deux Défensives, une par équipe du même match, chacune sa puce.
assert.deepEqual(titresDuJoueur(brute.entries, 1, "Smail"), ["def"]);
assert.deepEqual(titresDuJoueur(brute.entries, 1, "Sidali"), ["def"]);

/* ------------------------------- Les cas d'un match ------------------------------- */

const M1 = ["Noirs 1", "Blancs 1"] as const;
const M2 = ["Noirs 2", "Blancs 2"] as const;
const cas: MatchEntry[] = [
  // Deux MVP ex æquo dans le même match : chacun sa puce dorée.
  ligne(9, "Adil", "Noirs 1", { mvp: true, def: true }),
  ligne(9, "Bilal", "Blancs 1", { mvp: true }),
  ligne(9, "Chafik", "Blancs 1", { impact: true }),
  ligne(9, "Driss", "Noirs 1"),
  // Le même ordre quel que soit l'ordre des lignes : MVP, Impact, Défensive.
  ligne(9, "Elias", "Noirs 2", { def: true, impact: true, mvp: true }),
  // Venu en extra time dans le match 1 (ses titres sont ceux du match 2).
  ligne(9, "Elias", "Noirs 1", { extraTime: true }),
  ligne(9, "Farid", "Blancs 2"),
  // Une ligne du compte vitrine ne porte jamais rien.
  ligne(9, "Vitrine", "Blancs 2", { mvp: true, vitrine: true }),
  // Un nom écrit avec des espaces et une capitale de trop.
  ligne(9, "  Ghali ", "Blancs 2", { impact: true }),
  // La J10 jouée, pas encore attribuée : aucun titre sur ses lignes.
  ligne(10, "Adil", "Noirs 1"),
  ligne(10, "Bilal", "Blancs 1"),
];
assert.deepEqual(titresDuJoueur(cas, 9, "Adil", M1), ["mvp", "def"], "MVP et Défensive");
assert.deepEqual(titresDuJoueur(cas, 9, "Bilal", M1), ["mvp"], "MVP ex æquo");
assert.deepEqual(titresDuJoueur(cas, 9, "Chafik", M1), ["impact"]);
assert.deepEqual(titresDuJoueur(cas, 9, "Driss", M1), [], "sans titre, sans puce");
assert.deepEqual(titresDuJoueur(cas, 9, "Elias", M2), ["mvp", "impact", "def"], "trois titres, dans l'ordre");
assert.deepEqual(titresDuJoueur(cas, 9, "Elias", M1), [], "en extra time dans un autre match : rien");
assert.deepEqual(titresDuJoueur(cas, 9, "Adil", M2), [], "le mauvais match : rien");
assert.deepEqual(titresDuJoueur(cas, 9, "Vitrine", M2), [], "la vitrine : rien");
assert.deepEqual(titresDuJoueur(cas, 9, "ghali", M2), ["impact"], "un nom écrit autrement");
assert.deepEqual(titresDuJoueur(cas, 9, "Personne", M1), [], "une ligne absente : rien");
assert.deepEqual(titresDuJoueur(cas, 11, "Adil"), [], "une journée sans lignes : rien");
assert.equal(titresDuJour(cas, 10).size, 0, "une journée pas encore attribuée : aucune puce");
// Le terrain entier du match 1 : les deux MVP, l'Impact, et personne d'autre.
assert.deepEqual(
  [...titresDuJour(cas, 9, M1)].sort(),
  [
    ["adil", ["mvp", "def"]],
    ["bilal", ["mvp"]],
    ["chafik", ["impact"]],
  ],
);
// Une journée « à plat » (sans équipes) : un seul match, toutes ses lignes.
assert.deepEqual(titresDuJoueur([ligne(12, "Adil", null, { mvp: true })], 12, "Adil", M1), ["mvp"]);
// Les booléens d'une ligne de récap (PitchLine), dans l'ordre des puces.
assert.deepEqual(titresDeLigne({ def: true, mvp: true }), ["mvp", "def"]);
assert.deepEqual(titresDeLigne({}), []);

/* --------------------- Une fois attribué : pendant le vote, rien --------------------- */

// La J3 votée (MVP calculé, comme les journées depuis le 15/10), Bilal élu Impact.
const J = 3;
const avecVote = { ...brute, journees: brute.journees.map((m) => (m.j === J ? { ...m, mvpAuto: true } : m)) };
const jv = computeJournees(avecVote);
const match = jv.find((m) => m.j === J)!.matches!.find((m) => [...m.teamA.players, ...m.teamB.players].some((p) => p.name === "Bilal"))!;
const equipes = [match.teamA.name, match.teamB.name] as const;
const adversaires = match.teamA.players.some((p) => p.name === "Bilal") ? match.teamB : match.teamA;
const votes: VoteFigure[] = adversaires.players
  .filter((p) => !p.extraTime)
  .slice(0, 3)
  .map((p) => ({ saison: avecVote.numero ?? 0, j: J, categorie: "impact", votant: p.name, candidat: "Bilal", match_id: "m" }));
// Le jour même (5 juillet, 15 h à Paris) : le vote est ouvert, rien n'est posé.
const pendant = appliquerVotes(avecVote, jv, votes, new Date("2026-07-05T13:00:00Z"));
assert.deepEqual(titresDuJoueur(pendant.entries, J, "Bilal", equipes), [], "pendant le vote : pas de puce");
// Le vote fermé : la puce rouge tombe.
const apres = appliquerVotes(avecVote, jv, votes, new Date(2030, 0, 1));
assert.deepEqual(titresDuJoueur(apres.entries, J, "Bilal", equipes), ["impact"], "vote fermé : la puce Impact");
// Le document brut, lui, n'a jamais le titre voté : on ne le lit pas.
assert.deepEqual(titresDuJoueur(avecVote.entries, J, "Bilal", equipes), []);
// Une vue figée jusqu'à la révélation remet à zéro les lignes du jour : plus aucune puce.
const figee = apres.entries.map((e) => (e.j === J ? { ...e, mvp: false, impact: false, def: false } : e));
assert.equal(titresDuJour(figee, J).size, 0, "vue figée avant la révélation : aucune puce");

console.log("puces-titres-check : ok");
