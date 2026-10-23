// Vérifie les divisions de la ligue (lib/sfl/divisions.ts) sur une saison
// fabriquée : le découpage en tiers, les écarts, la plage de points, les
// montées et descentes, le calendrier de l'annonce et ses phrases.
//   npx tsx tools/divisions-check.ts
// Avec une saison réelle (le document de la table saison, en JSON),
// imprime en plus son découpage et la notification de chaque joueur :
//   npx tsx tools/divisions-check.ts saison.json
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  annonceEnCours,
  apresLaJournee,
  decoupageAnnonce,
  decouper,
  DIVISIONS,
  ecartsDecoupage,
  editionAnnonce,
  etatDivisions,
  fenetreNotification,
  nomDivision,
  notificationAnnonce,
  phraseAnnonce,
  taDivision,
} from "../src/lib/sfl/divisions";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

/** Une ligne « Présent » qui vaut `n` points Pépite (1 de présence + le reste en bonus). */
const pts = (j: number, player: string, n: number): MatchEntry => ({
  j, player, team: null, statut: "Présent", result: "Défaite", sflTime: true,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false,
  pepiteBonus: n - 1,
});
const absent = (j: number, player: string, statut: MatchEntry["statut"]): MatchEntry => ({ ...pts(j, player, 0), statut, result: null, pepiteBonus: 0 });
/** Sur la feuille, pas encore joué. */
const inscrit = (j: number, player: string): MatchEntry => ({ ...pts(j, player, 1), result: null });

const NOMS = ["Ana", "Bilal", "Chris", "Dina", "Eli", "Fodé", "Gaby", "Hugo", "Inès"];
// J1 + J2 : 20, 18, 15, 15, 12, 10, 8, 5, 3 points.
const TOTAUX = [20, 18, 15, 15, 12, 10, 8, 5, 3];
const base: Saison = {
  numero: 1,
  journees: [
    { j: 1, date: "11 oct.", sflTime: true },
    { j: 2, date: "18 oct.", sflTime: true },
    { j: 3, date: "25 oct.", sflTime: true, mvpAuto: true },
  ],
  roster: [...NOMS, "Jade", "Sabri"].map((name) => ({ name, poste: null, profil: "Actif", base: null })),
  entries: [
    ...NOMS.flatMap((n, i) => [pts(1, n, Math.ceil(TOTAUX[i] / 2)), pts(2, n, Math.floor(TOTAUX[i] / 2))]),
    // La feuille de la J3, pas encore jouée : Jade y vient pour la première fois.
    ...[...NOMS, "Jade"].map((n) => inscrit(3, n)),
  ],
  convocations: [],
};

// Le découpage : neuf classés, trois par tiers ; Chris et Dina, à égalité à la limite, montent ensemble.
const d = decouper(base);
assert.equal(d.classes, 9, "la feuille non jouée de la J3 ne classe personne");
assert.deepEqual(d.divisions[1].map((p) => p.nom), ["Ana", "Bilal", "Chris", "Dina"]);
assert.deepEqual(d.divisions[2].map((p) => p.nom), ["Eli", "Fodé"]);
assert.deepEqual(d.divisions[3].map((p) => p.nom), ["Gaby", "Hugo", "Inès"]);
assert.equal(d.parNom.get("Jade"), undefined);

assert.deepEqual(ecartsDecoupage(d, "Eli"), { monter: 3, avance: 4 });
assert.deepEqual(ecartsDecoupage(d, "Ana"), { monter: null, avance: 8 });
assert.deepEqual(ecartsDecoupage(d, "Gaby"), { monter: 2, avance: null });
assert.equal(taDivision(d, "Eli"), "tu serais en D2, à 3 pts de la D1 et 4 pts devant la D3");
assert.equal(taDivision(d, "Dina"), "tu serais en D1, 3 pts devant la D2");
assert.equal(taDivision(d, "Gaby"), "tu serais en D3, à 2 pts de la D2");
assert.equal(taDivision(d, "Jade"), null);

// Les phrases de l'annonce : la semaine, puis le dimanche ; qui n'est pas classé.
assert.equal(phraseAnnonce(base, d, "Fodé", "avant"), "Si on coupait ce soir, tu serais en D2, à 5 pts de la D1 et 2 pts devant la D3");
assert.equal(phraseAnnonce(base, d, "Fodé", "jour")?.startsWith("Pour l'instant, tu serais en D2"), true);
assert.equal(phraseAnnonce(base, d, "Jade", "avant"), "Tes points de dimanche te placent");
assert.equal(phraseAnnonce(base, d, "Jade", "jour"), "Tes points d'aujourd'hui te placent");
assert.equal(phraseAnnonce(base, d, "Personne", "avant"), "Sans match cette saison, tu commences en D3");
assert.equal(phraseAnnonce(base, d, "Sabri", "avant"), null);
assert.deepEqual(notificationAnnonce(base, d, "Eli", "avant"), {
  titre: "J3 · Dernier dimanche sans divisions",
  texte: "Après la J3, la ligue se coupe en trois. Si on coupait ce soir, tu serais en D2, à 3 pts de la D1 et 4 pts devant la D3.",
});
assert.equal(notificationAnnonce(base, d, "Sabri", "jour").texte, "Ce soir, la ligue se coupe en trois. Dès la J4, chacun joue dans sa division.");

// La plage de points d'une journée : 9 ou plus monte, 3 ou moins descend, d'une division à la fois.
assert.equal(apresLaJournee(2, 9), 1);
assert.equal(apresLaJournee(2, 8), 2);
assert.equal(apresLaJournee(2, 4), 2);
assert.equal(apresLaJournee(2, 3), 3);
assert.equal(apresLaJournee(1, 15), 1);
assert.equal(apresLaJournee(3, -2), 3);
assert.equal(apresLaJournee(3, 12), 2);

// L'annonce : jusqu'au bout du dimanche de la J3 (Paris), seulement en saison 1.
const t = (iso: string) => new Date(iso);
assert.equal(annonceEnCours(base, t("2026-10-23T10:00:00Z")), true);
assert.equal(editionAnnonce(base, t("2026-10-24T20:00:00Z")), "avant");
assert.equal(editionAnnonce(base, t("2026-10-25T09:00:00Z")), "jour");
assert.equal(annonceEnCours(base, t("2026-10-25T22:59:00Z")), true, "23 h 59 le dimanche, heure d'hiver");
assert.equal(annonceEnCours(base, t("2026-10-25T23:00:00Z")), false, "minuit passé à Paris");
assert.equal(annonceEnCours({ ...base, numero: 0 }, t("2026-10-23T10:00:00Z")), false);

// La notification : la veille dès 18 h (heure d'été), le dimanche de 9 h au coup d'envoi (heure d'hiver).
assert.equal(fenetreNotification(base, t("2026-10-23T18:00:00Z")), false, "vendredi");
assert.equal(fenetreNotification(base, t("2026-10-24T15:59:00Z")), false, "samedi 17 h 59");
assert.equal(fenetreNotification(base, t("2026-10-24T16:00:00Z")), true, "samedi 18 h");
assert.equal(fenetreNotification(base, t("2026-10-24T21:59:00Z")), true, "samedi 23 h 59");
assert.equal(fenetreNotification(base, t("2026-10-25T07:59:00Z")), false, "dimanche 8 h 59");
assert.equal(fenetreNotification(base, t("2026-10-25T08:00:00Z")), true, "dimanche 9 h");
assert.equal(fenetreNotification(base, t("2026-10-25T11:59:00Z")), true, "dimanche 12 h 59");
assert.equal(fenetreNotification(base, t("2026-10-25T12:00:00Z")), false, "coup d'envoi");
assert.equal(fenetreNotification(base, t("2026-10-25T10:00:00Z"), "11h00"), false, "coup d'envoi de la convocation");

// La J3 jouée : la ligue coupée sur les trois journées, puis la J4 fait bouger.
const j3 = (n: string, i: number) => pts(3, n, [4, 1, 3, 9, 9, 2, 4, 1, 12][i]);
const apresJ3: Saison = { ...base, entries: [...base.entries.filter((e) => e.j !== 3), ...NOMS.map(j3), pts(3, "Jade", 2)] };
assert.equal(annonceEnCours(apresJ3, t("2026-10-26T08:00:00Z")), false);
assert.equal(decoupageAnnonce(apresJ3, t("2026-10-26T08:00:00Z")), true);
const e3 = etatDivisions(apresJ3)!;
assert.equal(e3.phase, "divisions");
// 24, 19, 18, 24, 21, 12, 12, 6, 15 et Jade 2 : dix classés, tiers de 4.
assert.deepEqual(e3.decoupage.divisions[1].map((p) => p.nom), ["Ana", "Dina", "Eli", "Bilal"]);
assert.deepEqual(e3.decoupage.divisions[2].map((p) => p.nom), ["Chris", "Inès", "Fodé", "Gaby"]);
assert.deepEqual(e3.decoupage.divisions[3].map((p) => p.nom), ["Hugo", "Jade"]);

const apresJ4: Saison = {
  ...apresJ3,
  journees: [...apresJ3.journees, { j: 4, date: "1 nov.", sflTime: true, mvpAuto: true }],
  entries: [
    ...apresJ3.entries,
    pts(4, "Chris", 9), // D2 → D1
    pts(4, "Fodé", 5), // reste en D2
    pts(4, "Ana", 3), // D1 → D2
    absent(4, "Gaby", "Absent justifié"), // garde la D2
    absent(4, "Hugo", "Absence injustifiée"), // déjà en D3 : y reste
    pts(4, "Jade", 10), // D3 → D2
    absent(4, "Bilal", "Absence injustifiée"), // D1 → D2
  ],
};
assert.equal(decoupageAnnonce(apresJ4, t("2026-11-02T08:00:00Z")), false);
const e4 = etatDivisions(apresJ4)!;
assert.equal(e4.journees.length, 1);
const vers = Object.fromEntries(e4.journees[0].mouvements.map((m) => [m.nom, `${m.de}→${m.vers}`]));
assert.deepEqual(vers, { Ana: "1→2", Bilal: "1→2", Chris: "2→1", Fodé: "2→2", Hugo: "3→3", Jade: "3→2" });
assert.equal(e4.actuelle.get("Gaby"), 2, "un absent excusé garde sa division");
assert.equal(e4.actuelle.get("Dina"), 1, "qui n'a pas joué garde sa division");
assert.equal(etatDivisions({ ...base, numero: 0 }), null);

console.log("divisions : découpage, plage, montées, annonce et notification, tout est bon");

// Une saison réelle : son découpage et la notification de chacun.
const fichier = process.argv[2];
if (fichier) {
  // Le document seul, ou la ligne de la table telle qu'exportée ({ data, version }).
  const brut = JSON.parse(readFileSync(fichier, "utf8")) as Saison | { data: Saison };
  const reelle = "data" in brut ? brut.data : brut;
  const dr = decouper(reelle);
  console.log(`\n${dr.classes} classés`);
  for (const x of DIVISIONS)
    console.log(`${nomDivision(x)} (${dr.divisions[x].length}) : ${dr.divisions[x].map((p) => `${p.nom} ${p.pp}`).join(", ")}`);
  const noms = [...new Set([...reelle.roster.map((r) => r.name)])];
  let plusLong = 0;
  for (const nom of noms) {
    const n = notificationAnnonce(reelle, dr, nom, "avant");
    assert.ok(n.titre.length <= 60 && n.texte.length <= 180, `${nom} : notification trop longue`);
    plusLong = Math.max(plusLong, n.texte.length);
  }
  const exemples = [dr.divisions[1][0], dr.divisions[2].at(-1), dr.divisions[3][0]].filter(Boolean).map((p) => p!.nom);
  for (const nom of [...exemples, noms.find((n) => !dr.parNom.has(n)) ?? ""].filter(Boolean)) {
    const n = notificationAnnonce(reelle, dr, nom, "avant");
    console.log(`\n${nom}\n  ${n.titre}\n  ${n.texte}`);
  }
  console.log(`\n${noms.length} joueurs, texte le plus long : ${plusLong} signes`);
}
