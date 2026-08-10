"use client";

// Onglet Ligue — le fil de vie de la ligue (design Kickoff).
//
// Scrollytelling bento : la dernière journée est racontée comme une histoire
// éditoriale, rendue vivante façon canal — réactions accrochées aux moments
// forts (match, cartes, moment de la journée), jamais à des « posts ».
// L'ordre des modules et les règles (verre, accent bleu unique, blanc =
// action, jamais deux gros modules identiques d'affilée) viennent de la
// spécification de l'admin et des écrans de l'archive du design.
//
// Ce qui exige un moteur absent (partage de story, clips, vote, commentaires,
// vestiaire) est présent mais verrouillé — convention Locked.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, MapPin, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoostCard } from "@/components/sfl/boost-card";
import { Card3D } from "@/components/sfl/card-3d";
import { Locked } from "@/components/sfl/locked";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { LEAGUE_KEY } from "@/components/layout/site-header";
import { SAISIE_EVENT, useSeason } from "@/components/sfl/season-provider";
import { NEXT_MATCH } from "@/lib/sfl/data";
import {
  journeeParticipants,
  ovr,
  rankPlayers,
  STAT_KEYS,
  type Journee,
  type JourneeMatch,
  type Player,
} from "@/lib/sfl/engine";
import { computeStandings, entryPP } from "@/lib/sfl/saisie/engine";
import {
  AbsentsModule,
  CourseModule,
  FormeModule,
  MouvementsModule,
  useAnalyse,
} from "@/components/sfl/feed/analyse";
import { activeConvocation, respondConvocation } from "@/lib/sfl/saisie/mutations";
import { saisieStore } from "@/lib/sfl/saisie/store";
import { cn } from "@/lib/utils";

/* ----------------------------- Réactions ------------------------------ */
// Réactions locales à l'appareil (le multi-joueurs attend les comptes) :
// compteurs d'ambiance + le vote de l'utilisateur persisté.

const REACTS: [string, number][] = [
  ["⚽", 9],
  ["🔥", 6],
  ["😱", 3],
  ["💪", 2],
];

function ReactionRow({ id, className }: { id: string; className?: string }) {
  const isClient = useIsClient();
  const [tick, setTick] = useState(0);
  // Lecture au rendu (pas de setState dans un effet) : le serveur rend les
  // compteurs de base, le client rejoue avec l'état stocké dès le montage.
  const mine = useMemo<Record<string, boolean>>(() => {
    if (!isClient) return {};
    void tick;
    try {
      return JSON.parse(localStorage.getItem(`sfl-react-${id}`) ?? "{}");
    } catch {
      return {};
    }
  }, [id, isClient, tick]);
  const toggle = (emoji: string) => {
    const next = { ...mine, [emoji]: !mine[emoji] };
    localStorage.setItem(`sfl-react-${id}`, JSON.stringify(next));
    setTick((t) => t + 1);
  };
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {REACTS.map(([emoji, base]) => {
        const active = !!mine[emoji];
        return (
          <button
            key={emoji}
            onClick={() => toggle(emoji)}
            className={cn(
              "glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-transform active:scale-95",
              active && "text-primary shadow-[inset_0_0_0_1.5px_var(--primary)]"
            )}
          >
            <span className="text-[15px] leading-none">{emoji}</span>
            <span className="tabular-nums">{base + (active ? 1 : 0)}</span>
          </button>
        );
      })}
      <button
        onClick={() => toggle("👏")}
        className="glass flex items-center justify-center rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted-foreground"
      >
        +
      </button>
    </div>
  );
}

/* --------------------------- Petits éléments --------------------------- */

function ModuleTitle({ label, title }: { label?: string; title: string }) {
  return (
    <div className="mb-3 px-1">
      {label && <p className="mono-label text-primary">{label}</p>}
      <h2 className="mt-0.5 text-[17px] font-bold tracking-tight">{title}</h2>
    </div>
  );
}

function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full bg-secondary text-[11px] font-bold ring-2 ring-background"
      style={{ width: size, height: size }}
    >
      {name[0]}
    </span>
  );
}

/* ------------------------------- La page ------------------------------- */

export default function Ligue() {
  const { player } = useMyPlayer();
  const { players, journees, boostCards, saison } = useSeason();
  const isClient = useIsClient();
  const [view, setView] = useState<"journee" | "classement">("journee");
  const [leagueTick, setLeagueTick] = useState(0);
  void leagueTick;

  // Barre de progression de lecture — le scroll vit dans #app-scroll.
  const feedRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const scroller = document.getElementById("app-scroll");
    if (!scroller) return;
    const onScroll = () => {
      const el = feedRef.current;
      if (!el) return;
      const total = el.scrollHeight - scroller.clientHeight;
      setProgress(Math.max(0, Math.min(1, scroller.scrollTop / Math.max(1, total))));
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [view]);

  const league = isClient ? (localStorage.getItem(LEAGUE_KEY) ?? "SFL") : "SFL";
  function backToSFL() {
    localStorage.setItem(LEAGUE_KEY, "SFL");
    window.dispatchEvent(new Event("sfl-league"));
    setLeagueTick((n) => n + 1);
  }

  /* ------------------------- Données de la journée ------------------------ */

  const RANKED = rankPlayers(players);
  const byName = new Map(players.map((p) => [p.name, p]));
  const lastJ: Journee =
    [...journees].reverse().find((j) => j.matches && j.matches.length > 0) ?? journees[0];
  const matches = lastJ.matches ?? [];
  const totalButs = matches.reduce((s, m) => s + m.teamA.score + m.teamB.score, 0);

  // Le match de la journée = le plus prolifique ; les autres vont en liste.
  const big = [...matches].sort(
    (a, b) => b.teamA.score + b.teamB.score - (a.teamA.score + a.teamB.score)
  )[0];
  const others = matches.filter((m) => m !== big);

  const jBoosts = boostCards.filter((c) => c.date.startsWith(`J${lastJ.j}`));
  const mvpCard = jBoosts.find((c) => c.type === "mvp") ?? jBoosts[0];
  const unlocked = jBoosts.filter((c) => c !== mvpCard).slice(0, 3);

  // Lignes joueur de la journée, pour les faits d'armes et l'équipe type.
  const lines = matches.flatMap((m) =>
    [m.teamA, m.teamB].flatMap((t) =>
      t.players.map((p) => ({ ...p, team: t.name, win: t.score > (t === m.teamA ? m.teamB : m.teamA).score }))
    )
  );
  const lineOf = (name: string) => lines.find((l) => l.name === name);
  const feat = (name: string) => {
    const l = lineOf(name);
    if (!l) return null;
    const parts = [];
    if (l.buts > 0) parts.push(`${l.buts} BUT${l.buts > 1 ? "S" : ""}`);
    if (l.passes > 0) parts.push(`${l.passes} PASSE${l.passes > 1 ? "S" : ""}`);
    return parts.join(" · ") || null;
  };

  // Le duel : les deux joueurs les plus décisifs de la journée.
  const [duelA, duelB] = [...lines]
    .sort((a, b) => b.buts * 2 + b.passes - (a.buts * 2 + a.passes))
    .slice(0, 2)
    .map((l) => byName.get(l.name))
    .filter(Boolean) as Player[];

  // L'équipe type : les 5 plus décisifs, placés par poste sur le demi-terrain.
  const typeTeam = [...lines]
    .sort((a, b) => b.buts * 2 + b.passes - (a.buts * 2 + a.passes))
    .slice(0, 5)
    .map((l) => byName.get(l.name))
    .filter(Boolean) as Player[];
  const row = (p: Player) => {
    const poste = p.poste.toUpperCase();
    if (poste.startsWith("G")) return 2;
    if (/^(DC|DD|DG|DEF|MDC)/.test(poste)) return 1;
    return 0; // attaque et milieux offensifs devant
  };
  const pitchRows: Player[][] = [[], [], []];
  typeTeam.forEach((p) => pitchRows[row(p)].push(p));

  const participants = journeeParticipants(lastJ);

  // Lignes brutes de la journée (avec honneurs et résultat) : elles portent
  // les modules narratifs — tops au barème, débuts, duo, record.
  const jEntries = saison.entries.filter(
    (e) => e.j === lastJ.j && e.statut === "Présent" && !e.extraTime
  );
  const tops = [...jEntries]
    .map((e) => ({ e, pp: entryPP(e) }))
    .sort((a, b) => b.pp - a.pp)
    .slice(0, 3);
  // Record : la journée la plus prolifique de la saison jusqu'ici ?
  const priorMax = Math.max(
    0,
    ...journees
      .filter((j) => j.j !== lastJ.j)
      .map((j) => (j.matches ?? []).reduce((s, m) => s + m.teamA.score + m.teamB.score, 0))
  );
  const isRecord = totalButs > priorMax;
  // Les débuts : premier match joué cette journée.
  const debuts = jEntries.filter((e) => (byName.get(e.player)?.matchs ?? 0) === 1);
  // Le duo : la meilleure paire d'une même équipe (buts + passes cumulés).
  const teams = new Map<string, typeof jEntries>();
  for (const e of jEntries) {
    if (!e.team) continue;
    teams.set(e.team, [...(teams.get(e.team) ?? []), e]);
  }
  const duo = [...teams.entries()]
    .map(([team, list]) => {
      const best = [...list].sort((a, b) => b.buts + b.passes - (a.buts + a.passes)).slice(0, 2);
      return { team, best, total: best.reduce((s, e) => s + e.buts + e.passes, 0) };
    })
    .filter((d) => d.best.length === 2)
    .sort((a, b) => b.total - a.total)[0];

  const analyse = useAnalyse(saison, players, lastJ);

  // Synthèse du classement : mon rang, son évolution sur la journée, et ma
  // forme sur les cinq derniers matchs joués (V/N/D).
  const myRank = RANKED.find((p) => p.name === player.name)?.rank ?? RANKED.length;
  const rankBefore = rankPlayers(
    computeStandings({ ...saison, entries: saison.entries.filter((e) => e.j !== lastJ.j) })
  ).find((p) => p.name === player.name)?.rank;
  const myDelta = rankBefore ? rankBefore - myRank : 0;
  const myForm = saison.entries
    .filter((e) => e.player === player.name && e.statut === "Présent" && !e.extraTime && e.result)
    .sort((a, b) => a.j - b.j)
    .slice(-5)
    .map((e) => (e.result === "Victoire" ? "V" : e.result === "Nul" ? "N" : "D"));

  /* ----------------------------- Convocation ----------------------------- */

  const convoc = activeConvocation(saison);
  const next = convoc
    ? { jour: convoc.jour, date: convoc.date, heure: convoc.heure, lieu: convoc.lieu }
    : { jour: NEXT_MATCH.jour, date: NEXT_MATCH.date, heure: NEXT_MATCH.heure, lieu: NEXT_MATCH.lieu };
  const myRsvp = convoc ? (convoc.reponses[player.name] ?? null) : null;
  const confirmed = convoc
    ? Object.values(convoc.reponses).filter((r) => r === "present").length
    : 0;
  function rsvp(value: "present" | "absent") {
    if (!convoc) return;
    const nextVal = myRsvp === value ? null : value;
    saisieStore.save(respondConvocation(saison, convoc.id, player.name, nextVal));
    window.dispatchEvent(new Event(SAISIE_EVENT));
  }

  if (isClient && league !== "SFL") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-5 py-16 text-center">
        <span className="scale-y-90 text-2xl font-black tracking-[0.35em] uppercase">{league}</span>
        <p className="text-sm text-muted-foreground">
          Tu n&apos;es pas membre de la {league}. Ta ligue, c&apos;est la SFL.
        </p>
        <Button onClick={backToSFL} className="font-semibold">
          Revenir à la SFL
        </Button>
      </div>
    );
  }

  return (
    <div ref={feedRef} className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-2 sm:py-6">
      {/* En-tête de section : titre 30px + segmented control verre.
          (Pilule de points, profil et réglages vivent dans l'en-tête global.) */}
      <h1 className="text-[30px] font-bold tracking-tight">Ligue</h1>
      <div className="glass -mt-2 flex gap-1 rounded-full p-1" role="tablist" aria-label="Vue de la ligue">
        {(
          [
            ["journee", "Journée"],
            ["classement", "Classement"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn(
              "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              view === id ? "bg-foreground text-background" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "classement" ? (
        <>
          <p className="px-1 text-[13px] text-foreground/40">
            Sunday Five League · après {journees.length} journées
          </p>

          {/* Ma synthèse — rang, points, forme sur 5 matchs (design Kickoff) */}
          <section className="glass rounded-[26px] p-[18px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="mono-label text-foreground/40">{player.name}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[34px] leading-none font-extrabold tracking-tight">
                    {myRank}
                    <span className="text-[17px] text-foreground/40">e</span>
                  </span>
                  {myDelta !== 0 && (
                    <span className={cn("mono-label", myDelta > 0 ? "text-primary" : "text-foreground/40")}>
                      {myDelta > 0 ? `▲ ${myDelta}` : `▼ ${-myDelta}`}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="mono-label text-foreground/40">Points</p>
                <div className="mt-1 text-[34px] leading-none font-extrabold tracking-tight tabular-nums">
                  {player.pp}
                </div>
              </div>
            </div>
            {myForm.length > 0 && (
              <>
                <div className="mt-4 flex gap-[5px]">
                  {myForm.map((r, i) => (
                    <span
                      key={i}
                      className="flex h-[30px] flex-1 items-center justify-center rounded-[9px]"
                      style={
                        r === "V"
                          ? { background: "var(--primary)", color: "#0A0B0E" }
                          : r === "N"
                            ? { background: "rgba(255,255,255,0.14)", color: "#fff" }
                            : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)" }
                      }
                    >
                      <span className="mono-label">{r}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-[11px] text-[12.5px] text-foreground/40">
                  Cinq derniers matchs · {myForm.filter((r) => r === "V").length} victoire
                  {myForm.filter((r) => r === "V").length > 1 ? "s" : ""},{" "}
                  {myForm.filter((r) => r === "N").length} nul
                  {myForm.filter((r) => r === "N").length > 1 ? "s" : ""},{" "}
                  {myForm.filter((r) => r === "D").length} défaite
                  {myForm.filter((r) => r === "D").length > 1 ? "s" : ""}
                </p>
              </>
            )}
          </section>

          {/* La table de la ligue */}
          <section>
            <div className="flex items-center gap-3 px-2 pb-2.5">
              <span className="mono-label w-[22px] text-[9px] text-foreground/30">#</span>
              <span className="mono-label flex-1 text-[9px] text-foreground/30">Joueur</span>
              <span className="mono-label w-[26px] text-center text-[9px] text-foreground/30">M</span>
              <span className="mono-label w-[44px] text-center text-[9px] text-foreground/30">B·P</span>
              <span className="mono-label w-[30px] text-right text-[9px] text-foreground/30">PTS</span>
            </div>
            <div className="glass-soft overflow-hidden rounded-[24px]">
              {RANKED.slice(0, 12).map((p) => (
                <div
                  key={p.name}
                  className={cn(
                    "flex items-center gap-3 border-b border-white/5 px-3.5 py-3 last:border-0",
                    p.name === player.name && "bg-primary/10"
                  )}
                >
                  <span className="w-[22px] text-[13px] font-bold text-foreground/50 tabular-nums">
                    {p.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                    {p.name}
                  </span>
                  <span className="mono-label w-[26px] text-center text-foreground/40">
                    {p.matchs}
                  </span>
                  <span className="mono-label w-[44px] text-center text-foreground/40">
                    {p.buts}·{p.passes}
                  </span>
                  <span className="w-[30px] text-right text-[14px] font-bold tabular-nums">
                    {p.pp}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/stats"
              className="flex items-center justify-center gap-1 px-3 py-3.5 text-sm font-semibold text-primary"
            >
              Tous les classements <ChevronRight className="size-4" />
            </Link>
          </section>
        </>
      ) : (
        <>
          {/* 1 · Barre de présence — pilule douce du design */}
          <div className="glass-soft flex items-center justify-between gap-3 rounded-full px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex -space-x-1.5">
                {participants.slice(0, 4).map((n) => (
                  <Avatar key={n} name={n} size={24} />
                ))}
              </div>
              <span className="truncate text-[12.5px] text-foreground/60">
                {participants.slice(0, 2).join(", ")} et {participants.length - 2} autres ont joué
              </span>
            </div>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              <span className="mono-label text-primary">{participants.length} en ligne</span>
            </span>
          </div>

          {/* 2 · Titre éditorial + progression de lecture */}
          <div className="px-1">
            <h2 className="text-[22px] leading-[1.15] font-extrabold tracking-tight">
              Journée {lastJ.j} : le récap
            </h2>
            <p className="mt-[7px] text-[13px] leading-snug text-foreground/40">
              SFL · Sunday Five League · {matches.length} match{matches.length > 1 ? "s" : ""} ·{" "}
              {totalButs} buts
            </p>
            <div className="mt-3 h-[2px] rounded-[2px] bg-foreground/8">
              <div
                className="h-[2px] rounded-[2px] bg-foreground transition-[width] duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>

          {/* 3 · Le match de la journée */}
          {big && (
            <section className="glass rounded-3xl p-5">
              <p className="mono-label text-primary">Le match de la journée · Final</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1 text-center">
                  <div className="truncate text-lg font-bold">{big.teamA.name}</div>
                </div>
                <div className="shrink-0 text-[44px] leading-none font-bold tracking-tight tabular-nums">
                  {big.teamA.score}–{big.teamB.score}
                </div>
                <div className="min-w-0 flex-1 text-center">
                  <div className="truncate text-lg font-bold">{big.teamB.name}</div>
                </div>
              </div>
              <Link
                href="/stats"
                className="mt-4 block rounded-full bg-foreground py-3 text-center text-sm font-bold text-background"
              >
                Voir le résumé
              </Link>
            </section>
          )}
          {/* 4 · Réactions du match */}
          <ReactionRow id={`j${lastJ.j}-match`} className="-mt-2 px-1" />

          {/* 5 · Le visuel de la journée — story 9:16 */}
          {big && (
            <section>
              <ModuleTitle label="Story 9:16 · générée auto" title="Le visuel de la journée" />
              <div className="flex items-stretch gap-4">
                <div
                  className="relative w-[46%] shrink-0 overflow-hidden rounded-3xl bg-gradient-to-b from-[#1a2030] to-[#070707] p-4"
                  style={{ aspectRatio: "9/16" }}
                >
                  <p className="mono-label text-primary">SFL · J{lastJ.j}</p>
                  <div className="mt-6 text-[44px] leading-none font-bold tabular-nums">
                    {big.teamA.score}
                    <br />
                    {big.teamB.score}
                  </div>
                  <p className="mt-4 text-[15px] leading-snug font-bold">
                    {big.teamA.score > big.teamB.score ? big.teamA.name : big.teamB.name} fait
                    tomber {big.teamA.score > big.teamB.score ? big.teamB.name : big.teamA.name}
                  </p>
                  <p className="absolute bottom-4 left-4 text-[11px] text-muted-foreground">
                    {lastJ.date} · {totalButs} buts
                  </p>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                  <p className="text-sm leading-snug text-muted-foreground">
                    Le score du jour, prêt à partir en story — le pont entre la
                    ligue et vos réseaux.
                  </p>
                  <Locked label="Bientôt">
                    <div className="rounded-full bg-foreground py-3 text-center text-sm font-bold text-background">
                      Partager en story
                    </div>
                  </Locked>
                </div>
              </div>
            </section>
          )}

          {/* 6 · Cartes débloquées — posées nues, jamais dans un cadre */}
          {unlocked.length > 0 && (
            <section>
              <ModuleTitle
                label={`${jBoosts.length} carte${jBoosts.length > 1 ? "s" : ""} débloquée${jBoosts.length > 1 ? "s" : ""}`}
                title="Les cartes de la journée"
              />
              <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {unlocked.map((c) => (
                  <div key={`${c.player}-${c.type}`} className="shrink-0 snap-start">
                    <BoostCard card={c} size={0.52} />
                    {feat(c.player) && (
                      <p className="mono-label mt-2 text-center text-primary">{feat(c.player)}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <CourseModule course={analyse.course} />

          {/* 7 · La feuille de match */}
          <section className="glass rounded-3xl p-5">
            <ModuleTitle title="La feuille de match" />
            <div className="flex flex-col gap-4">
              {matches.map((m: JourneeMatch) => (
                <div key={m.id}>
                  <p className="mono-label text-muted-foreground">
                    {m.teamA.name} {m.teamA.score} – {m.teamB.score} {m.teamB.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[...m.teamA.players, ...m.teamB.players]
                      .filter((p) => p.buts > 0 || p.passes > 0)
                      .sort((a, b) => b.buts - a.buts || b.passes - a.passes)
                      .map((p) => (
                        <span
                          key={p.name}
                          className="flex items-center gap-1.5 rounded-full bg-foreground/8 px-2.5 py-1 text-[12px] font-semibold"
                        >
                          {p.name}
                          {p.buts > 0 && (
                            <span className="mono-label text-primary">{p.buts}B</span>
                          )}
                          {p.passes > 0 && (
                            <span className="mono-label text-muted-foreground">{p.passes}P</span>
                          )}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mono-label mt-4 flex items-center gap-1.5 text-muted-foreground">
              <Check className="size-3.5 text-primary" /> Feuille validée par l&apos;admin
            </p>
          </section>

          {/* 8 · Ailleurs dans la ligue */}
          {others.length > 0 && (
            <section>
              <ModuleTitle title="Ailleurs dans la ligue" />
              <div className="flex flex-col gap-2">
                {others.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-2xl bg-card px-4 py-3"
                  >
                    <span className="text-[14px] font-semibold">{m.teamA.name}</span>
                    <span className="text-[15px] font-bold tabular-nums">
                      {m.teamA.score}–{m.teamB.score}
                    </span>
                    <span className="text-[14px] font-semibold">{m.teamB.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <MouvementsModule mouvements={analyse.mouvements} />

          {/* 9 · La journée en chiffres — bento */}
          <section>
            <ModuleTitle title="La journée en chiffres" />
            <div className="grid grid-cols-2 gap-2.5">
              <div className="glass row-span-2 flex flex-col justify-between rounded-3xl p-4">
                <p className="mono-label text-muted-foreground">Buts inscrits</p>
                <div className="text-5xl font-bold tabular-nums">{totalButs}</div>
                <p className={cn("mono-label", isRecord ? "text-primary" : "text-muted-foreground")}>
                  {isRecord
                    ? `Record de la saison · +${totalButs - priorMax}`
                    : `Meilleure marque : ${priorMax}`}
                </p>
                <div className="flex items-end gap-1.5" style={{ height: 44 }}>
                  {matches.map((m) => {
                    const v = m.teamA.score + m.teamB.score;
                    const max = Math.max(...matches.map((x) => x.teamA.score + x.teamB.score));
                    return (
                      <div
                        key={m.id}
                        className="flex-1 rounded-t bg-primary/70"
                        style={{ height: `${(v / max) * 100}%` }}
                      />
                    );
                  })}
                </div>
              </div>
              {(
                [
                  ["Meilleur buteur", lastJ.faits.buteur ?? "—"],
                  ["Meilleur passeur", lastJ.faits.passeur ?? "—"],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="glass rounded-3xl p-4">
                  <p className="mono-label text-muted-foreground">{label}</p>
                  <div className="mt-1 truncate text-lg font-bold">{value}</div>
                </div>
              ))}
              {analyse.insolites.map((t) => (
                <div key={t.label} className="glass rounded-3xl p-4">
                  <p className="mono-label text-primary">{t.label}</p>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{t.value}</div>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{t.sub}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 9 bis · Les tops de la journée — au barème des Points Pépite */}
          {tops.length > 0 && (
            <section>
              <ModuleTitle label="Au barème Pépite" title="Les tops de la journée" />
              <div className="flex flex-col gap-2">
                {tops.map(({ e, pp }, i) => (
                  <div
                    key={e.player}
                    className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3"
                  >
                    <span className="w-5 text-center text-[13px] font-bold text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <Avatar name={e.player} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{e.player}</span>
                      <span className="mono-label text-muted-foreground">
                        {[
                          e.buts > 0 && `${e.buts}B`,
                          e.passes > 0 && `${e.passes}P`,
                          e.mvp && "MVP",
                          e.impact && "IMPACT",
                          e.def && "DÉF",
                        ]
                          .filter(Boolean)
                          .join(" · ") || e.result}
                      </span>
                    </span>
                    <span className="mono-label rounded-full bg-primary/15 px-2.5 py-1 text-primary">
                      +{pp} PP
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 10 · Le duel de la journée */}
          {duelA && duelB && (
            <section className="glass rounded-3xl p-5">
              <ModuleTitle title="Le duel de la journée" />
              <div className="mb-3 flex items-center justify-between">
                {[duelA, duelB].map((p) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <Avatar name={p.name} size={34} />
                    <div>
                      <div className="text-[14px] font-bold">{p.name}</div>
                      <div className="mono-label text-muted-foreground">
                        {feat(p.name) ?? p.poste}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {STAT_KEYS.map((k) => {
                  const a = duelA.stats[k];
                  const b = duelB.stats[k];
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-7 text-right text-[12px] font-bold tabular-nums">{a}</span>
                      <div className="flex h-1.5 flex-1 gap-1">
                        <div className="flex flex-1 justify-end overflow-hidden rounded-full bg-foreground/10">
                          <div
                            className={cn("h-full rounded-full", a >= b ? "bg-primary" : "bg-foreground/35")}
                            style={{ width: `${a}%` }}
                          />
                        </div>
                        <div className="flex flex-1 overflow-hidden rounded-full bg-foreground/10">
                          <div
                            className={cn("h-full rounded-full", b >= a ? "bg-primary" : "bg-foreground/35")}
                            style={{ width: `${b}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-7 text-[12px] font-bold tabular-nums">{b}</span>
                      <span className="mono-label w-8 text-muted-foreground">{k}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 10 bis · Les débuts — premiers matchs de la journée */}
          {debuts.length > 0 && (
            <section className="glass rounded-3xl p-5">
              <p className="mono-label text-primary">
                Première{debuts.length > 1 ? "s" : ""} apparition{debuts.length > 1 ? "s" : ""}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">
                {debuts.map((e) => e.player).join(" et ")} débarque
                {debuts.length > 1 ? "nt" : ""}
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {debuts.map((e) => (
                  <div key={e.player} className="flex items-center gap-2.5">
                    <Avatar name={e.player} size={26} />
                    <p className="text-[13px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{e.player}</span>{" "}
                      {e.buts > 0
                        ? `plante ${e.buts} but${e.buts > 1 ? "s" : ""} pour sa première`
                        : "joue son premier match"}
                      {e.mvp || e.impact || e.def ? " — et repart avec un titre." : "."}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 11 · Le moment de la journée — la carte or en grand */}
          {mvpCard && (
            <section>
              <ModuleTitle label="Le moment de la journée" title={`Bravo ${mvpCard.player}`} />
              <div className="flex flex-col items-center gap-3">
                <Card3D
                  cacheKey={`feed-mvp-${mvpCard.player}-${mvpCard.type}`}
                  mode="rare"
                  size={0.92}
                  render={(s) => <BoostCard card={mvpCard} size={s} />}
                />
                <ReactionRow id={`j${lastJ.j}-moment`} />
                <Locked
                  label="Bientôt"
                  className="w-full"
                  note="Les commentaires ouvriront avec les comptes joueurs."
                >
                  <div className="rounded-3xl bg-card p-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar name="Ilyes" size={26} />
                      <p className="text-[13px]">
                        <span className="font-semibold">Ilyes</span>{" "}
                        <span className="text-muted-foreground">— énorme dimanche, rien à dire.</span>
                      </p>
                    </div>
                    <div className="mt-3 h-10 rounded-full bg-foreground/8 px-4 text-[13px] leading-10 text-muted-foreground">
                      Balance ton avis…
                    </div>
                  </div>
                </Locked>
              </div>
            </section>
          )}

          <FormeModule forme={analyse.forme} />

          {/* 12 · Les clips */}
          <section>
            <ModuleTitle label="Filmés par le vestiaire" title="Les clips de la journée" />
            <Locked label="Bientôt" note="Les vidéos du dimanche arrivent avec l'upload et l'identification des joueurs.">
              <div className="flex gap-2.5">
                {["La reprise de la 88e", "Le double contact", "L'arrêt du siècle"].map((t) => (
                  <div
                    key={t}
                    className="relative flex-1 overflow-hidden rounded-2xl bg-card"
                    style={{ aspectRatio: "9/16" }}
                  >
                    <span className="absolute top-2 left-2 flex size-7 items-center justify-center rounded-full bg-foreground/15">
                      <Play className="size-3.5" />
                    </span>
                    <span className="absolute right-2 bottom-2 left-2 text-[11px] leading-tight font-semibold">
                      {t}
                    </span>
                  </div>
                ))}
              </div>
            </Locked>
          </section>

          {/* 13 · L'équipe type */}
          <section className="glass overflow-hidden rounded-3xl">
            <div className="p-5 pb-0">
              <div className="flex items-start justify-between">
                <ModuleTitle title="L'équipe type" />
                <span className="mono-label flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-primary">
                  Vote ouvert · bientôt
                </span>
              </div>
            </div>
            <div
              className="relative mx-4 mb-4 rounded-2xl border border-primary/20"
              style={{
                height: 240,
                background:
                  "radial-gradient(120% 90% at 50% 0%, rgba(111,168,255,0.14), transparent 60%), linear-gradient(180deg, rgba(111,168,255,0.05), transparent)",
              }}
            >
              {/* demi-terrain : rond central en haut, surface en bas */}
              <div className="absolute -top-10 left-1/2 size-24 -translate-x-1/2 rounded-full border border-primary/25" />
              <div className="absolute bottom-0 left-1/2 h-12 w-40 -translate-x-1/2 rounded-t-xl border border-b-0 border-primary/25" />
              {pitchRows.map((rowPlayers, ri) =>
                rowPlayers.map((p, i) => (
                  <div
                    key={p.name}
                    className="absolute flex -translate-x-1/2 flex-col items-center gap-1"
                    style={{
                      top: 26 + ri * 72,
                      left: `${(100 / (rowPlayers.length + 1)) * (i + 1)}%`,
                    }}
                  >
                    <Avatar name={p.name} size={34} />
                    <span className="text-[11px] font-bold">{p.name}</span>
                    <span className="mono-label rounded bg-primary px-1 py-px text-[9px] text-primary-foreground">
                      {ovr(p.stats)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 13 bis · Le duo qui a fait la journée */}
          {duo && (
            <section className="glass rounded-3xl p-5">
              <p className="mono-label text-primary">Équipe {duo.team}</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">
                Le duo qui a fait la journée
              </h2>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {duo.best.map((e) => (
                    <Avatar key={e.player} name={e.player} size={34} />
                  ))}
                </div>
                <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {duo.best.map((e) => e.player).join(" et ")}
                  </span>{" "}
                  combinent {duo.total} actions décisives —{" "}
                  {duo.best
                    .map((e) => `${e.buts}B ${e.passes}P`)
                    .join(" et ")}
                  .
                </p>
              </div>
            </section>
          )}

          <AbsentsModule absents={analyse.absents} />

          {/* 14 · Le but du match */}
          <section>
            <ModuleTitle title="Le but du match" />
            <Locked label="Bientôt">
              <div
                className="relative w-full overflow-hidden rounded-3xl bg-card"
                style={{ aspectRatio: "16/10" }}
              >
                <span className="absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-foreground/15">
                  <Play className="size-6" />
                </span>
                <div className="absolute right-4 bottom-3 left-4">
                  <p className="text-[15px] font-bold">Le but qui a plié le match</p>
                  <p className="mono-label mt-0.5 text-muted-foreground">
                    @{lastJ.faits.buteur ?? "joueur"} · J{lastJ.j}
                  </p>
                </div>
              </div>
            </Locked>
          </section>

          {/* 15 · Le vestiaire */}
          <section>
            <ModuleTitle title="Le vestiaire" />
            <Locked label="Bientôt" note="Le chat de la ligue ouvre avec les comptes joueurs.">
              <div className="glass rounded-3xl p-4">
                <div className="flex items-center gap-2.5">
                  <Avatar name="Ilyes" size={26} />
                  <p className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                    Dimanche on remet ça. Il me manque deux joueurs, réponds vite.
                  </p>
                </div>
                <p className="mono-label mt-2.5 text-primary">Ilyes est en train d&apos;écrire…</p>
              </div>
            </Locked>
          </section>

          {/* 16 · Les prochaines journées */}
          <section>
            <ModuleTitle title="Les prochaines journées" />
            <div className="glass rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mono-label text-primary">J{NEXT_MATCH.journee} · Convocation</p>
                  <div className="mt-1 text-2xl font-bold tracking-tight">
                    {next.jour} {next.date}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{next.heure}</span>
                    <span>·</span>
                    <MapPin className="size-3.5" />
                    {next.lieu}
                  </div>
                </div>
                {myRsvp === "present" && (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="size-4.5" strokeWidth={2.5} />
                  </span>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => rsvp("present")}
                  className={cn(
                    "flex-1 rounded-full py-3 text-sm font-bold transition-colors",
                    myRsvp === "present"
                      ? "bg-primary text-primary-foreground"
                      : "bg-foreground text-background"
                  )}
                >
                  {myRsvp === "present" ? "Je viens ✓" : "Je viens"}
                </button>
                <button
                  onClick={() => rsvp("absent")}
                  className={cn(
                    "flex-1 rounded-full py-3 text-sm font-semibold transition-colors",
                    myRsvp === "absent" ? "bg-destructive/20 text-destructive" : "bg-foreground/10"
                  )}
                >
                  Pas dispo
                </button>
              </div>
              <p className="mono-label mt-3 text-center text-muted-foreground">
                {myRsvp === "present"
                  ? `Tu es dans la compo · ${confirmed}/10`
                  : myRsvp === "absent"
                    ? "Tu passes ton tour"
                    : `${confirmed} déjà confirmés · +1 Point Pépite dimanche`}
              </p>
            </div>
            <div className="mt-2.5 flex flex-col gap-2 opacity-50">
              {[
                [`J${NEXT_MATCH.journee + 1}`, "Dimanche 23 août"],
                [`J${NEXT_MATCH.journee + 2}`, "Dimanche 30 août"],
              ].map(([j, d]) => (
                <div key={j} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                  <span className="mono-label text-muted-foreground">{j}</span>
                  <span className="text-[14px] font-semibold">{d}</span>
                  <span className="mono-label text-muted-foreground">À venir</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
