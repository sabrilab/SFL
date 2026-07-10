"use client";

import { useMemo, useState } from "react";
import { Lock, Minus, Plus, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BoostCard, BOOST_LABELS } from "@/components/sfl/boost-card";
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
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="font-display text-lg italic">
        <span className="mr-2 text-primary">/</span>
        {children}
      </h2>
      {right && <span className="text-xs font-medium text-primary">{right}</span>}
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
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl italic">
          MA <span className="text-primary">CARTE</span>
        </h1>
        <p className="mt-1 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Évolue chaque mois à l&apos;EvoDay
        </p>
      </div>

      {/* Carte principale */}
      <section className="flex flex-col items-center gap-5">
        <div className="flex w-full max-w-xs gap-2">
          {(["simple", "rare"] as const).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode(m)}
            >
              {m === "simple" ? "Standard" : "Rare"}
            </Button>
          ))}
        </div>
        <PlayerCard player={player} mode={mode} size={1.05} />
      </section>

      {/* Cartes Boost */}
      <section>
        <SectionTitle
          right={`${myBoosts.length} obtenue${myBoosts.length > 1 ? "s" : ""}`}
        >
          MES CARTES BOOST
        </SectionTitle>
        <p className="mb-3 text-sm text-muted-foreground">
          Gagnées grâce aux figures de match. Elles célèbrent une perf précise{" "}
          <strong className="text-foreground">sans modifier ta carte principale</strong>.
        </p>
        {myBoosts.length > 0 ? (
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {myBoosts.map((c, i) => (
              <div key={i} className="shrink-0 text-center">
                <BoostCard card={c} size={0.82} />
                <div className="mt-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  {BOOST_LABELS[c.type]} · {c.date}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            <Lock className="size-4" /> Aucune carte Boost — vise une figure de match !
          </div>
        )}
      </section>

      {/* Sources d'évolution */}
      <section>
        <SectionTitle>COMMENT MA CARTE ÉVOLUE</SectionTitle>
        <p className="mb-3 text-sm text-muted-foreground">
          Chaque mois à l&apos;EvoDay, tes titres rapportent des{" "}
          <strong className="text-foreground">points OVR</strong>.{" "}
          <strong className="text-foreground">6 points de stats = +1 OVR.</strong> Et chaque
          fois que tu montes <strong className="text-foreground">+1 DEF ET +1 PHY</strong>, tu
          gagnes <strong className="text-sky-600 dark:text-sky-400">+1 VIT offert</strong>.
        </p>
        <Card className="py-0">
          <CardContent className="px-0 py-0">
            {sources.map(([label, detail, color], i) => (
              <div
                key={label}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3",
                  i < sources.length - 1 && "border-b"
                )}
              >
                <span className="text-sm font-semibold tracking-wide uppercase">
                  <span className={cn("mr-2", color)}>◆</span>
                  {label}
                </span>
                <span className={cn("text-right text-xs font-bold", color)}>{detail}</span>
              </div>
            ))}
            <p className="border-t px-4 py-2.5 text-xs text-muted-foreground italic">
              Non-titré dans une catégorie ? Tu reçois des points{" "}
              <strong className="text-foreground">au prorata</strong> de ton rang.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Simulateur EvoDay */}
      <section>
        <SectionTitle right={remaining === 0 && pool > 0 ? "Prêt ✓" : pool > 0 ? `${remaining} à placer` : undefined}>
          RÉPARTIS TES POINTS
        </SectionTitle>
        <Card>
          <CardContent className="flex flex-col gap-1">
            {pool === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pas de points libres ce mois-ci (aucun titre MVP/Impact). Les bonus fixes
                s&apos;appliquent automatiquement ci-dessous.
              </p>
            ) : (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Pool libre (MVP/Impact)
                </span>
                <span
                  className={cn(
                    "font-display text-xl",
                    remaining === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                  )}
                >
                  {remaining}
                  <span className="text-xs text-muted-foreground"> / {pool}</span>
                </span>
              </div>
            )}

            {STAT_KEYS.map((k) => {
              const added = totalAlloc[k];
              const isAutoVit = k === "VIT" && autoVit > 0;
              return (
                <div key={k} className="flex items-center gap-3 border-b py-2 last:border-0">
                  <span className="font-display w-9 text-sm text-muted-foreground">{k}</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-foreground/35"
                      style={{ width: `${player.stats[k]}%` }}
                    />
                    <div
                      className="absolute inset-y-0 bg-primary shadow-[0_0_8px] shadow-primary/60"
                      style={{
                        left: `${player.stats[k]}%`,
                        width: `${target[k] - player.stats[k]}%`,
                      }}
                    />
                  </div>
                  <span className="font-display w-16 text-right text-sm">
                    {player.stats[k]}
                    {added > 0 || isAutoVit ? (
                      <span className="text-[#c9962e] dark:text-[#E8C87A]"> →{target[k]}</span>
                    ) : null}
                  </span>
                  {pool > 0 && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Retirer un point en ${k}`}
                        disabled={alloc[k] === 0}
                        onClick={() => dec(k)}
                      >
                        <Minus />
                      </Button>
                      <Button
                        variant="outline"
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
                    <Badge variant="secondary" className="text-[9px] whitespace-nowrap">
                      +{autoVit} AUTO
                    </Badge>
                  )}
                </div>
              );
            })}

            <div className="mt-3 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={reset} disabled={used === 0}>
                <RotateCcw /> Réinitialiser
              </Button>
              <div className="flex items-baseline gap-2.5">
                <span className="font-display text-2xl text-muted-foreground">{before}</span>
                <span className="font-black text-primary">→</span>
                <span
                  className={cn(
                    "font-display text-3xl",
                    after > before ? "text-[#c9962e] dark:text-[#E8C87A]" : ""
                  )}
                >
                  {after}
                </span>
                <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                  OVR
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Barème */}
      <section>
        <SectionTitle>BARÈME POINTS PÉPITE</SectionTitle>
        <Card className="py-0">
          <CardContent className="px-0 py-0">
            {BAREME.map(([action, value], i) => (
              <div
                key={action}
                className={cn(
                  "flex items-center justify-between px-4 py-3",
                  i < BAREME.length - 1 && "border-b"
                )}
              >
                <span className="text-sm font-semibold tracking-wide uppercase">
                  <span className="mr-2 text-primary">◆</span>
                  {action}
                </span>
                <span
                  className={cn(
                    "font-display text-base",
                    value.startsWith("−") ? "text-destructive" : "text-primary"
                  )}
                >
                  {value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
