"use client";

// Bola Studio dans la page Bola Plus (demande de Sabri, 14/11/2026,
// bola-app#22 : « Rends-moi visuellement l'artefact dans le module qui
// présente son abonnement »). Ce que le joueur en voit ; les templates, les
// prix, les ballons et les recharges sont dans lib/sfl/studio.ts, jamais ici.
//
//   · SceneStudio : la vignette d'un template, composée avec ce qui existe
//     (aucune image générée) : un visuel de public/bola-plus/ recadré (le
//     stade de piliers, le portant, la caméra, le socle, le podium), la vraie
//     carte anonyme « Toi » (BolaCard, ou son dos, DosCarte) posée selon la
//     scène, le logo ou le symbole Bola. Une vidéo : le cadrage avance
//     lentement (studio-bola.css), arrêté avec « Réduire les animations ».
//     Les cartes ne se montent qu'une fois la vignette mesurée et proche :
//     à une largeur de rail d'avance dans le rail, à un écran d'avance dans
//     la page (useProche observe le conteneur qui défile vraiment) ; douze
//     vignettes ne pèsent rien tant qu'on ne les voit pas. Chaque visuel dit
//     au navigateur sa taille réelle, grossissement compris (sizes) : une
//     vignette agrandie dans la feuille charge la grande image, pas la molle.
//     La scène est décorative (aria-hidden) : un lecteur d'écran lit le nom,
//     ce que tu reçois, la durée et le prix, jamais le micro-texte de la
//     carte ;
//   · VisuelStudio : le visuel de l'avantage « Ton studio » (bola-plus.tsx),
//     sur le fond que porte l'avantage : le stade, le ballon au centre des
//     coins de repère, sans carte (sceneStudio, lib/sfl/studio.ts) ;
//   · RailStudio : « Bola Studio », la phrase des ballons du mois
//     (« 300 ⚽ = un trash talk ou six images », calculée), puis les douze
//     templates en rail horizontal, au doigt, accroché carte par carte
//     (scroll-snap) : la vignette, le nom, ce que tu reçois, la durée, le
//     prix. Toucher un template l'ouvre en grand dans une feuille (la même
//     fiche, la vignette à la largeur de l'écran). Aucun bouton d'achat :
//     rien ne s'achète encore ;
//   · RechargesStudio : les trois recharges, sous le bouton de l'offre,
//     marquées « Bientôt », sans geste ni focus ; leurs chiffres en Anton
//     prennent l'espace insécable large (« 1 100 », pas « 1100 »).
//
// Le ballon ⚽ d'un prix en Anton (la feuille, les recharges) est réduit à
// 0,7 em sur la ligne de base (Prix) : l'émoji ne domine pas le chiffre.
// Sur un grand écran, le rail s'efface en fondu au bord de la colonne.
//
// Noir et blanc : les visuels sont gris, l'encre est celle de l'app ; les
// vignettes sont des îlots sombres (classe dark), comme les cartes
// d'avantage. Pas de texte d'aide : des noms, des durées, des prix.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Play } from "lucide-react";
import { BolaCard } from "@/components/sfl/bola-card";
import { DosCarte } from "@/components/sfl/dos-carte";
import { matiereDe } from "@/components/sfl/finitions-carte";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { fichierVisuel, sourcesVisuel } from "@/lib/sfl/bola-plus";
import {
  ESPACE_LARGE,
  PHRASE_INCLUS,
  RECHARGES_STUDIO,
  TEMPLATES,
  ballons,
  dureeDe,
  prixDe,
  prixRecharge,
  sceneStudio,
  type Fond,
  type Scene,
  type Template,
} from "@/lib/sfl/studio";
import type { Stats } from "@/lib/sfl/engine";
import "./studio-bola.css";

/* ---------------------------- La carte « Toi » ---------------------------- */

// La carte anonyme : « Toi », sans photo, sans pseudo, les chiffres de la
// carte de départ (une carte qui n'est celle de personne).
const TOI = { name: "Toi", position: "MC", overall: 75 } as const;
const STATS_TOI: Stats = { VIT: 76, TIR: 73, PAS: 77, DRI: 75, DEF: 72, PHY: 74 };
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
        {dos ? <DosCarte matiere={matiereDe("base")} nom={TOI.name} size={TAILLE} /> : <BolaCard {...TOI} stats={STATS_TOI} size={TAILLE} />}
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
 * La marge ne vaut que pour le conteneur qui défile : le rail pour une
 * vignette du rail, #app-scroll pour la page ; la feuille, hors des deux, est
 * déjà à l'écran.
 */
function useProche(ref: RefObject<HTMLElement | null>) {
  const [proche, setProche] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || proche) return;
    const rail = el.closest<HTMLElement>(".st-rail");
    const page = document.getElementById("app-scroll");
    const root = rail ?? (page?.contains(el) ? page : null);
    const o = new IntersectionObserver(([e]) => e.isIntersecting && setProche(true), { root, rootMargin: rail ? "0px 100%" : "100% 0px" });
    o.observe(el);
    return () => o.disconnect();
  }, [ref, proche]);
  return proche;
}

/** La largeur d'une vignette à l'écran : dans le rail, ou à la largeur de la page (la feuille, « Ton studio »). */
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
    case "podium":
      return <CarteToi largeur={l * 0.26} style={{ left: "50%", bottom: "41%", transform: "translateX(-50%)" }} />;
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
    case "vise":
      // eslint-disable-next-line @next/next/no-img-element -- le symbole Bola : le ballon, au centre du cadre
      return <img className="st-ballon st-ballon--vise" src="/bola/symbole-blanc.svg" alt="" draggable={false} />;
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

/** Le visuel de l'avantage « Ton studio » : sur le fond de l'avantage, le ballon au centre des coins de repère. */
export function VisuelStudio({ fond, alt }: { fond: string; alt: string }) {
  return (
    <span className="st-visuel" role="img" aria-label={alt}>
      <SceneStudio scene={sceneStudio(fond)} cadre="page" className="st-scene--plein" />
      <span className="st-reperes" />
    </span>
  );
}

/* -------------------------------- Le rail -------------------------------- */

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
      <SheetContent side="bottom" className="rounded-t-3xl">
        {t && (
          <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4 px-3 pt-3 pb-8">
            <SceneStudio scene={t.scene} video={t.rendu.genre === "video" ? t.rendu.secondes : undefined} cadre="page" className="st-scene--grand" />
            <div className="flex flex-col gap-2 px-1">
              <SheetTitle className="text-[24px] leading-none font-black tracking-[-0.04em]">{t.nom}</SheetTitle>
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

/** « Bola Studio » : la phrase des ballons du mois, puis les douze templates. */
export function RailStudio() {
  const [ouvert, setOuvert] = useState<Template | null>(null);
  return (
    <section className="st" aria-labelledby="st-titre">
      <div className="flex flex-col gap-2 px-5">
        <h2 id="st-titre" className="text-[26px] leading-none font-black tracking-[-0.045em] whitespace-nowrap">
          Bola Studio
        </h2>
        <p className="text-corps leading-tight font-semibold text-encre-2 tabular-nums">{PHRASE_INCLUS}</p>
      </div>
      <ul className="st-rail">
        {TEMPLATES.map((t) => (
          <CarteTemplate key={t.id} t={t} onOuvrir={() => setOuvert(t)} />
        ))}
      </ul>
      <FicheTemplate t={ouvert} onFermer={() => setOuvert(null)} />
    </section>
  );
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
