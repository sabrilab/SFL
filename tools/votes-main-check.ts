// La main de l'admin sur le vote (lib/sfl/revelation.ts, 15/11/2026).
// Ilyes, le soir de la J6 : les feuilles corrigées à 18 h 15, le vote
// fermait d'office à 19 h 12 — « j'ai besoin que tu laisses les votes
// ouverts, mets-moi un bouton fermer les votes ».
//
// Ce que le banc vérifie, sur la J6 du dimanche 15 novembre (F = 18 h 11
// min 55 s) :
//   1 · sans geste, rien ne change : 19 h 11 min 55 s, puis 20 h 11 min 55 s ;
//   2 · « Garder les votes ouverts » : le vote et la révélation à minuit ;
//       les libellés, l'état, le minuteur ;
//   3 · « Fermer les votes » : fermé à l'instant, révélé une heure après,
//       minuit au plus tard ;
//   4 · « Rouvrir les votes » entre la fermeture d'office et la révélation ;
//   5 · ce qui se propose (reglageDuVote) : rien avant la fin des feuilles,
//       rien un autre jour, rien en suspens, en brouillon, sans vote, sous
//       l'ancien régime, et plus rien une fois la journée comptée ;
//   6 · une journée comptée ne se décompte jamais : les gestes refusés,
//       tenirMainSurLeVote remet la main d'avant (un « Annuler » tardif) ;
//       et aucun changement de main ne révèle une journée sur-le-champ
//       (annuler à 21 h 30 un « Garder » de 19 h 05) ;
//   7 · un geste ne vaut que le jour de la journée (une journée déplacée
//       repart de la règle) ; la fermeture l'emporte sur l'ouverture ;
//   8 · la fin des matchs inconnue : fermé à la main, gardé ouvert ; une
//       feuille reprise après une fermeture à la main (« Rouvrir » reste
//       proposé) ; l'écran en retard d'une minute ;
//   9 · la main ne décale pas la fin des matchs (tenirFinDesMatchs) ;
//   10 · la main que la base a gardée, reprise par l'appareil de l'admin ;
//   11 · l'heure de fin (Sabri, 22/11/2026, J7 : F = 16 h 42, le vote fermé
//       à 18 h) : « Rouvrir » et « Garder » tiennent jusqu'à 19 h, minuit
//       passé 19 h ou quand la règle ferme déjà après ; « Heure de fin » pose
//       l'heure choisie, la révélation une heure après, minuit au plus tard.
// Aucune heure du jour n'est lue : tout instant est donné.
//   npx tsx tools/votes-main-check.ts
import assert from "node:assert/strict";
import {
  avecMainsDeLaBase,
  etatRevelation,
  fermerLeVote,
  finChoisie,
  finDuVote,
  finTenue,
  fixerFinDuVote,
  garderLeVoteOuvert,
  heureDeChamp,
  heureDeLaJournee,
  journeeComptee,
  libelleFinDuVote,
  libelleRevelation,
  prochaineTransition,
  reglageDuVote,
  revelation,
  tenirFinDesMatchs,
  tenirMainSurLeVote,
  voteFermeALaMain,
  voteGardeOuvert,
  voteOuvertA,
} from "../src/lib/sfl/revelation";
import { etatJournee, gesteDuMoment } from "../src/lib/sfl/saisie/etat-journee";
import type { JourneeMeta, MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

/** Une heure de Paris en hiver (UTC+1) : « 2026-11-15 18:00 » ou « 2026-11-15 18:11:55 ». */
const hiver = (s: string) => new Date(`${s.replace(" ", "T")}${s.length > 16 ? "" : ":00"}+01:00`);
const meta = (j: number, date: string, extra: Partial<JourneeMeta> = {}): JourneeMeta => ({ j, date, sflTime: true, mvpAuto: true, ...extra });
const ligne = (j: number, player: string, extra: Partial<MatchEntry> = {}): MatchEntry => ({
  j, player, team: null, statut: "Présent", result: "Défaite", sflTime: true,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false, ...extra,
});
const NOMS = Array.from({ length: 20 }, (_, i) => `J${String(i + 1).padStart(2, "0")}`);
const F = hiver("2026-11-15 18:11:55");
const MINUIT = hiver("2026-11-16 00:00");

/** La J6 : deux matchs. `finie` : chaque camp a son résultat ; `f` : la fin des matchs posée. */
function saison(o: { finie?: boolean; f?: Date | null; j6?: Partial<JourneeMeta>; numero?: number } = {}): Saison {
  const finie = o.finie ?? true;
  const f = o.f === undefined ? F : o.f;
  const camp = (noms: string[], team: string, result: MatchEntry["result"]) => noms.map((p, i) => ligne(6, p, { team, result: finie ? result : null, buts: i === 0 ? 2 : 0 }));
  return {
    numero: o.numero ?? 1,
    journees: [meta(5, "8 nov.", { finDesMatchs: hiver("2026-11-08 15:10").toISOString() }), meta(6, "15 nov.", { ...(f ? { finDesMatchs: f.toISOString() } : {}), ...o.j6 })],
    roster: NOMS.map((name) => ({ name, poste: null, profil: "Actif", base: null })),
    entries: [
      ...NOMS.map((n) => ligne(5, n, { result: "Nul" })),
      ...camp(NOMS.slice(0, 5), "Noirs 1", "Victoire"),
      ...camp(NOMS.slice(5, 10), "Blancs 1", "Défaite"),
      ...camp(NOMS.slice(10, 15), "Noirs 2", "Nul"),
      ...camp(NOMS.slice(15, 20), "Blancs 2", "Nul"),
    ],
    convocations: [],
  };
}
const j6 = (s: Saison) => s.journees.find((m) => m.j === 6)!;
const fin = (s: Saison, t: Date) => finDuVote(j6(s), 1, t)!.getTime();
const rev = (s: Saison, t: Date) => revelation(j6(s), 1, t)?.getTime() ?? null;
const h = (x: string) => hiver(`2026-11-15 ${x}`);

/* ------------------------------ 1 · Sans geste ------------------------------ */
{
  const s = saison();
  const t = h("18:30");
  assert.equal(fin(s, t), hiver("2026-11-15 19:11:55").getTime(), "la règle : F + 1 h");
  assert.equal(rev(s, t), hiver("2026-11-15 20:11:55").getTime(), "la règle : la révélation une heure après");
  assert.equal(voteOuvertA(s, 6, t), true);
  assert.equal(voteOuvertA(s, 6, h("19:12")), false);
  assert.equal(etatRevelation(s, 6, t), "vote");
  assert.equal(etatRevelation(s, 6, h("19:30")), "attente");
  assert.equal(etatRevelation(s, 6, h("20:12")), "revelee");
  assert.equal(voteGardeOuvert(j6(s)), false);
  assert.equal(voteFermeALaMain(j6(s)), null);
  assert.equal(libelleFinDuVote(s, 6, t), "19 h 11");
  assert.equal(libelleRevelation(s, 6, t), "20 h 11");
  assert.deepEqual(reglageDuVote(s, 6, t), { garder: true, fermer: true, rouvrir: false }, "le vote ouvert : le garder ou le fermer");
  assert.deepEqual(reglageDuVote(s, 6, h("19:30")), { garder: false, fermer: false, rouvrir: true }, "fermé d'office, pas révélé : le rouvrir");
  assert.equal(reglageDuVote(s, 6, h("20:12")), null, "révélée : plus rien");
}

/* --------------------- 2 · Garder les votes ouverts --------------------- */
{
  const t = h("18:40");
  const avant = saison();
  const s = garderLeVoteOuvert(avant, 6, t);
  assert.notEqual(s, avant);
  assert.equal(j6(s).votesOuvertsLe, t.toISOString());
  assert.equal(j6(s).votesFermesLe, undefined);
  assert.equal(j6(s).finDesMatchs, F.toISOString(), "la fin des matchs ne bouge pas");
  assert.deepEqual(s.journees[0], avant.journees[0], "la J5 intacte");
  assert.equal(s.entries, avant.entries, "aucune ligne touchée");
  assert.equal(voteGardeOuvert(j6(s)), true);
  for (const x of ["18:40", "19:12", "20:12", "23:59"]) {
    assert.equal(fin(s, h(x)), MINUIT.getTime(), `gardé ouvert : minuit (${x})`);
    assert.equal(rev(s, h(x)), MINUIT.getTime(), `la révélation à minuit (${x})`);
    assert.equal(voteOuvertA(s, 6, h(x)), true, `ouvert à ${x}`);
    assert.equal(etatRevelation(s, 6, h(x)), "vote");
    assert.equal(journeeComptee(s, 6, h(x)), false, `pas comptée à ${x}`);
    assert.equal(libelleFinDuVote(s, 6, h(x)), "minuit");
    assert.equal(libelleRevelation(s, 6, h(x)), "minuit");
    assert.deepEqual(reglageDuVote(s, 6, h(x)), { garder: false, fermer: true, rouvrir: false }, "gardé ouvert : il ne reste qu'à fermer");
  }
  assert.equal(voteOuvertA(s, 6, MINUIT), false, "minuit : fermé");
  assert.equal(journeeComptee(s, 6, MINUIT), true, "minuit : comptée");
  assert.equal(etatRevelation(s, 6, MINUIT), "revelee");
  assert.equal(prochaineTransition(s, h("19:00"))!.getTime(), MINUIT.getTime(), "le minuteur : plus rien avant minuit");
  assert.equal(etatJournee(s, 6, h("19:30")), "vote");
  assert.deepEqual(gesteDuMoment(s, 6, h("19:30")), { t: "revelation", j: 6, heure: "minuit" });
  // Une seconde fois : sans effet.
  assert.equal(garderLeVoteOuvert(s, 6, h("18:50")), s, "déjà gardé ouvert : même référence");
}

/* --------------------------- 3 · Fermer les votes --------------------------- */
{
  // Depuis la règle, avant la fermeture d'office.
  const t = h("18:20");
  const s = fermerLeVote(saison(), 6, t);
  assert.equal(j6(s).votesFermesLe, t.toISOString());
  assert.equal(fin(s, h("18:30")), t.getTime(), "fermé à l'instant");
  assert.equal(rev(s, h("18:30")), h("19:20").getTime(), "révélé une heure après");
  assert.equal(voteOuvertA(s, 6, h("18:19")), true, "une minute avant : encore ouvert");
  assert.equal(voteOuvertA(s, 6, t), false, "à l'instant : fermé");
  assert.equal(etatRevelation(s, 6, h("18:30")), "attente");
  assert.equal(journeeComptee(s, 6, h("19:19")), false);
  assert.equal(journeeComptee(s, 6, h("19:20")), true, "comptée une heure après la fermeture");
  assert.equal(libelleFinDuVote(s, 6, h("18:30")), "18 h 20");
  assert.equal(libelleRevelation(s, 6, h("18:30")), "19 h 20");
  assert.deepEqual(reglageDuVote(s, 6, h("18:30")), { garder: false, fermer: false, rouvrir: true });
  assert.equal(fermerLeVote(s, 6, h("18:30")), s, "déjà fermé : même référence");

  // Gardé ouvert, puis fermé à 21 h : la révélation à 22 h.
  const garde = garderLeVoteOuvert(saison(), 6, h("18:40"));
  const ferme = fermerLeVote(garde, 6, h("21:00"));
  assert.equal(j6(ferme).votesOuvertsLe, undefined, "un seul geste à la fois");
  assert.equal(fin(ferme, h("21:30")), h("21:00").getTime());
  assert.equal(rev(ferme, h("21:30")), h("22:00").getTime());
  assert.equal(journeeComptee(ferme, 6, h("21:59")), false);
  assert.equal(journeeComptee(ferme, 6, h("22:00")), true);
  assert.equal(prochaineTransition(ferme, h("21:30"))!.getTime(), h("22:00").getTime());

  // Fermé à 23 h 30 : la révélation à minuit, jamais après.
  const tard = fermerLeVote(garde, 6, h("23:30"));
  assert.equal(rev(tard, h("23:40")), MINUIT.getTime(), "minuit au plus tard");
  assert.equal(libelleRevelation(tard, 6, h("23:40")), "minuit");
}

/* --------------------------- 4 · Rouvrir les votes --------------------------- */
{
  const avant = saison();
  const t = h("19:30"); // fermé d'office à 19 h 11 min 55 s, révélation à 20 h 11 min 55 s
  assert.equal(voteOuvertA(avant, 6, t), false);
  const s = garderLeVoteOuvert(avant, 6, t);
  assert.equal(voteOuvertA(s, 6, t), true, "rouvert");
  assert.equal(fin(s, t), MINUIT.getTime());
  assert.equal(journeeComptee(s, 6, h("20:12")), false, "la révélation d'office ne tombe plus");
  // Fermé à la main, puis rouvert.
  const ferme = fermerLeVote(saison(), 6, h("18:20"));
  const rouvert = garderLeVoteOuvert(ferme, 6, h("18:45"));
  assert.equal(j6(rouvert).votesFermesLe, undefined);
  assert.equal(voteOuvertA(rouvert, 6, h("18:46")), true);
  assert.equal(rev(rouvert, h("18:46")), MINUIT.getTime());
}

/* ------------------------ 5 · Ce qui se propose ------------------------ */
{
  const t = h("18:30");
  assert.equal(reglageDuVote(saison({ finie: false, f: null }), 6, h("15:00")), null, "les feuilles pas finies : rien");
  assert.equal(reglageDuVote(saison(), 6, hiver("2026-11-14 18:30")), null, "la veille : rien");
  assert.equal(reglageDuVote(saison(), 6, hiver("2026-11-16 00:30")), null, "le lendemain : rien");
  assert.equal(reglageDuVote(saison(), 5, t), null, "la J5 (un autre dimanche) : rien");
  assert.equal(reglageDuVote(saison(), 7, t), null, "une journée qui n'existe pas : rien");
  assert.equal(reglageDuVote(saison({ j6: { brouillon: { depuis: h("12:00").toISOString(), par: "Ilyes" } } }), 6, t), null, "un brouillon : rien");
  assert.equal(reglageDuVote(saison({ j6: { suspens: { depuis: h("17:00").toISOString(), par: "Ilyes", date: "15 nov." } } }), 6, t), null, "en suspens : rien");
  assert.equal(reglageDuVote(saison({ j6: { mvpAuto: false } }), 6, t), null, "sans vote : rien");
  // L'ancien régime : la J4 de la saison 1.
  const j4: Saison = { ...saison(), journees: [meta(4, "15 nov.")], entries: saison().entries.map((e) => ({ ...e, j: 4 })) };
  assert.equal(reglageDuVote(j4, 4, t), null, "l'ancien régime : rien");
  assert.equal(garderLeVoteOuvert(j4, 4, t), j4);
  assert.equal(fermerLeVote(j4, 4, t), j4);
  // Les gestes refusés rendent la même référence.
  const pasFinie = saison({ finie: false, f: null });
  assert.equal(garderLeVoteOuvert(pasFinie, 6, h("15:00")), pasFinie);
  assert.equal(fermerLeVote(pasFinie, 6, h("15:00")), pasFinie);
  // Les feuilles finies, la fin des matchs pas encore rendue par la base : le vote tient déjà jusqu'à minuit.
  assert.deepEqual(reglageDuVote(saison({ f: null }), 6, t), { garder: false, fermer: true, rouvrir: false });
  // F à 23 h 15 : la règle donne déjà minuit, rien à garder.
  assert.deepEqual(reglageDuVote(saison({ f: h("23:15") }), 6, h("23:20")), { garder: false, fermer: true, rouvrir: false });
}

/* ----------------- 6 · Une journée comptée ne se décompte pas ----------------- */
{
  const s = saison();
  const t = h("20:30"); // révélée à 20 h 11 min 55 s
  assert.equal(journeeComptee(s, 6, t), true);
  assert.equal(garderLeVoteOuvert(s, 6, t), s, "révélée : on ne rouvre plus");
  assert.equal(fermerLeVote(s, 6, t), s);
  // Un document parti en retard (ou un « Annuler ») qui porte un geste : la main d'avant est remise.
  const tardif: Saison = { ...s, journees: s.journees.map((m) => (m.j === 6 ? { ...m, votesOuvertsLe: h("19:00").toISOString() } : m)) };
  assert.equal(journeeComptee(tardif, 6, t), false, "sans garde, la journée serait décomptée");
  const tenu = tenirMainSurLeVote(s, tardif, t);
  assert.equal(j6(tenu).votesOuvertsLe, undefined, "le geste tardif est retiré");
  assert.equal(journeeComptee(tenu, 6, t), true, "la journée reste comptée");
  // Dans l'autre sens : fermée à la main à 18 h 20 (révélée à 19 h 20), un « Annuler » à 19 h 30 ne la décompte pas.
  const ferme = fermerLeVote(saison(), 6, h("18:20"));
  const annule = tenirMainSurLeVote(ferme, saison(), h("19:30"));
  assert.equal(j6(annule).votesFermesLe, h("18:20").toISOString(), "la fermeture est remise");
  assert.equal(journeeComptee(annule, 6, h("19:30")), true);
  // « Annuler » à 21 h 30 un « Garder les votes ouverts » de 19 h 05 : la règle reviendrait avec une révélation
  // déjà passée (20 h 12), tout tomberait d'un coup. La main reste ; l'admin ferme le vote, révélation une heure après.
  const garde1905 = garderLeVoteOuvert(saison(), 6, h("19:05"));
  assert.equal(journeeComptee(saison(), 6, h("21:30")), true, "sans garde, annuler révélerait la journée sur-le-champ");
  const annule2130 = tenirMainSurLeVote(garde1905, saison(), h("21:30"));
  assert.equal(j6(annule2130).votesOuvertsLe, h("19:05").toISOString(), "la main reste");
  assert.equal(journeeComptee(annule2130, 6, h("21:30")), false, "la journée ne compte pas d'un coup");
  assert.deepEqual(reglageDuVote(annule2130, 6, h("21:30")), { garder: false, fermer: true, rouvrir: false });
  // Le même « Annuler » avant l'heure de la règle (19 h 08) : la règle reprend, le vote ferme à 19 h 11 min 55 s.
  const annule1908 = tenirMainSurLeVote(garde1905, saison(), h("19:08"));
  assert.equal(j6(annule1908).votesOuvertsLe, undefined, "avant l'heure de la règle, annuler rend la règle");
  // Entre la fin du vote et la révélation de la règle (19 h 30) : le vote ferme, la révélation reste à 20 h 12, rien ne tombe.
  const annule1930 = tenirMainSurLeVote(garde1905, saison(), h("19:30"));
  assert.equal(j6(annule1930).votesOuvertsLe, undefined);
  assert.equal(journeeComptee(annule1930, 6, h("19:30")), false);
  // Rétablir à 20 h une fermeture de 18 h 20 (révélation 19 h 20) annulée entre-temps par un « Rouvrir » : la main reste ouverte.
  const ferme1820 = fermerLeVote(saison(), 6, h("18:20"));
  const rouvert1845 = garderLeVoteOuvert(ferme1820, 6, h("18:45"));
  const retabli = tenirMainSurLeVote(rouvert1845, ferme1820, h("20:00"));
  assert.equal(j6(retabli).votesFermesLe, undefined, "une vieille fermeture ne revient pas révéler d'un coup");
  assert.equal(j6(retabli).votesOuvertsLe, h("18:45").toISOString());
  // Fermer reste toujours possible : la révélation est une heure après, pas à l'instant.
  const ferme2130 = fermerLeVote(garde1905, 6, h("21:30"));
  assert.equal(tenirMainSurLeVote(garde1905, ferme2130, h("21:30")), ferme2130);
  // Avant la révélation, la main bouge librement ; sans changement, même référence.
  const libre = garderLeVoteOuvert(saison(), 6, h("18:40"));
  assert.equal(tenirMainSurLeVote(saison(), libre, h("18:40")), libre);
  assert.equal(tenirMainSurLeVote(libre, libre, h("23:00")), libre);
  // Une correction de stat après la révélation ne touche pas à la main.
  const corrige: Saison = { ...s, entries: s.entries.map((e) => (e.j === 6 && e.player === "J01" ? { ...e, buts: 3 } : e)) };
  assert.equal(tenirMainSurLeVote(s, corrige, t), corrige);
  // Une autre saison : rien à tenir.
  const s2: Saison = { ...tardif, numero: 2 };
  assert.equal(tenirMainSurLeVote(s, s2, t), s2);
}

/* -------------------- 7 · Le jour de la journée seulement -------------------- */
{
  // Le geste date du 8 (la journée a été déplacée au 15) : la règle reprend.
  const vieux = saison({ j6: { votesFermesLe: hiver("2026-11-08 18:20").toISOString() } });
  assert.equal(voteFermeALaMain(j6(vieux)), null);
  assert.equal(fin(vieux, h("18:30")), hiver("2026-11-15 19:11:55").getTime(), "une fermeture d'un autre jour ne ferme pas");
  const vieuxOuvert = saison({ j6: { votesOuvertsLe: hiver("2026-11-08 18:20").toISOString() } });
  assert.equal(voteGardeOuvert(j6(vieuxOuvert)), false);
  assert.equal(fin(vieuxOuvert, h("18:30")), hiver("2026-11-15 19:11:55").getTime());
  // Une valeur illisible : ignorée.
  const illisible = saison({ j6: { votesFermesLe: "hier soir", votesOuvertsLe: "" } });
  assert.equal(fin(illisible, h("18:30")), hiver("2026-11-15 19:11:55").getTime());
  // Les deux gestes posés (un document écrit à la main) : la fermeture l'emporte.
  const deux = saison({ j6: { votesOuvertsLe: h("18:40").toISOString(), votesFermesLe: h("18:50").toISOString() } });
  assert.equal(voteGardeOuvert(j6(deux)), false);
  assert.equal(fin(deux, h("19:00")), h("18:50").getTime());
  // La saison 2 dès la J1.
  const s2 = { ...saison({ numero: 2 }) };
  assert.deepEqual(reglageDuVote(s2, 6, h("18:30")), { garder: true, fermer: true, rouvrir: false });
}

/* -------------------- 8 · La fin des matchs inconnue -------------------- */
{
  // Les feuilles finies, F pas encore rendu : fermé à la main.
  const s = fermerLeVote(saison({ f: null }), 6, h("18:20"));
  assert.equal(fin(s, h("18:30")), h("18:20").getTime());
  assert.equal(rev(s, h("18:30")), null, "sans fin des matchs, pas de révélation datée");
  assert.equal(etatRevelation(s, 6, h("18:30")), "attente", "fermé à la main : plus « vote »");
  assert.equal(voteOuvertA(s, 6, h("18:30")), false);
  assert.equal(libelleFinDuVote(s, 6, h("18:30")), "18 h 20");
  assert.equal(libelleRevelation(s, 6, h("18:30")), "19 h 20");
  assert.equal(journeeComptee(s, 6, h("23:59")), false);
  assert.equal(journeeComptee(s, 6, MINUIT), true, "sans F : minuit, comme avant");
  // Une journée rouverte (plus finie), le vote gardé ouvert : les libellés disent minuit.
  const rouverte = saison({ finie: false, f: null, j6: { votesOuvertsLe: h("18:40").toISOString() } });
  assert.equal(libelleFinDuVote(rouverte, 6, h("18:45")), "minuit");
  assert.equal(libelleRevelation(rouverte, 6, h("18:45")), "minuit");
  assert.equal(etatRevelation(rouverte, 6, h("18:45")), "en-direct");
}

/* ------------- 8 bis · Fermé à la main, puis une feuille reprise ------------- */
{
  // « Fermer » à 19 h, puis un résultat effacé à 19 h 10 : la journée est rouverte (plus de fin des matchs).
  const ferme = fermerLeVote(saison(), 6, h("19:00"));
  const reprise: Saison = { ...ferme, entries: ferme.entries.map((e) => (e.j === 6 && e.team === "Noirs 2" ? { ...e, result: null } : e)) };
  const rouverte = tenirFinDesMatchs(reprise, h("19:10"));
  assert.equal(j6(rouverte).finDesMatchs, undefined, "rouverte avant sa révélation : F retiré");
  assert.equal(j6(rouverte).votesFermesLe, h("19:00").toISOString(), "la fermeture reste (c'est le geste de l'admin)");
  assert.equal(voteOuvertA(rouverte, 6, h("19:10")), false);
  assert.deepEqual(reglageDuVote(rouverte, 6, h("19:10")), { garder: false, fermer: false, rouvrir: true }, "« Rouvrir les votes » reste proposé pendant la reprise");
  const rouvert = garderLeVoteOuvert(rouverte, 6, h("19:12"));
  assert.equal(voteOuvertA(rouvert, 6, h("19:13")), true);
  assert.equal(j6(rouvert).votesFermesLe, undefined);
  // La page lit l'heure du dernier tic (21 h 00 min 00 s), le geste date de 21 h 00 min 30 s : le vote est fermé quand même.
  const garde = garderLeVoteOuvert(saison(), 6, h("18:40"));
  const ferme2100 = fermerLeVote(garde, 6, hiver("2026-11-15 21:00:30"));
  assert.deepEqual(reglageDuVote(ferme2100, 6, h("21:00")), { garder: false, fermer: false, rouvrir: true }, "fermé à la main : fermé, quelle que soit la minute de l'écran");
  assert.equal(fermerLeVote(ferme2100, 6, h("21:00")), ferme2100, "un second « Fermer » dans la minute : sans effet");
  assert.equal(etatRevelation(saison({ f: null, j6: { brouillon: { depuis: h("12:00").toISOString(), par: "Ilyes" } } }), 6, h("18:30")), "vote", "un brouillon fini le jour même : comme avant");
}

/* ---------------- 9 · La main ne décale pas la fin des matchs ---------------- */
{
  const garde = garderLeVoteOuvert(saison(), 6, h("18:40"));
  assert.equal(tenirFinDesMatchs(garde, h("21:00")), garde, "gardé ouvert, toujours finie : F tenu");
  const ferme = fermerLeVote(saison(), 6, h("18:20"));
  assert.equal(tenirFinDesMatchs(ferme, h("19:30")), ferme, "révélée : F ne bouge plus");
  // Gardé ouvert puis rouverte à 21 h (un résultat effacé) : F retiré, comme sous la règle avant sa révélation.
  const rouverte: Saison = { ...garde, entries: garde.entries.map((e) => (e.j === 6 && e.team === "Noirs 2" ? { ...e, result: null } : e)) };
  const tenue = tenirFinDesMatchs(rouverte, h("21:00"));
  assert.equal(j6(tenue).finDesMatchs, undefined, "rouverte avant sa révélation (minuit) : F retiré");
  assert.equal(j6(tenue).votesOuvertsLe, h("18:40").toISOString(), "la main reste");
}

/* ------------- 10 · La main que la base a gardée (publier_saison) ------------- */
{
  // L'appareil a gardé un « Rouvrir » parti trop tard ; la base rend la main d'avant (aucune).
  const tardif = saison({ j6: { votesOuvertsLe: h("20:11").toISOString() } });
  const repris = avecMainsDeLaBase(tardif, { "5": { votesOuvertsLe: null, votesFermesLe: null }, "6": { votesOuvertsLe: null, votesFermesLe: null } });
  assert.equal(j6(repris).votesOuvertsLe, undefined, "le geste refusé par la base est retiré de l'appareil");
  assert.equal(journeeComptee(repris, 6, h("20:30")), true, "l'appareil voit la journée révélée, comme la ligue");
  assert.equal(repris.journees[0], tardif.journees[0], "la J5 intacte");
  // La base rend la fermeture d'avant.
  const ferme = avecMainsDeLaBase(tardif, { "6": { votesOuvertsLe: null, votesFermesLe: h("18:20").toISOString() } });
  assert.equal(j6(ferme).votesFermesLe, h("18:20").toISOString());
  assert.equal(j6(ferme).votesOuvertsLe, undefined);
  // D'accord avec la base, une journée que la réponse ne nomme pas, une réponse sans la clé : même référence.
  const garde = garderLeVoteOuvert(saison(), 6, h("18:40"));
  assert.equal(avecMainsDeLaBase(garde, { "6": { votesOuvertsLe: h("18:40").toISOString(), votesFermesLe: null } }), garde);
  assert.equal(avecMainsDeLaBase(garde, { "7": { votesOuvertsLe: null, votesFermesLe: null } }), garde);
  assert.equal(avecMainsDeLaBase(garde, {}), garde);
  const sans = saison();
  assert.equal(avecMainsDeLaBase(sans, { "6": null, "5": {} }), sans, "sans geste des deux côtés : rien");
}

/* --------------------------- 11 · L'heure de fin --------------------------- */
{
  // La J7 du 22/11 rejouée sur la J6 : dernière feuille à 16 h 42, la règle ferme à 18 h, révèle à 19 h.
  const base = () => saison({ f: h("16:42") });
  assert.equal(fin(base(), h("17:00")), h("18:00").getTime());
  assert.equal(finTenue(base(), 6, h("17:30"))!.getTime(), h("19:00").getTime(), "avant 19 h, la règle à 18 h : tenu jusqu'à 19 h");
  assert.equal(finTenue(base(), 6, h("19:00"))!.getTime(), MINUIT.getTime(), "19 h passé : minuit");
  assert.equal(finTenue(saison(), 6, h("18:30"))!.getTime(), MINUIT.getTime(), "la règle ferme après 19 h : minuit");
  assert.equal(finTenue(saison({ f: null }), 6, h("17:30"))!.getTime(), h("19:00").getTime(), "la fin des matchs inconnue : 19 h");

  // « Rouvrir les votes » à 18 h 17 : jusqu'à 19 h, la révélation à 20 h.
  const t = h("18:17");
  assert.deepEqual(reglageDuVote(base(), 6, t), { garder: false, fermer: false, rouvrir: true });
  const rouvert = garderLeVoteOuvert(base(), 6, t);
  assert.equal(j6(rouvert).votesOuvertsLe, t.toISOString(), "l'instant du geste");
  assert.equal(j6(rouvert).votesFermesLe, h("19:00").toISOString(), "l'heure de fin");
  assert.equal(finChoisie(j6(rouvert))!.getTime(), h("19:00").getTime());
  assert.equal(voteGardeOuvert(j6(rouvert)), false, "pas « jusqu'à minuit »");
  assert.equal(fin(rouvert, t), h("19:00").getTime());
  assert.equal(rev(rouvert, t), h("20:00").getTime());
  assert.equal(voteOuvertA(rouvert, 6, h("18:59")), true);
  assert.equal(voteOuvertA(rouvert, 6, h("19:00")), false);
  assert.equal(etatRevelation(rouvert, 6, h("18:30")), "vote");
  assert.equal(etatRevelation(rouvert, 6, h("19:30")), "attente");
  assert.equal(journeeComptee(rouvert, 6, h("19:59")), false);
  assert.equal(journeeComptee(rouvert, 6, h("20:00")), true);
  assert.equal(libelleFinDuVote(rouvert, 6, h("18:30")), "19 h");
  assert.equal(libelleRevelation(rouvert, 6, h("18:30")), "20 h");
  assert.equal(prochaineTransition(rouvert, h("18:30"))!.getTime(), h("19:00").getTime());
  assert.deepEqual(reglageDuVote(rouvert, 6, h("18:30")), { garder: false, fermer: true, rouvrir: false }, "tenu jusqu'à 19 h : il reste à fermer (et l'heure)");
  assert.deepEqual(reglageDuVote(rouvert, 6, h("19:30")), { garder: false, fermer: false, rouvrir: true }, "l'heure choisie passée : le rouvrir");
  assert.equal(garderLeVoteOuvert(rouvert, 6, h("18:30")), rouvert, "déjà tenu jusqu'à 19 h : même référence");
  // Rouvert de nouveau à 19 h 30 : minuit, comme avant.
  const encore = garderLeVoteOuvert(rouvert, 6, h("19:30"));
  assert.equal(j6(encore).votesFermesLe, undefined);
  assert.equal(fin(encore, h("19:30")), MINUIT.getTime());

  // « Garder les votes ouverts » à 17 h 30 : 19 h au lieu de 18 h.
  assert.deepEqual(reglageDuVote(base(), 6, h("17:30")), { garder: true, fermer: true, rouvrir: false });
  const garde = garderLeVoteOuvert(base(), 6, h("17:30"));
  assert.equal(fin(garde, h("17:30")), h("19:00").getTime());

  // « Heure de fin » : 21 h 30, choisie à 18 h 17, le vote fermé.
  const choisie = heureDeLaJournee(base(), 6, t, 21, 30)!;
  assert.equal(choisie.getTime(), h("21:30").getTime());
  assert.equal(heureDeChamp(choisie), "21:30");
  assert.equal(heureDeChamp(MINUIT), "00:00");
  assert.equal(heureDeLaJournee(base(), 6, t, 0, 0)!.getTime(), MINUIT.getTime(), "0 h 00 : minuit, le soir même");
  const regle = fixerFinDuVote(base(), 6, t, choisie);
  assert.equal(fin(regle, t), h("21:30").getTime());
  assert.equal(rev(regle, t), h("22:30").getTime());
  assert.equal(voteOuvertA(regle, 6, h("21:29")), true);
  assert.equal(voteOuvertA(regle, 6, h("21:30")), false);
  assert.equal(journeeComptee(regle, 6, h("22:29")), false);
  assert.equal(journeeComptee(regle, 6, h("22:30")), true);
  assert.equal(libelleFinDuVote(regle, 6, h("19:00")), "21 h 30");
  assert.equal(libelleRevelation(regle, 6, h("19:00")), "22 h 30");
  // L'heure avancée, le vote ouvert : 20 h au lieu de 21 h 30.
  const avance = fixerFinDuVote(regle, 6, h("19:10"), h("20:00"));
  assert.equal(fin(avance, h("19:10")), h("20:00").getTime());
  assert.equal(rev(avance, h("19:10")), h("21:00").getTime());
  assert.equal(fixerFinDuVote(avance, 6, h("19:20"), h("20:00")), avance, "la même heure : même référence");
  // 23 h 30 : la révélation à minuit, jamais après. Minuit : comme « gardé ouvert ».
  assert.equal(rev(fixerFinDuVote(base(), 6, t, h("23:30")), t), MINUIT.getTime());
  const aMinuit = fixerFinDuVote(base(), 6, t, MINUIT);
  assert.equal(j6(aMinuit).votesFermesLe, undefined);
  assert.equal(voteGardeOuvert(j6(aMinuit)), true);
  assert.equal(fin(aMinuit, t), MINUIT.getTime());
  // Refusé : une heure passée, l'instant même, après minuit ; rien à régler (révélée, un autre jour).
  for (const [quand, vers, pourquoi] of [
    [t, h("18:00"), "une heure passée"],
    [t, t, "l'instant même"],
    [t, hiver("2026-11-16 00:30"), "après minuit"],
    [h("19:05"), h("21:00"), "la journée révélée (19 h)"],
    [hiver("2026-11-14 18:00"), h("19:00"), "la veille"],
  ] as const) {
    const s = base();
    assert.equal(fixerFinDuVote(s, 6, quand, vers), s, `${pourquoi} : même référence`);
  }
  // Fermé à la main avant l'heure choisie : la fermeture l'emporte, et se rouvre.
  const coupe = fermerLeVote(regle, 6, h("19:00"));
  assert.equal(j6(coupe).votesOuvertsLe, undefined);
  assert.equal(finChoisie(j6(coupe)), null);
  assert.equal(fin(coupe, h("19:10")), h("19:00").getTime());
  assert.deepEqual(reglageDuVote(coupe, 6, h("18:59")), { garder: false, fermer: false, rouvrir: true }, "fermé à la main : fermé, l'écran en retard d'une minute compris");
  // La fin des matchs inconnue (une feuille reprise) : l'heure choisie tient.
  const reprise = saison({ finie: true, f: null });
  const tenue = fixerFinDuVote(reprise, 6, t, h("20:00"));
  assert.equal(fin(tenue, t), h("20:00").getTime());
  assert.equal(etatRevelation(tenue, 6, h("19:00")), "vote");
  assert.equal(etatRevelation(tenue, 6, h("20:30")), "attente");
  assert.equal(libelleRevelation(tenue, 6, h("19:00")), "21 h");
  // Une journée comptée ne se décompte pas : l'heure posée après la révélation est retirée.
  const tardif: Saison = { ...base(), journees: base().journees.map((m) => (m.j === 6 ? { ...m, votesOuvertsLe: h("19:05").toISOString(), votesFermesLe: h("21:00").toISOString() } : m)) };
  const tenu = tenirMainSurLeVote(base(), tardif, h("19:05"));
  assert.equal(j6(tenu).votesFermesLe, undefined, "le geste tardif est retiré");
  assert.equal(j6(tenu).votesOuvertsLe, undefined);
}

console.log("votes-main-check : la règle sans geste, garder ouvert, fermer, rouvrir, ce qui se propose, jamais décomptée, le jour seulement, sans fin des matchs, la fin des matchs tenue, la main de la base reprise, l'heure de fin : ok");
