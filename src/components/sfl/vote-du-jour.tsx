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
//     que j'ai mes voix à donner. Mes deux voix données, il se range en une
//     ligne et rend la place à la carte, le sujet de la page ; la toucher le
//     rouvre, pour changer d'avis. Tant que mes voix ne sont pas relues (à
//     l'ouverture de l'app, sur un réseau lent), la ligne seule : ni ouvert ni
//     rangé d'office. Quand il change de hauteur, lib/encart-tenu.ts décide du
//     défilement : à l'écran, sa ligne y reste ; au-dessus de ce que je lis,
//     ce que je lis ne bouge pas. Rangé sous le doigt, le focus passe de la
//     carte choisie à sa ligne ;
//   · la Map : le plan reste au plan, et le bas de l'écran à ses matchs. Une
//     étiquette sous le lettrage de la commune et le compte des matchs, dans
//     la place que le plan garde déjà au lettrage (carte-map.tsx, MARGE_HAUT),
//     ouvre le même bloc dans une feuille (VoteDuJourMap) : le point rouge
//     tant qu'il me reste une voix à donner, la coche ensuite, ni l'un ni
//     l'autre tant que les votes ne sont pas relus. Rien ne passe sur le stade
//     choisi ni sur son nom : sur un téléphone bas, où le stade monte sous le
//     lettrage, l'étiquette se réduit à « Vote » (COURT_…), et à son rond sur
//     un écran très étroit (ROND_…) ; un écran large, même bas, la garde
//     entière.
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
// Toutes les décisions (où le poser, l'encart de Ma carte, la marque de la
// Map, le défilement) sont des fonctions pures de lib/sfl/votes.ts et de
// lib/encart-tenu.ts, gardées par tools/vote-du-jour-check.ts : ce fichier ne
// fait que les appeler.

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Vote } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { VoteFigures } from "@/components/sfl/vote-figures";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsClient } from "@/hooks/use-is-client";
import { useMaintenant } from "@/hooks/use-missions";
import { useVotes, useVotesPrets } from "@/hooks/use-votes";
import { rattrapage, type Bande } from "@/lib/encart-tenu";
import type { Journee } from "@/lib/sfl/engine";
import { estUneHeure, libelleFinDuVote } from "@/lib/sfl/revelation";
import { etatEncart, marqueDuVote, mesDeuxVoix, votesOuvertsPour, type OuPoser } from "@/lib/sfl/votes";
import { cn } from "@/lib/utils";

const ENCRE = "#0A0B0D";
const BLANC = "#F4F5F2";

// Un téléphone bas (un petit iPhone dans Safari, ses barres comprises) : le
// stade choisi, posé au milieu de la largeur, monte jusque sous le lettrage.
// L'étiquette de la Map s'y réduit à son rond et à « Vote », plus près du
// compte : elle s'arrête avant lui. 640 px de haut laissent une dizaine de
// pixels au flottement du stade (map/animations.css, stk-flotte) ; au-delà de
// 480 px de large (un téléphone en largeur, une fenêtre basse d'ordinateur),
// le stade est loin, l'étiquette reste entière. Sous 340 px de large (un
// iPhone 5 ou un SE de première génération), même « Vote » touchait la
// pastille de date du stade : le rond seul. Le texte ôté reste aux lecteurs
// d'écran (sr-only).
const COURT_TEXTE = "[@media(max-height:640px)_and_(max-width:480px)]:sr-only";
const COURT_MONTE = "[@media(max-height:640px)_and_(max-width:480px)]:mt-1.5";
const ROND_TEXTE = "[@media(max-width:340px)]:sr-only";
const ROND_SERRE = "[@media(max-width:340px)]:pr-1";

/** Les journées dont le vote est ouvert et qui se posent là, pour ce joueur (votesOuvertsPour). Rien au rendu serveur. */
function useVotesOuverts(me: string, lesquels: OuPoser): Journee[] {
  const isClient = useIsClient();
  const { journeesDirect: journees, saisonLue } = useSeason();
  const maintenant = useMaintenant();
  return isClient ? votesOuvertsPour(saisonLue, journees, me, maintenant, lesquels) : [];
}

/** Ce qui défile sous l'encart : #app-scroll, où défile toute l'app ; sinon la page. */
function defilant(): HTMLElement | null {
  return document.getElementById("app-scroll");
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
 * (etatEncart). `className` : ses marges, selon la page qui le pose (le fil
 * des Actus par défaut, bord à bord sur téléphone).
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
  const vote = mesDeuxVoix(votes, saisonLue.numero ?? 0, journee.j, me);
  const etat = etatEncart({ repliable, prets, vote, rouvert });
  const plie = etat === "range" || etat === "attente";

  const section = useRef<HTMLElement>(null);
  const ligne = useRef<HTMLButtonElement>(null);
  // Ma voix part d'ici, le focus sur la carte choisie (au clavier, à
  // VoiceOver) : l'encart se range et emporte la carte ; le focus passe à sa
  // ligne au lieu de tomber sur la page.
  const focusIci = useRef(false);
  const etaitPlie = useRef(plie);
  useLayoutEffect(() => {
    const vientDeSeRanger = plie && !etaitPlie.current;
    etaitPlie.current = plie;
    if (!vientDeSeRanger) return;
    const perdu = !document.activeElement || document.activeElement === document.body;
    if (focusIci.current && perdu) ligne.current?.focus({ preventScroll: true });
    focusIci.current = false;
  }, [plie]);

  // L'encart vient de changer : jusqu'à l'image suivante, le défilement relevé
  // reste celui d'avant. Chrome rattrape l'encart dès qu'un écran lit la mise
  // en page et en prévient par un défilement, qui arrive avant le
  // ResizeObserver : relevé, il ferait croire que l'encart était à l'écran.
  const fige = useRef(false);
  useLayoutEffect(() => {
    if (!repliable) return;
    fige.current = true;
    const image = requestAnimationFrame(() => void (fige.current = false));
    return () => cancelAnimationFrame(image);
  }, [etat, repliable]);

  // L'encart change de hauteur (rangé ; déplié quand mes voix relues disent
  // qu'il m'en reste à donner) : lib/encart-tenu.ts dit quoi faire du
  // défilement. Mesuré au ResizeObserver, avant que l'image ne s'affiche.
  useEffect(() => {
    const s = section.current;
    if (!repliable || !s || typeof ResizeObserver === "undefined") return;
    const sc = defilant();
    const lire = () => (sc ? sc.scrollTop : window.scrollY);
    // L'écran utile commence sous la pile des messages de confirmation : la scroll-margin de l'encart.
    const ecran = (): Bande => {
      const r = sc?.getBoundingClientRect();
      const marge = parseFloat(getComputedStyle(s).scrollMarginTop) || 0;
      return r ? { haut: r.top + marge, bas: r.bottom } : { haut: marge, bas: window.innerHeight };
    };
    // Le défilement d'avant (relevé à chaque défilement, sauf juste après un
    // changement de l'encart) et la hauteur d'avant (au dernier changement).
    let defil = lire();
    let hauteur = s.getBoundingClientRect().height;
    const suivre = () => {
      if (!fige.current) defil = lire();
    };
    const ro = new ResizeObserver(() => {
      const r = s.getBoundingClientRect();
      const avant = hauteur;
      hauteur = r.height;
      if (Math.abs(r.height - avant) < 1) return;
      // Ce que le navigateur a déjà rattrapé de lui-même (Chrome : overflow-anchor ; Safari : rien) :
      // l'encart est remis dans le repère d'avant, et seul le reste est fait.
      const deja = defil - lire();
      const haut = r.top - deja;
      const geste = rattrapage({ haut, bas: haut + avant }, { haut, bas: haut + r.height }, ecran());
      if (geste && "ramener" in geste) s.scrollIntoView({ block: "nearest" });
      else if (geste) {
        if (sc) sc.scrollTop = defil + geste.decaler;
        else window.scrollTo(0, defil + geste.decaler);
      }
      defil = lire();
    });
    ro.observe(s);
    const cible: HTMLElement | Window = sc ?? window;
    cible.addEventListener("scroll", suivre, { passive: true });
    return () => {
      ro.disconnect();
      cible.removeEventListener("scroll", suivre);
    };
  }, [repliable]);

  return (
    <section
      ref={section}
      aria-busy={etat === "attente" || undefined}
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
              {vote && (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check aria-hidden className="size-3.5" />
                </span>
              )}
            </div>
            {plie && <p className="mono-label text-encre-3">jusqu&apos;à {libelleFinDuVote(saisonLue, journee.j, maintenant)}</p>}
          </div>
          {/* Mes voix pas encore relues : la ligne seule, rien à toucher. */}
          {etat !== "attente" && (
            <>
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
            </>
          )}
        </div>
      )}
      <div id={corps} hidden={plie}>
        {!plie && (
          <VoteFigures
            journee={journee}
            me={me}
            onVoix={repliable ? () => void (focusIci.current = !!section.current?.contains(document.activeElement)) : undefined}
          />
        )}
      </div>
    </section>
  );
}

/**
 * Sur la Map : l'étiquette du vote, sous le lettrage de la commune ; la
 * toucher ouvre le bloc dans une feuille. Sa marque (marqueDuVote) : le point
 * rouge tant qu'il me reste une voix à donner, la coche une fois les deux
 * données, ni l'un ni l'autre tant que les votes ne sont pas relus. L'heure
 * de la fin dessous, quand c'en est une (« 18 h », « minuit ») : tant que la
 * fin des matchs est inconnue, la feuille la dit en toutes lettres.
 */
export function VoteDuJourMap({ me }: { me: string }) {
  const ouvertes = useVotesOuverts(me, "a-moi");
  const { saisonLue } = useSeason();
  const maintenant = useMaintenant();
  const votes = useVotes();
  const prets = useVotesPrets();
  const [ouvert, setOuvert] = useState(false);
  const j = ouvertes[0];
  if (!j) return null;
  const numero = saisonLue.numero ?? 0;
  const marque = marqueDuVote(prets, ouvertes.every((x) => mesDeuxVoix(votes, numero, x.j, me)));
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
