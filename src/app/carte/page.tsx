"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Lock, Minus, PersonStanding, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BoostCard, BOOST_LABELS } from "@/components/sfl/boost-card";
import { Card3D } from "@/components/sfl/card-3d";
import { ViewableCard } from "@/components/sfl/card-viewer";
import { PlayerCard, type CardMode } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { BAREME, BOOST_CARDS, PLAYERS } from "@/lib/sfl/data";
import {
  STAT_KEYS,
  buildTargetStats,
  emptyAllocation,
  fixedBonuses,
  freePool,
  ovr,
  rankPlayers,
  tierBonus,
  type Allocation,
  type StatKey,
} from "@/lib/sfl/engine";

const RANKED = rankPlayers(PLAYERS);

function SectionTitle({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between px-1">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {right && <span className="text-sm font-medium text-muted-foreground">{right}</span>}
    </div>
  );
}

export default function CartePage() {
  const { player } = useMyPlayer();
  const [mode, setMode] = useState<CardMode>("rare");
  const [alloc, setAlloc] = useState<Allocation>(emptyAllocation());

  const myRank = RANKED.find((p) => p.name === player.name)?.rank ?? RANKED.length;
  const myBoosts = BOOST_CARDS.filter((c) => c.player === player.name);

  const pool = freePool(player);
  const fixed = useMemo(() => fixedBonuses(player), [player]);
  const used = STAT_KEYS.reduce((a, k) => a + alloc[k], 0);
  const remaining = pool - used;

  const totalAlloc = useMemo(() => {
    const out = emptyAllocation();
    for (const k of STAT_KEYS) out[k] = alloc[k] + fixed[k];
    return out;
  }, [alloc, fixed]);

  const { out: target, autoVit } = buildTargetStats(player.stats, totalAlloc);
  const before = ovr(player.stats);
  const after = ovr(target);

  const inc = (k: StatKey) => {
    if (remaining > 0) setAlloc((a) => ({ ...a, [k]: a[k] + 1 }));
  };
  const dec = (k: StatKey) => {
    if (alloc[k] > 0) setAlloc((a) => ({ ...a, [k]: a[k] - 1 }));
  };
  const reset = () => setAlloc(emptyAllocation());

  const sources = [
    player.mvp > 0 && (["MVP du mois", "6 pts OVR — libres", "text-[#c9962e] dark:text-[#E8C87A]"] as const),
    player.buts >= 6 && (["Meilleur buteur", "+3 en TIR", "text-primary"] as const),
    player.passes >= 6 && (["Meilleur passeur", "+3 en PAS", "text-primary"] as const),
    player.impact > 0 && (["Impact du mois", "3 pts OVR — libres", "text-sky-600 dark:text-sky-400"] as const),
    player.def > 0 &&
      (["Défensive du mois", "+2 DEF · +2 PHY (→ +2 VIT)", "text-violet-600 dark:text-violet-400"] as const),
    player.matchs >= 3 && (["Présence 100%", "+1 PHY", "text-emerald-600 dark:text-emerald-400"] as const),
    [
      "Tiers Pépite d'Or",
      `+${tierBonus(myRank, RANKED.length)} pts OVR`,
      "text-[#c9962e] dark:text-[#E8C87A]",
    ] as const,
  ].filter(Boolean) as (readonly [string, string, string])[];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-4 sm:py-8">
      <div>
        <p className="text-[13px] font-medium text-muted-foreground">
          Évolue chaque mois à l&apos;EvoDay
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Ma carte</h1>
      </div>

      {/* Carte principale */}
      <section className="flex flex-col items-center gap-6">
        <div className="flex w-full max-w-xs rounded-full bg-card p-1">
          {(["simple", "rare"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-semibold transition-colors",
                mode === m
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "simple" ? "Standard" : "Rare"}
            </button>
          ))}
        </div>
        <Card3D
          cacheKey={`${mode}-${player.name}`}
          mode={mode}
          size={1.05}
          render={(s) => <PlayerCard player={player} mode={mode} size={s} />}
        />
      </section>

      {/* Avatar 3D */}
      <section>
        <SectionTitle>Mon avatar</SectionTitle>
        <Link
          href="/avatar"
          className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity active:opacity-70"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
            <PersonStanding className="size-[18px]" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Créer mon avatar 3D</span>
            <span className="block text-[12px] text-muted-foreground">
              Taille, corpulence, tête, peau — en 3D animée
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </section>

      {/* Cartes Boost */}
      <section>
        <SectionTitle
          right={`${myBoosts.length} obtenue${myBoosts.length > 1 ? "s" : ""}`}
        >
          Mes cartes Boost
        </SectionTitle>
        <p className="mb-3 px-1 text-sm text-muted-foreground">
          Gagnées grâce aux figures de match. Elles célèbrent une perf précise{" "}
          <strong className="font-semibold text-foreground">
            sans modifier ta carte principale
          </strong>
          .
        </p>
        {myBoosts.length > 0 ? (
          <div className="-mx-5 flex gap-4 overflow-x-auto overscroll-x-contain px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {myBoosts.map((c, i) => (
              <div key={i} className="shrink-0 text-center">
                <ViewableCard
                  cacheKey={`${c.type}-${c.player}-${c.date}`}
                  mode="rare"
                  size={0.82}
                  title={c.player}
                  subtitle={`${BOOST_LABELS[c.type]} · ${c.date}`}
                  render={(s) => <BoostCard card={c} size={s} />}
                />
                <div className="mt-2 text-xs font-medium text-muted-foreground">
                  {BOOST_LABELS[c.type]} · {c.date}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-3xl bg-card px-6 py-10 text-sm text-muted-foreground">
            <Lock className="size-4" /> Aucune carte Boost — vise une figure de match !
          </div>
        )}
      </section>

      {/* Sources d'évolution */}
      <section>
        <SectionTitle>Comment ma carte évolue</SectionTitle>
        <p className="mb-3 px-1 text-sm text-muted-foreground">
          Chaque mois à l&apos;EvoDay, tes titres rapportent des{" "}
          <strong className="font-semibold text-foreground">points OVR</strong>.{" "}
          <strong className="font-semibold text-foreground">6 points de stats = +1 OVR.</strong>{" "}
          Et chaque fois que tu montes{" "}
          <strong className="font-semibold text-foreground">+1 DEF ET +1 PHY</strong>, tu gagnes{" "}
          <strong className="font-semibold text-sky-600 dark:text-sky-400">+1 VIT offert</strong>.
        </p>
        <div className="overflow-hidden rounded-3xl bg-card">
          {sources.map(([label, detail, color], i) => (
            <div
              key={label}
              className={cn(
                "flex items-center justify-between gap-3 px-5 py-3.5",
                i < sources.length - 1 && "border-b border-border/60"
              )}
            >
              <span className="text-sm font-semibold">
                <span className={cn("mr-2.5", color)}>◆</span>
                {label}
              </span>
              <span className={cn("text-right text-[13px] font-semibold", color)}>{detail}</span>
            </div>
          ))}
          <p className="border-t border-border/60 bg-secondary/40 px-5 py-3 text-xs text-muted-foreground">
            Non-titré dans une catégorie ? Tu reçois des points{" "}
            <strong className="font-semibold text-foreground">au prorata</strong> de ton rang.
          </p>
        </div>
      </section>

      {/* Simulateur EvoDay */}
      <section>
        <SectionTitle
          right={
            remaining === 0 && pool > 0 ? "Prêt ✓" : pool > 0 ? `${remaining} à placer` : undefined
          }
        >
          Répartis tes points
        </SectionTitle>
        <div className="rounded-3xl bg-card p-5">
          {pool === 0 ? (
            <p className="mb-1 text-sm text-muted-foreground">
              Pas de points libres ce mois-ci (aucun titre MVP/Impact). Les bonus fixes
              s&apos;appliquent automatiquement ci-dessous.
            </p>
          ) : (
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-medium text-muted-foreground">
                Pool libre (MVP/Impact)
              </span>
              <span
                className={cn(
                  "text-2xl font-bold tracking-tight tabular-nums",
                  remaining === 0 ? "text-emerald-500" : "text-primary"
                )}
              >
                {remaining}
                <span className="text-sm font-medium text-muted-foreground"> / {pool}</span>
              </span>
            </div>
          )}

          {STAT_KEYS.map((k) => {
            const added = totalAlloc[k];
            const isAutoVit = k === "VIT" && autoVit > 0;
            return (
              <div
                key={k}
                className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0"
              >
                <span className="w-9 text-[13px] font-semibold text-muted-foreground">{k}</span>
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-foreground/30"
                    style={{ width: `${player.stats[k]}%` }}
                  />
                  <div
                    className="absolute inset-y-0 bg-primary"
                    style={{
                      left: `${player.stats[k]}%`,
                      width: `${target[k] - player.stats[k]}%`,
                    }}
                  />
                </div>
                <span className="w-16 text-right text-[15px] font-semibold tabular-nums">
                  {player.stats[k]}
                  {added > 0 || isAutoVit ? (
                    <span className="text-[#c9962e] dark:text-[#E8C87A]"> →{target[k]}</span>
                  ) : null}
                </span>
                {pool > 0 && (
                  <div className="flex gap-1.5">
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label={`Retirer un point en ${k}`}
                      disabled={alloc[k] === 0}
                      onClick={() => dec(k)}
                    >
                      <Minus />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label={`Ajouter un point en ${k}`}
                      disabled={remaining === 0}
                      onClick={() => inc(k)}
                    >
                      <Plus />
                    </Button>
                  </div>
                )}
                {isAutoVit && (
                  <span className="rounded-full bg-sky-500/12 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap text-sky-600 dark:text-sky-400">
                    +{autoVit} auto
                  </span>
                )}
              </div>
            );
          })}

          <div className="mt-4 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={reset} disabled={used === 0}>
              <RotateCcw /> Réinitialiser
            </Button>
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl font-semibold text-muted-foreground tabular-nums">
                {before}
              </span>
              <span className="text-primary">→</span>
              <span
                className={cn(
                  "text-4xl font-bold tracking-tight tabular-nums",
                  after > before && "text-[#c9962e] dark:text-[#E8C87A]"
                )}
              >
                {after}
              </span>
              <span className="text-xs font-medium text-muted-foreground">OVR</span>
            </div>
          </div>
        </div>
      </section>

      {/* Barème */}
      <section>
        <SectionTitle>Barème Points Pépite</SectionTitle>
        <div className="overflow-hidden rounded-3xl bg-card">
          {BAREME.map(([action, value], i) => (
            <div
              key={action}
              className={cn(
                "flex items-center justify-between px-5 py-3.5",
                i < BAREME.length - 1 && "border-b border-border/60"
              )}
            >
              <span className="text-sm font-medium">{action}</span>
              <span
                className={cn(
                  "text-base font-bold tabular-nums",
                  value.startsWith("−") ? "text-destructive" : "text-primary"
                )}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
