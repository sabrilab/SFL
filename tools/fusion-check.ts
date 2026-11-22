// Deux appareils d'admin sur la même saison (lib/sfl/saisie/fusion.ts,
// 22/11/2026) : ce que chacun a saisi reste, sur la J7 rejouée.
//   npx tsx tools/fusion-check.ts
import assert from "node:assert/strict";
import { fusionnerSaisons } from "../src/lib/sfl/saisie/fusion";
import { finDuMatch, newEntry, updateEntryAt } from "../src/lib/sfl/saisie/mutations";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

const L = (j: number, player: string, team: string, x: Partial<MatchEntry> = {}): MatchEntry => ({ ...newEntry(j, player, team), ...x });
const M1: [string, string] = ["Noirs 1", "Blancs 1"];
const M2: [string, string] = ["Noirs 2", "Blancs 2"];
const M3: [string, string] = ["Noirs 3", "Blancs 3"];

const base: Saison = {
  numero: 1,
  roster: ["Ilyes", "Théo", "Kamil", "Yacine", "Gaïl", "Afid"].map((name) => ({ name, poste: null, profil: "Actif", base: null })),
  convocations: [],
  journees: [{ j: 7, date: "22 nov.", sflTime: false, matchsDuJour: [{ equipes: M1 }, { equipes: M2 }, { equipes: M3 }] }],
  entries: [
    L(7, "Ilyes", "Noirs 1", { buts: 2 }),
    L(7, "Théo", "Blancs 1"),
    L(7, "Kamil", "Noirs 2"),
    L(7, "Yacine", "Blancs 2"),
    L(7, "Gaïl", "Noirs 3"),
    L(7, "Afid", "Blancs 3"),
  ],
};
const ligne = (s: Saison, p: string) => s.entries.find((e) => e.player === p)!;
const idx = (s: Saison, p: string) => s.entries.findIndex((e) => e.player === p);
const plus = (s: Saison, p: string, x: Partial<MatchEntry>) => updateEntryAt(s, idx(s, p), x);

// 1 · Rien de saisi ici : la base telle quelle. Rien de changé là-bas : la copie d'ici.
{
  const autre = plus(base, "Kamil", { buts: 1 });
  assert.deepEqual(fusionnerSaisons(base, base, autre), { saison: autre, change: false, croises: 0 });
  const locale = plus(base, "Gaïl", { buts: 3 });
  assert.deepEqual(fusionnerSaisons(base, locale, base), { saison: locale, change: true, croises: 0 });
}

// 2 · La J7 : le téléphone tient le match 2 et pose sa fin, l'ordinateur
// saisit le match 3. Les deux restent.
{
  const autre = finDuMatch(plus(plus(base, "Kamil", { buts: 2 }), "Yacine", { buts: 1, passes: 1 }), 7, M2);
  let locale = plus(base, "Gaïl", { buts: 3, arrets: 2 });
  locale = finDuMatch(plus(locale, "Afid", { buts: 1 }), 7, M3);
  const f = fusionnerSaisons(base, locale, autre);
  assert.equal(f.croises, 0);
  assert.equal(f.change, true);
  assert.deepEqual([ligne(f.saison, "Kamil").buts, ligne(f.saison, "Kamil").result], [2, "Victoire"]);
  assert.deepEqual([ligne(f.saison, "Yacine").buts, ligne(f.saison, "Yacine").passes, ligne(f.saison, "Yacine").result], [1, 1, "Défaite"]);
  assert.deepEqual([ligne(f.saison, "Gaïl").buts, ligne(f.saison, "Gaïl").arrets, ligne(f.saison, "Gaïl").result], [3, 2, "Victoire"]);
  assert.deepEqual([ligne(f.saison, "Afid").buts, ligne(f.saison, "Afid").result], [1, "Défaite"]);
  assert.equal(ligne(f.saison, "Ilyes").buts, 2);
  assert.equal(f.saison.entries.length, base.entries.length);
  // Dans l'autre sens, le même document.
  assert.deepEqual(fusionnerSaisons(base, autre, locale).saison.entries, f.saison.entries);
}

// 3 · La même ligne, deux champs : les buts ici, la passe là-bas.
{
  const f = fusionnerSaisons(base, plus(base, "Ilyes", { buts: 3 }), plus(base, "Ilyes", { passes: 1 }));
  assert.deepEqual([ligne(f.saison, "Ilyes").buts, ligne(f.saison, "Ilyes").passes, f.croises], [3, 1, 0]);
}

// 4 · Le même champ des deux côtés : la valeur de cet appareil, et c'est compté.
{
  const f = fusionnerSaisons(base, plus(base, "Ilyes", { buts: 3 }), plus(base, "Ilyes", { buts: 4 }));
  assert.deepEqual([ligne(f.saison, "Ilyes").buts, f.croises], [3, 1]);
  // Le même changement des deux côtés n'est pas un croisement.
  const g = fusionnerSaisons(base, plus(base, "Ilyes", { buts: 3 }), plus(base, "Ilyes", { buts: 3 }));
  assert.deepEqual([ligne(g.saison, "Ilyes").buts, g.croises, g.change], [3, 0, false]);
}

// 5 · Un joueur ajouté ici, un autre là-bas, un retiré là-bas.
{
  const locale = { ...base, entries: [...base.entries, L(7, "Nessime", "Noirs 2")] };
  const autre = { ...base, entries: [...base.entries.filter((e) => e.player !== "Théo"), L(7, "Ryad", "Blancs 2")] };
  const f = fusionnerSaisons(base, locale, autre);
  assert.deepEqual(f.saison.entries.map((e) => e.player), ["Ilyes", "Kamil", "Yacine", "Gaïl", "Afid", "Ryad", "Nessime"]);
  // Retiré là-bas, mais ses buts saisis ici : la ligne reste.
  const g = fusionnerSaisons(base, plus(base, "Théo", { buts: 1 }), autre);
  assert.equal(ligne(g.saison, "Théo").buts, 1);
  assert.equal(g.croises, 1);
}

// 6 · Les journées champ par champ, le reste en bloc.
{
  const locale: Saison = { ...base, journees: [{ ...base.journees[0], heure: "13h00" }], terrains: [{ id: 1 } as never] };
  const autre: Saison = { ...base, journees: [{ ...base.journees[0], finDesMatchs: "2026-11-22T15:00:00.000Z" }], cartonsRouges: [] };
  const f = fusionnerSaisons(base, locale, autre);
  assert.deepEqual([f.saison.journees[0].heure, f.saison.journees[0].finDesMatchs], ["13h00", "2026-11-22T15:00:00.000Z"]);
  assert.equal(f.saison.terrains?.length, 1);
  assert.deepEqual(f.saison.cartonsRouges, []);
  assert.equal(f.croises, 0);
}

// 7 · Un extra time et la ligne du même joueur ne se confondent pas.
{
  const b2 = { ...base, entries: [...base.entries, L(7, "Ilyes", "Noirs 2", { extraTime: true })] };
  const locale = updateEntryAt(b2, b2.entries.length - 1, { buts: 1 });
  const f = fusionnerSaisons(b2, locale, plus(b2, "Ilyes", { passes: 2 }));
  assert.deepEqual(f.saison.entries.filter((e) => e.player === "Ilyes").map((e) => [e.buts, e.passes, !!e.extraTime]), [[2, 2, false], [1, 0, true]]);
}

console.log("fusion-check : ok");
