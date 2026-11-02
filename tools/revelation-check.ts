// Les points figés, la fin du vote et la révélation (lib/sfl/revelation.ts,
// 02/11/2026). Sabri : « Il faut voter avant 18h. Comme ça, à 19h, on a tous
// les points de la journée qui sont entrés » ; puis « une heure de vote
// minimum, jamais après minuit ».
//
// Ce que le banc vérifie :
//   1 · les heures (J4 minuit ; dès la J5 18 h / 19 h, 18 h 40 / 19 h 40,
//       23 h 30 / minuit, minuit / minuit ; sans fin des matchs minuit et
//       aucune révélation ; brouillon et date illisible ; l'heure d'été et
//       d'hiver ; la saison 2 dès la J1) et leurs libellés ;
//   2 · estLeJour répond comme l'ancien voteOuvert ;
//   3 · voteOuvertA (J5 : 17 h 59 ouvert, 18 h fermé, la veille fermé ; J4 :
//       23 h 59 ouvert, minuit fermé) ;
//   4-6 · un dimanche de J5 simulé minute par minute, de 12 h à 0 h 30 : le
//       direct ne bouge ni un point ni une division jusqu'à 18 h 59 ; tout
//       entre à 19 h (points, élus du vote, divisions, au moins une montée,
//       la fin des missions) ; jamais un D2 au-dessus d'un D1 ; les
//       divisions ne bougent qu'une fois ;
//   7 · la J4 compte dès le premier but, ses élus tombent à minuit, figer
//       n'y touche pas ;
//   8 · révélée puis rouverte ; bloquée (visible de l'admin) puis comptée le
//       lundi ; un match fini à 17 h 40 et à 23 h 15 ; votesPrets ;
//   9 · figer : idempotente, même référence, feuille posée intacte, jamais
//       enregistrée (saisieStore.save) ;
//   10 · lireSaisonServeur rend la même vue que le SeasonProvider.
//   npx tsx tools/revelation-check.ts
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  estLeJour,
  jourMoisDuLibelle,
} from "../src/lib/sfl/convocation-temps";
import {
  etatRevelation,
  figer,
  finDuVote,
  journeeComptee,
  journeesComptees,
  libelleFinDuVote,
  libelleRevelation,
  nouveauRegime,
  prochaineTransition,
  revelation,
  revelationAttendue,
  titresTombes,
  voteOuvertA,
} from "../src/lib/sfl/revelation";
import { dernierBilan, etatDivisions, type Division } from "../src/lib/sfl/divisions";
import { computeJournees, deriveSeason, journeeJouee } from "../src/lib/sfl/saisie/engine";
import { heuresDeJournee } from "../src/lib/sfl/missions";
import { appliquerVotes, titresFaibles, type VoteFigure } from "../src/lib/sfl/votes";
import { lireSaisonServeur, saisonAvecVotes } from "../src/lib/sfl/saison-serveur.server";
import { saisieStore } from "../src/lib/sfl/saisie/store";
import { etatJournee, gesteDuMoment } from "../src/lib/sfl/saisie/etat-journee";
import { cloturerSaison } from "../src/lib/sfl/saisie/mutations";
import type { JourneeMeta, MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

/** Une heure de Paris en hiver (UTC+1) : « 2026-11-08 18:00 ». */
const hiver = (s: string) => new Date(`${s.replace(" ", "T")}:00+01:00`);
const ete = (s: string) => new Date(`${s.replace(" ", "T")}:00+02:00`);
const iso = (d: Date) => d.toISOString();
const meta = (j: number, date: string, extra: Partial<JourneeMeta> = {}): JourneeMeta => ({ j, date, sflTime: true, mvpAuto: true, ...extra });

/* ------------------------------- 1 · Les heures ------------------------------- */
{
  const ref = hiver("2026-11-08 12:00");
  const cas: [string, JourneeMeta, number, Date | null, Date | null][] = [
    ["J4 de la saison 1", meta(4, "1 nov."), 1, hiver("2026-11-02 00:00"), hiver("2026-11-02 00:00")],
    ["J5, F = 15 h 10", meta(5, "8 nov.", { finDesMatchs: iso(hiver("2026-11-08 15:10")) }), 1, hiver("2026-11-08 18:00"), hiver("2026-11-08 19:00")],
    ["F = 17 h 40", meta(5, "8 nov.", { finDesMatchs: iso(hiver("2026-11-08 17:40")) }), 1, hiver("2026-11-08 18:40"), hiver("2026-11-08 19:40")],
    ["F = 22 h 30", meta(5, "8 nov.", { finDesMatchs: iso(hiver("2026-11-08 22:30")) }), 1, hiver("2026-11-08 23:30"), hiver("2026-11-09 00:00")],
    ["F = 23 h 15", meta(5, "8 nov.", { finDesMatchs: iso(hiver("2026-11-08 23:15")) }), 1, hiver("2026-11-09 00:00"), hiver("2026-11-09 00:00")],
    ["F absent", meta(5, "8 nov."), 1, hiver("2026-11-09 00:00"), null],
    ["date illisible", meta(5, "bientôt", { finDesMatchs: iso(hiver("2026-11-08 15:10")) }), 1, null, null],
    ["brouillon", meta(5, "8 nov.", { brouillon: { depuis: "x", par: "Sabri" } }), 1, null, null],
    ["saison 2, J1 (nouveau régime)", meta(1, "8 nov.", { finDesMatchs: iso(hiver("2026-11-08 15:10")) }), 2, hiver("2026-11-08 18:00"), hiver("2026-11-08 19:00")],
    ["saison 0 (ancien régime)", meta(9, "8 nov.", { finDesMatchs: iso(hiver("2026-11-08 15:10")) }), 0, hiver("2026-11-09 00:00"), hiver("2026-11-09 00:00")],
  ];
  for (const [nom, m, numero, fin, rev] of cas) {
    assert.equal(finDuVote(m, numero, ref)?.getTime() ?? null, fin?.getTime() ?? null, `fin du vote : ${nom}`);
    assert.equal(revelation(m, numero, ref)?.getTime() ?? null, rev?.getTime() ?? null, `révélation : ${nom}`);
  }
  // L'heure d'été (dimanche 28 mars 2027, le jour même du changement) et l'hiver (25 octobre 2026, idem).
  const mars = meta(1, "28 mars", { finDesMatchs: iso(ete("2027-03-28 15:00")) });
  assert.equal(finDuVote(mars, 2, ete("2027-03-28 12:00"))!.toISOString(), "2027-03-28T16:00:00.000Z", "18 h d'été = 16 h UTC");
  assert.equal(revelation(mars, 2, ete("2027-03-28 12:00"))!.toISOString(), "2027-03-28T17:00:00.000Z", "19 h d'été = 17 h UTC");
  const octobre = meta(1, "25 oct.", { finDesMatchs: iso(hiver("2026-10-25 15:00")) });
  assert.equal(finDuVote(octobre, 2, hiver("2026-10-25 12:00"))!.toISOString(), "2026-10-25T17:00:00.000Z", "18 h d'hiver = 17 h UTC");
  assert.equal(revelation({ ...octobre, finDesMatchs: iso(hiver("2026-10-25 23:30")) }, 2, hiver("2026-10-25 12:00"))!.toISOString(), "2026-10-25T23:00:00.000Z", "minuit d'hiver = 23 h UTC");
  assert.ok(nouveauRegime(1, 5) && !nouveauRegime(1, 4) && nouveauRegime(2, 1) && !nouveauRegime(0, 30));

  // Les libellés.
  const s = (m: JourneeMeta, numero = 1) => ({ numero, journees: [m] });
  assert.equal(libelleFinDuVote(s(meta(4, "1 nov.")), 4, hiver("2026-11-01 15:00")), "minuit");
  assert.equal(libelleFinDuVote(s(cas[1][1]), 5, ref), "18 h");
  assert.equal(libelleRevelation(s(cas[1][1]), 5, ref), "19 h");
  assert.equal(libelleFinDuVote(s(cas[2][1]), 5, ref), "18 h 40");
  assert.equal(libelleRevelation(s(cas[2][1]), 5, ref), "19 h 40");
  assert.equal(libelleRevelation(s(cas[3][1]), 5, ref), "minuit");
  assert.equal(libelleFinDuVote(s(cas[4][1]), 5, ref), "minuit");
  assert.equal(libelleFinDuVote(s(meta(5, "8 nov.")), 5, hiver("2026-11-08 16:59")), "18 h", "F inconnu avant 17 h");
  assert.equal(libelleFinDuVote(s(meta(5, "8 nov.")), 5, hiver("2026-11-08 17:00")), "1 h après le dernier match");
  assert.equal(libelleRevelation(s(meta(5, "8 nov.")), 5, hiver("2026-11-08 16:00")), "19 h");
  assert.equal(libelleRevelation(s(meta(5, "8 nov.")), 5, hiver("2026-11-08 17:30")), "2 h après le dernier match");
}

/* -------------------------- 2 · estLeJour = l'ancien voteOuvert -------------------------- */
{
  // L'ancien corps, recopié de convocation-temps.ts (avant le 02/11/2026).
  const ancien = (libelle: string, maintenant: Date) => {
    const jm = jourMoisDuLibelle(libelle);
    if (!jm) return false;
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", day: "numeric", month: "numeric" }).formatToParts(maintenant);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return get("day") === jm.jour && get("month") === jm.mois;
  };
  const libelles = ["1 nov.", "8 nov.", "J5 · 8 novembre", "28 mars", "25 oct.", "bientôt", ""];
  let n = 0;
  for (let t = hiver("2026-10-24 22:00").getTime(); t < hiver("2026-11-10 02:00").getTime(); t += 23 * 60_000) {
    for (const l of libelles) {
      assert.equal(estLeJour(l, new Date(t)), ancien(l, new Date(t)), `${l} à ${new Date(t).toISOString()}`);
      n++;
    }
  }
  for (const t of [hiver("2026-11-08 23:59"), hiver("2026-11-09 00:00"), hiver("2026-11-08 00:00"), hiver("2026-11-07 23:59")])
    assert.equal(estLeJour("8 nov.", t), ancien("8 nov.", t));
  assert.ok(estLeJour("8 nov.", hiver("2026-11-08 23:59")) && !estLeJour("8 nov.", hiver("2026-11-09 00:00")));
  assert.ok(n > 1000);
}

/* --------------------------------- 3 · voteOuvertA --------------------------------- */
{
  const s = { numero: 1, journees: [meta(4, "1 nov."), meta(5, "8 nov.", { finDesMatchs: iso(hiver("2026-11-08 15:00")) })] };
  assert.equal(voteOuvertA(s, 5, hiver("2026-11-08 17:59")), true, "17 h 59");
  assert.equal(voteOuvertA(s, 5, hiver("2026-11-08 18:00")), false, "18 h 00");
  assert.equal(voteOuvertA(s, 5, hiver("2026-11-07 12:00")), false, "la veille");
  assert.equal(voteOuvertA(s, 4, hiver("2026-11-01 23:59")), true, "J4 23 h 59");
  assert.equal(voteOuvertA(s, 4, hiver("2026-11-02 00:00")), false, "J4 minuit");
}

/* ------------------------------- La ligue simulée ------------------------------- */
// 70 joueurs : J1 à J3 de 40 pts (J01) à 6 pts (J70), la J4 jouée à plat
// (l'ancien régime), puis la J5 du dimanche 8 novembre : deux matchs, la D3
// au Match 1 (ses vainqueurs passent le bas de la D2), le bord de la D1 au
// Match 2.
const ligne = (j: number, player: string, extra: Partial<MatchEntry> = {}): MatchEntry => ({
  j, player, team: null, statut: "Présent", result: "Défaite", sflTime: true,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false, ...extra,
});
const NOMS = Array.from({ length: 70 }, (_, i) => `J${String(i + 1).padStart(2, "0")}`);
const total = (i: number) => Math.max(3, 40 - Math.floor(i / 2));
const m1 = { noirs: NOMS.slice(60, 65), blancs: NOMS.slice(65, 70) }; // J61-J65 contre J66-J70 (la D3, sous le bas de la D2)
const m2 = { noirs: NOMS.slice(25, 30), blancs: NOMS.slice(30, 35) }; // J26-J30 contre J31-J35 (le bord de la D1)
const poser = (j: number, m: { noirs: string[]; blancs: string[] }, n: number) => [
  ...m.noirs.map((p) => ligne(j, p, { team: `Noirs ${n}`, result: null })),
  ...m.blancs.map((p) => ligne(j, p, { team: `Blancs ${n}`, result: null })),
];
const SAMEDI: Saison = {
  numero: 1,
  journees: [meta(1, "11 oct."), meta(2, "18 oct."), meta(3, "25 oct."), meta(4, "1 nov."), meta(5, "8 nov.")],
  roster: NOMS.map((name) => ({ name, poste: null, profil: "Actif", base: null })),
  entries: [
    ...NOMS.flatMap((n, i) => [1, 2, 3].map((j) => ligne(j, n, { pepiteBonus: (j < 3 ? Math.ceil(total(i) / 3) : total(i) - 2 * Math.ceil(total(i) / 3)) - 1 }))),
    ...NOMS.slice(0, 20).map((n) => ligne(4, n, { result: "Nul" })),
    ...poser(5, m1, 1),
    ...poser(5, m2, 2),
  ],
  convocations: [],
};

/** Le dimanche tel que la base le voit à l'instant t (le direct). */
function direct(t: Date): Saison {
  const a = (h: string) => t.getTime() >= hiver(`2026-11-08 ${h}`).getTime();
  const entries = SAMEDI.entries.map((e) => {
    if (e.j !== 5) return e;
    let x = e;
    if (e.player === "J61" && a("13:10")) x = { ...x, buts: a("13:40") ? 4 : 1 };
    if (e.team === "Noirs 1" && a("14:00")) x = { ...x, result: "Victoire", mvp: e.player === "J61" };
    if (e.team === "Blancs 1" && a("14:00")) x = { ...x, result: "Défaite" };
    if (e.player === "J26" && a("14:30")) x = { ...x, buts: 1 };
    if ((e.team === "Noirs 2" || e.team === "Blancs 2") && a("15:10")) x = { ...x, result: e.team === "Noirs 2" ? "Victoire" : "Défaite" };
    return x;
  });
  const journees = a("15:10") ? SAMEDI.journees.map((m) => (m.j === 5 ? { ...m, finDesMatchs: iso(hiver("2026-11-08 15:10")) } : m)) : SAMEDI.journees;
  return { ...SAMEDI, entries, journees };
}
// Les votes du Match 2 : J31 (Blancs 2) élu Impact par trois Noirs 2.
const jn5 = computeJournees(direct(hiver("2026-11-08 16:00"))).find((x) => x.j === 5)!;
const match2 = jn5.matches!.find((m) => m.teamA.name === "Noirs 2" || m.teamB.name === "Noirs 2")!;
const VOTES: VoteFigure[] = m2.noirs.slice(0, 3).map((v) => ({ saison: 1, j: 5, categorie: "impact", votant: v, candidat: "J31", match_id: match2.id, jour: "2026-11-08" }));

/** Ce que voit la ligue à l'instant t : la vue du SeasonProvider. */
function vue(t: Date, votes = VOTES): Saison {
  const d = direct(t);
  const titree = saisonAvecVotes(d, votes, t);
  return figer(titree, t);
}
const ppDe = (s: Saison) => new Map(deriveSeason(s).players.map((p) => [p.name, p.pp]));
const cle = (m: Map<string, unknown>) => JSON.stringify([...m].sort());

/* ------------------- 4-6 · Le dimanche, minute par minute ------------------- */
{
  const samedi = vue(hiver("2026-11-07 20:00"));
  const ppSamedi = cle(ppDe(samedi));
  const divSamedi = cle(etatDivisions(samedi)!.actuelle);
  let changements = 0;
  let avant = divSamedi;
  let quand: string | null = null;
  const cache = new Map<string, { pp: string; div: string; invariant: boolean }>();
  let minutes = 0;
  for (let t = hiver("2026-11-08 12:00").getTime(); t <= hiver("2026-11-09 00:30").getTime(); t += 60_000) {
    minutes++;
    const ici = new Date(t);
    const v = vue(ici);
    // Même vue, même résultat : on ne recalcule que quand la vue change.
    const k = JSON.stringify([v.entries.filter((e) => e.j === 5), v.figee?.caches ?? null]);
    let r = cache.get(k);
    if (!r) {
      const pp = ppDe(v);
      const etat = etatDivisions(v)!;
      const de = (x: Division) => etat.decoupage.divisions[x].map((p) => pp.get(p.nom)!);
      const invariant = Math.max(...de(2)) <= Math.min(...de(1)) && Math.max(...de(3)) <= Math.min(...de(2));
      r = { pp: cle(pp), div: cle(etat.actuelle), invariant };
      cache.set(k, r);
    }
    assert.ok(r.invariant, `jamais un D2 au-dessus d'un D1 (${ici.toISOString()})`);
    if (t < hiver("2026-11-08 19:00").getTime()) {
      assert.equal(r.pp, ppSamedi, `le direct ne bouge aucun point (${ici.toISOString()})`);
      assert.equal(r.div, divSamedi, `le direct ne bouge aucune division (${ici.toISOString()})`);
    }
    if (r.div !== avant) {
      changements++;
      quand = ici.toISOString();
      avant = r.div;
    }
  }
  assert.equal(minutes, 751);
  assert.equal(changements, 1, "les divisions ne bougent qu'une fois");
  assert.equal(quand, hiver("2026-11-08 19:00").toISOString(), "à la révélation");

  // 5 · À 19 h, tout entre.
  const a19 = hiver("2026-11-08 19:00");
  const titree = saisonAvecVotes(direct(a19), VOTES, a19);
  assert.deepEqual(vue(a19), figer(titree, a19));
  assert.equal(figer(titree, a19), titree, "rien de figé à 19 h");
  assert.equal(cle(ppDe(vue(a19))), cle(ppDe(titree)), "les points du direct plus les votes");
  const impact = (s: Saison) => s.entries.find((e) => e.j === 5 && e.player === "J31")!.impact;
  assert.equal(impact(vue(a19)), true, "l'élu Impact posé à 19 h");
  for (const h of ["18:00", "18:59"]) {
    const t = hiver(`2026-11-08 ${h}`);
    assert.equal(impact(saisonAvecVotes(direct(t), VOTES, t)), false, `pas d'élu à ${h}`);
    assert.equal(titresTombes(direct(t), 5, t), false);
  }
  const b = dernierBilan(etatDivisions(vue(a19)));
  assert.equal(b?.j, 5);
  assert.ok(b!.montees >= 1 && b!.descentes >= 1, `des montées et des descentes (${b!.montees} / ${b!.descentes})`);
  assert.equal(heuresDeJournee(direct(a19), 5, a19)!.finDuJour.getTime(), a19.getTime(), "les missions se jugent à 19 h");
  assert.equal(heuresDeJournee(direct(hiver("2026-11-08 12:00")), 5, a19)!.finDuJour.getTime(), hiver("2026-11-09 00:00").getTime(), "avant la fin des matchs : minuit");
  // Le minuteur : la prochaine heure qui change quelque chose.
  assert.equal(prochaineTransition(direct(hiver("2026-11-08 15:20")), hiver("2026-11-08 15:20"))!.getTime(), hiver("2026-11-08 17:00").getTime());
  assert.equal(prochaineTransition(direct(hiver("2026-11-08 17:30")), hiver("2026-11-08 17:30"))!.getTime(), hiver("2026-11-08 18:00").getTime());
  assert.equal(prochaineTransition(direct(hiver("2026-11-08 18:00")), hiver("2026-11-08 18:00"))!.getTime(), a19.getTime());
  // L'état, pour l'admin et la frise.
  const etat = (h: string) => etatRevelation(direct(hiver(`2026-11-08 ${h}`)), 5, hiver(`2026-11-08 ${h}`));
  assert.deepEqual(["12:00", "13:30", "15:30", "18:30", "19:00"].map(etat), ["a-venir", "en-direct", "vote", "attente", "revelee"]);
  assert.deepEqual(
    ["13:30", "15:30", "18:30", "19:00"].map((h) => etatJournee(direct(hiver(`2026-11-08 ${h}`)), 5, hiver(`2026-11-08 ${h}`))),
    ["en-direct", "vote", "attente", "revelee"]
  );
  assert.deepEqual(gesteDuMoment(direct(hiver("2026-11-08 18:30")), 5, hiver("2026-11-08 18:30")), { t: "revelation", j: 5, heure: "19 h" });
  // La clôture attend la révélation.
  const d1830 = direct(hiver("2026-11-08 18:30"));
  assert.equal(revelationAttendue(d1830, hiver("2026-11-08 18:30")), 5);
  assert.equal(revelationAttendue(direct(a19), a19), null);
  assert.equal(cloturerSaison(d1830), d1830, "pas de clôture avant la révélation");
}

/* ------------------------- 7 · La J4 : l'ancien régime ------------------------- */
{
  const j4: Saison = {
    ...SAMEDI,
    journees: SAMEDI.journees.filter((m) => m.j <= 4),
    entries: [...SAMEDI.entries.filter((e) => e.j < 4), ...poser(4, m1, 1)],
  };
  const enDirect: Saison = { ...j4, entries: j4.entries.map((e) => (e.j === 4 && e.player === "J61" ? { ...e, buts: 1 } : e)) };
  const t = hiver("2026-11-01 14:00");
  assert.ok(journeeComptee(enDirect, 4, t), "la J4 compte dès le premier but");
  assert.equal(figer(enDirect, t), enDirect, "figer ne touche pas la J4");
  assert.equal(titresTombes(enDirect, 4, hiver("2026-11-01 23:59")), false, "ses élus à minuit, pas à 23 h 59");
  assert.equal(titresTombes(enDirect, 4, hiver("2026-11-02 00:00")), true);
  assert.equal(etatRevelation(enDirect, 4, t), "en-direct");
}

/* ------------------------------ 8 · Les cas limites ------------------------------ */
{
  // Révélée puis rouverte : un match ajouté sans résultat. Elle reste comptée, l'invariant tient.
  const t = hiver("2026-11-08 21:00");
  const rouverte: Saison = { ...direct(t), entries: [...direct(t).entries, ...poser(5, { noirs: NOMS.slice(40, 45), blancs: NOMS.slice(45, 50) }, 3)] };
  assert.ok(journeeComptee(rouverte, 5, t));
  const v = figer(saisonAvecVotes(rouverte, VOTES, t), t);
  const pp = ppDe(v);
  const etat = etatDivisions(v)!;
  const de = (x: Division) => etat.decoupage.divisions[x].map((p) => pp.get(p.nom)!);
  assert.ok(Math.max(...de(2)) <= Math.min(...de(1)), "révélée puis rouverte : l'invariant tient");
  assert.equal(etat.pour, 6);

  // Bloquée : le Match 2 sans résultat, jamais de fin des matchs.
  const bloquee = (t: Date, saisi = false): Saison => {
    const d = direct(hiver("2026-11-08 14:45"));
    return saisi ? { ...d, entries: d.entries.map((e) => (e.j === 5 && (e.team === "Noirs 2" || e.team === "Blancs 2") ? { ...e, result: "Nul" } : e)) } : (void t, d);
  };
  for (const h of ["2026-11-08 19:00", "2026-11-08 23:59", "2026-11-09 00:30", "2026-11-09 10:00"]) {
    const t = hiver(h);
    assert.equal(journeeComptee(bloquee(t), 5, t), false, `bloquée, pas comptée (${h})`);
  }
  assert.equal(etatRevelation(bloquee(hiver("2026-11-08 20:00")), 5, hiver("2026-11-08 20:00")), "en-direct");
  assert.equal(etatRevelation(bloquee(hiver("2026-11-09 10:00")), 5, hiver("2026-11-09 10:00")), "bloquee", "visible de l'admin le lundi");
  assert.equal(etatJournee(bloquee(hiver("2026-11-09 10:00")), 5, hiver("2026-11-09 10:00")), "bloquee");
  assert.deepEqual(gesteDuMoment(bloquee(hiver("2026-11-09 10:00")), 5, hiver("2026-11-09 10:00")), { t: "bloquee", j: 5, equipes: ["Noirs 2", "Blancs 2"] });
  assert.equal(journeeComptee(bloquee(hiver("2026-11-09 10:05"), true), 5, hiver("2026-11-09 10:05")), true, "le résultat saisi le lundi, sans tampon : comptée");

  // Un match fini à 17 h 40 : vote jusqu'à 18 h 40, révélation à 19 h 40.
  const tard = (f: string, t: Date): Saison => ({
    ...direct(t),
    journees: direct(t).journees.map((m) => (m.j === 5 ? { ...m, finDesMatchs: iso(hiver(`2026-11-08 ${f}`)) } : m)),
  });
  const h = (x: string) => hiver(`2026-11-08 ${x}`);
  assert.equal(voteOuvertA(tard("17:40", h("18:39")), 5, h("18:39")), true);
  assert.equal(voteOuvertA(tard("17:40", h("18:40")), 5, h("18:40")), false);
  assert.equal(journeeComptee(tard("17:40", h("19:39")), 5, h("19:39")), false);
  assert.equal(journeeComptee(tard("17:40", h("19:40")), 5, h("19:40")), true);
  // Fini à 23 h 15 : les deux à minuit.
  assert.equal(voteOuvertA(tard("23:15", h("23:59")), 5, h("23:59")), true);
  assert.equal(journeeComptee(tard("23:15", h("23:59")), 5, h("23:59")), false);
  assert.equal(voteOuvertA(tard("23:15", hiver("2026-11-09 00:00")), 5, hiver("2026-11-09 00:00")), false);
  assert.equal(journeeComptee(tard("23:15", hiver("2026-11-09 00:00")), 5, hiver("2026-11-09 00:00")), true);

  // votesPrets : retient une journée avec vote, pas une journée sans vote.
  const a20 = h("20:00");
  assert.equal(journeeComptee(direct(a20), 5, a20, { votesPrets: false }), false);
  const sansVote: Saison = { ...direct(a20), journees: direct(a20).journees.map((m) => (m.j === 5 ? { ...m, mvpAuto: false } : m)) };
  assert.equal(journeeComptee(sansVote, 5, a20, { votesPrets: false }), true);
  assert.deepEqual([...journeesComptees(direct(a20), a20)], [1, 2, 3, 4, 5]);
}

/* ------------------------------------ 9 · figer ------------------------------------ */
{
  const t = hiver("2026-11-08 16:00");
  const d = direct(t);
  const f = figer(d, t);
  assert.notEqual(f, d);
  assert.deepEqual(f.figee?.caches, [5]);
  assert.equal(figer(f, t), f, "idempotente : rien de plus à figer");
  assert.equal(figer(SAMEDI, t), SAMEDI, "rien à figer : même référence");
  assert.deepEqual(
    f.entries.filter((e) => e.j === 5),
    SAMEDI.entries.filter((e) => e.j === 5),
    "la feuille posée, telle quelle"
  );
  assert.ok(!journeeJouee(f, 5));
  const refus = saisieStore.save(f);
  assert.ok(refus.some((e) => e.r === "I10"), "une vue figée ne s'enregistre jamais");
  // Les titres faibles ne portent que sur les journées comptées.
  assert.equal(titresFaibles(d, computeJournees(d), VOTES, t).size, 0);
  // Les votes ne s'appliquent pas avant la révélation.
  assert.equal(appliquerVotes(d, computeJournees(d), VOTES, t), d);
}

/* ------------------------------------ 10 · Les portes ------------------------------------ */
function faux(doc: Saison, votes: VoteFigure[]): SupabaseClient {
  const requete = (table: string) => {
    const q: Record<string, unknown> = {};
    const fin = () =>
      table === "saison"
        ? { data: { data: doc, updated_at: "2026-11-08T14:10:00Z" }, error: null }
        : table === "votes_figures"
          ? { data: votes, error: null }
          : { data: [], error: null };
    for (const m of ["select", "eq", "order", "in"]) q[m] = () => q;
    q.maybeSingle = async () => fin();
    q.range = async () => fin();
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(fin()).then(ok);
    return q;
  };
  return { from: requete } as unknown as SupabaseClient;
}

void (async () => {
  for (const h of ["16:00", "18:30", "19:00"]) {
    const t = hiver(`2026-11-08 ${h}`);
    const lue = (await lireSaisonServeur(faux(direct(t), VOTES), t))!;
    const v = vue(t);
    assert.deepEqual(lue.saison.entries, v.entries, `le serveur lit la même vue (${h})`);
    assert.deepEqual(lue.saison.figee?.caches ?? null, v.figee?.caches ?? null);
    assert.deepEqual(lue.direct, direct(t), "le direct, tel quel");
    assert.deepEqual([...lue.divisions!.actuelle], [...etatDivisions(v)!.actuelle], "les mêmes divisions");
    assert.equal(lue.comptees.has(5), h === "19:00");
    assert.ok(!lue.brute.entries.some((e) => e.j === 5 && e.result) || h === "19:00", "brute aussi figée");
  }
  console.log(
    "revelation-check : heures et libellés, estLeJour, voteOuvertA, dimanche minute par minute (rien ne bouge avant 19 h, tout à 19 h, jamais un D2 au-dessus d'un D1), J4 à minuit, cas limites, figer, portes — ok"
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
