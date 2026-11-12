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
// Ce qu'elle montre :
//   · aucun joueur réel, ni nom, ni photo, ni score : la page est statique,
//     elle ne peut ni vérifier un accord « hors de l'app » ni suivre son
//     retrait. Les quatre cartes sont celle d'un compte neuf, au nom de
//     « Toi », à 75 partout (carte-neutre.ts) : la carte de saison, et les
//     trois cartes à titre. Elle ne lit ni la saison ni le joueur connecté ;
//   · du noir et blanc, sauf ces trois cartes (l'or, le rouge et le bleu
//     leur sont réservés) ; les tuiles Noirs et Blancs gardent les couleurs
//     des maillots dans les deux modes ;
//   · le thème de l'app, clair ou sombre : rien que des jetons.
// Les textes sont dans lib/sfl/page-sfl.ts, que relit tools/page-sfl-check.ts.
//
// Le cadre est plein écran, au-dessus de la barre d'onglets, comme
// l'inscription ; c'est lui qui défile (la classe overflow-y-auto est exigée
// par ViewportLock). Il force le français de gauche à droite : la page n'est
// pas traduite, et un visiteur d'un pays arabophone recevrait sinon une mise
// en page inversée (LangueDocument).
//
// Chaque carte est une image pour un lecteur d'écran et pour un moteur : son
// microtexte (2 600 signes) n'est ni lu, ni repris dans un extrait.
//
// Trois mises en page, sans défilement horizontal dès 320 px : le téléphone
// (une colonne, 20 px de marge), la tablette (la même, 560 px au centre), et
// l'ordinateur dès 960 px (1120 px, le titre à gauche et le contenu à droite ;
// le haut, les titres et la fin au centre). Sous 390 px, le titre du haut et
// les phrases se resserrent pour garder leurs lignes. Une carte reçoit sa
// taille en nombre : les trois cartes à titre prennent la largeur de leur
// rangée, la carte de saison celle de sa colonne sur ordinateur (useLargeur).
//
// Mouvement : sous la ligne de flottaison, chaque section monte de 12 px en
// fondu, une seule fois. L'état caché n'est posé qu'après le montage (sans
// JavaScript tout est visible, et le HTML servi porte tout le texte). Avec
// « Réduire les animations », rien ne bouge. Rien ne tourne en boucle, rien
// ne suit le défilement : la barre du haut paraît quand les boutons du haut
// sont sortis de l'écran et s'efface quand ceux du bas y entrent.
//
// Un joueur déjà connecté reste sur la page ; ses boutons deviennent
// « Ouvrir Bola ». La visite compte dans l'entonnoir de getbola.app comme
// celle de la page d'accueil (site-visites.ts, étape « site »).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { BolaCard, type BolaEdition } from "@/components/sfl/bola-card";
import { DosCarte } from "@/components/sfl/dos-carte";
import { LOGO_BOLA, RAYON_CARTE, matiereDe } from "@/components/sfl/finitions-carte";
import { SigleSfl } from "@/components/sfl/marques-carte";
import { LISERE_CAMP } from "@/components/sfl/point-maillot";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSession } from "@/hooks/use-session";
import { carteNeutre } from "@/lib/sfl/carte-neutre";
import { MAILLOTS } from "@/lib/sfl/maillots";
import {
  BOUTONS_SFL,
  CARTE_SFL,
  CLASSEMENT_SFL,
  DIMANCHE_SFL,
  FIN_SFL,
  HAUT_SFL,
  LIENS_SFL,
  SEMAINE_SFL,
  TITRES_SFL,
  pointsLisibles,
} from "@/lib/sfl/page-sfl";
import { noterSite } from "@/lib/sfl/site-visites";
import { cn } from "@/lib/utils";

/** La carte d'un compte neuf : 75 partout, sans visage. */
const TOI = carteNeutre(CARTE_SFL.nom);

/** La largeur d'une carte à la taille 1, et le rapport de ses côtés. */
const CARTE = { l: 254, rapport: 1656 / 1024 };
/**
 * Les trois cartes à titre sur une rangée de téléphone : elles tiennent la
 * largeur de la colonne (0,43 sur un écran de 390), sans passer au palier de
 * la carte complète sur une tablette ; l'écart entre elles.
 */
const RANGEE = { taille: 0.43, max: 0.66, ecart: 10 };
/** La hauteur de la barre du haut. */
const BARRE = 52;

/** La colonne de la page : 20 px de marge sur téléphone, 560 px au centre d'une tablette, 1120 px sur ordinateur. */
const COLONNE = "mx-auto w-full px-5 min-[720px]:max-w-[600px] min-[960px]:max-w-[1200px] min-[960px]:px-10";
const ETIQUETTE = "mono-label text-encre-3";
const TITRE = "mt-3 text-nom leading-[1.05] font-extrabold tracking-tight text-balance min-[960px]:mt-4 min-[960px]:text-[clamp(40px,3.9vw,56px)] min-[960px]:leading-[1.02]";
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

/** La largeur d'un bloc, suivie : `null` avant le montage. */
function useLargeur(ref: React.RefObject<HTMLElement | null>): number | null {
  const [largeur, setLargeur] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargeur(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return largeur;
}

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

/** Une vraie carte, montrée comme une image : ni son microtexte ni ses chiffres ne sont lus. */
function Carte({
  lue,
  edition = "base",
  taille,
  className,
}: {
  lue: string;
  edition?: BolaEdition;
  taille: number;
  className?: string;
}) {
  return (
    <div role="img" aria-label={lue} data-nosnippet className={className}>
      <div aria-hidden style={{ width: CARTE.l * taille, height: CARTE.l * taille * CARTE.rapport }}>
        <BolaCard name={TOI.name} position={TOI.poste} overall={CARTE_SFL.note} stats={TOI.stats} edition={edition} size={taille} />
      </div>
    </div>
  );
}

/** Les boutons de la page : un visiteur crée son compte ou se connecte ; un joueur connecté ouvre l'app. */
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
    <div ref={ref} className={cn("flex flex-col gap-2.5 min-[960px]:flex-row min-[960px]:items-center min-[960px]:gap-3", className)}>
      {connecte ? (
        <>
          <Link href={LIENS_SFL.app} className={cn("bouton-principal", principal)}>
            {BOUTONS_SFL.ouvrir}
          </Link>
          {/* La place du second bouton : la page ne saute pas quand la session arrive. */}
          <span aria-hidden className={cn("invisible min-[960px]:hidden", discret)}>
            {BOUTONS_SFL.connecter}
          </span>
        </>
      ) : (
        <>
          <Link href={LIENS_SFL.inscription} className={cn("bouton-principal bouton--vert", principal)}>
            {BOUTONS_SFL.creer}
          </Link>
          <Link href={LIENS_SFL.connexion} className={cn("bouton-discret", discret)}>
            {BOUTONS_SFL.connecter}
          </Link>
        </>
      )}
    </div>
  );
}

export function PageSfl() {
  const session = useSession();
  const connecte = !!session?.server && !session.enAttente;
  const ordinateur = useMediaQuery("(min-width: 960px)");
  const cadre = useRef<HTMLDivElement>(null);
  const boutonsHaut = useRef<HTMLDivElement>(null);
  const boutonsFin = useRef<HTMLDivElement>(null);
  const rangee = useRef<HTMLDivElement>(null);
  const largeurRangee = useLargeur(rangee);
  const colonneCarte = useRef<HTMLDivElement>(null);
  const largeurColonneCarte = useLargeur(colonneCarte);
  const [barre, setBarre] = useState(false);

  // Le haut de l'entonnoir : un visiteur de plus sur getbola.app.
  useEffect(() => noterSite("site"), []);

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

  // Les trois cartes à titre : complètes sur ordinateur ; sur téléphone, à la largeur de la colonne.
  const tailleTitre = ordinateur
    ? 0.8
    : largeurRangee
      ? Math.min(RANGEE.max, (largeurRangee - RANGEE.ecart * 2) / 3 / CARTE.l)
      : RANGEE.taille;
  // La carte de saison : 203 px sur téléphone ; sur ordinateur, 317 px au plus, et
  // moins dans une colonne étroite (le dos dépasse d'elle d'un tiers de sa largeur).
  const tailleCarte = ordinateur
    ? Math.max(0.8, Math.min(1.25, largeurColonneCarte ? largeurColonneCarte / 1.35 / CARTE.l : 1.25))
    : 0.8;
  const hauteurSigle = ordinateur ? 140 : 76;

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
          <Link
            href={connecte ? LIENS_SFL.app : LIENS_SFL.inscription}
            // La pilule fait 34 px ; sa zone de toucher, 44.
            className={cn(
              "bouton-principal flex h-[34px] items-center px-4 text-petit font-bold before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-['']",
              !connecte && "bouton--vert"
            )}
          >
            {connecte ? BOUTONS_SFL.ouvrir : BOUTONS_SFL.creer}
          </Link>
        </div>
      </div>

      <main>
        {/* 1 · Le haut */}
        <header className={cn(COLONNE, "flex flex-col items-center pt-11 text-center min-[960px]:pt-28")}>
          <p className={ETIQUETTE}>{HAUT_SFL.etiquette}</p>
          <div className="mt-7 min-[960px]:mt-12">
            <SigleSfl hauteur={hauteurSigle} couleur="currentColor" />
          </div>
          <h1 className={cn(AFFICHE, "mt-7 text-[clamp(30px,9.7vw,44px)] leading-[1.04] min-[960px]:mt-12 min-[960px]:text-[clamp(72px,6.7vw,96px)] min-[960px]:leading-none")}>
            {HAUT_SFL.titre.map((ligne) => (
              <span key={ligne} className="block whitespace-nowrap">
                {ligne}
              </span>
            ))}
          </h1>
          <p className="mt-4 text-titre-fort font-bold text-encre-2 min-[960px]:mt-7 min-[960px]:text-titre-g">{HAUT_SFL.ligne}</p>
          <Boutons ref={boutonsHaut} connecte={connecte} className="mt-9 w-full min-[720px]:max-w-[420px] min-[960px]:mt-12 min-[960px]:w-auto min-[960px]:max-w-none" />
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
                <dt className={cn(ETIQUETTE, "w-[84px] shrink-0 leading-[1.5] min-[960px]:w-32")}>
                  <span className="block">{l.jour}</span>
                  {l.heure && <span className="block text-encre-2">{l.heure}</span>}
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

        {/* 3 · Le dimanche : le diptyque est le titre. */}
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
            <h2 id="sfl-dimanche" className="sr-only">
              {DIMANCHE_SFL.titre}
            </h2>
          </div>
          <div aria-hidden className="mt-4 min-[960px]:col-span-7 min-[960px]:col-start-6 min-[960px]:row-span-2 min-[960px]:row-start-1 min-[960px]:mt-0">
            <div className="grid grid-cols-2 gap-2 min-[960px]:gap-3">
              {DIMANCHE_SFL.camps.map((camp) => (
                <div
                  key={camp}
                  className="flex aspect-[4/5] items-end rounded-tuile p-4 min-[960px]:p-6"
                  style={{ background: MAILLOTS[camp].fond, color: MAILLOTS[camp].encre, boxShadow: LISERE_CAMP }}
                >
                  <span className="titre-lettrage text-[clamp(24px,7.7vw,30px)] leading-none min-[960px]:text-[44px]">{camp}</span>
                </div>
              ))}
            </div>
            <p className={cn(ETIQUETTE, "mt-3 text-center")}>{DIMANCHE_SFL.contre}</p>
          </div>
          <Phrases
            phrases={DIMANCHE_SFL.phrases}
            className="mt-7 min-[960px]:col-span-5 min-[960px]:col-start-1 min-[960px]:row-start-2 min-[960px]:mt-0 min-[960px]:self-end min-[960px]:pb-9"
          />
        </section>

        {/* 4 · Ta carte */}
        <section
          data-apparait
          aria-labelledby="sfl-carte"
          className={cn(COLONNE, APPARAIT, "mt-24 min-[960px]:mt-40 min-[960px]:grid min-[960px]:grid-cols-12 min-[960px]:gap-x-16")}
        >
          <div ref={colonneCarte} className="min-[960px]:col-span-5">
            <p className={ETIQUETTE}>{CARTE_SFL.etiquette}</p>
            <h2 id="sfl-carte" className={TITRE}>
              {CARTE_SFL.titre}
            </h2>
            <div className="relative mt-10 flex justify-center min-[960px]:mt-14 min-[960px]:justify-start">
              {/* Sur ordinateur, le dos de la carte, décalé derrière elle. */}
              {ordinateur && (
                <div
                  aria-hidden
                  data-nosnippet
                  className={cn("absolute top-0 left-0 origin-bottom-left", OMBRE.grande)}
                  style={{ transform: `translate(${Math.round(CARTE.l * tailleCarte * 0.2)}px, -10px) rotate(7deg)` }}
                >
                  <div className="overflow-hidden" style={{ borderRadius: (RAYON_CARTE * CARTE.l * tailleCarte) / 1024 }}>
                    <DosCarte matiere={matiereDe("base")} nom="" size={tailleCarte} />
                  </div>
                </div>
              )}
              <Carte lue={CARTE_SFL.lue} taille={tailleCarte} className={cn("relative", OMBRE.grande)} />
            </div>
          </div>
          <div className="mt-12 min-[960px]:col-span-7 min-[960px]:mt-1">
            <dl className={cn("border-b", FILET)}>
              {CARTE_SFL.lignes.map((l) => (
                <div key={l.geste} className={cn("flex items-center justify-between gap-4 border-t py-3.5 min-[960px]:py-[18px]", FILET)}>
                  <dt className="text-titre leading-snug font-bold text-balance min-[960px]:text-titre-fort">{l.geste}</dt>
                  <dd className={cn(ETIQUETTE, "shrink-0 text-right text-encre-2")}>{l.stat}</dd>
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
            <ul className="grid grid-cols-2 gap-2 min-[960px]:grid-cols-4 min-[960px]:gap-3">
              {CLASSEMENT_SFL.bareme.map((t) => (
                <li key={t.cle} className={cn("rounded-champ border px-4 pt-3.5 pb-3", FILET)}>
                  <span className="block font-display text-titre-l leading-none tabular-nums">{pointsLisibles(t.points)}</span>
                  <span className="mt-2 block text-petit leading-tight font-semibold text-encre-2">{t.libelle}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-5 grid grid-cols-3 gap-2 min-[960px]:mt-6 min-[960px]:gap-3">
              {CLASSEMENT_SFL.divisions.map((d) => (
                <li key={d} className={cn("grid place-items-center rounded-champ border py-5 font-display text-affiche leading-none min-[960px]:py-7", FILET)}>
                  {d}
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
          <div ref={rangee} className="mt-9 flex justify-center gap-2.5 min-[960px]:mt-14 min-[960px]:gap-10">
            {TITRES_SFL.cartes.map((c) => (
              <div key={c.edition} className="flex flex-col items-center">
                <Carte lue={c.lue} edition={c.edition} taille={tailleTitre} className={OMBRE.petite} />
                {/* Sur ordinateur la carte est complète : son étiquette se lit dessus. */}
                <p aria-hidden className={cn(ETIQUETTE, "mt-4 text-encre-2 min-[960px]:hidden")}>
                  {c.nom}
                </p>
              </div>
            ))}
          </div>
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
      </main>

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
            <p className={cn(ETIQUETTE, "text-encre-4")}>{FIN_SFL.pied.droits}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
