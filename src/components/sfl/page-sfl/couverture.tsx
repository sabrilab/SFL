"use client";

// La couverture du haut de getbola.app/sfl (14/11/2026, retour sur
// bola-app#6 : « rends l’accueil plus visuel avec une belle photo de
// couverture. Enfin, le header »). Une grande image derrière le sigle,
// « Lille. Chaque dimanche. » et les boutons ; le reste de la page ne change
// pas.
//
// Les images sont celles de lib/sfl/page-sfl-couverture.ts (généré par
// tools/page-sfl-couverture.ts), rien d'autre : a « La cage » (le five de
// nuit au pied des immeubles) et c « Les ombres » (cinq ombres sur le
// terrain), deux photos du moodboard des Actus, en production depuis le
// 24/10 ; b « Les cartes », le mur des vraies cartes de l'instantané (les
// joueurs qui ont dit oui à leur carte hors de l'app). Aucun visage dans les
// photos ; aucun joueur sans accord sur le mur. À comparer aussi (14/11) :
// d « L'équipe » (cinq Noirs face à cinq Blancs, la recommandée des trois),
// d2 « Le face-à-face », d3 « Le pied sur le ballon » : des FIGURANTS
// GÉNÉRÉS (Higgsfield, fournis par le projet Bola), aucun joueur de la SFL,
// aucun visage réel. Leur portrait garde toute la largeur de la photo ; sur
// ordinateur, d2 et d3 sont recomposés, les joueurs sur les côtés ; d garde
// ses dix joueurs, sous un voile plein derrière le contenu (VOILE_EQUIPE).
//
// La variante de la page est COUVERTURE_SFL (d, choisie le 15/11). En dev et sur
// un aperçu Vercel seulement (ESSAI), ?couverture=a|b|c|d|d2|d3 en choisit une autre,
// pour la comparer (lue après l'hydratation : le HTML servi porte toujours
// COUVERTURE_SFL, l'autre image vient juste après ; la production ne lit
// jamais l'adresse, et lireAdresse est le seul endroit qui la lit).
//
// Le dessin : l'image remplit le premier écran, jusque sous la zone sûre du
// haut ; un voile de la couleur de la page la fond vers le bas, où se posent
// le sigle, le titre et les boutons. En clair, la photo reste nette en haut
// (aucun voile au-dessus du contenu, contrôle du 14/11 : sinon la nuit
// devenait un brouillard gris), puis le papier la recouvre vite juste avant
// l'étiquette (le sigle noir sur une photo de nuit ne se lirait pas). Le mur
// des cartes (b) a un voile de plus, fort derrière le contenu : aucun visage
// sous le texte. Rien ne bouge, rien ne suit le défilement.
//
// Le poids : une seule image se charge, choisie par le navigateur (<picture> :
// la bande 16:9 dès 960 px, sinon le portrait 9:14 en 720 ou 1029 px de
// large, 250 ko au plus). Elle est décorative (alt vide, aria-hidden) ; elle
// se charge tout de suite, en priorité (c'est le haut de la page). Sa boîte
// est celle du bloc du haut, dont la hauteur ne dépend que de la fenêtre :
// rien ne saute quand elle arrive ; le fond de la page est sous elle en
// attendant, sans flash.

import { useSyncExternalStore } from "react";
import { VARIANTES_COUVERTURE, type CleCouverture } from "@/lib/sfl/page-sfl-couverture";

/** La variante de la page : d « L'équipe », choisie le 15/11 (figurants générés, aucun joueur de la SFL). */
export const COUVERTURE_SFL: CleCouverture = "d";
/** L'adresse choisit la variante : en dev et sur un aperçu Vercel, jamais en production. */
const ESSAI = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_BOLA_ENV === "preview";

const rien = () => () => {};
/** En dev et sur un aperçu : la variante demandée par l'adresse, sinon celle de la page. */
function lireAdresse(): CleCouverture {
  if (!ESSAI) return COUVERTURE_SFL;
  const v = new URLSearchParams(window.location.search).get("couverture");
  return v && Object.hasOwn(VARIANTES_COUVERTURE, v) ? (v as CleCouverture) : COUVERTURE_SFL;
}

/**
 * Le voile, de la couleur de la page : léger en haut (la photo se voit), plein
 * en bas (le bloc se fond dans la page). Ses paliers sont comptés depuis le
 * bas, là où se pose le contenu (environ 460 px de haut sur téléphone, de
 * l'étiquette à « Se connecter ») : le sigle tombe sur le même voile d'un
 * téléphone haut à un téléphone bas. En sombre, sur un téléphone bas, des
 * paliers en proportion gardent un fondu sans marche ; en clair, rien sur la
 * photo, puis le papier, plein dès l'étiquette.
 */
const fond = (pourcent: number) => `color-mix(in oklab, var(--background) ${pourcent}%, transparent)`;
const VOILE = {
  sombre: `linear-gradient(to bottom, ${fond(30)} 0%, ${fond(0)} 14%, ${fond(15)} max(20%, calc(100% - 610px)), ${fond(72)} max(40%, calc(100% - 480px)), ${fond(92)} max(54%, calc(100% - 330px)), var(--background) max(80%, calc(100% - 120px)))`,
  clair: `linear-gradient(to bottom, ${fond(0)} 0%, ${fond(0)} calc(100% - 660px), ${fond(60)} calc(100% - 540px), ${fond(92)} calc(100% - 480px), var(--background) calc(100% - 440px))`,
};
/** Sur ordinateur, le contenu est au centre : le voile s'ouvre aussi sur les côtés. */
const VOILE_ORDINATEUR = {
  sombre: `radial-gradient(ellipse 46% 62% at 50% 62%, ${fond(80)} 0%, ${fond(55)} 55%, ${fond(0)} 100%), linear-gradient(to bottom, ${fond(20)} 0%, ${fond(10)} 30%, ${fond(55)} 70%, var(--background) 100%)`,
  clair: `radial-gradient(ellipse 46% 62% at 50% 62%, ${fond(94)} 0%, ${fond(80)} 55%, ${fond(0)} 100%), linear-gradient(to bottom, ${fond(0)} 0%, ${fond(0)} 40%, ${fond(55)} 75%, var(--background) 100%)`,
};
/** Le mur des cartes (b) : un voile de plus, fort derrière le contenu (aucun visage sous le texte). */
const VOILE_MUR = {
  telephone: `linear-gradient(to bottom, ${fond(30)} 0%, ${fond(30)} calc(100% - 660px), ${fond(88)} calc(100% - 500px))`,
  ordinateur: `radial-gradient(ellipse 54% 74% at 50% 64%, ${fond(94)} 0%, ${fond(88)} 55%, ${fond(35)} 100%)`,
};
/** L'équipe (d) sur ordinateur : dix joueurs au centre, un voile plein derrière le contenu (aucun visage sous le texte) ; depuis que la bande garde leurs têtes (15/11), il monte jusqu'à l'étiquette. */
const VOILE_EQUIPE = `radial-gradient(ellipse 50% 78% at 50% 52%, ${fond(92)} 0%, ${fond(84)} 55%, ${fond(0)} 100%)`;
/**
 * Les figurants (d, d2, d3) en sombre, sur téléphone : des visages et un ballon juste au-dessus du contenu.
 * Contrôle visuel du 15/11 : en 375 × 667, le sigle et « Lille. » passaient sur les genoux et les visages du
 * second rang, et le panneau « BOLA SFL » de d3 se lisait à côté de « SUNDAY FIVE LEAGUE ». Compté depuis le
 * bas comme le voile (l'étiquette est à ~460 px du bas) : rien au-dessus, presque plein dès l'étiquette.
 */
const VOILE_FIGURANTS_SOMBRE = `linear-gradient(to bottom, ${fond(0)} 0%, ${fond(0)} calc(100% - 600px), ${fond(92)} calc(100% - 480px))`;

export function Couverture() {
  const cle = useSyncExternalStore(rien, lireAdresse, () => COUVERTURE_SFL);
  const v = VARIANTES_COUVERTURE[cle];
  const [petite, grande] = v.telephone;
  return (
    <div
      aria-hidden
      data-couverture={cle}
      className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 overflow-hidden"
      style={{ top: "calc(-1 * env(safe-area-inset-top))" }}
    >
      <picture>
        <source media="(min-width: 960px)" srcSet={v.ordinateur.src} width={v.ordinateur.largeur} height={v.ordinateur.hauteur} />
        {/* Une image décorative déjà à ses tailles (WebP) : l'optimiseur de Next n'y ajouterait rien. */}
        <img
          src={petite.src}
          srcSet={`${petite.src} ${petite.largeur}w, ${grande.src} ${grande.largeur}w`}
          sizes="100vw"
          alt=""
          width={petite.largeur}
          height={petite.hauteur}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          draggable={false}
          className="absolute inset-0 size-full object-cover object-top select-none"
        />
      </picture>
      {/* Le mur des cartes est plus chargé qu'une photo : un voile de plus, plein derrière le contenu. */}
      {cle === "b" && <div className="absolute inset-0 min-[960px]:hidden" style={{ background: VOILE_MUR.telephone }} />}
      {cle === "b" && <div className="absolute inset-0 hidden min-[960px]:block" style={{ background: VOILE_MUR.ordinateur }} />}
      {cle === "d" && <div className="absolute inset-0 hidden min-[960px]:block" style={{ background: VOILE_EQUIPE }} />}
      {v.figurants && <div className="absolute inset-0 hidden dark:block min-[960px]:dark:hidden" style={{ background: VOILE_FIGURANTS_SOMBRE }} />}
      {/* Le voile : téléphone et tablette, puis ordinateur ; clair, puis sombre. */}
      <div className="absolute inset-0 min-[960px]:hidden dark:hidden" style={{ background: VOILE.clair }} />
      <div className="absolute inset-0 hidden dark:block min-[960px]:dark:hidden" style={{ background: VOILE.sombre }} />
      <div className="absolute inset-0 hidden min-[960px]:block dark:min-[960px]:hidden" style={{ background: VOILE_ORDINATEUR.clair }} />
      <div className="absolute inset-0 hidden dark:min-[960px]:block" style={{ background: VOILE_ORDINATEUR.sombre }} />
    </div>
  );
}
