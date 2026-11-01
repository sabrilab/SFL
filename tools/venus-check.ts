// Les « Je viens » posés sur les terrains (saisie/venus-sur-la-feuille.ts, 31/10/2026) :
// une journée vide les reçoit tous, au plus TERRAINS_MAX terrains ; une
// journée qui a ses joueurs les garde et ne fait entrer que les nouveaux.
//   npx tsx tools/venus-check.ts
import assert from "node:assert/strict";
import { equipesDesVenus, joueursPoses } from "../src/lib/sfl/saisie/venus-sur-la-feuille";
import { ajouterMatch, newEntry, poserEquipes, preparerJournee } from "../src/lib/sfl/saisie/mutations";
import { TERRAINS_MAX } from "../src/lib/sfl/equipes-division";
import type { Saison } from "../src/lib/sfl/saisie/types";

const noms = Array.from({ length: 24 }, (_, i) => `Joueur ${String.fromCharCode(65 + i)}`);
const base: Saison = {
  journees: [{ j: 4, date: "1 nov.", sflTime: false, heure: "12h30" }],
  roster: noms.map((name) => ({ name, poste: null, profil: "Actif", base: null })),
  entries: [{ ...newEntry(4, noms[0], "Noirs 1"), result: "Victoire" }, { ...newEntry(4, noms[1], "Blancs 1"), result: "Défaite" }],
  convocations: [],
};

// La J5 vient de naître, deux terrains vides : les 12 venus y sont tous.
const p = preparerJournee(base, "8 nov.");
let s = ajouterMatch(ajouterMatch(p.saison, p.j, {}).saison, p.j, {}).saison;
const venus = noms.slice(0, 12);
const t = equipesDesVenus(s, p.j, venus);
assert.ok(t, "une proposition");
assert.equal(joueursPoses(t), 12, "tous les venus placés");
assert.ok(t!.length / 2 <= TERRAINS_MAX, "jamais plus de TERRAINS_MAX terrains");
assert.deepEqual(new Set(t!.flatMap((x) => x.players)), new Set(venus));

// Les équipes déjà composées pour la convocation passent devant le moteur.
const composees = [
  { name: "Noirs 1", players: noms.slice(0, 5) },
  { name: "Blancs 1", players: noms.slice(5, 10) },
];
assert.deepEqual(equipesDesVenus(s, p.j, venus, composees), composees);

// Posées, puis trois réponses de plus : chacun garde sa place, les nouveaux entrent.
s = poserEquipes(s, p.j, t!, "8 nov.");
const avant = new Map(s.entries.filter((e) => e.j === p.j).map((e) => [e.player, e.team]));
const encore = equipesDesVenus(s, p.j, noms.slice(0, 15));
assert.ok(encore, "les nouveaux à placer");
for (const x of encore!) for (const n of x.players) if (avant.has(n)) assert.equal(avant.get(n), x.name, `${n} garde son camp`);
assert.equal(joueursPoses(encore), 15);

// Rien de neuf : rien à poser.
assert.equal(equipesDesVenus(s, p.j, venus), null);
// Un seul venu sur une journée vide : pas de match.
assert.equal(equipesDesVenus(p.saison, p.j, [noms[0]]), null);

console.log("venus-check: ok");
