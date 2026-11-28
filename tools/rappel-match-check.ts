// Le rappel d'une heure avant le match (28/11/2026, lib/sfl/rappel-avant-match.ts) :
// une journée à trois matchs (11h15, 12h15, 13h30), rendez-vous 15 minutes
// avant, chaque match prévenu dans l'heure d'avant son rendez-vous, ses seuls
// joueurs avec leur couleur, rien ailleurs.
//   npx tsx tools/rappel-match-check.ts
import assert from "node:assert/strict";
import { rappelsDus } from "../src/lib/sfl/rappel-avant-match";
import { dateDeParis } from "../src/lib/sfl/convocation-temps";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

const equipes: Record<string, string[]> = {
  "Noirs 1": ["A1", "A2"], "Blancs 1": ["B1", "B2"],
  "Noirs 2": ["C1", "C2"], "Blancs 2": ["D1", "D2"],
  "Noirs 3": ["E1", "E2"], "Blancs 3": ["F1", "F2"],
};
const ligne = (player: string, team: string | null): MatchEntry =>
  ({ j: 8, player, team, statut: "Présent", result: null, sflTime: false, buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false }) as MatchEntry;
const entries = [...Object.entries(equipes).flatMap(([t, ps]) => ps.map((p) => ligne(p, t))), ligne("Joad", null)];
const saison = {
  numero: 2,
  roster: [...Object.values(equipes).flat(), "Joad"].map((name) => ({ name, poste: null, profil: "Actif", base: null })),
  entries,
  journees: [
    {
      j: 8, date: "29 nov.", sflTime: false, heure: "11h",
      matchsDuJour: [
        { heure: "11h15", equipes: ["Noirs 1", "Blancs 1"], terrain: "Terrain 1" },
        { heure: "12h15", equipes: ["Noirs 2", "Blancs 2"], terrain: "Terrain 2" },
        { heure: "13h30", equipes: ["Noirs 3", "Blancs 3"], terrain: "Terrain 1" },
      ],
    },
  ],
  terrains: [{ id: 1, nom: "Hippodrome de Marcq", adresse: "137 Boulevard Clémenceau 59700 Marcq-en-Barœul", lat: 0, lng: 0, defaut: true }],
  convocations: [],
  events: [],
} as unknown as Saison;

const a = (h: number, m = 0) => dateDeParis(2026, 11, 29, h, m);
const dus = (d: Date) => rappelsDus(saison, 2, d);

let n = 0;
const ok = (c: boolean, m: string) => { assert.ok(c, m); n++; };

ok(dus(a(9, 59)).length === 0, "9 h 59 : trop tôt");
const dix = dus(a(10, 0));
ok(dix.length === 1 && dix[0].n === 0, "10 h : le Match 1 (rendez-vous 11 h, coup d'envoi 11 h 15)");
ok(dix[0].joueurs.map((x) => x.nom).sort().join() === "A1,A2,B1,B2", "ses seuls joueurs, sans Joad");
assert.equal(dix[0].titre, "Match dans 1 h · Rendez-vous 11h00"); n++;
const texte = (nom: string) => dix[0].joueurs.find((x) => x.nom === nom)!.texte;
assert.equal(texte("A1"), "Noirs 1 contre Blancs 1 · Tu joues en noir · Coup d'envoi 11h15 · Terrain 1 · Hippodrome de Marcq, 137 Boulevard Clémenceau 59700 Marcq-en-Barœul"); n++;
ok(texte("B2").includes("Tu joues en blanc"), "les Blancs en blanc");
ok(dus(a(11, 0)).some((d) => d.n === 0), "11 h pile : encore");
ok(!dus(a(11, 1)).some((d) => d.n === 0), "11 h 01 : trop tard pour le Match 1");
const onze = dus(a(11, 0)).find((d) => d.n === 1);
ok(!!onze && onze.titre.endsWith("Rendez-vous 12h00"), "11 h : le Match 2");
ok(dus(a(12, 14)).length === 0, "12 h 14 : rien");
const m3 = dus(a(12, 15));
ok(m3.length === 1 && m3[0].n === 2 && m3[0].titre.endsWith("13h15"), "12 h 15 : le Match 3, rendez-vous 13 h 15");
ok(dus(dateDeParis(2026, 11, 22, 10, 0)).length === 0, "un autre dimanche : rien");
ok(dus(dateDeParis(2026, 11, 30, 10, 0)).length === 0, "le lendemain : rien");

console.log(`rappel-match : ${n} vérifications`);
