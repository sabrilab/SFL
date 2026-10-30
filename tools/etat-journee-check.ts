// L'état d'une journée et le geste du moment (saisie/etat-journee.ts, 30/10/2026) :
// il y a toujours un geste, et un seul ; la journée ouverte n'est jamais la
// dernière jouée (le 28/10, la grille rouvrait la J3).
//   npx tsx tools/etat-journee-check.ts
import assert from "node:assert/strict";
import { etatJournee, gesteDuMoment, prochaineJournee } from "../src/lib/sfl/saisie/etat-journee";
import { ajouterMatch, finDuMatch, newEntry, poserEquipes } from "../src/lib/sfl/saisie/mutations";
import { publierJournee } from "../src/lib/sfl/saisie/brouillon";
import { verifierFeuille } from "../src/lib/sfl/saisie/integrite";
import type { Saison } from "../src/lib/sfl/saisie/types";

const maintenant = new Date("2026-10-29T10:00:00Z"); // un jeudi
const L = (j: number, p: string, t: string, x = {}) => ({ ...newEntry(j, p, t), ...x });
const base: Saison = {
  journees: [{ j: 3, date: "25 oct.", sflTime: false, heure: "12h30" }],
  roster: ["A", "B", "C", "D", "E", "F", "G", "H"].map((name) => ({ name, poste: null, profil: "Actif", base: null })),
  entries: [L(3, "A", "Noirs 1", { result: "Victoire", buts: 2 }), L(3, "B", "Blancs 1", { result: "Défaite" })],
  convocations: [],
};

// Aucune journée à venir : « Préparer la J4 · dim 1 nov. ».
assert.equal(prochaineJournee(base, maintenant), null, "jamais la dernière jouée");
assert.deepEqual(gesteDuMoment(base, null, maintenant), { t: "preparer", j: 4, date: "1 nov." });

// La J4 en brouillon, saine : « Publier ».
const teams = [
  { name: "Noirs 1", players: ["A", "B", "C"] },
  { name: "Blancs 1", players: ["D", "E", "F"] },
];
const b = poserEquipes(base, 4, teams, "1 nov.", { brouillon: { par: "Ilyes", le: maintenant } });
assert.equal(prochaineJournee(b, maintenant), 4);
assert.equal(etatJournee(b, 4, maintenant), "brouillon");
assert.deepEqual(gesteDuMoment(b, 4, maintenant), { t: "publier", j: 4 });
// Un match vide : « 1 à corriger », jamais « Publier ».
const vide = ajouterMatch(b, 4, { heure: "14h00" }).saison;
const g = gesteDuMoment(vide, 4, maintenant);
assert.equal(g.t, "corriger");
// Publiée : en ligne, avant le jour.
const p = publierJournee(b, 4, "Ilyes", maintenant);
assert.equal(etatJournee(p, 4, maintenant), "en-ligne");
assert.equal(gesteDuMoment(p, 4, maintenant).t, "en-ligne");
// Le jour même : le Direct, Match 1.
const dimanche = new Date("2026-11-01T09:00:00Z");
assert.deepEqual(gesteDuMoment(p, 4, dimanche), { t: "direct", j: 4, match: 1, heure: undefined });
const enCours = { ...p, entries: p.entries.map((e) => (e.player === "A" && e.j === 4 ? { ...e, buts: 1 } : e)) };
assert.equal(etatJournee(enCours, 4, dimanche), "en-direct");
// « Fin du match » : un résultat cohérent pour les deux camps (I7), et la journée se termine.
const fini = finDuMatch(enCours, 4, ["Noirs 1", "Blancs 1"]);
assert.deepEqual(fini.entries.filter((e) => e.j === 4).map((e) => e.result), ["Victoire", "Victoire", "Victoire", "Défaite", "Défaite", "Défaite"]);
assert.deepEqual(verifierFeuille(fini, 4), []);
assert.equal(etatJournee(fini, 4, dimanche), "terminee");
assert.equal(gesteDuMoment(fini, 4, dimanche).t, "apres");
// Chaque état donne un seul geste.
for (const [s, j] of [[base, null], [b, 4], [vide, 4], [p, 4], [enCours, 4], [fini, 4]] as const) assert.ok(typeof gesteDuMoment(s, j, maintenant).t === "string");

console.log("etat-journee-check : un geste par état, la journée ouverte jamais la dernière jouée, Fin du match cohérente — ok");
