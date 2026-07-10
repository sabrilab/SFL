"use client";

import { useState } from "react";
import { ChevronRight, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { JOURNEES, PLAYERS } from "@/lib/sfl/data";
import { ovr, rankPlayers } from "@/lib/sfl/engine";

const RANKED = rankPlayers(PLAYERS);

const FAIT_LABELS: [keyof (typeof JOURNEES)[number]["faits"], string][] = [
  ["mvp", "MVP du match"],
  ["impactA", "Meilleur joueur — Équipe A"],
  ["impactB", "Meilleur joueur — Équipe B"],
  ["defs", "Meilleurs défenseurs"],
  ["buteur", "Meilleur buteur"],
  ["passeur", "Meilleur passeur"],
];

export default function StatsPage() {
  const { me } = useMyPlayer();
  const [openJ, setOpenJ] = useState<number>(JOURNEES[JOURNEES.length - 1].j);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl italic">
          STATIS<span className="text-primary">TIQUES</span>
        </h1>
        <p className="mt-1 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Saison 1 · Après la journée {JOURNEES.length}
        </p>
      </div>

      <Tabs defaultValue="classement">
        <TabsList className="w-full">
          <TabsTrigger value="classement" className="flex-1">
            Classement
          </TabsTrigger>
          <TabsTrigger value="matchs" className="flex-1">
            Matchs
          </TabsTrigger>
        </TabsList>

        {/* ===== CLASSEMENT ===== */}
        <TabsContent value="classement" className="mt-4">
          <div className="flex px-3 pb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            <span className="w-8">#</span>
            <span className="flex-1">Joueur</span>
            <span className="w-12">Poste</span>
            <span className="w-10 text-center">OVR</span>
            <span className="w-14 text-right">PTS</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {RANKED.map((p) => {
              const isMe = p.name === me;
              return (
                <div
                  key={p.name}
                  className={cn(
                    "flex items-center rounded-lg border px-3 py-2.5",
                    isMe ? "border-primary/50 bg-primary/5" : "bg-card"
                  )}
                >
                  <span
                    className={cn(
                      "font-display w-8 text-sm",
                      p.rank <= 3 ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {p.rank}
                  </span>
                  <span className="mr-2.5 flex size-7 items-center justify-center rounded-full border border-[#8A744A]/60 bg-[#241A10] font-display text-xs text-[#E8C87A]">
                    {p.name[0]}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-semibold">{p.name}</span>
                    {p.statut !== "Actif" && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "px-1.5 text-[9px] tracking-wide uppercase",
                          p.statut === "Suspendu"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                        )}
                      >
                        {p.statut}
                      </Badge>
                    )}
                  </span>
                  <span className="w-12 text-xs font-medium text-muted-foreground">{p.poste}</span>
                  <span className="w-10 text-center font-display text-sm text-[#c9962e] dark:text-[#E8C87A]">
                    {ovr(p.stats)}
                  </span>
                  <span className="w-14 text-right font-display text-sm text-primary">
                    {p.pp}
                    <span className="ml-0.5 text-[9px]">PTS</span>
                  </span>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* ===== MATCHS ===== */}
        <TabsContent value="matchs" className="mt-4">
          <div className="flex flex-col gap-3">
            {[...JOURNEES].reverse().map((j) => {
              const open = openJ === j.j;
              const faits = FAIT_LABELS.map(([key, label]) =>
                j.faits[key] ? ([label, j.faits[key]] as const) : null
              ).filter(Boolean) as [string, string][];

              return (
                <div key={j.j} className="overflow-hidden rounded-xl border bg-card">
                  <button
                    onClick={() => setOpenJ(open ? 0 : j.j)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg">JOURNÉE {j.j}</span>
                        {j.sflTime && <Badge>SFL Time</Badge>}
                      </div>
                      <div className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                        {j.date}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {j.score ? (
                        <span className="font-display text-xl">
                          {j.score[0]} <span className="text-primary">–</span> {j.score[1]}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          Saisie incomplète
                        </Badge>
                      )}
                      <ChevronRight
                        className={cn(
                          "size-4 text-primary transition-transform",
                          open && "rotate-90"
                        )}
                      />
                    </div>
                  </button>

                  {open && (
                    <div className="border-t px-4 py-4">
                      {faits.length > 0 && (
                        <div className="mb-4">
                          <div className="mb-2 flex items-center gap-1.5 font-display text-sm text-[#c9962e] dark:text-[#E8C87A]">
                            <Star className="size-3.5" /> FAITS MARQUANTS
                          </div>
                          <div className="flex flex-col">
                            {faits.map(([label, value]) => (
                              <div key={label} className="border-b py-1.5 last:border-0">
                                <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                                  {label}
                                </div>
                                <div className="text-sm font-semibold">{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mb-2 font-display text-sm text-primary">FEUILLE DE MATCH</div>
                      <div className="flex flex-col">
                        {j.lignes.map(([name, res, buts, passes]) => (
                          <div
                            key={name}
                            className="flex items-center gap-2 border-b py-1.5 text-sm last:border-0"
                          >
                            <span
                              className={cn(
                                "w-5 font-black",
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
