// Bola Club : la bibliothèque d'exercices, le programme d'une séance et le
// planning du staff (lib/sfl/club/exercices.ts, planning.ts, mutations.ts).
//   · 30 exercices de Bola, ids uniques, chaque thème servi, un déroulé ;
//     les programmes de la démo ne nomment que des exercices qui existent ;
//   · le programme : seul le staff de la catégorie l'écrit, pas sur un
//     match, pas sur une séance passée ; ajouter, ranger, minutes (5 à 90),
//     retirer, reprendre ; 12 au plus ;
//   · planifier chaque semaine : n séances le même jour de la semaine, un
//     jour déjà pris est sauté, 1 à 20 semaines, une date passée refusée ;
//   · le planning : du lundi au dimanche, seulement ce qu'on gère, trié par heure ;
//   · un exercice du club : écrit par le staff, refusé à un joueur ;
//   · l'état gardé sans `exercices` est jeté (formeDuClub).
//   npx tsx tools/club-planning-check.ts
import assert from "node:assert/strict";
import { clubDemo } from "../src/lib/sfl/club/demo";
import {
  BIBLIOTHEQUE,
  exerciceDe,
  PROGRAMMES_DEMO,
  THEMES,
} from "../src/lib/sfl/club/exercices";
import {
  ajouterAuProgramme,
  creerExercice,
  minutesDansProgramme,
  planifierEntrainements,
  plusJours,
  rangerDansProgramme,
  reprendreProgramme,
  retirerDuProgramme,
  type Resultat,
} from "../src/lib/sfl/club/mutations";
import {
  jourCourt,
  lundiDe,
  semaineDite,
  semaineDuPlanning,
} from "../src/lib/sfl/club/planning";
import { formeDuClub } from "../src/lib/sfl/club/store";
import type { Club, Moi } from "../src/lib/sfl/club/types";

let n = 0;
const ok = (r: Resultat): Club => {
  n++;
  assert.ok(r.ok, r.ok ? "" : r.refus);
  return r.club;
};
const non = (r: Resultat) => {
  n++;
  assert.equal(r.ok, false);
};
const eq = <T>(a: T, b: T, m?: string) => {
  n++;
  assert.deepEqual(a, b, m);
};

const club = clubDemo();
const admin: Moi = { role: "admin", id: club.demo.admin };
const coach: Moi = { role: "entraineur", id: club.demo.entraineur };
const joueur: Moi = { role: "joueur", id: club.demo.joueur };

// 1 · la bibliothèque
eq(BIBLIOTHEQUE.length, 30);
eq(new Set(BIBLIOTHEQUE.map((e) => e.id)).size, 30, "ids uniques");
for (const t of THEMES)
  eq(
    BIBLIOTHEQUE.some((e) => e.theme === t.id),
    true,
    t.id,
  );
for (const e of BIBLIOTHEQUE) {
  eq(
    e.deroule.length > 0 && e.joueurs[0] <= e.joueurs[1] && e.minutes >= 5,
    true,
    e.id,
  );
}
for (const p of PROGRAMMES_DEMO)
  for (const [id] of p) eq(!!exerciceDe(club, id), true, id);
for (const s of club.seances)
  for (const l of s.programme ?? [])
    eq(!!exerciceDe(club, l.exercice), true, `${s.id} ${l.exercice}`);

// 2 · le programme
const u13 = club.seances.find((s) => s.id === "u13-e11")!; // à venir, coach des U13
const u17 = club.seances.find((s) => s.id === "u17-e11")!;
const seniors = club.seances.find((s) => s.id === "seniors-e11")!; // pas au coach
const passe = club.seances.find((s) => s.id === "u13-e1")!;
const match = club.seances.find((s) => s.id === "u13-m9")!;
eq(u13.programme?.length, 5);
eq(u17.programme, undefined);
let c = ok(ajouterAuProgramme(club, coach, u17.id, "b-rondo-4c1"));
c = ok(ajouterAuProgramme(c, coach, u17.id, "b-match-theme"));
const lu17 = () => c.seances.find((s) => s.id === u17.id)!.programme!;
eq(lu17(), [
  { exercice: "b-rondo-4c1", minutes: 10 },
  { exercice: "b-match-theme", minutes: 20 },
]);
c = ok(rangerDansProgramme(c, coach, u17.id, 1, -1));
eq(lu17()[0].exercice, "b-match-theme");
non(rangerDansProgramme(c, coach, u17.id, 0, -1));
c = ok(minutesDansProgramme(c, coach, u17.id, 0, 25));
eq(lu17()[0].minutes, 25);
non(minutesDansProgramme(c, coach, u17.id, 0, 0));
non(minutesDansProgramme(c, coach, u17.id, 0, 95));
c = ok(retirerDuProgramme(c, coach, u17.id, 0));
eq(lu17().length, 1);
non(ajouterAuProgramme(club, coach, seniors.id, "b-rondo-4c1"));
ok(ajouterAuProgramme(club, admin, seniors.id, "b-rondo-4c1"));
non(ajouterAuProgramme(club, joueur, u17.id, "b-rondo-4c1"));
non(ajouterAuProgramme(club, coach, passe.id, "b-rondo-4c1"));
non(ajouterAuProgramme(club, coach, match.id, "b-rondo-4c1"));
non(ajouterAuProgramme(club, coach, u17.id, "inconnu"));
c = ok(reprendreProgramme(club, coach, u17.id, u13.id));
eq(lu17(), u13.programme);
non(reprendreProgramme(club, coach, u17.id, seniors.id));
let plein = club;
for (let k = 0; k < 12; k++)
  plein = ok(ajouterAuProgramme(plein, coach, u17.id, "b-cercle"));
non(ajouterAuProgramme(plein, coach, u17.id, "b-cercle"));

// 3 · planifier
eq(plusJours("2026-11-28", 3), "2026-12-01");
const avant = club.seances.length;
c = ok(
  planifierEntrainements(
    club,
    coach,
    { categorie: "u17", jour: "2026-11-25", heure: "18h30", lieu: "Stade" },
    8,
  ),
);
eq(c.seances.length - avant, 8);
const jours = c.seances.slice(avant).map((s) => s.jour);
eq(jours[0], "2026-11-25");
eq(jours[7], "2027-01-13");
eq(
  new Set(jours.map((j) => jourCourt(j).nom)).size,
  1,
  "même jour de la semaine",
);
// Le 18 est déjà pris : sauté.
c = ok(
  planifierEntrainements(
    club,
    coach,
    { categorie: "u17", jour: "2026-11-18", heure: "18h30", lieu: "Stade" },
    3,
  ),
);
eq(c.seances.length - avant, 2);
non(
  planifierEntrainements(
    club,
    coach,
    { categorie: "u17", jour: "2026-11-18", heure: "18h30", lieu: "Stade" },
    1,
  ),
);
non(
  planifierEntrainements(
    club,
    coach,
    { categorie: "u17", jour: "2026-11-25", heure: "18h30", lieu: "Stade" },
    21,
  ),
);
non(
  planifierEntrainements(
    club,
    coach,
    { categorie: "u17", jour: "2026-11-01", heure: "18h30", lieu: "Stade" },
    2,
  ),
);
non(
  planifierEntrainements(
    club,
    coach,
    { categorie: "seniors", jour: "2026-11-25", heure: "18h30", lieu: "Stade" },
    2,
  ),
);

// 4 · le planning
eq(lundiDe("2026-11-12"), "2026-11-09");
eq(lundiDe("2026-11-15"), "2026-11-09");
eq(lundiDe("2026-11-16"), "2026-11-16");
eq(semaineDite("2026-11-30"), "30 nov. – 6 déc.");
const semaine = semaineDuPlanning(club, coach, "2026-11-16", null);
eq(semaine.length, 7);
eq(
  semaine
    .flatMap((j) => j.seances.map((s) => s.categorie))
    .every((x) => x === "u13" || x === "u17"),
  true,
);
eq(
  semaine[2].seances.map((s) => s.id),
  ["u13-e11", "u17-e11"],
);
eq(semaineDuPlanning(club, admin, "2026-11-16", null)[2].seances.length, 4);
eq(
  semaineDuPlanning(club, coach, "2026-11-16", "u17")[2].seances.map(
    (s) => s.id,
  ),
  ["u17-e11"],
);
eq(
  semaineDuPlanning(club, joueur, "2026-11-16", null).every(
    (j) => !j.seances.length,
  ),
  true,
);

// 5 · un exercice du club
const nouvel = {
  nom: "Toro à 6",
  theme: "echauffement" as const,
  minutes: 10,
  joueurs: [6, 12] as [number, number],
  espace: "10 × 10 m",
  materiel: "Plots",
  but: "Jouer vite.",
  deroule: "Un\nDeux",
};
c = ok(creerExercice(club, coach, nouvel));
eq(c.exercices[0].deroule, ["Un", "Deux"]);
eq(c.exercices[0].origine, "club");
ok(ajouterAuProgramme(c, coach, u17.id, c.exercices[0].id));
non(creerExercice(club, joueur, nouvel));
non(creerExercice(club, coach, { ...nouvel, deroule: " " }));
non(creerExercice(club, coach, { ...nouvel, nom: "x" }));

// 6 · l'état gardé
eq(formeDuClub(JSON.parse(JSON.stringify(club))), true);
const ancien = JSON.parse(JSON.stringify(club));
delete ancien.exercices;
eq(formeDuClub(ancien), false);

console.log(`club-planning: ok (${n} vérifications)`);
