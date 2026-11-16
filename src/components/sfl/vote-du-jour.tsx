"use client";

// Le vote du jour, partout (Ilyes, 15/11/2026 : « quand les votes sont
// actifs, mets-les dans les trois onglets […] bien visibles, qu'on les trouve
// partout »). Un seul bloc, celui de vote-figures.tsx, posé dans les trois
// onglets de la barre du bas tant qu'un vote est ouvert :
//   · Actus : juste sous l'en-tête et la rangée de la Pépite d'Or, avant le
//     rail des journées, dès qu'on y vote (la feuille de mon match remplie ;
//     si je ne joue pas la journée, celle d'un match au moins). Avant, il
//     attend sous la feuille en direct, qui passe d'abord, grisé : son
//     bandeau gris (« Vote à la fin du Match 1 » ; « Vote à la fin des
//     matchs » pour qui ne joue pas) et, si je joue, mes cartes grisées. Dans
//     la vue Classement, en tête de sa colonne, sous le podium et la rangée,
//     dans tous les cas (actus/course.tsx, actus/vues.tsx) ;
//   · Ma carte : sous le titre, avant ma carte (app/profil/page.tsx), tant
//     que je peux voter (la feuille de mon match remplie, le vote pas encore
//     fermé). Mes deux voix données, il se range en une ligne et rend la
//     place à la carte, le sujet de la page ; la toucher le rouvre, pour
//     changer d'avis. À l'ouverture de l'app, avant que mes voix soient
//     relues, il part de ce que ce téléphone en a retenu (rangé si elles y
//     étaient données, ouvert sinon). Quand il change de place (rangé,
//     déplié, paru, parti), hooks/use-encart-tenu.ts tient le défilement,
//     pour tous les encarts de la page à la fois (lib/encart-tenu.ts) : à
//     l'écran, il change sous mes yeux ; au-dessus de ce que je lis, ce que je
//     lis ne bouge pas ; rangé sous ma voix, sa ligne revient sous la pile des
//     messages. Si le focus était dans l'encart quand il se range, il passe à
//     sa ligne ;
//   · la Map : le plan reste au plan, et le bas de l'écran à ses matchs. Une
//     étiquette sous le lettrage de la commune et le compte des matchs, dans
//     la place que le plan garde déjà au lettrage (carte-map.tsx, MARGE_HAUT),
//     ouvre le même bloc dans une feuille (VoteDuJourMap) : la coche dès que
//     mes deux voix sont connues de ce téléphone (relues, envoyées d'ici, ou
//     retenues de la dernière fois), le point rouge une fois les votes relus
//     s'il m'en reste à donner, rien avant. Rien ne passe sur le stade choisi
//     ni sur son nom : sur un téléphone bas, où le stade monte sous le
//     lettrage, l'étiquette se réduit à « Vote » (COURT_…), et à son rond sur
//     un écran étroit (ROND_…) ; un écran large, même bas, la garde entière.
// Hors vote, rien : votesOuvertsPour rend une liste vide et rien ne se pose.
// Le vote se lit sur le direct (useSeason().saisonLue, journeesDirect) : la
// feuille remplie l'ouvre bien avant la révélation (revelation.ts). L'heure
// est celle du serveur, relue chaque minute : à la fin du vote, le bloc s'en
// va de lui-même.
//
// Sur Ma carte et sur la Map, le vote n'est là que pour qui a ses voix à
// donner (`a-moi` : un titulaire de la journée, la feuille de son match
// remplie ; venu seulement en extra time, on ne vote pas) : avant, rien à
// faire, donc rien. Les Actus le montrent à toute la ligue, comme avant. Un
// joueur Bola, hors de la SFL, ne le voit nulle part : ses écrans ne le posent
// pas (app/map/page.tsx, app/profil/page.tsx).
//
// Les décisions sont des fonctions pures de lib/sfl/votes.ts (où le poser,
// mes voix à l'écran, l'encart, la marque) et de lib/encart-tenu.ts (le
// défilement), jouées par tools/vote-du-jour-check.ts, qui garde aussi par
// des motifs de texte la façon dont ce fichier les appelle.

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Vote } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { VoteFigures } from "@/components/sfl/vote-figures";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { rangeSousMaVoix, useEncartTenu, useTenueDesEncarts } from "@/hooks/use-encart-tenu";
import { useIsClient } from "@/hooks/use-is-client";
import { useMaintenant } from "@/hooks/use-missions";
import { useVotes, useVotesPrets } from "@/hooks/use-votes";
import type { Journee } from "@/lib/sfl/engine";
import { estUneHeure, libelleFinDuVote } from "@/lib/sfl/revelation";
import {
  cleDuVote,
  estPlie,
  etatEncart,
  marqueDuVote,
  mesDeuxVoix,
  retenirVoix,
  voixQuiRange,
  voixRetenues,
  voteFait,
  votesOuvertsPour,
  type CategorieVote,
  type OuPoser,
} from "@/lib/sfl/votes";
import { cn } from "@/lib/utils";

const ENCRE = "#0A0B0D";
const BLANC = "#F4F5F2";

// Un téléphone bas (un petit iPhone dans Safari, ses barres comprises) : le
// stade choisi, posé au milieu de la largeur, monte jusque sous le lettrage.
// L'étiquette de la Map s'y réduit à son rond et à « Vote », plus près du
// compte : elle s'arrête avant lui. 640 px de haut laissent une dizaine de
// pixels au flottement du stade (map/animations.css, stk-flotte) ; au-delà de
// 480 px de large (un téléphone en largeur, une fenêtre basse d'ordinateur),
// le stade est loin, l'étiquette reste entière. Sous 360 px de large (un
// iPhone 5, un SE de première génération, quelques Android), même « Vote »
// frôlait la pastille de date du stade (3 px à 341 px de large, 12 px à 360) :
// le rond seul. Le texte ôté reste aux lecteurs d'écran (sr-only).
const COURT_TEXTE = "[@media(max-height:640px)_and_(max-width:480px)]:sr-only";
const COURT_MONTE = "[@media(max-height:640px)_and_(max-width:480px)]:mt-1.5";
const ROND_TEXTE = "[@media(max-width:359px)]:sr-only";
const ROND_SERRE = "[@media(max-width:359px)]:pr-1";

/** Les journées dont le vote est ouvert et qui se posent là, pour ce joueur (votesOuvertsPour). Rien au rendu serveur. */
function useVotesOuverts(me: string, lesquels: OuPoser): Journee[] {
  const isClient = useIsClient();
  const { journeesDirect: journees, saisonLue } = useSeason();
  const maintenant = useMaintenant();
  return isClient ? votesOuvertsPour(saisonLue, journees, me, maintenant, lesquels) : [];
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
 * `lesquels` : où il se pose (OuPoser, lib/sfl/votes.ts). `repliable` (Ma
 * carte) : mes deux voix données, l'encart se range en une ligne
 * (etatEncart), et le défilement est tenu pour tous les encarts à la fois
 * (useTenueDesEncarts). `className` : ses marges, selon la page qui le pose
 * (le fil des Actus par défaut, bord à bord sur téléphone).
 */
export function VoteDuJour({
  me,
  lesquels = "tous",
  repliable = false,
  className = "mx-4 md:mx-0",
}: {
  me: string;
  lesquels?: OuPoser;
  repliable?: boolean;
  className?: string;
}) {
  const ouvertes = useVotesOuverts(me, lesquels);
  // Tenu dès avant qu'un encart paraisse : le défilement d'avant est connu.
  useTenueDesEncarts(repliable);
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
  const prets = useVotesPrets();
  const corps = useId();
  // Rouverte à la main, la ligne le reste (changer d'avis ne la referme pas sous le doigt).
  const [rouvert, setRouvert] = useState(false);
  const numero = saisonLue.numero ?? 0;
  const cle = cleDuVote(numero, journee.j, me);
  // Ce que ce téléphone a retenu de mes voix à sa dernière lecture : lu à l'ouverture de l'encart.
  const retenu = useMemo(() => voixRetenues(cle), [cle]);
  const vote = mesDeuxVoix(votes, numero, journee.j, me);
  const fait = voteFait({ prets, vote, retenu });
  const etat = etatEncart({ repliable, fait, rouvert });
  const plie = estPlie(etat);
  useEffect(() => {
    if (prets || vote) retenirVoix(cle, vote);
  }, [cle, prets, vote]);

  const section = useRef<HTMLElement>(null);
  const ligne = useRef<HTMLButtonElement>(null);
  useEncartTenu(section, repliable, etat);

  // Le focus est-il dans l'encart ? Il en sort vraiment (un clic à côté, Tab)
  // quand la carte qu'il quitte est encore là ; retirée de la page (l'encart se
  // range sous elle), elle n'y est plus, et le focus y était.
  const dedans = useRef(false);
  useEffect(() => {
    const s = section.current;
    if (!s) return;
    const entre = () => void (dedans.current = true);
    const sort = (e: FocusEvent) => {
      if (e.relatedTarget instanceof Node && s.contains(e.relatedTarget)) return;
      const quitte = e.target instanceof Node ? e.target : null;
      queueMicrotask(() => {
        if (quitte?.isConnected && !s.contains(document.activeElement)) dedans.current = false;
      });
    };
    s.addEventListener("focusin", entre);
    s.addEventListener("focusout", sort);
    return () => {
      s.removeEventListener("focusin", entre);
      s.removeEventListener("focusout", sort);
    };
  }, []);

  // Une voix part d'ici et c'est celle qui manquait : l'encart va se ranger
  // sous elle, le temps de l'envoi. On note si le focus était sur une de ses
  // cartes à ce moment-là : pendant l'envoi, les cartes sont grisées et le
  // navigateur lâche le focus avant que l'encart se range.
  const sousMaVoix = useRef<{ focus: boolean } | null>(null);
  const onVoix = (cat: CategorieVote) => {
    if (!voixQuiRange(votes, numero, journee.j, me, cat)) return undefined;
    sousMaVoix.current = { focus: !!section.current?.contains(document.activeElement) };
    return () => void (sousMaVoix.current = null);
  };

  // Il vient de se ranger : sous ma voix, sa ligne revient sous la pile des
  // messages (use-encart-tenu) ; le focus qui était sur une de ses cartes
  // (ma voix donnée au clavier, ou des voix venues d'ailleurs) passe à sa
  // ligne au lieu de tomber sur la page.
  const etaitPlie = useRef(plie);
  useLayoutEffect(() => {
    const vientDeSeRanger = plie && !etaitPlie.current;
    etaitPlie.current = plie;
    if (!vientDeSeRanger) return;
    const voix = sousMaVoix.current;
    if (voix) rangeSousMaVoix(section.current);
    const perdu = !document.activeElement || document.activeElement === document.body;
    if (perdu && (dedans.current || voix?.focus)) ligne.current?.focus({ preventScroll: true });
  }, [plie]);

  return (
    <section
      ref={section}
      // Ramenée à l'écran, la ligne se pose sous la pile des messages de confirmation (en haut au
      // centre, layout.tsx) : 7 rem de marge, plus la zone sûre.
      className={cn("glass flex scroll-mt-[calc(env(safe-area-inset-top,0px)+7rem)] flex-col gap-3 rounded-[26px] p-[18px] md:max-w-[34rem]", className)}
    >
      {etat === "ouvert" ? (
        <h2 className="text-titre font-bold tracking-tight">
          <Titre j={journee.j} />
        </h2>
      ) : (
        <div className="relative flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex min-h-5 items-center gap-2">
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
            ref={ligne}
            type="button"
            aria-label={`Vote du jour, J${journee.j}, voté`}
            aria-expanded={!plie}
            aria-controls={corps}
            onClick={() => setRouvert((o) => !o)}
            className="absolute -inset-[18px] rounded-[26px]"
          />
        </div>
      )}
      <div id={corps} hidden={plie}>
        {!plie && <VoteFigures journee={journee} me={me} onVoix={repliable ? onVoix : undefined} />}
      </div>
    </section>
  );
}

/**
 * Sur la Map : l'étiquette du vote, sous le lettrage de la commune ; la
 * toucher ouvre le bloc dans une feuille. Sa marque (marqueDuVote) : la coche
 * dès que mes deux voix sont connues de ce téléphone (voteFait : relues,
 * envoyées d'ici, ou retenues de la dernière fois), le point rouge une fois
 * les votes relus s'il m'en reste à donner, rien avant. L'heure de la fin
 * dessous, quand c'en est une (« 18 h », « minuit ») : tant que la fin des
 * matchs est inconnue, la feuille la dit en toutes lettres.
 */
export function VoteDuJourMap({ me }: { me: string }) {
  const ouvertes = useVotesOuverts(me, "a-moi");
  const { saisonLue } = useSeason();
  const maintenant = useMaintenant();
  const votes = useVotes();
  const prets = useVotesPrets();
  const [ouvert, setOuvert] = useState(false);
  const numero = saisonLue.numero ?? 0;
  // Relues, mes voix de chaque journée sont retenues pour la prochaine ouverture de l'app.
  useEffect(() => {
    if (!prets) return;
    for (const x of ouvertes) retenirVoix(cleDuVote(numero, x.j, me), mesDeuxVoix(votes, numero, x.j, me));
  }, [prets, ouvertes, numero, me, votes]);
  const j = ouvertes[0];
  if (!j) return null;
  // Mes deux voix dans chaque journée : connues d'ici, sinon ce que ce téléphone en a retenu.
  const fait = ouvertes.every((x) => voteFait({ prets, vote: mesDeuxVoix(votes, numero, x.j, me), retenu: voixRetenues(cleDuVote(numero, x.j, me)) }));
  const marque = marqueDuVote(prets, fait);
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
          ROND_SERRE,
        )}
        style={{ background: BLANC, color: ENCRE }}
      >
        <span className="relative shrink-0">
          <span className="grid size-8 place-items-center rounded-full" style={{ background: ENCRE, color: BLANC }}>
            {marque === "coche" ? <Check aria-hidden className="size-4" strokeWidth={3} /> : <Vote aria-hidden className="size-4" strokeWidth={2.2} />}
          </span>
          {marque === "point" && (
            <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full" style={{ background: "#FF3B30", boxShadow: `0 0 0 2px ${BLANC}` }} />
          )}
        </span>
        <span className={cn("flex min-w-0 flex-col", ROND_TEXTE)}>
          <span className="truncate text-corps leading-[1.2] font-bold tracking-[-0.2px]">
            Vote
            <span className={COURT_TEXTE}>
              {" "}
              du jour <span className="opacity-50">· J{j.j}</span>
            </span>
            {marque === "coche" && <span className="sr-only">, voté</span>}
          </span>
          {estUneHeure(jusqua) && <span className={cn("truncate text-[11px] leading-[1.2] font-medium opacity-60", COURT_TEXTE)}>jusqu&apos;à {jusqua}</span>}
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
