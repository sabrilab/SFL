"use client";

// Accueil — la page d'arrivée de l'app.
//
// On arrive sur SOI : prénom en grand, photo, les trois chiffres de la
// saison. Puis « À la une », où le récap du dernier dimanche est une carte
// qu'on ouvre — le rideau (GSAP) se lève et le scrollytelling se déroule,
// classement, course et records recalculés comme au soir de ce dimanche-là.
//
// Les autres vues (Journée, Classement, Matchs) vivent derrière l'accueil et
// se rejoignent par le sélecteur, avec un retour permanent vers l'accueil.
// Le récap lui-même vit dans feed/journee-recap.tsx.

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { LEAGUE_KEY } from "@/components/layout/site-header";
import { useSeason } from "@/components/sfl/season-provider";
import { NEXT_MATCH } from "@/lib/sfl/data";
import { rankPlayers } from "@/lib/sfl/engine";
import { computeStandings } from "@/lib/sfl/saisie/engine";
import { JourneeRecap } from "@/components/sfl/feed/journee-recap";
import { PresencePanel } from "@/components/sfl/presence-panel";
import { EmailNudge } from "@/components/sfl/auth/email-nudge";
import { JourneeOpening } from "@/components/sfl/feed/journee-opening";
import { CarteJournee } from "@/components/sfl/carte-journee";
import { Accueil } from "@/components/sfl/feed/accueil";
import { cn } from "@/lib/utils";

export default function Ligue() {
  const { player } = useMyPlayer();
  const { players, journees, saison } = useSeason();
  const isClient = useIsClient();
  const [view, setView] = useState<"accueil" | "journee" | "classement" | "matchs">("accueil");
  const [leagueTick, setLeagueTick] = useState(0);
  void leagueTick;

  const league = isClient ? (localStorage.getItem(LEAGUE_KEY) ?? "SFL") : "SFL";
  function backToSFL() {
    localStorage.setItem(LEAGUE_KEY, "SFL");
    window.dispatchEvent(new Event("sfl-league"));
    setLeagueTick((n) => n + 1);
  }

  /* --------------------- Les capsules de journées --------------------- */

  const played = useMemo(
    () => journees.filter((j) => (j.matches ?? []).length > 0),
    [journees]
  );
  const latestJ = played[played.length - 1]?.j ?? journees[0]?.j ?? 1;
  const [selectedJ, setSelectedJ] = useState<number | null>(null);
  const currentJ = selectedJ ?? latestJ;
  const [opening, setOpening] = useState<number | null>(null);

  const openJournee = (j: number) => {
    if (j === currentJ || opening !== null) return;
    setOpening(j);
  };
  const onReveal = useCallback(() => {
    setOpening((j) => {
      if (j !== null) {
        setSelectedJ(j);
        document.getElementById("app-scroll")?.scrollTo({ top: 0 });
      }
      return j;
    });
  }, []);
  const onDone = useCallback(() => setOpening(null), []);
  const openingMeta = opening !== null ? journees.find((x) => x.j === opening) : undefined;

  /* -------------------------- Le classement --------------------------- */

  const RANKED = rankPlayers(players);
  const myRank = RANKED.find((p) => p.name === player.name)?.rank ?? RANKED.length;
  const rankBefore = rankPlayers(
    computeStandings({ ...saison, entries: saison.entries.filter((e) => e.j !== latestJ) })
  ).find((p) => p.name === player.name)?.rank;
  const myDelta = rankBefore ? rankBefore - myRank : 0;
  const myForm = saison.entries
    .filter((e) => e.player === player.name && e.statut === "Présent" && !e.extraTime && e.result)
    .sort((a, b) => a.j - b.j)
    .slice(-5)
    .map((e) => (e.result === "Victoire" ? "V" : e.result === "Nul" ? "N" : "D"));

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-2 sm:py-6">
      {/* Rideau d'ouverture d'une journée */}
      {opening !== null && (
        <JourneeOpening
          j={opening}
          date={openingMeta?.date ?? ""}
          onReveal={onReveal}
          onDone={onDone}
        />
      )}

      {/* Hors accueil : un retour permanent + le sélecteur de vue. */}
      {view !== "accueil" && (
        <>
          <button
            onClick={() => setView("accueil")}
            className="glass-soft flex w-fit items-center gap-2 rounded-full py-2 pr-4 pl-3 text-[13px] font-semibold text-foreground/60"
          >
            <ArrowLeft className="size-4" /> Accueil
          </button>
          <div
            className="glass -mt-2 flex gap-1 rounded-full p-1"
            role="tablist"
            aria-label="Vue de la ligue"
          >
            {(
              [
                ["journee", "Journée"],
                ["classement", "Classement"],
                ["matchs", "Matchs"],
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
        </>
      )}

      {view === "accueil" ? (
        <>
          <EmailNudge />
          <Accueil
            player={player}
            rank={myRank}
            dernieres={[...played].reverse()}
            onVoirClassement={() => setView("classement")}
            onOuvrirRecap={(j) => {
              setView("journee");
              // Déjà sur cette journée : pas de rideau, on entre directement.
              if (j === currentJ) return;
              openJournee(j);
            }}
          />
          <PresencePanel />
        </>
      ) : view === "matchs" ? (
        <>
          <p className="px-1 text-[13px] text-foreground/40">
            Chaque dimanche sur son terrain · {played.length} journée
            {played.length > 1 ? "s" : ""} jouée{played.length > 1 ? "s" : ""}
          </p>
          <div className="flex flex-col gap-3.5">
            {[...played].reverse().map((jn) => (
              <CarteJournee
                key={jn.j}
                journee={jn}
                onOuvrir={() => {
                  setView("journee");
                  openJournee(jn.j);
                }}
              />
            ))}
          </div>
        </>
      ) : view === "classement" ? (
        <>
          <p className="px-1 text-[13px] text-foreground/40">
            Sunday Five League · après {journees.length} journées
          </p>

          {/* Ma synthèse — rang, points, forme sur 5 matchs */}
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
          {/* Les capsules de journées — touche pour en ouvrir une autre */}
          <div className="-mt-1">
            <p className="mono-label mb-2 px-1 text-foreground/30">
              Les journées · touche pour ouvrir
            </p>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[...played].reverse().map((jn) => {
                const active = jn.j === currentJ;
                const buts = (jn.matches ?? []).reduce(
                  (s, m) => s + m.teamA.score + m.teamB.score,
                  0
                );
                return (
                  <button
                    key={jn.j}
                    onClick={() => openJournee(jn.j)}
                    className={cn(
                      "flex shrink-0 flex-col items-start gap-0.5 rounded-2xl px-3.5 py-2.5 text-left transition-transform active:scale-[0.96]",
                      active ? "bg-foreground" : "glass-soft"
                    )}
                  >
                    <span className={cn("mono-label", active ? "text-background" : "text-primary")}>
                      J{jn.j}
                    </span>
                    <span
                      className={cn(
                        "text-[12.5px] font-semibold whitespace-nowrap",
                        active ? "text-background" : "text-foreground/70"
                      )}
                    >
                      {jn.date}
                    </span>
                    <span
                      className={cn(
                        "mono-label text-[8px]",
                        active ? "text-background/60" : "text-foreground/30"
                      )}
                    >
                      {buts} buts
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Le récap de la journée ouverte — remonté à neuf à chaque ouverture */}
          <JourneeRecap key={currentJ} j={currentJ} />

          {/* 16 · Les prochaines journées */}
          <section>
            <div className="mb-3 px-1">
              <h2 className="text-[17px] font-bold tracking-tight">Les prochaines journées</h2>
            </div>
            <PresencePanel />
            <div className="mt-2.5 flex flex-col gap-2 opacity-50">
              {[
                [`J${NEXT_MATCH.journee + 1}`, "Dimanche 23 août"],
                [`J${NEXT_MATCH.journee + 2}`, "Dimanche 30 août"],
              ].map(([jj, d]) => (
                <div key={jj} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                  <span className="mono-label text-muted-foreground">{jj}</span>
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
