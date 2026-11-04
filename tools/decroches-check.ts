// Les badges du jour (Ilyes, 03/11/2026 : « le badge du jour doit être
// unique : oui et non, choisis »). Le choix : OUI unique là où il est en
// vedette, NON caché ailleurs.
//   · le fil des Actus garde UNE cinématique par joueur et par dimanche, son
//     plus beau badge (pas de fil inondé) ;
//   · la Ligue → Journée, « Ils ont décroché », garde une vitrine par joueur,
//     mais elle montre tous ses paliers du jour : le plus beau en grand, les
//     autres (`aussi`) en petit ;
//   · le partage « Ils ont décroché » garde une ligne par joueur (le
//     Vestiaire pose une carte par ligne) : « MVP du match · Bronze +2 ».
//
// Les cas réels de la saison 1, rejoués sur des lignes inventées fidèles :
//   · Anas, J4 : il franchit Passes (5), MVP et Le Mur ; on ne voyait que
//     « MVP bronze » ;
//   · Youss, J3 : il franchit MVP, Buts (5), Passes (5) et Le Mur ; on ne
//     voyait que « MVP bronze ».
//   npx tsx tools/decroches-check.ts
import assert from "node:assert/strict";
import { honneurDe, ligneDecroche } from "../src/lib/sfl/a-l-honneur";
import { filDeSaison, type Actu } from "../src/lib/sfl/actus";
import { exploitsDe } from "../src/lib/sfl/exploits";
import { definirArbitres } from "../src/lib/sfl/hidden";
import { computeJournees } from "../src/lib/sfl/saisie/engine";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

definirArbitres([]);

const ligne = (j: number, player: string, autre: Partial<MatchEntry> = {}): MatchEntry => ({
  j, player, team: null, statut: "Présent", result: "Défaite", sflTime: false,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false, ...autre,
});

const saison: Saison = {
  numero: 1,
  journees: [
    { j: 1, date: "11 oct.", sflTime: false },
    { j: 2, date: "18 oct.", sflTime: false },
    { j: 3, date: "25 oct.", sflTime: false },
    { j: 4, date: "1 nov.", sflTime: false },
  ],
  roster: [],
  entries: [
    // Youss : 4 buts et 4 passes avant la J3 ; à la J3, 1 but, 1 passe, MVP et Le Mur.
    ligne(1, "Youss", { buts: 2, passes: 2 }),
    ligne(2, "Youss", { buts: 2, passes: 2 }),
    ligne(3, "Youss", { buts: 1, passes: 1, mvp: true, def: true }),
    ligne(4, "Youss", { impact: true }),
    // Anas : Impact à la J3 (son seul badge ce jour-là) ; 3 passes avant la J4 ;
    // à la J4, 2 passes, MVP et Le Mur.
    ligne(1, "Anas", { passes: 1 }),
    ligne(2, "Anas", { passes: 1 }),
    ligne(3, "Anas", { passes: 1, impact: true }),
    ligne(4, "Anas", { passes: 2, mvp: true, def: true, result: "Victoire" }),
    // Selim : un seul palier à la J4 (Buts) ; Ilyes : rien.
    ligne(1, "Selim", { buts: 2 }),
    ligne(2, "Selim", { buts: 1 }),
    ligne(3, "Selim", { buts: 1 }),
    ligne(4, "Selim", { buts: 1 }),
    ...[1, 2, 3, 4].map((j) => ligne(j, "Ilyes")),
  ],
  convocations: [],
} as Saison;

const vue = (j: number) =>
  honneurDe(saison, j).decroches.map((d) => ({ nom: d.nom, badge: `${d.id}:${d.palier}`, aussi: d.aussi.map((a) => `${a.id}:${a.palier}`) }));

// Une entrée par joueur, le plus beau en tête, les autres dans l'ordre de rareté.
assert.deepEqual(vue(3), [
  { nom: "Youss", badge: "mvp:1", aussi: ["buts:1", "passes:1", "mur:1"] },
  { nom: "Anas", badge: "impact:1", aussi: [] },
]);
assert.deepEqual(vue(4), [
  { nom: "Anas", badge: "mvp:1", aussi: ["passes:1", "mur:1"] },
  { nom: "Selim", badge: "buts:1", aussi: [] },
  { nom: "Youss", badge: "impact:1", aussi: [] },
]);
// Les valeurs des paliers en plus : celles du soir du dimanche.
assert.deepEqual(
  honneurDe(saison, 3).decroches[0].aussi.map((a) => a.valeur),
  [5, 5, 1]
);
for (const j of [1, 2, 3, 4]) {
  const noms = honneurDe(saison, j).decroches.map((d) => d.nom);
  assert.equal(new Set(noms).size, noms.length, `J${j} : une entrée par joueur`);
}

// Le fil des Actus : une cinématique par joueur, son plus beau badge, comme avant.
const fil = filDeSaison(saison, computeJournees(saison));
const badgesDuFil = (j: number) =>
  fil
    .filter((a): a is Extract<Actu, { type: "badge" | "badges" }> => (a.type === "badge" || a.type === "badges") && a.j === j)
    .flatMap((a) => (a.type === "badge" ? [a.d] : a.ds))
    .map((d) => `${d.nom} ${d.id}:${d.palier}`);
assert.deepEqual(badgesDuFil(3), ["Youss mvp:1", "Anas impact:1"]);
assert.deepEqual(badgesDuFil(4), ["Anas mvp:1", "Selim buts:1", "Youss impact:1"]);
// Le bravo d'un badge : un par joueur et par dimanche, comme avant.
const bravos = fil.filter((a) => a.type === "badges" && a.j === 4).flatMap((a) => exploitsDe(a, 1));
assert.deepEqual(
  bravos.map((e) => `${e.nom} : ${e.quoi}`),
  ["Anas : ton badge MVP du match bronze", "Selim : ton badge Buts bronze", "Youss : ton badge Impact bronze"]
);

// Le partage « Ils ont décroché » : une ligne par joueur, ses autres paliers comptés.
assert.deepEqual(honneurDe(saison, 4).decroches.map(ligneDecroche), [
  { n: "Anas", v: "MVP du match · Bronze +2" },
  { n: "Selim", v: "Buts · Bronze" },
  { n: "Youss", v: "Impact · Bronze" },
]);
assert.deepEqual(ligneDecroche(honneurDe(saison, 3).decroches[0]), { n: "Youss", v: "MVP du match · Bronze +3" });

console.log("decroches-check: ok");
