"use client";

// Analyse avancée — la seconde couche du récap.
//
// Tout est dérivé des lignes de saisie et des feuilles de match : rien n'est
// écrit à la main. Comme pour analyse.tsx, chaque bloc renvoie `null` quand la
// donnée n'existe pas, et le module correspondant disparaît du fil.
//
// Les modules minutés (timeline, tournant) attendent `saison.events` : tant que
// le classeur ne porte pas les minutes des buts, ils restent masqués.

import { useMemo } from "react";
import {
  ovr,
  rankPlayers,
  STAT_KEYS,
  type Journee,
  type Player,
  type StatKey,
} from "@/lib/sfl/engine";
import { computeStandings, entryPP } from "@/lib/sfl/saisie/engine";
import type { MatchEntry, MatchEvent, Saison } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

/* ============================== Types ============================== */

export interface AnalysePlus {
  /** 1 · buts minutés de la journée, s'ils existent. */
  timeline: { minute: number; team: string; player: string; passeur?: string; scoreA: number; scoreB: number; teamA: string; teamB: string }[] | null;
  /** 2 · le run décisif du match, déduit des minutes. */
  tournant: { team: string; from: string; to: string; runs: number; window: string } | null;
  /** 3 · les joueurs dont la présence change le résultat. */
  facteurX: { name: string; winRate: number; diff: number; matchs: number }[];
  /** 4 · les paires qui gagnent ensemble. */
  paires: { a: string; b: string; games: number; wins: number; rate: number }[];
  /** 5 · l'adversaire qui te fait le plus mal. */
  beteNoire: { name: string; faced: number; lost: number } | null;
  /** 6 · discipline de la journée et de la saison. */
  fairplay: { retards: string[]; cleanSheets: string[]; exemplaires: { name: string; matchs: number }[] } | null;
  /** 7 · ton dimanche. */
  monDimanche: {
    played: boolean;
    buts: number;
    passes: number;
    pp: number;
    result: string | null;
    titres: string[];
    rankFrom: number | null;
    rankTo: number;
    best: StatKey;
    worst: StatKey;
  } | null;
  /** 8 · où tu finis si tu gardes ce rythme. */
  projection: { pp: number; rank: number; horizon: number; ppNow: number; rankNow: number } | null;
  /** 9 · record personnel battu ce dimanche. */
  recordPerso: { label: string; value: string; previous: string } | null;
  /** 10 · ton jumeau statistique. */
  jumeau: { name: string; distance: number; stats: Player["stats"]; ovr: number } | null;
  /** 11 · l'évolution de ta carte, journée après journée. */
  evolution: { js: number[]; ovrs: number[]; gains: { key: StatKey; delta: number }[] } | null;
  /** 12 · le mercato imaginaire. */
  mercato: { name: string; value: number; delta: number }[];
  /** 13 · le cinq de la saison. */
  cinq: { name: string; pp: number; ovr: number; poste: string }[];
  /** 14 · l'historique des affiches entre couleurs. */
  affiches: { a: string; b: string; winsA: number; winsB: number; nuls: number; total: number }[];
  /** 15 · toutes les séries en cours. */
  series: { kind: string; name: string; count: number; unit: string }[];
  /** 16 · la météo de la ligue. */
  meteo: { butsParMatch: number; butsRef: number; ecart: number; ecartRef: number; nuls: number } | null;
  /** 19 · la phrase du dimanche. */
  citation: { text: string; author: string } | null;
  /** 20 · le classement alternatif de la semaine. */
  alternatif: { title: string; sub: string; unit: string; top: { name: string; value: string }[] } | null;
}

/* ============================ Calculs ============================ */

const POSTE_LABEL = (p: string) => p.split("/")[0].toUpperCase();

export function useAnalysePlus(
  saison: Saison,
  players: Player[],
  journees: Journee[],
  lastJ: Journee,
  me: string
): AnalysePlus {
  return useMemo(() => {
    const j = lastJ.j;
    const matches = lastJ.matches ?? [];
    const present = (e: MatchEntry) => e.statut === "Présent" && !e.extraTime;
    const allEntries = saison.entries.filter(present);
    const jEntries = allEntries.filter((e) => e.j === j);
    const byName = new Map(players.map((p) => [p.name, p]));
    const ranked = rankPlayers(players);
    const rankOf = new Map(ranked.map((p) => [p.name, p.rank]));
    const playedJs = journees.filter((x) => (x.matches ?? []).length > 0).map((x) => x.j);

    /* --- 1 · Timeline minutée ------------------------------------ */
    const events = (saison.events ?? []).filter((e: MatchEvent) => e.j === j);
    let timeline: AnalysePlus["timeline"] = null;
    let tournant: AnalysePlus["tournant"] = null;
    const big = [...matches].sort(
      (a, b) => b.teamA.score + b.teamB.score - (a.teamA.score + a.teamB.score)
    )[0];
    if (events.length > 0 && big) {
      const own = events
        .filter((e) => !e.matchId || e.matchId === big.id)
        .sort((a, b) => a.minute - b.minute);
      // Score courant accumulé au fil des buts (reduce plutôt qu'un compteur
      // muté depuis une closure : le rendu reste purement fonctionnel).
      timeline = own.reduce<NonNullable<AnalysePlus["timeline"]>>((acc, e) => {
        const prev = acc[acc.length - 1];
        const home = e.team === big.teamA.name;
        acc.push({
          minute: e.minute,
          team: e.team,
          player: e.player,
          passeur: e.passeur,
          scoreA: (prev?.scoreA ?? 0) + (home ? 1 : 0),
          scoreB: (prev?.scoreB ?? 0) + (home ? 0 : 1),
          teamA: big.teamA.name,
          teamB: big.teamB.name,
        });
        return acc;
      }, []);

      /* --- 2 · Le tournant : la plus longue série d'une équipe ----- */
      let bestRun = { team: "", start: 0, len: 0 };
      let curTeam = "";
      let curStart = 0;
      let curLen = 0;
      own.forEach((e, i) => {
        if (e.team === curTeam) curLen += 1;
        else {
          curTeam = e.team;
          curStart = i;
          curLen = 1;
        }
        if (curLen > bestRun.len) bestRun = { team: curTeam, start: curStart, len: curLen };
      });
      if (bestRun.len >= 3) {
        const before = timeline[bestRun.start - 1];
        const after = timeline[bestRun.start + bestRun.len - 1];
        tournant = {
          team: bestRun.team,
          from: before ? `${before.scoreA}–${before.scoreB}` : "0–0",
          to: `${after.scoreA}–${after.scoreB}`,
          runs: bestRun.len,
          window: `${own[bestRun.start].minute}′ → ${own[bestRun.start + bestRun.len - 1].minute}′`,
        };
      }
    }

    /* --- 3 · Le facteur X ---------------------------------------- */
    const withResult = allEntries.filter((e) => e.result);
    const leagueWinRate =
      withResult.length > 0
        ? withResult.filter((e) => e.result === "Victoire").length / withResult.length
        : 0;
    const perPlayer = new Map<string, { v: number; n: number }>();
    for (const e of withResult) {
      const cur = perPlayer.get(e.player) ?? { v: 0, n: 0 };
      cur.n += 1;
      if (e.result === "Victoire") cur.v += 1;
      perPlayer.set(e.player, cur);
    }
    const facteurX = [...perPlayer.entries()]
      .filter(([, s]) => s.n >= 3)
      .map(([name, s]) => ({
        name,
        matchs: s.n,
        winRate: Math.round((s.v / s.n) * 100),
        diff: Math.round((s.v / s.n - leagueWinRate) * 100),
      }))
      .sort((a, b) => b.diff - a.diff || b.matchs - a.matchs)
      .slice(0, 3);

    /* --- 4 · Les paires qui gagnent ensemble --------------------- */
    const pairStats = new Map<string, { games: number; wins: number }>();
    const byJTeam = new Map<string, MatchEntry[]>();
    for (const e of withResult) {
      if (!e.team) continue;
      const k = `${e.j}|${e.team}`;
      byJTeam.set(k, [...(byJTeam.get(k) ?? []), e]);
    }
    for (const list of byJTeam.values()) {
      const names = [...new Set(list.map((e) => e.player))].sort();
      const win = list[0].result === "Victoire";
      for (let a = 0; a < names.length; a++)
        for (let b = a + 1; b < names.length; b++) {
          const k = `${names[a]}|${names[b]}`;
          const cur = pairStats.get(k) ?? { games: 0, wins: 0 };
          cur.games += 1;
          if (win) cur.wins += 1;
          pairStats.set(k, cur);
        }
    }
    const paires = [...pairStats.entries()]
      .filter(([, s]) => s.games >= 3)
      .map(([k, s]) => {
        const [a, b] = k.split("|");
        return { a, b, games: s.games, wins: s.wins, rate: Math.round((s.wins / s.games) * 100) };
      })
      .sort((x, y) => y.rate - x.rate || y.games - x.games)
      .slice(0, 3);

    /* --- 5 · La bête noire (personnalisée) ----------------------- */
    const faced = new Map<string, { faced: number; lost: number }>();
    for (const jn of journees)
      for (const m of jn.matches ?? []) {
        const inA = m.teamA.players.some((p) => p.name === me);
        const inB = m.teamB.players.some((p) => p.name === me);
        if (!inA && !inB) continue;
        const mine = inA ? m.teamA : m.teamB;
        const foe = inA ? m.teamB : m.teamA;
        const lost = mine.score < foe.score;
        for (const p of foe.players) {
          const cur = faced.get(p.name) ?? { faced: 0, lost: 0 };
          cur.faced += 1;
          if (lost) cur.lost += 1;
          faced.set(p.name, cur);
        }
      }
    const beteNoire =
      [...faced.entries()]
        .filter(([, s]) => s.faced >= 2 && s.lost >= 2)
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.lost - a.lost || b.faced - a.faced)[0] ?? null;

    /* --- 6 · Le fair-play ---------------------------------------- */
    const retards = jEntries.filter((e) => e.retard).map((e) => e.player);
    const cleanSheets = jEntries.filter((e) => e.cleanSheet).map((e) => e.player);
    const retardCount = new Map<string, number>();
    for (const e of allEntries) if (e.retard) retardCount.set(e.player, (retardCount.get(e.player) ?? 0) + 1);
    const exemplaires = players
      .filter((p) => p.matchs >= 4 && !retardCount.has(p.name))
      .sort((a, b) => b.matchs - a.matchs)
      .slice(0, 3)
      .map((p) => ({ name: p.name, matchs: p.matchs }));
    const fairplay =
      retards.length > 0 || cleanSheets.length > 0 || exemplaires.length > 0
        ? { retards, cleanSheets, exemplaires }
        : null;

    /* --- 7 · Ton dimanche ---------------------------------------- */
    const mineJ = jEntries.filter((e) => e.player === me);
    const myPlayer = byName.get(me);
    let monDimanche: AnalysePlus["monDimanche"] = null;
    if (myPlayer) {
      const beforeRank = rankPlayers(
        computeStandings({ ...saison, entries: saison.entries.filter((e) => e.j !== j) })
      ).find((p) => p.name === me)?.rank;
      const s = myPlayer.stats;
      monDimanche = {
        played: mineJ.length > 0,
        buts: mineJ.reduce((t, e) => t + e.buts, 0),
        passes: mineJ.reduce((t, e) => t + e.passes, 0),
        pp: mineJ.reduce((t, e) => t + entryPP(e), 0),
        result: mineJ[0]?.result ?? null,
        titres: [
          mineJ.some((e) => e.mvp) && "MVP",
          mineJ.some((e) => e.impact) && "Impact",
          mineJ.some((e) => e.def) && "Défensive",
        ].filter(Boolean) as string[],
        rankFrom: beforeRank ?? null,
        rankTo: rankOf.get(me) ?? ranked.length,
        best: STAT_KEYS.reduce((a, k) => (s[k] > s[a] ? k : a), STAT_KEYS[0]),
        worst: STAT_KEYS.reduce((a, k) => (s[k] < s[a] ? k : a), STAT_KEYS[0]),
      };
    }

    /* --- 8 · La projection --------------------------------------- */
    const HORIZON = 4;
    let projection: AnalysePlus["projection"] = null;
    if (myPlayer && myPlayer.matchs >= 2) {
      const projected = players.map((p) => ({
        name: p.name,
        pp: p.matchs > 0 ? Math.round(p.pp + (p.pp / p.matchs) * HORIZON) : p.pp,
      }));
      projected.sort((a, b) => b.pp - a.pp);
      const idx = projected.findIndex((p) => p.name === me);
      projection = {
        pp: projected[idx]?.pp ?? myPlayer.pp,
        rank: idx + 1,
        horizon: HORIZON,
        ppNow: myPlayer.pp,
        rankNow: rankOf.get(me) ?? ranked.length,
      };
    }

    /* --- 9 · Ton record personnel -------------------------------- */
    const myByJ = new Map<number, { pp: number; buts: number }>();
    for (const e of allEntries.filter((x) => x.player === me)) {
      const cur = myByJ.get(e.j) ?? { pp: 0, buts: 0 };
      cur.pp += entryPP(e);
      cur.buts += e.buts;
      myByJ.set(e.j, cur);
    }
    const mineNow = myByJ.get(j);
    let recordPerso: AnalysePlus["recordPerso"] = null;
    if (mineNow) {
      const others = [...myByJ.entries()].filter(([jj]) => jj !== j);
      const prevPP = Math.max(0, ...others.map(([, v]) => v.pp));
      const prevButs = Math.max(0, ...others.map(([, v]) => v.buts));
      if (others.length > 0 && mineNow.pp > prevPP)
        recordPerso = {
          label: "Ton meilleur total de points",
          value: `+${mineNow.pp} PP`,
          previous: `ancien record : +${prevPP} PP`,
        };
      else if (others.length > 0 && mineNow.buts > prevButs && mineNow.buts > 0)
        recordPerso = {
          label: "Ton meilleur total de buts",
          value: `${mineNow.buts} buts`,
          previous: `ancien record : ${prevButs}`,
        };
    }

    /* --- 10 · Ton jumeau statistique ----------------------------- */
    let jumeau: AnalysePlus["jumeau"] = null;
    if (myPlayer) {
      const candidates = players.filter((p) => p.name !== me && p.matchs > 0);
      const dist = (p: Player) =>
        Math.sqrt(STAT_KEYS.reduce((t, k) => t + (p.stats[k] - myPlayer.stats[k]) ** 2, 0));
      const twin = candidates.sort((a, b) => dist(a) - dist(b))[0];
      if (twin)
        jumeau = {
          name: twin.name,
          distance: Math.round(dist(twin)),
          stats: twin.stats,
          ovr: ovr(twin.stats),
        };
    }

    /* --- 11 · L'évolution de ta carte ---------------------------- */
    let evolution: AnalysePlus["evolution"] = null;
    if (myPlayer && playedJs.length >= 2) {
      const snaps = playedJs.map((jj) =>
        computeStandings({ ...saison, entries: saison.entries.filter((e) => e.j <= jj) }).find(
          (p) => p.name === me
        )
      );
      const valid = snaps.map((p, i) => ({ p, jj: playedJs[i] })).filter((x) => !!x.p);
      if (valid.length >= 2) {
        const first = valid[0].p!.stats;
        const last = valid[valid.length - 1].p!.stats;
        evolution = {
          js: valid.map((x) => x.jj),
          ovrs: valid.map((x) => ovr(x.p!.stats)),
          gains: STAT_KEYS.map((k) => ({ key: k, delta: last[k] - first[k] }))
            .filter((g) => g.delta !== 0)
            .sort((a, b) => b.delta - a.delta)
            .slice(0, 3),
        };
      }
    }

    /* --- 12 · Le mercato imaginaire ------------------------------ */
    // Valeur de marché : la note pèse le plus, la production récente ensuite.
    const marketValue = (p: Player) =>
      Math.max(0, Math.round((ovr(p.stats) - 60) * 120 + p.pp * 45 + p.buts * 18 + p.passes * 12));
    const beforeStandings = computeStandings({
      ...saison,
      entries: saison.entries.filter((e) => e.j !== j),
    });
    const beforeVal = new Map(beforeStandings.map((p) => [p.name, marketValue(p)]));
    const mercato = players
      .filter((p) => p.matchs > 0)
      .map((p) => ({
        name: p.name,
        value: marketValue(p),
        delta: marketValue(p) - (beforeVal.get(p.name) ?? marketValue(p)),
      }))
      .filter((m) => m.delta !== 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5);

    /* --- 13 · Le cinq de la saison ------------------------------- */
    const cinq = ranked
      .filter((p) => p.matchs > 0)
      .slice(0, 5)
      .map((p) => ({ name: p.name, pp: p.pp, ovr: ovr(p.stats), poste: POSTE_LABEL(p.poste) }));

    /* --- 14 · Les affiches --------------------------------------- */
    const h2h = new Map<string, { a: string; b: string; winsA: number; winsB: number; nuls: number }>();
    for (const jn of journees)
      for (const m of jn.matches ?? []) {
        const [x, y] = [m.teamA.name, m.teamB.name].sort();
        const k = `${x}|${y}`;
        const cur = h2h.get(k) ?? { a: x, b: y, winsA: 0, winsB: 0, nuls: 0 };
        const scoreX = m.teamA.name === x ? m.teamA.score : m.teamB.score;
        const scoreY = m.teamA.name === x ? m.teamB.score : m.teamA.score;
        if (scoreX > scoreY) cur.winsA += 1;
        else if (scoreY > scoreX) cur.winsB += 1;
        else cur.nuls += 1;
        h2h.set(k, cur);
      }
    const affiches = [...h2h.values()]
      .map((v) => ({ ...v, total: v.winsA + v.winsB + v.nuls }))
      .filter((v) => v.total >= 2)
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);

    /* --- 15 · Le mur des séries ---------------------------------- */
    const streakOf = (pred: (e: MatchEntry) => boolean, name: string) => {
      let n = 0;
      for (let i = playedJs.length - 1; i >= 0; i--) {
        const jj = playedJs[i];
        const rows = allEntries.filter((e) => e.player === name && e.j === jj);
        if (rows.length > 0 && rows.some(pred)) n += 1;
        else break;
      }
      return n;
    };
    const names = players.filter((p) => p.matchs > 0).map((p) => p.name);
    const bestStreak = (pred: (e: MatchEntry) => boolean, kind: string, unit: string) => {
      const top = names
        .map((n) => ({ name: n, count: streakOf(pred, n) }))
        .sort((a, b) => b.count - a.count)[0];
      return top && top.count >= 2 ? { kind, name: top.name, count: top.count, unit } : null;
    };
    const series = [
      bestStreak((e) => e.buts > 0, "Buteur", "journées"),
      bestStreak((e) => e.result === "Victoire", "Invaincu", "victoires"),
      bestStreak(() => true, "Présent", "dimanches"),
    ].filter(Boolean) as AnalysePlus["series"];

    /* --- 16 · La météo de la ligue ------------------------------- */
    let meteo: AnalysePlus["meteo"] = null;
    const allMatches = journees.flatMap((x) => x.matches ?? []);
    if (matches.length > 0 && allMatches.length > matches.length) {
      const gpm = (list: typeof allMatches) =>
        list.reduce((s, m) => s + m.teamA.score + m.teamB.score, 0) / Math.max(1, list.length);
      const gap = (list: typeof allMatches) =>
        list.reduce((s, m) => s + Math.abs(m.teamA.score - m.teamB.score), 0) /
        Math.max(1, list.length);
      meteo = {
        butsParMatch: Math.round(gpm(matches) * 10) / 10,
        butsRef: Math.round(gpm(allMatches) * 10) / 10,
        ecart: Math.round(gap(matches) * 10) / 10,
        ecartRef: Math.round(gap(allMatches) * 10) / 10,
        nuls: allMatches.filter((m) => m.teamA.score === m.teamB.score).length,
      };
    }

    /* --- 19 · La phrase du dimanche ------------------------------ */
    let citation: AnalysePlus["citation"] = null;
    const cruel = [...jEntries]
      .filter((e) => e.result === "Défaite" && e.buts >= 3)
      .sort((a, b) => b.buts - a.buts)[0];
    const mvpRow = jEntries.find((e) => e.mvp);
    const bigScorer = [...jEntries].sort((a, b) => b.buts - a.buts)[0];
    if (cruel)
      citation = {
        text: `${cruel.buts} buts et pourtant une défaite : dimanche cruel pour ${cruel.player}.`,
        author: `J${j} · ${lastJ.date}`,
      };
    else if (mvpRow)
      citation = {
        text: `${mvpRow.player} a pris le match par la main — ${mvpRow.buts} but${mvpRow.buts > 1 ? "s" : ""}, ${mvpRow.passes} passe${mvpRow.passes > 1 ? "s" : ""}, et le titre de MVP.`,
        author: `J${j} · ${lastJ.date}`,
      };
    else if (bigScorer && bigScorer.buts > 0)
      citation = {
        text: `${bigScorer.player} a fait parler la poudre : ${bigScorer.buts} but${bigScorer.buts > 1 ? "s" : ""} sur un seul dimanche.`,
        author: `J${j} · ${lastJ.date}`,
      };

    /* --- 20 · Le classement alternatif de la semaine ------------- */
    const ppByPlayerJ = new Map<string, number[]>();
    for (const e of allEntries) {
      ppByPlayerJ.set(e.player, [...(ppByPlayerJ.get(e.player) ?? []), entryPP(e)]);
    }
    const eligible = players.filter((p) => p.matchs >= 3);
    const variants: AnalysePlus["alternatif"][] = [
      {
        title: "Le plus régulier",
        sub: "Le plus faible écart entre ses journées",
        unit: "d'écart",
        top: eligible
          .map((p) => {
            const xs = ppByPlayerJ.get(p.name) ?? [];
            const avg = xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);
            const sd = Math.sqrt(
              xs.reduce((s, v) => s + (v - avg) ** 2, 0) / Math.max(1, xs.length)
            );
            return { name: p.name, n: sd };
          })
          .sort((a, b) => a.n - b.n)
          .slice(0, 3)
          .map((x) => ({ name: x.name, value: x.n.toFixed(1) })),
      },
      {
        title: "Le plus explosif",
        sub: "Le plus gros pic sur une seule journée",
        unit: "PP au pic",
        top: eligible
          .map((p) => ({ name: p.name, n: Math.max(0, ...(ppByPlayerJ.get(p.name) ?? [0])) }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 3)
          .map((x) => ({ name: x.name, value: `${x.n}` })),
      },
      {
        title: "Le plus altruiste",
        sub: "Le plus de passes pour un but marqué",
        unit: "passes / but",
        top: eligible
          .filter((p) => p.passes > 0)
          .map((p) => ({ name: p.name, n: p.passes / Math.max(1, p.buts) }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 3)
          .map((x) => ({ name: x.name, value: x.n.toFixed(1) })),
      },
      {
        title: "Le plus efficace",
        sub: "Le plus de points marqués par dimanche joué",
        unit: "PP / match",
        top: eligible
          .map((p) => ({ name: p.name, n: p.pp / Math.max(1, p.matchs) }))
          .sort((a, b) => b.n - a.n)
          .slice(0, 3)
          .map((x) => ({ name: x.name, value: x.n.toFixed(1) })),
      },
    ];
    // Une variante par journée, en rotation : le classement change chaque semaine.
    const alternatif = eligible.length >= 3 ? variants[j % variants.length] : null;

    return {
      timeline,
      tournant,
      facteurX,
      paires,
      beteNoire,
      fairplay,
      monDimanche,
      projection,
      recordPerso,
      jumeau,
      evolution,
      mercato,
      cinq,
      affiches,
      series,
      meteo,
      citation,
      alternatif,
    };
  }, [saison, players, journees, lastJ, me]);
}

/* ============================ Modules ============================ */

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

function Head({ label, title }: { label: string; title: string }) {
  return (
    <div className="mb-3 px-1">
      <p className="mono-label text-primary">{label}</p>
      <h2 className="mt-0.5 text-xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

/** 1 · La minute par minute. */
export function TimelineModule({ timeline }: { timeline: AnalysePlus["timeline"] }) {
  if (!timeline || timeline.length === 0) return null;
  const teamA = timeline[0].teamA;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Minute par minute</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">Comment le match s&apos;est joué</h2>
      <div className="relative mt-4 pl-[86px]">
        <span className="absolute top-1 bottom-1 left-[62px] w-px bg-white/10" />
        <div className="flex flex-col gap-3.5">
          {timeline.map((e, i) => {
            const home = e.team === teamA;
            return (
              <div key={i} className="relative">
                <span className="mono-label absolute top-0.5 -left-[86px] w-[34px] text-right text-foreground/40">
                  {e.minute}′
                </span>
                <span
                  className="absolute top-1 -left-[28px] size-2.5 rounded-full"
                  style={{
                    background: home ? "var(--primary)" : "rgba(255,255,255,0.5)",
                    boxShadow: home ? "0 0 8px rgba(111,168,255,0.6)" : undefined,
                  }}
                />
                <span className="mono-label absolute top-0.5 -left-[40px] hidden">·</span>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[14px] font-semibold">
                    {e.player}
                    {e.passeur && (
                      <span className="font-normal text-foreground/40"> · s/ {e.passeur}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums">
                    {e.scoreA}–{e.scoreB}
                  </span>
                </div>
                <span className="mono-label text-foreground/35">{e.team}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** 2 · Le tournant du match. */
export function TournantModule({ tournant }: { tournant: AnalysePlus["tournant"] }) {
  if (!tournant) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Le tournant</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">
        {tournant.runs} buts d&apos;affilée pour le {tournant.team}
      </h2>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-[22px] font-extrabold tracking-tight tabular-nums text-foreground/40">
          {tournant.from}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-primary" />
        <span className="text-[22px] font-extrabold tracking-tight tabular-nums text-primary">
          {tournant.to}
        </span>
      </div>
      <p className="mt-2.5 text-[12.5px] text-foreground/45">
        Entre la {tournant.window}, le match a basculé.
      </p>
    </section>
  );
}

/** 3 · Le facteur X. */
export function FacteurXModule({ facteurX }: { facteurX: AnalysePlus["facteurX"] }) {
  if (facteurX.length === 0 || facteurX[0].diff <= 0) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Le facteur X</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">
        Son équipe gagne quand {facteurX[0].name} est là
      </h2>
      <div className="mt-4 flex flex-col gap-3">
        {facteurX.map((f) => (
          <div key={f.name} className="flex items-center gap-3">
            <Avatar name={f.name} size={26} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{f.name}</span>
            <div className="h-1.5 w-[84px] overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-primary" style={{ width: `${f.winRate}%` }} />
            </div>
            <span className="w-9 text-right text-[13px] font-bold tabular-nums">{f.winRate}%</span>
            <span className="mono-label w-8 text-right text-primary">+{f.diff}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-foreground/40">
        Taux de victoire personnel, comparé à la moyenne de la ligue.
      </p>
    </section>
  );
}

/** 4 · Ils ne perdent jamais ensemble. */
export function PairesModule({ paires }: { paires: AnalysePlus["paires"] }) {
  if (paires.length === 0) return null;
  return (
    <section>
      <Head label="Alchimie" title="Ils ne perdent jamais ensemble" />
      <div className="flex flex-col gap-2">
        {paires.map((p) => (
          <div key={`${p.a}-${p.b}`} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
            <span className="flex -space-x-2">
              <Avatar name={p.a} size={28} />
              <Avatar name={p.b} size={28} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
              {p.a} &amp; {p.b}
            </span>
            <span className="mono-label text-foreground/40">
              {p.wins}/{p.games}
            </span>
            <span className="mono-label rounded-full bg-primary/15 px-2.5 py-1 text-primary">
              {p.rate}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 5 · La bête noire. */
export function BeteNoireModule({ beteNoire, me }: { beteNoire: AnalysePlus["beteNoire"]; me: string }) {
  if (!beteNoire) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Ta bête noire</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">{beteNoire.name} te réussit mal</h2>
      <div className="mt-4 flex items-center gap-3.5">
        <Avatar name={beteNoire.name} size={40} />
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-foreground/50">
          Tu l&apos;as croisé <span className="font-semibold text-foreground">{beteNoire.faced} fois</span> en
          face — et tu es reparti battu{" "}
          <span className="font-semibold text-foreground">{beteNoire.lost} fois</span>.
        </p>
        <span className="mono-label shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-primary">
          {Math.round((beteNoire.lost / beteNoire.faced) * 100)}%
        </span>
      </div>
      <p className="mt-3 text-[12px] text-foreground/35">Calculé sur les matchs de {me}.</p>
    </section>
  );
}

/** 6 · Le fair-play. */
export function FairplayModule({ fairplay }: { fairplay: AnalysePlus["fairplay"] }) {
  if (!fairplay) return null;
  return (
    <section>
      <Head label="Fair-play" title="La discipline du dimanche" />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="glass rounded-3xl p-4">
          <p className="mono-label text-foreground/40">Retards</p>
          <div className="mt-1 text-2xl font-bold tabular-nums">{fairplay.retards.length}</div>
          <p className="mt-0.5 text-[12px] leading-snug text-foreground/45">
            {fairplay.retards.length > 0 ? fairplay.retards.join(", ") : "Tout le monde à l'heure"}
          </p>
        </div>
        <div className="glass rounded-3xl p-4">
          <p className="mono-label text-foreground/40">Clean sheets</p>
          <div className="mt-1 text-2xl font-bold tabular-nums">{fairplay.cleanSheets.length}</div>
          <p className="mt-0.5 text-[12px] leading-snug text-foreground/45">
            {fairplay.cleanSheets.length > 0
              ? fairplay.cleanSheets.join(", ")
              : "Personne n'a gardé sa cage"}
          </p>
        </div>
        {fairplay.exemplaires.length > 0 && (
          <div className="glass col-span-2 rounded-3xl p-4">
            <p className="mono-label text-primary">Jamais en retard de la saison</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {fairplay.exemplaires.map((e) => (
                <span
                  key={e.name}
                  className="glass-soft flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold"
                >
                  <Avatar name={e.name} size={20} />
                  {e.name}
                  <span className="mono-label text-foreground/40">{e.matchs}M</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** 7 · Ton dimanche. */
export function MonDimancheModule({
  mine,
  me,
}: {
  mine: AnalysePlus["monDimanche"];
  me: string;
}) {
  if (!mine) return null;
  const delta = mine.rankFrom ? mine.rankFrom - mine.rankTo : 0;
  return (
    <section
      className="glass rounded-3xl p-5"
      style={{
        background:
          "radial-gradient(120% 80% at 100% 0%, rgba(111,168,255,0.14), transparent 55%), linear-gradient(168deg, rgba(255,255,255,0.09), rgba(255,255,255,0.028))",
      }}
    >
      <p className="mono-label text-primary">Ton dimanche</p>
      {mine.played ? (
        <>
          <h2 className="mt-1 text-xl font-bold tracking-tight">
            {mine.pp > 0 ? `Tu repars avec +${mine.pp} points` : "Dimanche compliqué"}
          </h2>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {(
              [
                [mine.buts, "Buts"],
                [mine.passes, "Passes"],
                [mine.pp, "Points"],
                [mine.rankTo, "Rang"],
              ] as const
            ).map(([v, l]) => (
              <div key={l} className="glass-soft rounded-2xl px-2 py-3 text-center">
                <div className="text-[22px] leading-none font-extrabold tabular-nums">{v}</div>
                <p className="mono-label mt-1.5 text-foreground/40">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {mine.result && (
              <span
                className={cn(
                  "mono-label rounded-full px-2.5 py-1",
                  mine.result === "Victoire"
                    ? "bg-primary/15 text-primary"
                    : "glass-soft text-foreground/50"
                )}
              >
                {mine.result}
              </span>
            )}
            {mine.titres.map((t) => (
              <span key={t} className="mono-label rounded-full bg-primary/15 px-2.5 py-1 text-primary">
                {t}
              </span>
            ))}
            {delta !== 0 && (
              <span className="mono-label glass-soft rounded-full px-2.5 py-1 text-foreground/60">
                {delta > 0 ? `▲ ${delta} place${delta > 1 ? "s" : ""}` : `▼ ${-delta}`}
              </span>
            )}
          </div>
          <p className="mt-3 text-[12.5px] text-foreground/45">
            Ton point fort reste le {mine.best.toLowerCase()}, ton chantier le{" "}
            {mine.worst.toLowerCase()}.
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-1 text-xl font-bold tracking-tight">Tu as manqué ce dimanche</h2>
          <p className="mt-2 text-[13px] leading-snug text-foreground/45">
            {me}, tu es {mine.rankTo}e au Pépite d&apos;Or — les absents ne marquent pas de points.
            Rendez-vous à la prochaine convocation.
          </p>
        </>
      )}
    </section>
  );
}

/** 8 · La projection. */
export function ProjectionModule({ projection }: { projection: AnalysePlus["projection"] }) {
  if (!projection) return null;
  const up = projection.rankNow - projection.rank;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Si tu gardes ce rythme</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">
        Dans {projection.horizon} journées : {projection.rank}
        <span className="text-foreground/40">e</span> avec {projection.pp} points
      </h2>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1">
          <p className="mono-label text-foreground/40">Aujourd&apos;hui</p>
          <div className="mt-1 text-2xl font-extrabold tabular-nums">
            {projection.ppNow}
            <span className="ml-1.5 text-[13px] font-semibold text-foreground/40">
              {projection.rankNow}e
            </span>
          </div>
        </div>
        <span className="mono-label text-foreground/30">→</span>
        <div className="flex-1 text-right">
          <p className="mono-label text-primary">Projection</p>
          <div className="mt-1 text-2xl font-extrabold text-primary tabular-nums">
            {projection.pp}
            <span className="ml-1.5 text-[13px] font-semibold text-primary/60">
              {projection.rank}e
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[12px] text-foreground/40">
        {up > 0
          ? `Tu gagnerais ${up} place${up > 1 ? "s" : ""} — à condition d'être là chaque dimanche.`
          : up < 0
            ? `Tu perdrais ${-up} place${-up > 1 ? "s" : ""} : les autres avancent plus vite.`
            : "Tu conserverais ta place au classement."}
      </p>
    </section>
  );
}

/** 9 · Ton record personnel. */
export function RecordPersoModule({ record }: { record: AnalysePlus["recordPerso"] }) {
  if (!record) return null;
  return (
    <section className="glass flex items-center justify-between gap-4 rounded-3xl p-5">
      <div className="min-w-0">
        <p className="mono-label text-primary">Record personnel battu</p>
        <div className="mt-1.5 text-[26px] leading-none font-extrabold tracking-tight">
          {record.value}
        </div>
        <p className="mt-1.5 text-[12.5px] text-foreground/45">
          {record.label} · {record.previous}
        </p>
      </div>
      <span className="shrink-0 text-[34px]">🏅</span>
    </section>
  );
}

/** 10 · Ton jumeau statistique. */
export function JumeauModule({
  jumeau,
  mine,
  me,
}: {
  jumeau: AnalysePlus["jumeau"];
  mine: Player["stats"];
  me: string;
}) {
  if (!jumeau) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Ton jumeau statistique</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">
        {jumeau.name} joue presque comme toi
      </h2>
      <div className="mt-4 flex flex-col gap-2">
        {STAT_KEYS.map((k) => {
          const a = mine[k];
          const b = jumeau.stats[k];
          return (
            <div key={k} className="flex items-center gap-2">
              <span className="w-7 text-right text-[12px] font-bold tabular-nums">{a}</span>
              <div className="flex h-1.5 flex-1 gap-1">
                <div className="flex flex-1 justify-end overflow-hidden rounded-full bg-foreground/10">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${a}%` }} />
                </div>
                <div className="flex flex-1 overflow-hidden rounded-full bg-foreground/10">
                  <div className="h-full rounded-full bg-foreground/35" style={{ width: `${b}%` }} />
                </div>
              </div>
              <span className="w-7 text-[12px] font-bold tabular-nums">{b}</span>
              <span className="mono-label w-8 text-foreground/40">{k}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-foreground/40">
        {me} en bleu · {jumeau.name} en blanc — {jumeau.distance} points d&apos;écart au total.
      </p>
    </section>
  );
}

/** 11 · L'évolution de ta carte. */
export function EvolutionModule({ evolution }: { evolution: AnalysePlus["evolution"] }) {
  if (!evolution || evolution.js.length < 2) return null;
  const W = 320;
  const H = 92;
  const P = 10;
  const min = Math.min(...evolution.ovrs) - 1;
  const max = Math.max(...evolution.ovrs) + 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, evolution.js.length - 1);
  const y = (v: number) => H - P - ((v - min) / Math.max(1, max - min)) * (H - 2 * P);
  const pts = evolution.ovrs.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const gain = evolution.ovrs[evolution.ovrs.length - 1] - evolution.ovrs[0];
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Ta carte dans le temps</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">
        {gain > 0 ? `+${gain} de note générale depuis la J${evolution.js[0]}` : "Ta note générale"}
      </h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" aria-hidden>
        <polygon
          points={`${x(0)},${H - P} ${pts} ${x(evolution.js.length - 1)},${H - P}`}
          fill="var(--primary)"
          opacity="0.12"
        />
        <polyline
          points={pts}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {evolution.ovrs.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === evolution.ovrs.length - 1 ? 4 : 2.5} fill="var(--primary)" />
        ))}
      </svg>
      <div className="flex justify-between px-1">
        <span className="mono-label text-foreground/30">
          J{evolution.js[0]} · {evolution.ovrs[0]}
        </span>
        <span className="mono-label text-primary">
          J{evolution.js[evolution.js.length - 1]} · {evolution.ovrs[evolution.ovrs.length - 1]}
        </span>
      </div>
      {evolution.gains.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {evolution.gains.map((g) => (
            <span
              key={g.key}
              className={cn(
                "mono-label rounded-full px-2.5 py-1",
                g.delta > 0 ? "bg-primary/15 text-primary" : "glass-soft text-foreground/45"
              )}
            >
              {g.key} {g.delta > 0 ? `+${g.delta}` : g.delta}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/** 12 · Le mercato imaginaire. */
export function MercatoModule({ mercato }: { mercato: AnalysePlus["mercato"] }) {
  if (mercato.length === 0) return null;
  // Séparateur de milliers posé à la main : toLocaleString dépend des données
  // ICU du navigateur, qui manquent sur certains moteurs embarqués.
  const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  return (
    <section>
      <Head label="Le mercato imaginaire" title="Ils ont pris de la valeur" />
      <div className="flex flex-col gap-2">
        {mercato.map((m) => (
          <div key={m.name} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
            <Avatar name={m.name} size={28} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{m.name}</span>
            <span className="text-[14px] font-bold tabular-nums">{fmt(m.value)}</span>
            <span
              className={cn(
                "mono-label w-14 text-right",
                m.delta > 0 ? "text-primary" : "text-foreground/35"
              )}
            >
              {m.delta > 0 ? `▲ ${fmt(m.delta)}` : `▼ ${fmt(-m.delta)}`}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 px-1 text-[12px] text-foreground/35">
        Valeur fictive dérivée de la note, des points et de la production. Pour le plaisir du débat.
      </p>
    </section>
  );
}

/** 13 · Le cinq de la saison. */
export function CinqModule({ cinq }: { cinq: AnalysePlus["cinq"] }) {
  if (cinq.length < 3) return null;
  return (
    <section>
      <Head label="Depuis la première journée" title="Le cinq de la saison" />
      <div className="grid grid-cols-5 gap-1.5">
        {cinq.map((p) => (
          <div key={p.name} className="glass flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3">
            <Avatar name={p.name} size={30} />
            <span className="w-full truncate px-0.5 text-center text-[11px] font-bold">
              {p.name}
            </span>
            <span className="mono-label text-[8px] text-foreground/35">{p.poste}</span>
            <span className="mono-label rounded bg-primary px-1 py-px text-[9px] text-primary-foreground">
              {p.ovr}
            </span>
            <span className="mono-label text-foreground/40">{p.pp} PP</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 14 · Les affiches. */
export function AffichesModule({ affiches }: { affiches: AnalysePlus["affiches"] }) {
  if (affiches.length === 0) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Les affiches</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">Qui domine qui</h2>
      <div className="mt-4 flex flex-col gap-3">
        {affiches.map((a) => (
          <div key={`${a.a}-${a.b}`} className="flex items-center gap-3">
            <span className="w-[58px] shrink-0 truncate text-[13px] font-semibold">{a.a}</span>
            <div className="flex h-2 flex-1 gap-[3px]">
              {a.winsA > 0 && (
                <span className="rounded-full bg-primary" style={{ flexGrow: a.winsA, flexBasis: 0 }} />
              )}
              {a.nuls > 0 && (
                <span className="rounded-full bg-foreground/25" style={{ flexGrow: a.nuls, flexBasis: 0 }} />
              )}
              {a.winsB > 0 && (
                <span className="rounded-full bg-foreground/10" style={{ flexGrow: a.winsB, flexBasis: 0 }} />
              )}
            </div>
            <span className="w-[58px] shrink-0 truncate text-right text-[13px] font-semibold">
              {a.b}
            </span>
            <span className="mono-label w-12 shrink-0 text-right text-foreground/40 tabular-nums">
              {a.winsA}-{a.winsB}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 15 · Le mur des séries. */
export function SeriesModule({ series }: { series: AnalysePlus["series"] }) {
  if (series.length === 0) return null;
  return (
    <section>
      <Head label="Le mur des séries" title="Ce qui dure en ce moment" />
      <div className="grid grid-cols-3 gap-2.5">
        {series.map((s) => (
          <div key={s.kind} className="glass flex flex-col items-center gap-1.5 rounded-3xl px-2 py-4">
            <p className="mono-label text-primary">{s.kind}</p>
            <div className="text-[28px] leading-none font-extrabold tabular-nums">{s.count}</div>
            <p className="mono-label text-[8px] text-foreground/35">{s.unit}</p>
            <span className="mt-0.5 w-full truncate text-center text-[12px] font-semibold">
              {s.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 16 · La météo de la ligue. */
export function MeteoModule({ meteo }: { meteo: AnalysePlus["meteo"] }) {
  if (!meteo) return null;
  const plusFou = meteo.butsParMatch > meteo.butsRef;
  const plusSerre = meteo.ecart < meteo.ecartRef;
  return (
    <section>
      <Head
        label="La météo de la ligue"
        title={
          plusSerre
            ? "La ligue se resserre"
            : plusFou
              ? "La ligue s'emballe"
              : "La ligue tient son rythme"
        }
      />
      <div className="grid grid-cols-3 gap-2.5">
        {(
          [
            [`${meteo.butsParMatch}`, "Buts / match", `moy. ${meteo.butsRef}`, plusFou],
            [`${meteo.ecart}`, "Écart moyen", `moy. ${meteo.ecartRef}`, plusSerre],
            [`${meteo.nuls}`, "Nuls", "sur la saison", false],
          ] as const
        ).map(([v, l, sub, hot]) => (
          <div key={l} className="glass rounded-3xl p-4">
            <div className={cn("text-2xl font-bold tabular-nums", hot && "text-primary")}>{v}</div>
            <p className="mono-label mt-1.5 text-foreground/40">{l}</p>
            <p className="mt-0.5 text-[11px] text-foreground/30">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 19 · La phrase du dimanche. */
export function CitationModule({ citation }: { citation: AnalysePlus["citation"] }) {
  if (!citation) return null;
  return (
    <section className="px-1 py-2">
      <p className="mono-label text-primary">La phrase du dimanche</p>
      <blockquote className="mt-2.5 text-[22px] leading-[1.25] font-extrabold tracking-tight text-balance">
        « {citation.text} »
      </blockquote>
      <p className="mono-label mt-2.5 text-foreground/30">{citation.author}</p>
    </section>
  );
}

/** 20 · Le classement alternatif de la semaine. */
export function AlternatifModule({ alternatif }: { alternatif: AnalysePlus["alternatif"] }) {
  if (!alternatif) return null;
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">Le classement de la semaine</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight">{alternatif.title}</h2>
      <p className="mt-1 text-[12.5px] text-foreground/45">{alternatif.sub}</p>
      <div className="mt-4 flex flex-col gap-2.5">
        {alternatif.top.map((t, i) => (
          <div key={t.name} className="flex items-center gap-3">
            <span
              className={cn(
                "w-4 text-center text-[12px] font-bold tabular-nums",
                i === 0 ? "text-primary" : "text-foreground/40"
              )}
            >
              {i + 1}
            </span>
            <Avatar name={t.name} size={26} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{t.name}</span>
            <span className="text-[13px] font-bold tabular-nums">{t.value}</span>
            <span className="mono-label w-[68px] text-right text-foreground/35">
              {alternatif.unit}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
