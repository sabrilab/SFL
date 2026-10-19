// Mutations immuables de la saison. Chaque fonction renvoie une NOUVELLE
// `Saison` (jamais de mutation en place) pour que React re-render proprement.
// Les lignes sont identifiées par leur index dans `entries` — l'UI passe cet
// index. Le store persiste le résultat.

import { numeroSaison, type SaisonArchivee, type Terrain } from "./types";
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

/**
 * Feuille en direct : le joueur d'une ligne n'est pas venu, un autre a joué à
 * sa place. La ligne garde son équipe et ce qui y est déjà noté (c'est le
 * remplaçant qui était sur le terrain) ; seul le nom change, dans la ligne et
 * dans les buts minutés de la journée.
 */
export function remplacerJoueurAt(saison: Saison, index: number, nouveau: string): Saison {
  const ligne = saison.entries[index];
  if (!ligne || ligne.player === nouveau) return saison;
  const ancien = ligne.player;
  const entries = saison.entries.map((e, i) => (i === index ? { ...e, player: nouveau } : e));
  const events = saison.events?.map((ev) =>
    ev.j !== ligne.j
      ? ev
      : {
          ...ev,
          player: ev.player === ancien ? nouveau : ev.player,
          passeur: ev.passeur === ancien ? nouveau : ev.passeur,
        }
  );
  return { ...saison, entries, ...(events ? { events } : {}) };
}

/**
 * Feuille en direct : un joueur passe dans une autre équipe, avec ses chiffres.
 * Si le résultat du match est déjà posé, il prend celui de sa nouvelle équipe.
 */
export function changerEquipeAt(saison: Saison, index: number, team: string): Saison {
  const ligne = saison.entries[index];
  if (!ligne || ligne.team === team) return saison;
  const coequipier = saison.entries.find(
    (e, i) => i !== index && e.j === ligne.j && e.team === team && !e.extraTime
  );
  return updateEntryAt(saison, index, {
    team,
    ...(coequipier ? { result: coequipier.result, cleanSheet: coequipier.cleanSheet } : {}),
  });
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
      journees: [...saison.journees, { j, date: shortToday(), sflTime: false, mvpAuto: true }],
    },
    j,
  };
}

export function updateJournee(
  saison: Saison,
  j: number,
  patch: Partial<{ date: string; sflTime: boolean; heure: string; terrainId: number | undefined }>
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

/* ------------------------------ Saisons ------------------------------ */

/**
 * Clôture la saison en cours et ouvre la suivante.
 *
 * Ce qui part en archive : les journées, les lignes, les buts minutés, et
 * l'effectif tel qu'il est ce jour-là. Ce qui continue : l'effectif (mêmes
 * joueurs, mêmes cartes — on les requalifie à part), et les convocations
 * ouvertes, qui concernent déjà le prochain dimanche.
 *
 * Rien n'est perdu : `restaurerSaison` refait le chemin inverse tant que la
 * nouvelle saison est encore vierge.
 */
export function cloturerSaison(saison: Saison, nom?: string): Saison {
  const numero = numeroSaison(saison);
  const archive: SaisonArchivee = {
    numero,
    nom: nom?.trim() || `Saison ${numero}`,
    cloturee: new Date().toISOString(),
    journees: structuredClone(saison.journees),
    roster: structuredClone(saison.roster),
    entries: structuredClone(saison.entries),
    ...(saison.events?.length ? { events: structuredClone(saison.events) } : {}),
  };
  return {
    ...saison,
    numero: numero + 1,
    journees: [],
    entries: [],
    events: [],
    archives: [...(saison.archives ?? []), archive],
  };
}

/** Le dernier instant où une clôture peut encore être annulée sans rien perdre. */
export function restaurationPossible(saison: Saison): boolean {
  const derniere = saison.archives?.[saison.archives.length - 1];
  return !!derniere && saison.entries.length === 0 && saison.journees.length === 0;
}

/**
 * Annule la dernière clôture : la saison archivée redevient la saison en cours.
 * Refuse si la saison ouverte depuis a déjà des journées — on n'écrase jamais
 * du travail saisi.
 */
export function restaurerSaison(saison: Saison): Saison {
  if (!restaurationPossible(saison)) return saison;
  const archives = [...(saison.archives ?? [])];
  const derniere = archives.pop()!;
  return {
    ...saison,
    numero: derniere.numero,
    journees: derniere.journees,
    entries: derniere.entries,
    events: derniere.events ?? [],
    archives,
  };
}

/** Une archive relue comme une saison, pour que le moteur la dérive telle quelle. */
export function saisonDepuisArchive(a: SaisonArchivee): Saison {
  return { numero: a.numero, journees: a.journees, roster: a.roster, entries: a.entries,
    events: a.events ?? [], convocations: [], archives: [] };
}

/* -------------------------------- Terrains -------------------------------- */
//
// La Map montre les matchs de la ligue là où ils se jouent. Un terrain, c'est
// un nom, une adresse et un point ; le premier ajouté devient le terrain par
// défaut, et il n'y en a jamais qu'un.

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function ajouterTerrain(saison: Saison, t: Omit<Terrain, "id">): Saison {
  const terrains = saison.terrains ?? [];
  const id = terrains.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  const defaut = terrains.length === 0 || !!t.defaut;
  return {
    ...saison,
    terrains: [
      ...terrains.map((x) => (defaut ? { ...x, defaut: false } : x)),
      { ...t, id, defaut },
    ],
  };
}

/** Repose un terrain au point exact (l'épingle ajustée sur la photo satellite). */
export function deplacerTerrain(saison: Saison, id: number, lat: number, lng: number): Saison {
  return { ...saison, terrains: (saison.terrains ?? []).map((t) => (t.id === id ? { ...t, lat, lng } : t)) };
}

export function retirerTerrain(saison: Saison, id: number): Saison {
  const restants = (saison.terrains ?? []).filter((x) => x.id !== id);
  // Le terrain par défaut ne disparaît pas avec celui qu'on retire.
  if (restants.length && !restants.some((x) => x.defaut)) restants[0] = { ...restants[0], defaut: true };
  return { ...saison, terrains: restants };
}

export function definirTerrainParDefaut(saison: Saison, id: number): Saison {
  return { ...saison, terrains: (saison.terrains ?? []).map((x) => ({ ...x, defaut: x.id === id })) };
}

/**
 * Le terrain d'un match, d'après le lieu écrit sur sa convocation : celui dont
 * le nom y figure, sinon le terrain par défaut, sinon le premier connu.
 */
export function terrainDuMatch(saison: Pick<Saison, "terrains">, lieu: string | null | undefined): Terrain | null {
  const terrains = saison.terrains ?? [];
  if (!terrains.length) return null;
  const l = normaliser(lieu ?? "");
  const nomme = l ? terrains.find((t) => l.includes(normaliser(t.nom))) : undefined;
  return nomme ?? terrains.find((t) => t.defaut) ?? terrains[0];
}

/**
 * Pose une journée sur un nouveau terrain (créé depuis son adresse) : le
 * terrain rejoint la liste de la ligue, la journée s'y rattache.
 */
export function placerJourneeSurNouveauTerrain(
  saison: Saison,
  j: number,
  t: Omit<Terrain, "id" | "defaut">
): Saison {
  const avec = ajouterTerrain(saison, t);
  const id = (avec.terrains ?? []).reduce((m, x) => Math.max(m, x.id), 0);
  return updateJournee(avec, j, { terrainId: id });
}

/** Une journée est jouée quand ses actions sont saisies : un résultat, un but ou une passe. */
export function journeeJouee(saison: Pick<Saison, "entries">, j: number): boolean {
  return saison.entries.some((e) => e.j === j && (!!e.result || e.buts > 0 || e.passes > 0));
}

/** Le terrain d'une journée : le sien, sinon celui du lieu de la convocation, sinon le défaut. */
export function terrainDeJournee(
  saison: Pick<Saison, "terrains">,
  meta: { terrainId?: number },
  lieuConvocation?: string | null
): Terrain | null {
  const propre = meta.terrainId != null ? (saison.terrains ?? []).find((t) => t.id === meta.terrainId) : undefined;
  return propre ?? terrainDuMatch(saison, lieuConvocation);
}
