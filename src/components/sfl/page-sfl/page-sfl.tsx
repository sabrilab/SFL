"use client";

// La page publique getbola.app/sfl : la Sunday Five League présentée à
// quelqu'un qui n'a pas de compte (12/11/2026). C'est le lien de la bio
// Instagram de la ligue : on y arrive depuis le navigateur d'Instagram, sur
// téléphone, sans rien savoir. La page dit ce qu'est la ligue, concrètement,
// puis mène à la création du compte (/inscription) ou à la connexion.
//
// De haut en bas : le haut (le sigle, « Lille. Chaque dimanche. », les deux
// boutons), la semaine d'un joueur, Noirs contre Blancs, la carte qui bouge,
// le classement Pépite d'Or et ses divisions, les trois titres d'un match,
// puis la fin, qui dit le vrai chemin : un compte neuf entre dans Bola, la
// ligue s'ouvre ensuite depuis la Map (« Rejoindre la ligue »). La page ne
// promet donc pas de jouer dimanche.
//
// Ce qu'elle montre (13/11, retour sur bola-app#6 : « Si sfl avec vrais joueurs ») :
//   · les vraies cartes de la ligue, et seulement celles des joueurs dont
//     l'accord hors-app était enregistré « oui » à la lecture de la base :
//     un vrai match (ses dix joueurs, au maillot de leur camp, et son score),
//     la carte d'un joueur avant et après une mise à jour, le haut de chaque
//     division du Pépite d'Or, et les trois titres d'un vrai match. Tout
//     vient de l'instantané (lib/sfl/page-sfl-instantane.ts, écrit et
//     contrôlé par tools/page-sfl-instantane.ts) : la page reste statique,
//     elle ne lit ni la base, ni la saison, ni le joueur connecté. Chaque
//     carte est une image (public/sfl/cartes), dessinée par le vrai
//     composant de l'app ; la carte est un objet, la même en clair et en
//     sombre (dessinée sans ombre, l'ombre est celle de la page, OMBRE).
//     Une division sans carte n'est pas montrée. Hiérarchie de l'app : grande (la carte complète) pour la carte
//     qui a monté et, dès la tablette, les trois titres ; moyenne (la carte
//     photo) pour les podiums, la carte de départ et les titres sur
//     téléphone ; petite (la pastille) pour la compo ;
//   · du noir et blanc, sauf les trois cartes à titre (l'or, le rouge et le
//     bleu leur sont réservés) ; les tuiles Noirs et Blancs gardent les
//     couleurs des maillots dans les deux modes : celle qui a la couleur de
//     la page (Noirs en sombre, Blancs en clair) porte un liseré plus net ;
//   · le thème de l'app, clair ou sombre : rien que des jetons.
// Les textes sont dans lib/sfl/page-sfl.ts, que relit tools/page-sfl-check.ts.
//
// Le cadre est plein écran, au-dessus de la barre d'onglets, comme
// l'inscription ; c'est lui qui défile (la classe overflow-y-auto est exigée
// par ViewportLock). Il force le français de gauche à droite : la page n'est
// pas traduite, et un visiteur d'un pays arabophone recevrait sinon une mise
// en page inversée (LangueDocument).
//
// Chaque carte est une image, avec son texte de remplacement (son nom, puis
// son titre) ; les pastilles de la compo, dont le nom est écrit à côté, se
// taisent. Les images se chargent à l'approche (loading="lazy") ; celle qui
// n'est pas montrée à cette largeur (la carte compacte ou complète d'un
// titre) ne se charge pas.
//
// Trois mises en page, sans défilement horizontal dès 320 px : le téléphone
// (une colonne, 20 px de marge), la tablette (la même, 560 px au centre), et
// l'ordinateur dès 960 px (1120 px, le titre à gauche et le contenu à droite ;
// le haut, les titres et la fin au centre, les deux boutons l'un sous l'autre
// dans l'axe). Sous 390 px, le titre du haut et les phrases se resserrent pour
// garder leurs lignes. Le haut tient dans le premier écran : sur ordinateur,
// ses marges, son sigle et son titre suivent la hauteur de la fenêtre (un
// portable de 1366 × 657 montre les boutons) ; sur un téléphone couché (moins
// de 480 px de haut), il se resserre. Les cartes prennent leur taille de la
// feuille de style : les trois titres en compactes sur téléphone, complètes
// dès 720 px (la rangée leur donne alors 170 px et plus).
//
// Mouvement : sous la ligne de flottaison, chaque section monte de 12 px en
// fondu, une seule fois. L'état caché n'est posé qu'après le montage : le HTML
// servi porte tout le texte, sans rien de caché (un moteur, l'aperçu d'un lien
// le lisent). À l'écran, la page se voit une fois le voile de l'intro levé,
// donc le JavaScript lancé (app-splash.tsx). Avec « Réduire les animations »,
// rien ne bouge. Rien ne tourne en boucle, rien ne suit le défilement : la
// barre du haut paraît quand les boutons du haut sont sortis de l'écran et
// s'efface quand ceux du bas y entrent.
//
// Un joueur déjà connecté reste sur la page ; ses boutons deviennent
// « Ouvrir Bola », et ce qui s'ouvre de soi-même dans l'app (cérémonies,
// invitations) l'attend derrière ce bouton (ApresAccueil). La visite d'un
// visiteur sans compte entre dans l'entonnoir de getbola.app comme celle de la
// page d'accueil (site-visites.ts, étape « site ») ; celle d'un joueur
// connecté n'y entre pas.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Lock } from "lucide-react";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import { SigleSfl } from "@/components/sfl/marques-carte";
import { useSession } from "@/hooks/use-session";
import { getSession } from "@/lib/sfl/auth/session";
import { MAILLOTS } from "@/lib/sfl/maillots";
import {
  BOUTONS_SFL,
  type BoutonSfl,
  CARTE_SFL,
  CLASSEMENT_SFL,
  DIMANCHE_SFL,
  FIN_SFL,
  HAUT_SFL,
  LIENS_SFL,
  SEMAINE_SFL,
  TITRES_SFL,
  etiquetteMatch,
  placeEtPoints,
  pointsLisibles,
} from "@/lib/sfl/page-sfl";
import { CARTE_MONTEE, COMPO, PODIUMS, TITRES, type ImageCarte } from "@/lib/sfl/page-sfl-instantane";
import { noterSite } from "@/lib/sfl/site-visites";
import { cn } from "@/lib/utils";

/** La hauteur de la barre du haut. */
const BARRE = 52;

/** La colonne de la page : 20 px de marge sur téléphone, 560 px au centre d'une tablette, 1120 px sur ordinateur. */
const COLONNE = "mx-auto w-full px-5 min-[720px]:max-w-[600px] min-[960px]:max-w-[1200px] min-[960px]:px-10";
const ETIQUETTE = "mono-label text-encre-3";
/** Le sigle du haut : le fichier de SigleSfl, en masque ; sa hauteur est réglée par la feuille de style. */
const MASQUE_SIGLE = "url(/bola/sfl.svg) center / contain no-repeat";
/**
 * Le liseré d'une tuile de camp : celui des pastilles (point-maillot.tsx,
 * LISERE_CAMP) ; plus net (1,5 px, l'encre à 28 %) pour la tuile qui a la
 * couleur de la page, qui sinon s'y fond.
 */
const LISERE_TUILE = {
  Noirs: "shadow-[inset_0_0_0_1px_rgba(128,128,128,0.45)] dark:shadow-[inset_0_0_0_1.5px_rgb(var(--foreground-rgb)/0.28)]",
  Blancs: "shadow-[inset_0_0_0_1.5px_rgb(var(--foreground-rgb)/0.28)] dark:shadow-[inset_0_0_0_1px_rgba(128,128,128,0.45)]",
} as const;
const TITRE = "mt-3 text-nom leading-[1.05] font-extrabold tracking-tight text-balance min-[960px]:mt-4 min-[960px]:text-[clamp(40px,3.9vw,56px)] min-[960px]:leading-[1.02]";
/** Le même titre, quand il ne s'écrit que sur ordinateur (lu, sans être vu, en dessous). */
const TITRE_ORDINATEUR = "min-[960px]:mt-4 min-[960px]:text-[clamp(40px,3.9vw,56px)] min-[960px]:leading-[1.02] min-[960px]:font-extrabold min-[960px]:tracking-tight min-[960px]:text-balance";
const AFFICHE = "font-extrabold tracking-tight";
const FILET = "border-foreground/10";
/** Une phrase de contenu : 19 px, un peu moins sur un téléphone étroit ; 22 px sur ordinateur. */
const PHRASE = "text-[clamp(16px,4.87vw,19px)] leading-snug font-bold text-balance min-[960px]:text-titre-m";
const ANNEAU = "rounded-full outline-offset-4 focus-visible:outline-2 focus-visible:outline-foreground";
/**
 * L'ombre portée d'une carte : celle du lien d'un parrain en sombre ; en clair,
 * une ombre légère (la même y ferait une tache grise sur le papier).
 */
const OMBRE = {
  grande: "[filter:drop-shadow(0_16px_26px_rgba(20,12,4,0.2))] dark:[filter:drop-shadow(0_21px_34px_rgba(0,0,0,0.45))]",
  petite: "[filter:drop-shadow(0_8px_13px_rgba(20,12,4,0.18))] dark:[filter:drop-shadow(0_13px_21px_rgba(0,0,0,0.4))]",
};
/** Une section sous la ligne de flottaison : cachée après le montage, elle monte en entrant dans l'écran. */
const APPARAIT =
  "transition-[opacity,translate] duration-[400ms] ease-out data-[cache]:translate-y-3 data-[cache]:opacity-0 motion-reduce:transition-none";

/** Les phrases d'une section : la première à l'encre, les suivantes en retrait. */
function Phrases({ phrases, className }: { phrases: readonly string[]; className?: string }) {
  return (
    <div className={cn(PHRASE, "space-y-1.5 whitespace-pre-line min-[960px]:space-y-2", className)}>
      {phrases.map((p, i) => (
        <p key={p} className={i === 0 ? "text-encre" : "text-encre-2"}>
          {p}
        </p>
      ))}
    </div>
  );
}

/**
 * Une vraie carte, en image (l'instantané) : sa largeur vient de la classe,
 * sa hauteur de son rapport. `muette` : le nom est écrit à côté, l'image se tait.
 */
function Carte({ image, className, muette }: { image: ImageCarte; className?: string; muette?: boolean }) {
  return (
    // Une image déjà à sa taille (WebP, 3 px par px affiché) : l'optimiseur de Next n'y ajouterait rien.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src}
      alt={image.lue}
      aria-hidden={muette || undefined}
      width={image.largeur}
      height={image.hauteur}
      loading="lazy"
      decoding="async"
      draggable={false}
      data-nosnippet
      className={cn("block h-auto select-none", className)}
    />
  );
}

/** Un bouton : son texte et son adresse vont ensemble (BOUTONS_SFL). */
function Bouton({ bouton, className }: { bouton: BoutonSfl; className?: string }) {
  return (
    <Link href={bouton.vers} className={className}>
      {bouton.texte}
    </Link>
  );
}

/**
 * Les boutons de la page, l'un sous l'autre, dans l'axe : un visiteur crée son
 * compte ou se connecte ; un joueur connecté ouvre l'app.
 */
function Boutons({
  connecte,
  className,
  ref,
}: {
  connecte: boolean;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const principal = "flex items-center justify-center py-4 text-lecture font-bold min-[960px]:min-w-[232px] min-[960px]:px-8";
  const discret = "flex items-center justify-center py-3.5 text-ligne font-semibold min-[960px]:px-6";
  return (
    <div ref={ref} className={cn("flex flex-col gap-2.5 min-[960px]:items-center", className)}>
      {connecte ? (
        <Bouton bouton={BOUTONS_SFL.ouvrir} className={cn("bouton-principal", principal)} />
      ) : (
        <>
          <Bouton bouton={BOUTONS_SFL.creer} className={cn("bouton-principal bouton--vert", principal)} />
          <Bouton bouton={BOUTONS_SFL.connecter} className={cn("bouton-discret", discret)} />
        </>
      )}
    </div>
  );
}

export function PageSfl() {
  const session = useSession();
  const connecte = !!session?.server && !session.enAttente;
  const cadre = useRef<HTMLDivElement>(null);
  const boutonsHaut = useRef<HTMLDivElement>(null);
  const boutonsFin = useRef<HTMLDivElement>(null);
  const [barre, setBarre] = useState(false);

  // Le haut de l'entonnoir : un visiteur de plus sur getbola.app. Un joueur
  // déjà connecté (ou dont le compte attend) n'en est pas un.
  useEffect(() => {
    if (!getSession()) noterSite("site");
  }, []);

  // La barre : entre les boutons du haut (sortis de l'écran) et ceux du bas (pas encore entrés).
  useEffect(() => {
    const racine = cadre.current;
    const haut = boutonsHaut.current;
    const fin = boutonsFin.current;
    if (!racine || !haut || !fin) return;
    const vus = new Map<Element, boolean>([
      [haut, true],
      [fin, false],
    ]);
    const io = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) vus.set(e.target, e.isIntersecting);
        setBarre(!vus.get(haut) && !vus.get(fin));
      },
      { root: racine, rootMargin: `-${BARRE}px 0px 0px 0px` }
    );
    io.observe(haut);
    io.observe(fin);
    return () => io.disconnect();
  }, []);

  // Les apparitions : seules les sections encore sous l'écran sont cachées, et une seule fois.
  useEffect(() => {
    const racine = cadre.current;
    if (!racine || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sections = [...racine.querySelectorAll<HTMLElement>("[data-apparait]")];
    const io = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (!e.isIntersecting) continue;
          delete (e.target as HTMLElement).dataset.cache;
          io.unobserve(e.target);
        }
      },
      { root: racine, rootMargin: "0px 0px -8% 0px" }
    );
    const bas = racine.getBoundingClientRect().bottom;
    for (const s of sections) {
      if (s.getBoundingClientRect().top < bas) continue;
      s.dataset.cache = "";
      io.observe(s);
    }
    return () => {
      io.disconnect();
      for (const s of sections) delete s.dataset.cache;
    };
  }, []);

  // Les trois titres de l'instantané, dans l'ordre des éditions ; un titre retiré resserre la rangée.
  const titres = TITRES_SFL.cartes.flatMap((e) => {
    const carte = TITRES.cartes.find((c) => c.edition === e.edition);
    return carte ? [{ ...carte, titre: e.nom }] : [];
  });

  return (
    <div
      ref={cadre}
      lang="fr"
      dir="ltr"
      className="fixed inset-0 z-[60] overflow-x-hidden overflow-y-auto overscroll-contain bg-background text-foreground"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* La barre du haut : le sigle, et le bouton qui reste sous le pouce. */}
      <div
        inert={!barre}
        className={cn(
          "glass-soft fixed inset-x-0 top-0 z-20 border-x-0 border-t-0 bg-background/80 backdrop-blur-xl transition-opacity duration-200 motion-reduce:transition-none",
          barre ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className={cn(COLONNE, "flex items-center justify-between")} style={{ height: BARRE }}>
          <SigleSfl hauteur={14} couleur="currentColor" />
          <Bouton
            bouton={connecte ? BOUTONS_SFL.ouvrir : BOUTONS_SFL.creer}
            // La pilule fait 34 px ; sa zone de toucher, 44.
            className={cn(
              "bouton-principal flex h-[34px] items-center px-4 text-petit font-bold before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-['']",
              !connecte && "bouton--vert"
            )}
          />
        </div>
      </div>

      {/* Le contenu : la racine de l'app (layout.tsx) porte déjà le <main>. */}
      <div>
        {/* 1 · Le haut : sur ordinateur, tout suit la hauteur de la fenêtre (les valeurs d'un écran de 900 px au plus) ; resserré sur un téléphone couché. */}
        <header className={cn(COLONNE, "flex flex-col items-center pt-11 text-center min-[960px]:pt-[clamp(48px,12.5vh,112px)] [@media(max-height:480px)]:pt-6")}>
          <p className={ETIQUETTE}>{HAUT_SFL.etiquette}</p>
          <span
            role="img"
            aria-label={HAUT_SFL.sigle}
            className={cn("mt-7 block aspect-[735/237] h-[76px] bg-current min-[960px]:mt-[clamp(24px,5.4vh,48px)] min-[960px]:h-[clamp(88px,15.6vh,140px)] [@media(max-height:480px)]:mt-4 [@media(max-height:480px)]:h-12")}
            style={{ mask: MASQUE_SIGLE, WebkitMask: MASQUE_SIGLE }}
          />
          <h1
            className={cn(
              AFFICHE,
              "mt-7 text-[clamp(30px,9.7vw,44px)] leading-[1.04] min-[960px]:mt-[clamp(24px,5.4vh,48px)] min-[960px]:text-[clamp(56px,min(6.7vw,11.5vh),96px)] min-[960px]:leading-none [@media(max-height:480px)]:mt-4"
            )}
          >
            {HAUT_SFL.titre.map((ligne) => (
              <span key={ligne} className="block whitespace-nowrap">
                {ligne}
              </span>
            ))}
          </h1>
          <p className={cn("mt-4 text-titre-fort font-bold text-encre-2 min-[960px]:mt-[clamp(14px,3.2vh,28px)] min-[960px]:text-titre-g [@media(max-height:480px)]:mt-2")}>{HAUT_SFL.ligne}</p>
          <Boutons
            ref={boutonsHaut}
            connecte={connecte}
            className={cn("mt-9 w-full min-[720px]:max-w-[420px] min-[960px]:mt-[clamp(24px,5.4vh,48px)] min-[960px]:w-auto min-[960px]:max-w-none [@media(max-height:480px)]:mt-5")}
          />
        </header>

        {/* 2 · La semaine */}
        <section
          data-apparait
          aria-labelledby="sfl-semaine"
          className={cn(COLONNE, APPARAIT, "mt-24 min-[960px]:mt-40 min-[960px]:grid min-[960px]:grid-cols-12 min-[960px]:gap-x-16")}
        >
          <div className="min-[960px]:col-span-5">
            <p className={ETIQUETTE}>{SEMAINE_SFL.etiquette}</p>
            <h2 id="sfl-semaine" className={TITRE}>
              {SEMAINE_SFL.titre}
            </h2>
          </div>
          <dl className={cn("mt-8 border-b min-[960px]:col-span-7 min-[960px]:mt-1", FILET)}>
            {SEMAINE_SFL.lignes.map((l) => (
              <div key={`${l.jour}${l.heure ?? ""}`} className={cn("flex items-center gap-3 border-t py-4 min-[960px]:gap-8 min-[960px]:py-5", FILET)}>
                {/* Le jour est du contenu : l'encre des phrases en retrait, son heure à l'encre. */}
                <dt className="mono-label w-[84px] shrink-0 leading-[1.5] text-encre-2 min-[960px]:w-32">
                  <span className="block">{l.jour}</span>
                  {l.heure && <span className="block text-encre">{l.heure}</span>}
                </dt>
                <dd className="flex min-w-0 flex-1 flex-col items-start gap-2.5 min-[960px]:flex-row min-[960px]:items-center min-[960px]:justify-between min-[960px]:gap-3">
                  <span className={PHRASE}>{l.phrase}</span>
                  {l.pastille && (
                    <span className="flex h-[30px] shrink-0 items-center gap-[5px] rounded-full bg-foreground px-3 text-[12.5px] font-semibold text-background">
                      <Lock aria-hidden className="size-3" strokeWidth={2.6} />
                      {l.pastille}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 3 · Le dimanche : sur téléphone le diptyque est le titre ; sur ordinateur le titre s'écrit à gauche, comme ailleurs. */}
        <section
          data-apparait
          aria-labelledby="sfl-dimanche"
          className={cn(
            COLONNE,
            APPARAIT,
            "mt-24 min-[960px]:mt-40 min-[960px]:grid min-[960px]:grid-cols-12 min-[960px]:grid-rows-[auto_1fr] min-[960px]:gap-x-16"
          )}
        >
          <div className="min-[960px]:col-span-5">
            <p className={ETIQUETTE}>{DIMANCHE_SFL.etiquette}</p>
            <h2 id="sfl-dimanche" className={cn("sr-only min-[960px]:not-sr-only", TITRE_ORDINATEUR)}>
              {DIMANCHE_SFL.titre}
            </h2>
          </div>
          {/* Un vrai match : chaque camp, son score, ses cinq joueurs en pastille, au maillot du camp. */}
          <div className="mt-6 min-[960px]:col-span-7 min-[960px]:col-start-6 min-[960px]:row-span-2 min-[960px]:row-start-1 min-[960px]:mt-1 min-[960px]:self-start">
            <div className="relative grid grid-cols-2 gap-2 min-[960px]:gap-3">
              {COMPO.camps.map((c) => (
                <div
                  key={c.camp}
                  className={cn("flex min-w-0 flex-col rounded-tuile p-3.5 min-[400px]:p-4 min-[960px]:p-6", LISERE_TUILE[c.camp], OMBRE.petite)}
                  style={{ background: MAILLOTS[c.camp].fond, color: MAILLOTS[c.camp].encre }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="titre-lettrage text-[clamp(19px,6.2vw,28px)] leading-none min-[960px]:text-[44px]">{c.camp}</span>
                    <span className="font-display text-[clamp(22px,7.2vw,32px)] leading-none tabular-nums min-[960px]:text-[48px]">{c.score}</span>
                  </div>
                  <ul className="mt-5 space-y-2 min-[960px]:mt-7 min-[960px]:space-y-3">
                    {c.joueurs.map((j) => (
                      <li key={j.nom} className="flex min-w-0 items-center gap-2 min-[400px]:gap-2.5 min-[960px]:gap-3.5">
                        <Carte image={j.image} muette className="w-[clamp(32px,10vw,40px)] shrink-0 min-[960px]:w-14" />
                        <span className="min-w-0 truncate text-[clamp(12px,3.45vw,14px)] font-semibold min-[960px]:text-lecture">{j.nom}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {/* « contre », à cheval sur le haut des deux tuiles, dans leur marge : il ne couvre ni un nom, ni un score, ni une pastille ; sur ordinateur, le titre le dit. */}
              <p
                aria-hidden
                className={cn(
                  ETIQUETTE,
                  "absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background px-2.5 py-1 shadow-[0_0_0_1px_rgba(128,128,128,0.45)] min-[960px]:hidden"
                )}
              >
                {DIMANCHE_SFL.contre}
              </p>
            </div>
            <p className={cn(ETIQUETTE, "mt-3 text-encre-2 min-[960px]:mt-4")}>{etiquetteMatch(COMPO)}</p>
          </div>
          <Phrases
            phrases={DIMANCHE_SFL.phrases}
            className="mt-7 min-[960px]:col-span-5 min-[960px]:col-start-1 min-[960px]:row-start-2 min-[960px]:mt-8"
          />
        </section>

        {/* 4 · Ta carte */}
        <section
          data-apparait
          aria-labelledby="sfl-carte"
          className={cn(COLONNE, APPARAIT, "mt-24 min-[960px]:mt-40 min-[960px]:grid min-[960px]:grid-cols-12 min-[960px]:gap-x-16")}
        >
          <div className="min-[960px]:col-span-5">
            <p className={ETIQUETTE}>{CARTE_SFL.etiquette}</p>
            <h2 id="sfl-carte" className={TITRE}>
              {CARTE_SFL.titre}
            </h2>
            {/* Un vrai joueur : sa carte de départ, en moyenne, puis l'officielle après la mise à jour, en grand. */}
            <div className="mt-10 flex items-end justify-center gap-3 min-[960px]:mt-14 min-[960px]:justify-start min-[960px]:gap-6">
              <Carte image={CARTE_MONTEE.depart} className={cn("w-[min(96px,25vw)] min-[960px]:w-[118px]", OMBRE.petite)} />
              <Carte image={CARTE_MONTEE.officielle} className={cn("w-[min(203px,57vw)] min-[960px]:w-[clamp(220px,20vw,272px)]", OMBRE.grande)} />
            </div>
            <p className={cn(ETIQUETTE, "mt-5 flex items-center justify-center gap-1.5 text-encre-2 min-[960px]:justify-start")}>
              <span className="tabular-nums">{CARTE_MONTEE.de}</span>
              <ArrowRight aria-hidden className="size-3" strokeWidth={2.6} />
              <span className="text-encre tabular-nums">{CARTE_MONTEE.a}</span>
            </p>
          </div>
          <div className="mt-12 min-[960px]:col-span-7 min-[960px]:mt-1">
            <dl className={cn("border-b", FILET)}>
              {CARTE_SFL.lignes.map((l) => (
                <div key={l.geste} className={cn("flex items-center justify-between gap-4 border-t py-3.5 min-[960px]:py-[18px]", FILET)}>
                  <dt className="text-titre leading-snug font-bold text-balance min-[960px]:text-titre-fort">{l.geste}</dt>
                  <dd className={cn(ETIQUETTE, "flex shrink-0 items-center gap-1 text-right text-encre-2")}>
                    <ArrowUp aria-hidden className="size-3" strokeWidth={2.6} />
                    {l.stat}
                  </dd>
                </div>
              ))}
            </dl>
            <Phrases phrases={CARTE_SFL.phrases} className="mt-7" />
          </div>
        </section>

        {/* 5 · Le classement */}
        <section
          data-apparait
          aria-labelledby="sfl-classement"
          className={cn(COLONNE, APPARAIT, "mt-24 min-[960px]:mt-40 min-[960px]:grid min-[960px]:grid-cols-12 min-[960px]:gap-x-16")}
        >
          <div className="min-[960px]:col-span-5">
            <p className={ETIQUETTE}>{CLASSEMENT_SFL.etiquette}</p>
            <h2 id="sfl-classement" className={TITRE}>
              {CLASSEMENT_SFL.titre}
            </h2>
          </div>
          <div className="mt-8 min-[960px]:col-span-7 min-[960px]:mt-1">
            <ul className="grid grid-cols-2 gap-2 min-[960px]:grid-cols-4">
              {CLASSEMENT_SFL.bareme.map((t) => (
                <li key={t.cle} className={cn("rounded-champ border px-4 pt-3.5 pb-3 min-[960px]:px-2.5", FILET)}>
                  <span className="block font-display text-titre-l leading-none tabular-nums">{pointsLisibles(t.points)}</span>
                  <span className="mt-2 block text-petit leading-tight font-semibold text-encre-2">{t.libelle}</span>
                </li>
              ))}
            </ul>
            {/* Le haut de chaque division : les vrais premiers, sans trou ; une division sans carte n'est pas montrée (une tuile vide ressemble à un chargement raté). */}
            <ul className="mt-5 space-y-2 min-[960px]:mt-6 min-[960px]:space-y-3">
              {PODIUMS.filter((d) => d.places.length > 0).map((d) => (
                <li key={d.division} className={cn("rounded-champ border p-4 min-[960px]:p-5", FILET)}>
                  <p className="font-display text-affiche leading-none">{d.division}</p>
                  <ol className="mt-4 grid grid-cols-3 gap-2 min-[960px]:gap-4">
                    {d.places.map((x) => (
                      <li key={x.nom} className="min-w-0">
                        <Carte image={x.image} className={cn("w-full max-w-[150px]", OMBRE.petite)} />
                        <p className={cn(ETIQUETTE, "mt-2.5 truncate text-encre-2")}>{placeEtPoints(x.place, x.points)}</p>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
            <Phrases phrases={CLASSEMENT_SFL.phrases} className="mt-7" />
          </div>
        </section>

        {/* 6 · Les titres */}
        <section data-apparait aria-labelledby="sfl-titres" className={cn(COLONNE, APPARAIT, "mt-24 min-[960px]:mt-40 min-[960px]:text-center")}>
          <p className={ETIQUETTE}>{TITRES_SFL.etiquette}</p>
          <h2 id="sfl-titres" className={TITRE}>
            {TITRES_SFL.titre}
          </h2>
          {/* Les trois titres d'un vrai match : compactes sur téléphone, complètes dès 720 px. */}
          <div className="mt-9 flex justify-center gap-2.5 min-[720px]:gap-5 min-[960px]:mt-14 min-[960px]:gap-10">
            {titres.map((c) => (
              <div key={c.edition} className="flex w-[calc((100%-20px)/3)] max-w-[220px] flex-col items-center min-[720px]:w-[calc((100%-40px)/3)]">
                <Carte image={c.petite} className={cn("w-full max-w-[150px] min-[720px]:hidden", OMBRE.petite)} />
                <Carte image={c.complete} className={cn("hidden w-full min-[720px]:block", OMBRE.petite)} />
                {/* Une carte complète porte son étiquette : on ne la répète pas dessous. */}
                <p aria-hidden className={cn(ETIQUETTE, "mt-4 text-encre-2 min-[720px]:hidden")}>
                  {c.titre}
                </p>
              </div>
            ))}
          </div>
          <p className={cn(ETIQUETTE, "mt-5 text-encre-2 min-[960px]:mt-8")}>{etiquetteMatch(TITRES)}</p>
          <Phrases phrases={TITRES_SFL.phrases} className="mt-9 min-[960px]:mx-auto min-[960px]:mt-14 min-[960px]:max-w-[640px]" />
          <div className={cn("mt-10 border-t pt-8 min-[960px]:mx-auto min-[960px]:mt-14 min-[960px]:max-w-[640px] min-[960px]:pt-12", FILET)}>
            <p className={ETIQUETTE}>{TITRES_SFL.saison.etiquette}</p>
            <Phrases phrases={TITRES_SFL.saison.phrases} className="mt-4" />
          </div>
        </section>

        {/* 7 · La fin */}
        <section
          data-apparait
          aria-labelledby="sfl-fin"
          className={cn(COLONNE, APPARAIT, "mt-24 min-[960px]:mt-40 min-[960px]:flex min-[960px]:flex-col min-[960px]:items-center min-[960px]:text-center")}
        >
          <p className={ETIQUETTE}>{FIN_SFL.etiquette}</p>
          <h2 id="sfl-fin" className={cn(AFFICHE, "mt-3 text-[clamp(34px,10.4vw,44px)] leading-[1.04] min-[960px]:mt-4 min-[960px]:text-[clamp(72px,6.7vw,96px)] min-[960px]:leading-none")}>
            {FIN_SFL.titre}
          </h2>
          <ol className="mt-8 space-y-3 min-[960px]:mt-12 min-[960px]:space-y-4">
            {FIN_SFL.etapes.map((etape, i) => (
              <li key={etape} className={cn(PHRASE, "flex items-baseline gap-3 min-[960px]:gap-4")}>
                <span aria-hidden className="w-4 shrink-0 font-display text-titre-m leading-none text-encre-3 tabular-nums min-[960px]:text-titre-g">
                  {i + 1}
                </span>
                <span className="text-left">{etape}</span>
              </li>
            ))}
          </ol>
          <Boutons ref={boutonsFin} connecte={connecte} className="mt-10 w-full min-[720px]:max-w-[420px] min-[960px]:mt-14 min-[960px]:w-auto min-[960px]:max-w-none" />
        </section>
      </div>

      <footer
        className={cn(COLONNE, "mt-24 min-[960px]:mt-40")}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
      >
        <div className={cn("flex flex-col gap-5 border-t pt-7 pb-4 min-[960px]:flex-row min-[960px]:items-center min-[960px]:justify-between", FILET)}>
          <div className="flex items-center gap-4">
            <Link href={LIENS_SFL.app} aria-label={FIN_SFL.etiquette} className={cn(ANNEAU, "-my-[15px] flex items-center py-[15px]")}>
              <svg viewBox="0 0 1000 237" className="h-[14px] w-auto" fill="currentColor" aria-hidden>
                <path d={LOGO_BOLA.symbole} />
                <path d={LOGO_BOLA.logotype} />
              </svg>
            </Link>
            <p className={ETIQUETTE}>{FIN_SFL.pied.ligue}</p>
          </div>
          <div className="flex items-center gap-5">
            <Link href={LIENS_SFL.confidentialite} className={cn(ETIQUETTE, ANNEAU, "-my-4 py-4 text-encre-2")}>
              {FIN_SFL.pied.confidentialite}
            </Link>
            <p className={ETIQUETTE}>{FIN_SFL.pied.droits}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
