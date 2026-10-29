// Vérifie les équipes d'un dimanche en divisions (lib/sfl/equipes-division.ts)
// sur une saison fabriquée : les terrains par division, l'équilibre, le
// mélange de ceux qui ont déjà joué ensemble, les gardiens, les réponses
// tardives, et qu'un même appel rend toujours les mêmes équipes. Depuis
// l'incident de la J4 (29/10) : jamais plus de TERRAINS_MAX terrains (33, 45
// et 73 venus), les remplaçants dans l'ordre d'arrivée, completer qui ne
// remplit pas un terrain plein, les confirmations de l'admin.
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
  ordreDArrivee,
  questionDeComposition,
  REGLES_EQUIPES,
  repartir,
  resumer,
  TERRAINS_MAX,
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
import { remplacantsDe } from "../src/lib/sfl/presence-feuille";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

const niveau = (nom: string, division: Division, valeur: number, gardien = false): Niveau => ({ nom, division, note: 75, ppm: null, valeur, gardien });

// Les terrains, sans plafond : la D1 trop courte (6) rejoint la D2 (10), et
// ces 16 prennent deux terrains, les meilleurs ensemble ; la D3 (20) en prend
// deux aussi. (Avec le plafond, plus bas.)
const joueurs = [
  ...Array.from({ length: 6 }, (_, i) => niveau(`a${i}`, 1, 2 - i * 0.1)),
  ...Array.from({ length: 10 }, (_, i) => niveau(`b${i}`, 2, 1 - i * 0.1)),
  ...Array.from({ length: 20 }, (_, i) => niveau(`c${i}`, 3, -i * 0.1)),
];
const terrains = repartirSurTerrains(joueurs, Infinity);
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
assert.deepEqual(nomsDEquipes(4), ["Noirs 1", "Blancs 1", "Noirs 2", "Blancs 2"]);
assert.deepEqual(nomsDEquipes(10).slice(6), ["Noirs 4", "Blancs 4", "Noirs 5", "Blancs 5"]);

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

// En divisions : les dix classés tiennent dans les 30 places de la D1 : un
// seul terrain, un seul match, les Noirs contre les Blancs.
const c4 = composer(coupee, NOMS, etat4);
assert.equal(c4.terrains.length, 1);
assert.deepEqual(c4.teams.map((x) => x.name), ["Noirs 1", "Blancs 1"]);
assert.deepEqual(terrainsDesEquipes(c4.teams, etat4).map((x) => x.label), ["Match 1 · D1"]);
// Une division sur deux terrains joue deux matchs ; une division courte avec sa voisine se dit à deux.
const enD1 = [...etat4.actuelle].filter(([, d]) => d === 1).map(([n]) => n);
const d1 = (n: string) => ({ name: n, players: enD1.slice(0, 2) });
assert.deepEqual(
  terrainsDesEquipes([d1("Noirs 1"), d1("Blancs 1"), d1("Noirs 2"), d1("Blancs 2")], etat4).map((x) => [x.n, x.divisions, x.label]),
  [
    [1, "D1", "Match 1 · D1"],
    [2, "D1", "Match 2 · D1"],
  ]
);
assert.deepEqual(
  terrainsDesEquipes([{ name: "Noirs 1", players: ["Ana", "Inconnu"] }, { name: "Blancs 1", players: [] }], etat4).map((x) => x.divisions),
  ["D1–D3"],
  "qui n'a jamais joué est en D3"
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
assert.deepEqual(neuve.journees.at(-1), { j: 4, date: "1 nov.", sflTime: true, mvpAuto: true, matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }] });
// Un match garde l'heure, le lieu et le terrain que l'admin lui avait donnés.
const reglee: Saison = {
  ...feuille,
  journees: feuille.journees.map((m) => (m.j === 4 ? { ...m, matchsDuJour: [{ equipes: ["Orange", "Bleu"], heure: "14h30", lieuId: 2, terrain: "Terrain 3" }] } : m)),
};
assert.deepEqual(poserEquipes(reglee, 4, c4.teams).journees.find((m) => m.j === 4)?.matchsDuJour, [
  { equipes: ["Noirs 1", "Blancs 1"], heure: "14h30", lieuId: 2, terrain: "Terrain 3" },
]);


/* ------------------- Le plafond de terrains (incident de la J4) ------------------- */

assert.equal(TERRAINS_MAX, 2, "2 terrains en attendant Sabri : à changer ici et dans equipes-division.ts ensemble");
const { maxParTerrain } = REGLES_EQUIPES;
const places = TERRAINS_MAX * maxParTerrain;

// Ceux qui viennent, D1, D2 puis D3 : `parDivision` joueurs chacune, dans
// l'ordre d'arrivée donné (un sur trois de chaque division à tour de rôle).
function venusEnDivisions(n1: number, n2: number, n3: number): Niveau[] {
  const d = (div: Division, n: number) => Array.from({ length: n }, (_, i) => niveau(`d${div}-${String(i).padStart(2, "0")}`, div, (3 - div) - i * 0.03));
  const listes = [d(1, n1), d(2, n2), d(3, n3)];
  const out: Niveau[] = [];
  for (let i = 0; out.length < n1 + n2 + n3; i++) for (const l of listes) if (l[i]) out.push(l[i]);
  return out;
}
const rangDe = (l: Niveau[]) => new Map(l.map((p, i) => [p.nom, i]));

for (const [n1, n2, n3] of [
  [11, 11, 11], // 33 : trois terrains avant, deux maintenant
  [15, 15, 15], // 45
  [25, 24, 24], // 73 : cinq terrains et plus avant
  [10, 10, 10], // 30 : juste ce que tiennent deux terrains
  [16, 9, 8], // la D1 trop pleine
  [3, 20, 10], // la D1 trop courte
]) {
  const tous = venusEnDivisions(n1, n2, n3);
  const total = tous.length;
  const sansPlafond = repartirSurTerrains(tous, Infinity);
  const { terrains: ts, remplacants } = repartir(tous);
  const dit = `${total} venus (${n1}/${n2}/${n3})`;
  assert.ok(ts.length <= TERRAINS_MAX, `${dit} : ${ts.length} terrains, ${TERRAINS_MAX} au plus`);
  assert.ok(ts.every((t) => t.length <= maxParTerrain && t.length >= 2), `${dit} : ${ts.map((t) => t.length)} par terrain`);
  assert.equal(ts.flat().length + remplacants.length, total, `${dit} : personne ne se perd`);
  assert.equal(new Set([...ts.flat(), ...remplacants].map((p) => p.nom)).size, total, `${dit} : chacun une seule fois`);
  assert.equal(ts.flat().length, Math.min(total, places), `${dit} : toutes les places servent`);
  // Les remplaçants sont les derniers arrivés.
  const rang = rangDe(tous);
  const dernierQuiJoue = Math.max(...ts.flat().map((p) => rang.get(p.nom)!));
  assert.ok(remplacants.every((p) => rang.get(p.nom)! > dernierQuiJoue), `${dit} : les remplaçants sont les derniers arrivés`);
  // L'ordre des divisions : la D1 sur le premier terrain, jamais une D3 avant une D1.
  const plusHaute = (t: Niveau[]) => Math.min(...t.map((p) => p.division));
  const plusBasse = (t: Niveau[]) => Math.max(...t.map((p) => p.division));
  for (let k = 1; k < ts.length; k++) assert.ok(plusBasse(ts[k - 1]) <= plusHaute(ts[k]), `${dit} : les divisions dans l'ordre`);
  // Sous le plafond, rien ne change.
  if (sansPlafond.length <= TERRAINS_MAX) assert.deepEqual(ts, sansPlafond, `${dit} : comme avant`);
  else assert.ok(sansPlafond.length > ts.length, `${dit} : ${sansPlafond.length} terrains avant`);
  console.log(`  ${dit} : ${sansPlafond.length} terrain(s) sans plafond → ${ts.length} (${ts.map((t) => t.length).join(" + ")}), ${remplacants.length} remplaçant(s)`);
}
// 33 venus, 11 par division : D1 et D2 ne tiennent pas sur un terrain (22),
// D2 et D3 non plus : l'échelle coupée en deux, la D1 entière sur le premier.
{
  const { terrains: ts, remplacants } = repartir(venusEnDivisions(11, 11, 11));
  assert.deepEqual(ts.map((t) => t.length), [15, 15]);
  assert.equal(remplacants.length, 3);
  // Les 30 premiers arrivés jouent : 10 de chaque division ; la D1 entière sur le premier terrain.
  assert.equal(ts[0].filter((p) => p.division === 1).length, 10, "la D1 entière sur le premier terrain");
  assert.ok(ts[1].every((p) => p.division >= 2), "rien de la D1 sur le second");
}
// 20 venus, 8/6/6 : sans plafond D1 (8) et D2–D3 (12), deux terrains : rien ne change.
assert.deepEqual(repartir(venusEnDivisions(8, 6, 6)).terrains.map((t) => t.length), [8, 12]);
// 26 venus, 9/9/8 : trois terrains avant ; maintenant D1 seule, D2 et D3 ensemble ? 17 > 15 :
// l'échelle en deux (13 + 13).
assert.deepEqual(repartir(venusEnDivisions(9, 9, 8)).terrains.map((t) => t.length), [13, 13]);
// 24 venus, 12/8/4 : la D3 courte rejoint la D2 → 12 + 12 : deux terrains, divisions entières.
{
  const ts = repartir(venusEnDivisions(12, 8, 4)).terrains;
  assert.deepEqual(ts.map((t) => t.length), [12, 12]);
  assert.ok(ts[0].every((p) => p.division === 1));
}
// Un plafond de 3 se respecte aussi.
assert.ok(repartir(venusEnDivisions(25, 24, 24), 3).terrains.length === 3);

// composer avec de vraies divisions : 33, 45, 73 venus, TERRAINS_MAX respecté,
// les remplaçants dans l'ordre d'arrivée.
{
  const vrais = (n: number) => Array.from({ length: n }, (_, i) => `J${String(i).padStart(2, "0")}`);
  for (const n of [33, 45, 73]) {
    const noms = vrais(n);
    const etatN: EtatDivisions = {
      phase: "divisions",
      actuelle: new Map(noms.map((nom, i) => [nom, ((i % 3) + 1) as Division])),
      decoupage: {} as EtatDivisions["decoupage"],
      journees: [],
    };
    const saisonN: Saison = {
      ...saison,
      roster: noms.map((name, i) => ({ name, poste: i % 7 === 0 ? "G" : "MC", profil: "Actif", base: [70 + (i % 20), 70, 70, 70, 70, 70] })),
      entries: [],
    };
    const comp = composer(saisonN, noms, etatN);
    assert.ok(comp.terrains.length <= TERRAINS_MAX, `${n} venus : ${comp.terrains.length} terrains`);
    assert.equal(comp.teams.length, comp.terrains.length * 2);
    const dedans = comp.teams.flatMap((t) => t.players);
    assert.equal(dedans.length, Math.min(n, places), `${n} venus : ${dedans.length} placés`);
    assert.equal(dedans.length + comp.remplacants.length, n, `${n} venus : personne ne se perd`);
    assert.deepEqual(comp.remplacants, noms.slice(places), `${n} venus : les derniers arrivés remplaçants`);
    assert.ok(comp.teams.every((t) => t.players.length >= Math.floor(maxParTerrain / 2)), `${n} venus : du 7 contre 8, pas du 5 contre 5`);
    const r = resumer(comp.teams, noms);
    assert.equal(r.terrains, TERRAINS_MAX);
    assert.equal(r.auDela, false);
    assert.equal(r.sansEquipe.length, n - places);
    // Le téléphone d'un retardataire ne crée rien : les terrains sont pleins, il reste remplaçant.
    assert.equal(completer(saisonN, comp.teams, [...noms, "Zoé"], etatN), null, `${n} venus : un terrain plein ne prend personne`);
    // Un départ libère une place : le premier remplaçant arrivé la prend, pas un autre.
    const parti = comp.teams[0].players[0];
    const ajuste = completer(saisonN, comp.teams, [...noms.filter((x) => x !== parti), "Zoé"], etatN)!;
    assert.equal(ajuste.length, comp.teams.length, "jamais d'équipe de plus");
    assert.ok(ajuste.flatMap((t) => t.players).includes(noms[places]), "le premier remplaçant entre");
    assert.ok(!ajuste.flatMap((t) => t.players).includes("Zoé"), "Zoé, arrivée après, attend");
    console.log(`  composer, ${n} venus : ${comp.terrains.length} terrains (${comp.terrains.map((t) => t.equipes.map((e) => e.players.length).join(" contre ")).join(", ")}), ${comp.remplacants.length} remplaçants`);
  }
}

// completer ne fait jamais d'équipe : sans équipes, rien ; avec, autant d'équipes qu'avant.
assert.equal(completer(saison, [], NOMS, null), null);
assert.equal(tard.length, c.teams.length);

// L'ordre d'arrivée : la feuille d'abord, puis les réponses par heure, sans heure à la fin.
assert.deepEqual(
  ordreDArrivee(["Ana", "Bilal", "Chris", "Dina"], ["Eli", "Bilal"], (n) => ({ Ana: "2026-10-28T10:00:00Z", Chris: "2026-10-26T09:00:00Z", Dina: "2026-10-27T09:00:00Z" })[n]),
  ["Eli", "Bilal", "Chris", "Dina", "Ana"]
);

// Les confirmations de l'admin.
assert.equal(
  questionDeComposition(resumer([{ name: "Noirs 1", players: ["Ana"] }, { name: "Blancs 1", players: ["Bilal"] }], ["Ana", "Bilal", "Chris"])),
  "2 équipes sur 1 terrain, 1 joueur sans équipe : continuer ?"
);
{
  const six = ["Noirs 1", "Blancs 1", "Noirs 2", "Blancs 2", "Noirs 3", "Blancs 3"].map((name, i) => ({ name, players: [`p${i}`] }));
  const r = resumer(six, [...six.map((t) => t.players[0]), "q1", "q2", "Sabri"]);
  assert.equal(questionDeComposition(r), "6 équipes sur 3 terrains, 2 joueurs sans équipe : continuer ?", "Sabri, masqué, ne compte pas");
  assert.equal(r.auDela, true);
  assert.equal(questionDeComposition(resumer(six.slice(0, 4), six.slice(0, 4).map((t) => t.players[0]))), "4 équipes sur 2 terrains, chacun a son équipe : continuer ?");
}

// Les remplaçants restent dans la liste : « Je viens » sans équipe sur la feuille, ou dans la convocation.
{
  const f: Saison = { ...coupee, entries: [...coupee.entries, newEntry(4, "Ana", "Noirs 1"), newEntry(4, "Bilal", "Blancs 1"), newEntry(4, "Kenza", null)] };
  assert.deepEqual(remplacantsDe(["Ana", "Chris", "Bilal", "Sabri"], f, 4, null, (n) => n === "Sabri"), ["Chris"], "la feuille fait foi");
  assert.deepEqual(remplacantsDe(["Ana", "Chris"], coupee, 4, [{ players: ["Ana"] }], () => false), ["Chris"], "les équipes de la convocation");
  assert.deepEqual(remplacantsDe(["Ana", "Chris"], coupee, 4, null, () => false), [], "sans équipes, tout le monde vient");
}

console.log("équipes par division : terrains, plafond de terrains, remplaçants, équilibre, mélange, gardiens, réponses tardives, calendrier, feuille, confirmations, tout est bon");

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
