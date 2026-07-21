// Moteur de dérivation de la saisie admin.
//
// Entrée : une `Saison` brute (roster + lignes de match, cf. types.ts).
// Sortie : exactement les structures consommées par l'app existante
// (Player[], Journee[], BoostCardData[]) + des alertes de cohérence.
//
// C'est le portage TypeScript de la logique qui servait à importer l'Excel :
// barème des Points Pépite, composition des équipes par couleur, formule des
// cartes boost par type, contrôles de saisie. Aucune dépendance au stockage.

import {
  ovr,
  type BoostCardData,
  type BoostType,
  type Journee,
  type JourneeMatch,
  type MatchTeam,
  type Player,
  type PlayerStatus,
  type Stats,
} from "../engine";
import type { MatchEntry, RosterEntry, Saison, SaisieAlert } from "./types";

/* ------------------------------- Barème ------------------------------- */

const BAREME = {
  presence: 1,
  victoire: 2,
  victoireSflTime: 3,
  nul: 1,
  but: 1,
  passe: 1,
  mvp: 2,
  impact: 1,
  def: 1,
  cleanSheet: 3,
  retard: -1,
  absenceInjustifiee: -2,
} as const;

const STAT_CAP = 99;
const DEFAULT_BASE = [75, 75, 75, 75, 75, 75];

function toStats(base: number[] | null | undefined): Stats {
  const b = base && base.length === 6 ? base : DEFAULT_BASE;
  return { VIT: b[0], TIR: b[1], PAS: b[2], DRI: b[3], DEF: b[4], PHY: b[5] };
}

function rosterMap(saison: Saison): Map<string, RosterEntry> {
  return new Map(saison.roster.map((r) => [r.name, r]));
}

/* ---------------------------- Classements ---------------------------- */

interface Agg {
  pp: number;
  matchs: number;
  buts: number;
  passes: number;
  mvp: number;
  impact: number;
  def: number;
  absInj: number;
}

const emptyAgg = (): Agg => ({
  pp: 0,
  matchs: 0,
  buts: 0,
  passes: 0,
  mvp: 0,
  impact: 0,
  def: 0,
  absInj: 0,
});

function entryPP(e: MatchEntry): number {
  let pp = BAREME.presence;
  if (e.result === "Victoire") pp += e.sflTime ? BAREME.victoireSflTime : BAREME.victoire;
  else if (e.result === "Nul") pp += BAREME.nul;
  pp += e.buts * BAREME.but + e.passes * BAREME.passe;
  if (e.cleanSheet) pp += BAREME.cleanSheet;
  if (e.mvp) pp += BAREME.mvp;
  if (e.impact) pp += BAREME.impact;
  if (e.def) pp += BAREME.def;
  if (e.retard) pp += BAREME.retard;
  return pp + (e.pepiteBonus ?? 0);
}

function seasonStatut(profil: string, absInj: number): PlayerStatus {
  if (profil === "Blessure") return "Blessure";
  if (absInj >= 1) return "Suspendu";
  return "Actif";
}

export function computeStandings(saison: Saison): Player[] {
  const roster = rosterMap(saison);
  const agg = new Map<string, Agg>();
  const get = (n: string) => {
    let a = agg.get(n);
    if (!a) agg.set(n, (a = emptyAgg()));
    return a;
  };

  for (const e of saison.entries) {
    const a = get(e.player);
    if (e.extraTime) {
      a.pp += e.pepiteBonus ?? 0; // extra time : ni présence ni match, juste le bonus
      continue;
    }
    if (e.statut === "Présent") {
      a.pp += entryPP(e);
      a.matchs += 1;
      a.buts += e.buts;
      a.passes += e.passes;
      if (e.mvp) a.mvp += 1;
      if (e.impact) a.impact += 1;
      if (e.def) a.def += 1;
    } else if (e.statut === "Absence injustifiée") {
      a.pp += BAREME.absenceInjustifiee + (e.pepiteBonus ?? 0);
      a.absInj += 1;
    }
  }

  // Joueurs du roster évalués mais qui n'ont pas encore joué : présents à 0
  // dans les classements « showAll » (OVR, présences, discipline).
  for (const r of saison.roster) {
    if (!agg.has(r.name) && r.base && r.profil !== "En attente") agg.set(r.name, emptyAgg());
  }

  const players: Player[] = [...agg.entries()].map(([name, a]) => {
    const r = roster.get(name);
    return {
      name,
      poste: r?.poste || "—",
      pp: a.pp,
      matchs: a.matchs,
      buts: a.buts,
      passes: a.passes,
      statut: seasonStatut(r?.profil ?? "Actif", a.absInj),
      stats: toStats(r?.base),
      mvp: a.mvp,
      impact: a.impact,
      def: a.def,
      ...(a.absInj ? { absInj: a.absInj } : {}),
    };
  });

  return players.sort((x, y) => y.pp - x.pp || x.name.localeCompare(y.name));
}

/* ------------------------------ Journées ------------------------------ */

function bestFait(entries: MatchEntry[], key: "buts" | "passes", suffix: string) {
  const max = Math.max(0, ...entries.map((e) => e[key]));
  if (max <= 0) return undefined;
  const who = entries.filter((e) => e[key] === max).map((e) => e.player);
  return `${who.join(" & ")} — ${max} ${suffix}${max > 1 ? "s" : ""}`;
}

function buildTeam(j: number, mi: number, name: string, members: MatchEntry[]): MatchTeam {
  const score = members.reduce((s, e) => s + e.buts + (e.teamScoreBonus ?? 0), 0);
  const slug = name.toLowerCase().replace(/[^a-z]+/g, "") || "eq";
  return {
    id: `j${j}-m${mi}-${slug}`,
    name,
    score,
    players: members.map((e) => ({
      name: e.player,
      buts: e.buts,
      passes: e.passes,
      ...(e.note ? { note: e.note } : {}),
    })),
  };
}

export function computeJournees(saison: Saison): Journee[] {
  const byJ = new Map<number, MatchEntry[]>();
  for (const e of saison.entries) {
    const list = byJ.get(e.j) ?? [];
    list.push(e);
    byJ.set(e.j, list);
  }

  return [...saison.journees]
    .sort((a, b) => a.j - b.j)
    .map((meta): Journee => {
      const entries = byJ.get(meta.j) ?? [];
      const played = entries.filter((e) => e.statut === "Présent" && !e.extraTime);
      const faits = {
        buteur: bestFait(played, "buts", "but"),
        passeur: bestFait(played, "passes", "passe D."),
      };

      const teamEntries = entries.filter(
        (e) => e.team && (e.statut === "Présent" || e.extraTime)
      );

      if (teamEntries.length > 0) {
        // Regroupe par équipe, dans l'ordre d'apparition, puis apparie 2 à 2.
        const order: string[] = [];
        const groups = new Map<string, MatchEntry[]>();
        for (const e of teamEntries) {
          const t = e.team as string;
          if (!groups.has(t)) {
            groups.set(t, []);
            order.push(t);
          }
          groups.get(t)!.push(e);
        }
        const matches: JourneeMatch[] = [];
        for (let i = 0; i + 1 < order.length; i += 2) {
          const mi = i / 2 + 1;
          matches.push({
            id: `j${meta.j}-m${mi}`,
            label: `Match ${mi}`,
            teamA: buildTeam(meta.j, mi, order[i], groups.get(order[i])!),
            teamB: buildTeam(meta.j, mi, order[i + 1], groups.get(order[i + 1])!),
          });
        }
        return { j: meta.j, date: meta.date, sflTime: meta.sflTime, matches, faits };
      }

      // Pas d'équipes : repli plat.
      const lignes = played.map(
        (e): [string, "V" | "D" | "-", number, number] => [
          e.player,
          e.result === "Victoire" ? "V" : e.result === "Défaite" ? "D" : "-",
          e.buts,
          e.passes,
        ]
      );
      return { j: meta.j, date: meta.date, sflTime: meta.sflTime, lignes, faits };
    });
}

/* ----------------------------- Cartes boost ---------------------------- */

const TYPE_ORDER: Record<BoostType, number> = { mvp: 0, impact: 1, def: 2 };

function boostStats(base: number[], type: BoostType, buts: number, passes: number): Stats {
  const s = [...base];
  if (type === "mvp" || type === "impact") {
    const top2 = new Set(
      s
        .map((v, i) => [v, i] as const)
        .sort((a, b) => b[0] - a[0] || a[1] - b[1])
        .slice(0, 2)
        .map(([, i]) => i)
    );
    const other = type === "mvp" ? 2 : 1;
    for (let i = 0; i < 6; i++) s[i] += top2.has(i) ? 3 : other;
  } else {
    s[4] += 2; // DEF
    s[5] += 2; // PHY
    s[0] += 2; // VIT (auto)
    s[1] += 1; // TIR
    s[2] += 1; // PAS
    s[3] += 1; // DRI
  }
  s[1] += buts;
  s[2] += passes;
  const c = s.map((v) => Math.min(STAT_CAP, v));
  return { VIT: c[0], TIR: c[1], PAS: c[2], DRI: c[3], DEF: c[4], PHY: c[5] };
}

export function computeBoostCards(saison: Saison): BoostCardData[] {
  const roster = rosterMap(saison);
  const dateOf = new Map(saison.journees.map((m) => [m.j, m.date]));
  const cards: (BoostCardData & { _j: number })[] = [];

  for (const e of saison.entries) {
    if (e.statut !== "Présent" || e.extraTime) continue;
    const base = roster.get(e.player)?.base ?? DEFAULT_BASE;
    const honors: BoostType[] = [];
    if (e.mvp) honors.push("mvp");
    if (e.impact) honors.push("impact");
    if (e.def) honors.push("def");
    for (const type of honors) {
      const stats = boostStats(base, type, e.buts, e.passes);
      cards.push({
        _j: e.j,
        player: e.player,
        type,
        ovr: ovr(stats),
        poste: roster.get(e.player)?.poste || "—",
        date: `J${e.j} · ${dateOf.get(e.j) ?? ""}`,
        stats,
      });
    }
  }

  cards.sort(
    (a, b) => a._j - b._j || TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.player.localeCompare(b.player)
  );
  return cards.map(({ _j, ...c }) => {
    void _j;
    return c;
  });
}

/* ------------------------------- Alertes ------------------------------- */

export function computeAlerts(saison: Saison): SaisieAlert[] {
  const alerts: SaisieAlert[] = [];
  const names = new Set(saison.roster.map((r) => r.name));
  const seen = new Map<string, number>();

  for (const e of saison.entries) {
    if (e.extraTime) continue;
    const key = `${e.j}::${e.player}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (seen.get(key) === 2)
      alerts.push({ level: "error", j: e.j, player: e.player, message: "Doublon joueur / journée" });

    if (!names.has(e.player))
      alerts.push({ level: "warning", j: e.j, player: e.player, message: "Joueur absent du roster" });

    if (e.statut === "Présent" && !e.result)
      alerts.push({ level: "warning", j: e.j, player: e.player, message: "Saisie incomplète (résultat manquant)" });

    const hasStats = e.buts > 0 || e.passes > 0 || e.mvp || e.impact || e.def || e.cleanSheet;
    if (e.statut !== "Présent" && hasStats)
      alerts.push({ level: "warning", j: e.j, player: e.player, message: "Stats saisies sans présence" });
  }
  return alerts;
}

/* ------------------------------ Aggrégat ------------------------------ */

export interface DerivedSeason {
  players: Player[];
  journees: Journee[];
  boostCards: BoostCardData[];
  alerts: SaisieAlert[];
}

export function deriveSeason(saison: Saison): DerivedSeason {
  return {
    players: computeStandings(saison),
    journees: computeJournees(saison),
    boostCards: computeBoostCards(saison),
    alerts: computeAlerts(saison),
  };
}
