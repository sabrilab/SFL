// Vérifie les équipes montrées aux joueurs et les remplaçants quand la
// feuille du dimanche a ses équipes (lib/sfl/presence-feuille.ts), sur la J6
// du 15/11/2026 telle qu'en base la veille : Souley ajouté à la main en
// Blancs 1, Kamil passé de Noirs 1 à Blancs 2, Joad et Yanis retirés des
// équipes de la convocation. Rien n'est lu ni écrit en base.
//   npx tsx tools/equipes-feuille-check.ts
import assert from "node:assert/strict";
import { equipesDeLaFeuille, remplacantsDe } from "../src/lib/sfl/presence-feuille";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

const l = (player: string, team: string | null, statut = "Présent"): MatchEntry =>
  ({ j: 6, player, team, statut }) as unknown as MatchEntry;

const entries = [
  ...["Adel", "Youss", "Zakaria", "Zakary"].map((n) => l(n, "Noirs 1")),
  ...["Ilyes", "Selim laouadi", "Sidali", "Yacine"].map((n) => l(n, "Blancs 1")),
  ...["Ibrahim", "Kais", "Nessime", "Ryad", "Gyro"].map((n) => l(n, "Noirs 2")),
  ...["Afid", "Gaïl", "Massi Sidali"].map((n) => l(n, "Blancs 2")),
  l("Souley", "Blancs 1"),
  l("Kamil", "Blancs 2"),
  l("Yanis Bouzenita", null, "Suspendu"),
  l("Isma", "Noirs 1"),
  l("Joad", null),
  l("Sosso Abdel", "Blancs 2"),
  l("Absent", null, "Absent justifié"),
  { ...l("Vieux", "Noirs 1"), j: 5 } as MatchEntry,
];
const saison = {
  entries,
  journees: [{ j: 6, date: "15 nov.", matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }, { equipes: ["Noirs 2", "Blancs 2"] }] }],
} as unknown as Saison;

const convocation = [
  { name: "Noirs 1", players: ["Adel", "Kamil", "Youss", "Zakaria", "Zakary"] },
  { name: "Blancs 1", players: ["Ilyes", "Selim laouadi", "Sidali", "Yacine"] },
  { name: "Noirs 2", players: ["Ibrahim", "Kais", "Nessime", "Ryad", "Gyro"] },
  { name: "Blancs 2", players: ["Afid", "Gaïl", "Joad", "Yanis Bouzenita", "Massi Sidali"] },
];

const eq = equipesDeLaFeuille(saison, 6)!;
assert.deepEqual(
  eq.map((t) => t.name),
  ["Noirs 1", "Blancs 1", "Noirs 2", "Blancs 2"]
);
assert.deepEqual(eq[0].players, ["Adel", "Youss", "Zakaria", "Zakary", "Isma"]);
assert.deepEqual(eq[1].players, ["Ilyes", "Selim laouadi", "Sidali", "Yacine", "Souley"]);
assert.deepEqual(eq[3].players, ["Afid", "Gaïl", "Massi Sidali", "Kamil", "Sosso Abdel"]);
assert.equal(equipesDeLaFeuille(saison, 7), null);

const rien = () => false;
// Les « Je viens » (ici, sans Joad ni Yanis) + les retirés.
const jeViens = ["Adel", "Kamil", "Souley", "Isma"];
assert.deepEqual(remplacantsDe(jeViens, saison, 6, convocation, rien).sort(), ["Joad", "Yanis Bouzenita"]);
// Équipes de la convocation pas encore visibles : la ligne sans équipe de la feuille reste remplaçante.
assert.deepEqual(remplacantsDe(jeViens, saison, 6, null, rien).sort(), ["Joad", "Yanis Bouzenita"]);
// Un joueur masqué ne s'affiche pas.
assert.deepEqual(remplacantsDe(jeViens, saison, 6, convocation, (n) => n === "Joad"), ["Yanis Bouzenita"]);
// Sans équipes sur la feuille : comme avant, les équipes de la convocation.
const sansEquipes = { ...saison, entries: entries.map((e) => ({ ...e, team: null })) } as Saison;
assert.deepEqual(remplacantsDe(["Souley", "Adel"], sansEquipes, 6, convocation, rien), ["Souley"]);

console.log("equipes-feuille: ok");
