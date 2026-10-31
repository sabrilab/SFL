"use client";

// Les deux autres onglets des Actus, à côté de la Pépite d'Or (Sabri, 22/10 :
// « on peut pas avoir accès à tout le classement comme on avait avant […]
// faire un mix des deux » ; 24/10 : Buteurs, Passeurs, MVP « dans un bouton
// Classement », et « juste à côté, l'onglet Match »), tels qu'ils étaient
// dans la Ligue avant les Actus (app/ligue/page.tsx avant #71) :
//   · Classement : le vote du jour, ma synthèse (rang, points, forme), tous
//     les classements (classements.tsx) ;
//   · Match : les journées jouées, une carte chacune ; la toucher ouvre son
//     récap (/ligue/journee?j=N).
// Les deux servent aussi une saison close (le choix de la saison,
// epoques.tsx) : ma synthèse n'y paraît que si j'y ai joué. Le Wall of Fame,
// qui avait sa carte ici, est dans le même choix.
// Sur grand écran (dès 768 px) : les Classements au nombre d'or, ma synthèse
// à gauche (qui reste à l'écran) et tous les classements à droite ; les
// Matchs en grille, deux terrains de front, trois dès 1280 px.

import { useRouter } from "next/navigation";
import { useCollant } from "@/hooks/use-collant";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { rankPlayers } from "@/lib/sfl/engine";
import { rangPepiteApres } from "@/lib/sfl/rangs";
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

/**
 * `classement` : celui qui s'ouvre (un id de lib/sfl/rankings.ts, ?classement=… dans l'adresse).
 * `cle` : la clé 3D des cartes d'une saison close (classements.tsx).
 */
export function VueClassements({ vote, classement, cle }: { vote?: React.ReactNode; classement?: string | null; cle?: string }) {
  const { player, me } = useMyPlayer();
  const { players, saison, allPlayers, evolution } = useSeason();
  // Une saison close où je n'ai pas joué : pas de synthèse (ce serait celle d'un autre).
  const joue = allPlayers.some((p) => p.name === me);
  const played = useJouees();
  const latestJ = played[played.length - 1]?.j ?? 1;

  const RANKED = rankPlayers(players);
  const myRank = RANKED.find((p) => p.name === player.name)?.rank ?? RANKED.length;
  // Avant / après le dernier dimanche, sur la même règle (rangs.ts).
  const precedente = played.length > 1 ? played[played.length - 2].j : 0;
  const rankBefore = precedente ? rangPepiteApres(saison, player.name, precedente, evolution) : null;
  const rankNow = rangPepiteApres(saison, player.name, latestJ, evolution);
  const myDelta = rankBefore && rankNow ? rankBefore - rankNow : 0;
  const myForm = saison.entries
    .filter((e) => e.player === player.name && e.statut === "Présent" && !e.extraTime && e.result)
    .sort((a, b) => a.j - b.j)
    .slice(-5)
    .map((e) => (e.result === "Victoire" ? "V" : e.result === "Nul" ? "N" : "D"));
  const nb = (r: string) => myForm.filter((x) => x === r).length;
  const [colonne, colonneCollante] = useCollant();
  // Rien à mettre dans la petite colonne : les classements prennent toute la largeur.
  const colonneVide = !vote && played.length > 0 && !joue;

  return (
    <div
      className={cn(
        "flex flex-col gap-6 px-5 md:px-0",
        !colonneVide && "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.618fr)] md:items-start md:gap-[var(--fib-34)] min-[1440px]:gap-[var(--fib-55)]",
      )}
    >
      {/* La petite colonne sur grand écran : le vote, ma synthèse. */}
      <div ref={colonne} className={cn("flex min-w-0 flex-col gap-6", colonneVide && "hidden", colonneCollante && "md:sticky md:top-[var(--fib-21)]")}>
        {vote}
        {played.length === 0 ? (
          <StatsAVenir numero={saison.numero ?? 0} quoi="classement" archive={saison.archives?.[saison.archives.length - 1]} />
        ) : joue ? (
          /* Ma synthèse : rang, points, forme sur 5 matchs. */
          <section className="glass rounded-[26px] p-[18px]">
            <div className="flex items-center justify-between">
              <div>
                <p className="mono-label text-encre-3">
                  <Nom n={player.name} />
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-nom leading-none font-extrabold tracking-tight">
                    {myRank}
                    <span className="text-titre text-encre-3">e</span>
                  </span>
                  {myDelta !== 0 && (
                    <span className={cn("mono-label", myDelta > 0 ? "text-primary" : "text-encre-3")}>
                      {myDelta > 0 ? `▲ ${myDelta}` : `▼ ${-myDelta}`}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="mono-label text-encre-3">Points</p>
                <div className="mt-1 text-nom leading-none font-extrabold tracking-tight tabular-nums">{player.pp}</div>
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
                          ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                          : r === "N"
                            ? { background: "rgb(var(--foreground-rgb) / 0.14)", color: "var(--foreground)" }
                            : { background: "rgb(var(--foreground-rgb) / 0.06)", color: "rgb(var(--foreground-rgb) / 0.45)" }
                      }
                    >
                      <span className="mono-label">{r}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-[11px] text-corps text-encre-3">
                  Cinq derniers matchs · {nb("V")} victoire{nb("V") > 1 ? "s" : ""}, {nb("N")} nul{nb("N") > 1 ? "s" : ""}, {nb("D")} défaite
                  {nb("D") > 1 ? "s" : ""}
                </p>
              </>
            )}
          </section>
        ) : null}
      </div>
      {played.length === 0 ? <IlsSeDemarquent /> : <Classements me={me} initial={classement} cle={cle} />}
    </div>
  );
}

/** `ouvrir` : où mène un terrain touché ; par défaut, le récap de ce dimanche dans la saison en cours. */
export function VueMatchs({ ouvrir }: { ouvrir?: (j: number) => void }) {
  const router = useRouter();
  const played = useJouees();
  return (
    <div className="flex flex-col gap-3.5 px-5 md:grid md:grid-cols-2 md:items-start md:gap-[var(--fib-21)] md:px-0 xl:grid-cols-3">
      {[...played].reverse().map((jn) => (
        <CarteJournee key={jn.j} journee={jn} onOuvrir={() => (ouvrir ? ouvrir(jn.j) : router.push(`/ligue/journee?j=${jn.j}`))} />
      ))}
    </div>
  );
}
