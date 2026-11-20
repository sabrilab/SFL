// Les « Je viens » posés sur les terrains (saisie/venus-sur-la-feuille.ts, 31/10/2026) :
// une journée vide les reçoit tous, au plus TERRAINS_MAX terrains ; une
// journée qui a ses joueurs les garde et ne fait entrer que les nouveaux.
//   npx tsx tools/venus-check.ts
import assert from "node:assert/strict";
import { appliquerEntreesAuto, entreesAuto, equipesDesVenus, joueursPoses, posesAuto, venusAPlacer } from "../src/lib/sfl/saisie/venus-sur-la-feuille";
import { addEntry, ajouterMatch, deleteEntryAt, ligneNeuve, matchsDeclares, newEntry, poserEquipes, preparerJournee, updateJournee } from "../src/lib/sfl/saisie/mutations";
import { niveaux, TERRAINS_MAX } from "../src/lib/sfl/equipes-division";
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

// Sous les terrains (20/11/2026) : les trois nouveaux rangés sous le match et le camp proposés.
const declares = matchsDeclares(s, p.j);
const range = venusAPlacer(s, p.j, declares, noms.slice(12, 15), encore, null);
assert.equal(range.matchs.reduce((n, m) => n + m.joueurs.length, 0), 3, "les trois nouveaux sous un match");
assert.equal(range.remplacants.length, 0);
for (const m of range.matchs)
  for (const v of m.joueurs) {
    const equipe: string = encore!.find((x) => x.players.includes(v.nom))!.name;
    assert.equal(declares[m.n - 1].equipes[v.camp === "Noirs" ? 0 : 1], equipe, `${v.nom} sous son camp`);
    assert.equal(v.ligne, null);
  }
// Sans proposition : tous remplaçants ; une ligne présente sans équipe y est, avec son index.
const sansEquipe = { ...s, entries: [...s.entries, newEntry(p.j, noms[20], null)] };
const libre = venusAPlacer(sansEquipe, p.j, declares, [noms[21], noms[20]], null, null);
assert.equal(libre.matchs.length, 0);
assert.deepEqual(new Set(libre.remplacants.map((v) => v.nom)), new Set([noms[20], noms[21]]));
assert.equal(libre.remplacants.find((v) => v.nom === noms[20])!.ligne, sansEquipe.entries.length - 1);

// Le niveau (20/11/2026) : à note égale, la forme (3 derniers résultats) et le rang départagent.
{
  const deux = ["Forme A", "Forme B"];
  const jours = [1, 2, 3, 4].map((j) => ({ j, date: `${j} nov.`, sflTime: false }));
  const lignes = jours.flatMap(({ j }) => [
    { ...newEntry(j, deux[0], "Noirs 1"), result: "Victoire" as const },
    { ...newEntry(j, deux[1], "Blancs 1"), result: "Défaite" as const },
  ]);
  const s2: Saison = { journees: jours, roster: deux.map((name) => ({ name, poste: null, profil: "Actif", base: null })), entries: lignes, convocations: [] };
  const n = niveaux(s2, deux, null);
  const a = n.get(deux[0])!;
  const b = n.get(deux[1])!;
  assert.deepEqual(a.derniers, ["Victoire", "Victoire", "Victoire"], "les 3 derniers, pas 4");
  assert.deepEqual(b.derniers, ["Défaite", "Défaite", "Défaite"]);
  assert.ok(a.rang != null && b.rang != null && a.rang < b.rang, "le rang au classement");
  assert.ok(a.valeur > b.valeur, "le plus en forme passe devant");
  // Sous les terrains, le même ordre.
  const range2 = venusAPlacer(s2, 5, [], deux.slice().reverse(), null, null);
  assert.deepEqual(range2.remplacants.map((v) => v.nom), deux);
}

// La compo automatique du brouillon (20/11/2026).
{
  const b = preparerJournee(base, "15 nov.", { brouillon: { par: "Sabri", le: new Date("2026-11-10T10:00:00Z") } });
  let x = ajouterMatch(ajouterMatch(b.saison, b.j, {}).saison, b.j, {}).saison;
  // Mise en ligne d'office : le vendredi 19 h d'avant (13 nov., 18 h UTC), suivie quand la date change.
  assert.equal(x.journees.find((m) => m.j === b.j)!.brouillon!.jusqua, "2026-11-13T18:00:00.000Z");
  const r1 = entreesAuto(x, b.j, noms.slice(0, 12), null, null);
  assert.equal(r1?.genre, "composer");
  x = appliquerEntreesAuto(x, b.j, r1);
  assert.equal(posesAuto(r1), 12);
  assert.equal(entreesAuto(x, b.j, noms.slice(0, 12), null, null), null, "rien de neuf, rien à faire");
  // L'admin sort un joueur, puis deux nouveaux répondent : eux seuls entrent, le sorti reste dehors.
  const sorti = x.entries.findIndex((e) => e.j === b.j && e.player === noms[3]);
  x = deleteEntryAt(x, sorti);
  const avant = new Map(x.entries.filter((e) => e.j === b.j).map((e) => [e.player, e.team]));
  const r2 = entreesAuto(x, b.j, noms.slice(0, 14), null, null);
  assert.equal(r2?.genre, "entrer");
  x = appliquerEntreesAuto(x, b.j, r2);
  const apres = x.entries.filter((e) => e.j === b.j);
  for (const [n, t] of avant) assert.equal(apres.find((e) => e.player === n)?.team, t, `${n} n'a pas bougé`);
  assert.ok(!apres.some((e) => e.player === noms[3]), "le joueur sorti n'est pas revenu");
  assert.ok([noms[12], noms[13]].every((n) => apres.some((e) => e.player === n && e.team)), "les deux nouveaux sont sur un terrain");
  // Publiée : plus rien d'automatique.
  const publiee = { ...x, journees: x.journees.map((m) => (m.j === b.j ? { ...m, brouillon: undefined } : m)) };
  assert.equal(entreesAuto(publiee, b.j, noms.slice(0, 16), null, null), null);
  // Cinq posés à la main sur le match 1, le match 2 encore vide, 14 réponses :
  // 19 joueurs, c'est 10 et 9 (le moteur), pas 15 et 4 ; les cinq ne bougent pas.
  {
    const c = preparerJournee(base, "15 nov.", { brouillon: { par: "Sabri", le: new Date("2026-11-10T10:00:00Z") } });
    let y = ajouterMatch(ajouterMatch(c.saison, c.j, {}).saison, c.j, {}).saison;
    const [m1, m2] = matchsDeclares(y, c.j);
    noms.slice(0, 5).forEach((n, i) => (y = addEntry(y, ligneNeuve(y, c.j, n, m1.equipes[i % 2]))));
    const r = entreesAuto(y, c.j, noms.slice(0, 19), null, null);
    assert.equal(r?.genre, "entrer");
    assert.equal(posesAuto(r), 14);
    y = appliquerEntreesAuto(y, c.j, r);
    const sur = (eqs: readonly string[]) => y.entries.filter((e) => e.j === c.j && e.team && eqs.includes(e.team)).length;
    assert.deepEqual([sur(m1.equipes), sur(m2.equipes)].sort((a, b) => a - b), [9, 10], "10 et 9");
    noms.slice(0, 5).forEach((n, i) => assert.equal(y.entries.find((e) => e.j === c.j && e.player === n)?.team, m1.equipes[i % 2], `${n} reste où l'admin l'a mis`));
    for (const eqs of [m1.equipes, m2.equipes]) {
      const [a, b2] = eqs.map((eq) => y.entries.filter((e) => e.j === c.j && e.team === eq).length);
      assert.ok(Math.abs(a - b2) <= 1, "des camps à un joueur près");
    }
  }
  // La date change : la mise en ligne d'office suit (le dimanche 22 → vendredi 20).
  const deplacee = updateJournee({ ...x, journees: x.journees.map((m) => (m.j === b.j ? { ...m, brouillon: { ...m.brouillon!, jusqua: "2099-01-01T00:00:00.000Z" } } : m)) }, b.j, { date: "22 nov. 2099".replace(" 2099", "") });
  const jq = deplacee.journees.find((m) => m.j === b.j)!.brouillon!.jusqua;
  assert.ok(jq === undefined || /T1[78]:00:00\.000Z$/.test(jq), "vendredi 19 h, heure de Paris");
}

console.log("venus-check: ok");
