"use client";

// Bola Studio dans la page Bola Plus (demande de Sabri, 14/11/2026,
// bola-app#22 : « Rends-moi visuellement l'artefact dans le module qui
// présente son abonnement »). Ce que le joueur en voit ; les templates, les
// prix, les ballons, les recharges et les vignettes sont dans
// lib/sfl/studio.ts, jamais ici.
// Depuis le carrousel en couleurs de Bola Plus (SFL#268, retours du 14/11) :
// le studio vit DANS le carrousel, dans la part Bola Plus (violet).
//
//   · ImageTemplate, Legende : la vignette d'un template (retour du 15/11 :
//     « les vraies vignettes des 12 modèles »). Son image, l'une des douze de
//     public/bola-plus/studio/, montrée telle quelle dans une boîte en 4:5
//     (.st-vignette) : jamais recadrée en carré, ni grossie, ni teinte (du
//     noir et blanc, par choix), ni animée. Sur son tiers bas, sombre dans
//     l'image, la légende : le nom du modèle (la police des titres de la
//     page) et son prix en ballons (Anton), sur un voile noir, pas une
//     teinte. L'image est décorative (alt vide) : le nom, ce que tu reçois,
//     la durée et le prix sont écrits. La boîte garde sa place avant le
//     chargement (aspect-ratio) ; l'image se charge quand elle approche : à
//     une largeur d'avance dans le rail ou le carrousel, à un écran d'avance
//     dans la page (useProche observe le conteneur qui défile vraiment ; hors
//     de portée, elle attend : loading="lazy"). Le navigateur prend la copie
//     légère dans le rail et l'éventail, l'original dans la fiche (srcset,
//     sizes). Une vidéo ne bouge pas : son triangle de lecture et sa durée le
//     disent, sous la vignette ;
//   · VisuelStudio : le visuel de la carte « Ton studio » du carrousel
//     (bola-plus.tsx, COMPOSANTS.studio) : trois vrais templates en éventail
//     (EVENTAIL_STUDIO), la carte en vrai au milieu, la seule entière, avec
//     sa légende ; et « Bola Studio » avec le nombre de templates. L'éventail
//     et le nombre sont décoratifs : le bouton se lit « Bola Studio ».
//     Le tout est un bouton : il ouvre le panneau.
//     MentionStudio : sous le titre « Ton studio », les ballons du mois
//     (« 300 ⚽ / mois », MENTION_STUDIO) ;
//   · PanneauStudio : une feuille du bas, aux couleurs de Bola Plus :
//     « Bola Studio » (la police des titres du carrousel), la phrase des
//     ballons du mois (« 300 ⚽ = un trash talk ou six images », calculée),
//     les douze templates en rail horizontal, au doigt, accroché carte par
//     carte (scroll-snap) : la vignette avec le nom et le prix, puis ce que
//     tu reçois et la durée. Toucher un template pousse sa fiche dans la même
//     feuille (le retour en haut à gauche, components/ui/sheet.tsx) : la même
//     vignette en grand, son nom en titre de la feuille. Aucun bouton
//     d'achat : rien ne s'achète encore. Le rail est dans une feuille, pas
//     dans la carte : un rail horizontal dans un carrousel horizontal se
//     disputerait le doigt et les flèches du clavier ;
//   · RechargesStudio : les trois recharges, au bas du panneau, marquées
//     « Bientôt », sans geste ni focus ; leurs chiffres en Anton prennent
//     l'espace insécable large (« 1 100 », pas « 1100 »).
//
// Le ballon ⚽ d'un prix en Anton (les vignettes, les recharges) est réduit à
// 0,7 em sur la ligne de base (Prix) : l'émoji ne domine pas le chiffre.
//
// Couleurs : celles de la part Bola Plus (VARIABLES_PLUS de
// lib/sfl/bola-plus.ts, la même table que la page), posées aussi sur le
// panneau, qui est porté hors de la page. La feuille de style n'écrit aucune
// teinte hors du noir, du blanc et des gris. Les vignettes sont
// des îlots sombres (classe dark) dans les deux modes. Pas de texte d'aide :
// des noms, des durées, des prix.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ChevronRight, Play } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VARIABLES_PLUS } from "@/lib/sfl/bola-plus";
import {
  ESPACE_LARGE,
  EVENTAIL_STUDIO,
  MENTION_STUDIO,
  PHRASE_INCLUS,
  RECHARGES_STUDIO,
  TEMPLATES,
  VIGNETTE,
  ballons,
  dureeDe,
  fichierVignette,
  prixDe,
  prixRecharge,
  sourcesVignette,
  template,
  type Template,
} from "@/lib/sfl/studio";
import "./studio-bola.css";

/* ------------------------------ Les vignettes ------------------------------ */

/**
 * Proche (une largeur de rail, ou un écran, d'avance) : une fois vu, le reste.
 * La marge ne vaut que pour le conteneur qui défile : le rail du panneau ou
 * le carrousel pour une vignette qui y glisse, #app-scroll pour la page ; la
 * fiche, hors de tout cela, est déjà à l'écran.
 */
function useProche(ref: RefObject<HTMLElement | null>) {
  const [proche, setProche] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || proche) return;
    const rail = el.closest<HTMLElement>(".st-rail, .bp-rail");
    const page = document.getElementById("app-scroll");
    const root = rail ?? (page?.contains(el) ? page : null);
    const o = new IntersectionObserver(([e]) => e.isIntersecting && setProche(true), { root, rootMargin: rail ? "0px 100%" : "100% 0px" });
    o.observe(el);
    return () => o.disconnect();
  }, [ref, proche]);
  return proche;
}

/** La largeur d'une vignette à l'écran : dans le rail (ou l'éventail, à peine plus étroit), ou à la largeur de la page (la fiche). */
type Cadre = "rail" | "page";
const LARGEUR_CADRE: Record<Cadre, string> = { rail: "min(216px, 58vw)", page: "min(406px, calc(100vw - 24px))" };

/**
 * L'image d'un template, qui remplit sa vignette (.st-vignette, en 4:5) :
 * telle quelle, ni teinte ni grossie. Décorative (alt vide) : ce qu'elle
 * montre est écrit à côté. Elle attend d'être proche pour se charger.
 */
function ImageTemplate({ t, cadre }: { t: Template; cadre: Cadre }) {
  const ref = useRef<HTMLImageElement>(null);
  const proche = useProche(ref);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- déjà à ses deux largeurs (public/bola-plus/studio)
    <img
      ref={ref}
      className="st-vignette__image"
      src={fichierVignette(t, VIGNETTE.legere)}
      srcSet={sourcesVignette(t)}
      sizes={LARGEUR_CADRE[cadre]}
      width={VIGNETTE.legere}
      height={VIGNETTE.legere * VIGNETTE.rapport}
      alt=""
      loading={proche ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  );
}

/** Un prix en Anton : le chiffre, et le ballon ⚽ réduit sur la ligne de base. */
function Prix({ texte, className }: { texte: string; className?: string }): ReactNode {
  const [chiffre, ...reste] = texte.split(/[\u00a0 ](?=⚽)/);
  return (
    <span className={className} style={{ fontFamily: ANTON }}>
      {chiffre}
      {reste.length > 0 && <span className="st-prix__ballon">&nbsp;⚽</span>}
    </span>
  );
}

/**
 * La légende d'une vignette, sur son tiers bas : le nom du modèle et son prix
 * en ballons. Dans la fiche, le nom est le titre de la feuille.
 */
function Legende({ t, titre }: { t: Template; titre?: boolean }) {
  const Boite = titre ? "div" : "span";
  const Nom = titre ? SheetTitle : "span";
  return (
    <Boite className="st-vignette__bas">
      <Nom className="bp-titre st-vignette__nom">{t.nom}</Nom>
      <Prix texte={prixDe(t)} className="st-vignette__prix tabular-nums" />
    </Boite>
  );
}

/* -------------------------------- Le rail -------------------------------- */

/**
 * Les couleurs de Bola Plus (VARIABLES_PLUS, la table que pose aussi la page), sur le panneau et la fiche :
 * portés hors de la page, ils ne reçoivent pas ses variables.
 */
const COULEURS_STUDIO = VARIABLES_PLUS as CSSProperties;

/** Le panneau et la fiche : une feuille du bas qui défile si l'écran est court. */
const FEUILLE_STUDIO = "st-feuille max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]";

/** Sous la vignette : la durée d'une vidéo, avec son triangle de lecture, ou « Image ». */
function Duree({ t, grand }: { t: Template; grand?: boolean }) {
  return (
    <span className={`flex items-center leading-none font-semibold text-encre-2 tabular-nums ${grand ? "gap-1.5 text-corps" : "gap-1 text-[13px]"}`}>
      {t.rendu.genre === "video" && <Play className={`fill-current ${grand ? "size-3.5" : "size-3"}`} aria-hidden />}
      {dureeDe(t)}
    </span>
  );
}

/** Un template dans le rail : sa vignette, avec son nom et son prix ; dessous, ce que tu reçois et sa durée. */
function CarteTemplate({ t, onOuvrir }: { t: Template; onOuvrir: () => void }) {
  return (
    <li className="st-item">
      <button type="button" onClick={onOuvrir} className="st-item__bouton">
        <span className="st-vignette dark">
          <ImageTemplate t={t} cadre="rail" />
          <Legende t={t} />
        </span>
        <span className="flex flex-col gap-1.5 px-1 pt-2.5">
          <span className="line-clamp-2 min-h-[2.5em] text-[13px] leading-[1.25] text-encre-2">{t.recoit}</span>
          <Duree t={t} />
        </span>
      </button>
    </li>
  );
}

/** Un template en grand, dans une feuille : la même vignette, son nom en titre. */
function FicheTemplate({ t, onFermer }: { t: Template | null; onFermer: () => void }) {
  return (
    <Sheet open={!!t} onOpenChange={(o) => !o && onFermer()}>
      <SheetContent side="bottom" className={FEUILLE_STUDIO} style={COULEURS_STUDIO}>
        {t && (
          <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-3 pt-3 pb-8">
            <div className="st-vignette st-vignette--grand dark">
              <ImageTemplate t={t} cadre="page" />
              <Legende t={t} titre />
            </div>
            <div className="flex flex-col gap-3 px-1">
              <p className="text-corps leading-snug text-encre-2">{t.recoit}</p>
              <Duree t={t} grand />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Le panneau « Bola Studio » : la phrase des ballons du mois, les douze
 * templates en rail, puis les recharges. Une feuille du bas ; la fiche d'un
 * template y est poussée (components/ui/sheet.tsx).
 */
function PanneauStudio({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  const [fiche, setFiche] = useState<Template | null>(null);
  return (
    <Sheet open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <SheetContent side="bottom" className={FEUILLE_STUDIO} style={COULEURS_STUDIO}>
        <div className="st-panneau mx-auto w-full max-w-[430px]">
          <div className="flex flex-col gap-2 px-5">
            <SheetTitle className="bp-titre st-panneau__titre">Bola Studio</SheetTitle>
            <p className="st-panneau__phrase tabular-nums">{PHRASE_INCLUS}</p>
          </div>
          <ul className="st-rail">
            {TEMPLATES.map((t) => (
              <CarteTemplate key={t.id} t={t} onOuvrir={() => setFiche(t)} />
            ))}
          </ul>
          <div className="px-5">
            <RechargesStudio />
          </div>
        </div>
        <FicheTemplate t={fiche} onFermer={() => setFiche(null)} />
      </SheetContent>
    </Sheet>
  );
}

/** Les trois templates de l'éventail, dans l'ordre : à gauche, au milieu, à droite. */
const EVENTAIL = EVENTAIL_STUDIO.map(template);
/** Celui du milieu : la seule vignette entière, la seule à porter sa légende. */
const MILIEU = 1;

/**
 * « Ton studio », la carte du carrousel : trois vrais templates en éventail et
 * « Bola Studio » avec le nombre de templates. Un seul bouton : il ouvre le
 * panneau. Il se lit « Bola Studio » (pas d'aria-label) : l'éventail, comme
 * le nombre, est décoratif ; chaque template se lit en entier dans le panneau.
 */
export function VisuelStudio() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" className="st-eventail" onClick={() => setOuvert(true)}>
        <span className="st-eventail__cartes" aria-hidden>
          {EVENTAIL.map((t, i) => (
            <span key={t.id} className="st-eventail__place" data-place={i}>
              <span className="st-vignette dark">
                <ImageTemplate t={t} cadre="rail" />
                {i === MILIEU && <Legende t={t} />}
              </span>
            </span>
          ))}
        </span>
        <span className="st-eventail__nom">
          Bola Studio
          <span className="st-eventail__nombre tabular-nums" aria-hidden>
            {TEMPLATES.length}
          </span>
          <ChevronRight className="size-4" strokeWidth={2.6} aria-hidden />
        </span>
      </button>
      <PanneauStudio ouvert={ouvert} onFermer={() => setOuvert(false)} />
    </>
  );
}

/** Sous le titre « Ton studio » : les ballons du mois. */
export function MentionStudio() {
  return <p className="bp-texte__sous st-mention tabular-nums">{MENTION_STUDIO}</p>;
}

/* ------------------------------ Les recharges ------------------------------ */

/** Les recharges de ballons, « Bientôt » : montrées, pas encore en vente. */
export function RechargesStudio() {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="st-recharges">
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 id="st-recharges" className="mono-label text-encre-3">
          Recharges
        </h3>
        <span className="rounded-full px-2.5 py-[5px] text-[12px] leading-none font-bold text-encre-2 ring-1 ring-foreground/25">Bientôt</span>
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {RECHARGES_STUDIO.map((r) => (
          <li key={r.centimes} className="st-recharge glass flex flex-col items-center gap-2 rounded-[20px] px-2 py-4 text-center">
            <Prix texte={`${ballons(r.ballons, ESPACE_LARGE)} ⚽`} className="text-[22px] leading-none tabular-nums" />
            <span className="text-[13px] leading-none font-semibold text-foreground tabular-nums">{prixRecharge(r)}&nbsp;€</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
