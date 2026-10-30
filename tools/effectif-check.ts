// Le compte d'un admin qui ne joue pas n'est jamais sur un terrain (30/10/2026).
// Le 28/10, la ligne « Sabri » apparaissait dans les compositions : la vitrine
// de son téléphone lui donnait une équipe, et les sélecteurs de l'admin lisaient
// l'effectif brut. Ce banc vérifie les trois barrières :
//   npx tsx tools/effectif-check.ts
import assert from "node:assert/strict";
import { avecVitrine } from "../src/lib/sfl/compte-vitrine";
import { definirArbitres, definirNonJoueurs, isHidden } from "../src/lib/sfl/hidden";
import { computeJournees } from "../src/lib/sfl/saisie/engine";
import { effectifJouable, jouable, placementsDeLaJournee, surLaFeuille } from "../src/lib/sfl/saisie/effectif";
import { addEntry, matchsDeclares, newEntry, poserEquipes, remplacerJoueurAt, retiresDeLaPose } from "../src/lib/sfl/saisie/mutations";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import { chercherTolerant } from "../src/lib/sfl/recherche-tolerante";
import type { Saison } from "../src/lib/sfl/saisie/types";

const s = seedSaison();
assert.ok(s.roster.some((r) => r.name === "Sabri"), "Sabri est dans l'effectif de départ");

// 1 · La liste de départ : celle d'aujourd'hui (rien ne clignote avant la base).
assert.equal(jouable("Sabri"), false);
assert.equal(jouable("sabri "), false, "sans casse ni espaces");
assert.equal(isHidden("Sabri"), true);
assert.equal(jouable("Ilyes"), true);
assert.equal(jouable("X1"), true, "une place Xtratime reste jouable");

// 2 · Les sélecteurs : ni Sabri, ni un arbitre.
definirArbitres(["Kader"]);
const noms = effectifJouable(s).map((r) => r.name);
assert.ok(!noms.includes("Sabri"));
assert.ok(!noms.includes("Kader"), "un arbitre ne joue pas");
assert.deepEqual(noms, [...noms].sort((a, b) => a.localeCompare(b, "fr")), "triés");
const devant = effectifJouable(s, new Set(["Naim"]));
assert.equal(devant[0].name, "Naim", "les « Je viens » sans place d'abord");
definirArbitres([]);

// 3 · La base décide : Sabri remis joueur, un autre ne joue plus.
definirNonJoueurs(["Ilyes"]);
assert.equal(jouable("Sabri"), true);
assert.equal(jouable("Ilyes"), false);
definirNonJoueurs(["Sabri"]);

// 4 · L'écriture : une ligne de Sabri est refusée, un doublon aussi.
const j = s.journees[s.journees.length - 1].j;
assert.equal(addEntry(s, newEntry(j, "Sabri", null)), s, "addEntry(…, \"Sabri\") refusé");
const quelquun = s.entries.find((e) => e.j === j && !e.extraTime)!.player;
assert.equal(addEntry(s, newEntry(j, quelquun, null)), s, "un joueur déjà sur la feuille");
assert.notEqual(addEntry(s, { ...newEntry(j, quelquun, null), extraTime: true }), s, "sa ligne Xtratime n'est pas un doublon");
const i = s.entries.findIndex((e) => e.j === j && !e.extraTime);
const autre = s.entries.find((e, k) => e.j === j && k !== i && !e.extraTime && e.player !== s.entries[i].player)!.player;
assert.equal(remplacerJoueurAt(s, i, autre), s, "remplacer par un joueur déjà sur la journée");
assert.equal(remplacerJoueurAt(s, i, "Sabri"), s, "remplacer par un non-joueur");

// 5 · Le moteur : une ligne « Sabri » écrite dans le document n'est dans aucun camp.
const avecSabri: Saison = {
  ...s,
  entries: [...s.entries, { ...newEntry(j, "Sabri", s.entries.find((e) => e.j === j && e.team)!.team), buts: 3 }],
};
const camps = computeJournees(avecSabri).find((x) => x.j === j)!.matches!.flatMap((m) => [...m.teamA.players, ...m.teamB.players].map((p) => p.name));
assert.ok(!camps.includes("Sabri"));
assert.deepEqual(computeJournees(avecSabri), computeJournees(s), "et le score ne bouge pas");

// 6 · La vitrine : mêmes matchs, mêmes scores, sur son téléphone aussi.
const vitrine = avecVitrine(s, { nom: "Sabri" });
assert.ok(vitrine.entries.some((e) => e.vitrine), "la vitrine ajoute ses lignes");
assert.ok(vitrine.entries.filter((e) => e.vitrine).every((e) => e.team === null), "sans équipe");
assert.deepEqual(
  computeJournees(vitrine).map((x) => x.matches),
  computeJournees(s).map((x) => x.matches),
  "computeJournees(avecVitrine(s)) donne les mêmes matchs"
);
avecVitrine(s, null);

// 7 · Poser des équipes : la première place d'un nom, jamais un non-joueur.
const teams = [
  { name: "Noirs 1", players: ["Ilyes", "Naim", "Sabri"] },
  { name: "Blancs 1", players: ["Kader", "Ilyes"] },
];
assert.deepEqual(retiresDeLaPose(teams), [
  { nom: "Sabri", raison: "ne-joue-pas" },
  { nom: "Ilyes", raison: "double" },
]);
const vide: Saison = { ...s, journees: [...s.journees, { j: 99, date: "8 nov.", sflTime: false }] };
const pose = poserEquipes(vide, 99, teams);
const l99 = pose.entries.filter((e) => e.j === 99);
assert.deepEqual(l99.map((e) => `${e.player}:${e.team}`).sort(), ["Ilyes:Noirs 1", "Kader:Blancs 1", "Naim:Noirs 1"]);

// 8 · Déjà sur la feuille : toute la journée, quel que soit le filtre affiché.
const feuille = surLaFeuille(pose, 99);
assert.ok(feuille.has("ilyes") && feuille.has("kader") && !feuille.has("sabri"));
const ou = placementsDeLaJournee(pose, 99, matchsDeclares(pose, 99));
assert.equal(ou.get("ilyes"), "NOIRS");
assert.equal(ou.get("kader"), "BLANCS");

// 9 · La recherche tolérante (le sélecteur de joueurs).
const effectif = ["Ilyes", "Kader", "Naim", "Adil Maimouni", "Gaïl", "Souleymane", "Mehdi"];
const premier = (q: string) => chercherTolerant(effectif, (n) => [n], q)[0];
assert.equal(premier("ilies"), "Ilyes", "le même son");
assert.equal(premier("qader"), "Kader");
assert.equal(premier("mhedi"), "Mehdi", "deux lettres inversées");
assert.equal(premier("souleiman"), "Souleymane");
assert.equal(premier("gail"), "Gaïl", "sans accents");
assert.equal(premier("am"), "Adil Maimouni", "les initiales");
assert.equal(chercherTolerant(effectif, (n) => [n], "zz").length, 0);

console.log("effectif-check : Sabri hors des sélecteurs, du moteur, de la vitrine et de la pose ; doublons refusés ; recherche tolérante — ok");
