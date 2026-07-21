"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PlayerCard } from "@/components/sfl/player-card";
import { RankingCard, RANKING_THEMES } from "@/components/sfl/boost-card";
import { ViewableCard } from "@/components/sfl/card-viewer";
import { ElectionPanel } from "@/components/sfl/election-panel";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { journeeScoreSummary, rankByMetric, type Player } from "@/lib/sfl/engine";
import { RANKINGS, type RankingDef } from "@/lib/sfl/rankings";

/* ============================= CLASSEMENTS ============================= */

// Mini badges "cartes" — un coup d'œil suffit pour voir quels types de
// cartes hors-série (MVP, Impact, Défensive) un joueur a décrochés.
const BADGE_STYLES: [key: "mvp" | "impact" | "def", label: string, cls: string][] = [
  ["mvp", "M", "bg-gradient-to-b from-[#FFF3C6] via-[#F4C542] to-[#8A5A12] text-[#3a2703]"],
  ["impact", "I", "bg-gradient-to-b from-[#FFB88A] via-[#FF5A1F] to-[#7A1E05] text-[#2b0a01]"],
  ["def", "D", "bg-gradient-to-b from-[#D8F1FF] via-[#7FD4FF] to-[#1C4E77] text-[#06202f]"],
];

function CardBadges({ player }: { player: Player }) {
  const badges = BADGE_STYLES.filter(([key]) => player[key] > 0);
  if (badges.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {badges.map(([key, label, cls]) => (
        <span
          key={key}
          title={`Carte ${key === "mvp" ? "MVP" : key === "impact" ? "Impact" : "Défensive"} ×${player[key]}`}
          className={cn(
            "flex h-5 w-3.5 items-center justify-center rounded-[3px] text-[8px] font-black shadow-sm ring-1 ring-black/20",
            cls
          )}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

// La carte du n°1 de chaque classement s'affiche avec le design distinct
// correspondant (un thème par classement), pas la carte Standard.
function leaderCard(defId: string, leader: Player, size: number) {
  if (RANKING_THEMES[defId]) {
    return <RankingCard rankingId={defId} player={leader} size={size} />;
  }
  return <PlayerCard player={leader} mode="simple" size={size} />;
}

function RankingList({ def, me }: { def: RankingDef; me: string }) {
  const { players } = useSeason();
  const ranked = rankByMetric(players, def.value).filter(
    (p) => def.showAll || p.value > 0
  );

  if (ranked.length === 0) {
    return (
      <div className="rounded-3xl bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        Personne dans ce classement — tout le monde est clean ✓
      </div>
    );
  }

  const leader = ranked[0];

  return (
    <>
      <p className="mb-3 px-1 text-[13px] text-muted-foreground">{def.desc}</p>

      {/* Desktop : carte du n°1 à gauche (collante), classement à droite. */}
      <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* Carte du n°1 */}
        <div className="mb-5 flex flex-col items-center gap-2.5 lg:sticky lg:top-24 lg:mb-0 lg:rounded-3xl lg:bg-card lg:py-6">
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold text-primary tabular-nums">#1</span>
          <span className="text-sm font-bold tracking-tight tabular-nums">
            {leader.value}
            <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">{def.unit}</span>
          </span>
          {leader.name === me && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold tracking-wide text-primary-foreground uppercase">
              Toi
            </span>
          )}
        </div>
        <ViewableCard
          cacheKey={`rank-${def.id}-${leader.name}`}
          mode={RANKING_THEMES[def.id] ? "rare" : "simple"}
          size={0.85}
          title={leader.name}
          subtitle={`${def.label} · ${leader.value} ${def.unit}`}
          render={(s) => leaderCard(def.id, leader, s)}
        />
      </div>

      {/* Classement linéaire */}
      <div className="flex flex-col gap-1.5">
        {ranked.map((p) => {
          const isMe = p.name === me;
          return (
            <div
              key={p.name}
              className={cn(
                "flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5",
                isMe && "ring-1 ring-primary/50"
              )}
            >
              <span
                className={cn(
                  "w-7 text-base font-semibold tabular-nums",
                  p.rank <= 3 ? "text-primary" : "text-muted-foreground"
                )}
              >
                {p.rank}
              </span>
              <span className="mr-0.5 flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                {p.name[0]}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-[15px] font-semibold">{p.name}</span>
                {p.statut !== "Actif" && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase",
                      p.statut === "Suspendu"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    )}
                  >
                    {p.statut}
                  </span>
                )}
              </span>
              <span className="flex w-11 shrink-0 items-center justify-end gap-1">
                <CardBadges player={p} />
              </span>
              <span className="w-12 text-xs font-medium text-muted-foreground">{p.poste}</span>
              <span className="w-16 text-right text-lg font-bold tracking-tight tabular-nums">
                {p.value}
                <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                  {def.unit}
                </span>
              </span>
            </div>
          );
        })}
        </div>
      </div>
    </>
  );
}

/* ============================= PAGE ============================= */

export default function StatsPage() {
  const { me } = useMyPlayer();
  const { journees: JOURNEES } = useSeason();
  // 0 = état par défaut (dernière journée ouverte), -1 = tout fermé, N = journée N.
  const [openJ, setOpenJ] = useState<number>(0);
  const [ranking, setRanking] = useState<string>("pp");

  const rankingDef = RANKINGS.find((r) => r.id === ranking) ?? RANKINGS[0];
  const lastJ = JOURNEES[JOURNEES.length - 1]?.j;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-4 sm:py-8 lg:max-w-5xl">
      <div className="mb-1">
        <p className="text-[13px] font-medium text-muted-foreground">
          Saison 1 · Après la journée {JOURNEES.length}
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Statistiques</h1>
      </div>

      <Tabs defaultValue="classement">
        <TabsList className="w-full rounded-full bg-card p-1 dark:bg-card">
          <TabsTrigger value="classement" className="flex-1 rounded-full">
            Classement
          </TabsTrigger>
          <TabsTrigger value="matchs" className="flex-1 rounded-full">
            Matchs
          </TabsTrigger>
        </TabsList>

        {/* ===== CLASSEMENTS ===== */}
        <TabsContent value="classement" className="mt-4">
          <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto overscroll-x-contain px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {RANKINGS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRanking(r.id)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors",
                  ranking === r.id
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <RankingList def={rankingDef} me={me} />
        </TabsContent>

        {/* ===== MATCHS ===== */}
        <TabsContent value="matchs" className="mt-4">
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
            {[...JOURNEES].reverse().map((j) => {
              const open = openJ === 0 ? j.j === lastJ : openJ === j.j;
              const scoreSummary = journeeScoreSummary(j);

              return (
                <div key={j.j} className="overflow-hidden rounded-3xl bg-card">
                  <button
                    onClick={() => setOpenJ(open ? -1 : j.j)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold tracking-tight">
                          Journée {j.j}
                        </span>
                        {j.sflTime && (
                          <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">
                            SFL Time
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-muted-foreground">{j.date}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {scoreSummary ? (
                        <span
                          className={cn(
                            "font-bold tracking-tight tabular-nums",
                            scoreSummary.multi ? "text-sm text-muted-foreground" : "text-2xl"
                          )}
                        >
                          {scoreSummary.label}
                        </span>
                      ) : (
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                          Saisie incomplète
                        </span>
                      )}
                      <ChevronRight
                        className={cn(
                          "size-4.5 text-muted-foreground transition-transform",
                          open && "rotate-90"
                        )}
                      />
                    </div>
                  </button>

                  {open && (
                    <div className="flex flex-col gap-4 border-t border-border/60 px-5 py-4">
                      {j.faits?.buteur || j.faits?.passeur ? (
                        <div className="flex flex-col gap-1.5">
                          {j.faits.buteur && (
                            <p className="text-[13px]">
                              <span className="text-muted-foreground">Meilleur buteur — </span>
                              <span className="font-semibold">{j.faits.buteur}</span>
                            </p>
                          )}
                          {j.faits.passeur && (
                            <p className="text-[13px]">
                              <span className="text-muted-foreground">Meilleur passeur — </span>
                              <span className="font-semibold">{j.faits.passeur}</span>
                            </p>
                          )}
                        </div>
                      ) : null}

                      {j.matches && j.matches.length > 0 ? (
                        <div className="flex flex-col gap-3">
                          {j.matches.map((match) => (
                            <div key={match.id} className="rounded-2xl bg-secondary/40 p-3.5">
                              <p className="mb-2 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                                {match.label}
                              </p>
                              <div className="grid grid-cols-2 gap-3">
                                {[match.teamA, match.teamB].map((team) => (
                                  <div key={team.id}>
                                    <div className="mb-1.5 flex items-baseline justify-between">
                                      <span className="text-sm font-bold">{team.name}</span>
                                      <span className="text-lg font-bold tabular-nums">{team.score}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      {team.players.map((p) => (
                                        <div
                                          key={p.name}
                                          className="flex items-center justify-between text-[13px]"
                                        >
                                          <span className="flex min-w-0 items-center gap-1.5">
                                            <span
                                              className={cn(
                                                "truncate font-medium",
                                                p.name === me && "text-primary"
                                              )}
                                            >
                                              {p.name}
                                            </span>
                                            {p.note && (
                                              <span className="shrink-0 rounded-full bg-primary/12 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary uppercase">
                                                {p.note}
                                              </span>
                                            )}
                                          </span>
                                          <span className="shrink-0 text-xs text-muted-foreground">
                                            {p.buts}b · {p.passes}pd
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          {(j.lignes ?? []).map(([name, res, buts, passes]) => (
                            <div
                              key={name}
                              className="flex items-center gap-2.5 border-b border-border/60 py-2 text-sm last:border-0"
                            >
                              <span
                                className={cn(
                                  "w-5 font-bold",
                                  res === "V"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : res === "D"
                                      ? "text-destructive"
                                      : "text-muted-foreground"
                                )}
                              >
                                {res === "-" ? "·" : res}
                              </span>
                              <span className="flex-1 font-medium">{name}</span>
                              <span className="text-xs text-muted-foreground">
                                {buts} but{buts > 1 ? "s" : ""} · {passes} passe
                                {passes > 1 ? "s" : ""} D.
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div>
                        <p className="mb-2 text-sm font-semibold">Figures de match</p>
                        <ElectionPanel journee={j} me={me} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
