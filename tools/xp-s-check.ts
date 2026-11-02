// Les XP S (lib/sfl/xp-s.ts, 02/11/2026) : la seconde monnaie, plus rare.
// Ce que le banc vérifie, sur la saison 0 du dépôt (seedSaison), la ligue du
// banc (tools/xp-s-donnees.ts : la saison 0 archivée, la démo d'Ilyes en
// cours, missions acceptées, Flair rempli sans réfléchir) et des cas écrits
// à la main :
//   1 · le barème : la J1 en SFL Time, Ilyes à 59 en saison 0 ;
//   2 · les sources : une mission S réussie 10, ratée 0, de rang A ou B 0 ;
//   3 · le Flair : « qui gagne », buteur et passeur d'un match 0, un dur 2,
//       le meilleur du jour 2, trois durs 4, un choix sur soi 0, la tribune
//       au même plafond ; le Flair de saison figé après la J2 (une journée
//       jouée sans équipes comptée), hors plafond ;
//   4 · les titres faibles (une voix) 0, à deux voix 5 ;
//   5 · Bola : deux matchs le même jour, MVP, Triplé et Triple caviar : 13
//       sur la semaine ; un match sans confirmation 0 ; la semaine de la
//       saisie de la feuille, pas du jour déclaré ; des matchs antidatés
//       saisis des mois après 0 ; sans heure de saisie 0 ;
//   6 · les doublons : une mission qui couvre le MVP, une même clé ;
//   7 · les plafonds : jamais plus de 13, la SFL Time retirée la dernière ;
//       un seul plafond par semaine pour un joueur qui a des matchs Bola (le
//       Flair d'un dimanche et un match Bola, un filleul entré le jour même) ;
//   8 · la révélation : 19 h, 19 h 40, sans fin des matchs, la J4 à minuit,
//       les XP S d'une journée suivent journeesComptees ;
//   9 · l'XP normale ne bouge pas d'un point (empreinte d'avant les XP S) ;
//   10 · le serveur et le téléphone : le même total ; la garde contre les
//       appels répétés (un calcul pour une rafale, neuf après 15 s ou une
//       révélation) ;
//   11 · le solde : gagné moins dépensé, jamais sous zéro ;
//   12 · la mission perso « MVP » couvre le MVP ;
//   13 · l'annonce (une fois, d'où elles viennent, le palier sur sa ligne,
//       jamais sur une cérémonie) et la pastille (le jeton lisible à la
//       taille du texte, l'insigne entier en grand, noir et blanc, le nombre
//       lu « 59 XP S »), posée là où l'écran l'attend : son bouton dans
//       l'en-tête du Passe, la colonne et les sources du journal, ses cumuls
//       par saison, le refus du serveur dans les Packs ; l'heure du calcul
//       qui suit la révélation.
//   npx tsx tools/xp-s-check.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { libelleMatch, type MatchValide } from "../src/lib/sfl/carte-bola";
import type { LigneComptee, MatchCompte } from "../src/lib/sfl/ligue-vierge";
import { bilanDe, type LigneXp } from "../src/lib/sfl/missions";
import { instantParis, MISSIONS_PERSO, missionsPerso, semaineDe, type MissionFaite } from "../src/lib/sfl/missions-perso";
import { flairSaisonTot, primeAu, pronosDeJournee, type Prono } from "../src/lib/sfl/pronos";
import { figer, journeesComptees } from "../src/lib/sfl/revelation";
import { saisonAvecVotes } from "../src/lib/sfl/saison-serveur.server";
import { computeJournees, deriveSeason } from "../src/lib/sfl/saisie/engine";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import type { JourneeMeta, MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { appliquerVotes, titresFaibles, type VoteFigure } from "../src/lib/sfl/votes";
import { journalComplet, journalCompletAvecS, type EntreesXp, type JournalXp } from "../src/lib/sfl/xp-calcul";
import { bilanServeurDe, CALCUL_RECENT_MS, xpServeur, xpServeurRecent } from "../src/lib/sfl/xp-serveur.server";
import {
  annonceXpS,
  bilanXpS,
  cumulsDuJournal,
  FEUILLE_BOLA_JOURS,
  journalXpS,
  lignesXpSBola,
  plafondCommun,
  plafonner,
  rattachementXp,
  semaineXpSBola,
  sourcesParLigne,
  totalXpS,
  XP_S,
  xpSParLigne,
  type JournalXpS,
  type LigneXpS,
} from "../src/lib/sfl/xp-s";
import { MontantXpS, PastilleS } from "../src/components/sfl/xp-s";
import { CompteurXp } from "../src/components/sfl/compteur-xp";
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
  // Le Flair de saison (la saison 0 du banc, close) : posé avant le premier coup d'envoi, juste : 10 ;
  // posé après le début de la troisième journée jouée : 0 ; sur soi : 0. La J2 de la saison 0 s'est
  // jouée sans équipes : elle compte (contrôle adverse du 02/11, le seuil glissait d'une journée).
  const fs = (n: string) => (rb.journalS.get(n) ?? []).filter((l) => l.source === "flair-saison");
  assert.deepEqual(fs("Kader").map((l) => l.xps), [10], "Kader : buteur (avant la J1) 10 ; Pépite d'Or posée après le coup d'envoi de la J3, la troisième journée jouée : 0");
  assert.deepEqual(fs("Smail").map((l) => l.xps), [10]);
  assert.deepEqual(fs("Ilies").map((l) => l.xps), [], "posé après le troisième coup d'envoi : 0");
  assert.deepEqual(fs("Ilyes").map((l) => l.xps), [], "sur soi : 0");
  // L'XP, elle, garde sa prime (primeAu ne voit que les journées avec équipes) : 220 pour la Pépite de Kader.
  assert.equal(rb.journal.get("Kader")!.lignes.find((l) => l.flairSaison?.sujet === "pepite")!.xp, 220, "la prime d'XP ne bouge pas");
  // Le seuil, journée par journée, sur la saison 0 (J1 avec équipes, J2 sans, J3 avec) :
  const ref0 = new Date("2026-08-31T12:00:00Z");
  const debut = (j: number) => pronosDeJournee(s0, 0, j, ref0)?.coupEnvoi ?? null;
  assert.equal(debut(2), null, "la J2 de la saison 0 n'a pas d'équipes");
  const j3 = debut(3)!.getTime();
  assert.ok(flairSaisonTot(s0, 0, new Date(j3 - 3600_000), ref0), "posé entre la J2 et la J3 : il compte (deux journées jouées)");
  assert.ok(!flairSaisonTot(s0, 0, new Date(j3 + 60_000), ref0), "posé après le coup d'envoi de la J3 : non (la J2 sans équipes compte)");
  assert.equal(primeAu(s0, 0, new Date(j3 + 60_000), ref0), 220, "alors que la prime d'XP ne compte que deux coups d'envoi");
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
/** Un match Bola validé ; sa feuille saisie deux heures après le coup d'envoi (saisiLe), sauf indication. */
function matchBola(
  jour: string,
  heure: string,
  moi: { buts?: number; passes?: number; mvp?: boolean },
  requise = true,
  saisiLe: string | null = new Date(instantParis(jour, heure).getTime() + 2 * 3600_000).toISOString()
): MatchValide {
  const l: LigneComptee = { id: "u-bola", name: "Bolaman", equipe: "clairs", buts: moi.buts ?? 0, passes: moi.passes ?? 0, mvp: !!moi.mvp, classe: true, points: 0, resultat: "V" };
  const m: MatchCompte = { id: ++idMatch, jour, heure, genre: "match", scoreClairs: 3, scoreFonces: 1, joueurs: [l], etat: "compte", requise, valide: true, mvps: moi.mvp ? ["u-bola"] : [], ...(saisiLe ? { saisiLe } : {}) };
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
  for (const l of j.get("Bolaman")!) assert.ok(semaineDe(l.jour!) === "2026-10-19" && l.semaine === "2026-10-19");
  // Par le calcul complet (le journal d'XP Bola, xp-calcul.ts) : le même résultat.
  assert.equal(total(xpsDe({ jugee: s0, bolaCarte: { nom: "Bolaman", valides } as never }), "Bolaman"), 13);
}
{
  // Contrôle adverse du 02/11 : des matchs antidatés, un par semaine de l'été, montés le même jour
  // (huit comptes d'accord, la feuille saisie aussitôt) : 78 XP S d'un coup avant. La semaine du
  // plafond est celle de la saisie (l'heure du serveur), et une feuille saisie plus de sept jours
  // après son match ne donne rien : 0.
  const saisi = "2026-11-02T10:00:00.000Z";
  const ete = ["2026-07-05", "2026-07-12", "2026-07-19", "2026-07-26", "2026-08-02", "2026-08-09"].map((d) => matchBola(d, "10:00", { buts: 3, passes: 3, mvp: true }, true, saisi));
  const bolaDe = (valides: MatchValide[], t = LOIN) => journalXpS({ jugee: s0, bolaCarte: { nom: "Bolaman", valides }, maintenant: t }, new Map());
  assert.equal(total(bolaDe(ete), "Bolaman"), 0, "six matchs antidatés de l'été, saisis le 2 novembre : 0 (78 avant)");
  // Antidatés de moins d'une semaine (le 25 et le 27 octobre, deux semaines), saisis le même jour : un seul plafond, celui de la semaine de la saisie.
  const proches = [matchBola("2026-10-25", "10:00", { buts: 3, mvp: true }, true, "2026-10-27T18:00:00Z"), matchBola("2026-10-27", "10:00", { passes: 3, mvp: true }, true, "2026-10-27T18:00:00Z")];
  const p = bolaDe(proches);
  assert.equal(total(p, "Bolaman"), 13, "deux semaines déclarées, saisies le même jour : 13, pas 26");
  assert.ok(p.get("Bolaman")!.every((l) => l.semaine === "2026-10-26"), "la semaine de la saisie");
  assert.equal(p.get("Bolaman")!.find((l) => l.match === proches[0].m.id)!.le, "2026-10-27T18:00:00.000Z", "elles tombent à la saisie, pas au coup d'envoi déclaré");
  // Sans heure de saisie (une base où match_bola_json ne la rend pas encore) : rien.
  assert.equal(total(bolaDe([matchBola("2026-10-25", "10:00", { buts: 3, mvp: true }, true, null)]), "Bolaman"), 0, "sans saisiLe : 0");
  // La fenêtre de l'app (sept jours, listerMesDerniers) : saisie le septième jour, elle compte ; le huitième, non.
  assert.equal(semaineXpSBola({ jour: "2026-10-25", saisiLe: "2026-11-01T20:00:00Z" }), "2026-10-26");
  assert.equal(semaineXpSBola({ jour: "2026-10-25", saisiLe: "2026-11-02T10:00:00Z" }), null);
  // Le dimanche soir saisi le lundi : la semaine du lundi ; saisie le jour même : sa semaine.
  assert.equal(semaineXpSBola({ jour: "2026-10-25", saisiLe: "2026-10-26T08:00:00Z" }), "2026-10-26");
  assert.equal(semaineXpSBola({ jour: "2026-10-25", saisiLe: "2026-10-25T21:00:00Z" }), "2026-10-19");
  assert.equal(FEUILLE_BOLA_JOURS, 7);
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
      const k = l.source === "bola" ? `w${l.semaine}` : `${l.saison}|${l.j}`;
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
  // Un joueur qui a des matchs Bola : un seul plafond par semaine, ses journées de la SFL et ses matchs
  // Bola ensemble (contrôle adverse du 02/11 : 17 puis 26 dans un seul dimanche).
  {
    // Hors de la SFL, il remplit le Flair de la J3 (trois durs justes) et joue un match Bola le même dimanche (MVP et Triplé).
    const s1: Saison = { numero: 1, journees: [meta(3, "25 oct.", { mvpAuto: false })], roster: [{ name: "Cid", poste: null, profil: "Actif", base: null }], entries: [ligne(3, "Cid", { buts: 1 })], convocations: [] };
    const v = matchBola("2026-10-25", "10:00", { buts: 3, mvp: true });
    const flairJ3: LigneXp = { saison: 1, j: 3, date: "25 oct.", quoi: "Flair, 3 sur 5", xp: 60, flairDurs: 3 };
    const zed = journalXpS({ jugee: s1, bolaCarte: { nom: "Bolaman", valides: [v] }, maintenant: LOIN }, journalDe({ Bolaman: [flairJ3] })).get("Bolaman")!;
    assert.equal(totalXpS(zed), 13, "Flair 4 et Bola 13 le même dimanche : 13, pas 17");
    assert.deepEqual(zed.map((l) => [l.source, l.quoi, l.xps]), [["bola", "MVP", 10], ["bola", "Mission Triplé", 3]], "le Flair part d'abord, puis la mission");
    // Un filleul qui entre en SFL le jour même : son match Bola de 10 h, puis la journée (SFL Time et MVP) : 13, pas 26.
    const s2: Saison = {
      numero: 1,
      journees: [meta(1, "25 oct.", { sflTime: true, mvpAuto: false })],
      roster: ["Ana", "Bea"].map((name) => ({ name, poste: null, profil: "Actif", base: null })),
      entries: [ligne(1, "Ana", { sflTime: true, mvp: true, buts: 2 }), ligne(1, "Bea", { sflTime: true, result: "Défaite" })],
      convocations: [],
    };
    const r2 = journalXpS({ jugee: s2, bolaCarte: { nom: "Ana", valides: [matchBola("2026-10-25", "10:00", { buts: 3, mvp: true })] }, maintenant: LOIN }, new Map());
    const ana = r2.get("Ana")!;
    assert.equal(totalXpS(ana), 13, "le filleul entré le jour même : 13, pas 26");
    assert.deepEqual(ana.filter((l) => l.source === "sfl-time").map((l) => l.xps), [10], "sa SFL Time reste entière, retirée la dernière");
    assert.equal(total(r2, "Bea"), 10, "les autres joueurs de la journée n'y sont pour rien");
    // Le même par le calcul complet (le journal d'XP Bola en plus) : 13.
    assert.equal(total(xpsDe({ jugee: s2, bolaCarte: { nom: "Ana", valides: [matchBola("2026-10-25", "10:00", { buts: 3, mvp: true })] } as never }), "Ana"), 13);
    // Une semaine sans match Bola garde le plafond de sa journée : le match Bola de la semaine d'après n'y touche pas.
    const r3 = journalXpS({ jugee: s2, bolaCarte: { nom: "Ana", valides: [matchBola("2026-10-28", "19:00", { buts: 3, mvp: true })] }, maintenant: LOIN }, new Map());
    assert.equal(total(r3, "Ana"), 26, "deux semaines : 13 et 13");
    // plafondCommun seul : les lignes d'une autre semaine passent telles quelles.
    const L = (source: LigneXpS["source"], xps: number, cle: string, extra: Partial<LigneXpS> = {}): LigneXpS => ({ saison: 1, j: 1, date: "", quoi: cle, xps, source, cle, rattache: cle, ...extra });
    const commun = plafondCommun([L("titre", 10, "t", { titre: "mvp" }), L("titre", 10, "u", { j: 2, titre: "mvp" })], [L("bola", 10, "b", { titre: "mvp", semaine: "W1" })], (l) => (l.j === 1 ? "W1" : "W2"));
    assert.deepEqual(commun.map((l) => [l.cle, l.xps]), [["u", 10], ["t", 10], ["b", 3]]);
  }
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
function base(doc: Saison, tables: Record<string, Record<string, unknown>[]>, lectures = { saison: 0 }): SupabaseClient {
  const lignes = (table: string): Record<string, unknown>[] => (table === "saison" ? [{ id: 1, data: doc, updated_at: "2026-11-08T14:10:00Z" }] : (tables[table] ?? []));
  const requete = (table: string) => {
    if (table === "saison") lectures.saison++;
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

  {
    // La garde contre les appels répétés (xpServeurRecent) : un seul calcul pour des appels simultanés
    // et pour la rafale qui suit ; un nouveau après 15 s, ou dès qu'une révélation est passée.
    const publiee = saisonR({ fin: hiver("2026-11-08 17:40").toISOString() });
    const lectures = { saison: 0 };
    const sb = base(publiee, { profiles: [{ id: "g-1", name: "Ana" }] }, lectures);
    const qui = { id: "g-1", nom: "Ana", jeton: "" };
    const t0 = hiver("2026-11-08 19:00");
    const [a, b] = await Promise.all([xpServeurRecent(sb, qui, t0), xpServeurRecent(sb, qui, t0)]);
    assert.equal(a, b, "deux appels simultanés : le même calcul");
    assert.equal(lectures.saison, 1, "une seule lecture de la ligue");
    await xpServeurRecent(sb, qui, new Date(t0.getTime() + 5_000));
    assert.equal(lectures.saison, 1, "rappelé 5 s plus tard : le calcul d'avant");
    await xpServeurRecent(sb, { ...qui, id: "g-2", nom: "Bea" }, new Date(t0.getTime() + 5_000));
    assert.equal(lectures.saison, 2, "un autre joueur : son propre calcul");
    await xpServeurRecent(sb, qui, new Date(t0.getTime() + CALCUL_RECENT_MS));
    assert.equal(lectures.saison, 3, "15 s plus tard : un calcul neuf");
    // 19 h 39 puis 19 h 41 : la révélation de 19 h 40 est passée entre les deux, le calcul gardé ne sert plus.
    const avant = await xpServeurRecent(sb, qui, hiver("2026-11-08 19:39"));
    assert.equal(bilanServeurDe(avant, "Ana", hiver("2026-11-08 19:39")).xpS, 10, "à 19 h 39 : le MVP de la J4 seul");
    const n = lectures.saison;
    const apres = await xpServeurRecent(sb, qui, new Date(hiver("2026-11-08 19:40").getTime() + 1_000));
    assert.equal(lectures.saison, n + 1, "la révélation passée : un calcul neuf");
    assert.equal(bilanServeurDe(apres, "Ana", hiver("2026-11-08 19:40")).xpS, 23, "et les XP S de la J5 y sont (10 + 13)");
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

  /* ------------------------------- 13 · L'annonce et la pastille ------------------------------- */
  {
    const ICI = hiver("2026-11-08 19:00");
    const L = (cle: string, source: LigneXpS["source"], quoi: string, xps: number, titre?: LigneXpS["titre"], le = ICI): LigneXpS => ({
      saison: 1, j: 5, date: "8 nov.", quoi, xps, source, cle, rattache: cle, le: le.toISOString(), ...(titre ? { titre } : {}),
    });
    const avant = [L("sfl-time:1:4:Ana", "sfl-time", "SFL Time", 10, undefined, hiver("2026-11-02 00:00"))];
    const premier = annonceXpS("Ana", avant, null, ICI);
    assert.equal(premier.annonce, null, "la première fois : rien, le stock se lit sur la tuile");
    const apres = [...avant, L("flair:1:5:Ana", "flair", "Flair", 4), L("titre:mvp:1:5:Ana", "titre", "MVP", 9, "mvp")];
    const r = annonceXpS("Ana", apres, premier.vu, ICI);
    assert.deepEqual(r.annonce, { plus: 13, sources: ["MVP", "Flair"] }, "+13 : MVP · Flair (les lignes neuves seules)");
    assert.equal(annonceXpS("Ana", apres, r.vu, ICI).annonce, null, "une seule fois");
    assert.equal(annonceXpS("Ana", avant, r.vu, ICI).annonce, null, "une feuille corrigée qui retire : rien");
    assert.equal(annonceXpS("Ana", apres, annonceXpS("Ana", avant, r.vu, ICI).vu, ICI).annonce, null, "ni quand elle rend ce qu'on avait déjà vu");
    assert.equal(annonceXpS("Bea", apres, r.vu, ICI).annonce, null, "un autre joueur sur ce téléphone : il repart de zéro");
    // Une vieille ligne qui arrive en retard (les réponses aux missions chargées après coup) : pas d'annonce, mais vue.
    const tard = annonceXpS("Ana", [...apres, L("mission:1:2:contrat:Ana", "mission", "Mission Verrou", 10, undefined, hiver("2026-10-19 00:00"))], r.vu, ICI);
    assert.equal(tard.annonce, null, "une mission d'il y a trois semaines : rien");
    assert.ok(tard.vu.cles.includes("mission:1:2:contrat:Ana"));
    const bola = annonceXpS("Ana", [...apres, { ...L("bola:mvp:7:Ana", "bola", "MVP", 10, "mvp"), source: "bola" }], r.vu, ICI);
    assert.deepEqual(bola.annonce, { plus: 10, sources: ["MVP"] });
    // Chaque ligne du calcul porte l'instant où elle est tombée : la révélation de sa journée.
    const pub = saisonR({ fin: hiver("2026-11-08 17:40").toISOString() });
    const rev = xpsDe({ jugee: vueServeur(pub, hiver("2026-11-08 20:00")), maintenant: hiver("2026-11-08 20:00") }).get("Ana")!;
    assert.equal(rev.find((l) => l.j === 5)!.le, hiver("2026-11-08 19:40").toISOString(), "la J5 : 19 h 40");
    assert.equal(rev.find((l) => l.j === 4)!.le, hiver("2026-11-02 00:00").toISOString(), "la J4 : minuit");
    assert.equal(
      (rb.journalS.get("Kader") ?? []).find((l) => l.source === "flair-saison")!.le,
      "2026-08-31T12:00:00.000Z",
      "un Flair de saison : la clôture de sa saison"
    );

    // La pastille, au fil du texte : le jeton (la balle agrandie, le S évidé), de la couleur du texte ;
    // aucune couleur à elle, ni or ni rang (le masque n'est que du noir et du blanc de découpe).
    const sansMasque = (h: string) => h.replace(/<mask[\s\S]*?<\/mask>/g, "");
    const pastille = renderToStaticMarkup(createElement(PastilleS));
    assert.ok(pastille.startsWith("<svg") && pastille.includes('aria-hidden="true"'), "décorative");
    assert.ok(pastille.includes(">S</text>"), "la lettre S");
    assert.match(pastille, /<mask id="(pastille-s[a-zA-Z0-9]+)">[\s\S]*<\/mask><circle[^>]*fill="currentColor"[^>]*mask="url\(#\1\)"/, "le S évidé dans le disque : il se lit à 12 px");
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|gold|var\(--r-/i.test(pastille), "noir et blanc : aucune couleur à elle (ni or ni couleur de rang)");
    assert.deepEqual([...sansMasque(pastille).matchAll(/(fill|stroke)="([^"]*)"/g)].map((x) => x[2]), ["currentColor"], "la couleur du texte, seulement");
    assert.match(pastille, /font-size:76/, "un S de 76 % de la pastille (le S logé dans la balle en faisait 20 %)");
    // En grand (le prix d'un pack) : l'insigne entier, le symbole Bola et la lettre dans la balle.
    const lune = renderToStaticMarkup(createElement(PastilleS, { lune: true }));
    assert.ok(lune.includes(">S</text>") && !lune.includes("<mask"));
    assert.deepEqual([...lune.matchAll(/(fill|stroke)="([^"]*)"/g)].map((x) => x[2]), ["currentColor", "currentColor"]);
    // Deux pastilles sur une page : deux masques, deux identifiants.
    const deux = renderToStaticMarkup(createElement("div", null, createElement(PastilleS), createElement(PastilleS)));
    const ids = [...deux.matchAll(/<mask id="([^"]+)"/g)].map((x) => x[1]);
    assert.equal(new Set(ids).size, 2, "un masque par pastille");
    // Les espaces insécables de « 59 XP S » (xpSFr), lus comme des espaces.
    const sp = (h: string) => h.replace(/\u00a0|&nbsp;/g, " ");
    const m = sp(renderToStaticMarkup(createElement(MontantXpS, { n: 59 })));
    assert.match(m, /aria-label="59 XP S"/, "le lecteur d'écran lit « 59 XP S »");
    assert.match(m.replace(/<svg[\s\S]*?<\/svg>/, ""), />59</);
    const manque = sp(renderToStaticMarkup(createElement(MontantXpS, { n: 35, sur: 40 })));
    assert.match(manque, /aria-label="35 XP S sur 40"/);
    assert.match(manque.replace(/<svg[\s\S]*?<\/svg>/, ""), />35 \/ 40</, "« ▣S 35 / 40 »");
    // Le compteur du Passe : la ligne d'XP et la barre seules (la pastille au bout de la barre se lisait comme son curseur).
    const b = { total: 1630, niveau: 6, dansLeNiveau: 130, pourLeSuivant: 600 };
    const compteur = sp(renderToStaticMarkup(createElement(CompteurXp, { b })));
    assert.ok(!/XP S|<svg|<button/.test(compteur), "le compteur ne porte plus les XP S");

    // Le journal : d'où viennent les XP S d'un « Dimanche joué » ; au-delà de 20 lignes, un cumul par saison.
    {
      const ilyesS = rb.journalS.get("Ilyes")!;
      const sources = sourcesParLigne(ilyesS);
      const jx = rb.journal.get("Ilyes")!.lignes;
      const dimanche = jx.find((l) => l.quoi === "Dimanche joué" && sources.has(rattachementXp(l) ?? ""))!;
      const desS = ilyesS.filter((l) => l.rattache === rattachementXp(dimanche));
      assert.ok(desS.length > 0 && desS.every((l) => l.source === "titre" || l.source === "sfl-time"));
      assert.equal(sources.get(rattachementXp(dimanche)!), [...new Set(desS.map((l) => (l.source === "sfl-time" ? "SFL Time" : l.quoi)))].join(" · "), "« Dimanche joué · SFL Time · MVP »");
      assert.ok(![...sources.keys()].some((k) => k.startsWith("mission:") || k.startsWith("flair")), "une mission, un Flair se nomment déjà");
      const L = (cle: string, source: LigneXpS["source"], quoi: string, titre?: LigneXpS["titre"]): LigneXpS => ({ saison: 1, j: 5, date: "", quoi, xps: 5, source, cle, rattache: "dimanche:1:5", ...(titre ? { titre } : {}) });
      assert.equal(sourcesParLigne([L("a", "titre", "Défensive", "def"), L("b", "sfl-time", "SFL Time"), L("c", "titre", "MVP", "mvp")]).get("dimanche:1:5"), "SFL Time · MVP · Défensive", "dans l'ordre : SFL Time, MVP, Impact, Défensive");
      // Les lignes de la saison 0 au-delà des 20 : leurs XP S se retrouvent dans le cumul (rien ne se perd).
      const bil = bilanDe(rb.journal, "Ilyes", MAINTENANT);
      const parLigne = xpSParLigne(ilyesS);
      const cumuls = cumulsDuJournal(bil.lignes, 20, parLigne);
      const vues = bil.lignes.slice(0, 20).reduce((a, l) => a + (parLigne.get(rattachementXp(l) ?? "") ?? 0), 0);
      assert.equal(vues + cumuls.reduce((a, c) => a + c.xps, 0), total(rb.journalS, "Ilyes"), "les XP S montrées et cumulées font le total");
      assert.equal(bil.lignes.slice(0, 20).reduce((a, l) => a + l.xp, 0) + cumuls.reduce((a, c) => a + c.xp, 0), bil.lignes.reduce((a, l) => a + l.xp, 0), "l'XP aussi");
      assert.ok(cumuls.some((c) => c.saison === 0 && c.xps > 0), "la saison 0 a son cumul, son stock d'XP S compris");
      assert.deepEqual(cumulsDuJournal(bil.lignes, bil.lignes.length, parLigne), [], "tout montré : aucun cumul");
    }

    // Où l'écran les pose : Ma carte (la tuile et l'annonce), le Passe (son bouton), le journal, les Packs.
    const lire = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
    const tuile = lire("components/sfl/ma-carte/rubriques.tsx");
    assert.match(tuile, /useSoldeXpS\(player\.name\)/, "Ma carte : les XP S qui restent");
    assert.match(tuile, /<MontantXpS n=\{soldeS\} \/>/, "« 1 630 XP · ▣S 59 »");
    assert.ok(!/à dépenser/.test(tuile.replace(/\/\/.*$|\{\/\*[\s\S]*?\*\/\}/gm, "")), "plus de « à dépenser » en XP normales");
    assert.match(tuile, /annonceXpS\(nom, lignes, vu, new Date\(maintenantMs\(\)\)\)/, "l'annonce à la révélation, ses 48 h à l'heure du serveur");
    assert.match(tuile, /const lignes = s\?\.complet \? s\.lignes : null;/, "seulement sur un calcul complet");
    assert.match(tuile, /\{p && <span>\{`Passe Bola · Palier \$\{n\} · \$\{p\.nom\}`\}<\/span>\}/, "le palier sur sa propre ligne, avec « Passe Bola »");
    assert.match(tuile, /if \(ceremonie\) return;[\s\S]*if \(ceremonieOuverte\(\)\) return;/, "rien par-dessus une cérémonie ouverte (Nouvelle carte)");
    assert.match(lire("components/sfl/nouvelle-carte.tsx"), /poserCeremonie\(ouverte\)/, "la cérémonie se signale");
    const passe = lire("components/sfl/mode-passe.tsx");
    assert.match(passe, /className="mp-solde"\s+aria-label=\{`Packs, \$\{libelleXpS\(soldeS\)\}`\}/, "l'en-tête du Passe : un bouton à lui, vers les Packs");
    assert.match(lire("components/sfl/mode-passe.css"), /button\.mp-solde::before \{\s*content: "";\s*position: absolute;\s*inset: -6px -4px;/, "44 px au doigt (32 + 2 × 6)");
    const journal = lire("components/sfl/mode-passe-missions.tsx");
    assert.match(journal, /<span className="flex w-\[46px\] shrink-0 justify-end">/, "une colonne d'XP S de largeur fixe");
    assert.match(journal, /cumulsDuJournal\(b\.lignes, LIGNES_JOURNAL, xpS\)/);
    const packs = lire("components/sfl/mode-passe-packs.tsx");
    assert.match(packs, /setRefus\([^;]*\);\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*void rafraichirAchatsXp\(nom\);/, "refusé : les achats se relisent");
    assert.match(packs, /\{refus && typeof refus !== "string" \? \([\s\S]*?<MontantXpS n=\{refus\.solde\} sur=\{PACK_AFRIQUE\.prix\} \/>[\s\S]*?\) : \(\s*solde != null && <ApresAchat/, "refusé, le solde du serveur à la place de celui du téléphone");
    assert.match(packs, /etat\.t !== "manque" && <MontantXpS n=\{solde\}/, "le solde ne se répète pas sous le bouton éteint");
    // L'heure du calcul suit la vue de la ligue (la révélation) : la journée et ses XP S arrivent ensemble.
    assert.match(lire("hooks/use-missions.ts"), /const maintenant = useMemo\(\(\) => \{\s*void revelation;/, "l'XP se recalcule à la révélation, pas au tic suivant");
  }

  console.log(
    `xp-s-check : barème (J1 en SFL Time, Ilyes 59 en S0), sources, Flair (durs, sur soi, tribune, saison figée après la J2), titres faibles, Bola (13 par semaine de saisie, antidatés 0), doublons, plafonds (commun pour un joueur Bola), révélation (19 h, 19 h 40, sans fin des matchs, J4 à minuit), XP inchangée, serveur = téléphone, solde, annonce, pastille, journal et Packs — ok`
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
