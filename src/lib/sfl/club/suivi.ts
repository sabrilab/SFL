// Bola Club : le suivi physique des joueurs et le bilan des séances.
//   · Les mesures (club.mesures) : la taille, la VMA, et le poids d'un adulte
//     seulement (décision de Bola, 27/11/2026). Chez un jeune, on
//     suit la croissance, pas l'IMC : plus de 0,6 cm par mois entre deux
//     mesures (à quatre semaines au moins l'une de l'autre) signale une
//     poussée de croissance, et les séances proposées allègent sauts et
//     sprints (proposition.ts). L'IMC ne se calcule que pour un adulte, et ne
//     se montre qu'au staff.
//   · Le bilan d'un entraînement (seance.bilan) : le ressenti du groupe, de 1
//     à 10, et la remarque de l'entraîneur. Un ressenti de 8 et plus à la
//     dernière séance rend la suivante plus douce.
//   · Les blessures (club.blessures) : la zone, le côté, la gravité dite par
//     l'entraîneur, puis la reprise en six étapes (ETAPES_REPRISE), une à la
//     fois, sans douleur à l'étape d'avant. Une blessure sérieuse attend le
//     feu vert d'un médecin avant le retour au contact (étape 4). Ce sont des
//     repères d'entraîneur, jamais un avis médical.
// Repères : doc « Espace entraîneur Bola Club » du 27/11/2026. Pur.

import { ageLe, membreDe } from "./regles";
import type { Blessure, Club, Mesure } from "./types";

export const POUSSEE_CM_PAR_MOIS = 0.6;
export const RESSENTI_DUR = 8;
const JOURS_MIN = 28;

const jours = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

export const mesuresDe = (club: Pick<Club, "mesures">, membre: string): Mesure[] =>
  club.mesures.filter((m) => m.membre === membre).sort((a, b) => a.jour.localeCompare(b.jour));

/** La croissance récente, en cm par mois ; null sans deux tailles assez espacées. */
export function croissance(club: Pick<Club, "mesures">, membre: string): { cmParMois: number; taille: number; jour: string } | null {
  const tailles = mesuresDe(club, membre).filter((m) => m.tailleCm !== undefined);
  const derniere = tailles.at(-1);
  if (!derniere) return null;
  const avant = [...tailles].reverse().find((m) => jours(m.jour, derniere.jour) >= JOURS_MIN);
  if (!avant) return null;
  const mois = jours(avant.jour, derniere.jour) / 30.44;
  return { cmParMois: Math.round(((derniere.tailleCm! - avant.tailleCm!) / mois) * 10) / 10, taille: derniere.tailleCm!, jour: derniere.jour };
}

export const enPoussee = (club: Pick<Club, "mesures">, membre: string) => (croissance(club, membre)?.cmParMois ?? 0) > POUSSEE_CM_PAR_MOIS;

const derniere = <K extends keyof Mesure>(club: Pick<Club, "mesures">, membre: string, k: K) =>
  [...mesuresDe(club, membre)].reverse().find((m) => m[k] !== undefined) ?? null;

export const derniereTaille = (club: Pick<Club, "mesures">, membre: string) => derniere(club, membre, "tailleCm");
export const derniereVma = (club: Pick<Club, "mesures">, membre: string) => derniere(club, membre, "vma");
export const dernierPoids = (club: Pick<Club, "mesures">, membre: string) => derniere(club, membre, "poidsKg");

/** L'IMC d'un adulte (18 ans et plus), sur sa dernière taille et son dernier poids ; null sinon. */
export function imc(club: Club, membre: string): number | null {
  const m = membreDe(club, membre);
  if (!m || ageLe(m.naissance, club.jour) < 18) return null;
  const t = derniereTaille(club, membre)?.tailleCm;
  const p = dernierPoids(club, membre)?.poidsKg;
  if (!t || !p) return null;
  return Math.round((p / (t / 100) ** 2) * 10) / 10;
}

/** Combien de ces joueurs sont en poussée de croissance. */
export const enCroissanceParmi = (club: Pick<Club, "mesures">, ids: readonly string[]) => ids.filter((id) => enPoussee(club, id)).length;

/** Le ressenti du dernier entraînement passé de la catégorie, s'il a un bilan. */
export function dernierRessenti(club: Pick<Club, "seances">, categorie: string, avant: string): number | null {
  const s = club.seances
    .filter((x) => x.categorie === categorie && x.genre === "entrainement" && x.jour < avant)
    .sort((a, b) => b.jour.localeCompare(a.jour))[0];
  return s?.bilan?.ressenti ?? null;
}

/** « 1,2 » : un nombre à la française. */
export const virgule = (n: number) => String(n).replace(".", ",");

/* -------------------------------- Blessures ------------------------------- */

/** La reprise après une blessure, étape par étape : on ne passe à la suivante que sans douleur. */
export const ETAPES_REPRISE = [
  { nom: "Repos et soins", detail: "Soins, repos relatif ; marcher sans douleur au quotidien." },
  { nom: "Bouger sans douleur", detail: "Mobilité, vélo ou marche, renforcement doux autour de la zone." },
  { nom: "Course en ligne", detail: "Footing puis accélérations progressives, sans changement de direction." },
  { nom: "Ballon sans contact", detail: "Technique, changements de direction, frappes légères ; pas de duel." },
  { nom: "Entraînement complet", detail: "Toute la séance avec le groupe, duels compris." },
  { nom: "Match", detail: "Retour au match, temps de jeu progressif." },
] as const;

/** L'étape du retour au contact : une blessure sérieuse y attend le feu vert d'un médecin. */
export const ETAPE_CONTACT = 4;

export const GRAVITES: { id: Blessure["gravite"]; label: string; duree: string }[] = [
  { id: "legere", label: "Légère", duree: "quelques jours à une semaine" },
  { id: "moyenne", label: "Moyenne", duree: "deux à quatre semaines" },
  { id: "serieuse", label: "Sérieuse", duree: "selon le médecin" },
];

export const blessuresDe = (club: Pick<Club, "blessures">, membre: string): Blessure[] =>
  club.blessures.filter((b) => b.membre === membre).sort((a, b) => b.jour.localeCompare(a.jour));

/** La blessure en cours d'un joueur (la plus récente pas encore guérie), s'il en a une. */
export const blessureEnCours = (club: Pick<Club, "blessures">, membre: string): Blessure | null =>
  blessuresDe(club, membre).find((b) => !b.retour) ?? null;

/** Pas encore au contact : le joueur ne fait pas toute la séance. */
export const ecarte = (club: Pick<Club, "blessures">, membre: string) => (blessureEnCours(club, membre)?.etape ?? 99) < ETAPE_CONTACT;

/** Depuis combien de jours. */
export const joursDepuis = (jour: string, aujourdhui: string) => Math.max(0, Math.round(jours(jour, aujourdhui)));
