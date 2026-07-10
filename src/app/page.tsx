"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Check,
  ChevronRight,
  Clock,
  MapPin,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerCard } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { JOURNEES, NEXT_MATCH, PLAYERS } from "@/lib/sfl/data";
import { ovr, rankPlayers, rareStats } from "@/lib/sfl/engine";

const RANKED = rankPlayers(PLAYERS);
const PRESENCE_KEY = `sfl-presence-j${NEXT_MATCH.journee}`;

function StatTile({ big, label, accent }: { big: string | number; label: string; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-xl border bg-card px-2 py-3 text-center shadow-xs">
      <div className={`font-display text-2xl leading-none ${accent ? "text-primary" : ""}`}>{big}</div>
      <div className="mt-1.5 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        {label}
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

  const myRank = RANKED.find((p) => p.name === player.name)?.rank ?? 0;
  const lastPlayed = [...JOURNEES].reverse().find((j) => j.score) ?? JOURNEES[0];
  const top3 = RANKED.slice(0, 3);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-7 px-4 py-6 sm:py-10">
      {/* Hero */}
      <section>
        <p className="text-xs font-semibold tracking-[0.25em] text-muted-foreground uppercase">
          Bienvenue dans la
        </p>
        <h1 className="font-display text-3xl italic sm:text-4xl">
          SUNDAY <span className="text-primary">FIVE</span> LEAGUE
        </h1>
        <div className="mt-4 flex gap-2.5">
          <StatTile big={`#${myRank}`} label="Classement" accent />
          <StatTile big={player.pp} label="Points Pépite" />
          <StatTile big={ovr(player.stats)} label="OVR" />
        </div>
      </section>

      <div className="grid gap-7 md:grid-cols-2">
        <div className="flex flex-col gap-7">
          {/* Prochain match / convocation */}
          <section>
            <h2 className="mb-3 font-display text-lg italic">
              <span className="mr-2 text-primary">/</span>PROCHAIN MATCH
            </h2>
            <Card className="border-l-4 border-l-primary">
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-2xl text-primary italic">
                      {NEXT_MATCH.jour.toUpperCase()}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                      <Clock className="size-3.5 text-muted-foreground" />
                      {NEXT_MATCH.date} · {NEXT_MATCH.heure}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {NEXT_MATCH.lieu}
                    </div>
                  </div>
                  <Badge variant="secondary">J{NEXT_MATCH.journee}</Badge>
                </div>

                <Button
                  size="lg"
                  variant={present ? "outline" : "default"}
                  className={present ? "border-primary text-primary" : ""}
                  onClick={togglePresence}
                >
                  <Check className={present ? "" : "opacity-0"} />
                  {present ? "Présence confirmée" : "Confirmer ma présence"}
                </Button>
                <p className="-mt-2 text-xs text-muted-foreground">
                  {present
                    ? "+1 Point Pépite dimanche. Tu peux annuler en re-cliquant."
                    : "Réponds à ta convocation pour valider ta place."}
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Dernier résultat */}
          <section>
            <h2 className="mb-3 font-display text-lg italic">
              <span className="mr-2 text-primary">/</span>DERNIER RÉSULTAT
            </h2>
            <Link href="/stats" className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="text-center">
                  <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                    Journée {lastPlayed.j} · {lastPlayed.date}
                    {lastPlayed.sflTime && (
                      <Badge className="ml-2 align-middle">SFL Time</Badge>
                    )}
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-4">
                    <span className="text-sm font-bold tracking-widest uppercase">Équipe A</span>
                    <span className="font-display text-3xl">
                      {lastPlayed.score?.[0]} <span className="text-primary">–</span>{" "}
                      {lastPlayed.score?.[1]}
                    </span>
                    <span className="text-sm font-bold tracking-widest uppercase">Équipe B</span>
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Voir la feuille de match <ChevronRight className="size-3.5" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          </section>
        </div>

        <div className="flex flex-col gap-7">
          {/* Ma carte (teaser) */}
          <section>
            <h2 className="mb-3 font-display text-lg italic">
              <span className="mr-2 text-primary">/</span>MA CARTE
            </h2>
            <Link href="/carte" className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-4">
                  <div className="shrink-0">
                    <PlayerCard player={player} mode="rare" size={0.42} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-2xl">{ovr(rareStats(player.stats))}</span>
                      <Badge className="bg-[#E8C87A] text-[#3a2a10] hover:bg-[#E8C87A]">RARE</Badge>
                    </div>
                    {player.mvp > 0 && (
                      <p className="mt-1 text-xs font-bold tracking-widest text-[#c9962e]">★ MVP</p>
                    )}
                    <p className="mt-2 text-sm text-muted-foreground">
                      Ta carte évolue chaque mois à l&apos;EvoDay selon tes performances.
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      Voir et faire évoluer <ChevronRight className="size-3.5" />
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </section>

          {/* Top 3 */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg italic">
                <span className="mr-2 text-primary">/</span>TOP 3 PÉPITE D&apos;OR
              </h2>
              <Link href="/stats" className="text-xs font-medium text-primary">
                Classement complet →
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {top3.map((p, i) => (
                <div
                  key={p.name}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${
                    i === 0 ? "border-primary/40 bg-primary/5" : "bg-card"
                  }`}
                >
                  <span
                    className={`font-display w-6 text-xl ${i === 0 ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {p.rank}
                  </span>
                  {i === 0 ? (
                    <Trophy className="size-4 text-primary" />
                  ) : (
                    <Sparkles className="size-4 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate font-semibold">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.buts} B · {p.passes} PD
                  </span>
                  <span className="font-display text-lg text-primary">
                    {p.pp}
                    <span className="ml-0.5 text-[10px]">PTS</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
