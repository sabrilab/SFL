"use client";

// Bola Plus, la précommande (Sabri, 12/11/2026 ; lib/sfl/bola-plus.ts) : ce
// que le joueur en voit.
//
//   · TuileBolaPlus : l'entrée sur Ma carte, sous « Personnaliser ma carte » et
//     « Inviter », sur toute la largeur. Son nom, et « C'est noté » une fois
//     l'intérêt enregistré. Elle ouvre /profil/bola-plus. Noir et blanc, comme
//     Ma carte : la couleur ne sort pas de la page ;
//   · PageBolaPlus : un carrousel horizontal (retours de Sabri du 14/11, 20:34
//     → 20:47 : « en mode carrousel », « de belles couleurs »), une carte à la
//     fois, qu'on fait glisser au doigt, comme la présentation d'un passe de
//     jeu. Dix cartes : l'ouverture (le stade teint en violet et vert, le
//     gros logo BOLA et le petit sigle SFL dessous, le prix premiers joueurs),
//     puis les avantages de la liste (AVANTAGES : « Ta carte continue. » avec
//     la vraie carte « Toi », « Bola Plus » et ses fonctions, « Ton studio »
//     (Bola Studio, bola-app#22 : trois templates en éventail qui ouvrent le
//     panneau des douze, et « 300 ⚽ / mois » sous le titre ; studio-bola.tsx),
//     puis la part SFL
//     en photos : maillots, matchs filmés, cadeaux, cérémonies), « Ramène 5
//     abonnés. », et « Ton prix » : le bundle, la grille officielle de la SFL
//     barrée, l'étiquette « Prix premiers joueurs », les deux formules (sous
//     chacune, ses ballons de Bola Studio : « 300 ⚽ / mois », et pour l'annuel
//     « + 1 000 ⚽ offerts », lus dans lib/sfl/studio.ts) et « Je suis
//     intéressé ». Chaque carte porte l'étiquette de sa part :
//     la pilule violette de Bola Plus (la lune Bola) ou l'étiquette verte de
//     la SFL (son vrai sigle) ; on glisse des violettes aux vertes.
//
// Le carrousel : le défilement natif et son aimantation (scroll-snap), rien
// ne suit le doigt. On voit le bord de la carte voisine : le geste s'annonce
// sans un mot. Sous le rail, un segment par carte, touchable, qui dit où l'on
// est (aria-current). Au clavier : ← et →, Début et Fin. Sur ordinateur, deux
// boutons ‹ › (pointeur fin seulement) ; la molette verticale n'est pas
// détournée. Avec « Réduire les animations », les sauts sont immédiats et
// les ronds de « Ramène 5 » sont pleins d'emblée. La page ne défile pas en
// vertical : elle tient dans l'écran, au-dessus de la barre d'onglets.
//
// « Je suis intéressé » : collé au-dessus de la barre d'onglets
// (BarreInteret, portée dans <body> : sur iPhone, ce qui est collé dans
// #app-scroll passe sous la barre d'onglets) sur toutes les cartes sauf
// « Ton prix », où le bouton est dans la carte : jamais deux boutons à
// l'écran, jamais aucun. Une fois noté, la barre dit « C'est noté » et mène à
// « Ton prix » (formules, « Annuler »).
//
// Aucun paiement, aucun formulaire, aucun texte d'aide. Les montants sont
// écrits et calculés dans lib/sfl/bola-plus.ts, jamais ici ; les couleurs
// aussi (PALETTE, posée en variables CSS sur la page). Les titres de la page
// sont en Barlow Condensed (POLICE_TITRES, déjà chargée par layout.tsx pour les
// cartes) ; la piste Archivo (téléchargée chez Google au build) n'est
// branchée que si Sabri la retient : en développement, « ?police=b » la
// demande à la feuille, qui retombe sur Barlow tant que la police n'est pas
// chargée. Un avantage de plus s'ajoute dans AVANTAGES et, s'il dessine son
// visuel, dans COMPOSANTS (et sa ligne sous le titre dans PIEDS) : rien
// d'autre à toucher ici. Bola Studio est entré ainsi.
//
// L'emblème de la tuile n'est pas une image : la rosace guillochée du dos de
// la carte et la lune Bola en son centre (motif-carte.tsx, finitions-carte.ts),
// dessinées à l'encre de la page.

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, MessageCircle, Sparkles, Target, User, Users } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { BolaCard } from "@/components/sfl/bola-card";
import { PlayerCard } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { SigleLigue } from "@/components/sfl/choix-ligue";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import { RosaceBola } from "@/components/sfl/motif-carte";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useBolaPlus, type BolaPlus } from "@/hooks/use-bola-plus";
import { useSession } from "@/hooks/use-session";
import { ovr } from "@/lib/sfl/engine";
import {
  AFFICHE,
  BOLA_PLUS_SEUL,
  BUNDLE,
  CARTE_TOI,
  FONCTIONS_BOLA_PLUS,
  FORMULES,
  GRILLE_SFL,
  LARGEURS,
  NOM_BUNDLE,
  NOM_FORMULE,
  NOM_PART,
  PALETTE,
  PARRAINAGE,
  PRIX_FORMULE,
  VARIABLES_PLUS,
  diapos,
  voitBolaPlus,
  fichierVisuel,
  sourcesVisuel,
  type Avantage,
  type ComposantAvantage,
  type Diapo,
  type Formule,
  type Part,
  type Visuel,
} from "@/lib/sfl/bola-plus";
import { BALLONS_FORMULE } from "@/lib/sfl/studio";
import { cn } from "@/lib/utils";
import { MentionStudio, VisuelStudio } from "@/components/sfl/studio-bola";
import { CompteAReboursBolaPlus } from "@/components/sfl/bola-plus-rappels";
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
  const session = useSession();
  // Les deux admins seulement, tant que Bola Plus n'est pas annoncé (voitBolaPlus, lib/sfl/bola-plus.ts).
  if (!voitBolaPlus(session?.name)) return null;
  return (
    <Link
      href="/profil/bola-plus"
      aria-label={interet ? "Bola Plus, c'est noté" : "Bola Plus"}
      className="tuile tuile--plus col-span-2 flex min-h-[76px] items-center justify-between gap-3 px-4"
    >
      <span className="tuile__embleme" aria-hidden>
        <EmblemeBolaPlus className="size-full" trait={0.9} fond={0.28} />
      </span>
      <span className="flex flex-col items-start gap-1">
        <span className="text-[16px] leading-[1.15] font-bold tracking-[-0.2px] whitespace-nowrap">Bola Plus</span>
        {/* Le compte à rebours du prix premiers joueurs (bola-plus-rappels.tsx) */}
        <CompteAReboursBolaPlus variante="ligne" className="tuile__rebours" />
      </span>
      {interet && <CestNote className="mono-label tuile__note" />}
    </Link>
  );
}

/* --------------------------- Les petites pièces --------------------------- */

/** La lune Bola seule (finitions-carte.ts), à l'encre. */
function LuneBola({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox={`${SYMBOLE.x} ${SYMBOLE.y} ${SYMBOLE.c} ${SYMBOLE.c}`} className={className}>
      <path d={LOGO_BOLA.symbole} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/**
 * L'étiquette d'une part : la pilule violette de Bola Plus (la lune et son
 * nom), ou l'étiquette verte de la SFL (son vrai sigle, coins de 6 px, comme
 * le badge du maillot).
 */
function EtiquettePart({ part, className }: { part: Part; className?: string }) {
  if (part === "plus")
    return (
      <span className={cn("bp-part bp-part--plus", className)}>
        <LuneBola className="size-[13px]" />
        {NOM_PART.plus}
      </span>
    );
  return (
    <span className={cn("bp-part bp-part--sfl", className)}>
      <SigleLigue ligue="sfl" hauteur={11} />
    </span>
  );
}

/** Un prix barré : le montant, et le symbole. */
function Barre({ somme, className }: { somme: string; className?: string }) {
  return <s className={cn("bp-barre-prix tabular-nums", className)}>{somme}&nbsp;€</s>;
}

/** Un titre de la page, dans la police des titres. */
function Titre({ niveau = 2, children, className }: { niveau?: 1 | 2; children: ReactNode; className?: string }) {
  const Balise = niveau === 1 ? "h1" : "h2";
  return <Balise className={cn("bp-titre", className)}>{children}</Balise>;
}

/* ------------------------------ L'offre ------------------------------ */

/** L'offre de « Ton prix » : les deux formules à toucher, puis « Je suis intéressé ». */
export function OffreBolaPlus({
  plus,
  choix,
  onChoix,
  actionRef,
}: {
  plus: BolaPlus;
  /** Le bloc du bouton (ou de « C'est noté ») : le focus y revient quand le bouton laisse sa place. */
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

  // Les flèches passent d'une formule à l'autre, comme dans tout groupe de choix ; elles ne font pas tourner le carrousel.
  function fleches(e: KeyboardEvent<HTMLDivElement>) {
    const pas = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!pas) return;
    e.preventDefault();
    e.stopPropagation();
    const boutons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const i = (Math.max(0, boutons.indexOf(document.activeElement as HTMLButtonElement)) + pas + FORMULES.length) % FORMULES.length;
    boutons[i]?.focus();
    choisir(FORMULES[i]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Formule" onKeyDown={fleches} className="flex flex-col gap-2">
        {FORMULES.map((f) => {
          const p = PRIX_FORMULE[f];
          const choisie = formule === f;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={choisie}
              disabled={occupe}
              onClick={() => choisir(f)}
              className={cn("bp-formule", choisie && "bp-formule--choisie")}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="mono-label bp-formule__nom">{NOM_FORMULE[f]}</span>
                <span className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="bp-formule__prix tabular-nums" style={{ fontFamily: ANTON }}>
                    {p.euros}&nbsp;€
                  </span>
                  <span className="bp-formule__par">/ {p.par}</span>
                  <Barre somme={p.barre} />
                </span>
                <span className="bp-formule__sous tabular-nums">{p.sous}</span>
                <span className="bp-formule__ballons tabular-nums">{BALLONS_FORMULE[f]}</span>
              </span>
              <span aria-hidden className="bp-formule__rond">
                {choisie && <Check className="size-3.5" strokeWidth={3.5} />}
              </span>
            </button>
          );
        })}
      </div>

      <div ref={blocRef} tabIndex={-1} className="bp-action">
        {interet ? (
          <div className="flex items-center justify-between gap-2" role="status">
            <CestNote className="py-3 text-lecture font-bold" />
            <button
              type="button"
              onClick={defaire}
              disabled={occupe}
              className="bouton-discret bouton--rouge min-h-11 px-4 py-2 text-corps font-semibold disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        ) : (
          <button type="button" onClick={interesser} disabled={occupe} className="bouton-principal h-[52px] w-full text-lecture font-bold disabled:opacity-40">
            Je suis intéressé
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Les cartes ------------------------------ */

/** Les visuels de public/bola-plus/ : la largeur d'une carte du carrousel. */
const TAILLES = "(min-width: 430px) 390px, calc(100vw - 40px)";
const LARGEUR = LARGEURS[1];
const hauteurDe = (v: Visuel) => Math.round(LARGEUR * v.rapport);

/** La hauteur d'un bloc, suivie (la vraie carte se règle sur la place qu'elle a). */
function useHauteur(ref: RefObject<HTMLElement | null>) {
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new ResizeObserver(([e]) => setH(e.contentRect.height));
    o.observe(el);
    return () => o.disconnect();
  }, [ref]);
  return h;
}

/** 1 · L'ouverture : le stade teint, le gros logo BOLA et le sigle SFL dessous, les deux parts, le prix premiers joueurs. */
function DiapoOuverture() {
  const p = PRIX_FORMULE.mensuel;
  return (
    <div className="bp-ouverture dark" style={{ ["--teinte" as string]: AFFICHE.teinte }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- déjà à ses trois tailles (public/bola-plus) */}
      <img
        src={fichierVisuel(AFFICHE.image, LARGEUR)}
        srcSet={sourcesVisuel(AFFICHE.image)}
        sizes={TAILLES}
        width={LARGEUR}
        height={hauteurDe(AFFICHE)}
        alt={AFFICHE.alt}
        fetchPriority="high"
        decoding="async"
        draggable={false}
        className="bp-photo"
      />
      <div className="bp-ouverture__marque">
        <Titre niveau={1} className="bp-ouverture__logo">
          {/* eslint-disable-next-line @next/next/no-img-element -- le logo officiel, en SVG */}
          <img src="/bola/logo-blanc.svg" alt="Bola" width={1000} height={237} draggable={false} />
        </Titre>
        <SigleLigue ligue="sfl" hauteur={16} className="bp-ouverture__sigle" />
      </div>
      <div className="bp-ouverture__bas">
        <div role="group" className="flex items-center gap-2" aria-label={`${NOM_PART.plus} et ${NOM_PART.sfl}`}>
          <EtiquettePart part="plus" />
          <span aria-hidden className="bp-plus-signe">
            +
          </span>
          <EtiquettePart part="sfl" />
        </div>
        <span className="bp-etiquette-prix">Prix premiers joueurs</span>
        <p className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="bp-ouverture__prix tabular-nums" style={{ fontFamily: ANTON }}>
            {p.euros}&nbsp;€
          </span>
          <span className="bp-ouverture__par">/ {p.par}</span>
          <Barre somme={p.barre} />
        </p>
        <CompteAReboursBolaPlus variante="grand" />
      </div>
    </div>
  );
}

/** La carte à taille 1 : 254 px de large, 1656/1024 de haut (bola-card.tsx). */
const HAUTEUR_CARTE = 254 * (1656 / 1024);

/**
 * « Ta carte » : la carte du compte ouvert, telle qu'elle est sur Ma carte
 * (sa photo, son skin, ses notes : PlayerCard), pour que ce soit la sienne
 * (Sabri, 16/11 : « mettre la carte du user en fonction de son compte pour
 * que ce soit plus perso »). Sans joueur à soi (compte hors de la saison),
 * la carte « Toi » anonyme.
 */
function VisuelCarte() {
  const ref = useRef<HTMLDivElement>(null);
  const h = useHauteur(ref);
  const { me, player } = useMyPlayer();
  const taille = h > 0 ? Math.max(0.5, Math.min(0.92, (h - 8) / HAUTEUR_CARTE)) : 0.8;
  return (
    <div ref={ref} className="bp-visuel-carte" aria-hidden>
      {player && player.name === me ? (
        <PlayerCard player={player} size={taille} />
      ) : (
        <BolaCard name={CARTE_TOI.name} position={CARTE_TOI.position} overall={ovr(CARTE_TOI.stats)} stats={CARTE_TOI.stats} highlightStats={["DRI"]} size={taille} />
      )}
    </div>
  );
}

const ICONES: Record<(typeof FONCTIONS_BOLA_PLUS)[number]["id"], typeof Users> = { equipe: Users, "trash-talk": MessageCircle, skins: Sparkles, quetes: Target };

/** « Bola Plus » : ses quatre fonctions, et son prix seul barré, « Offert ». */
function VisuelBolaPlus() {
  return (
    <div className="bp-visuel-plus">
      <ul className="bp-fonctions">
        {FONCTIONS_BOLA_PLUS.map((f) => {
          const Icone = ICONES[f.id];
          return (
            <li key={f.id}>
              <span className="bp-fonctions__icone" aria-hidden>
                <Icone className="size-[18px]" strokeWidth={2.2} />
              </span>
              {f.nom}
              {f.id === "equipe" && <SigleLigue ligue="team" hauteur={11} className="bp-fonctions__sigle" />}
            </li>
          );
        })}
      </ul>
      <EmblemeBolaPlus className="bp-visuel-plus__embleme" trait={0.8} fond={0.6} />
      <p className="bp-offert">
        <Barre somme={BOLA_PLUS_SEUL} />
        <span className="bp-offert__mot">Offert</span>
      </p>
    </div>
  );
}

/** Les visuels dessinés par le code. */
const COMPOSANTS: Record<ComposantAvantage, () => ReactNode> = {
  carte: VisuelCarte,
  "bola-plus": VisuelBolaPlus,
  studio: VisuelStudio,
};

/** Ce qu'un visuel dessiné ajoute sous son titre : les ballons du mois de « Ton studio ». */
const PIEDS: Partial<Record<ComposantAvantage, () => ReactNode>> = { studio: MentionStudio };

/** Un avantage dessiné par le code : son étiquette, son visuel, son titre et sa ligne. */
function DiapoComposant({ avantage, composant }: { avantage: Avantage; composant: ComposantAvantage }) {
  const Dessin = COMPOSANTS[composant];
  const Pied = PIEDS[composant];
  const titreEnHaut = composant === "bola-plus";
  return (
    <div className={cn("bp-texte", `bp-texte--${avantage.part}`)}>
      <EtiquettePart part={avantage.part} className="self-start" />
      {titreEnHaut && <Titre className="bp-texte__titre">{avantage.titre}</Titre>}
      <Dessin />
      {!titreEnHaut && (
        <div>
          <Titre className="bp-texte__titre">{avantage.titre}</Titre>
          {avantage.sous && <p className="bp-texte__sous">{avantage.sous}</p>}
          {Pied && <Pied />}
        </div>
      )}
    </div>
  );
}

/**
 * Un avantage en photo : le visuel plein cadre sous le voile de sa part, son
 * étiquette, son titre. « Tes maillots » montre d'abord le portant ; les
 * maillots portés (Avantage.depose, gardés hors du dépôt) ne prennent sa
 * place qu'une fois chargés : absents, rien ne bouge ni ne reste vide.
 */
function DiapoPhoto({ avantage, visuel }: { avantage: Avantage; visuel: Visuel }) {
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

  return (
    <div
      className={cn("bp-photo-carte dark", `bp-photo-carte--${avantage.part}`)}
      data-teindre={visuel.teindre && !depose ? "" : undefined}
      data-voile-court={visuel.voileCourt && !depose ? "" : undefined}
      style={{ ["--teinte" as string]: visuel.teinte }}
    >
      {depose ? (
        // Déjà chargé (l'essai ci-dessus) : il prend la place du portant.
        // eslint-disable-next-line @next/next/no-img-element -- un seul fichier déposé, sans tailles
        <img src={depose.fichier} width={1170} height={1462} alt={depose.alt} decoding="async" draggable={false} className="bp-photo" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- déjà à ses trois tailles (public/bola-plus)
        <img
          src={fichierVisuel(visuel.image, LARGEUR)}
          srcSet={sourcesVisuel(visuel.image)}
          sizes={TAILLES}
          width={LARGEUR}
          height={hauteurDe(visuel)}
          alt={visuel.alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="bp-photo"
        />
      )}
      <EtiquettePart part={avantage.part} className="bp-photo-carte__part" />
      <Titre className="bp-photo-carte__titre">{avantage.titre}</Titre>
    </div>
  );
}

/** Où se posent les ronds de « Ramène 5 », en arc régulier au-dessus de « Toi » (en degrés, 0 = à droite, de −162° à −18°). */
const ARC = Array.from({ length: PARRAINAGE.nombre }, (_, i) => -162 + (144 / (PARRAINAGE.nombre - 1)) * i);

/** « Ramène 5 abonnés. » : cinq ronds en arc qui se remplissent au-dessus de « Toi ». */
function DiapoParrainage({ vu }: { vu: boolean }) {
  return (
    <div className="bp-parrainage dark" data-vu={vu ? "" : undefined}>
      <div className="bp-arc" aria-hidden>
        {ARC.map((deg, i) => (
          <span
            key={deg}
            className="bp-arc__rond"
            style={{ ["--x" as string]: Math.cos((deg * Math.PI) / 180).toFixed(3), ["--y" as string]: Math.sin((deg * Math.PI) / 180).toFixed(3), ["--i" as string]: i } as CSSProperties}
          >
            <User className="size-[18px]" strokeWidth={2.4} />
          </span>
        ))}
        <span className="bp-arc__toi">Toi</span>
      </div>
      <div>
        <Titre className="bp-texte__titre">{PARRAINAGE.titre}</Titre>
        <p className="bp-texte__sous bp-parrainage__sous">{PARRAINAGE.sous}</p>
      </div>
    </div>
  );
}

/** « Ton prix » : le bundle, la grille officielle barrée, le prix premiers joueurs, l'offre. */
function DiapoPrix({ plus, choix, onChoix, actionRef }: { plus: BolaPlus; choix: Formule | null; onChoix: (f: Formule | null) => void; actionRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="bp-prix">
      <div className="bp-prix__haut">
      <ul className="bp-bundle" aria-label="Ce que tu reçois">
        {BUNDLE.map((b, i) => (
          <li key={b}>
            {i > 0 && (
              <span aria-hidden className="bp-plus-signe">
                +
              </span>
            )}
            {b === "bola-plus" ? <EtiquettePart part="plus" /> : b === "sfl" ? <EtiquettePart part="sfl" /> : <span className="bp-bundle__piece">{NOM_BUNDLE[b]}</span>}
          </li>
        ))}
      </ul>
      <p className="bp-grille" aria-label={`Grille officielle de la ${NOM_PART.sfl}`}>
        <SigleLigue ligue="sfl" hauteur={10} className="bp-grille__sigle" />
        {GRILLE_SFL.map((g) => (
          <s key={g.par} className="tabular-nums whitespace-nowrap">
            {g.prix}&nbsp;€ / {g.par}
          </s>
        ))}
      </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Titre className="bp-etiquette-prix bp-prix__etiquette">Prix premiers joueurs</Titre>
        <CompteAReboursBolaPlus variante="ligne" className="bp-prix__rebours" />
      </div>
      <OffreBolaPlus plus={plus} choix={choix} onChoix={onChoix} actionRef={actionRef} />
    </div>
  );
}

/**
 * « Je suis intéressé », collé au-dessus de la barre d'onglets sur toutes les
 * cartes sauf « Ton prix » ; une fois noté, « C'est noté », qui mène à
 * « Ton prix ». Dans <body> (voir l'en-tête).
 */
function BarreInteret({ note, occupe, cachee, onNoter, onVoirOffre }: { note: boolean; occupe: boolean; cachee: boolean; onNoter: () => void; onVoirOffre: () => void }) {
  return createPortal(
    <div className="bp-barre" data-cachee={cachee ? "" : undefined} inert={cachee}>
      {/* Un seul bouton, dont le contenu change : jamais désactivé (aria-disabled), il garde le focus quand « Je suis intéressé » devient « C'est noté ». */}
      <button
        type="button"
        aria-disabled={!note && occupe ? true : undefined}
        onClick={() => (note ? onVoirOffre() : !occupe && onNoter())}
        className={note ? "bp-barre__note text-lecture font-bold" : "bouton-principal h-[52px] w-full text-lecture font-bold aria-disabled:opacity-40"}
      >
        {note ? <CestNote /> : "Je suis intéressé"}
      </button>
    </div>,
    document.body
  );
}

/* ------------------------------ La page ------------------------------ */

/** La police des titres de la page : Barlow Condensed (recommandée, déjà chargée) ; « archivo », la piste B. */
export const POLICE_TITRES: "barlow" | "archivo" = "barlow";

const sansAbonnement = () => () => {};
/** La piste B, en développement seulement : « ?police=b ». */
const policeDemandee = (): "barlow" | "archivo" =>
  process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("police") === "b" ? "archivo" : POLICE_TITRES;

/** La part d'une carte, pour son segment : la sienne, le lime de « Ramène 5 », ou les deux (l'ouverture, le prix). */
const partDe = (d: Diapo): Part | "prix" | "deux" => ("avantage" in d ? d.avantage.part : d.id === "parrainage" ? "prix" : "deux");

/** Les couleurs de la page (lib/sfl/bola-plus.ts, PALETTE), en variables CSS. */
const COULEURS = {
  ...VARIABLES_PLUS,
  "--bp-sfl-fond": PALETTE.sfl.fond,
  "--bp-sfl-vif": PALETTE.sfl.vif,
  "--bp-sfl-clair": PALETTE.sfl.clair,
  "--bp-sfl-encre": PALETTE.sfl.encre,
  "--bp-prix": PALETTE.prix,
  "--bp-nuit": PALETTE.nuit,
} as CSSProperties;

/** La page Bola Plus : le carrousel, ses segments, et le bouton toujours sous le pouce. */
export function PageBolaPlus() {
  const plus = useBolaPlus();
  const [choix, setChoix] = useState<Formule | null>(null);
  const actionRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  // La carte visée par le dernier saut (flèches, segments) : plusieurs ← → rapides avancent d'autant, sans attendre la fin du défilement doux.
  const vise = useRef<number | null>(null);
  const liste = diapos();
  const n = liste.length;
  const iPrix = liste.findIndex((d) => d.id === "prix");
  const iParrainage = liste.findIndex((d) => d.id === "parrainage");
  const [actif, setActif] = useState(0);
  const [vus, setVus] = useState<ReadonlySet<number>>(() => new Set([0]));
  // La barre n'arrive qu'une fois la page en marche (elle est portée dans <body>).
  const pret = useSyncExternalStore(sansAbonnement, () => true, () => false);
  const police = useSyncExternalStore(sansAbonnement, policeDemandee, () => POLICE_TITRES);

  // La carte active : celle qui occupe le rail aux trois cinquièmes au moins.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const o = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.index);
          if (vise.current === i) vise.current = null;
          setActif(i);
          setVus((v) => (v.has(i) ? v : new Set(v).add(i)));
        }
      },
      { root: rail, threshold: 0.6 }
    );
    for (const li of rail.children) o.observe(li);
    return () => o.disconnect();
  }, [n]);

  function aller(i: number) {
    const rail = railRef.current;
    const j = Math.max(0, Math.min(n - 1, i));
    const li = rail?.children[j] as HTMLElement | undefined;
    if (!rail || !li) return;
    vise.current = j;
    const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollTo({ left: li.offsetLeft - (rail.clientWidth - li.offsetWidth) / 2, behavior: doux ? "smooth" : "auto" });
  }

  /** D'où partent ← et → : la carte visée par un saut en cours, sinon celle à l'écran. */
  const depart = () => vise.current ?? actif;

  function clavier(e: KeyboardEvent<HTMLDivElement>) {
    const cible = e.key === "ArrowRight" ? depart() + 1 : e.key === "ArrowLeft" ? depart() - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (cible === null) return;
    e.preventDefault();
    aller(cible);
  }

  function rendu(d: Diapo) {
    if (d.id === "ouverture") return <DiapoOuverture />;
    if (d.id === "prix") return <DiapoPrix plus={plus} choix={choix} onChoix={setChoix} actionRef={actionRef} />;
    if ("avantage" in d) {
      const v = d.avantage.visuel;
      return v.genre === "image" ? <DiapoPhoto avantage={d.avantage} visuel={v} /> : <DiapoComposant avantage={d.avantage} composant={v.composant} />;
    }
    return <DiapoParrainage vu={vus.has(iParrainage)} />;
  }

  return (
    <section className="bp" style={COULEURS} aria-roledescription="carrousel" aria-label="Bola Plus" data-police={police}>
      <div className="bp-tete">
        <BoutonRetour />
      </div>
      <div className="bp-scene">
        {/* Le rail (role group des diapositives : le motif « carrousel » de l'APG) ; il prend le focus, avec son nom. */}
        <div ref={railRef} className="bp-rail" tabIndex={0} aria-label="Cartes" onKeyDown={clavier} onPointerDown={() => (vise.current = null)}>
          {liste.map((d, i) => (
            <div key={d.id} role="group" data-index={i} data-part={partDe(d)} className="bp-diapo" aria-roledescription="diapositive" aria-label={`${i + 1} sur ${n} : ${d.nom}`}>
              {rendu(d)}
            </div>
          ))}
        </div>
        <button type="button" className="bp-fleche bp-fleche--avant" aria-label="Carte précédente" disabled={actif === 0} onClick={() => aller(depart() - 1)}>
          <ChevronLeft className="size-5" strokeWidth={2.4} aria-hidden />
        </button>
        <button type="button" className="bp-fleche bp-fleche--apres" aria-label="Carte suivante" disabled={actif === n - 1} onClick={() => aller(depart() + 1)}>
          <ChevronRight className="size-5" strokeWidth={2.4} aria-hidden />
        </button>
      </div>
      <div className="bp-segments">
        {liste.map((d, i) => (
          <button
            key={d.id}
            type="button"
            className="bp-segment"
            data-part={partDe(d)}
            aria-label={`Aller à ${i + 1} sur ${n} : ${d.nom}`}
            aria-current={i === actif ? "true" : undefined}
            onClick={() => aller(i)}
          >
            <span aria-hidden />
          </button>
        ))}
      </div>
      <div className="bp-pied" aria-hidden />
      {pret && (
        <BarreInteret
          note={!!plus.interet}
          occupe={plus.occupe}
          cachee={actif === iPrix}
          onNoter={() => plus.noter(choix)}
          onVoirOffre={() => {
            aller(iPrix);
            actionRef.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </section>
  );
}
