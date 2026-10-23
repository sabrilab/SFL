// Le temps d'une invitation du mode Team (lib/sfl/equipes.ts) : elle vaut
// 72 h (doc 13 §1.4, I4 ; la base la retire ensuite, equipe_menage), et
// l'app dit jusqu'à quand, à l'heure de Paris. Sans « use client » : la
// route des notifications (/api/equipes/notifier) le partage avec l'app.

export const VALIDITE_INVITATION_H = 72;

/** Quand tombe une invitation envoyée à `depuis`. */
export function finInvitation(depuis: string | number | Date): Date {
  return new Date(new Date(depuis).getTime() + VALIDITE_INVITATION_H * 3600_000);
}

const jourParis = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
const heureParis = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d);

/** « 23:40 » (aujourd'hui), « demain 01:15 », sinon « samedi 01:15 » : heure de Paris. */
export function quandTombe(d: Date, maintenant = new Date()): string {
  const [a, m, j] = jourParis(d).split("-").map(Number);
  const [a0, m0, j0] = jourParis(maintenant).split("-").map(Number);
  const ecart = Math.round((Date.UTC(a, m - 1, j) - Date.UTC(a0, m0 - 1, j0)) / 86_400_000);
  const heure = heureParis(d);
  if (ecart <= 0) return heure;
  if (ecart === 1) return `demain ${heure}`;
  const jour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long" }).format(d);
  return `${jour} ${heure}`;
}

/** Ce qu'il reste, en court : « 71 h », « 40 min ». */
export function resteAvant(d: Date, maintenant = Date.now()): string {
  const ms = Math.max(0, d.getTime() - maintenant);
  if (ms >= 3600_000) return `${Math.floor(ms / 3600_000)} h`;
  return `${Math.max(1, Math.ceil(ms / 60_000))} min`;
}
