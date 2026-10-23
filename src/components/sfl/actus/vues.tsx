"use client";

// Les deux autres vues de l'onglet, à côté du fil des Actus (Sabri, 22/10 :
// « on peut pas avoir accès à tout le classement comme on avait avant […]
// faire un mix des deux ») : les Classements et les Matchs, tels qu'ils
// étaient dans la Ligue avant les Actus (app/ligue/page.tsx avant #71).
//   · Classements : le vote du jour, ma synthèse (rang, points, forme), tous
//     les classements (classements.tsx), le Wall of Fame ;
//   · Matchs : les journées jouées, une carte chacune ; la toucher ouvre son
//     récap (/ligue/journee?j=N).
// Sur grand écran (dès 768 px) : les Classements au nombre d'or, ma synthèse
// à gauche (qui reste à l'écran) et tous les classements à droite ; les
// Matchs en grille, deux terrains de front, trois dès 1280 px.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Crown } from "lucide-react";
import { useCollant } from "@/hooks/use-collant";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { rankPlayers } from "@/lib/sfl/engine";
import { computeStandings } from "@/lib/sfl/saisie/engine";
import { StatsAVenir } from "@/components/sfl/feed/stats-a-venir";
import { IlsSeDemarquent } from "@/components/sfl/distinctions";
import { Classements } from "@/components/sfl/classements";
import { CarteJournee } from "@/components/sfl/carte-journee";
import { Nom } from "@/components/sfl/nom";
import { cn } from "@/lib/utils";

/** Les journées jouées : un résultat, un but ou une passe saisis. */
function useJouees() {
  const { journees, saison } = useSeason();
  return journees.filter((j) => saison.entries.some((e) => e.j === j.j && (e.result || e.buts > 0 || e.passes > 0)));
}

export function VueClassements({ vote }: { vote?: React.ReactNode }) {
  const { player, me } = useMyPlayer();
  const { players, saison } = useSeason();
  const played = useJouees();
  const latestJ = played[played.length - 1]?.j ?? 1;

  const RANKED = rankPlayers(players);
  const myRank = RANKED.find((p) => p.name === player.name)?.rank ?? RANKED.length;
  const rankBefore = rankPlayers(computeStandings({ ...saison, entries: saison.entries.filter((e) => e.j !== latestJ) })).find(
    (p) => p.name === player.name
  )?.rank;
  const myDelta = rankBefore ? rankBefore - myRank : 0;
  const myForm = saison.entries
    .filter((e) => e.player === player.name && e.statut === "Présent" && !e.extraTime && e.result)
    .sort((a, b) => a.j - b.j)
    .slice(-5)
    .map((e) => (e.result === "Victoire" ? "V" : e.result === "Nul" ? "N" : "D"));
  const nb = (r: string) => myForm.filter((x) => x === r).length;
  const [colonne, colonneCollante] = useCollant();

  return (
    <div className="flex flex-col gap-6 px-5 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)] md:items-start md:gap-[var(--fib-34)] md:px-0 min-[1440px]:gap-[var(--fib-55)]">
      {/* La petite colonne sur grand écran : le vote, ma synthèse, le Wall of Fame. */}
      <div ref={colonne} className={cn("flex min-w-0 flex-col gap-6", colonneCollante && "md:sticky md:top-[var(--fib-21)]")}>
        {vote}
        {played.length === 0 ? (
          <StatsAVenir numero={saison.numero ?? 0} quoi="classement" archive={saison.archives?.[saison.archives.length - 1]} />
        ) : (
          /* Ma synthèse : rang, points, forme sur 5 matchs. */
          <section className="glass rounded-[26px] p-[18px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="mono-label text-foreground/40">
                  <Nom n={player.name} />
                </p>
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
                <div className="mt-1 text-[34px] leading-none font-extrabold tracking-tight tabular-nums">{player.pp}</div>
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
                  Cinq derniers matchs · {nb("V")} victoire{nb("V") > 1 ? "s" : ""}, {nb("N")} nul{nb("N") > 1 ? "s" : ""}, {nb("D")} défaite
                  {nb("D") > 1 ? "s" : ""}
                </p>
              </>
            )}
          </section>
        )}
        <WallOfFame className="hidden md:flex" />
      </div>
      {played.length === 0 ? <IlsSeDemarquent /> : <Classements me={me} />}
      <WallOfFame className="md:hidden" />
    </div>
  );
}

function WallOfFame({ className }: { className?: string }) {
  return (
    <Link href="/palmares" className={cn("glass flex items-center gap-3.5 rounded-3xl px-4 py-3.5", className)}>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foreground/10">
        <Crown className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold tracking-tight">Wall of Fame</span>
        <span className="block truncate text-[12.5px] text-muted-foreground">Champions, légendes, ton parcours</span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}

export function VueMatchs() {
  const router = useRouter();
  const played = useJouees();
  return (
    <div className="flex flex-col gap-3.5 px-5 md:grid md:grid-cols-2 md:items-start md:gap-[var(--fib-21)] md:px-0 xl:grid-cols-3">
      {[...played].reverse().map((jn) => (
        <CarteJournee key={jn.j} journee={jn} onOuvrir={() => router.push(`/ligue/journee?j=${jn.j}`)} />
      ))}
    </div>
  );
}
