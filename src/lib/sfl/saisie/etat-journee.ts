// Où en est une journée, et le geste du moment (l'admin, 30/10/2026).
//
// Un seul état est stocké (le brouillon, brouillon.ts) ; les autres se
// déduisent de la feuille et de l'heure :
//   brouillon  — seule l'organisation la voit ;
//   en-ligne   — publiée, pas encore commencée ;
//   en-direct  — le coup d'envoi est passé, ou un but est déjà noté ;
//   terminee   — chaque camp a son résultat (journeeTerminee).
//
// Le geste du moment : il y en a toujours un, et un seul, en bas de l'écran.
//
// Pur.

import { journeeJouee, journeeTerminee } from "./engine";
import { coupDEnvoi, dateDeJournee, estBrouillon } from "./brouillon";
import { bloquantsPublication, type Ecart } from "./integrite";
import { dimancheDeJournee, matchsDeclares } from "./mutations";
import type { Saison } from "./types";

export type EtatJournee = "brouillon" | "en-ligne" | "en-direct" | "terminee";

export function etatJournee(s: Saison, j: number, maintenant: Date): EtatJournee {
  const meta = s.journees.find((m) => m.j === j);
  if (!meta || estBrouillon(meta)) return "brouillon";
  if (journeeTerminee(s, j)) return "terminee";
  if (journeeJouee(s, j)) return "en-direct";
  const envoi = coupDEnvoi(meta, maintenant);
  if (envoi && envoi.getTime() <= maintenant.getTime()) return "en-direct";
  return "en-ligne";
}

/** Le jour (à minuit UTC) d'une date de journée, pour comparer. */
function jourDe(date: string, maintenant: Date): number | null {
  const d = dateDeJournee(date, maintenant);
  return d ? Date.UTC(d.y, d.m, d.d) : null;
}

function aujourdhui(maintenant: Date): number {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(maintenant);
  const [y, m, d] = p.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * La journée ouverte par défaut : celle du jour, sinon la prochaine à venir
 * (un brouillon compris). Jamais la dernière jouée : le 28/10, la grille
 * rouvrait la J3, déjà jouée, et c'est là qu'ont poussé les matchs 5 et 6.
 * null : aucune journée à venir (le geste est alors « Préparer la J5 »).
 */
export function prochaineJournee(s: Saison, maintenant: Date): number | null {
  const ajd = aujourdhui(maintenant);
  const datees = [...s.journees]
    .map((m) => ({ m, jour: jourDe(m.date, maintenant) }))
    .sort((a, b) => a.m.j - b.m.j);
  const duJour = datees.find((x) => x.jour === ajd);
  if (duJour) return duJour.m.j;
  const avenir = datees.filter((x) => x.jour != null && x.jour > ajd).sort((a, b) => a.jour! - b.jour! || a.m.j - b.m.j)[0];
  if (avenir) return avenir.m.j;
  // Un brouillon sans date lisible reste à préparer.
  const brouillon = datees.find((x) => estBrouillon(x.m));
  return brouillon?.m.j ?? null;
}

/** Le numéro et le dimanche de la journée à préparer. */
export function journeeAPreparer(s: Saison, maintenant: Date): { j: number; date: string } {
  return { j: s.journees.reduce((m, x) => Math.max(m, x.j), 0) + 1, date: dimancheDeJournee(maintenant) };
}

export type Geste =
  | { t: "preparer"; j: number; date: string }
  | { t: "corriger"; j: number; ecarts: Ecart[] }
  | { t: "publier"; j: number }
  | { t: "en-ligne"; j: number; le?: string }
  | { t: "direct"; j: number; match: number; heure?: string }
  | { t: "apres"; j: number; suivante: { j: number; date: string } };

/** Le geste du moment pour la journée ouverte (`j`, ou null : aucune à venir). */
export function gesteDuMoment(s: Saison, j: number | null, maintenant: Date): Geste {
  if (j == null) return { t: "preparer", ...journeeAPreparer(s, maintenant) };
  const meta = s.journees.find((m) => m.j === j);
  if (!meta) return { t: "preparer", ...journeeAPreparer(s, maintenant) };
  const etat = etatJournee(s, j, maintenant);
  if (etat === "brouillon") {
    const ecarts = bloquantsPublication(s, j);
    return ecarts.length ? { t: "corriger", j, ecarts } : { t: "publier", j };
  }
  if (etat === "terminee") return { t: "apres", j, suivante: journeeAPreparer(s, maintenant) };
  const ajd = aujourdhui(maintenant);
  if (etat === "en-direct" || jourDe(meta.date, maintenant) === ajd) {
    // Le premier match qui n'a pas encore son résultat.
    const ms = matchsDeclares(s, j);
    const i = ms.findIndex((m) => !s.entries.some((e) => e.j === j && e.team === m.equipes[0] && e.result));
    const n = i < 0 ? 0 : i;
    return { t: "direct", j, match: n + 1, heure: ms[n]?.heure ?? meta.heure };
  }
  return { t: "en-ligne", j, le: meta.publiee?.le };
}

/** Les compteurs d'une journée, en mots : « 2 MATCHS · 20 JOUEURS · 2 REMPLAÇANTS ». */
export function compteurs(s: Saison, j: number): { matchs: number; joueurs: number; sansEquipe: number } {
  const lignes = s.entries.filter((e) => e.j === j && !e.extraTime);
  const ms = matchsDeclares(s, j);
  const camps = new Set(ms.flatMap((m) => m.equipes));
  return {
    matchs: ms.filter((m) => lignes.some((e) => e.team === m.equipes[0]) || lignes.some((e) => e.team === m.equipes[1])).length,
    joueurs: lignes.filter((e) => e.statut === "Présent" && e.team && camps.has(e.team)).length,
    sansEquipe: lignes.filter((e) => !e.team || !camps.has(e.team)).length,
  };
}
