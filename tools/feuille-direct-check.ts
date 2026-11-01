// La feuille de match tenue par un joueur (lib/sfl/feuille-direct.ts, 01/11/2026).
// Les mêmes chiffres que le banc SQL (tools/sql/feuille-direct-check.sql, T7 et
// T10) : appliquerFeuille est le miroir exact de public.appliquer_feuille.
//   npx tsx tools/feuille-direct-check.ts
import assert from "node:assert/strict";
import {
  annulation,
  appliquerFeuille,
  avecGestes,
  droitDePrendre,
  etatDeLaFeuille,
  joueursDuMatch,
  libelleEntree,
  minuteDe,
  pileDuJournal,
  scoreDeLaFeuille,
  type Compteurs,
  type EntreeJournal,
  type FeuilleDirect,
} from "../src/lib/sfl/feuille-direct";
import { computeJournees } from "../src/lib/sfl/saisie/engine";
import { newEntry } from "../src/lib/sfl/saisie/mutations";
import { verifierFeuille } from "../src/lib/sfl/saisie/integrite";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

// Le dimanche de la J4, à 15 h à Paris.
const maintenant = new Date("2026-11-01T14:00:00Z");
const L = (j: number, player: string, team: string, x: Partial<MatchEntry> = {}): MatchEntry => ({ ...newEntry(j, player, team), ...x });
const N1: [string, string] = ["Noirs 1", "Blancs 1"];
const N2: [string, string] = ["Noirs 2", "Blancs 2"];

const saison: Saison = {
  numero: 1,
  roster: ["Ilyes", "Théo", "Anis", "Badis", "Sami", "Kader", "Naim", "Yanis"].map((name) => ({ name, poste: null, profil: "Actif", base: null })),
  convocations: [],
  journees: [
    { j: 3, date: "25 oct.", sflTime: false },
    { j: 4, date: "1 nov.", sflTime: false, mvpAuto: true, matchsDuJour: [{ equipes: N1 }, { equipes: N2 }] },
    { j: 5, date: "8 nov.", sflTime: false, brouillon: { depuis: "x", par: "Sabri" }, matchsDuJour: [{ equipes: N1 }] },
  ],
  entries: [
    L(3, "Ilyes", "Noirs 1", { result: "Victoire", buts: 2 }),
    L(3, "Théo", "Blancs 1", { result: "Défaite", passes: 1 }),
    L(4, "Ilyes", "Noirs 1", { buts: 1 }),
    L(4, "Théo", "Noirs 1", { retard: true }),
    L(4, "Anis", "Noirs 1"),
    L(4, "Badis", "Blancs 1"),
    L(4, "Sami", "Blancs 1"),
    L(4, "Kader", "Noirs 2", { buts: 1 }),
    L(4, "Naim", "Blancs 2"),
    L(4, "Sami", "Blancs 2", { extraTime: true }),
    L(5, "Théo", "Noirs 1"),
    L(4, "Yanis", "Blancs 1"),
  ],
};

// 1 · Qui peut prendre la feuille (public.droit_feuille, T1 du banc SQL).
assert.equal(droitDePrendre(saison, 4, N1, "Théo", maintenant), null);
assert.equal(droitDePrendre(saison, 4, N1, " théo ", maintenant), null, "sans casse ni espaces");
assert.equal(droitDePrendre(saison, 4, N1, "Kader", maintenant), "pas-ton-match", "un joueur d'un autre match");
assert.equal(droitDePrendre(saison, 4, N1, "Sabri", maintenant), "pas-ton-match", "l'admin qui ne joue pas");
assert.equal(droitDePrendre(saison, 4, N1, null, maintenant), "pas-ton-match");
assert.equal(droitDePrendre(saison, 5, N1, "Théo", maintenant), "brouillon");
assert.equal(droitDePrendre(saison, 3, N1, "Ilyes", maintenant), "pas-du-jour");
assert.equal(droitDePrendre(saison, 4, ["Noirs 1", "Blancs 2"], "Théo", maintenant), "match");
assert.equal(droitDePrendre(saison, 9, N1, "Théo", maintenant), "journee");
assert.equal(droitDePrendre(saison, 4, N1, "Théo", new Date("2026-11-02T00:30:00Z")), "pas-du-jour", "minuit passé à Paris");
const terminee = { ...saison, entries: saison.entries.map((e) => (e.j === 4 && e.team === "Noirs 1" ? { ...e, result: "Victoire" as const } : e)) };
assert.equal(droitDePrendre(terminee, 4, N1, "Théo", maintenant), "terminee");

// 2 · Les joueurs du match : les présents, puis l'Xtratime ; jamais la vitrine.
assert.deepEqual(joueursDuMatch(saison, 4, N1), { noirs: ["Ilyes", "Théo", "Anis"], blancs: ["Badis", "Sami", "Yanis"] });
assert.deepEqual(joueursDuMatch(saison, 4, N2), { noirs: ["Kader"], blancs: ["Naim", "Sami"] });
const vitrine = { ...saison, entries: [...saison.entries, { ...L(4, "Sabri", "Noirs 1"), vitrine: true as const }] };
assert.deepEqual(joueursDuMatch(vitrine, 4, N1).noirs, ["Ilyes", "Théo", "Anis"]);

// 3 · Les gestes : entre 0 et 99, un −1 à zéro ne fait rien.
const c0: Compteurs = { Ilyes: { buts: 1 } };
const c1 = avecGestes(c0, [
  { joueur: "Ilyes", quoi: "buts", d: 1 },
  { joueur: "Anis", quoi: "passes", d: 1 },
]);
assert.deepEqual(c1, { Ilyes: { buts: 2 }, Anis: { passes: 1 } });
assert.deepEqual(avecGestes(c1, [{ joueur: "Badis", quoi: "passes", d: -1 }]), c1);
assert.equal(avecGestes({ X: { buts: 99 } }, [{ joueur: "X", quoi: "buts", d: 1 }]).X.buts, 99);

// 4 · Le match 1 du banc SQL : Ilyes 2, Anis une passe, Sami deux arrêts et un
// but, Badis contre son camp. 3 – 1, Ilyes MVP.
const m1: Compteurs = { Ilyes: { buts: 2 }, Anis: { passes: 1 }, Sami: { arrets: 2, buts: 1 }, Badis: { csc: 1 } };
assert.deepEqual(scoreDeLaFeuille(saison, 4, N1, m1), [3, 1]);
const s1 = appliquerFeuille(saison, 4, N1, m1);
const ligne = (s: Saison, j: number, p: string, t: string) => s.entries.find((e) => e.j === j && e.player === p && e.team === t)!;
assert.deepEqual(
  (["Ilyes", "Théo", "Anis"] as const).map((p) => [ligne(s1, 4, p, "Noirs 1").result, ligne(s1, 4, p, "Noirs 1").mvp]),
  [["Victoire", true], ["Victoire", false], ["Victoire", false]]
);
assert.equal(ligne(s1, 4, "Ilyes", "Noirs 1").buts, 2);
assert.equal(ligne(s1, 4, "Ilyes", "Noirs 1").teamScoreBonus, 1, "le but contre son camp, sur la première ligne des Noirs");
assert.equal(ligne(s1, 4, "Anis", "Noirs 1").passes, 1);
assert.deepEqual([ligne(s1, 4, "Sami", "Blancs 1").buts, ligne(s1, 4, "Sami", "Blancs 1").arrets, ligne(s1, 4, "Sami", "Blancs 1").result], [1, 2, "Défaite"]);
assert.deepEqual([ligne(s1, 4, "Badis", "Blancs 1").buts, ligne(s1, 4, "Badis", "Blancs 1").result], [0, "Défaite"]);
assert.equal(ligne(s1, 4, "Théo", "Noirs 1").retard, true, "le reste de la ligne ne bouge pas");
// Seules les lignes du match 1 changent ; le moteur lit le même score.
s1.entries.forEach((e, i) => {
  if (e.j === 4 && (e.team === "Noirs 1" || e.team === "Blancs 1")) return;
  assert.equal(e, saison.entries[i], `ligne ${i} hors du match`);
});
assert.deepEqual(s1.journees, saison.journees);
const vu = computeJournees(s1).find((x) => x.j === 4)!.matches![0];
assert.deepEqual([vu.teamA.score, vu.teamB.score], [3, 1]);
assert.deepEqual(verifierFeuille(s1, 4).filter((e) => e.r === "I7"), [], "des résultats cohérents");

// 5 · Le match 2 du banc SQL : Kader 1 (déjà saisi), Naim contre son camp,
// Sami en Xtratime 1. 2 – 1 ; l'Xtratime n'a ni résultat ni MVP.
const m2: Compteurs = { Kader: { buts: 1 }, Naim: { csc: 1 }, Sami: { buts: 1 } };
assert.deepEqual(scoreDeLaFeuille(saison, 4, N2, m2), [2, 1]);
const s2 = appliquerFeuille(s1, 4, N2, m2);
assert.deepEqual([ligne(s2, 4, "Kader", "Noirs 2").result, ligne(s2, 4, "Kader", "Noirs 2").teamScoreBonus, ligne(s2, 4, "Kader", "Noirs 2").mvp], ["Victoire", 1, true]);
assert.equal(ligne(s2, 4, "Naim", "Blancs 2").result, "Défaite");
const xt = ligne(s2, 4, "Sami", "Blancs 2");
assert.deepEqual([xt.buts, xt.result, xt.mvp], [1, null, false]);
assert.deepEqual(ligne(s2, 4, "Sami", "Blancs 1"), ligne(s1, 4, "Sami", "Blancs 1"), "le match 1 ne bouge plus");
// Un match nul, sans MVP à zéro partout.
const nul = appliquerFeuille(saison, 4, N2, {});
assert.deepEqual([ligne(nul, 4, "Kader", "Noirs 2").result, ligne(nul, 4, "Naim", "Blancs 2").result], ["Nul", "Nul"]);
assert.equal(ligne(nul, 4, "Kader", "Noirs 2").buts, 0, "la feuille fait foi");

// 6 · Le journal : ↶ défait le dernier geste ; une correction (−) reste dans la pile.
const t = (s: number) => new Date(Date.parse("2026-11-01T12:30:00Z") + s * 1000).toISOString();
const but: EntreeJournal = { le: t(60), gestes: [{ joueur: "Ilyes", quoi: "buts", d: 1 }, { joueur: "Anis", quoi: "passes", d: 1 }] };
const arret: EntreeJournal = { le: t(300), gestes: [{ joueur: "Sami", quoi: "arrets", d: 1 }] };
assert.deepEqual(pileDuJournal([but, arret]), [but, arret]);
assert.deepEqual(pileDuJournal([but, arret, { le: t(320), gestes: annulation(arret) }]), [but]);
const moins: EntreeJournal = { le: t(400), gestes: [{ joueur: "Ilyes", quoi: "buts", d: -1 }] };
assert.deepEqual(pileDuJournal([but, moins]), [but, moins]);
assert.equal(libelleEntree(but), "But · Ilyes · passe Anis");
assert.equal(libelleEntree(arret), "Arrêt · Sami");
assert.equal(libelleEntree(moins), "− But · Ilyes");
assert.equal(libelleEntree({ le: t(1), gestes: [{ joueur: "Badis", quoi: "csc", d: 1 }] }), "Contre son camp · Badis");
assert.equal(minuteDe(t(0), t(30)), 1);
assert.equal(minuteDe(t(0), t(23 * 60 + 5)), 24);

// 7 · L'état de la feuille pour un joueur.
const f = (x: Partial<FeuilleDirect>): FeuilleDirect => ({
  saison: 1, j: 4, noirs: "Noirs 1", blancs: "Blancs 1", preneur: null, preneur_nom: null, pris_le: null,
  debut: t(0), fin: null, scelle_par: null, version: null, compteurs: {}, journal: [], maj_le: t(0), ...x,
});
assert.equal(etatDeLaFeuille(null, "u1"), "libre");
assert.equal(etatDeLaFeuille(f({ preneur: "u1" }), "u1"), "mienne");
assert.equal(etatDeLaFeuille(f({ preneur: "u1" }), "u2"), "tenue");
assert.equal(etatDeLaFeuille(f({ preneur: null }), "u2"), "libre", "libérée par l'admin");
assert.equal(etatDeLaFeuille(f({ preneur: "u1", fin: t(3000) }), "u1"), "scellee");

console.log("feuille-direct-check : ok");
