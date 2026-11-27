// Bola Club : proposer une séance. L'entraîneur choisit un objectif (VMA,
// technique, renforcement…) et une durée ; la proposition bâtit un programme
// dans l'ordre d'une vraie séance, pour l'âge de la catégorie et le nombre de
// convoqués, et dit pourquoi elle a choisi ainsi. Elle ne décide rien :
// l'entraîneur la prend, la modifie ou en demande une autre.
//
// Les règles (doc « Espace entraîneur Bola Club », 27/11/2026) :
//   · l'âge : un exercice n'entre que si l'âge type de la catégorie est dans
//     ses âges conseillés (U13 : 12 ans ; une catégorie sans âge : adulte) ;
//     la VMA ne se travaille par intermittent qu'à partir de 12 ans, avant
//     elle passe par le jeu ; les charges, à partir de 16 ;
//   · le groupe : un exercice qui demande plus de joueurs que de convoqués
//     n'entre pas (trop de joueurs : on fait des groupes) ;
//   · l'échauffement de prévention ouvre chaque séance à partir de 7 ans ;
//   · des joueurs en poussée de croissance, ou un groupe qui a trouvé la
//     dernière séance dure (ressenti 8 sur 10 et plus) : pas d'exercice qui
//     tape (sauts, sprints à fond, frappes puissantes) ;
//   · la variété : ce que la catégorie a fait à ses trois derniers
//     entraînements passe après le reste.
// Sans hasard : la même demande donne la même séance ; `essai` en tire une autre. Pur.

import { agesDe, exercicesDuClub, qualitesDe, QUALITES } from "./exercices";
import type { Categorie, Club, Exercice, LigneProgramme, Qualite, Seance } from "./types";

export const DUREES = [60, 75, 90] as const;

const TESTS = new Set(["b-test-vma"]);

export interface Demande {
  objectif: Qualite;
  minutes: (typeof DUREES)[number];
  /** Le nombre de joueurs attendus. */
  joueurs: number;
  /** Joueurs en poussée de croissance dans le groupe. */
  enCroissance?: number;
  /** Le ressenti moyen de la dernière séance (1 à 10), s'il est connu. */
  dernierRessenti?: number | null;
  /** 0 : la proposition ; 1, 2… : une autre. */
  essai?: number;
}

export interface Proposition {
  lignes: LigneProgramme[];
  /** Pourquoi, en phrases courtes. */
  raisons: string[];
}

/** L'âge type d'une catégorie : U13 → 12 ans ; sans limite d'âge → adulte (18). */
export const ageType = (c: Pick<Categorie, "ageMax"> | null) => (c?.ageMax ? c.ageMax - 1 : 18);

/** Les objectifs qu'on propose à cet âge (la VMA par intermittent à partir de 12 ans). */
export function objectifsPour(age: number): Qualite[] {
  const tous: Qualite[] = ["technique", "tactique", "finition", "motricite", "vitesse", "vma", "endurance", "renforcement"];
  return tous.filter((q) => (q === "vma" ? age >= 12 : q === "renforcement" ? age >= 11 : q === "motricite" ? age <= 14 : true));
}

export const qualiteDite = (q: Qualite) => QUALITES.find((x) => x.id === q)?.label ?? q;

/** Un petit hachage stable : la même demande tire les mêmes exercices. */
function hache(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return h >>> 0;
}

const arrondi5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);

/** Les exercices des trois derniers entraînements de la catégorie avant ce jour. */
export function exercicesRecents(club: Club, categorie: string, avant: string): Set<string> {
  const derniers = club.seances
    .filter((s) => s.categorie === categorie && s.genre === "entrainement" && s.jour < avant && s.programme?.length)
    .sort((a, b) => b.jour.localeCompare(a.jour))
    .slice(0, 3);
  return new Set(derniers.flatMap((s) => s.programme!.map((l) => l.exercice)));
}

interface Case {
  /** La part de la séance. */
  part: number;
  ok: (e: Exercice) => boolean;
  /** Le mieux placé d'abord. */
  rang?: (e: Exercice) => number;
}

export function proposer(club: Club, seance: Pick<Seance, "id" | "categorie" | "jour">, d: Demande): Proposition {
  const cat = club.categories.find((c) => c.id === seance.categorie) ?? null;
  const age = ageType(cat);
  const raisons: string[] = [];
  raisons.push(age >= 18 ? `${cat?.nom ?? "Adultes"} : exercices pour adultes` : `${cat?.nom} : exercices conseillés à ${age} ans`);
  raisons.push(`${d.joueurs} ${d.joueurs > 1 ? "joueurs attendus" : "joueur attendu"}`);
  const doux = (d.enCroissance ?? 0) > 0 || (d.dernierRessenti ?? 0) >= 8;
  if ((d.enCroissance ?? 0) > 0)
    raisons.push(`${d.enCroissance} en poussée de croissance : pas de sauts ni de sprints à fond`);
  else if ((d.dernierRessenti ?? 0) >= 8) raisons.push(`Dernière séance jugée dure (${d.dernierRessenti}/10) : pas d'exercice qui tape`);

  // L'objectif, ramené à ce que l'âge permet.
  let objectif = d.objectif;
  if (!objectifsPour(age).includes(objectif)) {
    objectif = objectif === "vma" ? "endurance" : objectif === "renforcement" ? "motricite" : "technique";
    raisons.push(`${qualiteDite(d.objectif)} pas avant ${d.objectif === "vma" ? 12 : 11} ans : ${qualiteDite(objectif).toLowerCase()} par le jeu à la place`);
  }

  const recents = exercicesRecents(club, seance.categorie, seance.jour);
  const graine = `${seance.id}|${d.objectif}|${d.minutes}|${d.essai ?? 0}`;
  const possible = (e: Exercice) => {
    const [a, b] = agesDe(e);
    // Un test se décide, il ne se propose pas ; les gardiens ont leur séance à part.
    return age >= a && age <= b && d.joueurs >= e.joueurs[0] && !(doux && e.impact) && e.theme !== "gardien" && !TESTS.has(e.id);
  };
  const tous = exercicesDuClub(club).filter(possible);
  const vise = (e: Exercice) => qualitesDe(e).includes(objectif);

  // Le plan d'une séance : échauffement, le cœur sur l'objectif, le jeu, un complément, le retour au calme.
  const cases: Case[] = [
    {
      part: 0.15,
      ok: (e) => e.theme === "echauffement" || (age < 10 && e.theme === "motricite"),
      // La prévention d'abord, dès 7 ans.
      rang: (e) => (age >= 7 && e.id === "b-echauffement-prevention" ? -1 : 0),
    },
    { part: 0.3, ok: (e) => vise(e) && e.theme !== "retour" && e.theme !== "echauffement" },
    { part: 0.3, ok: (e) => e.theme === "jeu", rang: (e) => (vise(e) ? -1 : 0) },
    {
      part: 0.15,
      ok: (e) =>
        age < 10 ? e.theme === "motricite" || e.theme === "technique" : objectif === "finition" ? e.theme === "technique" : e.theme === "finition",
    },
    { part: 0.1, ok: (e) => e.theme === "retour", rang: (e) => (vise(e) ? -1 : 0) },
  ];

  const pris = new Set<string>();
  const lignes: LigneProgramme[] = [];
  let ligneDuJeu: LigneProgramme | null = null;
  cases.forEach((c, k) => {
    // Une case se remplit d'un ou deux exercices, chacun près de sa durée conseillée (de 0,7 à 1,4 fois).
    let reste = d.minutes * c.part;
    let premier: Exercice | null = null;
    for (let n = 0; n < 2 && reste >= 5; n++) {
      // Le second d'une case change de thème (pas deux intermittents de suite) ; le jeu peut enchaîner deux jeux.
      const choix = tous
        .filter((e) => c.ok(e) && !pris.has(e.id) && (!premier || k === 2 || e.theme !== premier.theme))
        .sort(
          (a, b) =>
            (c.rang?.(a) ?? 0) - (c.rang?.(b) ?? 0) ||
            Number(recents.has(a.id)) - Number(recents.has(b.id)) ||
            hache(graine + a.id) - hache(graine + b.id),
        )[0];
      if (!choix) break;
      const minutes = Math.min(arrondi5(choix.minutes * 1.4), Math.max(arrondi5(choix.minutes * 0.7), arrondi5(reste)));
      if (n > 0 && reste < choix.minutes * 0.7) break;
      pris.add(choix.id);
      premier ??= choix;
      const ligne = { exercice: choix.id, minutes };
      lignes.push(ligne);
      if (k === 2 && !ligneDuJeu) ligneDuJeu = ligne;
      reste -= minutes;
    }
  });
  // La durée tombe juste : l'écart va au jeu (sinon au dernier bloc de travail), dans ses bornes.
  const ecart = d.minutes - lignes.reduce((t, l) => t + l.minutes, 0);
  const cible: LigneProgramme | undefined = ligneDuJeu ?? lignes[lignes.length - 2] ?? lignes[0];
  if (cible) cible.minutes = Math.min(90, Math.max(5, cible.minutes + ecart));
  if (recents.size) raisons.push("Ce que la catégorie a fait ces trois dernières fois passe après");
  return { lignes, raisons };
}
