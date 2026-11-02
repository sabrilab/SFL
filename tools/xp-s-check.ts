// Les XP S (lib/sfl/xp-s.ts, 02/11/2026) : la seconde monnaie, plus rare.
// Ce que le banc vérifie, sur la saison 0 du dépôt (seedSaison), la ligue du
// banc (tools/xp-s-donnees.ts : la saison 0 archivée, la démo d'Ilyes en
// cours, missions acceptées, Flair rempli sans réfléchir) et des cas écrits
// à la main :
//   1 · le barème : la J1 en SFL Time, Ilyes à 59 en saison 0 ;
//   2 · les sources : une mission S réussie 10, ratée 0, de rang A ou B 0 ;
//   3 · le Flair : « qui gagne », buteur et passeur d'un match 0, un dur 2,
//       le meilleur du jour 2, trois durs 4, un choix sur soi 0, la tribune
//       au même plafond ; le Flair de saison figé après la J2, hors plafond ;
//   4 · les titres faibles (une voix) 0, à deux voix 5 ;
//   5 · Bola : deux matchs le même jour, MVP, Triplé et Triple caviar : 13
//       sur la semaine ; un match sans confirmation 0 ;
//   6 · les doublons : une mission qui couvre le MVP, une même clé ;
//   7 · les plafonds : jamais plus de 13, la SFL Time retirée la dernière ;
//   8 · la révélation : 19 h, 19 h 40, sans fin des matchs, la J4 à minuit,
//       les XP S d'une journée suivent journeesComptees ;
//   9 · l'XP normale ne bouge pas d'un point (empreinte d'avant les XP S) ;
//   10 · le serveur et le téléphone : le même total ;
//   11 · le solde : gagné moins dépensé, jamais sous zéro ;
//   12 · la mission perso « MVP » couvre le MVP.
//   npx tsx tools/xp-s-check.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { libelleMatch, type MatchValide } from "../src/lib/sfl/carte-bola";
import type { LigneComptee, MatchCompte } from "../src/lib/sfl/ligue-vierge";
import { bilanDe, type LigneXp } from "../src/lib/sfl/missions";
import { MISSIONS_PERSO, missionsPerso, semaineDe, type MissionFaite } from "../src/lib/sfl/missions-perso";
import { pronosDeJournee, type Prono } from "../src/lib/sfl/pronos";
import { figer, journeesComptees } from "../src/lib/sfl/revelation";
import { saisonAvecVotes } from "../src/lib/sfl/saison-serveur.server";
import { computeJournees, deriveSeason } from "../src/lib/sfl/saisie/engine";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import type { JourneeMeta, MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { appliquerVotes, titresFaibles, type VoteFigure } from "../src/lib/sfl/votes";
import { journalComplet, journalCompletAvecS, type EntreesXp, type JournalXp } from "../src/lib/sfl/xp-calcul";
import { bilanServeurDe, xpServeur } from "../src/lib/sfl/xp-serveur.server";
import { bilanXpS, journalXpS, lignesXpSBola, plafonner, rattachementXp, totalXpS, XP_S, xpSParLigne, type JournalXpS, type LigneXpS } from "../src/lib/sfl/xp-s";
import { entreesDuBanc, MAINTENANT } from "./xp-s-donnees";

const LOIN = new Date("2026-11-02T12:00:00Z");
const hiver = (s: string) => new Date(`${s.replace(" ", "T")}:00+01:00`);
const total = (j: JournalXpS, nom: string) => totalXpS(j.get(nom) ?? []);
const entrees = (e: Partial<EntreesXp> & Pick<EntreesXp, "jugee">): EntreesXp => ({
  reponses: [],
  votes: [],
  felicitations: [],
  pronos: [],
  ligueRecrues: [],
  moi: null,
  bolaCarte: null,
  maintenant: LOIN,
  ...e,
});
const xpsDe = (e: Partial<EntreesXp> & Pick<EntreesXp, "jugee">) => journalCompletAvecS(entrees(e)).journalS;
const ligne = (j: number, player: string, extra: Partial<MatchEntry> = {}): MatchEntry => ({
  j, player, team: null, statut: "Présent", result: "Victoire", sflTime: false,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false, ...extra,
});
const meta = (j: number, date: string, extra: Partial<JourneeMeta> = {}): JourneeMeta => ({ j, date, sflTime: false, mvpAuto: true, ...extra });

/* ------------------------------- 1 · Le barème ------------------------------- */
const s0 = seedSaison();
assert.equal(s0.numero, undefined, "la saison du dépôt reste la saison 0 : forcée à 1, sa J5 passerait sous la révélation");
const r0 = xpsDe({ jugee: s0 });
{
  const presentsJ1 = s0.entries.filter((e) => e.j === 1 && e.statut === "Présent" && !e.extraTime).map((e) => e.player);
  assert.equal(presentsJ1.length, 10, "la J1 de la saison 0 a dix présents");
  assert.ok(s0.journees.find((m) => m.j === 1)!.sflTime);
  for (const n of presentsJ1) assert.ok(r0.get(n)!.some((l) => l.source === "sfl-time" && l.saison === 0 && l.j === 1 && l.xps === XP_S.sflTime), `${n} : 10 XP S de SFL Time à la J1`);
  assert.equal([...r0.values()].flat().filter((l) => l.source === "sfl-time").length, 10, "seule la J1 était en SFL Time");
  assert.equal(total(r0, "Ilyes"), 59, "Ilyes : 59 XP S en saison 0 (titres et SFL Time, 13 par journée)");
  assert.equal(total(r0, "Ilies"), 31);
  assert.equal(total(r0, "Sosso Coach"), 31);
  assert.equal(total(r0, "Anas"), 26);
}

/* ------------------------------- 2 · Les sources ------------------------------- */
// Une journée jouée, sans titre ni SFL Time, et un journal d'XP écrit à la main.
const SOLO: Saison = {
  numero: 0,
  journees: [meta(1, "21 juin", { mvpAuto: false })],
  roster: ["Ana", "Bilal", "Chris", "Dina", "Eli"].map((name) => ({ name, poste: null, profil: "Actif", base: null })),
  entries: ["Ana", "Bilal", "Chris", "Dina", "Eli"].map((n) => ligne(1, n)),
  convocations: [],
};
const mission = (rang: "S" | "A" | "B", reussie: boolean, extra: Partial<LigneXp> = {}): LigneXp => ({
  saison: 0, j: 1, date: "21 juin", quoi: rang === "S" ? "Mission Verrou" : "Mission Victoire", xp: reussie ? 130 : -65, mission: { creneau: "contrat", rang, reussie }, ...extra,
});
const journalDe = (x: Record<string, LigneXp[]>): JournalXp => new Map(Object.entries(x).map(([n, lignes]) => [n, { lignes, reussies: 0 }]));
{
  const j = journalXpS({ jugee: SOLO, bolaCarte: null, maintenant: LOIN }, journalDe({
    Ana: [mission("S", true)],
    Bilal: [mission("S", false)],
    Chris: [mission("A", true), { ...mission("B", true), mission: { creneau: "defi", rang: "B", reussie: true } }],
    Dina: [{ ...mission("S", true), mission: { creneau: "contrat-arbitre" as never, rang: "S", reussie: true } }],
  }));
  assert.equal(total(j, "Ana"), 10, "mission S réussie : 10");
  assert.equal(total(j, "Bilal"), 0, "mission S ratée : 0 (le risque se paie en XP)");
  assert.equal(total(j, "Chris"), 0, "missions A et B : 0");
  assert.equal(total(j, "Dina"), 0, "une mission d'arbitre : 0");
  assert.equal(j.get("Ana")![0].rattache, rattachementXp(mission("S", true)), "la ligne d'XP S accompagne sa mission");
}
// Sur la ligue du banc : chaque ligne de mission en XP S vient d'une mission de rang S réussie du journal.
const banc = entreesDuBanc();
const rb = journalCompletAvecS(banc);
{
  for (const [n, lignes] of rb.journalS)
    for (const l of lignes.filter((x) => x.source === "mission"))
      assert.ok(rb.journal.get(n)!.lignes.some((x) => x.saison === l.saison && x.j === l.j && x.quoi === l.quoi && x.mission?.rang === "S" && x.mission.reussie), `${n} S${l.saison} J${l.j} ${l.quoi}`);
  assert.ok([...rb.journalS.values()].flat().some((l) => l.source === "mission"), "le banc a des missions S réussies");
}

/* ------------------------------- 3 · Le Flair ------------------------------- */
{
  // La J3 de la saison 0 : Ilyes MVP du Match 1, Ilies du Match 2 ; duels Smail (Match 1) et Ilies (Match 2) ;
  // écart du Match 2 « large » ; le meilleur du jour Ilies ; « qui gagne » le Match 1 : les Noirs.
  const ref = new Date("2026-08-31T12:00:00Z");
  const p = pronosDeJournee(s0, 0, 3, ref)!;
  const le = new Date(p.coupEnvoi.getTime() - 3600_000).toISOString();
  const pr = (joueur: string, sujet: string, choix: string): Prono => ({ saison: 0, j: 3, sujet, joueur, choix, le });
  const pronos: Prono[] = [
    // Un spectateur : « qui gagne », le buteur et le passeur d'un match justes (0), le MVP du match juste (2).
    pr("Tribune A", "match:0", "noirs"), pr("Tribune A", "buteur:0", "Ilyes"), pr("Tribune A", "passeur:0", "Kylian"), pr("Tribune A", "mvp:0", "Ilyes"),
    // Le meilleur du jour juste : 2.
    pr("Tribune B", "pepite", "Ilies"),
    // Trois durs justes en tribune : 4, le plafond.
    pr("Tribune C", "mvp:0", "Ilyes"), pr("Tribune C", "mvp:1", "Ilies"), pr("Tribune C", "duel:0", "Smail"),
    // Sur la feuille, trois durs justes : 4, le même plafond.
    pr("Kylian", "mvp:1", "Ilies"), pr("Kylian", "duel:1", "Ilies"), pr("Kylian", "ecart:1", "large"),
    // Sur soi : Smail gagne son duel (le seul choix permis) : 0 XP S, ses 5 de l'Impact restent.
    pr("Smail", "duel:0", "Smail"),
    // Faux : 0.
    pr("Tribune D", "mvp:0", "Kader"),
    // Posé après le coup d'envoi : pas retenu.
    { ...pr("Tribune E", "mvp:0", "Ilyes"), le: new Date(p.coupEnvoi.getTime() + 60_000).toISOString() },
  ];
  const j = xpsDe({ jugee: s0, pronos });
  const flair = (n: string) => (j.get(n) ?? []).filter((l) => l.source === "flair").reduce((a, l) => a + l.xps, 0);
  assert.equal(flair("Tribune A"), 2, "« qui gagne », buteur et passeur du match : rien ; le MVP du match : 2");
  assert.equal(flair("Tribune B"), 2, "le meilleur du jour : 2");
  assert.equal(flair("Tribune C"), 4, "trois durs justes : 4 (plafond), en tribune");
  assert.equal(flair("Kylian"), 4, "sur la feuille : le même plafond");
  assert.equal(flair("Smail"), 0, "un choix sur soi : 0");
  assert.equal(totalXpS((j.get("Smail") ?? []).filter((l) => l.saison === 0 && l.j === 3)), 5, "Smail garde son Impact de la J3");
  assert.equal(flair("Tribune D"), 0, "faux : 0");
  assert.equal(flair("Tribune E"), 0, "posé après le coup d'envoi : 0");
  // Le journal d'XP, lui, paie toujours « qui gagne » et le buteur du match.
  const jx = journalComplet(entrees({ jugee: s0, pronos }));
  assert.ok(jx.get("Tribune A")!.lignes.some((l) => l.quoi.startsWith("Flair") && l.xp > 20 && l.flairDurs === 1));
  assert.ok(jx.get("Smail")!.lignes.some((l) => l.quoi.startsWith("Flair") && l.flairDurs === 0), "le choix sur soi rapporte de l'XP, pas d'XP S");
}
{
  // Le Flair de saison (la saison 0 du banc, close) : posé avant le premier coup d'envoi ou juste après
  // le deuxième, juste : 10 ; après le troisième : 0 ; sur soi : 0.
  const fs = (n: string) => (rb.journalS.get(n) ?? []).filter((l) => l.source === "flair-saison");
  assert.deepEqual(fs("Kader").map((l) => l.xps), [10, 10], "Kader : buteur (avant la J1) et Pépite d'Or (après la 2e journée jouée) : 10 chacun");
  assert.deepEqual(fs("Smail").map((l) => l.xps), [10]);
  assert.deepEqual(fs("Ilies").map((l) => l.xps), [], "posé après le troisième coup d'envoi : 0");
  assert.deepEqual(fs("Ilyes").map((l) => l.xps), [], "sur soi : 0");
  // Hors plafond de la journée : la dernière journée de la saison (J8) déjà à 13, le Flair de saison s'y ajoute.
  const ARCH: Saison = { ...SOLO, numero: 1, archives: [{ numero: 0, nom: "Saison 0", cloturee: "2026-08-31T12:00:00.000Z", journees: SOLO.journees, roster: SOLO.roster, entries: SOLO.entries.map((e) => (e.player === "Ana" ? { ...e, mvp: true, sflTime: true } : e)) }], journees: [], entries: [] };
  const j = journalXpS({ jugee: ARCH, bolaCarte: null, maintenant: LOIN }, journalDe({
    Ana: [mission("S", true), { saison: 0, j: 1, date: "21 juin", quoi: "Flair de la saison : Pépite d'Or", xp: 300, flairSaison: { sujet: "pepite", tot: true } }],
  }));
  const ana = j.get("Ana")!;
  assert.equal(totalXpS(ana.filter((l) => l.source !== "flair-saison")), 13, "la journée : 13");
  assert.equal(total(j, "Ana"), 23, "plus 10 de Flair de saison, hors plafond");
}

/* ------------------------------- 4 · Les titres faibles ------------------------------- */
{
  // La J3 de la saison 1 (25 oct., ancien régime) : B1 élu Défensive à une voix, C1 à deux voix.
  const equipe = (n: string, t: string) => ligne(3, n, { team: t, result: t.startsWith("Noirs") ? "Victoire" : "Défaite" });
  const direct: Saison = {
    numero: 1,
    journees: [meta(3, "25 oct.", { matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }, { equipes: ["Noirs 2", "Blancs 2"] }] })],
    roster: [],
    entries: [
      ...["A1", "A2", "A3"].map((n) => equipe(n, "Noirs 1")),
      ...["B1", "B2", "B3"].map((n) => equipe(n, "Blancs 1")),
      ...["C1", "C2", "C3"].map((n) => equipe(n, "Noirs 2")),
      ...["D1", "D2", "D3"].map((n) => equipe(n, "Blancs 2")),
    ],
    convocations: [],
  };
  const matchs = computeJournees(direct).find((x) => x.j === 3)!.matches!;
  const id = (t: string) => matchs.find((m) => m.teamA.name === t || m.teamB.name === t)!.id;
  const votes: VoteFigure[] = [
    { saison: 1, j: 3, categorie: "def", votant: "A1", candidat: "B1", match_id: id("Noirs 1") },
    { saison: 1, j: 3, categorie: "def", votant: "D1", candidat: "C1", match_id: id("Noirs 2") },
    { saison: 1, j: 3, categorie: "def", votant: "D2", candidat: "C1", match_id: id("Noirs 2") },
  ];
  const jugee = figer(saisonAvecVotes(direct, votes, LOIN), LOIN);
  assert.ok(jugee.titresFaibles?.includes("3:def:B1"), "B1, une voix : un titre faible");
  assert.ok(jugee.entries.find((e) => e.player === "B1")!.def && jugee.entries.find((e) => e.player === "C1")!.def, "les deux restent des titres");
  const j = xpsDe({ jugee, votes: votes.map((v) => ({ saison: v.saison, j: v.j, categorie: v.categorie, votant: v.votant })) });
  assert.equal(total(j, "B1"), 0, "Défensive élue à une voix : 0");
  assert.equal(total(j, "C1"), 5, "à deux voix : 5");
}

/* ------------------------------- 5 · Bola ------------------------------- */
let idMatch = 0;
function matchBola(jour: string, heure: string, moi: { buts?: number; passes?: number; mvp?: boolean }, requise = true): MatchValide {
  const l: LigneComptee = { id: "u-bola", name: "Bolaman", equipe: "clairs", buts: moi.buts ?? 0, passes: moi.passes ?? 0, mvp: !!moi.mvp, classe: true, points: 0, resultat: "V" };
  const m: MatchCompte = { id: ++idMatch, jour, heure, genre: "match", scoreClairs: 3, scoreFonces: 1, joueurs: [l], etat: "compte", requise, valide: true, mvps: moi.mvp ? ["u-bola"] : [] };
  return { m, ligne: l, libelle: libelleMatch(m) };
}
{
  // Le dimanche 25 octobre : deux matchs validés, MVP les deux fois, trois buts dans l'un, trois passes D dans l'autre.
  const valides = [matchBola("2026-10-25", "10:00", { buts: 3, mvp: true }), matchBola("2026-10-25", "16:00", { passes: 3, mvp: true })];
  const bolaCarte = { nom: "Bolaman", valides };
  const j = journalXpS({ jugee: s0, bolaCarte, maintenant: LOIN }, new Map());
  const brut = 2 * XP_S.mvp + 2 * XP_S.missionS;
  assert.equal(brut, 40);
  assert.equal(total(j, "Bolaman"), 13, "deux MVP, Triplé, Triple caviar : 13 sur la semaine, pas 40");
  // Le même match sans confirmation (requise faux) : rien.
  const sans = journalXpS({ jugee: s0, bolaCarte: { nom: "Bolaman", valides: [matchBola("2026-10-12", "10:00", { buts: 3, mvp: true }, false)] }, maintenant: LOIN }, new Map());
  assert.equal(total(sans, "Bolaman"), 0, "un match sans confirmation : 0");
  // Deux semaines : chacune son plafond.
  const deux = journalXpS({ jugee: s0, bolaCarte: { nom: "Bolaman", valides: [...valides, matchBola("2026-10-27", "19:00", { mvp: true })] }, maintenant: LOIN }, new Map());
  assert.equal(total(deux, "Bolaman"), 23, "la semaine du 26 octobre a son propre plafond");
  // Un match à venir ne compte pas.
  const avant = journalXpS({ jugee: s0, bolaCarte, maintenant: new Date("2026-10-25T12:00:00+01:00") }, new Map());
  assert.equal(total(avant, "Bolaman"), 13, "le match de 16 h n'a pas encore eu lieu : le premier seul (MVP et Triplé, 20 au plafond 13)");
  for (const l of j.get("Bolaman")!) assert.equal(semaineDe(l.jour!), "2026-10-19");
  // Par le calcul complet (le journal d'XP Bola, xp-calcul.ts) : le même résultat.
  assert.equal(total(xpsDe({ jugee: s0, bolaCarte: { nom: "Bolaman", valides } as never }), "Bolaman"), 13);
}

/* ------------------------------- 6 · Les doublons ------------------------------- */
{
  // Une mission du dimanche qui exige le MVP, réussie avec lui : 10, pas 20.
  const avecMvp: Saison = { ...SOLO, entries: SOLO.entries.map((e) => (e.player === "Ana" ? { ...e, mvp: true } : e)) };
  const j = journalXpS({ jugee: avecMvp, bolaCarte: null, maintenant: LOIN }, journalDe({ Ana: [{ ...mission("S", true), mission: { creneau: "contrat", rang: "S", reussie: true, couvre: "mvp" } }] }));
  assert.equal(total(j, "Ana"), 10, "mission qui couvre le MVP : 10, pas 20");
  assert.deepEqual(j.get("Ana")!.map((l) => l.source), ["mission"], "la mission reste, le titre part");
  // Une même clé ne compte qu'une fois (la même ligne lue deux fois).
  const deux = journalXpS({ jugee: SOLO, bolaCarte: null, maintenant: LOIN }, journalDe({ Bilal: [mission("S", true), mission("S", true)] }));
  assert.equal(total(deux, "Bilal"), 10, "la même mission, deux fois : 10");
  // Les clés de tout le banc sont uniques.
  const cles = [...rb.journalS.values()].flat().map((l) => l.cle);
  assert.equal(new Set(cles).size, cles.length, "aucune clé en double");
}

/* ------------------------------- 7 · Les plafonds ------------------------------- */
{
  for (const [n, lignes] of rb.journalS) {
    const parJournee = new Map<string, number>();
    for (const l of lignes) {
      if (l.source === "flair-saison") continue;
      const k = l.source === "bola" ? `w${semaineDe(l.jour!)}` : `${l.saison}|${l.j}`;
      parJournee.set(k, (parJournee.get(k) ?? 0) + l.xps);
    }
    for (const [k, v] of parJournee) assert.ok(v <= XP_S.journee, `${n} ${k} : ${v} > 13`);
  }
  // Tout d'un coup : SFL Time, MVP, Impact, Défensive, une mission S et le Flair : 44 → 13, la SFL Time garde ses 10.
  const tout: Saison = { ...SOLO, journees: [meta(1, "21 juin", { sflTime: true })], entries: SOLO.entries.map((e) => (e.player === "Ana" ? { ...e, sflTime: true, mvp: true, impact: true, def: true } : e)) };
  const j = journalXpS({ jugee: tout, bolaCarte: null, maintenant: LOIN }, journalDe({ Ana: [mission("S", true), { saison: 0, j: 1, date: "21 juin", quoi: "Flair, 3 sur 5", xp: 60, flairDurs: 3 }] }));
  const ana = j.get("Ana")!;
  assert.equal(totalXpS(ana), 13);
  assert.deepEqual(ana.map((l) => [l.source, l.titre ?? null, l.xps]), [["sfl-time", null, 10], ["titre", "mvp", 3]], "retirés dans l'ordre : Flair, Défensive, Impact, mission, puis le MVP ; la SFL Time la dernière");
  // plafonner seul : à rang égal, la dernière ligne venue part d'abord ; une ligne réduite garde son reste.
  const L = (source: LigneXpS["source"], xps: number, cle: string): LigneXpS => ({ saison: 0, j: 1, date: "", quoi: cle, xps, source, cle, rattache: cle });
  assert.deepEqual(plafonner([L("mission", 10, "a"), L("mission", 10, "b")], 13).map((l) => [l.cle, l.xps]), [["a", 10], ["b", 3]]);
  assert.deepEqual(plafonner([L("sfl-time", 10, "t")], 13).map((l) => l.xps), [10], "sous le plafond : rien ne bouge");
}

/* ------------------------------- 8 · La révélation ------------------------------- */
// La saison 1 : la J4 (1 nov., ancien régime) et la J5 (8 nov., la révélation). Ana MVP chaque fois, la J5 en SFL Time.
const R_NOMS = { noirs: ["Ana", "Bea", "Cid"], blancs: ["Dan", "Eve", "Fil"] };
function saisonR(j5: { fin?: string; fini?: boolean } = {}): Saison {
  const lignes = (j: number, sfl: boolean, fini = true) => [
    ...R_NOMS.noirs.map((n) => ligne(j, n, { team: "Noirs 1", result: fini ? "Victoire" : null, sflTime: sfl, buts: n === "Ana" ? 3 : 0, mvp: n === "Ana" })),
    ...R_NOMS.blancs.map((n) => ligne(j, n, { team: "Blancs 1", result: "Défaite", sflTime: sfl, buts: n === "Dan" ? 1 : 0 })),
  ];
  return {
    numero: 1,
    journees: [meta(4, "1 nov.", { matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }] }), meta(5, "8 nov.", { sflTime: true, matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }], ...(j5.fin ? { finDesMatchs: j5.fin } : {}) })],
    roster: [...R_NOMS.noirs, ...R_NOMS.blancs].map((name) => ({ name, poste: null, profil: "Actif", base: null })),
    entries: [...lignes(4, false), ...lignes(5, true, j5.fini !== false)],
    convocations: [],
  };
}
/** La vue de la ligue à l'instant t, par la porte du serveur (lireSaisonServeur). */
const vueServeur = (publiee: Saison, t: Date, votes: VoteFigure[] = []) => figer(saisonAvecVotes(publiee, votes, t), t);
/** La même, par la porte du téléphone (SeasonProvider, puis useSaisonJugee). */
function vueTelephone(publiee: Saison, t: Date, votes: VoteFigure[] = []): Saison {
  const brut = deriveSeason(publiee);
  const vote = appliquerVotes(publiee, brut.journees, votes, t);
  const faibles = titresFaibles(publiee, brut.journees, votes, t);
  const vue = figer(vote, t);
  const derive = vue === publiee && !faibles.size ? brut : deriveSeason(vue, faibles);
  const titree: Saison = { ...vue, ...(faibles.size ? { titresFaibles: [...faibles].sort() } : {}) };
  return appliquerVotes(titree, derive.journees, votes, t);
}
const xpsJ = (publiee: Saison, t: Date, j: number, nom = "Ana", porte = vueServeur) =>
  (xpsDe({ jugee: porte(publiee, t), maintenant: t }).get(nom) ?? []).filter((l) => l.saison === 1 && l.j === j).reduce((a, l) => a + l.xps, 0);
{
  const f1510 = saisonR({ fin: hiver("2026-11-08 15:10").toISOString() });
  assert.equal(xpsJ(f1510, hiver("2026-11-08 18:59"), 5), 0, "fin des matchs 15 h 10 : rien à 18 h 59");
  assert.equal(xpsJ(f1510, hiver("2026-11-08 19:00"), 5), 13, "tout à 19 h 00 (SFL Time et MVP, 13)");
  assert.equal(xpsJ(f1510, hiver("2026-11-08 19:00"), 5, "Dan"), 10, "Dan : sa SFL Time");
  const f1740 = saisonR({ fin: hiver("2026-11-08 17:40").toISOString() });
  assert.equal(xpsJ(f1740, hiver("2026-11-08 19:39"), 5), 0, "fin des matchs 17 h 40 : rien à 19 h 39");
  assert.equal(xpsJ(f1740, hiver("2026-11-08 19:40"), 5), 13, "tout à 19 h 40");
  // Sans fin des matchs : la vue figée attend « feuille finie, nuit passée » ; une feuille jamais finie, toujours rien.
  const sansF = saisonR();
  assert.equal(xpsJ(sansF, hiver("2026-11-08 23:59"), 5), 0);
  assert.equal(xpsJ(sansF, hiver("2026-11-09 00:00"), 5), 13, "sans fin des matchs, feuille finie : à minuit, comme la vue figée");
  const pasFinie = saisonR({ fini: false });
  for (const h of ["2026-11-09 00:00", "2026-11-09 08:00", "2026-11-12 12:00"]) assert.equal(xpsJ(pasFinie, hiver(h), 5, "Dan"), 0, `une feuille jamais finie : rien à ${h} (pas à minuit pile)`);
  // La J4 (ancien régime) : ses points comptent dès le premier but, ses XP S attendent minuit.
  assert.equal(xpsJ(f1510, hiver("2026-11-01 23:59"), 4), 0, "la J4 attend minuit");
  assert.equal(xpsJ(f1510, hiver("2026-11-02 00:00"), 4), 10, "à minuit, le MVP de la J4");
  // Minute par minute, le dimanche de la J5 et sa nuit : les XP S de la J5 suivent exactement journeesComptees.
  for (const s of [f1510, f1740, sansF, pasFinie]) {
    for (let t = hiver("2026-11-08 12:00").getTime(); t <= hiver("2026-11-09 01:00").getTime(); t += 7 * 60_000) {
      const d = new Date(t);
      const compte = journeesComptees(s, d).has(5);
      assert.equal(xpsJ(s, d, 5, "Dan") > 0, compte, `${d.toISOString()} : XP S ${compte ? "attendues" : "en avance"}`);
    }
  }
}

/* ------------------------------- 9 · L'XP normale ne bouge pas ------------------------------- */
{
  // L'empreinte du journal d'XP de la ligue du banc, prise sur 7db23e2 (avant les XP S) : chaque
  // ligne (saison, journée, date, jour, libellé, XP, mission, drapeaux) et le bilan de chacun
  // (total, saison, niveau, palier). Si elle change, l'XP a changé : la refaire avec l'ancien code.
  const champ = (l: LigneXp) =>
    [l.saison, l.j, l.date, l.jour ?? "", l.quoi, l.xp, l.mission ? `${l.mission.creneau}/${l.mission.rang}/${l.mission.reussie}/${l.mission.perso ?? ""}/${l.mission.troisieme ?? ""}` : "", l.parfait ?? "", l.horsRang ?? "", l.bola ?? "", l.defi ?? ""].join("|");
  const empreinte = (j: JournalXp) =>
    createHash("sha256")
      .update(
        [...j]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([n, x]) => {
            const b = bilanDe(j, n, MAINTENANT);
            return `${n}#${x.reussies}#${b.total}/${b.saison}/${b.niveau}/${b.palier}#` + x.lignes.map(champ).sort().join(";");
          })
          .join("\n")
      )
      .digest("hex");
  assert.equal(empreinte(rb.journal), "e2e9c3f19c51ad71365b3ef2d7011d9080acfbbc7dd1ecc16003a4131f8927fc", "le journal d'XP de toute la ligue est celui d'avant les XP S");
  assert.deepEqual(rb.journal, journalComplet(banc), "journalCompletAvecS rend le journal de journalComplet");
}

/* ------------------------------- 10 · Le serveur et le téléphone ------------------------------- */
/** Une base en mémoire pour lireSaisonServeur et xpServeur (aucun réseau : le jeton vide n'ouvre aucun client). */
function base(doc: Saison, tables: Record<string, Record<string, unknown>[]>): SupabaseClient {
  const lignes = (table: string): Record<string, unknown>[] => (table === "saison" ? [{ id: 1, data: doc, updated_at: "2026-11-08T14:10:00Z" }] : (tables[table] ?? []));
  const requete = (table: string) => {
    const filtres: [string, unknown][] = [];
    const lues = () => lignes(table).filter((r) => filtres.every(([c, v]) => r[c] === v));
    const q: Record<string, unknown> = {};
    for (const m of ["select", "order", "in"]) q[m] = () => q;
    q.eq = (c: string, v: unknown) => (filtres.push([c, v]), q);
    q.maybeSingle = async () => ({ data: lues()[0] ?? null, error: null });
    q.range = async (de: number, a: number) => ({ data: lues().slice(de, a + 1), error: null });
    q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: lues(), error: null }).then(ok, ko);
    return q;
  };
  return { from: requete } as unknown as SupabaseClient;
}

void (async () => {
  {
    // La ligue du banc, telle que la base la garde : le serveur et le téléphone, joueur par joueur.
    const doc = banc.jugee;
    const profils = [...new Set([...rb.journal.keys()])].map((name, i) => ({ id: `u-${i}`, name }));
    const sb = base(doc, { missions_reponses: banc.reponses as never, pronos: banc.pronos as never, profiles: profils, felicitations: [], votes_figures: [] });
    const x = await xpServeur(sb, { id: "u-0", nom: profils[0].name, jeton: "" }, MAINTENANT);
    const tel = journalCompletAvecS(entrees({ ...banc, jugee: vueTelephone(doc, MAINTENANT) })).journalS;
    let compares = 0;
    for (const { name } of profils) {
      assert.equal(bilanServeurDe(x, name, MAINTENANT).xpS, bilanXpS(tel, name).gagne, `${name} : le même total au serveur et au téléphone`);
      compares++;
    }
    assert.ok(compares > 40 && bilanServeurDe(x, "Ilyes", MAINTENANT).xpS > 59);
  }
  {
    // Le dimanche de la J5, avec un vote : à 18 h 59, 19 h et 19 h 40, les deux portes rendent les mêmes XP S.
    const publiee = saisonR({ fin: hiver("2026-11-08 17:40").toISOString() });
    const jn = computeJournees(publiee).find((x) => x.j === 5)!;
    const votes: VoteFigure[] = ["Ana", "Bea"].map((votant) => ({ saison: 1, j: 5, categorie: "def", votant, candidat: "Dan", match_id: jn.matches![0].id, jour: "2026-11-08" }));
    for (const h of ["18:59", "19:00", "19:39", "19:40", "23:00"]) {
      const t = hiver(`2026-11-08 ${h}`);
      const sb = base(publiee, { votes_figures: votes as never, profiles: [...R_NOMS.noirs, ...R_NOMS.blancs].map((name, i) => ({ id: `r-${i}`, name })) });
      const x = await xpServeur(sb, { id: "r-3", nom: "Dan", jeton: "" }, t);
      const tel = xpsDe({ jugee: vueTelephone(publiee, t, votes), maintenant: t });
      for (const n of [...R_NOMS.noirs, ...R_NOMS.blancs]) assert.equal(bilanServeurDe(x, n, t).xpS, total(tel, n), `${n} à ${h}`);
      assert.equal(total(tel, "Dan"), h >= "19:40" ? 13 : 0, `Dan à ${h} : rien avant la révélation de 19 h 40, puis sa SFL Time et sa Défensive à deux voix (15, 13 au plafond)`);
    }
  }

  /* ------------------------------- 11 · Le solde ------------------------------- */
  // Gagné moins dépensé, jamais sous zéro : un achat n'est jamais repris (le prix et la monnaie du
  // pack : tools/pack-afrique-check.ts ; la dépense d'un seul tenant : tools/sql/achats-xp-check.sql).
  assert.deepEqual([bilanXpS(r0, "Ilyes", 40).solde, bilanXpS(r0, "Ilyes", 80).solde, bilanXpS(r0, "Ilyes").gagne], [19, 0, 59]);
  // Personne ne rassemble 40 XP S en moins de 4 journées : 3 × 13 = 39.
  assert.ok(3 * XP_S.journee < 40 && 4 * XP_S.journee >= 40);

  /* ------------------------------- 12 · La mission perso « MVP » ------------------------------- */
  {
    const mvp = MISSIONS_PERSO.find((m) => m.genre === "mvp")!;
    assert.equal(mvp.couvre, "mvp", "« Sois MVP d'un match » couvre le MVP");
    assert.ok(MISSIONS_PERSO.filter((m) => m.genre !== "mvp").every((m) => !m.couvre));
    // Si sa prime passait à 130 (rang S) : elle et le MVP Bola du même match donnent 10, pas 20.
    const v = matchBola("2026-10-25", "10:00", { mvp: true });
    const faite: MissionFaite = { genre: "mvp", matchId: v.m.id, jour: v.m.jour, heure: v.m.heure, libelle: v.libelle, semaine: semaineDe(v.m.jour), xp: 130, troisieme: false };
    const l = lignesXpSBola("Bolaman", [v], [faite], LOIN);
    assert.equal(totalXpS(l), 10, "mission MVP à 130 et MVP Bola : 10, pas 20");
    assert.deepEqual(l.map((x) => x.quoi), ["Mission MVP"]);
    // Telle qu'elle est (120, rang A) : le MVP seul.
    assert.equal(totalXpS(lignesXpSBola("Bolaman", [v], missionsPerso([v], LOIN).faites, LOIN)), 10);
  }

  // Les XP S d'une ligne du journal d'XP : là où l'écran met la pastille.
  {
    const ilyes = rb.journal.get("Ilyes")!.lignes;
    const parLigne = xpSParLigne(rb.journalS.get("Ilyes")!);
    const portees = ilyes.reduce((a, l) => a + (parLigne.get(rattachementXp(l) ?? "") ?? 0), 0);
    assert.equal(portees, total(rb.journalS, "Ilyes"), "chaque XP S d'Ilyes est portée par une ligne de son journal d'XP");
  }

  console.log(
    `xp-s-check : barème (J1 en SFL Time, Ilyes 59 en S0), sources, Flair (durs, sur soi, tribune, saison figée après la J2), titres faibles, Bola (13 par semaine), doublons, plafonds, révélation (19 h, 19 h 40, sans fin des matchs, J4 à minuit), XP inchangée, serveur = téléphone, solde — ok`
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
