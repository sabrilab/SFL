"use client";

// Analyse de journée — le moteur narratif du récap.
//
// Tout est calculé en comparant la saison AVANT la journée (classement
// recalculé sans ses lignes) et APRÈS : mouvements au classement, course au
// Pépite d'Or (en barres et en courbes depuis J1), pouls des buts, séries de
// buteurs, paliers franchis ou en approche, assiduité, bilan des équipes de
// couleur, records de la saison, absents marquants, et une réserve de
// « stats qui piquent » injectée dans le bento des chiffres. Chaque module
// ne s'affiche que si la journée a réellement produit la donnée — le récap
// varie donc d'une semaine à l'autre.

import { useMemo, type ReactNode } from "react";
import { TrendingUp } from "lucide-react";
import {
  rankPlayers,
  STAT_KEYS,
  type Journee,
  type Player,
} from "@/lib/sfl/engine";
import { computeStandings, entryPP } from "@/lib/sfl/saisie/engine";
import type { MatchEntry, Saison } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

/* ------------------------------ Calculs ------------------------------ */

export interface Insolite {
  label: string;
  value: string;
  sub: string;
}

export interface Analyse {
  course: {
    headline: string;
    top: { name: string; pp: number; earned: number; width: number }[];
  } | null;
  mouvements: { name: string; from: number; to: number; up: number }[];
  forme: { name: string; streak: number; goals: number }[];
  absents: { name: string; rank: number }[];
  insolites: Insolite[];
  /** Buts par journée jouée, pour la courbe de la saison. */
  pulse: { j: number; buts: number }[];
  /** PP cumulés des trois premiers actuels, journée par journée. */
  race: { names: string[]; js: number[]; series: number[][] } | null;
  /** Paliers de carrière franchis cette journée ou à ≤ 2 unités. */
  milestones: {
    name: string;
    label: string;
    current: number;
    target: number;
    crossed: boolean;
  }[];
  /** Grille de présence des plus assidus sur toutes les journées. */
  fideles: { js: number[]; rows: { name: string; cells: boolean[]; count: number }[] };
  /** Bilan V/N/D des équipes de couleur sur la saison. */
  couleurs: { team: string; v: number; n: number; d: number; total: number }[];
  /** Records individuels et collectifs de la saison. */
  records: { label: string; value: string; sub: string; fresh: boolean }[];
}

// Paliers de carrière — alignés sur les badges à venir (1/5/15/30…).
const CAPS: Record<string, { label: string; steps: number[] }> = {
  buts: { label: "buts", steps: [5, 15, 30, 50, 75, 100] },
  passes: { label: "passes", steps: [5, 15, 30, 50] },
  matchs: { label: "matchs", steps: [5, 10, 15, 20] },
};

export function useAnalyse(
  saison: Saison,
  players: Player[],
  journees: Journee[],
  lastJ: Journee
): Analyse {
  return useMemo(() => {
    const jEntries = saison.entries.filter(
      (e) => e.j === lastJ.j && e.statut === "Présent" && !e.extraTime
    );
    const before = computeStandings({
      ...saison,
      entries: saison.entries.filter((e) => e.j !== lastJ.j),
    });
    const rBefore = new Map(rankPlayers(before).map((p) => [p.name, p]));
    const rAfter = rankPlayers(players);
    const played = new Set(jEntries.map((e) => e.player));

    /* Course au Pépite d'Or */
    const top3 = rAfter.slice(0, 3);
    let course: Analyse["course"] = null;
    if (top3.length >= 2) {
      const leader = top3[0];
      const beforeLeader = rankPlayers(before)[0];
      const gapAfter = leader.pp - top3[1].pp;
      const gapBefore = beforeLeader
        ? beforeLeader.pp - (rankPlayers(before)[1]?.pp ?? 0)
        : gapAfter;
      const headline =
        beforeLeader && beforeLeader.name !== leader.name
          ? `${leader.name} prend la tête`
          : gapAfter > gapBefore
            ? `${leader.name} creuse l'écart : +${gapAfter} sur ${top3[1].name}`
            : gapAfter < gapBefore
              ? `${top3[1].name} revient à ${gapAfter} point${gapAfter > 1 ? "s" : ""}`
              : `${leader.name} garde ${gapAfter} point${gapAfter > 1 ? "s" : ""} d'avance`;
      course = {
        headline,
        top: top3.map((p) => ({
          name: p.name,
          pp: p.pp,
          earned: p.pp - (rBefore.get(p.name)?.pp ?? 0),
          width: Math.round((p.pp / leader.pp) * 100),
        })),
      };
    }

    /* Mouvements au classement (joueurs de la journée uniquement) */
    const mouvements = rAfter
      .filter((p) => played.has(p.name) && rBefore.has(p.name))
      .map((p) => {
        const b = rBefore.get(p.name)!;
        return { name: p.name, from: b.rank, to: p.rank, up: b.rank - p.rank };
      })
      .filter((m) => m.up > 0)
      .sort((a, b) => b.up - a.up)
      .slice(0, 3);

    /* Séries de buteurs en cours (journées consécutives avec au moins 1 but) */
    const scoredBy = new Map<string, Set<number>>();
    for (const e of saison.entries) {
      if (e.statut !== "Présent" || e.extraTime || e.buts <= 0) continue;
      if (!scoredBy.has(e.player)) scoredBy.set(e.player, new Set());
      scoredBy.get(e.player)!.add(e.j);
    }
    const goalsAt = (name: string, j: number) =>
      saison.entries
        .filter((e) => e.player === name && e.j === j && e.statut === "Présent" && !e.extraTime)
        .reduce((s, e) => s + e.buts, 0);
    const forme = [...played]
      .filter((n) => scoredBy.get(n)?.has(lastJ.j))
      .map((name) => {
        let j = lastJ.j;
        let goals = 0;
        while (scoredBy.get(name)!.has(j)) {
          goals += goalsAt(name, j);
          j -= 1;
        }
        return { name, streak: lastJ.j - j, goals };
      })
      .filter((s) => s.streak >= 3)
      .sort((a, b) => b.streak - a.streak || b.goals - a.goals)
      .slice(0, 2);

    /* Absents marquants : le top 10 qui n'a pas joué la journée */
    const absents = rAfter
      .filter(
        (p) => p.rank <= 10 && p.matchs > 0 && !played.has(p.name) && p.statut === "Actif"
      )
      .map((p) => ({ name: p.name, rank: p.rank }))
      .slice(0, 4);

    /* Le pouls de la saison : buts d'équipes par journée jouée */
    const pulse = journees
      .filter((j) => (j.matches ?? []).length > 0)
      .map((j) => ({
        j: j.j,
        buts: (j.matches ?? []).reduce((s, m) => s + m.teamA.score + m.teamB.score, 0),
      }));

    /* La course en courbes : PP cumulés des trois premiers actuels */
    const js = pulse.map((p) => p.j);
    let race: Analyse["race"] = null;
    if (top3.length >= 2 && js.length >= 2) {
      const perJ = js.map((j) =>
        computeStandings({
          ...saison,
          entries: saison.entries.filter((e) => e.j <= j),
        })
      );
      race = {
        names: top3.map((p) => p.name),
        js,
        series: top3.map((t) =>
          perJ.map((st) => st.find((p) => p.name === t.name)?.pp ?? 0)
        ),
      };
    }

    /* Paliers de carrière : franchis cette journée, ou à deux unités */
    const milestones: Analyse["milestones"] = [];
    for (const p of players) {
      if (p.matchs === 0) continue;
      const mine = jEntries.filter((e) => e.player === p.name);
      const delta: Record<string, number> = {
        buts: mine.reduce((s, e) => s + e.buts, 0),
        passes: mine.reduce((s, e) => s + e.passes, 0),
        matchs: mine.length,
      };
      const totals: Record<string, number> = { buts: p.buts, passes: p.passes, matchs: p.matchs };
      for (const key of Object.keys(CAPS)) {
        const total = totals[key];
        const beforeTotal = total - delta[key];
        for (const cap of CAPS[key].steps) {
          if (beforeTotal < cap && cap <= total) {
            milestones.push({ name: p.name, label: CAPS[key].label, current: total, target: cap, crossed: true });
          } else if (total < cap) {
            if (cap - total <= 2 && played.has(p.name)) {
              milestones.push({ name: p.name, label: CAPS[key].label, current: total, target: cap, crossed: false });
            }
            break;
          }
        }
      }
    }
    milestones.sort(
      (a, b) =>
        Number(b.crossed) - Number(a.crossed) ||
        a.target - a.current - (b.target - b.current) ||
        b.target - a.target
    );

    /* Les fidèles : grille de présence des six plus assidus */
    const playedByJ = new Map<number, Set<string>>();
    for (const e of saison.entries) {
      if (e.statut !== "Présent" || e.extraTime) continue;
      if (!playedByJ.has(e.j)) playedByJ.set(e.j, new Set());
      playedByJ.get(e.j)!.add(e.player);
    }
    const fideles: Analyse["fideles"] = {
      js,
      rows: [...rAfter]
        .filter((p) => p.matchs > 0)
        .sort((a, b) => b.matchs - a.matchs || a.rank - b.rank)
        .slice(0, 6)
        .map((p) => {
          const cells = js.map((j) => playedByJ.get(j)?.has(p.name) ?? false);
          // Compte sur les pastilles affichées : une journée sans matchs
          // d'équipe (J2) compte au classement mais n'a pas de colonne ici.
          return { name: p.name, cells, count: cells.filter(Boolean).length };
        }),
    };

    /* Le bilan des couleurs : V/N/D par équipe sur la saison */
    const teamRes = new Map<string, { v: number; n: number; d: number }>();
    const seenTeamJ = new Set<string>();
    for (const e of saison.entries) {
      if (e.statut !== "Présent" || e.extraTime || !e.team || !e.result) continue;
      const key = `${e.j}|${e.team}`;
      if (seenTeamJ.has(key)) continue;
      seenTeamJ.add(key);
      const t = teamRes.get(e.team) ?? { v: 0, n: 0, d: 0 };
      if (e.result === "Victoire") t.v += 1;
      else if (e.result === "Nul") t.n += 1;
      else t.d += 1;
      teamRes.set(e.team, t);
    }
    const couleurs = [...teamRes.entries()]
      .map(([team, r]) => ({ team, ...r, total: r.v + r.n + r.d }))
      .filter((t) => t.total >= 2)
      .sort((a, b) => b.v / b.total - a.v / a.total || b.total - a.total)
      .slice(0, 6);

    /* Les records de la saison — perfs sur une seule journée */
    const perPlayerJ = new Map<
      string,
      { name: string; j: number; buts: number; passes: number; pp: number }
    >();
    for (const e of saison.entries) {
      if (e.statut !== "Présent" || e.extraTime) continue;
      const key = `${e.player}|${e.j}`;
      const r = perPlayerJ.get(key) ?? { name: e.player, j: e.j, buts: 0, passes: 0, pp: 0 };
      r.buts += e.buts;
      r.passes += e.passes;
      r.pp += entryPP(e);
      perPlayerJ.set(key, r);
    }
    const allPerf = [...perPlayerJ.values()];
    const best = (key: "buts" | "passes" | "pp") =>
      [...allPerf].sort((a, b) => b[key] - a[key])[0];
    let teamRecord: { team: string; score: number; j: number } | null = null;
    for (const j of journees)
      for (const m of j.matches ?? [])
        for (const t of [m.teamA, m.teamB])
          if (!teamRecord || t.score > teamRecord.score)
            teamRecord = { team: t.name, score: t.score, j: j.j };
    const rBut = best("buts");
    const rPas = best("passes");
    const rPP = best("pp");
    const records: Analyse["records"] = [];
    if (rBut && rBut.buts > 0)
      records.push({
        label: "Le carton",
        value: `${rBut.buts} buts`,
        sub: `${rBut.name} · J${rBut.j}`,
        fresh: rBut.j === lastJ.j,
      });
    if (rPas && rPas.passes > 0)
      records.push({
        label: "Le chef d'orchestre",
        value: `${rPas.passes} passes`,
        sub: `${rPas.name} · J${rPas.j}`,
        fresh: rPas.j === lastJ.j,
      });
    if (rPP)
      records.push({
        label: "La perf ultime",
        value: `+${rPP.pp} PP`,
        sub: `${rPP.name} · J${rPP.j}`,
        fresh: rPP.j === lastJ.j,
      });
    if (teamRecord)
      records.push({
        label: "Le festival offensif",
        value: `${teamRecord.score} buts`,
        sub: `${teamRecord.team} · J${teamRecord.j}`,
        fresh: teamRecord.j === lastJ.j,
      });

    /* Stats qui piquent — la réserve, dans l'ordre d'intérêt */
    const insolites: Insolite[] = [];
    const matches = lastJ.matches ?? [];
    const teamOf = new Map<string, { name: string; score: number; conceded: number }>();
    for (const m of matches) {
      teamOf.set(m.teamA.name, { name: m.teamA.name, score: m.teamA.score, conceded: m.teamB.score });
      teamOf.set(m.teamB.name, { name: m.teamB.name, score: m.teamB.score, conceded: m.teamA.score });
    }
    const losers = new Set(
      matches.flatMap((m) =>
        m.teamA.score > m.teamB.score ? [m.teamB.name] : m.teamA.score < m.teamB.score ? [m.teamA.name] : []
      )
    );

    // Part d'équipe : un joueur qui porte son équipe au score.
    const share = jEntries
      .map((e) => {
        const t = e.team ? teamOf.get(e.team) : undefined;
        return t && t.score > 0 ? { e, pct: Math.round((e.buts / t.score) * 100), team: t.name } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x && x.pct >= 40)
      .sort((a, b) => b.pct - a.pct)[0];
    if (share)
      insolites.push({
        label: "Il porte son équipe",
        value: `${share.pct}%`,
        sub: `des buts du ${share.team} par ${share.e.player}`,
      });

    // Le meilleur perdant : la grosse perf dans la défaite.
    const bestLoser = [...jEntries]
      .filter((e) => e.team && losers.has(e.team))
      .map((e) => ({ e, pp: entryPP(e) }))
      .sort((a, b) => b.pp - a.pp)[0];
    if (bestLoser && bestLoser.pp >= 8)
      insolites.push({
        label: "Le meilleur perdant",
        value: `+${bestLoser.pp} PP`,
        sub: `${bestLoser.e.player}, dans la défaite`,
      });

    // L'altruiste : que des passes.
    const altruiste = [...jEntries]
      .filter((e) => e.buts === 0 && e.passes >= 3)
      .sort((a, b) => b.passes - a.passes)[0];
    if (altruiste)
      insolites.push({
        label: "L'altruiste",
        value: `${altruiste.passes} passes`,
        sub: `${altruiste.player}, sans marquer`,
      });

    // Générosité de la journée : PP moyen contre la moyenne de saison.
    const allPlayed = saison.entries.filter((e) => e.statut === "Présent" && !e.extraTime);
    if (jEntries.length > 0 && allPlayed.length > jEntries.length) {
      const avgJ = jEntries.reduce((s, e) => s + entryPP(e), 0) / jEntries.length;
      const avgS = allPlayed.reduce((s, e) => s + entryPP(e), 0) / allPlayed.length;
      if (Math.abs(avgJ - avgS) >= 0.5)
        insolites.push({
          label: avgJ > avgS ? "Journée généreuse" : "Journée fermée",
          value: `${avgJ.toFixed(1)} PP`,
          sub: `de moyenne, contre ${avgS.toFixed(1)} en saison`,
        });
    }

    // Titres distribués.
    const honors = (list: MatchEntry[]) =>
      list.reduce((s, e) => s + (e.mvp ? 1 : 0) + (e.impact ? 1 : 0) + (e.def ? 1 : 0), 0);
    const titres = honors(jEntries);
    if (titres > 0)
      insolites.push({
        label: "Titres distribués",
        value: `${titres}`,
        sub: "MVP, Impact et Défensive du jour",
      });

    // La meilleure défense du jour.
    const bestDef = [...teamOf.values()].sort((a, b) => a.conceded - b.conceded)[0];
    if (bestDef && matches.length > 1)
      insolites.push({
        label: "Le mur du jour",
        value: `${bestDef.conceded}`,
        sub: `but${bestDef.conceded > 1 ? "s" : ""} encaissé${bestDef.conceded > 1 ? "s" : ""} par le ${bestDef.name}`,
      });

    return {
      course,
      mouvements,
      forme,
      absents,
      insolites: insolites.slice(0, 4),
      pulse,
      race,
      milestones: milestones.slice(0, 4),
      fideles,
      couleurs,
      records,
    };
  }, [saison, players, journees, lastJ]);
}

/* ------------------------------ Modules ------------------------------ */

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold ring-2 ring-background"
      style={{ width: size, height: size }}
    >
      {name[0]}
    </span>
  );
}

/** La course au Pépite d'Or — barres de course + gains, carte du leader en 3D. */
export function CourseModule({
  course,
  card,
}: {
  course: Analyse["course"];
  card?: ReactNode;
}) {
  if (!course) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">La course au Pépite d&apos;Or</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">{course.headline}</h2>
      <div className={cn("mt-4", card && "flex items-center gap-4")}>
        {card && <div className="shrink-0">{card}</div>}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {course.top.map((p, i) => (
            <div key={p.name} className="flex items-center gap-2.5">
              <span className="w-4 text-center text-[12px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold">{p.name}</span>
                  <span className="text-[13px] font-bold tabular-nums">
                    {p.pp}
                    {p.earned > 0 && (
                      <span className="mono-label ml-1.5 text-primary">+{p.earned}</span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-foreground/35")}
                    style={{ width: `${p.width}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** La course en courbes — les PP cumulés du podium depuis la première journée. */
export function RaceModule({ race }: { race: Analyse["race"] }) {
  if (!race) return null;
  const W = 320;
  const H = 116;
  const PX = 8;
  const PY = 10;
  const max = Math.max(1, ...race.series.flat());
  const x = (i: number) => PX + (i * (W - 2 * PX)) / Math.max(1, race.js.length - 1);
  const y = (v: number) => H - PY - (v / max) * (H - 2 * PY);
  const line = (serie: number[]) => serie.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const STROKES = ["var(--primary)", "rgba(255,255,255,0.55)", "rgba(255,255,255,0.28)"];
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Depuis la J{race.js[0]}</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">La course, en courbes</h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" aria-hidden>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PX}
            x2={W - PX}
            y1={y(max * f)}
            y2={y(max * f)}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="1"
          />
        ))}
        {/* aplat sous la courbe du leader */}
        <polygon
          points={`${x(0)},${y(0)} ${line(race.series[0])} ${x(race.js.length - 1)},${y(0)}`}
          fill="var(--primary)"
          opacity="0.1"
        />
        {[...race.series].reverse().map((serie, ri) => {
          const i = race.series.length - 1 - ri;
          return (
            <polyline
              key={i}
              points={line(serie)}
              fill="none"
              stroke={STROKES[i]}
              strokeWidth={i === 0 ? 2.5 : 1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
        {race.series.map((serie, i) => (
          <circle
            key={i}
            cx={x(serie.length - 1)}
            cy={y(serie[serie.length - 1])}
            r={i === 0 ? 4 : 3}
            fill={STROKES[i]}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-1">
        <span className="mono-label text-foreground/30">J{race.js[0]}</span>
        <span className="mono-label text-foreground/30">J{race.js[race.js.length - 1]}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {race.names.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5 text-[12.5px] font-semibold">
            <span className="size-2 rounded-full" style={{ background: STROKES[i] }} />
            {n}
            <span className="mono-label text-foreground/40 tabular-nums">
              {race.series[i][race.series[i].length - 1]}
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

/** Le pouls de la saison — buts par journée, la dernière en bleu. */
export function PulseModule({ pulse }: { pulse: Analyse["pulse"] }) {
  if (pulse.length < 2) return null;
  const max = Math.max(...pulse.map((p) => p.buts), 1);
  const last = pulse[pulse.length - 1];
  const avg = Math.round(pulse.reduce((s, p) => s + p.buts, 0) / pulse.length);
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Buts par journée</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">
        {last.buts >= max
          ? "Le dimanche le plus prolifique"
          : last.buts > avg
            ? "Un dimanche au-dessus de la moyenne"
            : "Le pouls de la saison"}
      </h2>
      <div className="mt-5 flex items-end gap-2" style={{ height: 96 }}>
        {pulse.map((p) => {
          const active = p.j === last.j;
          return (
            <div key={p.j} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span
                className={cn(
                  "text-[11px] font-bold tabular-nums",
                  active ? "text-primary" : "text-foreground/40"
                )}
              >
                {p.buts}
              </span>
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${Math.max(6, (p.buts / max) * 68)}px`,
                  background: active ? "var(--primary)" : "rgba(255,255,255,0.14)",
                  boxShadow: active ? "0 0 16px rgba(111,168,255,0.45)" : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {pulse.map((p) => (
          <span
            key={p.j}
            className={cn(
              "mono-label flex-1 text-center",
              p.j === last.j ? "text-primary" : "text-foreground/30"
            )}
          >
            J{p.j}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-foreground/40">
        {avg} buts de moyenne par dimanche depuis le début de saison.
      </p>
    </section>
  );
}

/** Le scanner — radar hexagonal d'un joueur contre la moyenne de la ligue. */
export function RadarModule({
  name,
  stats,
  avg,
  ovrValue,
  avgOvr,
}: {
  name: string;
  stats: Player["stats"];
  avg: Player["stats"];
  ovrValue: number;
  avgOvr: number;
}) {
  const CX = 130;
  const CY = 112;
  const R = 76;
  const angle = (i: number) => -Math.PI / 2 + (i * Math.PI) / 3;
  const radius = (v: number) => R * Math.min(1, Math.max(0.08, (v - 30) / 69));
  const pt = (i: number, r: number) =>
    `${(CX + Math.cos(angle(i)) * r).toFixed(1)},${(CY + Math.sin(angle(i)) * r).toFixed(1)}`;
  const ring = (f: number) => STAT_KEYS.map((_, i) => pt(i, R * f)).join(" ");
  const poly = (s: Player["stats"]) =>
    STAT_KEYS.map((k, i) => pt(i, radius(s[k]))).join(" ");
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Sous le capot</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">{name}, au scanner</h2>
      <svg viewBox="0 0 260 224" className="mx-auto mt-2 w-full max-w-[300px]" aria-hidden>
        {[0.33, 0.66, 1].map((f) => (
          <polygon key={f} points={ring(f)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        ))}
        {STAT_KEYS.map((_, i) => (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={CX + Math.cos(angle(i)) * R}
            y2={CY + Math.sin(angle(i)) * R}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}
        <polygon points={poly(avg)} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" />
        <polygon points={poly(stats)} fill="rgba(111,168,255,0.22)" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
        {STAT_KEYS.map((k, i) => {
          const lx = CX + Math.cos(angle(i)) * (R + 22);
          const ly = CY + Math.sin(angle(i)) * (R + 18);
          return (
            <text key={k} x={lx} y={ly} textAnchor="middle">
              <tspan
                x={lx}
                dy="-2"
                style={{ fontFamily: "var(--font-jbmono)", fontSize: 9, letterSpacing: 2 }}
                fill="rgba(255,255,255,0.4)"
              >
                {k}
              </tspan>
              <tspan x={lx} dy="12" style={{ fontSize: 12, fontWeight: 700 }} fill="#fff">
                {stats[k]}
              </tspan>
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center justify-center gap-4">
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          <span className="size-2 rounded-full bg-primary" /> {name} · GÉN {ovrValue}
        </span>
        <span className="flex items-center gap-1.5 text-[12.5px] text-foreground/50">
          <span className="size-2 rounded-full bg-foreground/30" /> Ligue · GÉN {avgOvr}
        </span>
      </div>
    </section>
  );
}

/** Les paliers de carrière — franchis ce dimanche, ou tout proches. */
export function MilestonesModule({ milestones }: { milestones: Analyse["milestones"] }) {
  if (milestones.length === 0) return null;
  const crossed = milestones.find((m) => m.crossed);
  return (
    <section>
      <div className="mb-3 px-1">
        <p className="mono-label text-primary">Paliers de carrière</p>
        <h2 className="mt-0.5 text-xl font-bold tracking-tight">
          {crossed
            ? `${crossed.name} passe les ${crossed.target} ${crossed.label}`
            : "Les caps qui approchent"}
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {milestones.map((m) => (
          <div
            key={`${m.name}-${m.label}-${m.target}`}
            className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3"
          >
            <Avatar name={m.name} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[14px] font-semibold">{m.name}</span>
                <span className="mono-label text-foreground/40 tabular-nums">
                  {m.crossed ? `${m.current} ${m.label}` : `${m.current}/${m.target} ${m.label}`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div
                  className={cn("h-full rounded-full", m.crossed ? "bg-primary" : "bg-foreground/35")}
                  style={{ width: `${Math.min(100, Math.round((m.current / m.target) * 100))}%` }}
                />
              </div>
            </div>
            {m.crossed && (
              <span className="mono-label shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-primary">
                Franchi
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Les fidèles — grille de présence des plus assidus, dimanche par dimanche. */
export function FidelesModule({ fideles }: { fideles: Analyse["fideles"] }) {
  if (fideles.rows.length === 0 || fideles.js.length < 2) return null;
  const lastIdx = fideles.js.length - 1;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Assiduité</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">Les fidèles du dimanche</h2>
      <div className="mt-4 flex flex-col gap-2.5">
        {fideles.rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2.5">
            <span className="w-[72px] truncate text-[13px] font-semibold">{r.name}</span>
            <div className="flex flex-1 justify-between gap-1">
              {r.cells.map((on, i) => (
                <span
                  key={i}
                  className="size-[9px] rounded-full"
                  style={{
                    background: on
                      ? i === lastIdx
                        ? "var(--primary)"
                        : "rgba(255,255,255,0.8)"
                      : "rgba(255,255,255,0.1)",
                    boxShadow: on && i === lastIdx ? "0 0 8px rgba(111,168,255,0.6)" : undefined,
                  }}
                />
              ))}
            </div>
            <span className="mono-label w-9 text-right text-foreground/40 tabular-nums">
              {r.count}/{fideles.js.length}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2.5">
        <span className="w-[72px]" />
        <div className="flex flex-1 justify-between gap-1">
          {fideles.js.map((j) => (
            <span key={j} className="mono-label w-[9px] text-center text-[8px] text-foreground/25">
              {j}
            </span>
          ))}
        </div>
        <span className="w-9" />
      </div>
    </section>
  );
}

/** Le bilan des couleurs — V/N/D des équipes sur la saison. */
export function CouleursModule({ couleurs }: { couleurs: Analyse["couleurs"] }) {
  if (couleurs.length < 2) return null;
  const leader = couleurs[0];
  return (
    <section>
      <div className="mb-3 px-1">
        <p className="mono-label text-primary">Depuis le début de saison</p>
        <h2 className="mt-0.5 text-xl font-bold tracking-tight">
          {/^[AEIOUY]/i.test(leader.team) ? `L'${leader.team}` : `Le ${leader.team}`}, patron des
          couleurs
        </h2>
      </div>
      <div className="glass-soft flex flex-col gap-3 rounded-3xl p-4">
        {couleurs.map((c) => (
          <div key={c.team} className="flex items-center gap-3">
            <span className="w-[64px] truncate text-[13px] font-semibold">{c.team}</span>
            <div className="flex h-2 flex-1 gap-[3px] overflow-hidden">
              {c.v > 0 && (
                <span
                  className="rounded-full bg-primary"
                  style={{ flexGrow: c.v, flexBasis: 0 }}
                />
              )}
              {c.n > 0 && (
                <span
                  className="rounded-full bg-foreground/30"
                  style={{ flexGrow: c.n, flexBasis: 0 }}
                />
              )}
              {c.d > 0 && (
                <span
                  className="rounded-full bg-foreground/10"
                  style={{ flexGrow: c.d, flexBasis: 0 }}
                />
              )}
            </div>
            <span className="mono-label w-[72px] shrink-0 text-right text-foreground/40 tabular-nums">
              {c.v}V {c.n}N {c.d}D
            </span>
          </div>
        ))}
        <p className="mono-label mt-1 flex items-center gap-3 text-foreground/30">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" /> Victoires
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-foreground/30" /> Nuls
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-foreground/10" /> Défaites
          </span>
        </p>
      </div>
    </section>
  );
}

/** Le livre des records — les meilleures perfs de la saison sur un dimanche. */
export function RecordsModule({ records }: { records: Analyse["records"] }) {
  if (records.length === 0) return null;
  return (
    <section>
      <div className="mb-3 px-1">
        <p className="mono-label text-primary">Le livre des records</p>
        <h2 className="mt-0.5 text-xl font-bold tracking-tight">Les records de la saison</h2>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {records.map((r) => (
          <div key={r.label} className="glass rounded-3xl p-4">
            <p className={cn("mono-label", r.fresh ? "text-primary" : "text-muted-foreground")}>
              {r.label}
            </p>
            <div className="mt-1 text-2xl font-bold tabular-nums">{r.value}</div>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              {r.sub}
              {r.fresh && <span className="text-primary"> · ce dimanche</span>}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Les mouvements au classement de la journée. */
export function MouvementsModule({ mouvements }: { mouvements: Analyse["mouvements"] }) {
  if (mouvements.length === 0) return null;
  return (
    <section>
      <div className="mb-3 px-1">
        <p className="mono-label text-primary">Classement</p>
        <h2 className="mt-0.5 text-xl font-bold tracking-tight">Ils ont bougé</h2>
      </div>
      <div className="flex flex-col gap-2">
        {mouvements.map((m) => (
          <div key={m.name} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <TrendingUp className="size-3.5" />
            </span>
            <Avatar name={m.name} size={26} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{m.name}</span>
            <span className="mono-label text-muted-foreground">
              {m.from}e → {m.to}e
            </span>
            <span className="mono-label rounded-full bg-primary/15 px-2 py-1 text-primary">
              ▲ {m.up}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Les séries de buteurs en cours — avec la carte du joueur en forme. */
export function FormeModule({
  forme,
  card,
}: {
  forme: Analyse["forme"];
  card?: ReactNode;
}) {
  if (forme.length === 0) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">En forme</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">
        {forme[0].name} marque depuis {forme[0].streak} journées
      </h2>
      <div className={cn("mt-3", card && "flex items-center gap-4")}>
        {card && <div className="shrink-0">{card}</div>}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {forme.map((f) => (
            <div key={f.name} className="flex items-center gap-2.5">
              <Avatar name={f.name} size={26} />
              <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
                <span className="font-semibold text-foreground">{f.name}</span> — {f.goals} buts
                sur ses {f.streak} dernières journées
              </p>
              <span className="flex gap-1">
                {Array.from({ length: Math.min(f.streak, 6) }, (_, i) => (
                  <span key={i} className="size-1.5 rounded-full bg-primary" />
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Les cadors qui manquaient à l'appel. */
export function AbsentsModule({ absents }: { absents: Analyse["absents"] }) {
  if (absents.length === 0) return null;
  return (
    <section>
      <div className="mb-3 px-1">
        <p className="mono-label text-muted-foreground">Ils manquaient à l&apos;appel</p>
        <h2 className="mt-0.5 text-xl font-bold tracking-tight">
          Le top 10 n&apos;était pas au complet
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {absents.map((a) => (
          <span
            key={a.name}
            className="flex items-center gap-2 rounded-full bg-card px-3 py-2 text-[13px] font-semibold"
          >
            <Avatar name={a.name} size={22} />
            {a.name}
            <span className="mono-label text-muted-foreground">{a.rank}e</span>
          </span>
        ))}
      </div>
    </section>
  );
}
