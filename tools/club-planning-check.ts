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
  agesDe,
  BIBLIOTHEQUE,
  exerciceDe,
  PROGRAMMES_DEMO,
  THEMES,
} from "../src/lib/sfl/club/exercices";
import {
  ajouterAuProgramme,
  ajouterMateriel,
  ajouterMesure,
  appliquerGroupe,
  avancerReprise,
  declarerBlessure,
  feuVertMedecin,
  bilanSeance,
  compterMateriel,
  creerExercice,
  enregistrerGroupe,
  poserProgramme,
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
import { PLANS, planDe } from "../src/lib/sfl/club/plans";
import { clarte, variablesDuClub } from "../src/lib/sfl/club/couleurs";
import { CHAMPS_DOSSIER_EQUIPE, dossierEquipe, ouvertureDe, semaineDe } from "../src/lib/sfl/club/agent-club";
import { dossierBorne } from "../src/lib/sfl/agent-contexte";
import {
  ageType,
  DUREES,
  objectifsPour,
  proposer,
} from "../src/lib/sfl/club/proposition";
import {
  blessureEnCours,
  croissance,
  derniereTaille,
  ecarte,
  ETAPE_CONTACT,
  dernierRessenti,
  enCroissanceParmi,
  enPoussee,
  imc,
} from "../src/lib/sfl/club/suivi";
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
eq(BIBLIOTHEQUE.length, 47);
eq(new Set(BIBLIOTHEQUE.map((e) => e.id)).size, 47, "ids uniques");
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

// 7 · les séances proposées
{
  const u13s = club.seances.find((s) => s.id === "u13-e11")!;
  const u17s = club.seances.find((s) => s.id === "u17-e11")!;
  const sen = club.seances.find((s) => s.id === "seniors-e11")!;
  const pour = (s: typeof u13s, d: Parameters<typeof proposer>[2]) =>
    proposer(club, s, d);
  for (const [s, obj] of [
    [u13s, "technique"],
    [u17s, "vma"],
    [sen, "renforcement"],
    [sen, "tactique"],
  ] as const) {
    for (const minutes of DUREES) {
      for (let essai = 0; essai < 4; essai++) {
        const p = pour(s, { objectif: obj, minutes, joueurs: 14, essai });
        const age = ageType(club.categories.find((c) => c.id === s.categorie)!);
        eq(
          p.lignes.reduce((t, l) => t + l.minutes, 0),
          minutes,
          `${s.id} ${obj} ${minutes} durée`,
        );
        eq(
          new Set(p.lignes.map((l) => l.exercice)).size,
          p.lignes.length,
          "pas deux fois le même",
        );
        for (const l of p.lignes) {
          const e = exerciceDe(club, l.exercice)!;
          const [a, b] = agesDe(e);
          eq(age >= a && age <= b, true, `${e.id} à ${age} ans`);
          eq(
            l.minutes >= 5 && l.minutes <= 90 && l.minutes % 5 === 0,
            true,
            `${e.id} minutes`,
          );
          eq(e.id === "b-test-vma", false, "un test ne se propose pas");
        }
        eq(
          exerciceDe(club, p.lignes[0].exercice)!.theme === "echauffement",
          true,
          "on commence par s'échauffer",
        );
        eq(
          exerciceDe(club, p.lignes.at(-1)!.exercice)!.theme,
          "retour",
          "on finit au calme",
        );
      }
    }
  }
  eq(
    pour(u13s, { objectif: "technique", minutes: 90, joueurs: 14 }).lignes[0]
      .exercice,
    "b-echauffement-prevention",
  );
  // Même demande, même séance ; un autre essai change quelque chose.
  eq(
    pour(u17s, { objectif: "vma", minutes: 90, joueurs: 14 }),
    pour(u17s, { objectif: "vma", minutes: 90, joueurs: 14 }),
  );
  // La VMA pas avant 12 ans : une catégorie U11 la remplace par l'endurance.
  const u11 = {
    ...club,
    categories: [
      ...club.categories,
      { id: "u11", nom: "U11", ordre: 9, entraineurs: ["s-e1"], ageMax: 11 },
    ],
  };
  const p11 = proposer(
    u11,
    { id: "x", categorie: "u11", jour: "2026-11-18" },
    { objectif: "vma", minutes: 75, joueurs: 12 },
  );
  eq(
    p11.raisons.some((r) => r.includes("pas avant 12 ans")),
    true,
  );
  eq(objectifsPour(10).includes("vma"), false);
  eq(objectifsPour(16).includes("vma"), true);
  for (const l of p11.lignes)
    eq(
      agesDe(exerciceDe(club, l.exercice)!)[0] <= 10,
      true,
      `${l.exercice} pour un U11`,
    );
  // Poussée de croissance ou séance dure : rien qui tape.
  for (const d of [{ enCroissance: 2 }, { dernierRessenti: 8 }]) {
    for (const obj of ["vma", "finition", "vitesse", "renforcement"] as const) {
      const p = pour(u17s, { objectif: obj, minutes: 90, joueurs: 14, ...d });
      eq(
        p.lignes.some((l) => exerciceDe(club, l.exercice)!.impact),
        false,
        `${obj} doux`,
      );
      eq(p.raisons.length >= 3, true);
    }
  }
  // Pas d'exercice qui demande plus de joueurs que d'attendus.
  for (const l of pour(sen, { objectif: "tactique", minutes: 90, joueurs: 6 })
    .lignes)
    eq(exerciceDe(club, l.exercice)!.joueurs[0] <= 6, true);
  // La musculation à charges : 16 ans et plus seulement.
  eq(agesDe(exerciceDe(club, "b-musculation-encadree")!)[0], 16);
  // Poser une proposition.
  const p = pour(u17s, { objectif: "vma", minutes: 75, joueurs: 14 });
  const posee = ok(poserProgramme(club, coach, u17s.id, p.lignes));
  eq(posee.seances.find((s) => s.id === u17s.id)!.programme, p.lignes);
  non(poserProgramme(club, coach, sen.id, p.lignes));
  non(poserProgramme(club, coach, u17s.id, []));
  non(
    poserProgramme(club, coach, u17s.id, [
      { exercice: "b-rondo-4c1", minutes: 3 },
    ]),
  );
}

// 8 · le suivi physique et le bilan
{
  const c0 = club;
  eq(enPoussee(c0, "u13-04"), true);
  eq(enPoussee(c0, "u17-12"), true);
  eq(enPoussee(c0, "u13-01"), false);
  const g = croissance(c0, "u13-04")!;
  eq(g.cmParMois > 0.6 && g.cmParMois < 1.2, true, String(g.cmParMois));
  eq(enCroissanceParmi(c0, ["u13-04", "u13-11", "u13-01"]), 2);
  eq(imc(c0, "u13-04"), null, "pas d'IMC chez un jeune");
  const adulte = c0.membres.find((m) => m.categorie === "seniors")!;
  eq(typeof imc(c0, adulte.id), "number");
  eq(dernierRessenti(c0, "u17", "2026-11-18"), 8);
  eq(dernierRessenti(c0, "u13", "2026-11-18"), 5);
  let c1 = ok(ajouterMesure(c0, coach, "u13-01", { tailleCm: 160 }));
  eq(derniereTaille(c1, "u13-01")!.tailleCm, 160);
  non(ajouterMesure(c0, coach, adulte.id, { tailleCm: 180 }));
  non(ajouterMesure(c0, joueur, "u13-01", { tailleCm: 160 }));
  non(ajouterMesure(c0, coach, "u13-01", { tailleCm: 300 }));
  non(ajouterMesure(c0, coach, "u13-01", {}));
  // Le poids : adultes seulement, même avec l'accord d'un parent.
  non(ajouterMesure(c0, coach, "u13-01", { poidsKg: 40 }));
  non(ajouterMesure(c0, coach, "u17-01", { poidsKg: 60 }));
  ok(ajouterMesure(c0, admin, adulte.id, { poidsKg: 75, vma: 15.5 }));
  c1 = ok(bilanSeance(c0, coach, "u13-e10", 7, "  Bien. "));
  eq(c1.seances.find((s) => s.id === "u13-e10")!.bilan, {
    ressenti: 7,
    remarque: "Bien.",
    auteur: coach.id,
  });
  non(bilanSeance(c0, coach, "u13-e11", 7, ""));
  non(bilanSeance(c0, coach, "u13-m9", 7, ""));
  non(bilanSeance(c0, coach, "u13-e10", 11, ""));
  non(bilanSeance(c0, coach, "seniors-e10", 5, ""));
}

// 9 · le matériel et les modèles de convocation
{
  eq(club.materiel.length > 10, true);
  let c1 = ok(ajouterMateriel(club, coach, "Ballons lestés", 4));
  non(ajouterMateriel(c1, coach, "ballons  lestés", 4));
  non(ajouterMateriel(club, joueur, "Gourdes", 20));
  const id = club.materiel[0].id;
  c1 = ok(compterMateriel(club, coach, id, 10, 3));
  eq(c1.materiel[0].quantite - c1.materiel[0].aRemplacer, 7);
  non(compterMateriel(club, coach, id, 2, 3));
  const m9 = club.seances.find((s) => s.id === "u17-m9")!;
  const groupe = club.groupes.find((g) => g.categorie === "u17")!;
  c1 = ok(appliquerGroupe(club, coach, m9.id, groupe.id));
  const s1 = c1.seances.find((s) => s.id === m9.id)!;
  eq([...s1.convoques].sort(), [...groupe.joueurs].sort());
  eq(
    Object.keys(s1.reponses).every((k) => s1.convoques.includes(k)),
    true,
    "les réponses suivent",
  );
  non(
    appliquerGroupe(
      club,
      coach,
      club.seances.find((s) => s.id === "u13-m9")!.id,
      groupe.id,
    ),
  );
  non(
    appliquerGroupe(
      club,
      coach,
      club.seances.find((s) => s.id === "u17-m1")!.id,
      groupe.id,
    ),
  );
  const c2 = ok(enregistrerGroupe(club, coach, "u13-m9", "Groupe A"));
  eq(
    c2.groupes.at(-1)!.joueurs,
    club.seances.find((s) => s.id === "u13-m9")!.convoques,
  );
  eq(
    ok(enregistrerGroupe(c2, coach, "u13-m9", "groupe a")).groupes.length,
    c2.groupes.length,
    "même nom : remplacé",
  );
  non(enregistrerGroupe(club, coach, "seniors-m9", "Groupe B"));
}

// 10 · les blessures et leur reprise
{
  eq(club.blessures.filter((b) => !b.retour).length, 4);
  eq(club.blessures.every((b) => b.jour <= club.jour && b.etapeLe <= club.jour && b.jour <= b.etapeLe), true, "les blessures de la démo sont passées");
  eq(formeDuClub(JSON.parse(JSON.stringify(club))) !== null, true, "la démo se relit avec ses blessures");
  const libre = club.membres.find((m) => m.categorie === "u17" && !blessureEnCours(club, m.id))!;
  let c1 = ok(declarerBlessure(club, coach, libre.id, { zone: "chevilles", cote: "droit", gravite: "legere", note: "" }));
  eq(blessureEnCours(c1, libre.id)?.etape, 0);
  eq(ecarte(c1, libre.id), true);
  non(declarerBlessure(c1, coach, libre.id, { zone: "genoux", cote: "droit", gravite: "legere", note: "" }));
  non(declarerBlessure(club, joueur, libre.id, { zone: "chevilles", cote: "droit", gravite: "legere", note: "" }));
  non(declarerBlessure(club, coach, libre.id, { zone: "nez" as never, cote: "droit", gravite: "legere", note: "" }));
  const senior = club.membres.find((m) => m.categorie === "seniors")!;
  non(declarerBlessure(club, coach, senior.id, { zone: "chevilles", cote: "droit", gravite: "legere", note: "" }));
  const id = blessureEnCours(c1, libre.id)!.id;
  for (let k = 0; k < 5; k++) c1 = ok(avancerReprise(c1, coach, id));
  eq(blessureEnCours(c1, libre.id)?.etape, 5);
  c1 = ok(avancerReprise(c1, coach, id));
  eq(blessureEnCours(c1, libre.id), null, "retour complet");
  non(avancerReprise(c1, coach, id));
  // Sérieuse : pas de contact sans le feu vert.
  let c2 = ok(declarerBlessure(club, coach, libre.id, { zone: "genoux", cote: "gauche", gravite: "serieuse", note: "" }));
  const id2 = blessureEnCours(c2, libre.id)!.id;
  for (let k = 0; k < ETAPE_CONTACT - 1; k++) c2 = ok(avancerReprise(c2, coach, id2));
  non(avancerReprise(c2, coach, id2));
  c2 = ok(feuVertMedecin(c2, coach, id2));
  c2 = ok(avancerReprise(c2, coach, id2));
  eq(blessureEnCours(c2, libre.id)?.etape, ETAPE_CONTACT);
}

// 11 · l'agent de l'entraîneur : le dossier de l'équipe, sa semaine
{
  for (const cat of ["u13", "u17", "seniors"]) {
    const d = dossierEquipe(club, "s-e1", cat);
    const json = JSON.stringify(d);
    eq(d.joueurs.length > 0 && d.joueurs.length <= 20, true, `${cat} : vingt joueurs au plus`);
    eq(/poids|imc|naissance|Kg/i.test(json), false, "ni poids, ni IMC, ni date de naissance");
    eq(d.joueurs.every((j) => /^\S.* [A-ZÉ]\.$/.test(j.nom)), true, "prénom et initiale");
    eq(dossierBorne(d, 12_000, CHAMPS_DOSSIER_EQUIPE), JSON.stringify(d).replace(/</g, "\\u003c"), "le dossier tient sans coupe");
    eq(json.length < 12_000, true);
  }
  const u17 = dossierEquipe(club, "s-e1", "u17", "u17-03");
  eq(u17.focus?.startsWith(club.membres.find((m) => m.id === "u17-03")!.prenom), true);
  eq(u17.joueurs.some((j) => j.blessure?.zone === "chevilles"), true);
  eq(dossierEquipe(club, "s-e1", "u17", "seniors-05").focus, undefined, "un joueur d'une autre catégorie n'est pas le sujet");
  const semaine = semaineDe(club, "s-e1");
  eq(semaine.length >= 2 && semaine.length <= 4, true);
  eq(semaine.some((x) => /défaite|perdu|absent|retard/i.test(x.dit)), false, "rien de négatif");
  eq(ouvertureDe(club, "s-e1").includes("?"), true, "l'agent ouvre par une question");
  eq(ouvertureDe(club, "s-e1", "u17-03").includes("étape"), true);
}

// 12 · le terrain de chaque exercice, les couleurs du club
{
  for (const e of BIBLIOTHEQUE) {
    const p = PLANS[e.id];
    eq(!!p, true, `${e.id} : un terrain`);
    const pts = [...(p.plots ?? []), ...(p.joueurs ?? []).map((j) => j.p), ...(p.ballons ?? []), ...(p.fleches ?? []).flatMap((f) => [f.de, f.a])];
    eq(
      pts.every(([x, y]) => x >= -2 && x <= p.l + 2 && y >= -2 && y <= p.h + 2),
      true,
      `${e.id} : tout tient dans le dessin`,
    );
    eq(p.dit.length > 0, true);
  }
  eq(planDe({ id: "c-1", theme: "jeu", espace: "Notre terrain" }).dit, "Notre terrain", "un exercice du club prend le plan de son thème");
  const v = variablesDuClub(club.blason.couleurs);
  eq(clarte(v["--club-accent"]) >= 0.4, true, "l'accent du club se lit sur le noir");
  eq(clarte(v["--terrain-pelouse"]) < 0.3, true, "le terrain reste sombre sous la craie");
}

console.log(`club-planning: ok (${n} vérifications)`);
