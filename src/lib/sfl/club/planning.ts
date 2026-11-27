// Bola Club : le planning d'un staff, semaine par semaine. Les séances (matchs
// et entraînements) des catégories qu'il gère (l'admin : tout le club), du
// lundi au dimanche, rangées par jour puis par heure ; le rail des catégories
// en garde une. Pur.

import { plusJours } from "./mutations";
import { droits } from "./regles";
import type { Club, Moi, Seance } from "./types";

const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS_COURTS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

const date = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};

/** Le lundi de la semaine d'un jour. */
export function lundiDe(iso: string): string {
  const j = date(iso).getUTCDay();
  return plusJours(iso, j === 0 ? -6 : 1 - j);
}

/** « mer. 18 ». */
export function jourCourt(iso: string): { nom: string; numero: number } {
  const d = date(iso);
  return { nom: JOURS_COURTS[d.getUTCDay()], numero: d.getUTCDate() };
}

/** « 16 – 22 nov. », « 30 nov. – 6 déc. ». */
export function semaineDite(lundi: string): string {
  const a = date(lundi);
  const b = date(plusJours(lundi, 6));
  const ma = MOIS_COURTS[a.getUTCMonth()];
  const mb = MOIS_COURTS[b.getUTCMonth()];
  return ma === mb
    ? `${a.getUTCDate()} – ${b.getUTCDate()} ${mb}`
    : `${a.getUTCDate()} ${ma} – ${b.getUTCDate()} ${mb}`;
}

const minutesDe = (heure: string) => {
  const [h, m] = heure.split("h").map(Number);
  return h * 60 + (m || 0);
};

export interface JourDuPlanning {
  jour: string;
  seances: Seance[];
}

/** Les sept jours d'une semaine, et les séances qu'on y gère (sous une catégorie, ou toutes). */
export function semaineDuPlanning(
  club: Club,
  moi: Moi,
  lundi: string,
  categorie: string | null,
): JourDuPlanning[] {
  const d = droits(club, moi);
  const jours = Array.from({ length: 7 }, (_, k) => plusJours(lundi, k));
  return jours.map((jour) => ({
    jour,
    seances: club.seances
      .filter(
        (s) =>
          s.jour === jour &&
          d.gere(s.categorie) &&
          (categorie === null || s.categorie === categorie),
      )
      .sort(
        (a, b) =>
          minutesDe(a.heure) - minutesDe(b.heure) ||
          a.categorie.localeCompare(b.categorie),
      ),
  }));
}

/** Les entraînements dont on peut reprendre le programme : les siens, avec un programme, le plus récent d'abord. */
export function programmesAReprendre(
  club: Club,
  moi: Moi,
  sauf: string,
): Seance[] {
  const d = droits(club, moi);
  const vus = new Set<string>();
  return club.seances
    .filter(
      (s) =>
        s.id !== sauf &&
        s.genre === "entrainement" &&
        s.programme?.length &&
        d.gere(s.categorie),
    )
    .sort((a, b) => b.jour.localeCompare(a.jour))
    .filter((s) => {
      // Un même programme (les mêmes exercices) ne se propose qu'une fois.
      const cle = s.programme!.map((l) => l.exercice).join(",");
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
}
