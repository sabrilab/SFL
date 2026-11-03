// Un joueur qui cumule les titres d'un dimanche les voit tous. Ilyes,
// 02/11/2026 : un Impact et une Défensive pour chaque équipe, le MVP unique au
// match, et « oui, un joueur peut avoir la Défensive et l'Impact le même
// jour » (et le MVP en plus). Le calcul les posait déjà tous (votes.ts,
// puces, cartes, points) ; des textes n'en gardaient qu'un, reste du temps où
// il n'y avait qu'un titre par match.
//
// Le cas réel : Youss à la J4, Match 1, Noirs 1 (défaite, doublé et 3 passes),
// Joueur Impact (3 voix) et Défensive (2 voix) de son équipe. Les comptes de
// voix sont ceux du 1er novembre ; les votants sont inventés (jamais qui a
// voté pour qui). Et le triple d'Anas (Noirs 3) : MVP, Impact et Défensive.
//
// Ce que le banc vérifie, dans l'ordre des puces (MVP, Impact, Défensive) :
//   1 · les faits marquants de sa fiche (fiche-joueur.ts, faitDuJour) : tous
//       ses titres dans la même ligne, et chacun pèse ;
//   2 · son dimanche dans Ma saison (dimanchesDe, phraseDuJour) : l'Impact
//       et le Mur « de ton équipe », jamais « du match » ;
//   3 · la notification des résultats (annonces-ligue.ts) : ses titres
//       d'équipe, et « Tes 3 cartes » pour le MVP qui cumule ;
//   4 · la notification d'un bravo sur plusieurs de ses exploits
//       (exploits.ts, quoiDesExploits, pour /api/felicitations) : tous ;
//   5 · le débrief de Bola Agent (agent.ts) : tous ses titres du jour.
//   npx tsx tools/titres-cumul-check.ts
import assert from "node:assert/strict";
import { dossierJoueur, questionDebrief } from "../src/lib/sfl/agent";
import { texteResultats } from "../src/lib/sfl/annonces-ligue";
import { exploitsDeLaSaison, quoiDesExploits } from "../src/lib/sfl/exploits";
import { dimanchesDe, ficheJoueur, phraseDuJour } from "../src/lib/sfl/fiche-joueur";
import { definirArbitres } from "../src/lib/sfl/hidden";
import { computeJournees, deriveSeason } from "../src/lib/sfl/saisie/engine";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { appliquerVotes, type CategorieVote, type VoteFigure } from "../src/lib/sfl/votes";

definirArbitres([]);
const J = 4;
/** Bien après la J4 : ses votes sont tombés. */
const LOIN = new Date(2030, 0, 1);
/** Deux jours après la J4 : le débrief du coach est encore frais. */
const MARDI = new Date(2026, 10, 3, 12);

const ligne = (player: string, team: string, autre: Partial<MatchEntry> = {}): MatchEntry => ({
  j: J, player, team, statut: "Présent", result: team.startsWith("Noirs") ? "Défaite" : "Victoire", sflTime: false,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false, ...autre,
});

/** La J4 de la saison 1 (MVP calculé, donc votée), un match : Noirs 1 contre Blancs 1. */
function journee(noirs: MatchEntry[], blancs: MatchEntry[]): Saison {
  return {
    numero: 1,
    journees: [{ j: J, date: "1 nov.", sflTime: false, mvpAuto: true, matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }] }],
    roster: [],
    entries: [...noirs, ...blancs],
    convocations: [],
  };
}
const voix = (categorie: CategorieVote, candidat: string, votants: string[]): VoteFigure[] =>
  votants.map((votant) => ({ saison: 1, j: J, categorie, votant, candidat, match_id: "j4-m1", jour: "2026-11-01" }));
const poser = (s: Saison, votes: VoteFigure[]) => appliquerVotes(s, computeJournees(s), votes, LOIN);

/* ----------------- Youss, J4 : Impact (3 voix) et Défensive (2 voix) de Noirs 1 ----------------- */
const youss = poser(
  journee(
    [ligne("Youss", "Noirs 1", { buts: 2, passes: 3 }), ...["n2", "n3", "n4", "n5"].map((n) => ligne(n, "Noirs 1"))],
    [ligne("b1", "Blancs 1", { buts: 4, mvp: true }), ...["b2", "b3", "b4", "b5"].map((n) => ligne(n, "Blancs 1"))]
  ),
  [
    ...voix("impact", "Youss", ["b1", "b2", "b3"]),
    ...voix("impact", "n2", ["b4"]),
    ...voix("def", "Youss", ["b4", "b5"]),
    ...voix("def", "n3", ["b1"]),
    ...voix("impact", "b2", ["n2", "n3"]),
    ...voix("def", "b3", ["n4", "n5"]),
  ]
);
{
  const l = youss.entries.find((e) => e.player === "Youss")!;
  assert.ok(l.impact && l.def && !l.mvp, "Youss : Impact et Défensive de Noirs 1, pas MVP (le calcul, inchangé)");
  const joueurs = deriveSeason(youss).players;
  const moi = joueurs.find((p) => p.name === "Youss")!;

  // 1 · La fiche : les deux titres, l'Impact d'abord (l'ordre des puces).
  assert.deepEqual(
    ficheJoueur(youss, moi, joueurs).faits.map((f) => `${f.quand} ${f.quoi}`),
    ["J4 Impact et Le Mur de son équipe, doublé et 3 passes"],
    "fiche : avant, « Le Mur de son équipe » seul, l'Impact perdu"
  );

  // 2 · Ma saison : dans l'ordre des puces, « de ton équipe ».
  const [d] = dimanchesDe(youss, "Youss");
  assert.deepEqual(d.titres, ["impact", "def"], "Ma saison : l'Impact puis le Mur, comme les puces");
  assert.equal(phraseDuJour(d), "Défaite, doublé et 3 passes. Impact et Le Mur de ton équipe.", "avant : « Le Mur et Impact du match. »");

  // 3 · Les résultats : ses deux titres d'équipe, puis le MVP de son match.
  assert.deepEqual(texteResultats(youss, J, "Youss"), {
    titre: "J4 · Défaite 2 – 4",
    texte: "Avec les Noirs 1. Impact et Le Mur de ton équipe. MVP du match : b1.",
  }, "résultats : avant, ni l'Impact ni la Défensive");

  // 4 · Un bravo sur la rubrique de son match : ses deux exploits dans une même phrase.
  // La rubrique des titres de son match : ses exploits Impact et Défensive (le Bravo les envoie d'un coup).
  const siens = exploitsDeLaSaison(youss).filter((e) => e.nom === "Youss" && ["mvp", "impact", "def"].includes(e.famille));
  assert.deepEqual(siens.map((e) => e.famille).sort(), ["def", "impact"]);
  assert.equal(quoiDesExploits(siens), "tes titres de Joueur Impact et de meilleur défenseur", "bravo : avant, le dernier seul restait");
  assert.equal(quoiDesExploits(siens.filter((e) => e.famille === "def")), "ton titre de meilleur défenseur", "un seul exploit : sa phrase");

  // 5 · Bola Agent : la question du débrief.
  const dossier = dossierJoueur(youss, moi, joueurs, MARDI);
  assert.deepEqual(dossier.dernierMatch?.titres, ["impact", "def"]);
  assert.equal(questionDebrief(dossier.dernierMatch!), "J4 : défaite, 2 buts, 3 passes, Impact et Le Mur. Alors, c'était comment ?");
  assert.deepEqual(dossier.matchs[0].titres, ["impact", "def"], "le dossier du coach porte tous ses titres");
}

/* ----------------- Anas, J4 : MVP, Impact (1 voix, faible) et Défensive (2 voix) ----------------- */
const anas = poser(
  journee(
    ["n1", "n2", "n3", "n4"].map((n) => ligne(n, "Noirs 1")),
    [ligne("Anas", "Blancs 1", { buts: 2, passes: 4, mvp: true }), ...["b2", "b3", "b4"].map((n) => ligne(n, "Blancs 1"))]
  ),
  [...voix("impact", "Anas", ["n1"]), ...voix("def", "Anas", ["n2", "n3"]), ...voix("impact", "n1", ["b2"])]
);
{
  const l = anas.entries.find((e) => e.player === "Anas")!;
  assert.ok(l.impact && l.def, "Anas : Impact et Défensive des Blancs 1");
  const joueurs = deriveSeason(anas).players;
  const moi = joueurs.find((p) => p.name === "Anas")!;
  // Le MVP sort des stats (mvpAuto, saisie/mvp.ts) et le document le garde : Anas, 2 buts et 4 passes dans la victoire.
  assert.equal(moi.mvp, 1, "Anas : MVP du match");
  assert.deepEqual(
    ficheJoueur(anas, moi, joueurs).faits.map((f) => f.quoi),
    ["MVP du match, Impact et Le Mur de son équipe, doublé et 4 passes"],
    "fiche : avant, « MVP du match » seul"
  );
  assert.deepEqual(texteResultats(anas, J, "Anas"), {
    titre: "J4 · Tu es le MVP",
    texte: "2 buts, 4 passes décisives. Impact et Le Mur de ton équipe. Tes 3 cartes sont dans les Actus.",
  }, "résultats : avant, « Ta carte » pour trois cartes");
  assert.equal(
    quoiDesExploits(exploitsDeLaSaison(anas).filter((e) => e.nom === "Anas" && ["mvp", "impact", "def"].includes(e.famille))),
    "tes titres d'homme du dimanche, de Joueur Impact et de meilleur défenseur"
  );
  assert.equal(questionDebrief(dossierJoueur(anas, moi, joueurs, MARDI).dernierMatch!), "J4 : victoire, 2 buts, 4 passes, MVP, Impact et Le Mur. Alors, c'était comment ?");
}

/* ----------------- MVP et un titre d'équipe (Youss à la J3 : MVP et Défensive) ----------------- */
{
  const mvpMur = poser(
    journee(
      ["n1", "n2", "n3"].map((n) => ligne(n, "Noirs 1")),
      [ligne("Youss", "Blancs 1", { buts: 4, passes: 4, mvp: true }), ...["b2", "b3"].map((n) => ligne(n, "Blancs 1"))]
    ),
    voix("def", "Youss", ["n1"])
  );
  const joueurs = deriveSeason(mvpMur).players;
  const moi = joueurs.find((p) => p.name === "Youss")!;
  assert.deepEqual(ficheJoueur(mvpMur, moi, joueurs).faits.map((f) => f.quoi), ["MVP du match et Le Mur de son équipe, 4 buts et 4 passes"]);
  assert.equal(phraseDuJour(dimanchesDe(mvpMur, "Youss")[0]), "Victoire, 4 buts et 4 passes. MVP du match et Le Mur de ton équipe.");
  assert.equal(texteResultats(mvpMur, J, "Youss").texte, "4 buts, 4 passes décisives. Le Mur de ton équipe. Tes 2 cartes sont dans les Actus.");
}

/* ----------------- Un seul titre : la fiche d'avant ; Ma saison et les résultats le disent de son équipe ----------------- */
{
  const seul = poser(
    journee(
      [ligne("Kader", "Noirs 1", { buts: 1 }), ...["n2", "n3"].map((n) => ligne(n, "Noirs 1"))],
      ["b1", "b2", "b3"].map((n) => ligne(n, "Blancs 1"))
    ),
    voix("def", "Kader", ["b1", "b2"])
  );
  const joueurs = deriveSeason(seul).players;
  const moi = joueurs.find((p) => p.name === "Kader")!;
  assert.deepEqual(ficheJoueur(seul, moi, joueurs).faits.map((f) => f.quoi), ["Le Mur de son équipe, 1 but"]);
  assert.equal(phraseDuJour(dimanchesDe(seul, "Kader")[0]), "Défaite, 1 but. Le Mur de ton équipe.");
  assert.equal(texteResultats(seul, J, "Kader").texte.startsWith("Avec les Noirs 1. Le Mur de ton équipe."), true);
}

console.log("titres-cumul-check : Youss J4 (Impact et Défensive) et Anas J4 (MVP, Impact, Défensive) voient tous leurs titres — fiche, Ma saison, résultats, bravo, Bola Agent — ok");
