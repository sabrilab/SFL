// Le rythme de la semaine SFL — heure de Paris, toujours.
//
// La convocation vit sur un cycle hebdomadaire fixe, décidé par l'admin :
//   · lundi           → la conversation s'ouvre (« dispo ce dimanche ? ») ;
//   · vendredi minuit → elle expire ; sans réponse = non-participation ;
//   · vendredi 19h    → les équipes composées deviennent visibles ;
//   · dimanche        → on joue ;
//   · dimanche 18 h   → le vote ferme · 19 h : la révélation (points,
//     classement, divisions), dès la J5 de la saison 1 (revelation.ts).
//
// Ce module est PUR et isomorphe : pas de "use client", pas d'horloge à lui.
// Chaque fonction reçoit l'instant à évaluer — c'est l'appelant qui décide
// d'où vient l'heure (état React côté client, new Date() côté serveur).
// Toutes les lectures se font en Europe/Paris, quel que soit le fuseau de la
// machine : le serveur de Vercel vit en UTC, les joueurs vivent à Paris.

export interface InstantParis {
  /** Jour ISO : 1 = lundi … 7 = dimanche. */
  jourIso: number;
  heure: number;
  minute: number;
}

const JOURS: Record<string, number> = {
  "lun.": 1,
  "mar.": 2,
  "mer.": 3,
  "jeu.": 4,
  "ven.": 5,
  "sam.": 6,
  "dim.": 7,
};

/** Décompose un instant en (jour de semaine, heure, minute), heure de Paris. */
export function instantParis(date: Date): InstantParis {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    jourIso: JOURS[get("weekday")] ?? 1,
    heure: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/**
 * La conversation accepte-t-elle encore des réponses ?
 * Du dimanche 16h (après le match) au vendredi 23h59 ; le samedi et le
 * dimanche avant le match, c'est clos.
 */
export function reponsesOuvertes(date: Date): boolean {
  const { jourIso, heure } = instantParis(date);
  // Le dimanche, une fois le match joué (16h), la convocation du dimanche
  // suivant prend le relais : on peut déjà dire si on est chaud.
  return jourIso <= 5 || (jourIso === 7 && heure >= 16);
}

/**
 * Les équipes composées sont-elles visibles par les joueurs ?
 * À partir du vendredi 19h00, puis tout le week-end. L'admin, lui, les voit
 * toujours — cette fenêtre ne concerne que la révélation aux joueurs.
 */
export function equipesVisibles(date: Date): boolean {
  const { jourIso, heure } = instantParis(date);
  if (jourIso === 5) return heure >= 19;
  return jourIso === 6 || jourIso === 7;
}

/** Le prochain dimanche STRICTEMENT après l'instant donné (même heure). */
export function prochainDimanche(date: Date): Date {
  const d = new Date(date.getTime());
  do {
    d.setTime(d.getTime() + 24 * 3600 * 1000);
  } while (instantParis(d).jourIso !== 7);
  return d;
}

/** « 2026-08-23 » — clé stable d'un dimanche (heure de Paris), pour stocker. */
export function cleDimanche(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** « 23 août » — le format des convocations, en français, heure de Paris. */
export function labelDateFr(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
  }).format(date);
}

/* ------------------------------- Le vote ------------------------------- */

// On vote le jour du match, et seulement ce jour-là. L'heure de fermeture
// (18 h, une heure au moins après la dernière feuille, minuit au plus tard ;
// minuit jusqu'à la J4) et la révélation sont dans revelation.ts.

const MOIS_COURTS = ["jan", "fev", "mar", "avr", "mai", "juin", "juil", "aou", "sep", "oct", "nov", "dec"];

/** Jour et mois (1–12) d'un libellé de journée, « 11 oct. » ou « J3 · 11 octobre » ; null s'il n'en porte pas. */
export function jourMoisDuLibelle(libelle: string): { jour: number; mois: number } | null {
  const m = libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .match(/(\d{1,2})\s*([a-z]{3,})/);
  if (!m) return null;
  const mois = MOIS_COURTS.findIndex((p) => m[2].startsWith(p));
  return mois < 0 ? null : { jour: Number(m[1]), mois: mois + 1 };
}

/**
 * L'instant est-il le jour de la journée, à Paris ? (Le jour seul, l'année
 * n'est pas lue.) C'était `voteOuvert` jusqu'au 02/11/2026 : l'heure de
 * fermeture du vote se lit maintenant dans revelation.ts (voteOuvertA).
 */
export function estLeJour(libelleJournee: string, maintenant: Date): boolean {
  const jm = jourMoisDuLibelle(libelleJournee);
  if (!jm) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "numeric",
  }).formatToParts(maintenant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get("day") === jm.jour && get("month") === jm.mois;
}

/* ------------------------------ Les heures ------------------------------ */

/** De combien Paris est en avance sur l'heure universelle à cet instant, en ms. */
function avanceParis(utc: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(new Date(utc));
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute")) - Math.floor(utc / 60000) * 60000;
}

/** L'instant d'une heure de Paris (le jour peut déborder : 32 octobre = 1er novembre). */
export function dateDeParis(annee: number, mois: number, jour: number, heure = 0, minute = 0): Date {
  const naif = Date.UTC(annee, mois - 1, jour, heure, minute);
  let t = naif - avanceParis(naif);
  const corrige = naif - avanceParis(t);
  if (corrige !== t) t = corrige;
  return new Date(t);
}

/** L'année d'un « 25 oct. » : la plus proche de la date de référence. */
export function anneeProche(jour: number, mois: number, reference: Date): number {
  const a = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric" }).format(reference));
  return [a - 1, a, a + 1].reduce((best, y) =>
    Math.abs(dateDeParis(y, mois, jour, 12).getTime() - reference.getTime()) <
    Math.abs(dateDeParis(best, mois, jour, 12).getTime() - reference.getTime())
      ? y
      : best
  );
}

/** Une heure de Paris le jour d'une journée (« 1 nov. », 18 h) ; null si le libellé ne porte pas de date. */
export function heureDuJour(libelleJournee: string, reference: Date, heure: number, minute = 0): Date | null {
  const jm = jourMoisDuLibelle(libelleJournee);
  if (!jm) return null;
  return dateDeParis(anneeProche(jm.jour, jm.mois, reference), jm.mois, jm.jour, heure, minute);
}

/** Minuit le soir d'une journée (le lendemain à 0 h, Paris) ; null si le libellé ne porte pas de date. */
export function minuitDuSoir(libelleJournee: string, reference: Date): Date | null {
  return heureDuJour(libelleJournee, reference, 24);
}
