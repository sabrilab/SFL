"use client";

// Analyse de journée — le moteur narratif du récap.
//
// Tout est calculé en comparant la saison AVANT la journée (classement
// recalculé sans ses lignes) et APRÈS : mouvements au classement, course au
// Pépite d'Or, séries de buteurs en cours, absents marquants, et une réserve
// de « stats qui piquent » injectée dans le bento des chiffres. Chaque module
// ne s'affiche que si la journée a réellement produit la donnée — le récap
// varie donc d'une semaine à l'autre.

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import {
  rankPlayers,
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
}

export function useAnalyse(
  saison: Saison,
  players: Player[],
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
    const afterMap = new Map(rAfter.map((p) => [p.name, p]));
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

    void afterMap;
    return { course, mouvements, forme, absents, insolites: insolites.slice(0, 4) };
  }, [saison, players, lastJ]);
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

/** La course au Pépite d'Or — barres de course + gains de la journée. */
export function CourseModule({ course }: { course: Analyse["course"] }) {
  if (!course) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">La course au Pépite d&apos;Or</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">{course.headline}</h2>
      <div className="mt-4 flex flex-col gap-2.5">
        {course.top.map((p, i) => (
          <div key={p.name} className="flex items-center gap-2.5">
            <span className="w-4 text-center text-[12px] font-bold text-muted-foreground">
              {i + 1}
            </span>
            <Avatar name={p.name} size={26} />
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

/** Les séries de buteurs en cours. */
export function FormeModule({ forme }: { forme: Analyse["forme"] }) {
  if (forme.length === 0) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">En forme</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">
        {forme[0].name} marque depuis {forme[0].streak} journées
      </h2>
      <div className="mt-3 flex flex-col gap-2.5">
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
