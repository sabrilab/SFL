"use client";

// Le récap d'une journée — le scrollytelling complet, pour N'IMPORTE QUELLE
// journée jouée : la saison est tronquée aux journées ≤ j, si bien que le
// classement, la course, les records et les paliers se lisent « comme au soir
// de ce dimanche-là ». La dernière journée reste le cas par défaut ; les
// précédentes s'ouvrent depuis les capsules du fil.
//
// Chaque module apparaît au scroll (Reveal, motion) ; l'ordre et les règles
// (verre, accent bleu unique, blanc = action, jamais deux gros modules
// identiques d'affilée) viennent de la spécification de l'admin et des
// écrans de l'archive du design.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Play } from "lucide-react";
import { BoostCard, RankingCard } from "@/components/sfl/boost-card";
import { PlayerCard } from "@/components/sfl/player-card";
import { Card3D } from "@/components/sfl/card-3d";
import { Locked } from "@/components/sfl/locked";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { useSeason } from "@/components/sfl/season-provider";
import {
  journeeParticipants,
  ovr,
  STAT_KEYS,
  type JourneeMatch,
  type Player,
} from "@/lib/sfl/engine";
import { computeStandings, entryPP } from "@/lib/sfl/saisie/engine";
import {
  AbsentsModule,
  CouleursModule,
  CourseModule,
  FidelesModule,
  FormeModule,
  MilestonesModule,
  MouvementsModule,
  PulseModule,
  RaceModule,
  RadarModule,
  RecordsModule,
  useAnalyse,
} from "@/components/sfl/feed/analyse";
import {
  AffichesModule,
  AlternatifModule,
  BeteNoireModule,
  CinqModule,
  CitationModule,
  EvolutionModule,
  FacteurXModule,
  FairplayModule,
  JumeauModule,
  MercatoModule,
  MeteoModule,
  MonDimancheModule,
  PairesModule,
  ProjectionModule,
  RecordPersoModule,
  SeriesModule,
  TimelineModule,
  TournantModule,
  useAnalysePlus,
} from "@/components/sfl/feed/analyse-plus";
import { buildQuiz, PronosticModule, QuizModule } from "@/components/sfl/feed/jeux";
import { NEXT_MATCH } from "@/lib/sfl/data";
import { Reveal } from "@/components/sfl/feed/reveal";
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

/* ------------------------------- Le récap ------------------------------- */

export function JourneeRecap({ j }: { j: number }) {
  const { player } = useMyPlayer();
  const { journees, boostCards, saison } = useSeason();

  // Barre de progression de lecture — le scroll vit dans #app-scroll.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const scroller = document.getElementById("app-scroll");
    if (!scroller) return;
    const onScroll = () => {
      const total = scroller.scrollHeight - scroller.clientHeight;
      setProgress(Math.max(0, Math.min(1, scroller.scrollTop / Math.max(1, total))));
    };
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [j]);

  /* --------------- La saison, arrêtée au soir de la journée --------------- */

  const lastJ = journees.find((x) => x.j === j) ?? journees[0];
  const saisonAtJ = useMemo(
    () => ({ ...saison, entries: saison.entries.filter((e) => e.j <= j) }),
    [saison, j]
  );
  const players = useMemo(() => computeStandings(saisonAtJ), [saisonAtJ]);
  const journeesAtJ = useMemo(() => journees.filter((x) => x.j <= j), [journees, j]);

  const byName = new Map(players.map((p) => [p.name, p]));
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
  const jEntries = saisonAtJ.entries.filter(
    (e) => e.j === lastJ.j && e.statut === "Présent" && !e.extraTime
  );
  const tops = [...jEntries]
    .map((e) => ({ e, pp: entryPP(e) }))
    .sort((a, b) => b.pp - a.pp)
    .slice(0, 3);
  // Record : la journée la plus prolifique de la saison jusqu'ici ?
  const priorMax = Math.max(
    0,
    ...journeesAtJ
      .filter((x) => x.j !== lastJ.j)
      .map((x) => (x.matches ?? []).reduce((s, m) => s + m.teamA.score + m.teamB.score, 0))
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

  const analyse = useAnalyse(saisonAtJ, players, journeesAtJ, lastJ);
  const plus = useAnalysePlus(saisonAtJ, players, journeesAtJ, lastJ, player.name);

  // Le pronostic porte sur la journée suivante : la prochaine convocation
  // quand on lit le dernier récap, la journée d'après sinon (déjà jouée, donc
  // résolue tout de suite).
  const nextJ = journees.find((x) => x.j === j + 1);
  const pronoJ = nextJ ? nextJ.j : NEXT_MATCH.journee;
  const pronoDate = nextJ ? nextJ.date : `${NEXT_MATCH.jour} ${NEXT_MATCH.date}`;
  const pronoCandidates = [...players]
    .filter((p) => p.matchs > 0)
    .sort((a, b) => b.pp - a.pp)
    .slice(0, 6);
  const pronoResolved =
    saison.entries.find((e) => e.j === pronoJ && e.mvp && !e.extraTime)?.player ?? null;
  const quiz = buildQuiz(
    lastJ,
    jEntries.map((e) => ({ name: e.player, buts: e.buts }))
  );

  // Le scanner : les stats de la carte MVP contre la moyenne des joueurs
  // qui avaient foulé le terrain à cette date.
  const actifs = players.filter((p) => p.matchs > 0);
  const avgStats = Object.fromEntries(
    STAT_KEYS.map((k) => [
      k,
      Math.round(actifs.reduce((s, p) => s + p.stats[k], 0) / Math.max(1, actifs.length)),
    ])
  ) as Player["stats"];

  // Le leader du Pépite d'Or, pour sa carte de classement en 3D dans la course.
  const leader = analyse.course ? byName.get(analyse.course.top[0].name) : undefined;
  // Le joueur en forme, pour sa carte dans le module des séries.
  const formePlayer = analyse.forme.length > 0 ? byName.get(analyse.forme[0].name) : undefined;

  return (
    <>
      {/* 1 · Barre de présence — pilule douce du design */}
      <Reveal>
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
      </Reveal>

      {/* 2 · Titre éditorial + progression de lecture */}
      <Reveal delay={0.05}>
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
      </Reveal>

      {/* 3 · Le match de la journée */}
      {big && (
        <Reveal delay={0.1}>
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
        </Reveal>
      )}
      {plus.timeline && (
        <Reveal>
          <TimelineModule timeline={plus.timeline} />
        </Reveal>
      )}

      {plus.tournant && (
        <Reveal>
          <TournantModule tournant={plus.tournant} />
        </Reveal>
      )}

      {plus.monDimanche && (
        <Reveal>
          <MonDimancheModule mine={plus.monDimanche} me={player.name} />
        </Reveal>
      )}

      {/* 4 · Réactions du match */}
      <Reveal delay={0.14}>
        <ReactionRow id={`j${lastJ.j}-match`} className="-mt-2 px-1" />
      </Reveal>

      {/* 5 · Le visuel de la journée — story 9:16 */}
      {big && (
        <Reveal>
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
        </Reveal>
      )}

      {/* 6 · Cartes débloquées — posées nues, en 3D, manipulables */}
      {unlocked.length > 0 && (
        <Reveal>
          <section>
            <ModuleTitle
              label={`${jBoosts.length} carte${jBoosts.length > 1 ? "s" : ""} débloquée${jBoosts.length > 1 ? "s" : ""}`}
              title="Les cartes de la journée"
            />
            <div className="flex justify-center gap-2.5">
              {unlocked.slice(0, 3).map((c) => (
                <div key={`${c.player}-${c.type}`} className="flex flex-col items-center">
                  <Card3D
                    cacheKey={`feed-unlock-${lastJ.j}-${c.player}-${c.type}`}
                    mode="rare"
                    size={0.42}
                    render={(s) => <BoostCard card={c} size={s} />}
                  />
                  {feat(c.player) && (
                    <p className="mono-label mt-2 text-center text-primary">{feat(c.player)}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="mono-label mt-3 text-center text-foreground/30">
              Glisse une carte pour la faire tourner
            </p>
          </section>
        </Reveal>
      )}

      {analyse.course && (
        <Reveal>
          <CourseModule
            course={analyse.course}
            card={
              leader && (
                <Card3D
                  cacheKey={`feed-leader-${lastJ.j}-${leader.name}`}
                  mode="rare"
                  size={0.44}
                  render={(s) => <RankingCard rankingId="pp" player={leader} size={s} />}
                />
              )
            }
          />
        </Reveal>
      )}

      {/* 7 · La feuille de match */}
      <Reveal>
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
      </Reveal>

      {analyse.pulse.length >= 2 && (
        <Reveal>
          <PulseModule pulse={analyse.pulse} />
        </Reveal>
      )}

      {plus.citation && (
        <Reveal>
          <CitationModule citation={plus.citation} />
        </Reveal>
      )}

      {plus.recordPerso && (
        <Reveal>
          <RecordPersoModule record={plus.recordPerso} />
        </Reveal>
      )}

      {/* 8 · Ailleurs dans la ligue */}
      {others.length > 0 && (
        <Reveal>
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
        </Reveal>
      )}

      {analyse.mouvements.length > 0 && (
        <Reveal>
          <MouvementsModule mouvements={analyse.mouvements} />
        </Reveal>
      )}

      {/* 9 · La journée en chiffres — bento */}
      <Reveal>
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
      </Reveal>

      {analyse.race && (
        <Reveal>
          <RaceModule race={analyse.race} />
        </Reveal>
      )}

      {plus.projection && (
        <Reveal>
          <ProjectionModule projection={plus.projection} />
        </Reveal>
      )}

      {quiz.length > 0 && (
        <Reveal>
          <QuizModule journee={lastJ.j} questions={quiz} me={player.name} />
        </Reveal>
      )}

      {/* 9 bis · Les tops de la journée — au barème des Points Pépite */}
      {tops.length > 0 && (
        <Reveal>
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
        </Reveal>
      )}

      {/* 10 · Le duel de la journée */}
      {duelA && duelB && (
        <Reveal>
          <section className="glass rounded-3xl p-5">
            <ModuleTitle title="Le duel de la journée" />
            <div className="mb-4 flex items-center justify-center gap-2.5">
              <Card3D
                cacheKey={`feed-duel-${lastJ.j}-${duelA.name}`}
                mode="rare"
                size={0.46}
                render={(s) => <PlayerCard player={duelA} mode="rare" size={s} />}
              />
              <span className="mono-label shrink-0 text-foreground/40">VS</span>
              <Card3D
                cacheKey={`feed-duel-${lastJ.j}-${duelB.name}`}
                mode="rare"
                size={0.46}
                render={(s) => <PlayerCard player={duelB} mode="rare" size={s} />}
              />
            </div>
            <div className="mb-3 flex items-center justify-between">
              {[duelA, duelB].map((p) => (
                <div key={p.name} className="text-center first:text-left last:text-right">
                  <div className="text-[14px] font-bold">{p.name}</div>
                  <div className="mono-label text-muted-foreground">
                    {feat(p.name) ?? p.poste}
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
        </Reveal>
      )}

      {/* 10 bis · Les débuts — premiers matchs de la journée */}
      {debuts.length > 0 && (
        <Reveal>
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
        </Reveal>
      )}

      {/* 11 · Le moment de la journée — la carte or en grand */}
      {mvpCard && (
        <Reveal>
          <section>
            <ModuleTitle label="Le moment de la journée" title={`Bravo ${mvpCard.player}`} />
            <div className="flex flex-col items-center gap-3">
              <Card3D
                cacheKey={`feed-mvp-${lastJ.j}-${mvpCard.player}-${mvpCard.type}`}
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
        </Reveal>
      )}

      {plus.facteurX.length > 0 && (
        <Reveal>
          <FacteurXModule facteurX={plus.facteurX} />
        </Reveal>
      )}

      {plus.beteNoire && (
        <Reveal>
          <BeteNoireModule beteNoire={plus.beteNoire} me={player.name} />
        </Reveal>
      )}

      {mvpCard && (
        <Reveal>
          <RadarModule
            name={mvpCard.player}
            stats={mvpCard.stats}
            avg={avgStats}
            ovrValue={mvpCard.ovr}
            avgOvr={ovr(avgStats)}
          />
        </Reveal>
      )}

      {plus.jumeau && byName.get(player.name) && (
        <Reveal>
          <JumeauModule
            jumeau={plus.jumeau}
            mine={byName.get(player.name)!.stats}
            me={player.name}
          />
        </Reveal>
      )}

      {plus.evolution && (
        <Reveal>
          <EvolutionModule evolution={plus.evolution} />
        </Reveal>
      )}

      {plus.series.length > 0 && (
        <Reveal>
          <SeriesModule series={plus.series} />
        </Reveal>
      )}

      {analyse.forme.length > 0 && (
        <Reveal>
          <FormeModule
            forme={analyse.forme}
            card={
              formePlayer && (
                <Card3D
                  cacheKey={`feed-forme-${lastJ.j}-${formePlayer.name}`}
                  mode="rare"
                  size={0.42}
                  render={(s) => <PlayerCard player={formePlayer} mode="rare" size={s} />}
                />
              )
            }
          />
        </Reveal>
      )}

      {/* 12 · Les clips */}
      <Reveal>
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
      </Reveal>

      {/* 13 · L'équipe type */}
      <Reveal>
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
      </Reveal>

      {/* 13 bis · Le duo qui a fait la journée */}
      {duo && (
        <Reveal>
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
        </Reveal>
      )}

      {plus.paires.length > 0 && (
        <Reveal>
          <PairesModule paires={plus.paires} />
        </Reveal>
      )}

      {plus.mercato.length > 0 && (
        <Reveal>
          <MercatoModule mercato={plus.mercato} />
        </Reveal>
      )}

      {analyse.milestones.length > 0 && (
        <Reveal>
          <MilestonesModule milestones={analyse.milestones} />
        </Reveal>
      )}

      {analyse.absents.length > 0 && (
        <Reveal>
          <AbsentsModule absents={analyse.absents} />
        </Reveal>
      )}

      {analyse.fideles.rows.length > 0 && analyse.fideles.js.length >= 2 && (
        <Reveal>
          <FidelesModule fideles={analyse.fideles} />
        </Reveal>
      )}

      {/* 14 · Le but du match */}
      <Reveal>
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
      </Reveal>

      {plus.affiches.length > 0 && (
        <Reveal>
          <AffichesModule affiches={plus.affiches} />
        </Reveal>
      )}

      {plus.cinq.length >= 3 && (
        <Reveal>
          <CinqModule cinq={plus.cinq} />
        </Reveal>
      )}

      {plus.fairplay && (
        <Reveal>
          <FairplayModule fairplay={plus.fairplay} />
        </Reveal>
      )}

      {analyse.couleurs.length >= 2 && (
        <Reveal>
          <CouleursModule couleurs={analyse.couleurs} />
        </Reveal>
      )}

      {analyse.records.length > 0 && (
        <Reveal>
          <RecordsModule records={analyse.records} />
        </Reveal>
      )}

      {plus.meteo && (
        <Reveal>
          <MeteoModule meteo={plus.meteo} />
        </Reveal>
      )}

      {plus.alternatif && (
        <Reveal>
          <AlternatifModule alternatif={plus.alternatif} />
        </Reveal>
      )}

      <Reveal>
        <PronosticModule
          journee={pronoJ}
          date={pronoDate}
          candidates={pronoCandidates}
          me={player.name}
          resolvedMvp={pronoResolved}
        />
      </Reveal>

      {/* 15 · Le vestiaire */}
      <Reveal>
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
      </Reveal>
    </>
  );
}
