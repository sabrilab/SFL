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
//   7 · un geste ne vaut que le jour de la journée (une journée déplacée
//       repart de la règle) ; la fermeture l'emporte sur l'ouverture ;
//   8 · la fin des matchs inconnue : fermé à la main, gardé ouvert ;
//   9 · la main ne décale pas la fin des matchs (tenirFinDesMatchs).
// Aucune heure du jour n'est lue : tout instant est donné.
//   npx tsx tools/votes-main-check.ts
import assert from "node:assert/strict";
import {
  etatRevelation,
  fermerLeVote,
  finDuVote,
  garderLeVoteOuvert,
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

console.log("votes-main-check : la règle sans geste, garder ouvert, fermer, rouvrir, ce qui se propose, jamais décomptée, le jour seulement, sans fin des matchs, la fin des matchs tenue : ok");
