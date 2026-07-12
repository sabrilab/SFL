"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerCard } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { JOURNEES, NEXT_MATCH, PLAYERS } from "@/lib/sfl/data";
import { ovr, rankPlayers, rareStats } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

const RANKED = rankPlayers(PLAYERS);
const PRESENCE_KEY = `sfl-presence-j${NEXT_MATCH.journee}`;

function Ring({ value, children }: { value: number; children: React.ReactNode }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-16">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle
          cx="32" cy="32" r={r} fill="none"
          strokeWidth="4.5"
          className="stroke-foreground/10"
        />
        <circle
          cx="32" cy="32" r={r} fill="none"
          strokeWidth="4.5" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(Math.max(value, 0), 1))}
          className="stroke-foreground"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold tracking-tight">
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  const { player } = useMyPlayer();
  const isClient = useIsClient();
  const [presentOverride, setPresentOverride] = useState<boolean | null>(null);

  const present =
    presentOverride ?? (isClient && localStorage.getItem(PRESENCE_KEY) === "1");

  function togglePresence() {
    const next = !present;
    localStorage.setItem(PRESENCE_KEY, next ? "1" : "0");
    setPresentOverride(next);
  }

  const myRank = RANKED.find((p) => p.name === player.name)?.rank ?? RANKED.length;
  const lastPlayed = [...JOURNEES].reverse().find((j) => j.score) ?? JOURNEES[0];
  const top3 = RANKED.slice(0, 3);
  const rankProgress = (RANKED.length - myRank + 1) / RANKED.length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-4 sm:py-8">
      {/* Titre */}
      <div className="mb-2">
        <p className="text-[13px] font-medium text-muted-foreground">Sunday Five League</p>
        <h1 className="text-[34px] font-bold tracking-tight">Salut, {player.name}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {/* Tuiles stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col justify-between gap-5 rounded-3xl bg-card p-5">
              <Ring value={rankProgress}>{myRank}</Ring>
              <div>
                <div className="text-lg font-semibold tracking-tight">Classement</div>
                <div className="text-sm text-muted-foreground">Pépite d&apos;Or</div>
              </div>
            </div>
            <div className="flex flex-col justify-between gap-5 rounded-3xl bg-card p-5">
              <div className="text-5xl font-bold tracking-tight">
                {player.pp}
                <span className="ml-1.5 text-xl font-medium text-muted-foreground">pts</span>
              </div>
              <div>
                <div className="text-lg font-semibold tracking-tight">Points Pépite</div>
                <div className="text-sm text-muted-foreground">Saison 1</div>
              </div>
            </div>
          </div>

          {/* Prochain match */}
          <div className="rounded-3xl bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[13px] font-medium text-muted-foreground">
                  Prochain match · J{NEXT_MATCH.journee}
                </p>
                <div className="mt-1 text-2xl font-bold tracking-tight">
                  {NEXT_MATCH.jour} {NEXT_MATCH.date}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{NEXT_MATCH.heure}</span>
                  <span>·</span>
                  <MapPin className="size-3.5" />
                  {NEXT_MATCH.lieu}
                </div>
              </div>
              {present && (
                <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                  <Check className="size-4.5" strokeWidth={2.5} />
                </span>
              )}
            </div>
            <Button
              size="lg"
              onClick={togglePresence}
              className={cn(
                "mt-5 w-full font-semibold",
                present
                  ? "bg-secondary text-foreground hover:bg-secondary/80"
                  : "bg-foreground text-background hover:bg-foreground/85"
              )}
            >
              {present ? "Présence confirmée" : "Confirmer ma présence"}
            </Button>
            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              {present
                ? "+1 Point Pépite dimanche · re-clique pour annuler"
                : "Réponds à ta convocation pour valider ta place"}
            </p>
          </div>

          {/* Dernier résultat */}
          <Link
            href="/stats"
            className="group flex items-center justify-between rounded-3xl bg-card p-5 transition-colors hover:bg-accent"
          >
            <div>
              <p className="text-[13px] font-medium text-muted-foreground">
                Dernier résultat · J{lastPlayed.j}
                {lastPlayed.sflTime && <span className="ml-1.5 text-primary">SFL Time</span>}
              </p>
              <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                {lastPlayed.score?.[0]}
                <span className="mx-2 text-muted-foreground">–</span>
                {lastPlayed.score?.[1]}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{lastPlayed.date}</p>
            </div>
            <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="flex flex-col gap-4">
          {/* Ma carte */}
          <Link
            href="/carte"
            className="group flex items-center gap-5 rounded-3xl bg-card p-5 transition-colors hover:bg-accent"
          >
            <div className="shrink-0">
              <PlayerCard player={player} mode="rare" size={0.4} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-muted-foreground">Ma carte</p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight">
                  {ovr(rareStats(player.stats))}
                </span>
                <span className="rounded-full bg-[#E8C87A] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#3a2a10]">
                  RARE
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Évolue chaque mois à l&apos;EvoDay
              </p>
              <p className="mt-2 inline-flex items-center gap-0.5 text-sm font-medium text-foreground">
                Voir ma carte
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </p>
            </div>
          </Link>

          {/* OVR — rangée large */}
          <div className="flex items-center justify-between rounded-3xl bg-card p-5">
            <div>
              <div className="text-lg font-semibold tracking-tight">Note générale</div>
              <div className="text-sm text-muted-foreground">OVR carte standard</div>
            </div>
            <div className="text-4xl font-bold tracking-tight tabular-nums">
              {ovr(player.stats)}
            </div>
          </div>

          {/* Top 3 */}
          <div className="rounded-3xl bg-card p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Top 3 Pépite d&apos;Or</h2>
              <Link href="/stats" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Tout voir
              </Link>
            </div>
            <div className="flex flex-col gap-1">
              {top3.map((p) => (
                <div key={p.name} className="flex items-center gap-4 py-2">
                  <span
                    className={cn(
                      "w-5 text-lg font-semibold tabular-nums",
                      p.rank === 1 ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {p.rank}
                  </span>
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                    {p.name[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.buts} buts · {p.passes} passes D.
                    </div>
                  </div>
                  <span className="text-lg font-bold tracking-tight tabular-nums">
                    {p.pp}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">pts</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
