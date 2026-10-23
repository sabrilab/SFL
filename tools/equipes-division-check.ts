// Vérifie les équipes d'un dimanche en divisions (lib/sfl/equipes-division.ts)
// sur une saison fabriquée : les terrains par division, l'équilibre, le
// mélange de ceux qui ont déjà joué ensemble, les gardiens, les réponses
// tardives, et qu'un même appel rend toujours les mêmes équipes.
//   npx tsx tools/equipes-division-check.ts
// Avec une saison réelle (le document de la table saison, en JSON), compose
// en plus les équipes des inscrits de sa dernière feuille, avec les divisions
// du moment, et les compare au tirage à l'OVR de l'admin :
//   npx tsx tools/equipes-division-check.ts saison.json
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { etatDivisions, nomDivision, type Division, type EtatDivisions } from "../src/lib/sfl/divisions";
import {
  completer,
  composer,
  divisionsDeLaJournee,
  equipesEnCours,
  historique,
  journeeDeConvocation,
  nomsDEquipes,
  repartirSurTerrains,
  terrainsDesEquipes,
  type Composition,
  type Niveau,
} from "../src/lib/sfl/equipes-division";
import { ovr, rareStats } from "../src/lib/sfl/engine";
import { computeJournees, computeStandings } from "../src/lib/sfl/saisie/engine";
import { generateBalancedTeams, libelleCourt, newEntry, poserEquipes } from "../src/lib/sfl/saisie/mutations";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

const niveau = (nom: string, division: Division, valeur: number, gardien = false): Niveau => ({ nom, division, note: 75, ppm: null, valeur, gardien });

// Les terrains : la D1 trop courte (6) rejoint la D2 (10), et ces 16 prennent
// deux terrains, les meilleurs ensemble ; la D3 (20) en prend deux aussi.
const joueurs = [
  ...Array.from({ length: 6 }, (_, i) => niveau(`a${i}`, 1, 2 - i * 0.1)),
  ...Array.from({ length: 10 }, (_, i) => niveau(`b${i}`, 2, 1 - i * 0.1)),
  ...Array.from({ length: 20 }, (_, i) => niveau(`c${i}`, 3, -i * 0.1)),
];
const terrains = repartirSurTerrains(joueurs);
assert.deepEqual(terrains.map((t) => t.length), [8, 8, 10, 10]);
assert.deepEqual(terrains[0].map((p) => p.nom), ["a0", "a1", "a2", "a3", "a4", "a5", "b0", "b1"]);
assert.ok(terrains[2].every((p) => p.division === 3) && terrains[2][0].nom === "c0");
// Une D2 trop courte rejoint la moins remplie de ses voisines.
assert.deepEqual(
  repartirSurTerrains([...joueurs.slice(0, 6), ...joueurs.slice(6, 9), ...joueurs.slice(16, 26)]).map((t) => t.length),
  [9, 10]
);
// Moins de huit en tout : un seul terrain.
assert.deepEqual(repartirSurTerrains(joueurs.slice(0, 3).concat(joueurs.slice(20, 23))).map((t) => t.length), [6]);
assert.deepEqual(nomsDEquipes(10).slice(6), ["Équipe A", "Équipe B", "Équipe C", "Équipe D"]);

// Une saison : dix joueurs, deux journées jouées. Ana et Bilal ont toujours
// joué ensemble ; Chris et Dina se sont toujours affrontés.
const NOMS = ["Ana", "Bilal", "Chris", "Dina", "Eli", "Fodé", "Gaby", "Hugo", "Inès", "Jade"];
const ligne = (j: number, player: string, team: string, result: MatchEntry["result"]): MatchEntry => ({
  j, player, team, statut: "Présent", result, sflTime: true,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false,
});
const deux = (j: number, orange: string[], bleu: string[]) => [
  ...orange.map((n) => ligne(j, n, "Orange", "Victoire")),
  ...bleu.map((n) => ligne(j, n, "Bleu", "Défaite")),
];
const saison: Saison = {
  numero: 1,
  journees: [
    { j: 1, date: "11 oct.", sflTime: true },
    { j: 2, date: "18 oct.", sflTime: true },
  ],
  roster: NOMS.map((name, i) => ({ name, poste: i === 4 || i === 7 ? "G" : "MC", profil: "Actif", base: [80 - i, 80 - i, 80 - i, 80 - i, 80 - i, 80 - i] })),
  entries: [
    ...deux(1, ["Ana", "Bilal", "Chris", "Eli", "Gaby"], ["Dina", "Fodé", "Hugo", "Inès", "Jade"]),
    ...deux(2, ["Ana", "Bilal", "Dina", "Fodé", "Hugo"], ["Chris", "Eli", "Gaby", "Inès", "Jade"]),
  ],
  convocations: [],
};
const h = historique(saison);
assert.equal(h.ensemble.get("Ana\u0001Bilal"), 2);
assert.equal(h.contre.get("Chris\u0001Dina"), 2);

const sansDivisions: EtatDivisions | null = null;
const c = composer(saison, [...NOMS].reverse(), sansDivisions);
assert.equal(c.terrains.length, 1);
const [noirs, blancs] = c.terrains[0].equipes;
const ensemble = (a: string, b: string, comp: Composition) => comp.teams.some((t) => t.players.includes(a) && t.players.includes(b));
assert.equal(ensemble("Ana", "Bilal", c), false, "deux qui ont toujours joué ensemble passent l'un contre l'autre");
assert.equal(ensemble("Eli", "Hugo", c), false, "un gardien de chaque côté");
assert.equal(noirs.players.length + blancs.players.length, 10);
assert.ok(c.terrains[0].ecart < 0.3, `équilibré (${c.terrains[0].ecart.toFixed(2)})`);
assert.ok(["Eli", "Hugo"].includes(noirs.players[0]) && ["Eli", "Hugo"].includes(blancs.players[0]), "le gardien en premier : il garde le but sur la feuille");
// Déterministe, quel que soit l'ordre des réponses ; Sabri, masqué, n'y entre pas.
assert.deepEqual(composer(saison, [...NOMS, "Sabri"], null).teams, c.teams);

// Les réponses tardives : Kenza arrive, Ana se désiste.
const tard = completer(saison, c.teams, [...NOMS.filter((n) => n !== "Ana"), "Kenza", "Lina"], null)!;
assert.ok(tard.every((t) => !t.players.includes("Ana")));
assert.equal(tard.flatMap((t) => t.players).filter((n) => n === "Kenza" || n === "Lina").length, 2);
assert.ok(Math.abs(tard[0].players.length - tard[1].players.length) <= 1);
assert.equal(completer(saison, c.teams, NOMS, null), null, "rien de neuf, rien ne change");
// Trois départs du même côté : un joueur change d'équipe pour revenir à un d'écart.
const cote = c.teams[0].players.slice(1, 4);
const apres = completer(saison, c.teams, NOMS.filter((n) => !cote.includes(n)), null)!;
assert.ok(Math.abs(apres[0].players.length - apres[1].players.length) <= 1);

// Le calendrier : du vendredi 18 h (Paris, heure d'hiver dès le 25/10) au coup d'envoi du dimanche.
const t = (iso: string) => new Date(iso);
assert.equal(equipesEnCours(t("2026-10-30T16:59:00Z")), false, "vendredi 17 h 59");
assert.equal(equipesEnCours(t("2026-10-30T17:00:00Z")), true, "vendredi 18 h");
assert.equal(equipesEnCours(t("2026-10-31T12:00:00Z")), true, "samedi");
assert.equal(equipesEnCours(t("2026-11-01T11:59:00Z")), true, "dimanche 12 h 59");
assert.equal(equipesEnCours(t("2026-11-01T12:00:00Z")), false, "coup d'envoi");
assert.equal(equipesEnCours(t("2026-11-01T09:00:00Z"), "10h00"), false, "coup d'envoi de la convocation");
assert.equal(equipesEnCours(t("2026-11-02T08:00:00Z")), false, "lundi");

// La journée d'une convocation, et ses divisions : la J4 en divisions une fois la J3 jouée.
assert.equal(journeeDeConvocation(saison, "18 octobre"), 2);
assert.equal(journeeDeConvocation(saison, "25 octobre"), 3);
assert.equal(divisionsDeLaJournee(saison, 4), null, "la J3 pas jouée : pas de divisions");
const coupee: Saison = {
  ...saison,
  journees: [...saison.journees, { j: 3, date: "25 oct.", sflTime: true }],
  entries: [...saison.entries, ...deux(3, ["Ana", "Chris", "Eli", "Gaby", "Inès"], ["Bilal", "Dina", "Fodé", "Hugo", "Jade"])],
};
const etat4 = divisionsDeLaJournee(coupee, 4)!;
assert.equal(etat4.phase, "divisions");
assert.equal(divisionsDeLaJournee(coupee, 3), null, "la J3 se joue sans divisions");
assert.equal(divisionsDeLaJournee({ ...coupee, numero: 2 }, 4), null, "une autre saison");

// En divisions : les dix classés en trois tiers, trois terrains impossibles à
// dix ; la D1 et la D3, trop courtes, rejoignent la D2 : un seul terrain.
const c4 = composer(coupee, NOMS, etat4);
assert.equal(c4.terrains.length, 1);
assert.deepEqual(terrainsDesEquipes(c4.teams, etat4).map((x) => x.label), ["D1–D2–D3"]);
// Deux terrains de la même division se numérotent.
const enD3 = [...etat4.actuelle].filter(([, d]) => d === 3).map(([n]) => n);
const d3 = (n: string) => ({ name: n, players: enD3.slice(0, 2) });
assert.deepEqual(
  terrainsDesEquipes([d3("Orange"), d3("Bleu"), d3("Vert"), d3("Jaune")], etat4).map((x) => x.label),
  ["D3 · Terrain 1", "D3 · Terrain 2"]
);

// Les équipes posées sur la feuille : une ligne gardée (et ses chiffres), une
// ligne neuve, un joueur de la feuille sans équipe, et l'ordre des terrains.
assert.equal(libelleCourt("1 novembre"), "1 nov.");
assert.equal(libelleCourt("8 février"), "8 févr.");
const feuille: Saison = { ...coupee, journees: [...coupee.journees, { j: 4, date: "1 nov.", sflTime: true }], entries: [...coupee.entries, { ...newEntry(4, "Jade", null), retard: true }, newEntry(4, "Kenza", null)] };
const posee = poserEquipes(feuille, 4, c4.teams);
const lignes4 = posee.entries.filter((e) => e.j === 4);
assert.equal(lignes4.length, 11);
assert.equal(lignes4.find((e) => e.player === "Jade")?.retard, true, "sa ligne reste la sienne");
assert.equal(lignes4.find((e) => e.player === "Kenza")?.team, null, "sur la feuille sans équipe");
const match = computeJournees(posee).find((x) => x.j === 4)!.matches![0];
assert.deepEqual([match.teamA.name, match.teamB.name], [c4.teams[0].name, c4.teams[1].name]);
const neuve = poserEquipes(coupee, 4, c4.teams, "1 nov.");
assert.deepEqual(neuve.journees.at(-1), { j: 4, date: "1 nov.", sflTime: true, mvpAuto: true });

console.log("équipes par division : terrains, équilibre, mélange, gardiens, réponses tardives, calendrier, feuille, tout est bon");

// Une saison réelle : les inscrits de sa dernière feuille, avec les divisions du moment.
const fichier = process.argv[2];
if (fichier) {
  const brut = JSON.parse(readFileSync(fichier, "utf8")) as Saison | { data: Saison };
  const reelle = "data" in brut ? brut.data : brut;
  const etat = etatDivisions(reelle);
  const derniere = Math.max(...reelle.journees.map((m) => m.j));
  const venus = [...new Set(reelle.entries.filter((e) => e.j === derniere && e.statut === "Présent").map((e) => e.player))];
  const t0 = performance.now();
  const comp = composer(reelle, venus, etat);
  const ms = performance.now() - t0;
  const hr = historique(reelle);
  const deja = (players: string[]) => {
    let n = 0;
    for (let i = 0; i < players.length; i++)
      for (let k = i + 1; k < players.length; k++) n += hr.ensemble.get([players[i], players[k]].sort().join("\u0001")) ? 1 : 0;
    return n;
  };
  console.log(`\n${venus.length} inscrits à la J${derniere}, ${comp.terrains.length} terrains, composés en ${ms.toFixed(0)} ms`);
  comp.terrains.forEach((t, i) => {
    const label = t.divisions.map(nomDivision).join(" · ");
    console.log(`\nTerrain ${i + 1} (${label}), écart ${t.ecart.toFixed(2)}`);
    for (const eq of t.equipes) {
      const moy = eq.players.reduce((s, n) => s + (comp.niveaux.get(n)?.valeur ?? 0), 0) / eq.players.length;
      console.log(`  ${eq.name.padEnd(7)} ${moy.toFixed(2).padStart(5)}  ${eq.players.map((n) => `${n} (${nomDivision(comp.niveaux.get(n)!.division)})`).join(", ")}  · déjà coéquipiers : ${deja(eq.players)}`);
    }
  });
  // Le tirage de l'admin jusqu'ici : l'OVR seul, toutes divisions mêlées.
  const notes = new Map(computeStandings(reelle).map((p) => [p.name, ovr(rareStats(p.stats))]));
  const tirage = generateBalancedTeams(venus.map((name) => ({ name, ovr: notes.get(name) ?? 75 })), comp.teams.length);
  const repetes = (teams: { players: string[] }[]) => teams.reduce((s, t) => s + deja(t.players), 0);
  console.log(`\nDéjà coéquipiers dans une même équipe : ${repetes(comp.teams)} (divisions) contre ${repetes(tirage.map((t) => ({ players: t.players.map((p) => p.name) })))} (tirage à l'OVR)`);
  assert.equal(new Set(comp.teams.flatMap((t) => t.players)).size, venus.filter((n) => n !== "Sabri").length, "chacun a une équipe, une seule");
}
