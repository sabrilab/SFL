// Vérifie le barème du mode Bola sur les exemples chiffrés des règles
// officielles (ilyesbensal/BOLA, docs/gameplay/03-mode-bola.md §7) :
//   npx tsx tools/ligue-vierge-check.ts
import assert from "node:assert/strict";
import { classementAVie, compterMatchs, coupDEnvoiPasse, type LigneBola, type MatchBola } from "../src/lib/sfl/ligue-vierge";

const l = (name: string, equipe: "clairs" | "fonces", buts: number, passes: number): LigneBola => ({ id: name, name, equipe, buts, passes });

// §7.3 : 6-4, trois MVP ex æquo.
const m73: MatchBola = {
  id: 1, jour: "2026-10-20", heure: "19h00", genre: "match", scoreClairs: 6, scoreFonces: 4,
  joueurs: [
    l("Ayoub", "clairs", 2, 1), l("Clara", "clairs", 1, 2), l("Thomas", "clairs", 2, 0), l("Adam", "clairs", 1, 1), l("Bilal", "clairs", 0, 0),
    l("Mehdi", "fonces", 3, 0), l("Julien", "fonces", 0, 2), l("Romain", "fonces", 1, 1), l("Sofia", "fonces", 0, 0), l("Omar", "fonces", 0, 0),
  ],
};
const [c73] = compterMatchs([m73]);
assert.deepEqual([...c73.mvps].sort(), ["Ayoub", "Clara", "Mehdi"]);
const pts = Object.fromEntries(c73.joueurs.map((j) => [j.name, j.points]));
assert.deepEqual(pts, { Ayoub: 7, Clara: 7, Thomas: 5, Adam: 5, Bilal: 3, Mehdi: 5, Julien: 3, Romain: 3, Sofia: 1, Omar: 1 });
assert.equal(c73.joueurs.reduce((s, j) => s + j.points, 0), 40);

// §7.2 : 0-0 à 8, aucun MVP, 2 points chacun.
const m72: MatchBola = {
  id: 2, jour: "2026-10-21", heure: "18h00", genre: "match", scoreClairs: 0, scoreFonces: 0,
  joueurs: ["A", "B", "C", "D"].map((n) => l(n, "clairs", 0, 0)).concat(["E", "F", "G", "H"].map((n) => l(n, "fonces", 0, 0))),
};
const [c72] = compterMatchs([m72]);
assert.equal(c72.mvps.length, 0);
assert.ok(c72.joueurs.every((j) => j.points === 2));

// Sous le quorum : rien ne compte, mais le MVP reste désigné.
const petit: MatchBola = { ...m72, id: 3, joueurs: [l("A", "clairs", 1, 0), l("E", "fonces", 0, 0)], scoreClairs: 1 };
const [cp] = compterMatchs([petit]);
assert.equal(cp.valide, false);
assert.deepEqual(cp.mvps, ["A"]);
assert.ok(cp.joueurs.every((j) => j.points === 0));

// Un seul match classé par jour : le second du même jour est amical pour Ayoub.
const soir: MatchBola = { ...m73, id: 4, heure: "21h30" };
const c2 = compterMatchs([soir, m73]);
assert.equal(c2[0].id, 1);
assert.ok(c2[1].joueurs.every((j) => !j.classe && j.points === 0));
const cl = classementAVie(c2);
assert.equal(cl[0].points, 7);
assert.equal(cl[0].matchs, 1);
assert.equal(cl[0].rank, 1);
assert.equal(cl[1].rank, 1); // Ayoub et Clara, ex æquo parfaits

// Exhibition : jamais comptée.
assert.equal(compterMatchs([{ ...m73, genre: "exhibition" }])[0].valide, false);

// Coup d'envoi (Paris, UTC+2 le 20/10).
assert.equal(coupDEnvoiPasse("2026-10-20", "19h00", new Date("2026-10-20T17:30:00Z")), true);
assert.equal(coupDEnvoiPasse("2026-10-20", "19h00", new Date("2026-10-20T16:30:00Z")), false);
assert.equal(coupDEnvoiPasse("2026-10-19", "23h00", new Date("2026-10-20T06:00:00Z")), true);

console.log("ligue vierge : barème et exemples des règles, tout est bon");
