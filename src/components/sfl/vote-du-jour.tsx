"use client";

// Le vote du jour, partout (Ilyes, 15/11/2026 : « quand les votes sont
// actifs, mets-les dans les trois onglets […] bien visibles, qu'on les trouve
// partout »). Un seul bloc, celui de vote-figures.tsx, posé dans les trois
// onglets de la barre du bas tant qu'un vote est ouvert :
//   · Actus : juste sous l'en-tête et la rangée de la Pépite d'Or, avant le
//     rail des journées, dès qu'on y vote (la feuille de mon match remplie ;
//     si je ne joue pas la journée, celle d'un match au moins). Avant, il
//     attend, grisé, sous la feuille en direct, qui passe d'abord. Dans la vue
//     Classement, en tête de sa colonne, sous le podium et la rangée, dans
//     tous les cas (actus/course.tsx, actus/vues.tsx) ;
//   · Ma carte : sous le titre, avant ma carte (app/profil/page.tsx). Mes
//     deux voix données, il se range en une ligne et rend la place à la
//     carte, le sujet de la page ; la toucher le rouvre, pour changer d'avis.
//     Rangé sous le doigt, sa ligne reste à l'écran ;
//   · la Map : le plan reste au plan, et le bas de l'écran à ses matchs. Une
//     étiquette sous le lettrage de la commune et le compte des matchs, dans
//     la place que le plan garde déjà au lettrage (carte-map.tsx, MARGE_HAUT),
//     ouvre le même bloc dans une feuille (VoteDuJourMap). Rien ne passe sur
//     le stade choisi ni sur son nom ; sur un écran bas, où le stade monte
//     sous le lettrage, l'étiquette se réduit (COURT_CACHE).
// Hors vote, rien : useVotesOuverts rend une liste vide et rien ne se pose.
// Le vote se lit sur le direct (useSeason().saisonLue, journeesDirect) : la
// feuille remplie l'ouvre bien avant la révélation (revelation.ts). L'heure
// est celle du serveur, relue chaque minute : à la fin du vote, le bloc s'en
// va de lui-même.
//
// Sur Ma carte et sur la Map, le vote n'est là que pour qui a une voix à
// donner (`a-moi` : un joueur de la journée, la feuille de son match
// remplie) : avant, rien à faire, donc rien. Les Actus le montrent à toute la
// ligue, comme avant. Un joueur Bola, hors de la SFL, ne le voit nulle part :
// ses écrans ne le posent pas.

import { useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Vote } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { VoteFigures } from "@/components/sfl/vote-figures";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsClient } from "@/hooks/use-is-client";
import { useMaintenant } from "@/hooks/use-missions";
import { useVotes } from "@/hooks/use-votes";
import type { Journee } from "@/lib/sfl/engine";
import { estUneHeure, libelleFinDuVote, voteOuvertA } from "@/lib/sfl/revelation";
import { CATEGORIES_VOTE, etatDuVote, journeeAvecVote, monVote, type EtatDuVote, type VoteFigure } from "@/lib/sfl/votes";
import { cn } from "@/lib/utils";

const ENCRE = "#0A0B0D";
const BLANC = "#F4F5F2";

// Un écran bas (un petit iPhone dans Safari, ses barres comprises) : le stade
// choisi monte jusque sous le lettrage. L'étiquette de la Map s'y réduit à
// son rond et à « Vote », plus près du compte : elle s'arrête avant lui.
const COURT_CACHE = "[@media(max-height:625px)]:hidden";
const COURT_MONTE = "[@media(max-height:625px)]:mt-1.5";

/**
 * Lesquelles poser, d'après où en est le vote pour moi (etatDuVote,
 * lib/sfl/votes.ts) : toutes (la vue Classement), celles où j'ai une voix à
 * donner (Ma carte, la Map), celles où l'on vote déjà (en tête du fil), ou
 * celles qui attendent leur feuille (sous la feuille en direct). `ouverts`
 * et `en-attente` se complètent : une journée n'est jamais posée deux fois
 * dans le fil.
 */
type Lesquels = "tous" | "a-moi" | "ouverts" | "en-attente";

const GARDE: Record<Lesquels, (etat: EtatDuVote) => boolean> = {
  tous: () => true,
  "a-moi": (etat) => etat === "a-moi",
  ouverts: (etat) => etat !== "en-attente",
  "en-attente": (etat) => etat === "en-attente",
};

/** Les journées dont le vote est ouvert, pour ce joueur, parmi celles qu'on demande. */
function useVotesOuverts(me: string, lesquels: Lesquels): Journee[] {
  const isClient = useIsClient();
  const { journeesDirect: journees, saisonLue } = useSeason();
  const maintenant = useMaintenant();
  if (!isClient) return [];
  return journees.filter((j) => journeeAvecVote(j) && voteOuvertA(saisonLue, j.j, maintenant) && GARDE[lesquels](etatDuVote(saisonLue, j, me)));
}

/** Mes deux voix sont-elles données dans cette journée ? */
function aVote(votes: VoteFigure[], saison: number, j: number, me: string): boolean {
  return CATEGORIES_VOTE.every((cat) => !!monVote(votes, saison, j, cat, me));
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
 * `lesquels` : voir Lesquels. `repliable` (Ma carte) : mes deux voix données,
 * l'encart se range en une ligne. `className` : ses marges, selon la page qui
 * le pose (le fil des Actus par défaut, bord à bord sur téléphone).
 */
export function VoteDuJour({
  me,
  lesquels = "tous",
  repliable = false,
  className = "mx-4 md:mx-0",
}: {
  me: string;
  lesquels?: Lesquels;
  repliable?: boolean;
  className?: string;
}) {
  const ouvertes = useVotesOuverts(me, lesquels);
  return (
    <>
      {ouvertes.map((j) => (
        <Encart key={j.j} journee={j} me={me} repliable={repliable} className={className} />
      ))}
    </>
  );
}

/** L'encart d'une journée. Sur grand écran, il s'arrête à la largeur de ses cinq cartes. */
function Encart({ journee, me, repliable, className }: { journee: Journee; me: string; repliable: boolean; className?: string }) {
  const { saisonLue } = useSeason();
  const maintenant = useMaintenant();
  const votes = useVotes();
  const corps = useId();
  // Rangé d'office une fois mes deux voix données ; rouvert à la main, il le
  // reste (changer d'avis ne le referme pas sous le doigt).
  const [rouvert, setRouvert] = useState(false);
  const range = repliable && aVote(votes, saisonLue.numero ?? 0, journee.j, me);
  const plie = range && !rouvert;
  // Ma seconde voix donnée ici même, l'encart se range sous le doigt. Sur un
  // petit téléphone, on a défilé jusqu'à la seconde rangée : sa ligne, restée
  // plus haut, revient à l'écran, dans la même image (Safari ne retient pas
  // la page tout seul ; hooks/use-fil-au-bas.ts). Rien ne bouge si elle y est
  // déjà, ni si les voix arrivent d'ailleurs sans que j'aie touché l'encart.
  const section = useRef<HTMLElement>(null);
  const touche = useRef(false);
  const etaitRange = useRef(range);
  useLayoutEffect(() => {
    if (range && !etaitRange.current && touche.current) section.current?.scrollIntoView({ block: "nearest" });
    etaitRange.current = range;
  }, [range]);
  return (
    <section
      ref={section}
      onClickCapture={repliable ? () => void (touche.current = true) : undefined}
      className={cn("glass flex scroll-mt-[calc(env(safe-area-inset-top,0px)+1rem)] flex-col gap-3 rounded-[26px] p-[18px] md:max-w-[34rem]", className)}
    >
      {range ? (
        <div className="relative flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-titre font-bold tracking-tight">
                <Titre j={journee.j} />
              </h2>
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Check aria-hidden className="size-3.5" />
              </span>
            </div>
            {plie && <p className="mono-label text-encre-3">jusqu&apos;à {libelleFinDuVote(saisonLue, journee.j, maintenant)}</p>}
          </div>
          <ChevronDown
            aria-hidden
            className={cn("size-5 shrink-0 text-encre-3 transition-transform duration-300 motion-reduce:transition-none", !plie && "rotate-180")}
            strokeWidth={1.8}
          />
          {/* Toute la ligne se touche, jusqu'aux bords de l'encart. */}
          <button
            type="button"
            aria-label={`Vote du jour, J${journee.j}, voté`}
            aria-expanded={!plie}
            aria-controls={corps}
            onClick={() => setRouvert((o) => !o)}
            className="absolute -inset-[18px] rounded-[26px]"
          />
        </div>
      ) : (
        <h2 className="text-titre font-bold tracking-tight">
          <Titre j={journee.j} />
        </h2>
      )}
      <div id={corps} hidden={plie}>
        {!plie && <VoteFigures journee={journee} me={me} />}
      </div>
    </section>
  );
}

/**
 * Sur la Map : l'étiquette du vote, sous le lettrage de la commune ; la
 * toucher ouvre le bloc dans une feuille. Le point rouge tant qu'il me reste
 * une voix à donner, la coche une fois les deux données. L'heure de la fin
 * dessous, quand c'en est une (« 18 h », « minuit ») : tant que la fin des
 * matchs est inconnue, la feuille la dit en toutes lettres.
 */
export function VoteDuJourMap({ me }: { me: string }) {
  const ouvertes = useVotesOuverts(me, "a-moi");
  const { saisonLue } = useSeason();
  const maintenant = useMaintenant();
  const votes = useVotes();
  const [ouvert, setOuvert] = useState(false);
  const j = ouvertes[0];
  if (!j) return null;
  const fait = ouvertes.every((x) => aVote(votes, saisonLue.numero ?? 0, x.j, me));
  const jusqua = libelleFinDuVote(saisonLue, j.j, maintenant);
  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-haspopup="dialog"
        className={cn(
          "compte-entre map-touche pointer-events-auto mt-3 flex max-w-full items-center gap-2 rounded-full py-1 pr-3.5 pl-1 text-left shadow-[0_6px_14px_rgba(0,0,0,0.22)]",
          COURT_MONTE,
        )}
        style={{ background: BLANC, color: ENCRE }}
      >
        <span className="relative shrink-0">
          <span className="grid size-8 place-items-center rounded-full" style={{ background: ENCRE, color: BLANC }}>
            {fait ? <Check aria-hidden className="size-4" strokeWidth={3} /> : <Vote aria-hidden className="size-4" strokeWidth={2.2} />}
          </span>
          {!fait && (
            <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full" style={{ background: "#FF3B30", boxShadow: `0 0 0 2px ${BLANC}` }} />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-corps leading-[1.2] font-bold tracking-[-0.2px]">
            Vote
            <span className={COURT_CACHE}>
              {" "}
              du jour <span className="opacity-50">· J{j.j}</span>
            </span>
            {fait && <span className="sr-only">, voté</span>}
          </span>
          {estUneHeure(jusqua) && <span className={cn("truncate text-[11px] leading-[1.2] font-medium opacity-60", COURT_CACHE)}>jusqu&apos;à {jusqua}</span>}
        </span>
      </button>
      <Sheet open={ouvert} onOpenChange={setOuvert} titre="le vote">
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-[28px] px-5 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] sm:max-w-md"
        >
          {ouvertes.map((x, i) => (
            // Les coins du bloc, sans son verre : les titres d'un bloc (« Joueur
            // Impact ») se dessinent d'après eux (styles-ui*.css), comme dans
            // les deux autres onglets ; « hors-carte » leur dit de ne poser ni
            // cerne ni fond (leurs :not([class*="carte"])).
            <section key={x.j} className="vote-hors-carte flex flex-col gap-3 rounded-[26px]">
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
    </>
  );
}
