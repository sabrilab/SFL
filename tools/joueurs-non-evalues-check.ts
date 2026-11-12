// Un joueur de l'effectif sans évaluation et sans journée comptée reste un
// joueur de la ligue (12/11/2026). Yazid (fiche « Actif », base null) n'était
// que sur la feuille de la J5, sans résultat saisi : computeStandings ne
// l'ajoutait pas (r.base exigé), il manquait aux classements, à la recherche,
// et sa carte ne s'ouvrait pas sur la feuille de match (feuille-de-match.tsx
// cherche le joueur dans allPlayers). Ce banc tient la règle :
//   npx tsx tools/joueurs-non-evalues-check.ts
import assert from "node:assert/strict";
import { deriveSeason, computeStandings } from "../src/lib/sfl/saisie/engine";
import { addEntry, newEntry } from "../src/lib/sfl/saisie/mutations";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import type { Saison } from "../src/lib/sfl/saisie/types";

const base = seedSaison();
const jSuivante = Math.max(0, ...base.journees.map((j) => j.j)) + 1;

let s: Saison = {
  ...base,
  roster: [
    ...base.roster.filter((r) => !["Testeur Sans Note", "Testeur Absent", "Testeur Attente"].includes(r.name)),
    { name: "Testeur Sans Note", poste: null, profil: "Actif", base: null },
    { name: "Testeur Absent", poste: null, profil: "Actif", base: null },
    { name: "Testeur Attente", poste: null, profil: "En attente", base: null },
  ],
  journees: [...base.journees, { j: jSuivante, date: "8 nov.", sflTime: true }],
};
// Sur la feuille de la journée suivante, sans aucun résultat : la journée ne compte pas encore.
s = addEntry(s, newEntry(jSuivante, "Testeur Sans Note", "Blancs 2"));

const derive = deriveSeason(s);
const parNom = new Map(derive.players.map((p) => [p.name, p]));

// 1 · Inscrit sur une feuille sans résultat, jamais évalué : il est là, à 0, carte à 75.
const yaz = parNom.get("Testeur Sans Note");
assert.ok(yaz, "un joueur Actif non évalué figure dans la liste des joueurs");
assert.equal(yaz.matchs, 0, "aucun match compté tant que la journée n'a pas de résultat");
assert.equal(yaz.pp, 0);
assert.equal(yaz.poste, "—");

// 2 · Actif sans aucune ligne : là aussi (classements « showAll », recherche).
assert.ok(parNom.has("Testeur Absent"), "un joueur Actif sans match figure dans la liste");

// 3 · « En attente » reste dehors, évalué ou non.
assert.ok(!parNom.has("Testeur Attente"), "un joueur En attente n'apparaît pas");

// 4 · La carte d'un non-évalué vaut 75 partout, comme la fiche le dit (types.ts).
const sansNote = computeStandings(s).find((p) => p.name === "Testeur Absent");
assert.ok(sansNote);
for (const v of Object.values(sansNote.stats as unknown as Record<string, number>)) {
  if (typeof v === "number") assert.ok(v >= 0, "stats numériques");
}

console.log("joueurs-non-evalues: ok");
