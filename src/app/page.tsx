"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerCard } from "@/components/sfl/player-card";
import { BoostCard } from "@/components/sfl/boost-card";
import { Card3D } from "@/components/sfl/card-3d";
import { ViewableCard } from "@/components/sfl/card-viewer";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { LEAGUE_KEY } from "@/components/layout/site-header";
import { JOURNEES, NEXT_MATCH, PLAYERS } from "@/lib/sfl/data";
import { journeeScoreSummary, ovr, rankByMetric, rankPlayers, type BoostType, type Player } from "@/lib/sfl/engine";
import { RANKINGS } from "@/lib/sfl/rankings";
import { cn } from "@/lib/utils";

const RANKED = rankPlayers(PLAYERS);
const PRESENCE_KEY = `sfl-presence-j${NEXT_MATCH.journee}`;

// Un leader par classement pour l'aperçu "meilleurs joueurs".
const LEADERS = RANKINGS.map((def) => ({
  def,
  leader: rankByMetric(PLAYERS, def.value)[0],
}));

// Les classements MVP/Impact/Défensive mettent en avant la carte
// hors-série correspondante (design distinct), pas la carte Standard.
const BOOST_RANKING_TYPE: Record<string, BoostType> = {
  mvp: "mvp",
  impact: "impact",
  def: "def",
};

function leaderCard(defId: string, leader: Player, size: number) {
  const boostType = BOOST_RANKING_TYPE[defId];
  if (boostType) {
    return (
      <BoostCard
        card={{
          player: leader.name,
          type: boostType,
          ovr: ovr(leader.stats),
          poste: leader.poste,
          date: "Saison 1",
          stats: leader.stats,
        }}
        size={size}
      />
    );
  }
  return <PlayerCard player={leader} mode="simple" size={size} />;
}

export default function Home() {
  const { player } = useMyPlayer();
  const isClient = useIsClient();
  const [presentOverride, setPresentOverride] = useState<boolean | null>(null);
  const [leagueTick, setLeagueTick] = useState(0);

  void leagueTick;
  const league = isClient ? (localStorage.getItem(LEAGUE_KEY) ?? "SFL") : "SFL";

  // Retour à la SFL depuis la bannière "autre ligue".
  function backToSFL() {
    localStorage.setItem(LEAGUE_KEY, "SFL");
    window.dispatchEvent(new Event("sfl-league"));
    setLeagueTick((n) => n + 1);
  }

  const present =
    presentOverride ?? (isClient && localStorage.getItem(PRESENCE_KEY) === "1");

  function togglePresence() {
    const next = !present;
    localStorage.setItem(PRESENCE_KEY, next ? "1" : "0");
    setPresentOverride(next);
  }

  const myRank = RANKED.find((p) => p.name === player.name)?.rank ?? RANKED.length;
  const lastPlayed =
    [...JOURNEES].reverse().find((j) => j.matches && j.matches.length > 0) ?? JOURNEES[0];
  const lastScore = journeeScoreSummary(lastPlayed);

  if (isClient && league !== "SFL") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-5 py-16 text-center">
        <span className="scale-y-90 text-2xl font-black tracking-[0.35em] uppercase">{league}</span>
        <p className="text-sm text-muted-foreground">
          Tu n&apos;es pas membre de la {league}. Ta ligue, c&apos;est la SFL —
          la Sunday Five League.
        </p>
        <Button onClick={backToSFL} className="font-semibold">
          Revenir à la SFL
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7 px-5 py-4 sm:py-8">
      {/* Titre */}
      <div>
        <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          <span className="scale-y-90 font-black tracking-[0.3em] text-foreground uppercase">SFL</span>
          Sunday Five League
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Salut, {player.name}</h1>
      </div>

      {/* Ma carte + aperçu rapide, côte à côte */}
      <section className="flex items-center gap-4">
        <Card3D
          cacheKey={`rare-${player.name}`}
          mode="rare"
          size={0.6}
          render={(s) => <PlayerCard player={player} mode="rare" size={s} />}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {(
            [
              ["Classement", `#${myRank}`],
              ["Points Pépite", `${player.pp} pts`],
              ["Buts · Passes", `${player.buts} · ${player.passes}`],
              ["OVR", `${ovr(player.stats)}`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-2 border-b border-border/50 pb-2 last:border-0">
              <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
              <span className="text-lg font-bold tracking-tight tabular-nums">{value}</span>
            </div>
          ))}
          <Link
            href="/carte"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
          >
            Ma carte
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </section>

      <div className="flex flex-col gap-7 md:grid md:grid-cols-2 md:items-start md:gap-6">
        {/* Prochain match */}
        <section className="rounded-3xl bg-card p-5">
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
        </section>

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
            <div
              className={cn(
                "mt-1 font-bold tracking-tight tabular-nums",
                lastScore?.multi ? "text-xl" : "text-3xl"
              )}
            >
              {lastScore?.label}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{lastPlayed.date}</p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Meilleurs joueurs — aperçu tiré des classements, cartes 3D cliquables */}
      <section>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-lg font-semibold tracking-tight">Meilleurs joueurs</h2>
          <Link href="/stats" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Tous les classements
          </Link>
        </div>
        <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LEADERS.map(({ def, leader }) => (
            <div
              key={def.id}
              className="flex shrink-0 snap-start flex-col items-center gap-2.5 rounded-3xl bg-card p-4"
            >
              <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                {def.label}
              </span>
              <ViewableCard
                cacheKey={`leader-${def.id}-${leader.name}`}
                mode={BOOST_RANKING_TYPE[def.id] ? "rare" : "simple"}
                size={0.5}
                title={leader.name}
                subtitle={`${def.label} · ${leader.value} ${def.unit}`}
                render={(s) => leaderCard(def.id, leader, s)}
              />
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight tabular-nums">
                  {leader.value}
                  <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">
                    {def.unit}
                  </span>
                </span>
                {leader.name === player.name && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary-foreground uppercase">
                    Toi
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
