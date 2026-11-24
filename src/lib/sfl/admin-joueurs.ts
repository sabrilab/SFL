// L'onglet Joueurs de l'admin (24/11/2026) : ce qu'il dit de chaque joueur,
// en logique pure (ni React, ni navigateur ; tools/admin-refonte-check.ts).
//
// La famille d'un poste, comme la lit un admin d'un coup d'œil : GB, DEF,
// MIL, ATT. L'effectif et les
// fiches gardent leurs codes fins (G, DG, DC, DD, MDC, MC, AG, AT, AD,
// lib/sfl/inscription.ts ; « MC/AT » dans l'effectif d'origine) : un poste
// double prend sa première moitié, « — » n'a pas de famille.

export const FAMILLES_POSTE = ["GB", "DEF", "MIL", "ATT"] as const;
export type FamillePoste = (typeof FAMILLES_POSTE)[number];

export function famillePoste(poste: string | null | undefined): FamillePoste | null {
  const p = (poste ?? "").toUpperCase().split("/")[0].trim();
  if (p === "G" || p === "GB") return "GB";
  if (/^D/.test(p)) return "DEF";
  if (/^M/.test(p)) return "MIL";
  if (/^A/.test(p)) return "ATT";
  return null;
}

/** Le code posé dans l'effectif quand l'admin ne choisit qu'une famille (Nouveau compte). */
export const CODE_DE_FAMILLE: Record<FamillePoste, string> = { GB: "G", DEF: "DC", MIL: "MC", ATT: "AT" };

const PARIS = "Europe/Paris";
const jourDe = (d: Date) => d.toLocaleDateString("fr-CA", { timeZone: PARIS }); // AAAA-MM-JJ
const JOUR_MS = 86_400_000;

/**
 * La dernière venue d'un joueur, en mots : « vu aujourd'hui », « vu hier »,
 * « vu dimanche » dans la semaine, « vu le 12/11 » au-delà. Les jours sont
 * ceux de Paris, pas ceux du téléphone.
 */
export function libelleVu(vu: Date, maintenant: Date): string {
  const a = jourDe(vu);
  const b = jourDe(maintenant);
  if (a === b) return "vu aujourd'hui";
  const ecart = Math.round((Date.parse(b) - Date.parse(a)) / JOUR_MS);
  if (ecart === 1) return "vu hier";
  if (ecart > 1 && ecart < 7) return `vu ${vu.toLocaleDateString("fr-FR", { weekday: "long", timeZone: PARIS })}`;
  return `vu le ${vu.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: PARIS })}`;
}

/** La dernière trace de chaque joueur, d'un journal lu du plus récent au plus ancien ou dans le désordre. */
export function dernieresVenues(traces: { player_id: string | null; created_at: string }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of traces) {
    if (!t.player_id) continue;
    const avant = m.get(t.player_id);
    if (!avant || t.created_at > avant) m.set(t.player_id, t.created_at);
  }
  return m;
}

/** Ce que copie « Copier pour l'envoyer » : de quoi entrer une fois. */
export function texteDAcces(nom: string, identifiant: string, provisoire: string): string {
  return `${nom}\nIdentifiant : ${identifiant}\nMot de passe provisoire : ${provisoire}`;
}
