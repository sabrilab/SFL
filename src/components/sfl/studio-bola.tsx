"use client";

// Bola Studio dans la page Bola Plus (demande de Sabri, 14/11/2026,
// bola-app#22 : « Rends-moi visuellement l'artefact dans le module qui
// présente son abonnement »). Ce que le joueur en voit ; les templates, les
// prix, les ballons et les recharges sont dans lib/sfl/studio.ts, jamais ici.
// Depuis le carrousel en couleurs de Bola Plus (SFL#268, retours du 14/11) :
// le studio vit DANS le carrousel, dans la part Bola Plus (violet).
//
//   · SceneStudio : la vignette d'un template, composée avec ce qui existe
//     (aucune image générée pour le studio) : un visuel de public/bola-plus/
//     recadré, la vraie carte anonyme « Toi » (BolaCard, ou son dos,
//     DosCarte) posée selon la scène, le logo ou le symbole Bola. Le fond est
//     teint dans le violet de Bola Plus (fusion « color », comme le stade de
//     l'ouverture) ; la carte « Toi » garde ses vraies couleurs, par-dessus.
//     Une vidéo : le cadrage avance lentement (studio-bola.css), arrêté avec
//     « Réduire les animations ». Les cartes ne se montent qu'une fois la
//     vignette mesurée et proche : à une largeur d'avance dans le rail ou le
//     carrousel, à un écran d'avance dans la page (useProche observe le
//     conteneur qui défile vraiment). Chaque visuel dit au navigateur sa
//     taille réelle, grossissement compris (sizes). La scène est décorative
//     (aria-hidden) : un lecteur d'écran lit le nom, ce que tu reçois, la
//     durée et le prix, jamais le micro-texte de la carte ;
//   · VisuelStudio : le visuel de la carte « Ton studio » du carrousel
//     (bola-plus.tsx, COMPOSANTS.studio) : trois vrais templates en éventail
//     (EVENTAIL_STUDIO), la carte en vrai au milieu, et « Bola Studio » avec le
//     nombre de templates (décoratif : le bouton se lit « Bola Studio »).
//     Le tout est un bouton : il ouvre le panneau.
//     MentionStudio : sous le titre « Ton studio », les ballons du mois
//     (« 300 ⚽ / mois », MENTION_STUDIO) ;
//   · PanneauStudio : une feuille du bas, aux couleurs de Bola Plus :
//     « Bola Studio » (la police des titres du carrousel), la phrase des
//     ballons du mois (« 300 ⚽ = un trash talk ou six images », calculée),
//     les douze templates en rail horizontal, au doigt, accroché carte par
//     carte (scroll-snap) : la vignette, le nom, ce que tu reçois, la durée,
//     le prix. Toucher un template pousse sa fiche dans la même feuille (le
//     retour en haut à gauche, components/ui/sheet.tsx). Aucun bouton
//     d'achat : rien ne s'achète encore. Le rail est dans une feuille, pas
//     dans la carte : un rail horizontal dans un carrousel horizontal se
//     disputerait le doigt et les flèches du clavier ;
//   · RechargesStudio : les trois recharges, au bas du panneau, marquées
//     « Bientôt », sans geste ni focus ; leurs chiffres en Anton prennent
//     l'espace insécable large (« 1 100 », pas « 1100 »).
//
// Le ballon ⚽ d'un prix en Anton (la fiche, les recharges) est réduit à
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
import { BolaCard } from "@/components/sfl/bola-card";
import { DosCarte } from "@/components/sfl/dos-carte";
import { matiereDe } from "@/components/sfl/finitions-carte";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CARTE_TOI, VARIABLES_PLUS, fichierVisuel, sourcesVisuel } from "@/lib/sfl/bola-plus";
import {
  ESPACE_LARGE,
  EVENTAIL_STUDIO,
  MENTION_STUDIO,
  PHRASE_INCLUS,
  RECHARGES_STUDIO,
  TEMPLATES,
  ballons,
  dureeDe,
  prixDe,
  prixRecharge,
  template,
  type Fond,
  type Scene,
  type Template,
} from "@/lib/sfl/studio";
import { ovr } from "@/lib/sfl/engine";
import "./studio-bola.css";

/* ---------------------------- La carte « Toi » ---------------------------- */

// La carte anonyme : « Toi », sans photo, sans pseudo : la même que « Ta
// carte continue. » dans le carrousel (CARTE_TOI, lib/sfl/bola-plus.ts), la
// note calculée par ovr.
const TOI = { name: CARTE_TOI.name, position: CARTE_TOI.position, overall: ovr(CARTE_TOI.stats) };
// Dessinée à 0,7 (178 px, le palier « complète » : papier, cadre, chiffres),
// puis mise à l'échelle de la scène.
const TAILLE = 0.7;
const L_CARTE = 254 * TAILLE;
const H_CARTE = L_CARTE * (1656 / 1024);

/** La carte « Toi » (face ou dos) à `largeur` px. */
function CarteToi({ largeur, dos = false, style }: { largeur: number; dos?: boolean; style?: CSSProperties }) {
  const k = largeur / L_CARTE;
  return (
    <span className="st-carte" style={{ width: largeur, height: H_CARTE * k, ...style }}>
      <span className="st-carte__dessin" style={{ width: L_CARTE, height: H_CARTE, transform: `scale(${k})` }}>
        {dos ? <DosCarte matiere={matiereDe("base")} nom={TOI.name} size={TAILLE} /> : <BolaCard {...TOI} stats={CARTE_TOI.stats} size={TAILLE} />}
      </span>
    </span>
  );
}

/* ------------------------------- Les scènes ------------------------------- */

/** La largeur d'un élément, suivie (null tant qu'elle n'est pas mesurée). */
function useLargeur(ref: RefObject<HTMLElement | null>) {
  const [l, setL] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new ResizeObserver(([e]) => setL(Math.round(e.contentRect.width)));
    o.observe(el);
    return () => o.disconnect();
  }, [ref]);
  return l;
}

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
export type Cadre = "rail" | "page";
const LARGEUR_CADRE: Record<Cadre, string> = { rail: "min(216px, 58vw)", page: "min(430px, 100vw)" };

/**
 * La taille du visuel pour le navigateur : la largeur de la vignette, par la
 * part qu'il en occupe, par son grossissement (et les 12 % du cadrage d'une
 * vidéo) : une vignette très grossie charge la grande image.
 */
const taillesFond = (cadre: Cadre, part: number, zoom: number, video: boolean) => `calc(${LARGEUR_CADRE[cadre]} * ${Math.round(part * zoom * (video ? 1.12 : 1) * 100) / 100})`;

/** Un visuel de public/bola-plus/, recadré sur son point (x, y) et grossi. */
function Fond({ fond, x, y, zoom, sizes, className }: { fond: Fond; x: number; y: number; zoom: number; sizes: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- déjà à ses trois tailles (public/bola-plus)
    <img
      className={className ?? "st-scene__fond"}
      src={fichierVisuel(fond, 480)}
      srcSet={sourcesVisuel(fond)}
      sizes={sizes}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      style={{ ["--x" as string]: `${x}%`, ["--y" as string]: `${y}%`, ["--z" as string]: zoom }}
    />
  );
}

/** Les cartes d'une scène, à la largeur `l` de la vignette. */
function Cartes({ pose, l }: { pose: Scene["pose"]; l: number }) {
  switch (pose) {
    case "tenue":
      return <CarteToi largeur={l * 0.5} style={{ left: "50%", bottom: "9%", transform: "translateX(-50%) rotate(-8deg)" }} />;
    case "une":
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- le logo de la marque, en SVG */}
          <img className="st-une__logo" src="/bola/logo-blanc.svg" alt="" draggable={false} />
          <CarteToi largeur={l * 0.5} style={{ left: "50%", bottom: "8%", transform: "translateX(-50%)" }} />
        </>
      );
    case "affiche": {
      // En miroir : la face et le dos droits, à la même hauteur, le ballon entre les deux.
      const w = l * 0.34;
      const milieu = `calc(14% + ${(w * (1656 / 1024)) / 2}px)`;
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- le symbole Bola : le ballon */}
          <img className="st-ballon st-ballon--contre" src="/bola/symbole-blanc.svg" alt="" draggable={false} style={{ bottom: milieu }} />
          <CarteToi largeur={w} style={{ left: "7%", bottom: "14%" }} />
          <CarteToi largeur={w} dos style={{ right: "7%", bottom: "14%" }} />
        </>
      );
    }
    case "provoc":
      // De très près, penchée vers l'objectif ; l'adversaire, coupé au bord, flou.
      return (
        <>
          <CarteToi largeur={l * 0.44} dos style={{ right: "-17%", bottom: "38%", transform: "rotate(11deg)", filter: "blur(2.5px) brightness(0.72)" }} />
          <CarteToi largeur={l * 0.66} style={{ left: "6%", bottom: "-6%", transform: "perspective(560px) rotateY(18deg) rotate(-6deg)" }} />
        </>
      );
    case "sortie":
      return <CarteToi largeur={l * 0.56} style={{ left: "50%", bottom: "10%", transform: "translateX(-50%) perspective(520px) rotateY(-30deg)" }} />;
    case "trois":
      return <CarteToi largeur={l * 0.24} style={{ left: "50%", bottom: "12%", transform: "translateX(-50%)" }} />;
    case "loin":
      return <CarteToi largeur={l * 0.15} style={{ left: "50%", bottom: "30%", transform: "translateX(-50%)" }} />;
    case "ballon":
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- le symbole Bola : le ballon */}
          <img className="st-ballon" src="/bola/symbole-blanc.svg" alt="" draggable={false} />
          <CarteToi largeur={l * 0.3} style={{ left: "8%", bottom: "8%", transform: "rotate(-5deg)" }} />
        </>
      );
    case "rang": {
      const w = l * 0.19;
      return (
        <span className="st-rang">
          {[0, 1, 2, 3, 4].map((i) => (
            <CarteToi key={i} largeur={i === 2 ? w * 1.18 : w} dos={i !== 2} style={{ position: "relative", zIndex: i === 2 ? 1 : 0 }} />
          ))}
        </span>
      );
    }
    case "fond":
      return null;
  }
}

/** Les trois plans de « Ta saison » : trois visuels côte à côte. */
const PLANS: { fond: Fond; x: number; y: number }[] = [
  { fond: "matchs-filmes", x: 44, y: 50 },
  { fond: "affiche", x: 50, y: 55 },
  { fond: "ceremonies", x: 50, y: 60 },
];

/**
 * La vignette d'une scène : le visuel, les cartes, et pour une vidéo le
 * cadrage qui avance. Décorative (aria-hidden) : ce qu'elle montre est dit à
 * côté (le nom, ce que tu reçois), ou par le libellé de « Ton studio ».
 */
export function SceneStudio({ scene, video, cadre, className }: { scene: Scene; video?: number; cadre: Cadre; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const l = useLargeur(ref);
  const proche = useProche(ref);
  return (
    <div
      ref={ref}
      aria-hidden
      className={`st-scene dark ${className ?? ""}`}
      data-pose={scene.pose}
      data-video={video ? "" : undefined}
      style={video ? { ["--duree" as string]: `${Math.max(6, video * 1.6)}s` } : undefined}
    >
      {scene.pose === "trois" ? (
        <span className="st-trois">
          {PLANS.map((p) => (
            <span key={p.fond}>
              <Fond fond={p.fond} x={p.x} y={p.y} zoom={1} sizes={taillesFond(cadre, 1 / 3, 1, !!video)} />
            </span>
          ))}
        </span>
      ) : (
        <Fond fond={scene.fond} x={scene.x} y={scene.y} zoom={scene.zoom} sizes={taillesFond(cadre, 1, scene.zoom, !!video)} />
      )}
      {l && proche ? (
        <span className="st-scene__cartes">
          <Cartes pose={scene.pose} l={l} />
        </span>
      ) : null}
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

/** Une fiche : la durée (avec le triangle de lecture pour une vidéo) et le prix. */
function Meta({ t }: { t: Template }) {
  return (
    <span className="flex items-center justify-between gap-2 text-[13px] leading-none font-semibold text-encre-2 tabular-nums">
      <span className="flex items-center gap-1">
        {t.rendu.genre === "video" && <Play className="size-3 fill-current" aria-hidden />}
        {dureeDe(t)}
      </span>
      <span className="text-foreground">{prixDe(t)}</span>
    </span>
  );
}

/** Un template dans le rail : sa vignette, son nom, ce que tu reçois, sa durée, son prix. */
function CarteTemplate({ t, onOuvrir }: { t: Template; onOuvrir: () => void }) {
  return (
    <li className="st-item">
      <button type="button" onClick={onOuvrir} className="st-item__bouton">
        <SceneStudio scene={t.scene} video={t.rendu.genre === "video" ? t.rendu.secondes : undefined} cadre="rail" />
        <span className="flex flex-col gap-1.5 px-1 pt-3">
          <span className="text-[15px] leading-tight font-bold tracking-[-0.2px]">{t.nom}</span>
          <span className="line-clamp-2 min-h-[2.5em] text-[13px] leading-[1.25] text-encre-2">{t.recoit}</span>
          <Meta t={t} />
        </span>
      </button>
    </li>
  );
}

/** Un template en grand, dans une feuille. */
function FicheTemplate({ t, onFermer }: { t: Template | null; onFermer: () => void }) {
  return (
    <Sheet open={!!t} onOpenChange={(o) => !o && onFermer()}>
      <SheetContent side="bottom" className={FEUILLE_STUDIO} style={COULEURS_STUDIO}>
        {t && (
          <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-3 pt-3 pb-8">
            <SceneStudio scene={t.scene} video={t.rendu.genre === "video" ? t.rendu.secondes : undefined} cadre="page" className="st-scene--grand" />
            <div className="flex flex-col gap-2 px-1">
              <SheetTitle className="bp-titre st-fiche__titre">{t.nom}</SheetTitle>
              <p className="text-corps leading-snug text-encre-2">{t.recoit}</p>
              <span className="mt-1 flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-1.5 text-corps font-semibold text-encre-2 tabular-nums">
                  {t.rendu.genre === "video" && <Play className="size-3.5 fill-current" aria-hidden />}
                  {dureeDe(t)}
                </span>
                <Prix texte={prixDe(t)} className="text-[28px] leading-none tabular-nums" />
              </span>
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

/**
 * « Ton studio », la carte du carrousel : trois vrais templates en éventail et
 * « Bola Studio » avec le nombre de templates. Un seul bouton : il ouvre le
 * panneau. Ses mots se lisent en entier (pas d'aria-label).
 */
export function VisuelStudio() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" className="st-eventail" onClick={() => setOuvert(true)}>
        <span className="st-eventail__cartes">
          {EVENTAIL.map((t, i) => (
            <span key={t.id} className="st-eventail__place" data-place={i}>
              <SceneStudio scene={t.scene} video={t.rendu.genre === "video" ? t.rendu.secondes : undefined} cadre="rail" />
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
