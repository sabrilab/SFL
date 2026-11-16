// Le vote du jour dans les trois onglets (components/sfl/vote-du-jour.tsx,
// Ilyes, 15/11/2026 : « quand les votes sont actifs, mets-les dans les trois
// onglets […] bien visibles, qu'on les trouve partout »).
//
// Où en est le vote, pour un joueur, décide de l'endroit où il se pose
// (lib/sfl/votes.ts, etatDuVote et aPoser) :
//   · `a-moi` : la feuille de mon match est remplie, j'ai mes deux voix à
//     donner : l'étiquette sur la Map, l'encart sur Ma carte, et l'encart en
//     tête des Actus ;
//   · `aux-autres` : je ne joue pas la journée, un match au moins a sa
//     feuille : l'encart en tête des Actus, rien sur la Map ni sur Ma carte ;
//   · `en-attente` : personne n'y vote encore de là où je regarde : l'encart
//     grisé sous la feuille en direct des Actus, rien ailleurs.
//
// Depuis le contrôle du 16/11/2026, toutes les décisions du composant sont
// des fonctions pures (lib/sfl/votes.ts, lib/encart-tenu.ts) que le banc joue
// pour de vrai ; avant, il ne lisait que des chaînes du .tsx et 9 retouches
// sur 12 lui échappaient (scratchpad votes-partout-verif/mutants). Ce que le
// banc vérifie :
//   1 · la règle, match par match : mon match fini ou non, l'autre fini ou
//       non, un joueur qui n'a pas joué, des buts notés sans résultat (la
//       feuille n'est pas remplie), une seule équipe saisie ; l'extra time :
//       en plus de son match il suit le sien, venu seulement en extra time il
//       ne vote pas (placeDuVotant) ;
//   2 · le tri (aPoser) : chaque état posé une fois et une seule dans le fil
//       (`ouverts` XOR `en-attente`), `a-moi` seul pour Ma carte et la Map,
//       `tous` pour la vue Classement ;
//   3 · les journées posées (votesOuvertsPour), à l'heure : vote ouvert, vote
//       fermé (18 h passées, un autre jour : rien nulle part), journée sans
//       vote, deux journées le même jour ;
//   4 · le bandeau (bandeauDuVote) : gris tant qu'on attend, « des matchs »
//       pour qui ne joue pas ;
//   5 · l'encart de Ma carte (etatEncart, mesDeuxVoix) : rangé une fois mes
//       deux voix données, la ligne seule tant qu'elles ne sont pas relues,
//       jamais rangé ailleurs que sur Ma carte ;
//   6 · la marque de la Map (marqueDuVote) : ni point ni coche tant que les
//       votes ne sont pas relus ;
//   7 · le défilement quand l'encart change de hauteur (rattrapage) : à
//       l'écran sa ligne y reste, au-dessus ce que je lis ne bouge pas ;
//   8 · les endroits, dans le texte des pages : l'ordre du fil, les gardes
//       Bola de la Map et de Ma carte, et ce que les composants appellent.
//   npx tsx tools/vote-du-jour-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeJournees } from "../src/lib/sfl/saisie/engine";
import type { JourneeMeta, MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { A_L_ECRAN, rattrapage } from "../src/lib/encart-tenu";
import {
  aPoser,
  bandeauDuVote,
  etatDuVote,
  etatEncart,
  journeeAvecVote,
  marqueDuVote,
  mesDeuxVoix,
  placeDuVotant,
  votesOuvertsPour,
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
}

/* ----------------------- 5 · L'encart de Ma carte ----------------------- */
{
  const v = (votant: string, categorie: "impact" | "def", j = J): VoteFigure => ({ saison: 1, j, categorie, votant, candidat: "b1", match_id: "m1" });
  assert.equal(mesDeuxVoix([], 1, J, "n1"), false);
  assert.equal(mesDeuxVoix([v("n1", "impact")], 1, J, "n1"), false, "une seule voix : pas encore");
  assert.equal(mesDeuxVoix([v("n1", "impact"), v("n1", "def")], 1, J, "n1"), true);
  assert.equal(mesDeuxVoix([v("n1", "impact"), v("n1", "def", J + 1)], 1, J, "n1"), false, "la seconde voix d'une autre journée ne compte pas");
  assert.equal(mesDeuxVoix([v("n1", "impact"), v("n2", "def")], 1, J, "n1"), false, "la voix d'un autre ne compte pas");
  for (const prets of [false, true]) for (const vote of [false, true]) for (const rouvert of [false, true])
    assert.equal(etatEncart({ repliable: false, prets, vote, rouvert }), "ouvert", "ailleurs que sur Ma carte, jamais rangé");
  assert.equal(etatEncart({ repliable: true, prets: true, vote: false, rouvert: false }), "ouvert", "une voix à donner : ouvert");
  assert.equal(etatEncart({ repliable: true, prets: false, vote: false, rouvert: false }), "attente", "mes voix pas relues : ni ouvert ni rangé");
  assert.equal(etatEncart({ repliable: true, prets: true, vote: true, rouvert: false }), "range", "mes deux voix données : rangé");
  assert.equal(etatEncart({ repliable: true, prets: false, vote: true, rouvert: false }), "range", "mes deux voix connues d'ici : rangé, relues ou non");
  assert.equal(etatEncart({ repliable: true, prets: true, vote: true, rouvert: true }), "rouvert", "rouvert à la main : il le reste");
}

/* ----------------------- 6 · La marque de la Map ----------------------- */
{
  assert.equal(marqueDuVote(false, false), null, "votes pas relus : ni point rouge ni coche");
  assert.equal(marqueDuVote(true, false), "point", "une voix à donner : le point rouge");
  assert.equal(marqueDuVote(true, true), "coche");
  assert.equal(marqueDuVote(false, true), "coche", "mes deux voix connues d'ici : la coche");
}

/* ----------------------- 7 · Le défilement ----------------------- */
{
  const ecran = { haut: 0, bas: 667 };
  // Tout au-dessus de l'écran (j'ai défilé jusqu'à ma carte), il se range : ce que je lis ne bouge pas.
  assert.deepEqual(rattrapage({ haut: -609, bas: -64 }, { haut: -609, bas: -524 }, ecran), { decaler: -460 });
  // … ou se déplie (mes voix relues : il m'en reste) : idem.
  assert.deepEqual(rattrapage({ haut: -200, bas: -115 }, { haut: -200, bas: 345 }, ecran), { decaler: 460 });
  // Il croise l'écran, j'en regarde les cartes (un petit téléphone, la seconde rangée) : rangé, sa ligne revient.
  assert.deepEqual(rattrapage({ haut: -109, bas: 436 }, { haut: -109, bas: -24 }, ecran), { ramener: true });
  // Il n'en montre qu'un liseré : c'est ma carte que je lis, elle ne bouge pas.
  assert.deepEqual(rattrapage({ haut: -500, bas: A_L_ECRAN - 34 }, { haut: -500, bas: A_L_ECRAN - 494 }, ecran), { decaler: -460 });
  // Il croise l'écran et se déplie (je l'ai rouvert, ou mes voix arrivent) : je le vois s'ouvrir.
  assert.equal(rattrapage({ haut: -50, bas: 35 }, { haut: -50, bas: 495 }, ecran), null);
  // Son haut à l'écran : rien à faire, rangé ou déplié.
  assert.equal(rattrapage({ haut: 91, bas: 636 }, { haut: 91, bas: 176 }, ecran), null);
  assert.equal(rattrapage({ haut: 91, bas: 176 }, { haut: 91, bas: 636 }, ecran), null);
  // Rien n'a bougé.
  assert.equal(rattrapage({ haut: -609, bas: -64 }, { haut: -609, bas: -64 }, ecran), null);
}

/* ----------------------- 8 · Les endroits ----------------------- */
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
  // Ma carte : seulement quand j'ai une voix à donner, rangé une fois les deux données, jamais pour un joueur Bola.
  place(lire("app/profil/page.tsx"), '{!bola && <VoteDuJour me={player.name} lesquels="a-moi" repliable', "Ma carte");
  // La Map : l'étiquette dans le bloc du lettrage, avant la colonne des boutons, jamais pour un joueur Bola ; plus rien dans la pile du bas.
  const map = lire("app/map/page.tsx");
  const etiquette = place(map, "{!sansSfl && me && <VoteDuJourMap me={me} />}", "la Map");
  const lettrage = place(map, "{/* En haut à gauche :", "la Map");
  const boutons = place(map, "{/* En haut à droite :", "la Map");
  assert.ok(lettrage < etiquette && etiquette < boutons, "la Map : l'étiquette du vote avec le lettrage, en haut à gauche");
  // Le composant ne trie rien lui-même : il passe où il se pose à votesOuvertsPour, et l'étiquette ne demande que « a-moi ».
  const bloc = lire("components/sfl/vote-du-jour.tsx");
  place(bloc, "votesOuvertsPour(saisonLue, journees, me, maintenant, lesquels)", "le tri du composant");
  place(bloc, 'useVotesOuverts(me, "a-moi")', "l'étiquette de la Map");
  place(bloc, "etatEncart({ repliable, prets, vote, rouvert })", "l'encart de Ma carte");
  place(bloc, "marqueDuVote(prets, ", "la marque de la Map");
  place(bloc, "rattrapage({ haut, bas: haut + avant }, { haut, bas: haut + r.height }, ecran())", "le défilement de Ma carte");
  // Le bloc lui-même : la place d'un titulaire (jamais findPlayerMatch seul), et son bandeau.
  const figures = lire("components/sfl/vote-figures.tsx");
  assert.ok(!/findPlayerMatch\(/.test(figures), "vote-figures.tsx passe par placeDuVotant (l'extra time seul ne vote pas)");
  place(figures, "placeDuVotant(journee, me)", "le bloc");
  place(figures, "bandeauDuVote(etat, !!place)", "le bandeau du bloc");
}

console.log(
  "vote-du-jour-check : la règle (feuilles, extra time en plus ou seul), le tri du fil (une fois et une seule), les journées posées à l'heure (ouvert, 18 h passées, le lendemain, sans vote, deux journées), le bandeau, l'encart de Ma carte (rangé, en attente des voix), la marque de la Map, le défilement (à l'écran / au-dessus), les endroits et les gardes Bola — ok"
);
