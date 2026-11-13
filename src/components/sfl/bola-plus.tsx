"use client";

// Bola Plus, la précommande (Sabri, 12/11/2026 ; lib/sfl/bola-plus.ts) : ce
// que le joueur en voit.
//
//   · TuileBolaPlus : l'entrée sur Ma carte, sous « Personnaliser ma carte » et
//     « Inviter », sur toute la largeur. Son nom, et « C'est noté » une fois
//     l'intérêt enregistré. Elle ouvre /profil/bola-plus ;
//   · PageBolaPlus : la page, une présentation (retour de Sabri, 12/11 23:08 :
//     « une meilleure mise en avant des avantages », comme une annonce de
//     nouveautés ou la présentation d'un passe). De haut en bas :
//       – AfficheBolaPlus : le stade de Bola la nuit, bord à bord, le retour,
//         le nom et les deux prix ;
//       – quatre CarteAvantage, une sous l'autre : un avantage par carte, son
//         visuel plein cadre, son numéro, son titre. Rien d'autre. « Tes
//         maillots » montre d'abord le portant ; les maillots portés
//         (Avantage.depose, un fichier gardé hors du dépôt) ne prennent sa
//         place qu'une fois chargés : absents, rien ne bouge ni ne reste vide ;
//       – OffreBolaPlus : l'emblème, les deux formules à toucher (Mensuel
//         19,90 € par mois, sans engagement ; Annuel 168,90 € par an, −29 %,
//         et dessous « 4 × 42,23 € sans frais » ; retour du 13/11 01:44), puis
//         « Je suis intéressé ». Le bouton marche avec ou sans formule ; une
//         fois touché, il laisse la place à « C'est noté » et à « Annuler ».
//         Les formules restent touchables : en toucher une change la formule
//         notée. Après « Annuler », plus rien n'est coché. Au clavier : les
//         flèches passent d'une formule à l'autre, et après le bouton ou
//         « Annuler » le focus reste sur ce qui les remplace ;
//       – BarreInteret : le même « Je suis intéressé », collé au-dessus de la
//         barre d'onglets tant que le bouton de l'offre n'est pas à l'écran.
//         Une fois noté, elle dit « C'est noté » et mène à l'offre (formules,
//         « Annuler »). Jamais deux boutons à l'écran, jamais aucun : elle
//         s'efface quand celui de l'offre arrive à sa place, pas avant.
//         Elle est portée dans <body> : sur iPhone, ce qui est collé dans
//         #app-scroll passe sous la barre d'onglets (discussion-match.tsx).
//
// Aucun paiement, aucun formulaire, aucun texte d'aide : les titres, les deux
// prix (et les 4 fois de l'annuel, sans nom de prestataire), le bouton. Les
// montants sont écrits et calculés dans lib/sfl/bola-plus.ts, jamais ici. Les quatre avantages sont ceux que Sabri a dits ; leurs
// titres sont dans lib/sfl/bola-plus.ts, pas ici.
//
// Les visuels (public/bola-plus/, 4:5, noir et blanc) sont les mêmes en clair
// et en sombre : l'affiche et les cartes sont des îlots sombres (classe dark),
// le reste suit le mode de l'app. Rien ne suit le doigt : une carte apparaît
// une fois, en entrant à l'écran ; avec « Réduire les animations », elle est
// là d'emblée, et le saut vers l'offre est immédiat (bola-plus.css). Une carte
// n'est cachée qu'une fois la page en marche, et seulement si elle est hors de
// l'écran : sans script, ou avant lui, tout se voit.
//
// L'emblème n'est pas une image : la rosace guillochée du dos de la carte et
// la lune Bola en son centre (motif-carte.tsx, finitions-carte.ts), dessinées
// à l'encre de la page. Noir et blanc, en clair comme en sombre.

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import { RosaceBola } from "@/components/sfl/motif-carte";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useBolaPlus, type BolaPlus } from "@/hooks/use-bola-plus";
import {
  AFFICHE,
  ANNUEL,
  AVANTAGES,
  FORMULES,
  LARGEURS,
  LIBELLE_ECHEANCES,
  LIBELLE_REMISE,
  MENSUEL,
  NOM_FORMULE,
  RAPPORT_VISUEL,
  fichierVisuel,
  sourcesVisuel,
  type Avantage,
  type Formule,
} from "@/lib/sfl/bola-plus";
import { cn } from "@/lib/utils";
import "@/components/sfl/ma-carte/rubriques.css";
import "./bola-plus.css";

// La rosace dans un carré de 340 (le repère du contrat à la une), la lune au
// centre dans les proportions du dos de la carte (dos-carte.tsx : une lune de
// 300 dans une rosace de rayon intérieur 236).
const ROSACE = { r1: 74, r2: 128 };
const LUNE = (300 / 236) * ROSACE.r1;
// La boîte du symbole dans le repère du logo (finitions-carte.ts).
const SYMBOLE = { x: 17, y: 103.485, c: 112.373 };

/** La rosace guillochée et la lune Bola, à l'encre (currentColor). */
export function EmblemeBolaPlus({ className, trait = 0.7, fond = 0.5 }: { className?: string; trait?: number; fond?: number }) {
  const s = LUNE / SYMBOLE.c;
  return (
    <svg aria-hidden viewBox="-158 -158 316 316" className={className}>
      <g opacity={fond}>
        <RosaceBola cx={0} cy={0} r1={ROSACE.r1} r2={ROSACE.r2} couleur="currentColor" epaisseur={trait} />
      </g>
      <path
        d={LOGO_BOLA.symbole}
        fill="currentColor"
        fillRule="evenodd"
        transform={`translate(${-(SYMBOLE.x + SYMBOLE.c / 2) * s} ${-(SYMBOLE.y + SYMBOLE.c / 2) * s}) scale(${s})`}
      />
    </svg>
  );
}

/** « C'est noté » : la coche dans son rond plein, et les mots. */
function CestNote({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="size-3" strokeWidth={3.5} aria-hidden />
      </span>
      C&apos;est noté
    </span>
  );
}

/** L'entrée de Bola Plus sur Ma carte (profil/page.tsx). */
export function TuileBolaPlus() {
  const { interet } = useBolaPlus();
  return (
    <Link
      href="/profil/bola-plus"
      aria-label={interet ? "Bola Plus, c'est noté" : "Bola Plus"}
      className="tuile tuile--plus col-span-2 flex min-h-[76px] items-center justify-between gap-3 px-4"
    >
      <span className="tuile__embleme" aria-hidden>
        <EmblemeBolaPlus className="size-full" trait={0.9} fond={0.28} />
      </span>
      <span className="text-[16px] leading-[1.15] font-bold tracking-[-0.2px] whitespace-nowrap">Bola Plus</span>
      {interet && <CestNote className="mono-label tuile__note" />}
    </Link>
  );
}

/** Chaque formule : son prix, sa période, son détail à droite, et la ligne sous le prix (les 4 fois de l'annuel). */
const PRIX: Record<Formule, { euros: string; par: string; detail: string; sous?: string }> = {
  mensuel: { euros: MENSUEL, par: "mois", detail: "Sans engagement" },
  annuel: { euros: ANNUEL, par: "an", detail: LIBELLE_REMISE, sous: LIBELLE_ECHEANCES },
};

/** L'offre : l'emblème, les deux formules, « Je suis intéressé ». */
export function OffreBolaPlus({
  plus,
  choix,
  onChoix,
  actionRef,
}: {
  plus: BolaPlus;
  /** Le bloc du bouton (ou de « C'est noté ») : la page le regarde pour effacer la barre collée. */
  actionRef?: RefObject<HTMLDivElement | null>;
  /** La formule touchée avant « Je suis intéressé » ; une fois noté, celle de l'intérêt fait foi. */
  choix: Formule | null;
  onChoix: (f: Formule | null) => void;
}) {
  const { interet, noter, annuler, occupe } = plus;
  const formule = interet ? interet.formule : choix;
  const interneRef = useRef<HTMLDivElement | null>(null);
  const blocRef = actionRef ?? interneRef;
  // Le bouton touché ici vient de laisser sa place : le focus va à ce qui le remplace.
  const suivre = useRef(false);
  const note = !!interet;

  useEffect(() => {
    if (!suivre.current) return;
    suivre.current = false;
    blocRef.current?.focus({ preventScroll: true });
  }, [note, blocRef]);

  function interesser() {
    suivre.current = true;
    noter(choix);
  }

  function choisir(f: Formule) {
    if (!interet) onChoix(f);
    else if (interet.formule !== f) noter(f);
  }

  // Après « Annuler », rien ne reste coché : ni la formule notée, ni celle d'avant.
  function defaire() {
    suivre.current = true;
    onChoix(null);
    annuler();
  }

  // Les flèches passent d'une formule à l'autre, comme dans tout groupe de choix.
  function fleches(e: KeyboardEvent<HTMLDivElement>) {
    const pas = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!pas) return;
    e.preventDefault();
    const boutons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const i = (Math.max(0, boutons.indexOf(document.activeElement as HTMLButtonElement)) + pas + FORMULES.length) % FORMULES.length;
    boutons[i]?.focus();
    choisir(FORMULES[i]);
  }

  return (
    <div className="flex flex-col gap-[var(--fib-21)]">
      <EmblemeBolaPlus className="mx-auto size-[92px] text-foreground" />

      <div role="radiogroup" aria-label="Formule" onKeyDown={fleches} className="flex flex-col gap-2.5">
        {FORMULES.map((f) => {
          const p = PRIX[f];
          const choisie = formule === f;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={choisie}
              disabled={occupe}
              onClick={() => choisir(f)}
              className={cn(
                "glass flex w-full items-center gap-3 rounded-[24px] px-5 py-4 text-left max-[359px]:gap-2 max-[359px]:px-4 transition-[border-color] duration-200 motion-reduce:transition-none",
                choisie && "border-foreground"
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="mono-label text-encre-3">{NOM_FORMULE[f]}</span>
                <span className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="text-[34px] leading-[0.9] tabular-nums max-[359px]:text-[28px]" style={{ fontFamily: ANTON }}>
                    {p.euros}&nbsp;€
                  </span>
                  <span className="text-corps font-medium text-encre-2">/ {p.par}</span>
                </span>
                {p.sous && <span className="text-[13px] leading-tight font-medium text-encre-2 tabular-nums">{p.sous}</span>}
              </span>
              <span className="text-right text-corps leading-tight font-semibold text-encre-2 max-[359px]:w-min min-[360px]:whitespace-nowrap">{p.detail}</span>
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                  choisie ? "border-foreground bg-foreground text-background" : "border-foreground/30"
                )}
              >
                {choisie && <Check className="size-3.5" strokeWidth={3.5} />}
              </span>
            </button>
          );
        })}
      </div>

      <div ref={blocRef} tabIndex={-1} className="bp-action">
        {interet ? (
          <div className="flex flex-col items-center gap-1" role="status">
            <CestNote className="py-4 text-lecture font-bold" />
            <button
              type="button"
              onClick={defaire}
              disabled={occupe}
              className="bouton-discret bouton--rouge min-h-11 px-5 py-2 text-corps font-semibold disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={interesser}
            disabled={occupe}
            className="bouton-principal w-full py-4 text-lecture font-bold disabled:opacity-40"
          >
            Je suis intéressé
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ La page ------------------------------ */

/** Un visuel de public/bola-plus/, plein cadre, à la largeur du téléphone. */
const TAILLES = "(min-width: 430px) 430px, 100vw";
const LARGEUR = LARGEURS[1];
const HAUTEUR = Math.round(LARGEUR * RAPPORT_VISUEL);

/**
 * La ligne où la barre collée passe la main au bouton de l'offre : 120 px
 * au-dessus du bas de l'écran (bola-plus.css : 14 + 62 + 10 de retrait, puis
 * les deux tiers des 52 px de la barre). Plus bas, le bouton de l'offre est
 * encore derrière elle ; plus haut, on verrait les deux.
 */
const MARGE_BARRE = "0px 0px -120px 0px";

/** Le défilement de l'app (layout.tsx) : c'est lui que les observateurs regardent. */
const defilant = () => document.getElementById("app-scroll");

/** L'affiche d'ouverture : le stade, le retour, le nom et les deux prix. */
function AfficheBolaPlus() {
  return (
    <header className="bp-affiche dark" style={{ ["--teinte" as string]: AFFICHE.teinte }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- déjà à ses trois tailles (public/bola-plus) */}
      <img
        src={fichierVisuel(AFFICHE.image, LARGEUR)}
        srcSet={sourcesVisuel(AFFICHE.image)}
        sizes={TAILLES}
        width={LARGEUR}
        height={HAUTEUR}
        alt={AFFICHE.alt}
        fetchPriority="high"
        decoding="async"
        draggable={false}
      />
      <BoutonRetour className="bp-affiche__retour" />
      <div className="bp-affiche__titre">
        <h1 className="text-[44px] leading-none font-black tracking-[-0.045em] whitespace-nowrap">Bola Plus</h1>
        <p className="mt-3 flex items-baseline gap-x-2 whitespace-nowrap text-[13px] font-semibold text-white/72 max-[359px]:gap-x-1.5">
          <span className="text-[22px] leading-none text-white tabular-nums max-[359px]:text-[19px]" style={{ fontFamily: ANTON }}>
            {MENSUEL}&nbsp;€
          </span>
          / mois
          <span aria-hidden className="text-white/40">
            ·
          </span>
          <span className="text-[22px] leading-none text-white tabular-nums max-[359px]:text-[19px]" style={{ fontFamily: ANTON }}>
            {ANNUEL}&nbsp;€
          </span>
          / an
          <span className="ml-1 rounded-full px-2 py-[3px] text-[12px] leading-none font-bold text-white ring-1 ring-white/45">{LIBELLE_REMISE}</span>
        </p>
      </div>
    </header>
  );
}

/**
 * Un avantage : son visuel plein cadre, son numéro, son titre. Elle apparaît
 * une fois, en entrant à l'écran. Elle n'attend (cachée) que si la page en
 * marche la trouve hors de l'écran : avant le script, elle se voit.
 */
function CarteAvantage({ avantage }: { avantage: Avantage }) {
  const ref = useRef<HTMLLIElement>(null);
  const [etat, setEtat] = useState<"attend" | "vue" | null>(null);
  // Le visuel déposé (un seul fichier) ne remplace le portant qu'une fois chargé : s'il manque, la carte
  // garde son visuel, sans trou ni attente.
  const [deposeLa, setDeposeLa] = useState(false);
  const depose = deposeLa ? avantage.depose : undefined;

  useEffect(() => {
    const fichier = avantage.depose?.fichier;
    if (!fichier) return;
    let vivant = true;
    const essai = new Image();
    essai.onload = () => {
      if (vivant && essai.naturalWidth > 0) setDeposeLa(true);
    };
    essai.src = fichier;
    return () => {
      vivant = false;
      essai.onload = null;
    };
  }, [avantage.depose?.fichier]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) {
          // Entièrement hors de l'écran : elle attend. Un bord déjà visible reste visible.
          if (e.intersectionRatio === 0) setEtat("attend");
          return;
        }
        // Déjà à l'écran à l'ouverture : elle reste comme elle est, sans mouvement.
        setEtat((avant) => (avant === "attend" ? "vue" : avant));
        o.disconnect();
      },
      { root: defilant(), threshold: 0.12 }
    );
    o.observe(el);
    return () => o.disconnect();
  }, []);

  return (
    <li ref={ref} className="bp-carte dark" data-attend={etat === "attend" ? "" : undefined} data-vue={etat === "vue" ? "" : undefined} style={{ ["--teinte" as string]: avantage.teinte }}>
      {depose ? (
        // Déjà chargé (l'essai ci-dessus) : il prend la place du portant.
        // eslint-disable-next-line @next/next/no-img-element -- un seul fichier déposé, sans tailles
        <img
          src={depose.fichier}
          width={LARGEUR}
          height={HAUTEUR}
          alt={depose.alt}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- déjà à ses trois tailles (public/bola-plus)
        <img
          src={fichierVisuel(avantage.image, LARGEUR)}
          srcSet={sourcesVisuel(avantage.image)}
          sizes={TAILLES}
          width={LARGEUR}
          height={HAUTEUR}
          alt={avantage.alt}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      )}
      <span className="bp-carte__numero tabular-nums" style={{ fontFamily: ANTON }} aria-hidden>
        {avantage.numero}
      </span>
      <h2 className="bp-carte__titre titre-lettrage">{avantage.titre}</h2>
    </li>
  );
}

/**
 * « Je suis intéressé », collé au-dessus de la barre d'onglets tant que
 * l'offre n'est pas à l'écran ; une fois noté, « C'est noté », qui mène à
 * l'offre. Dans <body> (voir l'en-tête).
 */
function BarreInteret({ note, occupe, cachee, onNoter, onVoirOffre }: { note: boolean; occupe: boolean; cachee: boolean; onNoter: () => void; onVoirOffre: () => void }) {
  return createPortal(
    <div className="bp-barre" data-cachee={cachee ? "" : undefined} inert={cachee}>
      {note ? (
        <button type="button" onClick={onVoirOffre} className="bp-barre__note text-lecture font-bold">
          <CestNote />
        </button>
      ) : (
        <button type="button" onClick={onNoter} disabled={occupe} className="bouton-principal h-[52px] w-full text-lecture font-bold disabled:opacity-40">
          Je suis intéressé
        </button>
      )}
    </div>,
    document.body
  );
}

/** La page Bola Plus : l'affiche, les quatre avantages, l'offre, et le bouton toujours sous le pouce. */
export function PageBolaPlus() {
  const plus = useBolaPlus();
  const [choix, setChoix] = useState<Formule | null>(null);
  const offre = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement | null>(null);
  // Le bouton de l'offre est-il à l'écran ? null tant qu'on ne sait pas : la barre attend.
  const [offreVue, setOffreVue] = useState<boolean | null>(null);

  useEffect(() => {
    const el = actionRef.current;
    if (!el) return;
    // On regarde le bouton de l'offre, pas l'offre entière : la barre ne s'efface
    // que lorsqu'il arrive à sa place, au-dessus de la barre d'onglets (MARGE_BARRE).
    const o = new IntersectionObserver(([e]) => setOffreVue(e.isIntersecting), { root: defilant(), rootMargin: MARGE_BARRE });
    o.observe(el);
    return () => o.disconnect();
  }, []);

  function voirOffre() {
    const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    offre.current?.scrollIntoView({ behavior: doux ? "smooth" : "auto", block: "start" });
  }

  return (
    <div className="bp">
      <AfficheBolaPlus />
      <ol className="bp-pile">
        {AVANTAGES.map((a) => (
          <CarteAvantage key={a.id} avantage={a} />
        ))}
      </ol>
      <div ref={offre} className="bp-offre">
        <OffreBolaPlus plus={plus} choix={choix} onChoix={setChoix} actionRef={actionRef} />
      </div>
      {offreVue !== null && (
        <BarreInteret note={!!plus.interet} occupe={plus.occupe} cachee={offreVue} onNoter={() => plus.noter(choix)} onVoirOffre={voirOffre} />
      )}
    </div>
  );
}
