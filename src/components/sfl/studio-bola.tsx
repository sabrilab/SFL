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
//     « les vraies vignettes des 12 modèles » ; depuis le 16/11, en couleur,
//     avec l'avatar d'un joueur, en Seedream 5.0 Pro depuis le soir). Son
//     image, l'une des douze de public/bola-plus/studio/ (en 3:4), montrée
//     dans une boîte en 4:5 (.st-vignette) qui la recadre en haut (la feuille
//     de style : cover, 50 % 30 %) : jamais en carré, ni grossie, ni teinte,
//     ni animée. Sur son tiers bas, sombre dans
//     l'image, la légende : le nom du modèle (la police des titres de la
//     page) et son prix en ballons (Anton), sur un voile noir, pas une
//     teinte. L'image est décorative (alt vide) : le nom, ce que tu reçois,
//     la durée et le prix sont écrits. La boîte garde sa place avant le
//     chargement (aspect-ratio) ; l'image se charge quand elle approche : à
//     une largeur d'avance dans le rail ou le carrousel, à un écran d'avance
//     dans la page (useProche observe le conteneur qui défile vraiment ; hors
//     de portée, elle attend : loading="lazy"). Le navigateur prend la copie
//     légère dans le rail et l'éventail, l'original dans la fiche (srcset,
//     sizes) ; la fiche pose en plus la copie légère sous l'original
//     (ImageLegere) : elle ne s'ouvre pas sur un cadre noir le temps qu'il
//     arrive. Une vidéo ne bouge pas : son triangle de lecture et sa durée
//     le disent, sous la vignette ;
//   · VisuelStudio : le visuel de la carte « Ton studio » du carrousel
//     (bola-plus.tsx, COMPOSANTS.studio) : trois vrais templates en éventail
//     (EVENTAIL_STUDIO), la carte en vrai au milieu, la seule entière, avec
//     sa légende ; et « Bola Studio » avec le nombre de templates. L'éventail
//     et le nombre sont décoratifs : le bouton se lit « Bola Studio ».
//     Le tout est un bouton : il ouvre le panneau.
//     MentionStudio : sous le titre « Ton studio », les ballons du mois
//     (« 300 ⚽ / mois », MENTION_STUDIO) ;
//   · PanneauStudio : une feuille du bas, aux couleurs de Bola Plus :
//     « Bola Studio » (la police des titres du carrousel), « Avec ta photo. »
//     et la phrase des ballons du mois (« 300 ⚽ = un trash talk ou six
//     images », calculée),
//     les douze templates en rail horizontal, au doigt, accroché carte par
//     carte (scroll-snap) : la vignette avec le nom et le prix, puis ce que
//     tu reçois et la durée. Toucher un template pousse sa fiche dans la même
//     feuille (le retour en haut à gauche, components/ui/sheet.tsx) : la même
//     vignette en grand, son nom en titre de la feuille, et dessous, dans la
//     même colonne (.st-fiche, qui se borne à ce qui tient dans la feuille),
//     ce que tu reçois et sa durée, puis ta photo → ton image (LigneToi).
//     Aucun bouton d'achat : rien ne s'achète encore. Le rail est dans une feuille, pas dans la carte : un rail
//     horizontal dans un carrousel horizontal se disputerait le doigt et les
//     flèches du clavier ;
//   · RechargesStudio : les trois recharges, au bas du panneau, marquées
//     « Bientôt », sans geste ni focus ; leurs chiffres en Anton prennent
//     l'espace insécable large (« 1 100 », pas « 1100 ») ;
//   · Toi, dedans (Sabri, 16/11, bola-app#22 : « il faut bien faire
//     comprendre que l'user pourra générer ces templates avec sa propre
//     personne ») : le sous-titre du panneau devient « Avec ta photo. 300 ⚽
//     = un trash talk ou six images » (AVEC_TA_PHOTO, puis PHRASE_INCLUS),
//     ses deux phrases sur deux lignes (« images » ne reste pas seul) ; PastilleToi, la
//     photo de ta carte en pastille ronde, en haut à gauche de chaque
//     vignette du rail : c'est toi qui seras dedans ; LigneToi, au bas de la
//     fiche d'un modèle : ta photo → ton image (la photo de ta carte, une
//     flèche, la vignette en petit), sans un mot. La photo est celle que
//     BolaCard montre sur ta carte, par le même chemin (useToi : le joueur
//     de Ma carte, puis usePhotoPerso, comme PlayerCard) : la même adresse,
//     aucune requête de plus. Sans photo, ou si elle ne se charge pas,
//     l'initiale en Anton, le repli du portrait de la carte : jamais une
//     pastille vide. La pastille est posée sur l'image, sans la teinter ni
//     la recadrer ; elle est décorative (le sous-titre dit ce qu'elle dit).
//     L'éventail de « Ton studio » n'en porte pas.
//
// Le ballon ⚽ d'un prix en Anton (les vignettes, les recharges) est réduit à
// 0,7 em sur la ligne de base (Prix) : l'émoji ne domine pas le chiffre.
//
// Couleurs : celles de la part Bola Plus (VARIABLES_PLUS de
// lib/sfl/bola-plus.ts, la même table que la page), posées aussi sur le
// panneau, qui est porté hors de la page. La feuille de style n'écrit aucune
// teinte hors du noir, du blanc et des gris (ni or, ni bleu, ni rouge :
// ces teintes sont celles des cartes MVP, Défensive et Impact). Les
// vignettes sont sombres dans les deux modes : leur image, et dessus du
// blanc écrit dans la feuille (aucune classe de thème) ; la pastille de ta
// photo, cerclée de blanc, aussi. Pas de texte d'aide : des noms, des
// durées, des prix, et « Avec ta photo. ».

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ArrowRight, ChevronRight, Play } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { VARIABLES_PLUS } from "@/lib/sfl/bola-plus";
import {
  ESPACE_LARGE,
  EVENTAIL_STUDIO,
  AVEC_TA_PHOTO,
  MENTION_STUDIO,
  PHRASE_INCLUS,
  RECHARGES_STUDIO,
  TEMPLATES,
  VIGNETTE,
  ballons,
  dureeDe,
  fichierVignette,
  hauteurVignette,
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
 * L'image d'un template (en 3:4), qui remplit sa vignette (.st-vignette, en
 * 4:5) recadrée en haut, ni teinte ni grossie ; elle dit les dimensions de son
 * fichier. Décorative (alt vide) : ce qu'elle montre est écrit à côté. Elle
 * attend d'être proche pour se charger.
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
      height={hauteurVignette(VIGNETTE.legere)}
      alt=""
      loading={proche ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
    />
  );
}

/**
 * Dans la fiche, sous l'original : la copie légère du même template, que le rail vient de montrer (elle est déjà
 * chargée). La fiche ne s'ouvre pas sur un cadre noir le temps que l'original arrive ; même image, mêmes
 * proportions, même règle de style : rien ne bouge quand il la recouvre. Décorative.
 */
function ImageLegere({ t }: { t: Template }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- la copie légère (public/bola-plus/studio), déjà chargée par le rail
    <img className="st-vignette__image" src={fichierVignette(t, VIGNETTE.legere)} width={VIGNETTE.legere} height={hauteurVignette(VIGNETTE.legere)} alt="" draggable={false} />
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

/* ------------------------------ Toi, dedans ------------------------------ */

/** Le joueur connecté : son nom, et la photo de sa carte (null s'il n'en a pas posé). */
type Toi = { nom: string; photo: string | null };

/**
 * La photo de ta carte, par le chemin de ta carte : le joueur de Ma carte (useMyPlayer), et la photo que
 * PlayerCard donne à BolaCard (usePhotoPerso, lib/sfl/photos : posée sur cet appareil, sinon celle de la
 * ligue, déjà en cache). La même adresse que le portrait de la carte : aucune requête de plus.
 */
function useToi(): Toi {
  const { me, player } = useMyPlayer();
  const nom = player?.name ?? me;
  return { nom, photo: usePhotoPerso(nom) };
}

/**
 * La pastille « c'est toi qui seras dedans » : la photo de ta carte, en rond, cerclée de blanc. Sans photo,
 * ou si elle ne se charge pas, l'initiale du nom en Anton, le repli du portrait de la carte (BolaCard) :
 * jamais une pastille vide ni une image cassée. Décorative : le sous-titre du panneau dit ce qu'elle dit.
 */
function PastilleToi({ toi }: { toi: Toi }) {
  // La photo qui n'a pas pu se charger : on n'y revient pas (une autre photo, elle, se tente).
  const [cassee, setCassee] = useState<string | null>(null);
  const photo = toi.photo && toi.photo !== cassee ? toi.photo : null;
  return (
    <span className="st-toi" aria-hidden>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- la photo de ta carte, à l'adresse de son portrait (BolaCard)
        <img
          className="st-toi__image"
          src={photo}
          crossOrigin={photo.startsWith("data:") ? undefined : "anonymous"}
          alt=""
          draggable={false}
          onError={() => setCassee(photo)}
        />
      ) : (
        <span className="st-toi__initiale" style={{ fontFamily: ANTON }}>
          {toi.nom.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/**
 * Au bas de la fiche d'un modèle : ta photo → ton image. La photo de ta carte, une flèche, et la vignette du
 * modèle en petit (sa copie légère, que le rail vient de montrer). Aucun mot.
 */
function LigneToi({ t, toi }: { t: Template; toi: Toi }) {
  return (
    <div className="st-ligne">
      <PastilleToi toi={toi} />
      <ArrowRight className="size-5 shrink-0 text-encre-3" strokeWidth={2.4} aria-hidden />
      <span className="st-ligne__image">
        <span className="st-vignette st-vignette--mini">
          <ImageLegere t={t} />
        </span>
      </span>
    </div>
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

/**
 * Un template dans le rail : sa vignette, avec son nom et son prix, et la photo de ta carte en haut à gauche ;
 * dessous, ce que tu reçois et sa durée.
 */
function CarteTemplate({ t, toi, onOuvrir }: { t: Template; toi: Toi; onOuvrir: () => void }) {
  return (
    <li className="st-item">
      <button type="button" onClick={onOuvrir} className="st-item__bouton">
        <span className="st-vignette">
          <ImageTemplate t={t} cadre="rail" />
          <Legende t={t} />
          <PastilleToi toi={toi} />
        </span>
        <span className="flex flex-col gap-1.5 px-1 pt-2.5">
          <span className="line-clamp-2 min-h-[2.5em] text-[13px] leading-[1.25] text-encre-2">{t.recoit}</span>
          <Duree t={t} />
        </span>
      </button>
    </li>
  );
}

/**
 * Un template en grand, dans une feuille : la même vignette, son nom en titre ; dessous, dans la même colonne,
 * ce que tu reçois et sa durée, puis ta photo → ton image (LigneToi), là où viendra le bouton. Sous l'original,
 * la copie légère que le rail vient de montrer : la fiche ne s'ouvre pas sur un cadre noir.
 */
function FicheTemplate({ t, toi, onFermer }: { t: Template | null; toi: Toi; onFermer: () => void }) {
  return (
    <Sheet open={!!t} onOpenChange={(o) => !o && onFermer()}>
      <SheetContent side="bottom" className={FEUILLE_STUDIO} style={COULEURS_STUDIO}>
        {t && (
          <div className="mx-auto w-full max-w-[430px] px-3 pt-3 pb-4">
            <div className="st-fiche">
              <div className="st-vignette st-vignette--grand">
                <ImageLegere t={t} />
                <ImageTemplate t={t} cadre="page" />
                <Legende t={t} titre />
              </div>
              <div className="flex flex-col gap-3 px-1">
                <p className="text-corps leading-snug text-encre-2">{t.recoit}</p>
                <Duree t={t} grand />
              </div>
              <LigneToi t={t} toi={toi} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Le panneau « Bola Studio » : « Avec ta photo. » et la phrase des ballons du
 * mois, les douze templates en rail (la photo de ta carte sur chacun), puis
 * les recharges. Une feuille du bas ; la fiche d'un
 * template y est poussée (components/ui/sheet.tsx).
 */
function PanneauStudio({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  const [fiche, setFiche] = useState<Template | null>(null);
  const toi = useToi();
  return (
    <Sheet open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <SheetContent side="bottom" className={FEUILLE_STUDIO} style={COULEURS_STUDIO}>
        <div className="st-panneau mx-auto w-full max-w-[430px]">
          <div className="flex flex-col gap-2 px-5">
            <SheetTitle className="bp-titre st-panneau__titre">Bola Studio</SheetTitle>
            <p className="st-panneau__phrase tabular-nums">
              <span className="st-panneau__avec">{AVEC_TA_PHOTO}</span> {PHRASE_INCLUS}
            </p>
          </div>
          <ul className="st-rail">
            {TEMPLATES.map((t) => (
              <CarteTemplate key={t.id} t={t} toi={toi} onOuvrir={() => setFiche(t)} />
            ))}
          </ul>
          <div className="px-5">
            <RechargesStudio />
          </div>
        </div>
        <FicheTemplate t={fiche} toi={toi} onFermer={() => setFiche(null)} />
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
              <span className="st-vignette">
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
