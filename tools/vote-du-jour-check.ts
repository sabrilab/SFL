// Le vote du jour dans les trois onglets (components/sfl/vote-du-jour.tsx,
// Ilyes, 15/11/2026 : « quand les votes sont actifs, mets-les dans les trois
// onglets […] bien visibles, qu'on les trouve partout »).
//
// Où en est le vote, pour un joueur, décide de l'endroit où il se pose
// (lib/sfl/votes.ts, etatDuVote) :
//   · `a-moi` : la feuille de mon match est remplie, j'ai mes deux voix à
//     donner : l'étiquette sur la Map, l'encart sur Ma carte, et l'encart en
//     tête des Actus ;
//   · `aux-autres` : je ne joue pas la journée, un match au moins a sa
//     feuille : l'encart en tête des Actus, rien sur la Map ni sur Ma carte ;
//   · `en-attente` : personne n'y vote encore de là où je regarde : l'encart
//     grisé sous la feuille en direct des Actus, rien ailleurs.
//
// Ce que le banc vérifie :
//   1 · la règle, match par match : mon match fini ou non, l'autre fini ou
//       non, un joueur qui n'a pas joué, un joueur venu en extra time, des
//       buts notés sans résultat (la feuille n'est pas remplie), une seule
//       équipe saisie ;
//   2 · les endroits : dans le fil, l'encart « où l'on vote déjà » passe
//       avant le rail et la feuille en direct, celui qui attend sa feuille
//       après elle ; Ma carte et la Map ne posent que `a-moi` ; sur la Map,
//       l'étiquette est dans le bloc du lettrage, plus dans la pile du bas ;
//       sur Ma carte, l'encart rangé sous le doigt ramène sa ligne à l'écran.
//   npx tsx tools/vote-du-jour-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeJournees } from "../src/lib/sfl/saisie/engine";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { etatDuVote, journeeAvecVote } from "../src/lib/sfl/votes";

const J = 9;
const NOIRS1 = ["n1", "n2", "n3", "n4", "n5"];
const BLANCS1 = ["b1", "b2", "b3", "b4", "b5"];
const NOIRS2 = ["m1", "m2", "m3", "m4", "m5"];
const BLANCS2 = ["c1", "c2", "c3", "c4", "c5"];

const ligne = (player: string, team: string, autre: Partial<MatchEntry> = {}): MatchEntry => ({
  j: J, player, team, statut: "Présent", result: null, sflTime: false,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false, ...autre,
});

/** La J9 : deux matchs, les équipes posées, aucun résultat ; `finis` : les équipes dont la feuille a ses résultats. */
function journee(finis: string[], extra: MatchEntry[] = []): Saison {
  const resultat = (team: string): Partial<MatchEntry> =>
    finis.includes(team) ? { result: team.startsWith("Noirs") ? "Victoire" : "Défaite" } : {};
  return {
    numero: 1,
    journees: [{
      j: J, date: "15 nov.", sflTime: false, mvpAuto: true,
      matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }, { equipes: ["Noirs 2", "Blancs 2"] }],
    }],
    roster: [],
    entries: [
      ...NOIRS1.map((n) => ligne(n, "Noirs 1", resultat("Noirs 1"))),
      ...BLANCS1.map((n) => ligne(n, "Blancs 1", resultat("Blancs 1"))),
      ...NOIRS2.map((n) => ligne(n, "Noirs 2", resultat("Noirs 2"))),
      ...BLANCS2.map((n) => ligne(n, "Blancs 2", resultat("Blancs 2"))),
      ...extra,
    ],
    convocations: [],
  };
}

const etat = (s: Saison, moi: string) => {
  const jn = computeJournees(s).find((x) => x.j === J)!;
  assert.ok(journeeAvecVote(jn), "la J9 est une journée où l'on vote");
  return etatDuVote(s, jn, moi);
};

/* ----------------------- 1 · La règle ----------------------- */
{
  const M1 = ["Noirs 1", "Blancs 1"];
  const M2 = ["Noirs 2", "Blancs 2"];
  // Le jour du match, les équipes posées, aucune feuille : personne ne vote, où qu'on regarde.
  const avant = journee([]);
  for (const moi of ["n1", "b3", "m2", "c5", "spectateur"]) assert.equal(etat(avant, moi), "en-attente", `avant toute feuille : ${moi}`);
  // Le Match 2 fini, pas le Match 1 : ses joueurs votent, ceux du 1 attendent, qui n'a pas joué voit qu'on vote.
  const m2 = journee(M2);
  assert.equal(etat(m2, "m1"), "a-moi");
  assert.equal(etat(m2, "c4"), "a-moi");
  assert.equal(etat(m2, "n1"), "en-attente", "mon match n'est pas fini : rien à donner, même si l'autre l'est");
  assert.equal(etat(m2, "b2"), "en-attente");
  assert.equal(etat(m2, "spectateur"), "aux-autres");
  // Tout fini.
  const tout = journee([...M1, ...M2]);
  for (const moi of ["n1", "b3", "m2", "c5"]) assert.equal(etat(tout, moi), "a-moi", `tout fini : ${moi}`);
  assert.equal(etat(tout, "spectateur"), "aux-autres");
  // Une seule équipe saisie : la feuille n'est pas remplie (votes.ts, feuilleRemplie).
  const moitie = journee(["Noirs 1"]);
  assert.equal(etat(moitie, "n1"), "en-attente");
  assert.equal(etat(moitie, "b1"), "en-attente");
  assert.equal(etat(moitie, "spectateur"), "en-attente", "aucune feuille remplie : rien en tête pour qui regarde");
  // Des buts notés pendant le match, sans résultat : pas encore.
  const enCours = journee([]);
  enCours.entries = enCours.entries.map((e) => (e.team === "Noirs 1" ? { ...e, buts: 1 } : e));
  assert.equal(etat(enCours, "n1"), "en-attente");
  // Venu en extra time compléter le Match 1 (fini), son vrai match (le 2) pas fini : il attend le sien.
  const renfort = journee(M1, [ligne("m1", "Blancs 1", { extraTime: true })]);
  assert.equal(etat(renfort, "m1"), "en-attente", "l'extra time ne fait pas voter dans le match qu'on complète");
  assert.equal(etat(journee([...M1, ...M2], [ligne("m1", "Blancs 1", { extraTime: true })]), "m1"), "a-moi");
}

/* ----------------------- 2 · Les endroits ----------------------- */
{
  const SRC = join(__dirname, "..", "src");
  const lire = (chemin: string) => readFileSync(join(SRC, chemin), "utf8");
  const place = (texte: string, motif: string, quoi: string) => {
    const i = texte.indexOf(motif);
    assert.ok(i >= 0 && texte.indexOf(motif, i + 1) < 0, `${quoi} : « ${motif} » une fois, et une seule`);
    return i;
  };
  // Les Actus : où l'on vote déjà, avant le rail et la feuille en direct ; ce qui attend sa feuille, après elle.
  const course = lire("components/sfl/actus/course.tsx");
  const enTete = place(course, '<VoteDuJour me={me} lesquels="ouverts" />', "le fil");
  const rail = place(course, "<RailJournees etapes={etapes}", "le fil");
  const direct = place(course, "<EnDirect ouvrir=", "le fil");
  const attente = place(course, '<VoteDuJour me={me} lesquels="en-attente" />', "le fil");
  assert.ok(enTete < rail && rail < direct && direct < attente, "le fil : le vote ouvert, le rail, la feuille en direct, puis le vote qui attend");
  // Trois poses dans l'onglet, pas une de plus : le fil (deux, qui se complètent) et la vue Classement.
  assert.equal(course.split("<VoteDuJour ").length - 1, 3);
  // Ma carte : seulement quand j'ai une voix à donner, et rangé une fois les deux données.
  place(lire("app/profil/page.tsx"), '<VoteDuJour me={player.name} lesquels="a-moi" repliable', "Ma carte");
  // La Map : l'étiquette dans le bloc du lettrage, avant la colonne des boutons ; plus rien dans la pile du bas.
  const map = lire("app/map/page.tsx");
  const etiquette = place(map, "<VoteDuJourMap me={me} />", "la Map");
  const lettrage = place(map, "{/* En haut à gauche :", "la Map");
  const boutons = place(map, "{/* En haut à droite :", "la Map");
  assert.ok(lettrage < etiquette && etiquette < boutons, "la Map : l'étiquette du vote avec le lettrage, en haut à gauche");
  // L'étiquette de la Map ne se pose que pour qui a une voix à donner.
  const bloc = lire("components/sfl/vote-du-jour.tsx");
  place(bloc, 'useVotesOuverts(me, "a-moi")', "l'étiquette de la Map");
  // Ma carte : rangé sous le doigt, l'encart ramène sa ligne à l'écran, sans l'animer et sans
  // bouger si elle y est déjà (un petit téléphone a défilé jusqu'à la seconde rangée).
  place(bloc, 'if (range && !etaitRange.current && touche.current) section.current?.scrollIntoView({ block: "nearest" });', "Ma carte, l'encart rangé");
}

console.log(
  "vote-du-jour-check : avant toute feuille (en attente pour tous), un match fini sur deux, tout fini, une seule équipe saisie, des buts sans résultat, l'extra time ; le fil (vote ouvert, rail, direct, vote qui attend), Ma carte et la Map (à moi seulement, l'étiquette avec le lettrage, la ligne rangée ramenée à l'écran) — ok"
);
