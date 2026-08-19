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
  rareStats,
  STAT_KEYS,
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
  // Feuille de match : chaque PAIRE d'arrêts vaut 1 point Pépite, chaque
  // paire d'interceptions aussi. Les deux compteurs sont indépendants.
  parPaireDefensive: 1,
  paire: 2,
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

export function entryPP(e: MatchEntry): number {
  // Une ligne qui n'est pas une présence ne rapporte pas le point de présence :
  // un blessé, un suspendu ou un absent justifié est à zéro, comme dans la
  // colonne « PP du match » du classeur. L'absence injustifiée, elle, coûte.
  // (Les classements passaient déjà par ce chemin ; c'est l'affichage ligne à
  // ligne de la grille qui exigeait de le dire ici.)
  if (e.statut !== "Présent") {
    const penalite = e.statut === "Absence injustifiée" ? BAREME.absenceInjustifiee : 0;
    return penalite + (e.pepiteBonus ?? 0);
  }
  let pp = BAREME.presence;
  if (e.result === "Victoire") pp += e.sflTime ? BAREME.victoireSflTime : BAREME.victoire;
  else if (e.result === "Nul") pp += BAREME.nul;
  pp += e.buts * BAREME.but + e.passes * BAREME.passe;
  if (e.cleanSheet) pp += BAREME.cleanSheet;
  if (e.mvp) pp += BAREME.mvp;
  if (e.impact) pp += BAREME.impact;
  if (e.def) pp += BAREME.def;
  if (e.retard) pp += BAREME.retard;
  pp +=
    (Math.floor((e.arrets ?? 0) / BAREME.paire) +
      Math.floor((e.interceptions ?? 0) / BAREME.paire)) *
    BAREME.parPaireDefensive;
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
    // UNE SEULE formule de points, celle de `entryPP` — la même que la colonne
    // PP de la grille de saisie. Le classement recalculait auparavant les
    // absences de son côté et ignorait purement le bonus manuel posé sur une
    // ligne de blessure ou d'absence justifiée : la grille affichait un total,
    // le classement en affichait un autre.
    a.pp += entryPP(e);
    if (e.statut === "Présent") {
      a.matchs += 1;
      a.buts += e.buts;
      a.passes += e.passes;
      if (e.mvp) a.mvp += 1;
      if (e.impact) a.impact += 1;
      if (e.def) a.def += 1;
    } else if (e.statut === "Absence injustifiée") {
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

// Le pluriel est porté par l'appelant : coller un « s » à la fin de
// « passe D. » donnait « 4 passe D.s ».
function bestFait(
  entries: MatchEntry[],
  key: "buts" | "passes",
  singulier: string,
  pluriel: string
) {
  const max = Math.max(0, ...entries.map((e) => e[key]));
  if (max <= 0) return undefined;
  const who = entries.filter((e) => e[key] === max).map((e) => e.player);
  return `${who.join(" & ")} — ${max} ${max > 1 ? pluriel : singulier}`;
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
        buteur: bestFait(played, "buts", "but", "buts"),
        passeur: bestFait(played, "passes", "passe D.", "passes D."),
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

/**
 * Stats d'une carte Boost.
 *
 * Ordre de dérivation : base du roster → carte **Rare** → bonus du type →
 * performance du jour → plafond 99.
 *
 * Le passage par la Rare est essentiel : appliquer les bonus directement sur
 * la base produisait, pour le type « impact », exactement la formule de
 * `rareStats` — autrement dit une carte Impact rigoureusement identique à la
 * carte Rare du joueur.
 */
function boostStats(base: number[], type: BoostType, buts: number, passes: number): Stats {
  // On part de la carte Rare, calculée par la même fonction que partout
  // ailleurs dans l'app pour éviter deux formules divergentes.
  const rare = rareStats(toStats(base));
  const s = STAT_KEYS.map((k) => rare[k]);

  if (type === "mvp" || type === "impact") {
    // +3 sur les deux meilleures stats de la Rare, le reste uniformément.
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
    // Défensive : +2 DEF et +2 PHY, la vitesse suivant automatiquement
    // (chaque +1 DEF conjugué à un +1 PHY donne +1 VIT), +1 sur le reste.
    s[4] += 2; // DEF
    s[5] += 2; // PHY
    s[0] += 2; // VIT (auto)
    s[1] += 1; // TIR
    s[2] += 1; // PAS
    s[3] += 1; // DRI
  }

  // Performance du jour.
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
