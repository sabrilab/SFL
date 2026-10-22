/** « 2026-10-23 » → « jeudi 23 octobre » : les notifications et l'invitation d'un match. */
export function jourLong(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, d))
  );
}

/** Pour une ligne courte : « Aujourd'hui », « Demain », sinon « ven. 23 oct. ». */
export function jourCourt(iso: string, aujourdhui: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(a, m - 1, d));
  const [a0, m0, d0] = aujourdhui.split("-").map(Number);
  const ecart = Math.round((date.getTime() - Date.UTC(a0, m0 - 1, d0)) / 86_400_000);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return "Demain";
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}
