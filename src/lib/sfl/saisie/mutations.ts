// Mutations immuables de la saison. Chaque fonction renvoie une NOUVELLE
// `Saison` (jamais de mutation en place) pour que React re-render proprement.
// Les lignes sont identifiées par leur index dans `entries` — l'UI passe cet
// index. Le store persiste le résultat.

import type {
  Convocation,
  ConvocationReponse,
  MatchEntry,
  RosterEntry,
  Saison,
  ConvocationTeam,
} from "./types";

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
    arrets: 0,
    interceptions: 0,
  };
}

/** Duplique une ligne juste en dessous — le geste le plus courant en saisie. */
export function duplicateEntryAt(saison: Saison, index: number): Saison {
  const source = saison.entries[index];
  if (!source) return saison;
  const entries = [...saison.entries];
  entries.splice(index + 1, 0, { ...source });
  return { ...saison, entries };
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

/* ------------------------------ Roster ------------------------------ */

export function newRosterPlayer(name: string): RosterEntry {
  return { name, poste: "—", profil: "Actif", base: [75, 75, 75, 75, 75, 75] };
}

export function addRoster(saison: Saison, entry: RosterEntry): Saison {
  return { ...saison, roster: [...saison.roster, entry] };
}

export function updateRosterAt(
  saison: Saison,
  index: number,
  patch: Partial<RosterEntry>
): Saison {
  return {
    ...saison,
    roster: saison.roster.map((r, i) => (i === index ? { ...r, ...patch } : r)),
  };
}

export function deleteRosterAt(saison: Saison, index: number): Saison {
  return { ...saison, roster: saison.roster.filter((_, i) => i !== index) };
}

/** True si un joueur du même nom existe déjà (comparaison insensible à la casse/espaces). */
export function rosterHasName(saison: Saison, name: string): boolean {
  const n = name.trim().toLowerCase();
  return saison.roster.some((r) => r.name.trim().toLowerCase() === n);
}

/* ------------------------ Génération d'équipes ------------------------ */

export interface BalancedPlayer {
  name: string;
  ovr: number;
}

export interface BalancedTeam {
  name: string;
  players: BalancedPlayer[];
  totalOvr: number;
}

/**
 * Répartit les joueurs sélectionnés en `teamCount` équipes équilibrées selon
 * l'OVR de leur carte : serpentin sur l'ordre OVR décroissant (1→N, N→1, …),
 * avec un petit brassage aléatoire des joueurs de même OVR pour varier les
 * compositions d'une génération à l'autre.
 */
export function generateBalancedTeams(
  players: BalancedPlayer[],
  teamCount: number,
  teamNames: readonly string[] = TEAM_PRESETS
): BalancedTeam[] {
  const teams: BalancedTeam[] = Array.from({ length: teamCount }, (_, i) => ({
    name: teamNames[i] ?? `Équipe ${i + 1}`,
    players: [],
    totalOvr: 0,
  }));
  const pool = [...players]
    .map((p) => ({ p, r: Math.random() }))
    .sort((a, b) => b.p.ovr - a.p.ovr || a.r - b.r)
    .map(({ p }) => p);

  // Serpentin, en plaçant chaque joueur dans l'équipe la plus faible du tour.
  pool.forEach((p) => {
    const target = [...teams].sort(
      (a, b) => a.players.length - b.players.length || a.totalOvr - b.totalOvr
    )[0];
    target.players.push(p);
    target.totalOvr += p.ovr;
  });
  return teams;
}

/** Crée une journée complète à partir d'équipes générées (une ligne par joueur). */
export function addJourneeWithTeams(
  saison: Saison,
  teams: BalancedTeam[]
): { saison: Saison; j: number } {
  const { saison: withJournee, j } = addJournee(saison);
  const entries: MatchEntry[] = teams.flatMap((t) =>
    t.players.map((p) => newEntry(j, p.name, t.name))
  );
  return { saison: { ...withJournee, entries: [...withJournee.entries, ...entries] }, j };
}

/* ----------------------------- Convocations ----------------------------- */

/** Convocation ouverte la plus récente (celle affichée aux joueurs). */
export function activeConvocation(saison: Saison): Convocation | null {
  const open = saison.convocations.filter((c) => c.statut === "ouverte");
  return open.length ? open[open.length - 1] : null;
}

export function createConvocation(
  saison: Saison,
  info: Pick<Convocation, "jour" | "date" | "heure" | "lieu">
): Saison {
  const id = saison.convocations.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  // Une seule convocation ouverte à la fois : les précédentes sont clôturées.
  const closed = saison.convocations.map((c) =>
    c.statut === "ouverte" ? { ...c, statut: "clôturée" as const } : c
  );
  return {
    ...saison,
    convocations: [...closed, { id, ...info, statut: "ouverte", reponses: {} }],
  };
}

/** Réponse d'un joueur (ou saisie par l'admin) ; null efface la réponse. */
export function respondConvocation(
  saison: Saison,
  id: number,
  player: string,
  reponse: ConvocationReponse | null
): Saison {
  return {
    ...saison,
    convocations: saison.convocations.map((c) => {
      if (c.id !== id) return c;
      const reponses = { ...c.reponses };
      if (reponse === null) delete reponses[player];
      else reponses[player] = reponse;
      return { ...c, reponses };
    }),
  };
}

/** Pose (ou retire, avec null) les équipes composées d'une convocation. */
export function setConvocationTeams(
  saison: Saison,
  id: number,
  teams: ConvocationTeam[] | null
): Saison {
  return {
    ...saison,
    convocations: saison.convocations.map((c) =>
      c.id === id ? { ...c, teams: teams ?? undefined } : c
    ),
  };
}

export function closeConvocation(saison: Saison, id: number): Saison {
  return {
    ...saison,
    convocations: saison.convocations.map((c) =>
      c.id === id ? { ...c, statut: "clôturée" as const } : c
    ),
  };
}
