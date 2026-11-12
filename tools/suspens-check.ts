// La journée en suspens (saisie/suspens.ts, 12/11/2026) : visible, elle ne
// compte nulle part, « à rattraper », jusqu'à « Reprendre ».
//
// La saison du banc : celle du dépôt (seedSaison), mise en saison 1 avec ses
// quatre premières journées, puis une J5 de la même forme que celle de la
// ligue (le 8 nov., deux matchs, 21 présents, SFL Time, MVP calculé,
// publiée). Trois variantes : (a) la J5 vide, comme aujourd'hui ; (b) la
// mi-temps du Match 1 saisie (Noirs 1 2-1, une passe, un retard) ; (c) les
// deux matchs finis (sans suspens, elle compterait dès minuit : c'est elle
// qui prouve que la règle retire quelque chose). Aucune donnée tirée de la
// base.
//
// Ce que le banc garde, la liste fermée des branchements (conception.md §4) :
//   1 · la règle, à 12:40, 19:30, le lendemain et sept jours plus tard :
//       journeeComptee faux, figer pose la J5 (figee.enSuspens, pas caches) ;
//       les classements, les cartes, les divisions (`pour` = 6), le journal
//       d'XP (une félicitation J5 ignorée), les XP S, le Flair, les missions
//       et les défis ÉGAUX à ceux du même document sans les résultats de la
//       J5 ; pas de titres, de vote, de fin du vote, de révélation attendue ;
//       l'état « a-rattraper » (etatRevelation, etatJournee, gesteDuMoment) ;
//       ni transition, ni fin des matchs tenue ; la feuille gelée
//       (droitDePrendre « suspens ») ; rien à annoncer ; la clôture et le
//       brouillon refusés ; le carton du retard gardé (D3) sans le −1 ;
//       les libellés « à rattraper » ; la journée n'est ni ouverte d'office
//       ni la prochaine (prochaineJournee, prochaineAJouer, outsider) ;
//       missions et Flair en phase « a-rattraper » ;
//   2 · l'aller-retour : suspendre puis reprendre rend le document d'origine
//       plus `reprise`, et tous les calculs d'avant ; les refus ; le motif ;
//       la reprise à la même date passée (compte aussitôt), incomplète
//       (bloquée), à une autre date (en ligne) ;
//   3 · la rétrocompatibilité : absent, null, false ;
//   4 · I13 : « Écraser » depuis une copie d'avant la suspension bloque ;
//   5 · le rattrapage après la J6 (contrôle du 12/11) : la journée du moment
//       se choisit par date (missions, pronos, arbitres, journeeDuMoment),
//       les divisions se rejouent dans l'ordre du calendrier (le dernier
//       bilan est celui du rattrapage, ceux de la J6 et de la J7 ne bougent
//       pas), « Ma carte » ne compte pas la journée en suspens comme à jouer,
//       l'arbitre lit « a-rattraper » ; la reprise garde la date d'origine ;
//       le chapitre d'avant de l'outsider saute la journée en suspens ;
//       prochaineAJouer sur le document brut.
// Les garde-fous statiques (anti-contournement) sont dans
// tools/suspens-garde-check.ts ; la règle en base, tools/sql/suspens-check.sql.
//   npx tsx tools/suspens-check.ts
import assert from "node:assert/strict";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import { deriveSeason, evolutionDe } from "../src/lib/sfl/saisie/engine";
import {
  estEnSuspens,
  journeesEnSuspens,
  libelleSuspens,
  MOTIF_MAX,
  journeeDuMoment,
  premiereAVenir,
  prochaineAJouer,
  rattrapeeAilleurs,
  reprendreJournee,
  resteUneJourneeEnSuspens,
  suspendreJournee,
  EN_SUSPENS,
} from "../src/lib/sfl/saisie/suspens";
import {
  etatRevelation,
  figer,
  finDuVote,
  journeeComptee,
  journeesComptees,
  libelleFinDuVote,
  libelleRevelation,
  prochaineTransition,
  revelation,
  revelationAttendue,
  tenirFinDesMatchs,
  titresTombes,
  verdictDeJournee,
  voteOuvertA,
} from "../src/lib/sfl/revelation";
import { etatJournee, gesteDuMoment, prochaineJournee } from "../src/lib/sfl/saisie/etat-journee";
import { dernierBilan, etatDivisions } from "../src/lib/sfl/divisions";
import { droitDePrendre, MOTS_DU_REFUS } from "../src/lib/sfl/feuille-direct";
import { publicationAnnoncable } from "../src/lib/sfl/annonce-publication";
import { cloturerSaison, updateJournee } from "../src/lib/sfl/saisie/mutations";
import { remettreEnBrouillon, raisonDeGarder } from "../src/lib/sfl/saisie/brouillon";
import { cartonsDeLaSaison } from "../src/lib/sfl/cartons";
import { journalCompletAvecS, type EntreesXp } from "../src/lib/sfl/xp-calcul";
import { dimancheEnCours, JAMAIS, missionsDeJournee, type FelicitationXp, type Reponse } from "../src/lib/sfl/missions";
import { flairsDuJoueur, journeeDesPronos, pronosDeJournee, type Prono } from "../src/lib/sfl/pronos";
import { arcOutsider, dimancheAAnnoncer } from "../src/lib/sfl/outsiders";
import { journeeEnCours, journeesArbitre, phaseArbitre } from "../src/lib/sfl/missions-arbitre";
import { ordreDuCalendrier } from "../src/lib/sfl/convocation-temps";
import { bloquantsEcriture, nouveauxEcarts } from "../src/lib/sfl/saisie/integrite";
import { isHidden, neJouePas } from "../src/lib/sfl/hidden";
import type { JourneeMeta, MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

/* ------------------------------ La saison ------------------------------ */

const seed = seedSaison();
const DATES = ["11 oct.", "18 oct.", "25 oct.", "1 nov."];
const noms = seed.roster.map((r) => r.name).filter((n) => !isHidden(n) && !neJouePas(n));
const presents = noms.slice(0, 21);
const EQUIPES = ["Noirs 1", "Blancs 1", "Noirs 2", "Blancs 2"] as const;
const equipeDe = (i: number) => (i < 6 ? EQUIPES[0] : i < 11 ? EQUIPES[1] : i < 16 ? EQUIPES[2] : EQUIPES[3]);
const ligneJ5 = (nom: string, i: number): MatchEntry => ({
  j: 5,
  player: nom,
  team: equipeDe(i),
  statut: "Présent",
  result: null,
  sflTime: true,
  buts: 0,
  passes: 0,
  cleanSheet: false,
  mvp: false,
  impact: false,
  def: false,
  retard: false,
});
const metaJ5: JourneeMeta = {
  j: 5,
  date: "8 nov.",
  heure: "12h30",
  sflTime: true,
  mvpAuto: true,
  publiee: { le: "2026-11-07T15:10:00.000Z", par: "Ilyes" },
  matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }, { equipes: ["Noirs 2", "Blancs 2"] }],
};
/** (a) La J5 vide, comme aujourd'hui. */
const vide: Saison = {
  ...seed,
  numero: 1,
  journees: [...seed.journees.filter((m) => m.j <= 4).map((m) => ({ ...m, date: DATES[m.j - 1] })), metaJ5],
  entries: [...seed.entries.filter((e) => e.j <= 4), ...presents.map(ligneJ5)],
  convocations: [],
};
/** (b) La mi-temps du Match 1 : Noirs 1 2-1, deux buts et une passe des Noirs, un but des Blancs, un retard. */
const N1 = presents.filter((_, i) => equipeDe(i) === "Noirs 1");
const B1 = presents.filter((_, i) => equipeDe(i) === "Blancs 1");
const miTemps: Saison = {
  ...vide,
  entries: vide.entries.map((e) => {
    if (e.j !== 5) return e;
    if (e.team === "Noirs 1") return { ...e, result: "Victoire" as const, buts: e.player === N1[0] ? 2 : 0, passes: e.player === N1[1] ? 1 : 0, retard: e.player === N1[2] };
    if (e.team === "Blancs 1") return { ...e, result: "Défaite" as const, buts: e.player === B1[0] ? 1 : 0 };
    return e;
  }),
};
/** (c) Les deux matchs finis. */
const finie: Saison = {
  ...miTemps,
  entries: miTemps.entries.map((e) => (e.j === 5 && (e.team === "Noirs 2" || e.team === "Blancs 2") ? { ...e, result: "Nul" as const } : e)),
};

const SUSPENS = { par: "Ilyes", le: "2026-11-08T13:05:00.000Z", motif: "  Travaux   sur les terrains " };
function suspendue(s: Saison): Saison {
  const r = suspendreJournee(s, 5, SUSPENS);
  assert.ok("saison" in r, "suspendre la J5");
  return r.saison;
}
/** Le même document, la J5 sans ses résultats (feuille posée) et sans suspens : ce que la ligue doit voir. */
const sansResultats = (s: Saison): Saison => ({
  ...s,
  entries: s.entries.map((e) => (e.j === 5 ? ligneJ5(e.player, presents.indexOf(e.player)) : e)),
});

/* ------------------------------ Les heures ------------------------------ */

const T = {
  "12:40": new Date("2026-11-08T11:40:00Z"),
  "19:30": new Date("2026-11-08T18:30:00Z"),
  lendemain: new Date("2026-11-09T12:00:00Z"),
  "+7 jours": new Date("2026-11-15T12:00:00Z"),
};

/* --------------------- Les entrées du journal d'XP --------------------- */

const reponses: Reponse[] = [
  ...[4, 5].flatMap((j) => presents.slice(0, 6).map((joueur) => ({ saison: 1, j, mission: "defi" as const, joueur, reponse: "acceptee" as const, cible: null, le: j === 5 ? "2026-11-08T09:00:00.000Z" : "2026-11-01T09:00:00.000Z" }))),
];
const pronosJ5: Prono[] = [
  { saison: 1, j: 5, sujet: "match:0", joueur: presents[0], choix: "noirs", le: "2026-11-08T09:00:00.000Z" },
  { saison: 1, j: 5, sujet: "match:1", joueur: presents[0], choix: "nul", le: "2026-11-08T09:00:00.000Z" },
  { saison: 1, j: 5, sujet: "match:0", joueur: presents[7], choix: "blancs", le: "2026-11-08T09:00:00.000Z" },
];
const felicitationJ5: FelicitationXp = { de: presents[3], a: N1[0], exploit: `1-5-buts-${N1[0]}`, saison: 1, j: 5 };
const entrees = (jugee: Saison, maintenant: Date, felicitations: FelicitationXp[]): EntreesXp => ({
  jugee,
  reponses,
  votes: [],
  felicitations,
  pronos: pronosJ5,
  ligueRecrues: [],
  moi: null,
  bolaCarte: null,
  maintenant,
});
/** Le journal d'XP et celui des XP S, en valeurs comparables. */
function journaux(jugee: Saison, t: Date, felicitations: FelicitationXp[]) {
  const { journal, journalS } = journalCompletAvecS(entrees(jugee, t, felicitations));
  return { journal: [...journal].sort(([a], [b]) => a.localeCompare(b)), journalS: JSON.parse(JSON.stringify(journalS, (_k, v) => (v instanceof Map ? [...v] : v))) };
}

/** Tout ce que la ligue lit de la saison à l'instant t, en valeurs comparables (sauf `pour` des divisions). */
function lecture(doc: Saison, t: Date, felicitations: FelicitationXp[]) {
  const vue = figer(doc, t);
  const d = deriveSeason(vue);
  const div = etatDivisions(vue);
  return {
    joueurs: d.players,
    journees: d.journees.map((x) => ({ j: x.j, matches: x.matches?.map((m) => [m.teamA.score, m.teamB.score]) })),
    evolution: evolutionDe(vue),
    divisions: div && { phase: div.phase, actuelle: [...div.actuelle], journees: div.journees },
    comptees: [...journeesComptees(doc, t)],
    ...journaux(vue, t, felicitations),
    flair: flairsDuJoueur(vue, 1, false, pronosJ5, presents[0], t, t).map((f) => ({ j: f.j, xp: f.xp, justes: f.justes, juges: f.juges })),
  };
}

/* ------------------------------ 1 · La règle ------------------------------ */

for (const [nomVariante, v] of [["vide", vide], ["mi-temps", miTemps], ["finie", finie]] as const) {
  const doc = suspendue(v);
  const meta = doc.journees.find((m) => m.j === 5)!;
  assert.ok(estEnSuspens(meta));
  assert.deepEqual(meta.suspens, { depuis: SUSPENS.le, par: "Ilyes", date: "8 nov.", motif: "Travaux sur les terrains" }, "le motif rogné");
  for (const [h, t] of Object.entries(T)) {
    const ou = `${nomVariante} · ${h}`;
    assert.equal(journeeComptee(doc, 5, t), false, `${ou} : la J5 ne compte pas`);
    const vue = figer(doc, t);
    if (nomVariante === "vide") assert.equal(vue, doc, `${ou} : rien à figer, même référence`);
    else {
      assert.deepEqual(vue.figee?.enSuspens, [5], `${ou} : figee.enSuspens`);
      assert.ok(!vue.figee?.caches.includes(5), `${ou} : pas dans caches`);
      assert.ok(vue.entries.filter((e) => e.j === 5).every((e) => !e.result && !e.buts && !e.passes && !e.retard), `${ou} : la J5 posée`);
      assert.equal(vue.entries.filter((e) => e.j === 5).length, 21, `${ou} : ses équipes gardées`);
    }
    // Les sorties : celles du même document sans les résultats de la J5 (et sans la félicitation J5).
    const a = lecture(doc, t, [felicitationJ5]);
    const b = lecture(sansResultats(v), t, []);
    assert.deepEqual(a, b, `${ou} : la ligue lit la même chose que sans la J5`);
    const div = etatDivisions(vue)!;
    assert.equal(div.pour, 6, `${ou} : les divisions font jouer la J6`);
    assert.equal(titresTombes(doc, 5, t), false, `${ou} : pas de titres`);
    assert.equal(voteOuvertA(doc, 5, t), false, `${ou} : pas de vote`);
    assert.equal(finDuVote(meta, 1, t), null, `${ou} : pas de fin du vote`);
    assert.equal(revelation(meta, 1, t), null, `${ou} : pas de révélation`);
    assert.equal(revelationAttendue(doc, t), null, `${ou} : rien n'attend sa révélation`);
    assert.equal(etatRevelation(doc, 5, t), "a-rattraper", ou);
    assert.equal(etatJournee(doc, 5, t), "a-rattraper", ou);
    assert.deepEqual(gesteDuMoment(doc, 5, t), { t: "a-rattraper", j: 5, motif: "Travaux sur les terrains" }, ou);
    assert.notEqual(prochaineJournee(doc, t), 5, `${ou} : jamais ouverte d'office`);
    const sansJ5 = { ...doc, journees: doc.journees.filter((m) => m.j !== 5) };
    assert.deepEqual(prochaineTransition(doc, t), prochaineTransition(sansJ5, t), `${ou} : aucune transition`);
    assert.equal(tenirFinDesMatchs(doc, t), doc, `${ou} : la fin des matchs n'est pas tenue`);
    assert.equal(droitDePrendre(doc, 5, ["Noirs 1", "Blancs 1"], N1[0], t), "suspens", `${ou} : la feuille gelée`);
    assert.equal(MOTS_DU_REFUS.suspens, "En suspens");
    assert.equal(publicationAnnoncable(doc, 5), false, `${ou} : rien à annoncer`);
    assert.equal(libelleRevelation(doc, 5, t), "à rattraper");
    assert.equal(libelleFinDuVote(doc, 5, t), "à rattraper");
    assert.equal(verdictDeJournee(doc, 5, t), "à rattraper");
    assert.equal(prochaineAJouer(vue), 6, `${ou} : la prochaine à jouer est la J6`);
    assert.equal(premiereAVenir(vue), undefined, `${ou} : aucune journée à venir`);
    assert.equal(dimancheAAnnoncer(vue), 6, `${ou} : l'outsider s'annonce pour la J6`);
    // Missions et Flair : gardés, jamais jugés.
    const d = missionsDeJournee(vue, 1, 5, t)!;
    assert.ok(d.suspens && d.finDuJour.getTime() === JAMAIS.getTime() && d.verdict === "à rattraper", `${ou} : missions sans verdict`);
    const p = pronosDeJournee(vue, 1, 5, t)!;
    assert.ok(p.suspens && !p.joue, `${ou} : pronos gardés`);
    const flair = flairsDuJoueur(vue, 1, false, pronosJ5, presents[0], t, t).find((f) => f.j === 5)!;
    assert.equal(flair.phase, "a-rattraper", `${ou} : Flair à rattraper`);
    assert.equal(flair.xp, 0);
  }
  // Ni clôture, ni brouillon.
  assert.equal(cloturerSaison(doc), doc, `${nomVariante} : la clôture attend le rattrapage`);
  assert.equal(resteUneJourneeEnSuspens(doc), 5);
  assert.deepEqual(journeesEnSuspens(doc), [5]);
  assert.equal(raisonDeGarder(doc, 5, T["12:40"]), "suspens");
  const r = remettreEnBrouillon(doc, 5, "Ilyes", new Date("2026-11-07T10:00:00Z"));
  assert.ok("refus" in r && r.refus === "suspens", `${nomVariante} : pas de brouillon`);
  assert.deepEqual(libelleSuspens(doc.journees.find((m) => m.j === 5)), { etat: EN_SUSPENS, motif: "Travaux sur les terrains" });
}

// L'ancien régime aussi (la J4 et avant : ses points comptaient dès qu'elle était jouée).
{
  const r = suspendreJournee(finie, 4, SUSPENS);
  assert.ok("saison" in r);
  const t = T["+7 jours"];
  assert.equal(journeeComptee(finie, 4, t), true, "la J4 compte");
  assert.equal(journeeComptee(r.saison, 4, t), false, "la J4 en suspens ne compte pas");
  assert.equal(etatJournee(r.saison, 4, t), "a-rattraper", "ancien régime : à rattraper");
  assert.equal(etatRevelation(r.saison, 4, t), "a-rattraper");
  assert.deepEqual(figer(r.saison, t).figee?.enSuspens, [4]);
  assert.notDeepEqual(deriveSeason(figer(r.saison, t)).players, deriveSeason(figer(finie, t)).players, "ses points sortent");
}

// Les cartons restent (D3) : le retard de la J5 fait son jaune, la vue n'a pas le −1.
{
  const doc = suspendue(miTemps);
  const retardataire = N1[2];
  const cle = retardataire.trim().toLowerCase();
  const avant = cartonsDeLaSaison(sansResultats(miTemps)).get(cle)?.cartons.length ?? 0;
  assert.equal(cartonsDeLaSaison(doc).get(cle)?.cartons.length ?? 0, avant + 1, "le carton du retard J5 reste");
  assert.ok(!figer(doc, T["+7 jours"]).entries.some((e) => e.j === 5 && e.retard), "le −1 du retard attend la reprise");
}

/* ------------------------------ 2 · L'aller-retour ------------------------------ */

for (const [nomVariante, v] of [["vide", vide], ["mi-temps", miTemps], ["finie", finie]] as const) {
  const doc = suspendue(v);
  const r = reprendreJournee(doc, 5, { par: "Ilyes", le: "2026-11-09T10:00:00.000Z" });
  assert.ok("saison" in r);
  const repris = r.saison;
  const meta = repris.journees.find((m) => m.j === 5)!;
  assert.ok(!("suspens" in meta) && meta.reprise?.par === "Ilyes", `${nomVariante} : suspens retiré, reprise posée`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sansReprise = { ...repris, journees: repris.journees.map(({ reprise, ...m }) => m) };
  assert.deepEqual(sansReprise, v, `${nomVariante} : le document d'origine`);
  for (const [h, t] of Object.entries(T)) assert.deepEqual(lecture(repris, t, [felicitationJ5]), lecture(v, t, [felicitationJ5]), `${nomVariante} · ${h} : les calculs d'avant`);
}
// Les refus et le motif.
{
  const doc = suspendue(vide);
  assert.deepEqual(suspendreJournee(doc, 5, SUSPENS), { refus: "deja" });
  assert.deepEqual(suspendreJournee(vide, 9, SUSPENS), { refus: "absente" });
  const brouillon = { ...vide, journees: vide.journees.map((m) => (m.j === 5 ? { ...m, brouillon: { depuis: "x", par: "Ilyes" } } : m)) };
  assert.deepEqual(suspendreJournee(brouillon, 5, SUSPENS), { refus: "brouillon" });
  assert.deepEqual(reprendreJournee(vide, 5, { par: "Ilyes", le: "x" }), { refus: "pas-en-suspens" });
  assert.deepEqual(reprendreJournee(vide, 9, { par: "Ilyes", le: "x" }), { refus: "absente" });
  assert.deepEqual(suspendreJournee(vide, 5, { ...SUSPENS, motif: "x".repeat(MOTIF_MAX + 1) }), { refus: "motif" });
  const r60 = suspendreJournee(vide, 5, { ...SUSPENS, motif: "x".repeat(MOTIF_MAX) });
  assert.ok("saison" in r60 && r60.saison.journees.find((m) => m.j === 5)!.suspens!.motif!.length === MOTIF_MAX);
  for (const motif of ["", "   ", null, undefined]) {
    const r = suspendreJournee(vide, 5, { ...SUSPENS, motif });
    assert.ok("saison" in r && !("motif" in r.saison.journees.find((m) => m.j === 5)!.suspens!), `motif vide : absent (${JSON.stringify(motif)})`);
  }
  assert.equal(libelleSuspens(suspendue({ ...vide })!.journees.find((m) => m.j === 5))!.etat, "En suspens · à rattraper");
}
// La reprise selon la date et l'heure.
{
  const lendemain = T.lendemain;
  const reprendre = (s: Saison) => {
    const r = reprendreJournee(s, 5, { par: "Ilyes", le: lendemain.toISOString() });
    assert.ok("saison" in r);
    return r.saison;
  };
  // Même date passée, tous les résultats : elle compte aussitôt (minuit passé, sans F), sans vote.
  const toute = reprendre(suspendue(finie));
  assert.equal(journeeComptee(toute, 5, lendemain), true, "reprise complète : la J5 compte");
  assert.equal(etatJournee(toute, 5, lendemain), "revelee");
  assert.equal(voteOuvertA(toute, 5, lendemain), false, "le jour du vote est passé");
  // Même date passée, résultats incomplets : bloquée.
  assert.equal(etatJournee(reprendre(suspendue(miTemps)), 5, lendemain), "bloquee", "reprise incomplète : bloquée");
  // Rattrapée à une autre date : la date change pendant le suspens, puis la reprise ; en ligne.
  const ailleurs = updateJournee(suspendue(vide), 5, { date: "22 nov." });
  assert.ok(rattrapeeAilleurs(ailleurs.journees.find((m) => m.j === 5)!), "rattrapée ailleurs");
  assert.ok(!rattrapeeAilleurs(suspendue(vide).journees.find((m) => m.j === 5)!), "même date");
  const enLigne = reprendre(ailleurs);
  assert.equal(etatJournee(enLigne, 5, new Date("2026-11-12T12:00:00Z")), "en-ligne", "rattrapée le 22 : en ligne");
  assert.equal(prochaineJournee(enLigne, new Date("2026-11-12T12:00:00Z")), 5, "et c'est la prochaine");
}

/* ------------------------------ 3 · Rétrocompatibilité ------------------------------ */

assert.equal(estEnSuspens(undefined), false);
assert.equal(estEnSuspens(null), false);
assert.equal(estEnSuspens({ suspens: undefined }), false);
assert.equal(estEnSuspens({ suspens: null as never }), false);
assert.equal(estEnSuspens({ suspens: false as never }), false);
assert.equal(estEnSuspens({ suspens: true as never }), true);
assert.equal(libelleSuspens(vide.journees[0]), null);
assert.deepEqual(journeesEnSuspens(vide), []);
for (const t of Object.values(T)) assert.equal(figer(vide, t), vide, "sans suspens ni résultat : même référence");

/* ------------------------------ 4 · I13 ------------------------------ */

{
  const doc = suspendue(miTemps);
  const ecrase = nouveauxEcarts(doc, miTemps);
  assert.ok(bloquantsEcriture(ecrase).some((e) => e.r === "I13" && e.j === 5), "« Écraser » depuis une vieille copie : bloqué");
  const r = reprendreJournee(doc, 5, { par: "Ilyes", le: "2026-11-09T10:00:00.000Z" });
  assert.ok("saison" in r);
  assert.ok(!nouveauxEcarts(doc, r.saison).some((e) => e.r === "I13"), "la reprise passe");
  const vieilleReprise = { ...miTemps, journees: miTemps.journees.map((m) => (m.j === 5 ? { ...m, reprise: { le: "2026-11-01T00:00:00.000Z", par: "x" } } : m)) };
  assert.ok(nouveauxEcarts(doc, vieilleReprise).some((e) => e.r === "I13"), "une reprise d'avant la suspension ne compte pas");
  const supprimee = { ...doc, journees: doc.journees.filter((m) => m.j !== 5), entries: doc.entries.filter((e) => e.j !== 5) };
  assert.ok(!nouveauxEcarts(doc, supprimee).some((e) => e.r === "I13"), "supprimer la journée reste permis");
}

/* ------------------- 5 · Le rattrapage après la J6 (12/11) ------------------- */

// La reprise garde la date d'origine (la base fait le même ménage si la date change ensuite).
{
  const r = reprendreJournee(suspendue(vide), 5, { par: "Ilyes", le: "2026-11-09T10:00:00.000Z" });
  assert.ok("saison" in r);
  assert.deepEqual(r.saison.journees.find((m) => m.j === 5)!.reprise, { le: "2026-11-09T10:00:00.000Z", par: "Ilyes", date: "8 nov." }, "reprise.date");
}

// journeeDuMoment : la prochaine à se jouer ou à se dénouer, par date ; sinon la dernière par date.
{
  const d = (j: number, coup: string, fin: string, suspens = false) => ({ j, coupEnvoi: new Date(coup), finDuJour: new Date(fin), suspens });
  const j5 = d(5, "2026-11-29T11:30:00Z", "2026-11-29T18:00:00Z");
  const j6 = d(6, "2026-11-15T11:30:00Z", "2026-11-15T18:00:00Z");
  const j7 = d(7, "2026-11-22T11:30:00Z", "2026-11-22T18:00:00Z");
  assert.equal(journeeDuMoment([j5, j6, j7], new Date("2026-11-20T12:00:00Z"))?.j, 7, "le 20/11 : la J7 du 22, pas la J5 du 29");
  assert.equal(journeeDuMoment([j5, j6, j7], new Date("2026-11-29T09:00:00Z"))?.j, 5, "le 29/11 : le rattrapage de la J5");
  assert.equal(journeeDuMoment([j5, j6, j7], new Date("2026-12-01T09:00:00Z"))?.j, 5, "après tout : la dernière par date");
  const s5 = d(5, "2026-11-08T11:30:00Z", JAMAIS.toISOString(), true);
  assert.equal(journeeDuMoment([s5, j6], new Date("2026-11-12T12:00:00Z"))?.j, 6, "une journée en suspens ne passe pas devant la J6");
  assert.equal(journeeDuMoment([d(4, "2026-11-01T11:30:00Z", "2026-11-01T18:00:00Z"), s5], new Date("2026-11-12T12:00:00Z"))?.j, 5, "en dernier recours, la journée en suspens");
  assert.equal(journeeDuMoment([], new Date()), null);
  // Les numéros dans l'ordre des dates : la plus grande qui a des équipes, comme avant.
  assert.equal(journeeDuMoment([d(4, "2026-11-01T11:30:00Z", "2026-11-01T18:00:00Z"), j6], new Date("2026-11-12T12:00:00Z"))?.j, 6);
  assert.equal(journeeDuMoment([d(4, "2026-11-01T11:30:00Z", "2026-11-01T18:00:00Z"), d(5, "2026-11-08T11:30:00Z", "2026-11-08T18:00:00Z")], new Date("2026-11-12T12:00:00Z"))?.j, 5);
}
assert.deepEqual(ordreDuCalendrier({ journees: [{ j: 5, date: "29 nov." }, { j: 6, date: "15 nov." }, { j: 7, date: "22 nov." }, { j: 4, date: "1 nov." }] }, [4, 5, 6, 7]), [4, 6, 7, 5]);
assert.deepEqual(ordreDuCalendrier({ journees: [{ j: 1, date: "20 déc." }, { j: 2, date: "3 janv." }, { j: 3, date: "" }, { j: 4, date: "10 janv." }] }, [4, 3, 2, 1]), [1, 2, 3, 4], "l'année change ; une date illisible garde sa place");

{
  // La ligue : la J5 suspendue le 8, la J6 jouée le 15, la J7 le 22, la J5 rattrapée le 29.
  const metaDe = (j: number, date: string): JourneeMeta => ({ ...metaJ5, j, date });
  const ligne = (j: number, joue: boolean) => (nom: string, i: number): MatchEntry => {
    const team = equipeDe(i);
    const result = !joue ? null : team.startsWith("Noirs") ? ("Victoire" as const) : ("Défaite" as const);
    return { ...ligneJ5(nom, i), j, result, buts: joue && (i === 0 || i === 11) ? 2 : 0 };
  };
  const jouer = (s: Saison, j: number): Saison => ({
    ...s,
    entries: s.entries.map((e) => (e.j === j ? ligne(j, true)(e.player, presents.indexOf(e.player)) : e)),
  });
  const base: Saison = {
    ...vide,
    journees: [...vide.journees, metaDe(6, "15 nov."), metaDe(7, "22 nov."), metaDe(8, "6 déc.")],
    entries: [...vide.entries, ...presents.map(ligne(6, true)), ...presents.map(ligne(7, false)), ...presents.map(ligne(8, false))],
  };
  const doc = suspendue(base);
  const t16 = new Date("2026-11-16T12:00:00Z");
  const v16 = figer(doc, t16);
  assert.equal(dimancheEnCours(v16, t16)?.j, 7, "le 16 : les missions de la J7, pas de la J8");
  assert.equal(journeeDesPronos(v16, t16)?.j, 7, "le 16 : les pronos de la J7");
  assert.equal(evolutionDe(v16).calendrier.prochaineApresJ, evolutionDe(figer({ ...base, journees: base.journees.filter((m) => m.j !== 5), entries: base.entries.filter((e) => e.j !== 5) }, t16)).calendrier.prochaineApresJ, "Ma carte : la J5 en suspens n'est pas à jouer");
  assert.equal(prochaineAJouer(doc), 7, "prochaineAJouer sur le document brut");
  // Le chapitre d'avant de l'outsider de la J6 : la J4 (la J5 en suspens sautée).
  const { journal } = journalCompletAvecS(entrees(v16, t16, []));
  assert.equal(arcOutsider(v16, journal, deriveSeason(v16).players, 6)?.precedent?.j, 4, "l'outsider : le chapitre d'avant est la J4");
  // L'arbitre de la J5 : « a-rattraper », et pas la journée du moment devant la J7.
  const arb = [5, 7].map((j, i) => ({ id: i + 1, saison: 1, j, n: 0, arbitre: presents[20], equipes: ["Noirs 1", "Blancs 1"] }));
  const ja = journeesArbitre(v16, presents[20], arb, t16);
  assert.equal(phaseArbitre(ja.find((x) => x.j === 5)!, t16), "a-rattraper", "l'arbitre : à rattraper");
  assert.equal(journeeEnCours(ja, 1, t16)?.j, 7, "l'arbitre : la J7");
  assert.equal(journeeEnCours(ja.filter((x) => x.j === 5), 1, t16)?.j, 5, "seule, la J5 à rattraper");
  // La date change (29 nov.), puis la reprise ; la J7 se joue le 22.
  const r = reprendreJournee(updateJournee(doc, 5, { date: "29 nov." }), 5, { par: "Ilyes", le: "2026-11-20T10:00:00.000Z" });
  assert.ok("saison" in r);
  const t20 = new Date("2026-11-20T12:00:00Z");
  assert.equal(dimancheEnCours(figer(r.saison, t20), t20)?.j, 7, "le 20 : la J7 du 22 d'abord");
  assert.equal(journeeEnCours(journeesArbitre(figer(r.saison, t20), presents[20], arb, t20), 1, t20)?.j, 7, "l'arbitre, le 20 : la J7 du 22 d'abord");
  const avecJ7 = jouer(r.saison, 7);
  const t29 = new Date("2026-11-29T09:00:00Z");
  const v29 = figer(avecJ7, t29);
  assert.equal(dimancheEnCours(v29, t29)?.j, 5, "le 29 au matin : les missions du rattrapage");
  assert.equal(journeeDesPronos(v29, t29)?.j, 5, "le 29 au matin : les pronos du rattrapage");
  assert.equal(phaseArbitre(journeesArbitre(v29, presents[20], arb, t29).find((x) => x.j === 5)!, t29), "ouvert", "l'arbitre du rattrapage : ouvert");
  // Les divisions : la J5 jouée le 29 vient après la J7 ; les mouvements de la J6 et de la J7 ne bougent pas.
  const t30 = new Date("2026-11-30T12:00:00Z");
  const avant = etatDivisions(figer(avecJ7, t30))!;
  const apres = etatDivisions(figer(jouer(avecJ7, 5), t30))!;
  assert.deepEqual(apres.journees.map((x) => x.j), [4, 6, 7, 5], "l'ordre du calendrier");
  assert.equal(dernierBilan(apres)?.j, 5, "le dernier bilan est celui du rattrapage");
  for (const j of [6, 7]) assert.deepEqual(apres.journees.find((x) => x.j === j), avant.journees.find((x) => x.j === j), `la J${j} n'est pas réécrite`);
  const j5 = apres.journees.find((x) => x.j === 5)!.mouvements;
  const apresJ7 = avant.decoupage.parNom;
  assert.ok(j5.every((m) => m.de === (apresJ7.get(m.nom)?.division ?? 3)), "le rattrapage part des divisions d'après la J7");
}

// prochaineAJouer sur le document brut : une journée en suspens jouée ne fait pas sauter une journée à jouer avant elle.
{
  const r = suspendreJournee({ ...finie, journees: [...finie.journees, { ...metaJ5, j: 6, date: "15 nov." }] }, 5, SUSPENS);
  assert.ok("saison" in r);
  const sansJ5Jouee = { ...r.saison, entries: r.saison.entries.map((e) => (e.j === 5 ? { ...e, j: 6 } : e)) };
  // J4 jouée, J5 sans feuille (à jouer), J6 jouée mais en suspens : la prochaine est la J5.
  const j6EnSuspens = {
    ...sansJ5Jouee,
    journees: sansJ5Jouee.journees.map((m) => (m.j === 5 ? { ...m, suspens: undefined } : m.j === 6 ? { ...m, suspens: { depuis: SUSPENS.le, par: "Ilyes", date: "15 nov." } } : m)),
  };
  assert.equal(prochaineAJouer(j6EnSuspens), 5, "la J5 à jouer, pas la J7");
}

console.log("suspens-check : la règle (3 variantes × 4 heures), l'aller-retour, les refus, la reprise, la rétrocompatibilité, I13 et le rattrapage après la J6 — ok");
