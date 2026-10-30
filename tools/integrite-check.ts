// Les règles d'une feuille saine (saisie/integrite.ts, 30/10/2026) : plus
// jamais les matchs 5 et 6 ni les doublons de la J3.
//   npx tsx tools/integrite-check.ts
import assert from "node:assert/strict";
import { bloquantsEcriture, bloquantsPublication, cleEcart, nouveauxEcarts, verifierFeuille, type Ecart } from "../src/lib/sfl/saisie/integrite";
import { ajouterMatch, matchsDeclares, newEntry, preparerJournee, retirerMatchVide } from "../src/lib/sfl/saisie/mutations";
import { choixDEquipe } from "../src/lib/sfl/saisie/equipes";
import { computeJournees } from "../src/lib/sfl/saisie/engine";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

const L = (j: number, player: string, team: string | null, p: Partial<MatchEntry> = {}): MatchEntry => ({ ...newEntry(j, player, team), ...p });
const regles = (e: Ecart[]) => e.map((x) => x.r).sort();

// Une J4 saine : 2 matchs de 2 contre 2 (assez pour les règles).
const base: Saison = {
  journees: [
    { j: 3, date: "26 oct.", sflTime: false, heure: "12h30" },
    { j: 4, date: "2 nov.", sflTime: false, heure: "12h30", matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }, { equipes: ["Noirs 2", "Blancs 2"] }] },
  ],
  roster: ["Ilyes", "Anis", "Badis", "Sami", "Naim", "Kader", "Mehdi", "Adil", "Sabri"].map((name) => ({ name, poste: null, profil: "Actif", base: null })),
  entries: [
    L(4, "Ilyes", "Noirs 1"), L(4, "Anis", "Noirs 1"), L(4, "Badis", "Blancs 1"), L(4, "Sami", "Blancs 1"),
    L(4, "Naim", "Noirs 2"), L(4, "Kader", "Noirs 2"), L(4, "Mehdi", "Blancs 2"), L(4, "Adil", "Blancs 2"),
  ],
  convocations: [],
};
assert.deepEqual(verifierFeuille(base, 4), [], "la J4 est saine");

// I0 · une ligne vitrine.
assert.deepEqual(regles(verifierFeuille({ ...base, entries: [...base.entries, { ...L(4, "Toto", "Noirs 1"), vitrine: true }] }, 4)), ["I0"]);
// I1 · un doublon (sans casse) ; la ligne Xtratime n'en est pas un.
assert.deepEqual(regles(verifierFeuille({ ...base, entries: [...base.entries, L(4, "ilyes", "Blancs 2")] }, 4)), ["I1"]);
assert.deepEqual(verifierFeuille({ ...base, entries: [...base.entries, L(4, "Ilyes", "Blancs 2", { extraTime: true })] }, 4), []);
// I2 · un membre qui ne joue pas.
assert.deepEqual(regles(verifierFeuille({ ...base, entries: [...base.entries, L(4, "Sabri", "Blancs 2")] }, 4)), ["I2"]);
// I3 · un camp hors des matchs déclarés (le « Match 5 » de la J3).
assert.deepEqual(regles(verifierFeuille({ ...base, entries: [...base.entries, L(4, "Ilyes2", "Noirs 5")] }, 4)), ["I3"]);
// I4 · un match aux deux camps identiques.
const i4: Saison = { ...base, journees: base.journees.map((m) => (m.j === 4 ? { ...m, matchsDuJour: [...m.matchsDuJour!, { equipes: ["Noirs 9", "Noirs 9"] as [string, string] }] } : m)) };
assert.ok(regles(verifierFeuille(i4, 4)).includes("I4"));
// I5 · un match vide (« + Match 3 » sans joueurs), et trop de matchs à la même heure.
const plus = ajouterMatch(base, 4, { heure: "12h30" }, 2);
assert.deepEqual(plus.equipes, ["Noirs 3", "Blancs 3"], "numéroté max + 1");
assert.equal(plus.saison.entries.length, base.entries.length, "ajouterMatch n'ajoute aucun joueur");
assert.deepEqual(regles(verifierFeuille(plus.saison, 4)), ["I5"]);
const auto = ajouterMatch(base, 4, {}, 2);
assert.equal(matchsDeclares(auto.saison, 4)[2].heure, undefined, "le créneau de 12h30 est plein : pas d'heure inventée");
assert.equal(computeJournees(plus.saison).find((x) => x.j === 4)!.matches!.length, 2, "un match vide ne se voit pas chez les joueurs");
assert.equal(retirerMatchVide(plus.saison, 4, ["Noirs 3", "Blancs 3"]).journees.find((m) => m.j === 4)!.matchsDuJour!.length, 2);
// Les sélecteurs d'équipe offrent le match vide, jamais un « match de plus ».
const offres = choixDEquipe(computeJournees(plus.saison).find((x) => x.j === 4), ["Noirs 1", "Blancs 1", "Noirs 2", "Blancs 2"], matchsDeclares(plus.saison, 4)).map((e) => e.nom);
assert.deepEqual(offres, ["Noirs 1", "Blancs 1", "Noirs 2", "Blancs 2", "Noirs 3", "Blancs 3"]);
assert.ok(!choixDEquipe(computeJournees(base).find((x) => x.j === 4), ["Noirs 1"]).some((e) => e.nom === "Noirs 3"));
// I6 · deux journées pour une même date, et preparerJournee rouvre celle qui existe.
assert.ok(regles(verifierFeuille({ ...base, journees: [...base.journees, { j: 5, date: "2 novembre", sflTime: false }] }, 4)).includes("I6"));
const prep = preparerJournee(base, "2 nov.");
assert.deepEqual([prep.j, prep.existante, prep.saison], [4, true, base]);
const neuve = preparerJournee(base, "9 nov.", { brouillon: { par: "Ilyes", le: new Date("2026-11-03T10:00:00Z") } });
assert.equal(neuve.j, 5);
assert.deepEqual(neuve.saison.journees.at(-1), { j: 5, date: "9 nov.", sflTime: false, mvpAuto: true, heure: "12h30", brouillon: { depuis: "2026-11-03T10:00:00.000Z", par: "Ilyes" } });
// I7 · des résultats incohérents.
const i7: Saison = { ...base, entries: base.entries.map((e) => (e.team === "Noirs 1" || e.team === "Blancs 1" ? { ...e, result: "Victoire" as const } : e)) };
assert.ok(regles(verifierFeuille(i7, 4)).includes("I7"), "deux camps vainqueurs");
// I8 · une écriture qui fait disparaître un brouillon sans « Jeter ».
const brouillon: Saison = { ...base, journees: base.journees.map((m) => (m.j === 4 ? { ...m, brouillon: { depuis: "x", par: "Ilyes" } } : m)) };
const filtree: Saison = { ...brouillon, journees: brouillon.journees.filter((m) => m.j !== 4), entries: [] };
assert.deepEqual(regles(nouveauxEcarts(brouillon, filtree)), ["I8"]);
assert.deepEqual(nouveauxEcarts(brouillon, filtree, { jeter: 4 }), [], "« Jeter le brouillon » l'autorise");

// Un ancien défaut ne bloque jamais ; un nouveau, si.
const vieux: Saison = { ...base, entries: [...base.entries, L(4, "Ilyes", "Blancs 2")] };
const correction: Saison = { ...vieux, entries: vieux.entries.map((e) => (e.player === "Anis" ? { ...e, buts: 2 } : e)) };
assert.deepEqual(nouveauxEcarts(vieux, correction), []);
assert.deepEqual(bloquantsEcriture(nouveauxEcarts(base, vieux)).map(cleEcart), ["I1|4|ilyes"]);

// La J3 de l'incident (28/10) : 4 matchs joués, puis 4 touchers sur « Ajouter
// une équipe » → des Noirs 5 et 6, des joueurs « présents » en double.
const j3: Saison = {
  ...base,
  journees: [{ j: 3, date: "26 oct.", sflTime: false, matchsDuJour: [1, 2, 3, 4].map((n) => ({ equipes: [`Noirs ${n}`, `Blancs ${n}`] as [string, string] })) }],
  entries: [1, 2, 3, 4].flatMap((n) => [L(3, `N${n}`, `Noirs ${n}`, { result: "Victoire", buts: 1 }), L(3, `B${n}`, `Blancs ${n}`, { result: "Défaite" })]),
};
const incident: Saison = { ...j3, entries: [...j3.entries, L(3, "N1", "Noirs 5"), L(3, "B2", "Blancs 6"), L(3, "Sabri", "Noirs 5")] };
const refus = bloquantsEcriture(nouveauxEcarts(j3, incident));
assert.deepEqual(regles(refus), ["I1", "I1", "I2"], "les doublons et Sabri sont refusés à l'écriture");
assert.equal(computeJournees(incident).find((x) => x.j === 3)!.matches!.length, 4, "et le moteur n'invente plus de Match 5");
assert.ok(regles(bloquantsPublication(incident, 3)).includes("I3"));

console.log("integrite-check : I0 à I8, la J3 de l'incident refusée, + Match N vide, une journée par dimanche — ok");
