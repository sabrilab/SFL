// Les cartons de la SFL (lib/sfl/cartons.ts, 01/11/2026) : un retard noté dès
// la J4 de la saison 1 vaut un carton jaune ; trois jaunes, un rouge, et la
// journée suivante suspendue ; tout se relit dans la saison.
//   npx tsx tools/cartons-check.ts
import assert from "node:assert/strict";
import {
  cartonsAMontrer,
  cartonsDe,
  cartonsDeLaSaison,
  cleNotifCarton,
  debutDesCartons,
  leverSuspension,
  retablirSuspension,
  sansSuspendus,
  suspendusPour,
  suspenduPour,
  texteCarton,
} from "../src/lib/sfl/cartons";
import { entryPP } from "../src/lib/sfl/saisie/engine";
import { bloquantsEcriture, bloquantsPublication, nouveauxEcarts } from "../src/lib/sfl/saisie/integrite";
import { addEntry, newEntry, poserEquipes } from "../src/lib/sfl/saisie/mutations";
import { equipesDesVenus } from "../src/lib/sfl/saisie/venus-sur-la-feuille";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

const L = (j: number, player: string, team: string | null, x: Partial<MatchEntry> = {}): MatchEntry => ({ ...newEntry(j, player, team), ...x });
const J = (j: number, date: string, x = {}) => ({ j, date, sflTime: false, ...x });

// 1 · La règle du départ : la J4 de la saison 1 ; rien avant ; dès la J1 ensuite.
assert.equal(debutDesCartons(0), null);
assert.equal(debutDesCartons(1), 4);
assert.equal(debutDesCartons(2), 1);

const base: Saison = {
  numero: 1,
  roster: ["Théo", "Ilyes", "Badis", "Sami"].map((name) => ({ name, poste: null, profil: "Actif", base: null })),
  convocations: [],
  journees: [J(3, "25 oct."), J(4, "1 nov."), J(5, "8 nov."), J(6, "15 nov."), J(7, "22 nov."), J(8, "29 nov.")],
  entries: [
    L(3, "Théo", "Noirs 1", { retard: true, result: "Victoire" }), // avant la J4 : pas de carton
    L(4, "Théo", "Noirs 1", { retard: true, result: "Victoire" }),
    L(4, "Ilyes", "Blancs 1", { retard: true, result: "Défaite" }),
    L(4, "Badis", "Blancs 1", { result: "Défaite" }),
    L(4, "Sami", "Blancs 1", { retard: true, statut: "Absence injustifiée" }), // pas une présence : rien
    L(4, "Sami", "Noirs 2", { retard: true, extraTime: true }), // une ligne Xtratime : rien
  ],
};

// 2 · La J4 : Théo et Ilyes ont leur premier jaune ; ni la J3, ni un absent, ni l'Xtratime.
const c4 = cartonsDeLaSaison(base);
assert.deepEqual([...c4.keys()].sort(), ["ilyes", "théo"]);
assert.deepEqual(cartonsDe(base, "Théo").cartons, [{ id: "s1-j4-jaune", joueur: "Théo", couleur: "jaune", j: 4, rang: 1 }]);
assert.equal(cartonsDe(base, "théo ").serie, 1, "sans casse ni espaces");
assert.deepEqual(cartonsDe(base, "Badis"), { joueur: "Badis", cartons: [], serie: 0, suspensions: [] });
assert.deepEqual(texteCarton(cartonsDe(base, "Théo").cartons[0]), { titre: "Carton jaune", ligne: "Retard · J4 · 1/3" });
assert.equal(cleNotifCarton(cartonsDe(base, "Théo").cartons[0]), "carton-s1-j4-jaune");
// Le malus ne change pas : −1 sur la ligne.
assert.equal(entryPP(base.entries[1]) - entryPP({ ...base.entries[1], retard: false }), -1);
// La saison 0 n'a pas de cartons.
assert.equal(cartonsDeLaSaison({ ...base, numero: 0 }).size, 0);

// 3 · Deux retards de plus (J5, J6) : le troisième jaune fait le rouge, la J7 suspendue.
const s6: Saison = {
  ...base,
  entries: [...base.entries, L(5, "Théo", "Noirs 1", { retard: true }), L(5, "Théo", "Noirs 2", { retard: true, extraTime: true }), L(6, "Théo", "Blancs 1", { retard: true })],
};
const t6 = cartonsDe(s6, "Théo");
assert.deepEqual(t6.cartons.map((c) => [c.id, c.rang, c.suspenduPour]), [
  ["s1-j4-jaune", 1, undefined],
  ["s1-j5-jaune", 2, undefined],
  ["s1-j6-jaune", 3, undefined],
  ["s1-j6-rouge", 3, 7],
]);
assert.equal(t6.serie, 0, "la série repart de zéro après le rouge");
assert.deepEqual(t6.suspensions, [{ j: 7, levee: false }]);
assert.deepEqual(texteCarton(t6.cartons[3]), { titre: "Carton rouge", ligne: "Suspendu pour la J7" });
assert.equal(suspenduPour(s6, "Théo", 7), true);
assert.equal(suspenduPour(s6, "Théo", 8), false, "une journée, pas deux");
assert.deepEqual([...suspendusPour(s6, 7)], ["théo"]);
assert.deepEqual(sansSuspendus(s6, 7, ["Ilyes", "Théo", "Badis"]), ["Ilyes", "Badis"]);
// Après le rouge, un nouveau retard ouvre une nouvelle série.
const s8 = { ...s6, entries: [...s6.entries, L(8, "Théo", "Noirs 1", { retard: true })] };
assert.deepEqual([cartonsDe(s8, "Théo").serie, cartonsDe(s8, "Théo").cartons.at(-1)?.id], [1, "s1-j8-jaune"]);

// 4 · Les cartons pas encore vus, dans l'ordre.
assert.deepEqual(cartonsAMontrer(t6.cartons, new Set(["s1-j4-jaune", "s1-j5-jaune"])).map((c) => c.id), ["s1-j6-jaune", "s1-j6-rouge"]);

// 5 · Une journée en brouillon ne donne pas de carton (la ligue ne la voit pas).
const brouillon = { ...s6, journees: s6.journees.map((m) => (m.j === 6 ? { ...m, brouillon: { depuis: "x", par: "Sabri" } } : m)) };
assert.deepEqual(cartonsDe(brouillon, "Théo").cartons.map((c) => c.id), ["s1-j4-jaune", "s1-j5-jaune"]);

// 6 · L'admin lève la suspension : Théo peut jouer la J7 ; il peut la rétablir.
const levee = leverSuspension(s6, "théo", 7, "Sabri", new Date("2026-11-16T10:00:00Z"));
assert.equal(suspenduPour(levee, "Théo", 7), false);
assert.deepEqual(cartonsDe(levee, "Théo").suspensions, [{ j: 7, levee: true }]);
assert.equal(cartonsDe(levee, "Théo").cartons.length, 4, "le rouge reste un rouge");
assert.equal(suspenduPour(retablirSuspension(levee, "Théo", 7), "Théo", 7), true);
assert.equal(retablirSuspension(s6, "Théo", 7), s6, "rien à rétablir : même saison");

// 7 · L'admin ne place pas un suspendu (I9) ; le retard qui fait le rouge ne
// bloque rien ; une journée qui le porte déjà ne se publie pas.
const ajout = addEntry(s6, L(7, "Théo", "Noirs 1"));
assert.deepEqual(bloquantsEcriture(nouveauxEcarts(s6, ajout)), [{ r: "I9", j: 7, joueur: "Théo" }]);
assert.deepEqual(bloquantsEcriture(nouveauxEcarts(levee, addEntry(levee, L(7, "Théo", "Noirs 1")))), [], "levée : il entre");
assert.deepEqual(bloquantsEcriture(nouveauxEcarts(s6, addEntry(s6, L(7, "Théo", null, { statut: "Suspendu" })))), [], "noté suspendu, sans jouer");
const j7avant = { ...s6, entries: [...s6.entries.filter((e) => !(e.j === 6 && e.player === "Théo")), L(6, "Théo", "Blancs 1"), L(7, "Théo", "Noirs 1"), L(7, "Ilyes", "Blancs 1")] };
const j7apres = { ...j7avant, entries: j7avant.entries.map((e) => (e.j === 6 && e.player === "Théo" ? { ...e, retard: true } : e)) };
assert.equal(suspenduPour(j7apres, "Théo", 7), true);
assert.deepEqual(bloquantsEcriture(nouveauxEcarts(j7avant, j7apres)), [], "noter le retard du rouge passe");
assert.ok(bloquantsPublication(j7apres, 7).some((e) => e.r === "I9" && e.joueur === "Théo"), "la J7 ne se publie pas avec lui");

// 8 · Les compositions : poser les équipes ou placer les « Je viens » laisse le suspendu dehors.
const teams = [
  { name: "Noirs 1", players: ["Théo", "Ilyes"] },
  { name: "Blancs 1", players: ["Badis", "Sami"] },
];
const pose = poserEquipes(s6, 7, teams, "22 nov.");
assert.deepEqual(pose.entries.filter((e) => e.j === 7).map((e) => e.player), ["Ilyes", "Badis", "Sami"]);
assert.deepEqual(bloquantsEcriture(nouveauxEcarts(s6, pose)), []);
const venus = equipesDesVenus({ ...s6, journees: s6.journees.map((m) => (m.j === 7 ? { ...m, matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] as [string, string] }] } : m)) }, 7, ["Théo", "Ilyes", "Badis", "Sami"]);
assert.ok(!venus?.some((t) => t.players.includes("Théo")), "les Je viens : sans lui");

console.log("cartons-check : ok");
