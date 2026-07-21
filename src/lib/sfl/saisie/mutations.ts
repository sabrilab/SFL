// Mutations immuables de la saison. Chaque fonction renvoie une NOUVELLE
// `Saison` (jamais de mutation en place) pour que React re-render proprement.
// Les lignes sont identifiées par leur index dans `entries` — l'UI passe cet
// index. Le store persiste le résultat.

import type { MatchEntry, Saison } from "./types";

export const TEAM_PRESETS = [
  "Orange",
  "Bleu",
  "Vert",
  "Jaune",
  "Rouge",
  "Gris",
  "Équipe A",
  "Équipe B",
] as const;

export function updateEntryAt(
  saison: Saison,
  index: number,
  patch: Partial<MatchEntry>
): Saison {
  const entries = saison.entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
  return { ...saison, entries };
}

export function deleteEntryAt(saison: Saison, index: number): Saison {
  return { ...saison, entries: saison.entries.filter((_, i) => i !== index) };
}

export function addEntry(saison: Saison, entry: MatchEntry): Saison {
  return { ...saison, entries: [...saison.entries, entry] };
}

export function newEntry(j: number, player: string, team: string | null): MatchEntry {
  return {
    j,
    player,
    team,
    statut: "Présent",
    result: null,
    sflTime: false,
    buts: 0,
    passes: 0,
    cleanSheet: false,
    mvp: false,
    impact: false,
    def: false,
    retard: false,
  };
}

function shortToday(): string {
  return new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Crée une nouvelle journée (numéro suivant) et renvoie la saison + son numéro. */
export function addJournee(saison: Saison): { saison: Saison; j: number } {
  const j = saison.journees.reduce((m, x) => Math.max(m, x.j), 0) + 1;
  return {
    saison: {
      ...saison,
      journees: [...saison.journees, { j, date: shortToday(), sflTime: false }],
    },
    j,
  };
}

export function updateJournee(
  saison: Saison,
  j: number,
  patch: Partial<{ date: string; sflTime: boolean }>
): Saison {
  return {
    ...saison,
    journees: saison.journees.map((m) => (m.j === j ? { ...m, ...patch } : m)),
  };
}

export function deleteJournee(saison: Saison, j: number): Saison {
  return {
    ...saison,
    journees: saison.journees.filter((m) => m.j !== j),
    entries: saison.entries.filter((e) => e.j !== j),
  };
}
