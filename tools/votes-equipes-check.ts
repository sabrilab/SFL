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
//       du 1er novembre (les bulletins sont inventés : aucun ne relie deux
//       vrais joueurs, jamais qui a voté pour qui) : l'ancien décompte
//       donnait l'Impact au seul Youss et la
//       Défensive au seul Sidali ; Noirs 1 a désormais Youss en Impact et en
//       Défensive, Blancs 1 Jouneid en Impact et Sidali en Défensive ;
//   2 · des ex æquo dans une équipe : tous élus, l'autre garde le sien ;
//   3 · une équipe sans aucune voix valable pour un titre garde les cases
//       que l'admin a cochées sur ses lignes, comptées en entier (ni
//       faibles, ni effacées) ; dès qu'elle a une voix valable, les votes
//       décident (Ilyes, 03/11/2026 : « Garder » ; la J4, Match 4) ; une
//       ligne sans équipe (le compte vitrine) garde aussi les siennes ;
//   4 · un même joueur Impact et Défensive le même jour (Youss, en 1) ;
//   5 · une voix pour un coéquipier ne compte pas, ni un bulletin d'une
//       autre saison ou d'une autre journée ;
//   6 · ni l'extra time ni une place X ne votent ni ne sont élus dans le
//       match qu'ils complètent ; l'élu venu en extra time porte son titre
//       sur la ligne de son propre match ;
//   7 · les titres faibles (moins de VOIX_MIN voix) se jugent par équipe, et
//       pas avant la révélation (titresTombes), comme les titres ;
//   8 · le bilan de l'admin (bilanJournee, Admin → Feuille → Votes) et le
//       compte du vote d'un joueur (vote-figures.tsx) : l'élection de chaque
//       équipe ; le MVP, l'heure de la révélation et le serveur ne changent pas ;
//   9 · deux équipes de tailles différentes (5 contre 3 et deux places X) :
//       « n/N ont voté » compte les électeurs de l'élection où l'on vote,
//       les joueurs de son équipe, places X exclues (urneDuVotant) ;
//  10 · les textes : la Défensive (le Mur) et l'Impact sont ceux d'une
//       équipe, plus « du match » ; le MVP, lui, reste celui du match.
//   npx tsx tools/votes-equipes-check.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { phraseDefi } from "../src/lib/sfl/defis";
import { findPlayerMatch } from "../src/lib/sfl/engine";
import { ficheJoueur } from "../src/lib/sfl/fiche-joueur";
import { saisonAvecVotes } from "../src/lib/sfl/saison-serveur.server";
import { computeJournees, deriveSeason } from "../src/lib/sfl/saisie/engine";
import { cleTitre, VOIX_MIN } from "../src/lib/sfl/saisie/evolution";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { TROPHEES } from "../src/lib/sfl/trophees";
import {
  appliquerVotes,
  bilanJournee,
  decompterMatch,
  titresFaibles,
  urneDuVotant,
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
/** Le jour du match, avant la révélation ; puis minuit passé à Paris, l'heure de la J4. */
const LE_JOUR = new Date("2026-11-01T15:00:00Z");
const MINUIT = new Date("2026-11-01T23:01:00Z");
/** Ce que lit « n/N ont voté » sur le vote du jour d'un joueur (vote-figures.tsx). */
const urne = (s: Saison, d: Decompte, moi: string) => {
  const u = urneDuVotant(d, findPlayerMatch(jourDe(s), moi)!);
  return [u.equipe, `${u.votants}/${u.inscrits}`];
};
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
  ...voix("def", "Sidali", ["n4", "n2", "n3"]),
  ...voix("def", "b3", ["Youss"]),
];
{
  // Aucun bulletin du banc ne relie deux vrais joueurs : l'un des deux, au moins, est inventé.
  const invente = (n: string) => /^[nb]\d$/.test(n);
  assert.deepEqual(VOTES_M1.filter((v) => !invente(v.votant) && !invente(v.candidat)), [], "un bulletin entre deux vrais joueurs");

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
  // Les titres faibles attendent aussi la révélation : en 7, où il y en a.
  assert.equal(appliquerVotes(m1, computeJournees(m1), VOTES_M1, LE_JOUR), m1, "le jour même : rien de posé");
  assert.notEqual(appliquerVotes(m1, computeJournees(m1), VOTES_M1, MINUIT), m1, "à minuit, Paris");

  /* 8 · Le bilan de l'admin : l'élection de chaque équipe, les mêmes élus. */
  const bilan = bilanJournee(VOTES_M1, 1, jourDe(m1));
  assert.deepEqual(bilan.matchs[0].parCategorie.impact, imp);
  assert.deepEqual(bilan.matchs[0].parCategorie.def, def);
  assert.deepEqual([bilan.votants, bilan.inscrits], [9, 10]);
  assert.deepEqual(bilan.matchs[0].nontPasVote, ["n5"]);
  assert.deepEqual(bilan.ecartees, []);
  // Le compte du vote d'un joueur (vote-figures.tsx) : l'élection de l'équipe adverse, où il vote.
  assert.deepEqual(urne(m1, imp, "n5"), ["Blancs 1", "4/5"], "n5, de Noirs 1 : 4/5 ont voté");
  assert.deepEqual(urne(m1, imp, "Jouneid"), ["Noirs 1", "5/5"], "Jouneid, de Blancs 1 : 5/5 ont voté");
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
  // L'admin avait coché la Défensive de A3 (Noirs 1) et de B3 (Blancs 1). Les Noirs n'ont aucune voix de
  // Défensive : la case de l'admin reste. Les Blancs en ont une : les votes décident, B3 laisse la place à B1.
  const s = journee([[A, B]]);
  s.entries = s.entries.map((e) => (e.player === "A3" || e.player === "B3" ? { ...e, def: true } : e));
  const votes = voix("def", "B1", ["A1", "A2"]);
  const d = decompte(s, votes, 0, "def");
  assert.deepEqual(d.equipes[0], { equipe: "Noirs 1", voix: [], votants: 0, inscrits: 4, elus: [] }, "les Noirs : aucune voix, aucun élu");
  assert.deepEqual(d.equipes[1].elus, ["B1"]);
  const titree = poser(s, votes);
  assert.deepEqual(titres(titree, "def"), ["A3", "B1"], "les Noirs gardent la case de l'admin, les Blancs ont leur élu");
  // Comptée en entier, comme aux J1 et J2 : pas faible, la note monte.
  assert.deepEqual(faibles(s, votes), [], "deux voix pour B1, aucune pour les Noirs : rien de faible");
  const lue = saisonAvecVotes(s, votes, LOIN);
  assert.deepEqual(lue.entries, titree.entries, "le serveur lit la même saison");
  const crans = (nom: string) =>
    (deriveSeason(lue).evolution.joueurs.get(nom)?.journal ?? [])
      .flatMap((jour) => jour.faits)
      .filter((f) => f.raison === "titre Défensive")
      .reduce((n, f) => n + f.crans, 0);
  assert.ok(crans("A3") > 0, "la Défensive gardée de A3 fait monter sa note");
  // Une voix pour un coéquipier n'est pas valable : la case reste. Une voix valable, et les votes décident.
  assert.deepEqual(titres(poser(s, [...votes, ...voix("def", "A2", ["A1"])]), "def"), ["A3", "B1"], "voix d'un coéquipier : la case reste");
  assert.deepEqual(titres(poser(s, [...votes, ...voix("def", "A2", ["B4"])]), "def"), ["A2", "B1"], "une voix valable : A2 élu, la case de A3 tombe");
  // Un bulletin envoyé un autre jour que le match (votesDuJour) n'est pas valable non plus.
  const tard = voix("def", "A2", ["B4"]).map((v) => ({ ...v, jour: "2026-11-02" }));
  assert.deepEqual(titres(poser(s, [...votes, ...tard]), "def"), ["A3", "B1"], "voix d'un autre jour : la case reste");
  // Sans aucune voix de Défensive dans la journée, tout ce que l'admin a coché reste.
  assert.deepEqual(titres(poser(s, voix("impact", "B1", ["A1"])), "def"), ["A3", "B3"]);
  // Une ligne sans équipe (le compte vitrine, compte-vitrine.ts : ses titres à vrai, team: null)
  // n'est dans aucune élection : les votes des équipes ne lui retirent rien.
  const vitrine = { ...s, entries: [...s.entries, ligne("Vitrine", "", { team: null, impact: true, def: true, mvp: true })] };
  const lueVitrine = poser(vitrine, [...votes, ...voix("impact", "B1", ["A1", "A2"]), ...voix("impact", "A1", ["B1"])]);
  const sienne = lueVitrine.entries.find((e) => e.player === "Vitrine")!;
  assert.deepEqual([sienne.mvp, sienne.impact, sienne.def], [true, true, true], "la ligne sans équipe garde tous ses titres");
  assert.deepEqual(titres(lueVitrine, "def"), ["A3", "B1", "Vitrine"]);
  assert.deepEqual(titres(lueVitrine, "impact"), ["A1", "B1", "Vitrine"]);
}
{
  // La J4, Match 4 : Noirs 4 contre Blancs 5, aucune voix ; l'admin avait coché l'Impact de Yanis
  // Bouzenita et la Défensive d'Ayman (Noirs 4), rien chez les Blancs 5. Le Match 1 a ses votes.
  const s = journee([
    [["n1", "n2", "n3"], ["b1", "b2", "b3"]],
    [[], []],
    [[], []],
    [["Yanis Bouzenita", "Ayman", "m3"], ["c1", "c2", "c3"]],
  ]);
  s.journees[0].matchsDuJour = [{ equipes: ["Noirs 1", "Blancs 1"] }, { equipes: ["Noirs 4", "Blancs 5"] }];
  s.entries = s.entries.map((e) => {
    const t = e.team === "Blancs 4" ? "Blancs 5" : e.team;
    if (e.player === "Yanis Bouzenita") return { ...e, team: t, impact: true };
    if (e.player === "Ayman") return { ...e, team: t, def: true, mvp: true };
    return { ...e, team: t };
  });
  assert.deepEqual(jourDe(s).matches!.map((m) => `${m.teamA.name}-${m.teamB.name}`), ["Noirs 1-Blancs 1", "Noirs 4-Blancs 5"]);
  const votes = [...voix("impact", "n1", ["b1", "b2"]), ...voix("def", "b2", ["n1", "n2"])];
  const titree = poser(s, votes);
  assert.deepEqual(titres(titree, "impact"), ["Yanis Bouzenita", "n1"], "Impact : Yanis Bouzenita gardé, n1 élu au Match 1");
  assert.deepEqual(titres(titree, "def"), ["Ayman", "b2"], "Défensive : Ayman gardé, b2 élu au Match 1");
  assert.deepEqual(titree.entries.filter((e) => e.mvp).map((e) => e.player), ["Ayman"], "le MVP ne change pas");
  assert.deepEqual(faibles(s, votes), [], "deux voix au Match 1, les cases gardées : rien de faible");
  // La révélation ne change pas : le jour du match, rien n'est posé.
  assert.equal(appliquerVotes(s, computeJournees(s), votes, LE_JOUR), s);
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
  // Ni un bulletin d'une autre saison, ni un d'une autre journée.
  const ailleurs = [
    ...voix("impact", "A2", ["B1", "B2"]).map((v) => ({ ...v, saison: 0 })),
    ...voix("impact", "A2", ["B3", "B4"]).map((v) => ({ ...v, j: J - 1 })),
  ];
  assert.deepEqual(decompte(s, [...votes, ...ailleurs], 0, "impact"), d);
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
  // Pas avant la révélation (titresTombes) : le jour du match, aucun titre faible, ni sur le serveur.
  const faiblesA = (t: Date) => [...titresFaibles(s, computeJournees(s), votes, t)].sort();
  assert.deepEqual(faiblesA(LE_JOUR), [], "le jour même : aucun titre faible");
  assert.equal(saisonAvecVotes(s, votes, LE_JOUR).titresFaibles, undefined, "le serveur non plus");
  assert.deepEqual(faiblesA(MINUIT), faibles(s, votes), "à minuit, Paris : les trois");
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

/* ----------------------- 9 · Deux équipes de tailles différentes ----------------------- */
{
  // 5 Noirs contre 3 Blancs et deux places X (à la J4, au Match 4, les Blancs 5 n'étaient que des places X).
  const s = journee([[["a1", "a2", "a3", "a4", "a5"], ["b1", "b2", "b3", "X1", "X2"]]]);
  const votes = [
    ...voix("impact", "a1", ["b1", "b2"]),
    ...voix("impact", "b1", ["a1"]),
    ...voix("impact", "b2", ["a2", "a3"]),
  ];
  const d = decompte(s, votes, 0, "impact");
  // Les électeurs d'une équipe sont les joueurs de l'autre : 3 Blancs élisent chez les Noirs, 5 Noirs chez les Blancs.
  assert.deepEqual(
    d.equipes.map((e) => [e.equipe, e.votants, e.inscrits, e.elus]),
    [["Noirs 1", 2, 3, ["a1"]], ["Blancs 1", 3, 5, ["b2"]]]
  );
  assert.deepEqual([d.votants, d.inscrits], [5, 8], "le match : 8 électeurs, places X exclues");
  // Le vote du jour : chacun lit l'élection où il vote, celle de l'équipe adverse.
  assert.deepEqual(urne(s, d, "b3"), ["Noirs 1", "2/3"], "b3, qui n'a pas voté : deux Blancs sur trois");
  assert.deepEqual(urne(s, d, "a4"), ["Blancs 1", "3/5"], "a4 : trois Noirs sur cinq");
  // Le bilan de l'admin compte les mêmes.
  const bilan = bilanJournee(votes, 1, jourDe(s));
  assert.deepEqual([bilan.votants, bilan.inscrits], [5, 8]);
  assert.deepEqual(bilan.matchs[0].nontPasVote, ["a4", "a5", "b3"]);
}

/* ----------------------- 10 · Les textes ----------------------- */
{
  // Chaque équipe a sa Défensive et son Impact : aucun texte ne les dit plus « du match ». Le MVP, si.
  assert.equal(TROPHEES.find((t) => t.id === "mur")!.inscription, "meilleur défenseur de son équipe.");
  assert.equal(TROPHEES.find((t) => t.id === "mvp")!.inscription, "meilleur joueur du match.");
  for (const id of ["mur", "impact"] as const) {
    for (const [n, premiere] of [[1, true], [1, false], [3, false]] as const) {
      const phrase = phraseDefi(id, n, premiere);
      assert.ok(phrase.includes("de ton équipe") && !phrase.includes("match"), `défi ${id} : « ${phrase} »`);
    }
  }
  assert.equal(phraseDefi("mvp", 2), "Sois encore 2 fois MVP du match.");
  // Les faits marquants de la fiche d'un joueur.
  const s = journee([[A, B]]);
  const titre: Record<string, Partial<MatchEntry>> = { A1: { def: true }, B1: { impact: true }, B2: { mvp: true } };
  s.entries = s.entries.map((e) => ({ ...e, ...titre[e.player] }));
  const joueurs = deriveSeason(s).players;
  const faits = (nom: string) => ficheJoueur(s, joueurs.find((p) => p.name === nom)!, joueurs).faits.map((f) => f.quoi);
  assert.deepEqual(faits("A1"), ["Le Mur de son équipe"]);
  assert.deepEqual(faits("B1"), ["Impact de son équipe"]);
  assert.deepEqual(faits("B2"), ["MVP du match"]);
  // Partout dans l'app (la feuille des trophées de vitrine.tsx comprise) : plus de Défensive, de Mur ni d'Impact « du match ».
  const RACINE = join(__dirname, "..", "src");
  const fichiers = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  const UNIQUE_AU_MATCH = /(défenseur|défensive|\bmur|impact)s? (du|d'un|de chaque) match/i;
  const fautes = fichiers(RACINE).flatMap((p) =>
    readFileSync(p, "utf8")
      .split("\n")
      .flatMap((l, i) => (UNIQUE_AU_MATCH.test(l) ? [`${p.slice(RACINE.length + 1)}:${i + 1}`] : []))
  );
  assert.deepEqual(fautes, [], "un titre d'équipe dit « du match »");
}

console.log(
  "votes-equipes-check : la J4 Match 1 (Youss Impact et Défensive pour Noirs 1, Jouneid et Sidali pour Blancs 1), ex æquo par équipe, équipe sans voix, ligne sans équipe, cumul, coéquipier, extra time, places X, titres faibles par équipe et à la révélation, équipes de tailles différentes (n/N ont voté), bilan de l'admin, textes, MVP et révélation inchangés — ok"
);
