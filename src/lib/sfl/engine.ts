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

export interface Journee {
  j: number;
  date: string;
  sflTime: boolean;
  score: [number, number] | null;
  faits: Partial<{
    mvp: string;
    impactA: string;
    impactB: string;
    defs: string;
    buteur: string;
    passeur: string;
  }>;
  // [joueur, résultat V/D/-, buts, passes décisives]
  lignes: [string, "V" | "D" | "-", number, number][];
}

export const ovr = (s: Stats) =>
  Math.ceil(STAT_KEYS.reduce((a, k) => a + s[k], 0) / 6);

// Version "Rare" de la carte : +3 sur les 2 meilleures stats, +1 ailleurs.
export function rareStats(s: Stats): Stats {
  const top2 = [...STAT_KEYS].sort((a, b) => s[b] - s[a]).slice(0, 2);
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = s[k] + (top2.includes(k) ? 3 : 1);
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

// Applique une répartition de points sur les stats de base.
// Règle VIT auto : chaque (+1 DEF ET +1 PHY) simultané offre +1 VIT.
export function buildTargetStats(base: Stats, alloc: Allocation) {
  const out = { ...base };
  for (const k of STAT_KEYS) out[k] += alloc[k] || 0;
  const autoVit = Math.min(alloc.DEF || 0, alloc.PHY || 0);
  out.VIT += autoVit;
  return { out, autoVit };
}

// Pool de points libres du mois : MVP = 6, Joueur Impact = 3.
export function freePool(p: Player) {
  return (p.mvp > 0 ? 6 : 0) + (p.impact > 0 ? 3 : 0);
}

// Bonus fixes du mois (appliqués automatiquement, hors pool libre).
export function fixedBonuses(p: Player): Allocation {
  return {
    VIT: 0,
    TIR: p.buts >= 6 ? 3 : 0, // meilleur buteur
    PAS: p.passes >= 6 ? 3 : 0, // meilleur passeur
    DRI: 0,
    DEF: p.def > 0 ? 2 : 0, // titre Défensive
    PHY: (p.matchs >= 3 ? 1 : 0) + (p.def > 0 ? 2 : 0), // présence 100% + Défensive
  };
}
