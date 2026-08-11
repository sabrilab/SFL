// Moteur SFL : notes, rangs et évolution mensuelle (EvoDay).
// Règles issues du classeur "SFL_Statistiques_Base_Propre.xlsx".

export const STAT_KEYS = ["VIT", "TIR", "PAS", "DRI", "DEF", "PHY"] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export type PlayerStatus = "Actif" | "Blessure" | "Suspendu";

export interface Player {
  name: string;
  poste: string;
  pp: number; // Points Pépite (saison)
  matchs: number;
  buts: number;
  passes: number;
  statut: PlayerStatus;
  stats: Stats;
  mvp: number;
  impact: number;
  def: number;
  absInj?: number; // absences injustifiées (discipline)
}

export interface RankedPlayer extends Player {
  rank: number;
}

export type BoostType = "mvp" | "impact" | "def";

export interface BoostCardData {
  player: string;
  type: BoostType;
  ovr: number;
  poste: string;
  date: string;
  stats: Stats;
}

export interface MatchPlayerLine {
  name: string;
  buts: number;
  passes: number;
  // Mention affichée à côté du joueur (ex. "Extra time" : a joué la prolongation
  // sans se voir attribuer de but, mais gagne un point Pépite).
  note?: string;
}

export interface MatchTeam {
  id: string;
  name: string;
  score: number;
  players: MatchPlayerLine[];
}

export interface JourneeMatch {
  id: string;
  label: string;
  teamA: MatchTeam;
  teamB: MatchTeam;
}

export interface Journee {
  j: number;
  date: string;
  sflTime: boolean;
  // Composition en équipes du jour (undefined = feuille de match pas encore
  // renseignée par l'admin : pas de vote de figures possible).
  matches?: JourneeMatch[];
  // Repli plat utilisé uniquement quand `matches` est absent.
  lignes?: [string, "V" | "D" | "-", number, number][];
  // Faits objectifs (issus des stats, pas d'un vote).
  faits: Partial<{
    buteur: string;
    passeur: string;
  }>;
}

// Localise le match et l'équipe (+ l'équipe adverse) d'un joueur pour une journée.
export function findPlayerMatch(journee: Journee, playerName: string) {
  for (const match of journee.matches ?? []) {
    if (match.teamA.players.some((p) => p.name === playerName)) {
      return { match, team: match.teamA, opponents: match.teamB };
    }
    if (match.teamB.players.some((p) => p.name === playerName)) {
      return { match, team: match.teamB, opponents: match.teamA };
    }
  }
  return null;
}

// Tous les participants d'une journée (toutes équipes, tous matchs confondus).
export function journeeParticipants(journee: Journee): string[] {
  const names = new Set<string>();
  for (const match of journee.matches ?? []) {
    match.teamA.players.forEach((p) => names.add(p.name));
    match.teamB.players.forEach((p) => names.add(p.name));
  }
  return [...names];
}

// Résumé du score du jour : un seul match -> score direct, plusieurs -> "N matchs".
export function journeeScoreSummary(
  journee: Journee
): { label: string; multi: boolean } | null {
  const matches = journee.matches;
  if (!matches || matches.length === 0) return null;
  if (matches.length === 1) {
    const m = matches[0];
    return { label: `${m.teamA.score} – ${m.teamB.score}`, multi: false };
  }
  return { label: `${matches.length} matchs`, multi: true };
}

export const ovr = (s: Stats) =>
  Math.ceil(STAT_KEYS.reduce((a, k) => a + s[k], 0) / 6);

// Version "Rare" de la carte : +3 sur les 2 meilleures stats, +1 ailleurs.
// Plafonnée à 99 comme les cartes boost : une base déjà à 99 y reste.
export function rareStats(s: Stats): Stats {
  const top2 = [...STAT_KEYS].sort((a, b) => s[b] - s[a]).slice(0, 2);
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = Math.min(99, s[k] + (top2.includes(k) ? 3 : 1));
  return out;
}

// Classement Pépite d'Or : tri par PP décroissant, égalités partagent le rang.
export function rankPlayers(players: Player[]): RankedPlayer[] {
  let rank = 0;
  let prev: number | null = null;
  return [...players]
    .sort((a, b) => b.pp - a.pp)
    .map((p, i) => {
      if (p.pp !== prev) {
        rank = i + 1;
        prev = p.pp;
      }
      return { ...p, rank };
    });
}

// Classement générique sur une métrique : tri décroissant, égalités partagent le rang.
export interface MetricRankedPlayer extends Player {
  rank: number;
  value: number;
}

export function rankByMetric(
  players: Player[],
  getValue: (p: Player) => number
): MetricRankedPlayer[] {
  let rank = 0;
  let prev: number | null = null;
  return [...players]
    .map((p) => ({ ...p, value: getValue(p) }))
    .sort((a, b) => b.value - a.value)
    .map((p, i) => {
      if (p.value !== prev) {
        rank = i + 1;
        prev = p.value;
      }
      return { ...p, rank };
    });
}

// Bonus de tiers Pépite d'Or : 1er tiers +3, 2e tiers +2, dernier +1.
export function tierBonus(rank: number, total: number) {
  const third = Math.ceil(total / 3);
  return rank <= third ? 3 : rank <= third * 2 ? 2 : 1;
}

export type Allocation = Record<StatKey, number>;

export const emptyAllocation = (): Allocation => ({
  VIT: 0,
  TIR: 0,
  PAS: 0,
  DRI: 0,
  DEF: 0,
  PHY: 0,
});

/** Plafond du gain de VIT automatique sur un EvoDay (règle officielle). */
export const AUTO_VIT_MAX = 1;

// Applique une répartition de points sur les stats de base.
// Règle VIT auto : un (+1 DEF ET +1 PHY) simultané offre +1 VIT, mais le
// barème plafonne ce gain à +1 par EvoDay — sans quoi une Défensive
// (+2 DEF, +2 PHY) offrirait +2 VIT gratuits chaque mois.
export function buildTargetStats(base: Stats, alloc: Allocation) {
  const out = { ...base };
  for (const k of STAT_KEYS) out[k] += alloc[k] || 0;
  const autoVit = Math.min(alloc.DEF || 0, alloc.PHY || 0, AUTO_VIT_MAX);
  out.VIT += autoVit;
  // Plafond d'une statistique : 99.
  for (const k of STAT_KEYS) out[k] = Math.min(99, out[k]);
  return { out, autoVit };
}

/**
 * Points libres du mois : bonus de tiers au classement Pépite d'Or
 * (3 / 2 / 1 selon le tiers), + 6 si MVP du mois, + 2 si Joueur Impact.
 * Le bonus de tiers est passé par l'appelant, qui seul connaît le rang.
 */
export function freePool(p: Player, tierPoints = 0) {
  return tierPoints + (p.mvp > 0 ? 6 : 0) + (p.impact > 0 ? 2 : 0);
}

// Bonus fixes du mois (appliqués automatiquement, hors pool libre).
export function fixedBonuses(p: Player): Allocation {
  return {
    VIT: 0,
    TIR: p.buts >= 6 ? 3 : 0, // meilleur buteur
    PAS: p.passes >= 6 ? 3 : 0, // meilleur passeur
    DRI: p.impact > 0 ? 1 : 0, // Joueur Impact du mois
    DEF: p.def > 0 ? 2 : 0, // titre Défensive
    PHY: (p.matchs >= 3 ? 1 : 0) + (p.def > 0 ? 2 : 0), // présence parfaite + Défensive
  };
}
