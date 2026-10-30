// Mutations immuables de la saison. Chaque fonction renvoie une NOUVELLE
// `Saison` (jamais de mutation en place) pour que React re-render proprement.
// Les lignes sont identifiées par leur index dans `entries` — l'UI passe cet
// index. Le store persiste le résultat.

import { computeJournees } from "./engine";
import { labelDateFr, prochainDimanche } from "../convocation-temps";
import { equipesDuMatch, equipesDuMatchSuivant } from "./equipes";
import { dejaSurLaFeuille, jouable } from "./effectif";
import { resteUnBrouillon } from "./brouillon";
import { numeroSaison, type MatchDuJour, type SaisonArchivee, type Terrain } from "./types";
import type {
  Convocation,
  ConvocationReponse,
  MatchEntry,
  RosterEntry,
  Saison,
  ConvocationTeam,
} from "./types";

/**
 * Les équipes qu'on compose, match par match : « Noirs 1 » contre « Blancs 1 »,
 * puis le Match 2… Plus de couleurs depuis le 23/10 (saisie/equipes.ts).
 */
export const TEAM_PRESETS: readonly string[] = [1, 2, 3, 4].flatMap(equipesDuMatch);

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
  // Jamais un joueur déjà sur la journée (il y serait deux fois) ni un
  // membre qui ne joue pas : pour changer deux joueurs de camp, on échange
  // les camps (echangerCampsAt), pas les noms.
  if (!jouable(nouveau) || (!ligne.extraTime && dejaSurLaFeuille(saison, ligne.j, nouveau))) return saison;
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

/**
 * Échange les camps de deux lignes de la même journée (le Direct, « Échanger ») :
 * chacun prend l'équipe — et le résultat déjà posé — de l'autre.
 */
export function echangerCampsAt(saison: Saison, a: number, b: number): Saison {
  const la = saison.entries[a];
  const lb = saison.entries[b];
  if (!la || !lb || a === b || la.j !== lb.j || la.team === lb.team) return saison;
  const entries = saison.entries.map((e, i) =>
    i === a
      ? { ...e, team: lb.team, result: lb.result, cleanSheet: lb.cleanSheet }
      : i === b
        ? { ...e, team: la.team, result: la.result, cleanSheet: la.cleanSheet }
        : e
  );
  return { ...saison, entries };
}

export function deleteEntryAt(saison: Saison, index: number): Saison {
  return { ...saison, entries: saison.entries.filter((_, i) => i !== index) };
}

/**
 * Ajoute une ligne. Refusée (la saison revient inchangée) pour un membre
 * qui ne joue pas, ou un joueur déjà sur la feuille de cette journée — sauf
 * sa ligne Xtratime, qui n'est pas un doublon (integrite.ts, I1 et I2).
 */
export function addEntry(saison: Saison, entry: MatchEntry): Saison {
  if (!jouable(entry.player)) return saison;
  if (!entry.extraTime && dejaSurLaFeuille(saison, entry.j, entry.player)) return saison;
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

/**
 * Le dimanche de la journée qu'on crée, en libellé court (« 1 nov. ») :
 * aujourd'hui si l'on est dimanche à Paris, sinon le prochain. Avant, une
 * journée préparée le vendredi portait la date du vendredi : son vote
 * s'ouvrait et se fermait ce jour-là, et la convocation ne la retrouvait pas.
 */
export function dimancheDeJournee(maintenant = new Date()): string {
  const jour = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", weekday: "short" }).format(maintenant);
  return libelleCourt(labelDateFr(jour === "Sun" ? maintenant : prochainDimanche(maintenant)));
}

/** Les deux journées ont-elles la même date ? « 1 nov. » et « 1 novembre », sans casse. */
export function memeDate(a: string, b: string): boolean {
  const n = (x: string) => libelleCourt(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return n(a) === n(b);
}

/** La journée de cette date, s'il y en a une. */
export function journeeDeLaDate(saison: Pick<Saison, "journees">, date: string) {
  return saison.journees.find((m) => memeDate(m.date, date));
}

/**
 * Prépare la journée d'un dimanche (« Préparer la J5 ») : celle de cette date
 * si elle existe déjà — une seule journée par dimanche (integrite.ts, I6) —,
 * sinon la suivante, `max(j) + 1`, avec l'heure, le terrain et le SFL Time
 * de la précédente. `brouillon` : elle naît cachée aux joueurs, le temps de
 * la préparer (saisie/brouillon.ts). Remplace addJournee, qui créait une
 * journée de plus à chaque appel, même pour un dimanche qui avait la sienne.
 */
export function preparerJournee(
  saison: Saison,
  date?: string,
  opts: { brouillon?: { par: string; le: Date } } = {}
): { saison: Saison; j: number; existante: boolean } {
  const quand = date?.trim() || dimancheDeJournee();
  const deja = journeeDeLaDate(saison, quand);
  if (deja) return { saison, j: deja.j, existante: true };
  const j = saison.journees.reduce((m, x) => Math.max(m, x.j), 0) + 1;
  const avant = [...saison.journees].sort((a, b) => b.j - a.j)[0];
  return {
    saison: {
      ...saison,
      journees: [
        ...saison.journees,
        {
          j,
          date: quand,
          sflTime: avant?.sflTime ?? false,
          mvpAuto: true,
          ...(avant?.heure ? { heure: avant.heure } : {}),
          ...(avant?.terrainId != null ? { terrainId: avant.terrainId } : {}),
          ...(opts.brouillon ? { brouillon: { depuis: opts.brouillon.le.toISOString(), par: opts.brouillon.par } } : {}),
        },
      ],
    },
    j,
    existante: false,
  };
}

/**
 * Les matchs d'une journée tels que l'admin les a écrits, dans l'ordre :
 * ceux de `matchsDuJour` (y compris un match encore vide, né de
 * « + Match 3 »), puis ceux que forme le moteur et qui n'y sont pas (une
 * journée d'avant le 23/10).
 */
export function matchsDeclares(saison: Saison, j: number): MatchDuJour[] {
  const meta = saison.journees.find((m) => m.j === j);
  const out: MatchDuJour[] = [];
  const vus = new Set<string>();
  for (const m of meta?.matchsDuJour ?? []) {
    if (vus.has(m.equipes[0]) || vus.has(m.equipes[1]) || m.equipes[0] === m.equipes[1]) continue;
    vus.add(m.equipes[0]);
    vus.add(m.equipes[1]);
    out.push(m);
  }
  for (const m of computeJournees(saison).find((x) => x.j === j)?.matches ?? []) {
    if (vus.has(m.teamA.name) || vus.has(m.teamB.name)) continue;
    vus.add(m.teamA.name);
    vus.add(m.teamB.name);
    out.push({
      equipes: [m.teamA.name, m.teamB.name],
      ...(m.heure ? { heure: m.heure } : {}),
      ...(m.lieuId != null ? { lieuId: m.lieuId } : {}),
      ...(m.terrain ? { terrain: m.terrain } : {}),
    });
  }
  return out;
}

/** Le coup d'envoi le plus prisé de la journée qui n'a pas encore ses `max` matchs. */
function creneauLibre(saison: Saison, j: number, max: number): string | undefined {
  const meta = saison.journees.find((m) => m.j === j);
  const parHeure = new Map<string, number>();
  for (const m of matchsDeclares(saison, j)) {
    const h = m.heure ?? meta?.heure;
    if (h) parHeure.set(h, (parHeure.get(h) ?? 0) + 1);
  }
  if (!parHeure.size) return meta?.heure;
  for (const [h, n] of parHeure) if (n < max) return h;
  return undefined;
}

/**
 * « + Match N » : le seul chemin vers un match de plus (30/10). La paire
 * « Noirs N » / « Blancs N » est écrite dans matchsDuJour, sans aucun
 * joueur ; N passe après tous les numéros déjà pris. L'heure est celle du
 * premier créneau qui n'a pas encore ses `terrainsMax` matchs. Un match vide
 * ne se voit pas chez les joueurs (le moteur l'ignore) et ne se publie pas.
 */
export function ajouterMatch(
  saison: Saison,
  j: number,
  reglage: { heure?: string; terrain?: string; lieuId?: number } = {},
  terrainsMax = 2
): { saison: Saison; n: number; equipes: [string, string] } {
  const declares = matchsDeclares(saison, j);
  const noms = [...new Set([...declares.flatMap((m) => m.equipes), ...saison.entries.filter((e) => e.j === j && e.team).map((e) => e.team as string)])];
  const equipes = equipesDuMatchSuivant(noms, declares.length);
  const heure = reglage.heure?.trim() || creneauLibre(saison, j, terrainsMax);
  const meta = saison.journees.find((m) => m.j === j);
  const nouveau: MatchDuJour = {
    equipes,
    ...(heure && heure !== meta?.heure ? { heure } : {}),
    ...(reglage.lieuId != null ? { lieuId: reglage.lieuId } : {}),
    ...(reglage.terrain?.trim() ? { terrain: reglage.terrain } : {}),
  };
  return {
    saison: { ...saison, journees: saison.journees.map((m) => (m.j === j ? { ...m, matchsDuJour: [...declares, nouveau] } : m)) },
    n: declares.length + 1,
    equipes,
  };
}

/** Retire un match encore vide (« + Match 3 » touché pour rien). Un match qui a des joueurs reste. */
export function retirerMatchVide(saison: Saison, j: number, equipes: [string, string]): Saison {
  const occupe = saison.entries.some((e) => e.j === j && (e.team === equipes[0] || e.team === equipes[1]));
  if (occupe) return saison;
  const declares = matchsDeclares(saison, j).filter((m) => m.equipes[0] !== equipes[0] || m.equipes[1] !== equipes[1]);
  return { ...saison, journees: saison.journees.map((m) => (m.j === j ? { ...m, matchsDuJour: declares } : m)) };
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

/**
 * Prépare la journée d'un dimanche avec des équipes générées (Nouvelle
 * journée) : celle de cette date si elle existe, sinon la suivante
 * (preparerJournee). Un joueur déjà sur la feuille garde sa ligne et prend
 * son équipe ; un nom en double ou un membre qui ne joue pas n'entre pas.
 * Les matchs sont écrits en toutes lettres, deux équipes par match.
 */
export function addJourneeWithTeams(
  saison: Saison,
  teams: BalancedTeam[],
  date?: string,
  opts: { brouillon?: { par: string; le: Date } } = {}
): { saison: Saison; j: number } {
  const { saison: avec, j } = preparerJournee(saison, date, opts);
  const posee = poserEquipes(
    avec,
    j,
    teams.map((t) => ({ name: t.name, players: t.players.map((p) => p.name) }))
  );
  return { saison: posee, j };
}

/** Ce que la pose retire des équipes : un nom déjà pris plus haut, ou un membre qui ne joue pas. */
export function retiresDeLaPose(teams: ConvocationTeam[]): { nom: string; raison: "double" | "ne-joue-pas" }[] {
  const vus = new Set<string>();
  const out: { nom: string; raison: "double" | "ne-joue-pas" }[] = [];
  for (const t of teams)
    for (const nom of t.players) {
      const cle = nom.trim().toLowerCase();
      if (!jouable(nom)) out.push({ nom, raison: "ne-joue-pas" });
      else if (vus.has(cle)) out.push({ nom, raison: "double" });
      vus.add(cle);
    }
  return out;
}

/** « 1 novembre » → « 1 nov. » : le libellé d'une convocation, à la façon des journées. */
export function libelleCourt(dateLabel: string): string {
  const COURTS: Record<string, string> = {
    janvier: "janv.", février: "févr.", mars: "mars", avril: "avr.", mai: "mai", juin: "juin",
    juillet: "juil.", août: "août", septembre: "sept.", octobre: "oct.", novembre: "nov.", décembre: "déc.",
  };
  const m = dateLabel.trim().match(/^(\d{1,2})\s+(\p{L}+)/u);
  const mois = m ? COURTS[m[2].toLowerCase()] : undefined;
  return m && mois ? `${Number(m[1])} ${mois}` : dateLabel;
}

/**
 * Pose sur la feuille de la journée `j` les équipes de la convocation
 * (composées par division, lib/sfl/equipes-division.ts), dans leur ordre :
 * chaque paire devient un match de la journée (JourneeMeta.matchsDuJour),
 * les Noirs puis les Blancs, si bien que la D1 joue le Match 1. Un match
 * garde l'heure, le lieu et le terrain que l'admin lui avait déjà donnés.
 * Un joueur déjà sur la feuille garde sa ligne (et ce qui y est noté) et
 * prend son équipe ; les autres y entrent. Qui est sur la feuille sans être
 * dans les équipes y reste, sans équipe. La journée n'existe pas encore :
 * elle naît, datée du dimanche de la convocation, et reprend de la
 * précédente le SFL Time et le terrain.
 */
export function poserEquipes(
  saison: Saison,
  j: number,
  teamsBrutes: ConvocationTeam[],
  date?: string,
  opts: { brouillon?: { par: string; le: Date } } = {}
): Saison {
  // Chaque nom une seule fois (sa première place), jamais un membre qui ne
  // joue pas : une composition qui porte un joueur deux fois ne le fait plus
  // entrer deux fois sur la feuille (30/10).
  const vus = new Set<string>();
  const teams = teamsBrutes.map((t) => ({
    ...t,
    players: t.players.filter((nom) => {
      const cle = nom.trim().toLowerCase();
      if (!jouable(nom) || vus.has(cle)) return false;
      vus.add(cle);
      return true;
    }),
  }));
  let s = saison;
  if (!s.journees.some((m) => m.j === j)) {
    const avant = [...s.journees].sort((a, b) => b.j - a.j)[0];
    s = {
      ...s,
      journees: [
        ...s.journees,
        {
          j,
          date: date ?? dimancheDeJournee(),
          sflTime: avant?.sflTime ?? false,
          mvpAuto: true,
          ...(avant?.terrainId != null ? { terrainId: avant.terrainId } : {}),
          ...(opts.brouillon ? { brouillon: { depuis: opts.brouillon.le.toISOString(), par: opts.brouillon.par } } : {}),
        },
      ],
    };
  }
  const lignes = s.entries.filter((e) => e.j === j);
  // Une ligne neuve compte la victoire comme les autres lignes du jour, sinon comme la journée.
  const sflTime = lignes[0]?.sflTime ?? s.journees.find((m) => m.j === j)?.sflTime ?? false;
  const prises = new Set<MatchEntry>();
  const posees: MatchEntry[] = [];
  for (const t of teams) {
    for (const nom of t.players) {
      const ligne = lignes.find((e) => e.player === nom && !prises.has(e) && !e.extraTime);
      if (ligne) prises.add(ligne);
      posees.push(ligne ? { ...ligne, team: t.name } : { ...newEntry(j, nom, t.name), sflTime });
    }
  }
  const reste = lignes.filter((e) => !prises.has(e)).map((e) => ({ ...e, team: null }));
  const avant = s.journees.find((m) => m.j === j)?.matchsDuJour ?? [];
  const matchsDuJour = Array.from({ length: Math.floor(teams.length / 2) }, (_, n): MatchDuJour => {
    const { heure, lieuId, terrain, arbitre } = avant[n] ?? {};
    return {
      equipes: [teams[n * 2].name, teams[n * 2 + 1].name],
      ...(heure ? { heure } : {}),
      ...(lieuId != null ? { lieuId } : {}),
      ...(terrain ? { terrain } : {}),
      // L'arbitre désigné en brouillon reste sur son match, comme l'heure et le lieu.
      ...(arbitre ? { arbitre } : {}),
    };
  });
  return {
    ...s,
    journees: s.journees.map((m) => (m.j === j ? { ...m, matchsDuJour } : m)),
    entries: [...s.entries.filter((e) => e.j !== j), ...posees, ...reste],
  };
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
 *
 * `titres` : les élus des votes (Impact, Défensive), qui ne sont jamais écrits
 * dans le document — sans eux, la saison close perdrait leurs cartes et leurs
 * points dès le lendemain de la clôture (les votes d'une saison ne se
 * rechargent plus une fois la suivante ouverte). `entries` vient de
 * appliquerVotes(saison, …), `faibles` de titresFaibles(…).
 */
export function cloturerSaison(
  saison: Saison,
  nom?: string,
  titres?: { entries: MatchEntry[]; faibles: Iterable<string> }
): Saison {
  // Jamais tant qu'une journée attend en brouillon (30/10) : elle partirait
  // en archive sans que la ligue l'ait jamais vue.
  if (resteUnBrouillon(saison)) return saison;
  const numero = numeroSaison(saison);
  const faibles = titres ? [...titres.faibles] : [];
  const archive: SaisonArchivee = {
    numero,
    nom: nom?.trim() || `Saison ${numero}`,
    cloturee: new Date().toISOString(),
    journees: structuredClone(saison.journees),
    roster: structuredClone(saison.roster),
    entries: structuredClone(titres?.entries ?? saison.entries),
    ...(saison.events?.length ? { events: structuredClone(saison.events) } : {}),
    ...(faibles.length ? { titresFaibles: faibles } : {}),
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
    events: a.events ?? [], convocations: [], archives: [], ...(a.titresFaibles?.length ? { titresFaibles: a.titresFaibles } : {}) };
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

/**
 * Donne à un match de la journée (0 pour le Match 1) son heure, son lieu ou
 * son terrain ; `undefined` ou un texte vide lui rendent ceux de la journée.
 * Les matchs du moment sont écrits en toutes lettres au passage, chacun avec
 * ses deux équipes : l'appariement ne bouge plus, et l'heure reste avec son
 * match. Le texte est gardé tel que tapé : l'admin le règle touche par
 * touche, et l'espace de « Terrain 3 » ne doit pas tomber en route.
 */
export function reglerMatchDuJour(
  saison: Saison,
  j: number,
  n: number,
  reglage: { heure?: string; lieuId?: number; terrain?: string }
): Saison {
  // `n` : le rang du match tel que le moteur le forme (les écrans d'avant) ;
  // le réglage va au match de ces deux équipes, et les matchs encore vides
  // (« + Match 3 ») restent écrits.
  const matches = computeJournees(saison).find((x) => x.j === j)?.matches ?? [];
  if (!matches[n]) return saison;
  return reglerMatch(saison, j, [matches[n].teamA.name, matches[n].teamB.name], reglage);
}

/** Donne au match de ces deux équipes son heure, son lieu ou son terrain ; un texte vide rend ceux de la journée. */
export function reglerMatch(
  saison: Saison,
  j: number,
  equipes: [string, string],
  reglage: { heure?: string; lieuId?: number; terrain?: string }
): Saison {
  const declares = matchsDeclares(saison, j);
  if (!declares.some((m) => m.equipes[0] === equipes[0] && m.equipes[1] === equipes[1])) return saison;
  const plein = (texte: string | undefined) => (texte?.trim() ? texte : undefined);
  const matchsDuJour = declares.map((m): MatchDuJour => {
    if (m.equipes[0] !== equipes[0] || m.equipes[1] !== equipes[1]) return m;
    const r = { heure: m.heure, lieuId: m.lieuId, terrain: m.terrain, ...reglage };
    const heure = plein(r.heure);
    const terrain = plein(r.terrain);
    return {
      equipes: m.equipes,
      ...(heure ? { heure } : {}),
      ...(r.lieuId != null ? { lieuId: r.lieuId } : {}),
      ...(terrain ? { terrain } : {}),
      ...(m.arbitre ? { arbitre: m.arbitre } : {}),
    };
  });
  return { ...saison, journees: saison.journees.map((m) => (m.j === j ? { ...m, matchsDuJour } : m)) };
}

/** Envoie un match de la journée sur un nouveau lieu, créé depuis son adresse. */
export function placerMatchDuJourSurNouveauLieu(
  saison: Saison,
  j: number,
  n: number,
  t: Omit<Terrain, "id" | "defaut">
): Saison {
  const avec = ajouterTerrain(saison, t);
  const id = (avec.terrains ?? []).reduce((m, x) => Math.max(m, x.id), 0);
  return reglerMatchDuJour(avec, j, n, { lieuId: id });
}

// Une journée est jouée quand ses actions sont saisies (le moteur, engine.ts).
export { journeeJouee, journeeTerminee } from "./engine";

/** Le terrain d'une journée : le sien, sinon celui du lieu de la convocation, sinon le défaut. */
export function terrainDeJournee(
  saison: Pick<Saison, "terrains">,
  meta: { terrainId?: number },
  lieuConvocation?: string | null
): Terrain | null {
  const propre = meta.terrainId != null ? (saison.terrains ?? []).find((t) => t.id === meta.terrainId) : undefined;
  return propre ?? terrainDuMatch(saison, lieuConvocation);
}

/**
 * « Fin du match · 3 – 2 » (le Direct, 30/10/2026) : pose la victoire, la
 * défaite ou le nul sur TOUTES les lignes présentes des deux camps, d'après
 * le score de la feuille. Un camp n'a donc jamais deux résultats (integrite.ts, I7).
 */
export function finDuMatch(saison: Saison, j: number, equipes: [string, string]): Saison {
  const m = computeJournees(saison)
    .find((x) => x.j === j)
    ?.matches?.find((x) => x.teamA.name === equipes[0] && x.teamB.name === equipes[1]);
  if (!m) return saison;
  const [a, b] = [m.teamA.score, m.teamB.score];
  const pour = (team: string | null): MatchEntry["result"] | undefined =>
    team === equipes[0] ? (a > b ? "Victoire" : a < b ? "Défaite" : "Nul") : team === equipes[1] ? (b > a ? "Victoire" : b < a ? "Défaite" : "Nul") : undefined;
  return {
    ...saison,
    entries: saison.entries.map((e) => {
      if (e.j !== j || e.statut !== "Présent" || e.extraTime) return e;
      const r = pour(e.team);
      return r ? { ...e, result: r } : e;
    }),
  };
}

/** L'arbitre d'un match, gardé sur la journée (en brouillon : écrit dans `arbitrages` à la publication). */
export function poserArbitreDuMatch(saison: Saison, j: number, equipes: [string, string], arbitre: string | null): Saison {
  const declares = matchsDeclares(saison, j);
  const matchsDuJour = declares.map((m) => {
    if (m.equipes[0] !== equipes[0] || m.equipes[1] !== equipes[1]) return m;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { arbitre: _avant, ...reste } = m;
    return arbitre ? { ...reste, arbitre } : reste;
  });
  return { ...saison, journees: saison.journees.map((m) => (m.j === j ? { ...m, matchsDuJour } : m)) };
}
