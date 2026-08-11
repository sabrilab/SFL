// Le rythme de la semaine SFL — heure de Paris, toujours.
//
// La convocation vit sur un cycle hebdomadaire fixe, décidé par l'admin :
//   · lundi           → la conversation s'ouvre (« dispo ce dimanche ? ») ;
//   · vendredi minuit → elle expire ; sans réponse = non-participation ;
//   · vendredi 19h    → les équipes composées deviennent visibles ;
//   · dimanche        → on joue.
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
 * Du lundi 00h00 au vendredi 23h59 inclus ; le week-end, c'est clos.
 */
export function reponsesOuvertes(date: Date): boolean {
  return instantParis(date).jourIso <= 5;
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

/** « 23 août » — le format des convocations, en français, heure de Paris. */
export function labelDateFr(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
  }).format(date);
}
