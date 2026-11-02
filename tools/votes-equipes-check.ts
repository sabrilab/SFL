// Les titres votés par équipe (lib/sfl/votes.ts, 02/11/2026). Ilyes : « Le
// principe c'est qu'il y en ait un par équipe : un joueur Impact pour chaque
// équipe et un joueur Défensive pour chaque équipe. Il n'y a que le MVP qui
// est unique, sauf en cas d'égalité. » Puis : « oui, un joueur peut avoir la
// Défensive et l'Impact le même jour », et pour les journées passées aussi.
// Avant, decompterMatch mêlait les candidats des deux équipes et n'élisait
// que le plus voté du match.
//
// Ce que le banc vérifie :
//   1 · la J4, Match 1 (Noirs 1 contre Blancs 1), avec les comptes de voix
//       du 1er novembre (les votants sont inventés : jamais qui a voté pour
//       qui) : l'ancien décompte donnait l'Impact au seul Youss et la
//       Défensive au seul Sidali ; Noirs 1 a désormais Youss en Impact et en
//       Défensive, Blancs 1 Jouneid en Impact et Sidali en Défensive ;
//   2 · des ex æquo dans une équipe : tous élus, l'autre garde le sien ;
//   3 · une équipe sans voix : personne, même une case cochée par l'admin ;
//   4 · un même joueur Impact et Défensive le même jour (Youss, en 1) ;
//   5 · une voix pour un coéquipier ne compte pas ;
//   6 · ni l'extra time ni une place X ne votent ni ne sont élus dans le
//       match qu'ils complètent ; l'élu venu en extra time porte son titre
//       sur la ligne de son propre match ;
//   7 · les titres faibles (moins de VOIX_MIN voix) se jugent par équipe ;
//   8 · le bilan de l'admin (bilanJournee, Admin → Feuille → Votes) et le
//       compte du vote d'un joueur (vote-figures.tsx) : l'élection de chaque
//       équipe ; le MVP, l'heure de la révélation et le serveur ne changent pas.
//   npx tsx tools/votes-equipes-check.ts
import assert from "node:assert/strict";
import { saisonAvecVotes } from "../src/lib/sfl/saison-serveur.server";
import { computeJournees, deriveSeason } from "../src/lib/sfl/saisie/engine";
import { cleTitre, VOIX_MIN } from "../src/lib/sfl/saisie/evolution";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import {
  appliquerVotes,
  bilanJournee,
  decompterMatch,
  titresFaibles,
  type CategorieVote,
  type Decompte,
  type VoteFigure,
} from "../src/lib/sfl/votes";

// Le seuil validé par Sabri le 26/10 : les cas ci-dessous sont écrits pour lui.
assert.equal(VOIX_MIN, 2);

const J = 4;
/** Bien après la J4 : ses votes sont tombés (minuit, l'ancien régime). */
const LOIN = new Date(2030, 0, 1);

const ligne = (player: string, team: string, autre: Partial<MatchEntry> = {}): MatchEntry => ({
  j: J, player, team, statut: "Présent", result: team.startsWith("Noirs") ? "Défaite" : "Victoire", sflTime: false,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false, ...autre,
});

/** La J4 de la saison 1 (MVP calculé, donc votée) : Noirs N contre Blancs N, dans l'ordre. */
function journee(matchs: [string[], string[]][], extra: MatchEntry[] = []): Saison {
  return {
    numero: 1,
    journees: [{
      j: J, date: "1 nov.", sflTime: false, mvpAuto: true,
      matchsDuJour: matchs.map((_, i) => ({ equipes: [`Noirs ${i + 1}`, `Blancs ${i + 1}`] as [string, string] })),
    }],
    roster: [],
    entries: [
      ...matchs.flatMap(([noirs, blancs], i) => [
        ...noirs.map((n) => ligne(n, `Noirs ${i + 1}`)),
        ...blancs.map((n) => ligne(n, `Blancs ${i + 1}`)),
      ]),
      ...extra,
    ],
    convocations: [],
  };
}

/** Un bulletin par votant, tous pour `candidat`. */
const voix = (categorie: CategorieVote, candidat: string, votants: string[], m = 1): VoteFigure[] =>
  votants.map((votant) => ({ saison: 1, j: J, categorie, votant, candidat, match_id: `j4-m${m}`, jour: "2026-11-01" }));

const jourDe = (s: Saison) => computeJournees(s).find((x) => x.j === J)!;
const decompte = (s: Saison, votes: VoteFigure[], m: number, cat: CategorieVote) => decompterMatch(votes, 1, J, jourDe(s).matches![m], cat);
/** Les élus posés sur les lignes (hors extra time), comme les lit toute l'app. */
const titres = (s: Saison, cat: CategorieVote) =>
  s.entries.filter((e) => e.j === J && !e.extraTime && e[cat]).map((e) => e.player).sort();
const poser = (s: Saison, votes: VoteFigure[]) => appliquerVotes(s, computeJournees(s), votes, LOIN);
const faibles = (s: Saison, votes: VoteFigure[]) => [...titresFaibles(s, computeJournees(s), votes, LOIN)].sort();
/** L'ancien décompte : le plus voté du match, les deux équipes mêlées. */
const ancien = (d: Decompte) => {
  const tous = d.equipes.flatMap((e) => e.voix);
  const max = Math.max(0, ...tous.map(([, n]) => n));
  return max ? tous.filter(([, n]) => n === max).map(([nom]) => nom).sort() : [];
};

/* ----------------------- 1 et 4 · La J4, Match 1 ----------------------- */
const NOIRS1 = ["Youss", "n2", "n3", "n4", "n5"];
const BLANCS1 = ["Jouneid", "Sidali", "b3", "b4", "b5"];
const m1 = journee([[NOIRS1, BLANCS1]], []);
// Le MVP du match, calculé à part : la règle des votes n'y touche pas.
m1.entries = m1.entries.map((e) => (e.player === "b5" ? { ...e, mvp: true } : e));
const VOTES_M1: VoteFigure[] = [
  // Impact. Pour Noirs 1, les voix de Blancs 1 : Youss 3, deux joueurs à 1.
  ...voix("impact", "Youss", ["b3", "b4", "b5"]),
  ...voix("impact", "n2", ["Jouneid"]),
  ...voix("impact", "n3", ["Sidali"]),
  // Pour Blancs 1, les voix de Noirs 1 : Jouneid 2, deux joueurs à 1 (n5 ne vote pas).
  ...voix("impact", "Jouneid", ["n2", "n3"]),
  ...voix("impact", "b3", ["Youss"]),
  ...voix("impact", "Sidali", ["n4"]),
  // Défensive. Pour Noirs 1 : Youss 2, trois joueurs à 1 ; pour Blancs 1 : Sidali 3, un joueur à 1.
  ...voix("def", "Youss", ["b4", "b5"]),
  ...voix("def", "n2", ["Sidali"]),
  ...voix("def", "n3", ["Jouneid"]),
  ...voix("def", "n4", ["b3"]),
  ...voix("def", "Sidali", ["Youss", "n2", "n3"]),
  ...voix("def", "b3", ["n4"]),
];
{
  const imp = decompte(m1, VOTES_M1, 0, "impact");
  const def = decompte(m1, VOTES_M1, 0, "def");
  // Le défaut du 1er novembre : un seul élu par match.
  assert.deepEqual(ancien(imp), ["Youss"], "avant : l'Impact du match à Youss seul, Blancs 1 sans Impact");
  assert.deepEqual(ancien(def), ["Sidali"], "avant : la Défensive du match à Sidali seul, Noirs 1 sans Défensive");

  // Chaque équipe a son élection.
  assert.deepEqual(imp.equipes.map((e) => e.equipe), ["Noirs 1", "Blancs 1"]);
  assert.deepEqual(imp.equipes[0].voix, [["Youss", 3], ["n2", 1], ["n3", 1]]);
  assert.deepEqual(imp.equipes[1].voix, [["Jouneid", 2], ["b3", 1], ["Sidali", 1]]);
  assert.deepEqual(def.equipes[0].voix, [["Youss", 2], ["n2", 1], ["n3", 1], ["n4", 1]]);
  assert.deepEqual(def.equipes[1].voix, [["Sidali", 3], ["b3", 1]]);
  assert.deepEqual(imp.equipes[0].elus, ["Youss"], "Noirs 1 : Impact Youss");
  assert.deepEqual(imp.equipes[1].elus, ["Jouneid"], "Blancs 1 : Impact Jouneid");
  assert.deepEqual(def.equipes[0].elus, ["Youss"], "Noirs 1 : Défensive Youss");
  assert.deepEqual(def.equipes[1].elus, ["Sidali"], "Blancs 1 : Défensive Sidali");
  assert.deepEqual(imp.elus, ["Youss", "Jouneid"], "les élus du match : ceux des deux équipes");
  // Les électeurs d'une équipe sont les joueurs de l'autre.
  assert.deepEqual([imp.equipes[0].votants, imp.equipes[0].inscrits], [5, 5]);
  assert.deepEqual([imp.equipes[1].votants, imp.equipes[1].inscrits], [4, 5]);
  assert.deepEqual([imp.votants, imp.inscrits], [9, 10]);

  // Posés sur les lignes : 4 · Youss cumule l'Impact et la Défensive.
  const titree = poser(m1, VOTES_M1);
  assert.deepEqual(titres(titree, "impact"), ["Jouneid", "Youss"]);
  assert.deepEqual(titres(titree, "def"), ["Sidali", "Youss"]);
  const youss = titree.entries.find((e) => e.player === "Youss")!;
  assert.ok(youss.impact && youss.def, "un même joueur Impact et Défensive le même jour");
  // Le MVP ne bouge pas.
  assert.deepEqual(titree.entries.filter((e) => e.mvp).map((e) => e.player), ["b5"], "le MVP reste celui des stats");
  // 3, 2, 2 et 3 voix : aucun titre faible.
  assert.deepEqual(faibles(m1, VOTES_M1), []);
  // Les points Pépite : +1 par titre, Youss +2.
  const pp = (s: Saison) => new Map(deriveSeason(s).players.map((p) => [p.name, p.pp]));
  const avant = pp(m1);
  const apres = pp(titree);
  assert.equal(apres.get("Youss")! - avant.get("Youss")!, 2);
  assert.equal(apres.get("Jouneid")! - avant.get("Jouneid")!, 1);
  assert.equal(apres.get("Sidali")! - avant.get("Sidali")!, 1);
  // Le serveur lit la même saison que les téléphones.
  assert.deepEqual(saisonAvecVotes(m1, VOTES_M1, LOIN).entries, titree.entries);

  // L'heure de la révélation ne change pas : le jour du match, rien n'est posé (titresTombes).
  const leJour = new Date("2026-11-01T15:00:00Z");
  assert.equal(appliquerVotes(m1, computeJournees(m1), VOTES_M1, leJour), m1, "le jour même : rien de posé");
  assert.equal(titresFaibles(m1, computeJournees(m1), VOTES_M1, leJour).size, 0);
  assert.notEqual(appliquerVotes(m1, computeJournees(m1), VOTES_M1, new Date("2026-11-01T23:01:00Z")), m1, "à minuit, Paris");

  /* 8 · Le bilan de l'admin : l'élection de chaque équipe, les mêmes élus. */
  const bilan = bilanJournee(VOTES_M1, 1, jourDe(m1));
  assert.deepEqual(bilan.matchs[0].parCategorie.impact, imp);
  assert.deepEqual(bilan.matchs[0].parCategorie.def, def);
  assert.deepEqual([bilan.votants, bilan.inscrits], [9, 10]);
  assert.deepEqual(bilan.matchs[0].nontPasVote, ["n5"]);
  assert.deepEqual(bilan.ecartees, []);
  // Le compte du vote d'un joueur (vote-figures.tsx) : l'élection de l'équipe adverse, où il vote.
  assert.deepEqual([imp.equipes[1].votants, imp.equipes[1].inscrits], [4, 5], "n5, de Noirs 1 : 4/5 ont voté");
  assert.deepEqual([imp.equipes[0].votants, imp.equipes[0].inscrits], [5, 5], "Jouneid, de Blancs 1 : 5/5 ont voté");
}

/* ----------------------- 2 · Des ex æquo dans une équipe ----------------------- */
const A = ["A1", "A2", "A3", "A4"];
const B = ["B1", "B2", "B3", "B4"];
{
  const s = journee([[A, B]]);
  const votes = [
    ...voix("impact", "A1", ["B1", "B2"]),
    ...voix("impact", "A2", ["B3", "B4"]),
    ...voix("impact", "B1", ["A1", "A2", "A3"]),
    ...voix("impact", "B2", ["A4"]),
  ];
  const d = decompte(s, votes, 0, "impact");
  assert.deepEqual(ancien(d), ["B1"], "avant : B1 (3 voix) seul, les Noirs sans Impact");
  assert.deepEqual(d.equipes[0].elus, ["A1", "A2"], "ex æquo à 2 voix : les deux élus");
  assert.deepEqual(d.equipes[1].elus, ["B1"], "l'autre équipe garde son élu");
  assert.deepEqual(titres(poser(s, votes), "impact"), ["A1", "A2", "B1"]);
  assert.deepEqual(faibles(s, votes), []);
}

/* ----------------------- 3 · Une équipe sans voix ----------------------- */
{
  // L'admin avait coché la Défensive de A3 : la journée a ses votes, ils décident.
  const s = journee([[A, B]]);
  s.entries = s.entries.map((e) => (e.player === "A3" ? { ...e, def: true } : e));
  const votes = voix("def", "B1", ["A1", "A2"]);
  const d = decompte(s, votes, 0, "def");
  assert.deepEqual(d.equipes[0], { equipe: "Noirs 1", voix: [], votants: 0, inscrits: 4, elus: [] }, "les Noirs : aucune voix, personne");
  assert.deepEqual(d.equipes[1].elus, ["B1"]);
  assert.deepEqual(titres(poser(s, votes), "def"), ["B1"], "la case de l'admin tombe : personne pour les Noirs");
  // Sans aucune voix de Défensive dans la journée, ce que l'admin a coché reste.
  assert.deepEqual(titres(poser(s, voix("impact", "B1", ["A1"])), "def"), ["A3"]);
}

/* ----------------------- 5 · Une voix pour un coéquipier ----------------------- */
{
  const s = journee([[A, B]]);
  const votes = [...voix("impact", "A2", ["A1", "A3"]), ...voix("impact", "B1", ["A4"])];
  const d = decompte(s, votes, 0, "impact");
  assert.deepEqual(d.equipes[0].voix, [], "deux voix de coéquipiers : aucune ne compte");
  assert.deepEqual(d.equipes[0].elus, []);
  assert.deepEqual([d.votants, d.equipes[1].votants], [1, 1]);
  assert.deepEqual(titres(poser(s, votes), "impact"), ["B1"]);
  const ecartees = bilanJournee(votes, 1, jourDe(s)).ecartees;
  assert.deepEqual(ecartees.map((v) => [v.votant, v.raison]), [["A1", "vote pour un coéquipier"], ["A3", "vote pour un coéquipier"]]);
}

/* ----------------------- 6 · L'extra time et les places X ----------------------- */
{
  // Match 1 : X1 complète les Noirs 1 ; C1, titulaire des Noirs 2, vient en extra time chez les Blancs 1.
  const s = journee(
    [[["A1", "A2", "A3", "X1"], ["B1", "B2", "B3"]], [["C1", "C2", "C3"], ["D1", "D2", "D3"]]],
    [ligne("C1", "Blancs 1", { extraTime: true, result: null })]
  );
  const m = jourDe(s).matches!;
  assert.ok(m[0].teamB.players.some((p) => p.name === "C1" && p.extraTime), "C1 en extra time au Match 1");
  const votes = [
    // Deux voix pour la place X1, une pour A1 : X1 n'est pas candidate.
    ...voix("impact", "X1", ["B1", "B2"]),
    ...voix("impact", "A1", ["B3"]),
    // C1 vote au Match 1, où il n'est venu qu'en extra time : sa voix ne compte pas.
    ...voix("impact", "A2", ["C1"]),
    // Une voix pour C1 au Match 1 : il n'y est pas candidat.
    ...voix("def", "C1", ["A3"]),
    // Une voix « de » X1 : une place X ne vote pas.
    ...voix("def", "B2", ["X1"]),
    // Dans son propre match, C1 est candidat : élu Impact des Noirs 2.
    ...voix("impact", "C1", ["D1", "D2"], 2),
  ];
  const imp = decompterMatch(votes, 1, J, m[0], "impact");
  const def = decompterMatch(votes, 1, J, m[0], "def");
  const bulletins = (nom: string) => votes.filter((v) => v.categorie === "impact" && v.candidat === nom).length;
  assert.ok(bulletins("X1") > bulletins("A1"), "X1 a plus de bulletins qu'A1 : comptée, la place X prenait l'Impact");
  assert.deepEqual(imp.equipes[0].voix, [["A1", 1]], "la place X et l'extra time écartés");
  assert.deepEqual(imp.equipes[0].elus, ["A1"]);
  assert.deepEqual(def.equipes[1].voix, [], "aucune voix valable pour les Blancs 1");
  assert.deepEqual([imp.equipes[0].inscrits, imp.equipes[1].inscrits, imp.inscrits], [3, 3, 6], "ni X1 ni C1 parmi les électeurs du Match 1");
  const titree = poser(s, votes);
  assert.deepEqual(titres(titree, "impact"), ["A1", "C1"]);
  assert.equal(titree.entries.find((e) => e.player === "X1")!.impact, false, "jamais un titre pour une place X");
  // Le titre de C1 est sur la ligne de son match à lui, pas sur sa ligne d'extra time.
  assert.equal(titree.entries.find((e) => e.player === "C1" && !e.extraTime)!.impact, true);
  assert.equal(titree.entries.find((e) => e.player === "C1" && e.extraTime)!.impact, false);
  const bilan = bilanJournee(votes, 1, jourDe(s));
  assert.deepEqual(
    bilan.ecartees.map((v) => `${v.votant}→${v.candidat} ${v.raison}`).sort(),
    [
      "A3→C1 candidat d'un autre match",
      "B1→X1 candidat : une place X",
      "B2→X1 candidat : une place X",
      "C1→A2 candidat d'un autre match",
      "X1→B2 votant : une place X",
    ]
  );
  assert.equal(bilan.inscrits, 12, "X1 n'est pas inscrit, C1 compte une fois");
  assert.ok(!bilan.matchs[0].ontVote.includes("X1") && !bilan.matchs[0].nontPasVote.includes("X1"));
}

/* ----------------------- 7 · Les titres faibles, par équipe ----------------------- */
{
  const s = journee([[A, B]]);
  const votes = [
    ...voix("impact", "A1", ["B1", "B2", "B3"]),
    ...voix("impact", "B1", ["A1"]),
    ...voix("def", "A2", ["B1", "B2"]),
    ...voix("def", "B2", ["A2"]),
    ...voix("def", "B3", ["A3"]),
  ];
  // Avant : B1 (1 voix) perdait l'Impact contre A1 (3), B2 et B3 la Défensive contre A2 (2).
  assert.deepEqual(ancien(decompte(s, votes, 0, "impact")), ["A1"]);
  assert.deepEqual(ancien(decompte(s, votes, 0, "def")), ["A2"]);
  const titree = poser(s, votes);
  assert.deepEqual(titres(titree, "impact"), ["A1", "B1"]);
  assert.deepEqual(titres(titree, "def"), ["A2", "B2", "B3"]);
  // Faible : l'élu d'une équipe à une voix, même si l'autre a le sien à trois ; les ex æquo à une voix aussi.
  assert.deepEqual(faibles(s, votes), [cleTitre(J, "def", "B2"), cleTitre(J, "def", "B3"), cleTitre(J, "impact", "B1")].sort());
  // Un titre faible reste un titre (la carte, le point Pépite) mais ne fait pas monter la note.
  const lue = saisonAvecVotes(s, votes, LOIN);
  assert.deepEqual(lue.titresFaibles, faibles(s, votes));
  const derivee = deriveSeason(lue);
  /** Les crans que ses titres versent à sa note ce jour-là. */
  const crans = (nom: string) =>
    (derivee.evolution.joueurs.get(nom)?.journal ?? [])
      .flatMap((jour) => jour.faits)
      .filter((f) => f.raison.startsWith("titre"))
      .reduce((n, f) => n + f.crans, 0);
  assert.equal(derivee.players.find((p) => p.name === "B1")!.impact, 1, "B1 garde son titre Impact");
  assert.equal(derivee.players.find((p) => p.name === "B1")!.pp - deriveSeason(s).players.find((p) => p.name === "B1")!.pp, 1, "et son point Pépite");
  assert.equal(crans("B1"), 0, "titre faible : rien pour la note");
  assert.equal(crans("B2"), 0);
  assert.ok(crans("A1") > 0 && crans("A2") > 0, "trois et deux voix : la note avance");
}

console.log(
  "votes-equipes-check : la J4 Match 1 (Youss Impact et Défensive pour Noirs 1, Jouneid et Sidali pour Blancs 1), ex æquo par équipe, équipe sans voix, cumul, coéquipier, extra time, places X, titres faibles par équipe, bilan de l'admin, MVP et révélation inchangés — ok"
);
