"use client";

// Le vote du jour, partout (Ilyes, 15/11/2026 : « quand les votes sont
// actifs, mets-les dans les trois onglets […] bien visibles, qu'on les trouve
// partout »). Un seul bloc, celui de vote-figures.tsx, posé dans les trois
// onglets de la barre du bas tant qu'un vote est ouvert :
//   · Actus : juste sous l'en-tête et la rangée de la Pépite d'Or, avant le
//     rail des journées ; en tête de la vue Classement (actus/course.tsx) ;
//   · Ma carte : sous le titre, avant ma carte (app/profil/page.tsx) ;
//   · la Map : le plan reste au plan. Une étiquette dans la pile du bas, à la
//     place et dans la forme des invitations (matchs/invitations.tsx), ouvre
//     le même bloc dans une feuille (VoteDuJourMap).
// Hors vote, rien : useVotesOuverts rend une liste vide et rien ne se pose.
// Le vote se lit sur le direct (useSeason().saisonLue, journeesDirect) : la
// feuille remplie l'ouvre bien avant la révélation (revelation.ts). L'heure
// est celle du serveur, relue chaque minute : à la fin du vote, le bloc s'en
// va de lui-même.
//
// Sur Ma carte et sur la Map, le vote n'est là que pour qui vote (les joueurs
// de la journée, `pourMoi`) ; les Actus le montrent à toute la ligue, comme
// avant. Un joueur Bola, hors de la SFL, ne le voit nulle part : ses écrans
// ne le posent pas.

import { useState } from "react";
import { Check, Vote } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { VoteFigures } from "@/components/sfl/vote-figures";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsClient } from "@/hooks/use-is-client";
import { useMaintenant } from "@/hooks/use-missions";
import { useVotes } from "@/hooks/use-votes";
import { findPlayerMatch, type Journee } from "@/lib/sfl/engine";
import { libelleFinDuVote, voteOuvertA } from "@/lib/sfl/revelation";
import { CATEGORIES_VOTE, feuilleRemplie, journeeAvecVote, monVote } from "@/lib/sfl/votes";
import { cn } from "@/lib/utils";

const ENCRE = "#0A0B0D";
const BLANC = "#F4F5F2";

/**
 * Les journées dont le vote est ouvert ; `pourMoi` : seulement celles où ce
 * joueur peut voter, la feuille de son match remplie (feuilleRemplie) : avant,
 * rien à faire, donc rien sur la Map ni sur Ma carte.
 */
function useVotesOuverts(pourMoi?: string): Journee[] {
  const isClient = useIsClient();
  const { journeesDirect: journees, saisonLue } = useSeason();
  const maintenant = useMaintenant();
  if (!isClient) return [];
  return journees.filter((j) => {
    if (!journeeAvecVote(j) || !voteOuvertA(saisonLue, j.j, maintenant)) return false;
    if (pourMoi === undefined) return true;
    const place = findPlayerMatch(j, pourMoi);
    return !!place && feuilleRemplie(saisonLue, j.j, place.match);
  });
}

function Titre({ j, className }: { j: number; className?: string }) {
  return (
    <span className={className}>
      Vote du jour <span className="text-encre-3">· J{j}</span>
    </span>
  );
}

/**
 * Le bloc : un encart de verre par journée dont le vote est ouvert.
 * `className` : ses marges, selon la page qui le pose (le fil des Actus par
 * défaut, bord à bord sur téléphone).
 */
export function VoteDuJour({ me, pourMoi = false, className = "mx-4 md:mx-0" }: { me: string; pourMoi?: boolean; className?: string }) {
  const ouvertes = useVotesOuverts(pourMoi ? me : undefined);
  return (
    <>
      {ouvertes.map((j) => (
        <section key={j.j} className={cn("glass flex flex-col gap-3 rounded-[26px] p-[18px]", className)}>
          <h2 className="text-titre font-bold tracking-tight">
            <Titre j={j.j} />
          </h2>
          <VoteFigures journee={j} me={me} />
        </section>
      ))}
    </>
  );
}

/**
 * Sur la Map : l'étiquette du vote, dans la pile du bas ; la toucher ouvre le
 * bloc dans une feuille. Le point rouge tant qu'il me reste une voix à donner,
 * la coche une fois les deux données.
 */
export function VoteDuJourMap({ me }: { me: string }) {
  const ouvertes = useVotesOuverts(me);
  const { saisonLue } = useSeason();
  const maintenant = useMaintenant();
  const votes = useVotes();
  const [ouvert, setOuvert] = useState(false);
  const j = ouvertes[0];
  if (!j) return null;
  const numero = saisonLue.numero ?? 0;
  const fait = ouvertes.every((x) => CATEGORIES_VOTE.every((cat) => !!monVote(votes, numero, x.j, cat, me)));
  return (
    <div className="w-full px-4">
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        className="map-monte map-touche flex w-full items-center gap-3 rounded-[22px] py-2.5 pr-4 pl-2.5 text-left shadow-[0_6px_14px_rgba(0,0,0,0.22)]"
        style={{ background: BLANC, color: ENCRE }}
      >
        <span className="relative shrink-0">
          <span className="grid size-11 place-items-center rounded-full" style={{ background: ENCRE, color: BLANC }}>
            <Vote className="size-5" strokeWidth={2.2} />
          </span>
          {!fait && (
            <span aria-hidden className="absolute -top-1 -right-1 size-3 rounded-full" style={{ background: "#FF3B30", boxShadow: `0 0 0 2px ${BLANC}` }} />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lecture font-bold tracking-[-0.2px]">
            Vote du jour <span className="opacity-50">· J{j.j}</span>
          </span>
          <span className="truncate text-corps font-medium opacity-60">jusqu&apos;à {libelleFinDuVote(saisonLue, j.j, maintenant)}</span>
        </span>
        {fait && (
          <span className="grid size-6 shrink-0 place-items-center rounded-full" style={{ background: ENCRE, color: BLANC }}>
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        )}
      </button>
      <Sheet open={ouvert} onOpenChange={setOuvert} titre="le vote">
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-[28px] px-5 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] sm:max-w-md"
        >
          {ouvertes.map((x, i) => (
            <section key={x.j} className="flex flex-col gap-3">
              {i === 0 ? (
                // À la hauteur de la rangée de la croix (sheet.tsx), qui se pose sur elle.
                <SheetTitle className="flex min-h-14 items-center pr-12 text-titre-fort font-extrabold tracking-tight">
                  <Titre j={x.j} />
                </SheetTitle>
              ) : (
                <h2 className="text-titre-fort font-extrabold tracking-tight">
                  <Titre j={x.j} />
                </h2>
              )}
              <VoteFigures journee={x} me={me} />
            </section>
          ))}
        </SheetContent>
      </Sheet>
    </div>
  );
}
