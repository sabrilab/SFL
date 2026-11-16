// Le vote du jour dans les trois onglets (components/sfl/vote-du-jour.tsx,
// Ilyes, 15/11/2026 : « quand les votes sont actifs, mets-les dans les trois
// onglets […] bien visibles, qu'on les trouve partout »).
//
// Où en est le vote, pour un joueur, décide de l'endroit où il se pose
// (lib/sfl/votes.ts, etatDuVote et aPoser) :
//   · `a-moi` : la feuille de mon match est remplie, j'ai mes deux voix à
//     donner : l'étiquette sur la Map, l'encart sur Ma carte, l'encart en tête
//     des Actus, et « Voter » sous la feuille en direct de mon match ;
//   · `aux-autres` : je ne joue pas la journée, un match au moins a sa
//     feuille : l'encart en tête des Actus, rien sur la Map ni sur Ma carte ;
//   · `en-attente` : personne n'y vote encore de là où je regarde : l'encart
//     grisé sous la feuille en direct des Actus, rien ailleurs.
//
// Ce que le banc garde (contrôles du 16/11/2026) : les fonctions pures, jouées
// pour de vrai (lib/sfl/votes.ts, lib/encart-tenu.ts, lib/sfl/revelation.ts),
// et, par des motifs de texte, la façon dont les composants les appellent.
// Ce qui ne se voit qu'au rendu (le défilement posé, le focus, la feuille de
// la Map qui s'ouvre) n'est gardé ici que par ces motifs : un motif changé
// fait rougir le banc, et c'est au rendu de dire si le changement tient.
//   1 · la règle, match par match : mon match fini ou non, l'autre fini ou
//       non, un joueur qui n'a pas joué, des buts notés sans résultat (la
//       feuille n'est pas remplie), une seule équipe saisie ; l'extra time :
//       en plus de son match il suit le sien, venu seulement en extra time il
//       ne vote pas (placeDuVotant), ni sous la feuille en direct du match
//       qu'il a complété (voteSousLeMatch) ;
//   2 · le tri (aPoser) : chaque état posé une fois et une seule dans le fil
//       (`ouverts` XOR `en-attente`), `a-moi` seul pour Ma carte et la Map,
//       `tous` pour la vue Classement ;
//   3 · les journées posées (votesOuvertsPour), à l'heure : vote ouvert, vote
//       fermé (18 h passées, un autre jour : rien nulle part), journée sans
//       vote, deux journées le même jour ;
//   4 · le bandeau (bandeauDuVote) : gris tant qu'on attend, « des matchs »
//       pour qui ne joue pas ; « jusqu'à 18 h » d'un seul tenant ;
//   5 · mes voix à l'écran et l'encart de Ma carte : les votes prêts
//       (votesPrets), ce que le téléphone retient (retenirVoix, voixRetenues),
//       mes deux voix (voteFait : connues d'ici, sinon retenues tant que les
//       votes ne sont pas relus), l'encart (etatEncart, estPlie), la voix qui
//       le range (voixQuiRange) ;
//   6 · la marque de la Map (marqueDuVote) : la coche dès que mes deux voix
//       sont connues de ce téléphone, le point rouge une fois les votes
//       relus, rien avant ;
//   7 · le défilement (rattrapage, rattrapageDesEncarts), en valeurs
//       littérales : à l'écran, au-dessus, au bord (63 et 64 px), sous ma voix,
//       paru, parti, et deux encarts dans la même image, Chrome et Safari ;
//   8 · les endroits, dans le texte des pages et des composants : l'ordre du
//       fil, les gardes Bola de la Map et de Ma carte, et chaque appel qui
//       décide (où le poser, les votes prêts, l'encart, le défilement, le
//       focus, la marge sous la pile des messages, les formes de l'étiquette).
//   npx tsx tools/vote-du-jour-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeJournees } from "../src/lib/sfl/saisie/engine";
import type { JourneeMeta, MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { A_L_ECRAN, rattrapage, rattrapageDesEncarts, type Ecran } from "../src/lib/encart-tenu";
import { jusquaInsecable } from "../src/lib/sfl/revelation";
import {
  aPoser,
  bandeauDuVote,
  cleDuVote,
  estPlie,
  etatDuVote,
  etatEncart,
  journeeAvecVote,
  marqueDuVote,
  mesDeuxVoix,
  placeDuVotant,
  retenirVoix,
  RETENUES_MAX,
  voixQuiRange,
  voixRetenues,
  voteFait,
  votesOuvertsPour,
  votesPrets,
  voteSousLeMatch,
  type EtatDuVote,
  type OuPoser,
  type VoteFigure,
} from "../src/lib/sfl/votes";

const J = 9;
const NOIRS1 = ["n1", "n2", "n3", "n4", "n5"];
const BLANCS1 = ["b1", "b2", "b3", "b4", "b5"];
const NOIRS2 = ["m1", "m2", "m3", "m4", "m5"];
const BLANCS2 = ["c1", "c2", "c3", "c4", "c5"];

const ligne = (player: string, team: string, autre: Partial<MatchEntry> = {}, j = J): MatchEntry => ({
  j, player, team, statut: "Présent", result: null, sflTime: false,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false, ...autre,
});

const meta = (j: number, autre: Partial<JourneeMeta> = {}): JourneeMeta => ({
  j, date: "15 nov.", sflTime: false, mvpAuto: true,
  matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }, { equipes: ["Noirs 2", "Blancs 2"] }],
  ...autre,
});

/** La J9 du 15 nov. : deux matchs, les équipes posées ; `finis` : les équipes dont la feuille a ses résultats. */
function journee(finis: string[], extra: MatchEntry[] = [], metaJ9: Partial<JourneeMeta> = {}): Saison {
  const resultat = (team: string): Partial<MatchEntry> =>
    finis.includes(team) ? { result: team.startsWith("Noirs") ? "Victoire" : "Défaite" } : {};
  return {
    numero: 1,
    journees: [meta(J, metaJ9)],
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

const jn = (s: Saison, j = J) => computeJournees(s).find((x) => x.j === j)!;
const etat = (s: Saison, moi: string) => {
  const x = jn(s);
  assert.ok(journeeAvecVote(x), "la J9 est une journée où l'on vote");
  return etatDuVote(s, x, moi);
};

const M1 = ["Noirs 1", "Blancs 1"];
const M2 = ["Noirs 2", "Blancs 2"];
const MATCH1 = ["Noirs 1", "Blancs 1"] as const;
const MATCH2 = ["Noirs 2", "Blancs 2"] as const;
const ETATS: EtatDuVote[] = ["a-moi", "aux-autres", "en-attente"];
const OU: OuPoser[] = ["tous", "a-moi", "ouverts", "en-attente"];

/* ----------------------- 1 · La règle ----------------------- */
{
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
  assert.equal(placeDuVotant(jn(renfort), "m1")?.match.teamA.name, "Noirs 2", "en plus de son match, il vote dans le sien");
  // Venu SEULEMENT en extra time (aucune ligne de titulaire) : il ne vote pas, comme qui ne joue pas
  // (contrôle du 16/11 : le vote lui était proposé partout, ses deux voix enregistrées, « 0/5 ont voté »).
  const seul = (finis: string[]) => journee(finis, [ligne("x9", "Blancs 1", { extraTime: true, result: finis.includes("Blancs 1") ? "Défaite" : null })]);
  assert.equal(placeDuVotant(jn(seul(M1)), "x9"), null, "venu seulement en extra time : aucune place de votant");
  assert.equal(etat(seul(M1), "x9"), "aux-autres", "le match qu'il a complété fini : on y vote, sans lui");
  assert.equal(etat(seul([]), "x9"), "en-attente", "aucune feuille : il attend, comme qui ne joue pas");
  assert.equal(etat(seul(M2), "x9"), "aux-autres", "l'autre match fini, pas le sien : on y vote, sans lui");
  assert.ok(placeDuVotant(jn(tout), "n1"), "un titulaire a sa place");
  assert.equal(placeDuVotant(jn(tout), "spectateur"), null);
  // « Voter » sous la feuille en direct d'un match (voteSousLeMatch) : un titulaire de CE match, ses voix à donner.
  assert.equal(voteSousLeMatch(tout, jn(tout), "n1", MATCH1), true, "titulaire du Match 1, sa feuille remplie : « Voter »");
  assert.equal(voteSousLeMatch(tout, jn(tout), "n1", ["Blancs 1", "Noirs 1"]), true, "les équipes dans l'autre sens");
  assert.equal(voteSousLeMatch(tout, jn(tout), "n1", MATCH2), false, "pas sous le Match 2, où il ne joue pas");
  assert.equal(voteSousLeMatch(tout, jn(tout), "spectateur", MATCH1), false, "qui ne joue pas : jamais");
  assert.equal(voteSousLeMatch(m2, jn(m2), "n1", MATCH1), false, "sa feuille pas remplie : pas encore");
  assert.equal(voteSousLeMatch(seul(M1), jn(seul(M1)), "x9", MATCH1), false, "venu seulement en extra time : pas de « Voter » sous le match qu'il a complété");
  const double = journee(M1, [ligne("m1", "Blancs 1", { extraTime: true, result: "Défaite" })]);
  assert.equal(voteSousLeMatch(double, jn(double), "m1", MATCH1), false, "doublé : rien sous le Match 1, qu'il a complété");
  assert.equal(voteSousLeMatch(double, jn(double), "m1", MATCH2), false, "doublé, son Match 2 pas fini : pas encore");
  const doubleFini = journee([...M1, ...M2], [ligne("m1", "Blancs 1", { extraTime: true, result: "Défaite" })]);
  assert.equal(voteSousLeMatch(doubleFini, jn(doubleFini), "m1", MATCH2), true, "doublé, son Match 2 fini : « Voter » sous le sien");
  assert.equal(voteSousLeMatch(doubleFini, jn(doubleFini), "m1", MATCH1), false);
}

/* ----------------------- 2 · Le tri ----------------------- */
{
  for (const e of ETATS) {
    // Le fil : chaque état posé une fois et une seule (en tête, ou sous la feuille en direct).
    assert.equal(Number(aPoser("ouverts", e)) + Number(aPoser("en-attente", e)), 1, `le fil pose « ${e} » une fois et une seule`);
    // La vue Classement : toujours.
    assert.ok(aPoser("tous", e), `la vue Classement pose « ${e} »`);
    // Ma carte et la Map : seulement quand j'ai mes voix à donner.
    assert.equal(aPoser("a-moi", e), e === "a-moi", `Ma carte et la Map, « ${e} »`);
  }
  assert.ok(aPoser("ouverts", "a-moi") && aPoser("ouverts", "aux-autres"), "en tête du fil dès qu'on y vote, moi ou les autres");
  assert.ok(aPoser("en-attente", "en-attente") && !aPoser("ouverts", "en-attente"), "ce qui attend sa feuille passe sous le direct");
}

/* ----------------------- 3 · Les journées posées, à l'heure ----------------------- */
{
  const h = (iso: string) => new Date(iso);
  const PENDANT = h("2026-11-15T15:00:00+01:00");
  const LENDEMAIN = h("2026-11-16T10:00:00+01:00");
  const poses = (s: Saison, moi: string, t: Date, ou: OuPoser) => votesOuvertsPour(s, computeJournees(s), moi, t, ou).map((x) => x.j);
  const tout = journee([...M1, ...M2]);
  const avant = journee([]);
  const m2 = journee(M2);
  // Vote ouvert : où se pose la J9, selon qui regarde.
  for (const [s, moi, attendu] of [
    [tout, "n1", "a-moi"], [tout, "spectateur", "aux-autres"], [avant, "n1", "en-attente"], [avant, "spectateur", "en-attente"],
    [m2, "n1", "en-attente"], [m2, "m1", "a-moi"], [m2, "spectateur", "aux-autres"],
  ] as [Saison, string, EtatDuVote][]) {
    for (const ou of OU) assert.deepEqual(poses(s, moi, PENDANT, ou), aPoser(ou, attendu) ? [J] : [], `${moi}, « ${attendu} », posé en « ${ou} »`);
    // Dans le fil : une fois, et une seule.
    assert.equal(poses(s, moi, PENDANT, "ouverts").length + poses(s, moi, PENDANT, "en-attente").length, 1, `${moi} : la J9 une fois dans le fil`);
  }
  // Vote fermé : rien, nulle part. Un autre jour…
  for (const ou of OU) assert.deepEqual(poses(tout, "n1", LENDEMAIN, ou), [], `le lendemain, rien en « ${ou} »`);
  // … et le jour même, passé 18 h (feuilles remplies à 16 h : fin du vote à 18 h).
  const ferme = journee([...M1, ...M2], [], { finDesMatchs: "2026-11-15T16:00:00+01:00" });
  assert.deepEqual(poses(ferme, "n1", h("2026-11-15T17:30:00+01:00"), "a-moi"), [J], "17 h 30 : encore ouvert");
  for (const ou of OU) assert.deepEqual(poses(ferme, "n1", h("2026-11-15T18:30:00+01:00"), ou), [], `18 h 30 : fermé, rien en « ${ou} »`);
  // Une journée sans vote (MVP saisi à la main) : rien.
  const sansVote = journee([...M1, ...M2], [], { mvpAuto: false });
  for (const ou of OU) assert.deepEqual(poses(sansVote, "n1", PENDANT, ou), [], `journée sans vote, rien en « ${ou} »`);
  // Deux journées le même jour : chacune son état ; la J9 votée en tête, la J10 (sans feuille) sous le direct.
  const deux = journee(M1);
  deux.journees = [meta(J), meta(J + 1)];
  deux.entries = [...deux.entries, ...[...NOIRS1.map((n) => ligne(n, "Noirs 1", {}, J + 1)), ...BLANCS1.map((n) => ligne(n, "Blancs 1", {}, J + 1))]];
  assert.deepEqual(poses(deux, "n1", PENDANT, "ouverts"), [J]);
  assert.deepEqual(poses(deux, "n1", PENDANT, "en-attente"), [J + 1]);
  assert.deepEqual(poses(deux, "n1", PENDANT, "a-moi"), [J], "sur la Map et Ma carte, seule la J9");
  assert.deepEqual(poses(deux, "n1", PENDANT, "tous"), [J, J + 1]);
  // Venu seulement en extra time : ni sur la Map, ni sur Ma carte ; aux Actus comme qui ne joue pas.
  const seul = journee(M1, [ligne("x9", "Blancs 1", { extraTime: true, result: "Défaite" })]);
  assert.deepEqual(poses(seul, "x9", PENDANT, "a-moi"), [], "extra time seul : rien sur la Map ni sur Ma carte");
  assert.deepEqual(poses(seul, "x9", PENDANT, "ouverts"), [J]);
}

/* ----------------------- 4 · Le bandeau ----------------------- */
{
  assert.equal(bandeauDuVote("a-moi", true), "ouvert");
  assert.equal(bandeauDuVote("en-attente", true), "fin-de-mon-match", "je joue, ma feuille pas remplie : gris, la fin de mon match");
  assert.equal(bandeauDuVote("aux-autres", false), "ouvert", "je ne joue pas, on y vote : ouvert, sans moi");
  assert.equal(bandeauDuVote("en-attente", false), "fin-des-matchs", "je ne joue pas, aucune feuille : gris, pas « Vote ouvert »");
  // « jusqu'à 18 h » d'un seul tenant : à 320 px, « h » ne part plus seul à la ligne ; une durée se coupe.
  assert.equal(jusquaInsecable("18 h"), "jusqu'à\u00a018\u00a0h");
  assert.equal(jusquaInsecable("18 h 40"), "jusqu'à\u00a018\u00a0h\u00a040");
  assert.equal(jusquaInsecable("minuit"), "jusqu'à\u00a0minuit");
  assert.equal(jusquaInsecable("une heure après le dernier match"), "jusqu'à une heure après le dernier match");
}

/* ----------------------- 5 · Mes voix à l'écran, l'encart de Ma carte ----------------------- */
{
  const v = (votant: string, categorie: "impact" | "def", j = J): VoteFigure => ({ saison: 1, j, categorie, votant, candidat: "b1", match_id: "m1" });
  assert.equal(mesDeuxVoix([], 1, J, "n1"), false);
  assert.equal(mesDeuxVoix([v("n1", "impact")], 1, J, "n1"), false, "une seule voix : pas encore");
  assert.equal(mesDeuxVoix([v("n1", "impact"), v("n1", "def")], 1, J, "n1"), true);
  assert.equal(mesDeuxVoix([v("n1", "impact"), v("n1", "def", J + 1)], 1, J, "n1"), false, "la seconde voix d'une autre journée ne compte pas");
  assert.equal(mesDeuxVoix([v("n1", "impact"), v("n2", "def")], 1, J, "n1"), false, "la voix d'un autre ne compte pas");
  // Les votes prêts : relus, ou rien ne viendra (sans session serveur).
  assert.equal(votesPrets({ server: true, charges: false }), false, "session serveur, votes pas encore relus : pas prêts");
  assert.equal(votesPrets({ server: true, charges: true }), true);
  assert.equal(votesPrets({ server: false, charges: false }), true, "sans session serveur : rien ne viendra, prêts");
  assert.equal(votesPrets({ server: false, charges: true }), true);
  // Ce que le téléphone retient (un stockage simulé : celui du navigateur n'existe pas ici).
  const memoire = new Map<string, string>();
  const stockage = { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, x: string) => void memoire.set(k, x), removeItem: (k: string) => void memoire.delete(k) };
  (globalThis as { localStorage?: unknown }).localStorage = stockage;
  assert.equal(cleDuVote(1, J, "n1"), "1:9:n1");
  assert.equal(voixRetenues("1:9:n1"), null, "rien de retenu : il n'en sait rien");
  retenirVoix("1:9:n1", false);
  assert.equal(voixRetenues("1:9:n1"), false, "relues, il m'en restait : retenu");
  retenirVoix("1:9:n1", true);
  assert.equal(voixRetenues("1:9:n1"), true, "mes deux voix données : retenu, à la place");
  assert.equal(voixRetenues("1:9:n2"), null, "un autre joueur sur ce téléphone : rien");
  assert.equal(voixRetenues("1:10:n1"), null, "une autre journée : rien");
  for (let k = 0; k < RETENUES_MAX + 5; k++) retenirVoix(`1:${100 + k}:n1`, true);
  assert.equal(voixRetenues("1:9:n1"), null, `au-delà de ${RETENUES_MAX} journées, les plus anciennes s'oublient`);
  assert.equal(voixRetenues(`1:${100 + RETENUES_MAX + 4}:n1`), true, "la dernière reste");
  assert.equal(Object.keys(JSON.parse([...memoire.values()][0])).length, RETENUES_MAX);
  memoire.set("sfl-vote-du-jour-v1", "pas du JSON");
  assert.equal(voixRetenues("1:9:n1"), null, "un stockage abîmé : il n'en sait rien");
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => null, setItem: () => { throw new Error("plein"); } };
  assert.doesNotThrow(() => retenirVoix("1:9:n1", true), "stockage plein : rien de retenu, sans erreur");
  delete (globalThis as { localStorage?: unknown }).localStorage;
  assert.equal(voixRetenues("1:9:n1"), null, "sans stockage (navigation privée, rendu serveur) : rien");
  // Mes deux voix à l'écran : connues d'ici ; sinon, tant que les votes ne sont pas relus, ce que le téléphone a retenu.
  for (const prets of [false, true]) for (const retenu of [null, false, true])
    assert.equal(voteFait({ prets, vote: true, retenu }), true, "connues d'ici (relues, ou envoyées d'ici) : données");
  assert.equal(voteFait({ prets: false, vote: false, retenu: true }), true, "pas encore relues, retenues données : données (rangé d'emblée)");
  assert.equal(voteFait({ prets: false, vote: false, retenu: false }), false, "pas encore relues, retenu qu'il m'en restait : pas données");
  assert.equal(voteFait({ prets: false, vote: false, retenu: null }), false, "pas encore relues, rien de retenu : pas données (ouvert, comme avant)");
  assert.equal(voteFait({ prets: true, vote: false, retenu: true }), false, "relues : les votes font foi, pas ce qui était retenu");
  // L'encart : rangé une fois mes deux voix données, ouvert sinon ; jamais rangé ailleurs que sur Ma carte.
  for (const fait of [false, true]) for (const rouvert of [false, true])
    assert.equal(etatEncart({ repliable: false, fait, rouvert }), "ouvert", "ailleurs que sur Ma carte, jamais rangé");
  assert.equal(etatEncart({ repliable: true, fait: false, rouvert: false }), "ouvert", "une voix à donner : ouvert");
  assert.equal(etatEncart({ repliable: true, fait: false, rouvert: true }), "ouvert", "une voix à donner, même rouvert avant : ouvert");
  assert.equal(etatEncart({ repliable: true, fait: true, rouvert: false }), "range", "mes deux voix données : rangé");
  assert.equal(etatEncart({ repliable: true, fait: true, rouvert: true }), "rouvert", "rouvert à la main : il le reste");
  assert.equal(estPlie("range"), true, "rangé : ses cartes ne sont plus là");
  assert.equal(estPlie("rouvert"), false, "rouvert : ses cartes sont là");
  assert.equal(estPlie("ouvert"), false);
  // La voix qui range l'encart : celle qui manquait (l'autre est déjà donnée).
  assert.equal(voixQuiRange([], 1, J, "n1", "impact"), false, "ma première voix ne le range pas");
  assert.equal(voixQuiRange([v("n1", "impact")], 1, J, "n1", "def"), true, "l'Impact donné, la Défensive le range");
  assert.equal(voixQuiRange([v("n1", "impact")], 1, J, "n1", "impact"), false, "changer d'avis sur l'Impact, la Défensive à donner : pas rangé");
  assert.equal(voixQuiRange([v("n1", "impact", J + 1)], 1, J, "n1", "def"), false, "l'Impact d'une autre journée ne compte pas");
  assert.equal(voixQuiRange([v("n2", "impact")], 1, J, "n1", "def"), false, "l'Impact d'un autre ne compte pas");
}

/* ----------------------- 6 · La marque de la Map ----------------------- */
{
  assert.equal(marqueDuVote(false, false), null, "votes pas relus, rien de connu : ni point rouge ni coche");
  assert.equal(marqueDuVote(true, false), "point", "une voix à donner : le point rouge");
  assert.equal(marqueDuVote(true, true), "coche");
  assert.equal(marqueDuVote(false, true), "coche", "mes deux voix connues de ce téléphone (ou retenues) : la coche");
}

/* ----------------------- 7 · Le défilement ----------------------- */
{
  // Un téléphone de 667 px : l'écran utile commence sous la pile des messages (7 rem = 112 px).
  const ecran: Ecran = { bord: 0, haut: 112, bas: 667 };
  const b = (haut: number, bas: number) => ({ haut, bas });
  // Son haut à l'écran : rien à faire, rangé ou déplié ; on le voit changer.
  assert.equal(rattrapage(b(130, 646), b(130, 212), ecran), null);
  assert.equal(rattrapage(b(130, 212), b(130, 646), ecran), null);
  // Son haut sous le bord mais sous la pile des messages (votes d'ailleurs, pas de message) : à l'écran, rien.
  assert.equal(rattrapage(b(51, 567), b(51, 133), ecran), null, "rouverte puis refermée à la main, à peine défilée : rien ne bouge");
  // Tout au-dessus de l'écran (j'ai défilé jusqu'à ma carte), il se range : ce que je lis ne bouge pas.
  assert.deepEqual(rattrapage(b(-609, -93), b(-609, -527), ecran), { decaler: -434 });
  // … ou se déplie : idem.
  assert.deepEqual(rattrapage(b(-200, -118), b(-200, 316), ecran), { decaler: 434 });
  // Il croise le haut de l'écran : au bord, 63 px montrés, c'est un liseré, ma carte ne bouge pas ; 64 px, on regardait ses cartes, la ligne revient.
  assert.equal(A_L_ECRAN, 64);
  assert.deepEqual(rattrapage(b(-453, 63), b(-453, -371), ecran), { decaler: -434 }, "63 px montrés : un liseré");
  assert.deepEqual(rattrapage(b(-452, 64), b(-452, -370), ecran), { ramener: true }, "64 px montrés : sa ligne revient");
  assert.deepEqual(rattrapage(b(-109, 407), b(-109, -27), ecran), { ramener: true }, "la seconde rangée à l'écran : sa ligne revient");
  // Il croise l'écran et se déplie (je l'ai rouvert, ou mes voix relues disent qu'il m'en reste) : je le vois s'ouvrir.
  assert.equal(rattrapage(b(-50, 32), b(-50, 466), ecran), null);
  // Rangé sous ma voix, donnée ici : sa ligne finit sous la pile des messages, même au bord (défaut 11, 375×553).
  assert.deepEqual(rattrapage(b(-386, 130), b(-386, -304), ecran, true), { ramener: true }, "une bande de 130 px, sous ma voix : la ligne revient sous les messages");
  assert.deepEqual(rattrapage(b(-453, 63), b(-453, -371), ecran, true), { ramener: true }, "63 px, sous ma voix : la ligne revient aussi");
  assert.deepEqual(rattrapage(b(50, 566), b(50, 132), ecran, true), { ramener: true }, "son haut sous les messages, sous ma voix : la ligne passe dessous");
  assert.equal(rattrapage(b(112, 628), b(112, 194), ecran, true), null, "son haut sous la pile : sa ligne y reste");
  assert.deepEqual(rattrapage(b(-609, -10), b(-609, -444), ecran, true), { decaler: -434 }, "tout au-dessus, même sous ma voix (au clavier) : ce que je lis ne bouge pas");
  assert.equal(rattrapage(b(50, 566), b(50, 132), ecran, false), null, "le même, rangé par des voix d'ailleurs : rien ne bouge");
  // Il paraît (la feuille de mon match se remplit) : au-dessus de ce que je lis, ce que je lis ne bouge pas ; à l'écran, je le vois paraître.
  assert.deepEqual(rattrapage(b(-209, -209), b(-209, 328), ecran), { decaler: 537 });
  assert.equal(rattrapage(b(91, 91), b(91, 628), ecran), null);
  // Il s'en va (la fin du vote) : au-dessus, ce que je lis ne bouge pas ; il croisait l'écran, il n'y a plus de ligne à ramener.
  assert.deepEqual(rattrapage(b(-609, -93), b(-609, -630), ecran), { decaler: -537 });
  assert.deepEqual(rattrapage(b(-100, 416), b(-100, -121), ecran), { decaler: -537 });
  assert.equal(rattrapage(b(130, 646), b(130, 109), ecran), null);
  // Rien n'a bougé (moins d'un pixel).
  assert.equal(rattrapage(b(-609, -93), b(-609, -92.5), ecran), null);

  // Tous les encarts d'une image (rattrapageDesEncarts) : les hauteurs, les marges (21 px), le haut lu maintenant.
  // Deux journées le même jour, les deux encarts au-dessus de l'écran, leurs secondes voix dans la même relecture.
  // Chrome a déjà rattrapé les deux (868 px) : le geste redonne le même défilement, rien de plus.
  assert.deepEqual(
    rattrapageDesEncarts([{ haut: -385, avant: 516, apres: 82, marges: 21 }, { haut: -282, avant: 516, apres: 82, marges: 21 }], 868, ecran),
    { decaler: -868 },
    "deux encarts rangés ensemble, Chrome : les deux rattrapés, une seule fois"
  );
  // Safari n'a rien rattrapé : le même geste.
  assert.deepEqual(
    rattrapageDesEncarts([{ haut: -1253, avant: 516, apres: 82, marges: 21 }, { haut: -1150, avant: 516, apres: 82, marges: 21 }], 0, ecran),
    { decaler: -868 },
    "deux encarts rangés ensemble, Safari : les deux"
  );
  // Un seul des deux change : le sien seulement.
  assert.deepEqual(rattrapageDesEncarts([{ haut: -1253, avant: 516, apres: 516, marges: 21 }, { haut: -716, avant: 516, apres: 82, marges: 21 }], 0, ecran), { decaler: -434 });
  // Le premier au-dessus, le second croise l'écran (je regarde ses cartes) : sa ligne revient, c'est lui qu'on ramène.
  assert.deepEqual(rattrapageDesEncarts([{ haut: -1253, avant: 516, apres: 82, marges: 21 }, { haut: -650, avant: 516, apres: 82, marges: 21 }], 0, ecran), { ramener: 1 });
  // Il paraît au-dessus de ce que je lis ; Chrome a déjà descendu la page de 537 px : le geste la laisse où Chrome l'a mise.
  assert.deepEqual(rattrapageDesEncarts([{ haut: -746, avant: 0, apres: 516, marges: 21 }], -537, ecran), { decaler: 537 });
  assert.deepEqual(rattrapageDesEncarts([{ haut: -209, avant: 0, apres: 516, marges: 21 }], 0, ecran), { decaler: 537 }, "Safari : la page descend de ce qu'il prend");
  assert.equal(rattrapageDesEncarts([{ haut: 91, avant: 0, apres: 516, marges: 21 }], 0, ecran), null, "la page en haut : je le vois paraître");
  // Il s'en va, mesuré avant de partir (son haut est déjà dans le repère d'avant) : ce que Chrome a rattrapé n'y change rien.
  assert.deepEqual(rattrapageDesEncarts([{ haut: -609, avant: 516, apres: 0, marges: 21, parti: true }], 537, ecran), { decaler: -537 });
  assert.deepEqual(rattrapageDesEncarts([{ haut: -609, avant: 516, apres: 0, marges: 21, parti: true }], 0, ecran), { decaler: -537 });
  assert.equal(rattrapageDesEncarts([{ haut: 130, avant: 516, apres: 0, marges: 21, parti: true }], 537, ecran), null, "parti à l'écran : je le vois partir, quoi que Chrome ait fait");
  // Rangé sous ma voix, au bord : sa ligne revient.
  assert.deepEqual(rattrapageDesEncarts([{ haut: -304, avant: 516, apres: 82, marges: 21, ici: true }], 0, ecran), { ramener: 0 });
  // Rien n'a changé.
  assert.equal(rattrapageDesEncarts([{ haut: -609, avant: 516, apres: 516, marges: 21 }], 0, ecran), null);
  assert.equal(rattrapageDesEncarts([], 0, ecran), null);
}

/* ----------------------- 8 · Les endroits ----------------------- */
{
  const SRC = join(__dirname, "..", "src");
  const lire = (chemin: string) => readFileSync(join(SRC, chemin), "utf8");
  const nombre = (texte: string, motif: string) => texte.split(motif).length - 1;
  const place = (texte: string, motif: string, quoi: string, fois = 1) => {
    assert.equal(nombre(texte, motif), fois, `${quoi} : « ${motif} » ${fois === 1 ? "une fois, et une seule" : `${fois} fois`}`);
    return texte.indexOf(motif);
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
  // Ma carte : seulement quand j'ai une voix à donner, rangé une fois les deux données, jamais pour un joueur Bola.
  place(lire("app/profil/page.tsx"), '{!bola && <VoteDuJour me={player.name} lesquels="a-moi" repliable', "Ma carte");
  // La Map : l'étiquette dans le bloc du lettrage, avant la colonne des boutons, jamais pour un joueur Bola ; plus rien dans la pile du bas.
  const map = lire("app/map/page.tsx");
  const etiquette = place(map, "{!sansSfl && me && <VoteDuJourMap me={me} />}", "la Map");
  const lettrage = place(map, "{/* En haut à gauche :", "la Map");
  const boutons = place(map, "{/* En haut à droite :", "la Map");
  assert.ok(lettrage < etiquette && etiquette < boutons, "la Map : l'étiquette du vote avec le lettrage, en haut à gauche");

  // Le composant : il ne décide rien lui-même, il appelle.
  const bloc = lire("components/sfl/vote-du-jour.tsx");
  const appels: [string, string, number?][] = [
    ["votesOuvertsPour(saisonLue, journees, me, maintenant, lesquels)", "le tri : où il se pose"],
    ["const ouvertes = useVotesOuverts(me, lesquels);", "la liste passe où elle se pose (pas « tous » partout)"],
    ['useVotesOuverts(me, "a-moi")', "l'étiquette de la Map : « a-moi » seulement"],
    ["const prets = useVotesPrets();", "l'encart et l'étiquette attendent les votes relus", 2],
    ["useTenueDesEncarts(repliable);", "la liste tient le défilement dès avant qu'un encart paraisse"],
    ["const retenu = useMemo(() => voixRetenues(cle), [cle]);", "l'encart part de ce que le téléphone a retenu"],
    ["const fait = voteFait({ prets, vote, retenu });", "mes deux voix à l'écran"],
    ["const etat = etatEncart({ repliable, fait, rouvert });", "l'encart de Ma carte"],
    ["const plie = estPlie(etat);", "rangé : ses cartes s'en vont"],
    ["if (prets || vote) retenirVoix(cle, vote);", "l'encart retient mes voix relues"],
    ["useEncartTenu(section, repliable, etat);", "chaque encart s'inscrit, et dit chaque changement"],
    ["if (!voixQuiRange(votes, numero, journee.j, me, cat)) return undefined;", "seule la voix qui manquait range l'encart sous elle"],
    ["if (voix) rangeSousMaVoix(section.current);", "rangé sous ma voix : sa ligne revient sous la pile des messages"],
    ["sousMaVoix.current = { focus: !!section.current?.contains(document.activeElement) };", "le focus noté quand la voix qui range part d'ici (avant que l'envoi grise les cartes)"],
    ["return () => void (sousMaVoix.current = null);", "la voix qui range ne vaut que le temps de son envoi"],
    ["if (perdu && (dedans.current || voix?.focus)) ligne.current?.focus({ preventScroll: true });", "le focus qui était dedans passe à la ligne"],
    ["const entre = () => void (dedans.current = true);", "le focus entré dans l'encart y est noté"],
    ['s.addEventListener("focusin", entre);', "le focus entre dans l'encart"],
    ['s.addEventListener("focusout", sort);', "le focus sort de l'encart"],
    ["if (quitte?.isConnected && !s.contains(document.activeElement)) dedans.current = false;", "sorti vraiment (la carte encore là) : plus dedans"],
    ["onVoix={repliable ? onVoix : undefined}", "Ma carte sait quelle voix part d'ici"],
    ["scroll-mt-[calc(env(safe-area-inset-top,0px)+7rem)]", "la marge sous la pile des messages (7 rem, défaut 11)"],
    ['const COURT_TEXTE = "[@media(max-height:640px)_and_(max-width:480px)]:sr-only";', "« Vote » seul sur un téléphone bas, pas sur un écran large (défauts 12 et 13)"],
    ['const COURT_MONTE = "[@media(max-height:640px)_and_(max-width:480px)]:mt-1.5";', "l'étiquette réduite monte"],
    ['const ROND_TEXTE = "[@media(max-width:359px)]:sr-only";', "le rond seul sous 360 px de large"],
    ['const ROND_SERRE = "[@media(max-width:359px)]:pr-1";', "le rond seul, serré"],
    ["onClick={() => setOuvert(true)}", "l'étiquette ouvre la feuille du vote"],
    ["<Sheet open={ouvert} onOpenChange={setOuvert}", "la feuille du vote suit l'étiquette"],
    ["const marque = marqueDuVote(prets, fait);", "la marque de la Map"],
    ["for (const x of ouvertes) retenirVoix(cleDuVote(numero, x.j, me), mesDeuxVoix(votes, numero, x.j, me));", "la Map retient mes voix relues"],
    ["voteFait({ prets, vote: mesDeuxVoix(votes, numero, x.j, me), retenu: voixRetenues(cleDuVote(numero, x.j, me)) })", "la Map part de ce que le téléphone a retenu"],
  ];
  for (const [motif, quoi, fois] of appels) place(bloc, motif, `vote-du-jour.tsx, ${quoi}`, fois);
  assert.ok(!/useVotesOuverts\(me, "tous"\)/.test(bloc), "aucune liste ne pose tout");

  // Le défilement de Ma carte : l'observateur commun.
  const tenue = lire("hooks/use-encart-tenu.ts");
  for (const [motif, quoi] of [
    ["const deja = defil - lire();", "ce que le navigateur a déjà rattrapé est déduit (sinon Chrome est compensé deux fois)"],
    ["rattrapageDesEncarts(mesures, deja, ecran(liste[0]?.s ?? null))", "un seul geste pour tous les encarts de l'image"],
    ['liste[geste.ramener]?.scrollIntoView({ block: "nearest" });', "la ligne à ramener revient à l'écran"],
    ["else if (geste) poser(defil + geste.decaler);", "le décalage part du défilement d'avant"],
    ["if (!fige) defil = lire();", "le défilement relevé reste celui d'avant juste après un changement"],
    ["    fige = true;\n", "un changement fige le défilement relevé"],
    ["const avant = hauteurs.get(s) ?? 0;", "un encart pas encore vu paraît (sa hauteur d'avant est 0)"],
    ["const hauteurs = new WeakMap<HTMLElement, number>();", "la hauteur d'un encart survit à ses effets rejoués (il ne paraît pas deux fois)"],
    ["hauteurs.set(s, r.height);", "chaque relevé garde sa hauteur"],
    ["if (!partis.length) queueMicrotask(rattraperLesPartis);", "un encart qui s'en va est rattrapé une fois la page refaite"],
    ["const ceux = partis.filter((p) => !p.s.isConnected).map((p) => p.m);", "seuls ceux qui sont vraiment partis"],
    ["if (i) i.ici = true;", "rangé sous ma voix : la règle le sait"],
  ] as const) place(tenue, motif, `use-encart-tenu.ts, ${quoi}`);
  place(tenue, "if (placeEnPose()) {", "use-encart-tenu.ts, rien ne se compense pendant qu'une page retrouve sa place", 2);
  place(lire("components/layout/memoire-navigation.tsx"), "export function placeEnPose(): boolean {\n  return arreter !== null;\n}", "memoire-navigation.tsx, une pose en cours");

  // Les votes prêts : une seule formule, pour l'encart et l'étiquette comme pour la révélation.
  place(lire("hooks/use-votes.ts"), "return votesPrets({ server: !!session?.server, charges });", "use-votes.ts, les votes prêts");
  place(lire("hooks/use-votes.ts"), 'window.addEventListener("online", reprendre);', "use-votes.ts, une lecture échouée reprend au retour du réseau");
  place(lire("components/sfl/season-provider.tsx"), "const votesPrets = votesPretsPour({ server: !!session?.server, charges: votesCharges() });", "le SeasonProvider, les votes prêts");
  // Mes deux voix données d'ici : retenues pour la prochaine ouverture.
  place(lire("lib/sfl/votes.ts"), "if (mesDeuxVoix(cache, v.saison, v.j, v.votant)) retenirVoix(cleDuVote(v.saison, v.j, v.votant), true);", "votes.ts, voter retient mes deux voix");

  // Le bloc lui-même : la place d'un titulaire (jamais findPlayerMatch seul), son bandeau, ses cartes fermées avant la feuille.
  const figures = lire("components/sfl/vote-figures.tsx");
  assert.ok(!/findPlayerMatch\(/.test(figures), "vote-figures.tsx passe par placeDuVotant (l'extra time seul ne vote pas)");
  for (const [motif, quoi, fois] of [
    ["const place = placeDuVotant(journee, me);", "la place d'un titulaire"],
    ["const bandeau = bandeauDuVote(etat, !!place);", "le bandeau"],
    ['const ouvert = etat === "a-moi";', "mes cartes ne se votent qu'une fois la feuille de mon match remplie"],
    ['"Vote à la fin des matchs"', "le bandeau gris de qui ne joue pas"],
    ["jusquaInsecable(jusqua)", "« jusqu'à 18 h » d'un seul tenant", 2],
    ["const fin = onVoix?.(cat);", "la voix qui part d'ici le dit"],
    ["fin?.();", "… et sa fin, reçue ou refusée"],
  ] as [string, string, number?][]) place(figures, motif, `vote-figures.tsx, ${quoi}`, fois);

  // « Voter » sous la feuille en direct : un titulaire de ce match, ses voix à donner (jamais « joue ce match » seul).
  const directDuMatch = lire("components/sfl/direct/direct-du-match.tsx");
  place(directDuMatch, "voteSousLeMatch(saisonLue, jn, me, equipes)", "direct-du-match.tsx, « Voter »");
  assert.ok(!/\[\.\.\.noirs, \.\.\.blancs\]\.includes\(me\)/.test(directDuMatch), "direct-du-match.tsx : « Voter » ne suit plus les lignes du match (l'extra time y est)");
}

console.log(
  "vote-du-jour-check : la règle (feuilles, extra time en plus ou seul, « Voter » du direct), le tri du fil (une fois et une seule), les journées posées à l'heure, le bandeau (« jusqu'à 18 h » d'un tenant), mes voix (prêtes, retenues, à l'écran), l'encart de Ma carte, la marque de la Map, le défilement (à l'écran, au-dessus, au bord 63/64 px, sous ma voix, paru, parti, deux encarts, Chrome et Safari), les endroits et les appels — ok"
);
