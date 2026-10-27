"use client";

// Les rubriques du fil des Actus, posées sur un terrain (Sabri, 22/10 : « un
// terrain en fond avec les cartes […] plein de petites cartes sur un terrain,
// à côté du but. On ne swipe pas quand on arrive sur un post : que tout se
// fasse en scroll et qu'il y ait plus de vie »).
//
// Chaque rubrique est la même scène : la moitié d'un terrain vue en
// perspective (le sol de la feuille de match, matchs/sol-terrain.tsx), le but
// au fond, et les cartes des joueurs debout dessus, plus petites au loin.
// Rien ne se joue à la minute : tout suit le défilement. La section porte
// --p, de 0 quand elle entre par le bas à 1 quand elle est en place ; la
// caméra avance, les cartes se lèvent l'une après l'autre, les chiffres se
// comptent, le ballon file au but. On remonte, tout repart en arrière
// (classes pel-* dans actus.css). Plus de carrousel : tout tient sur un
// terrain.
//
// Les rubriques : ton dimanche, ce qui se joue dimanche, ton rival, ce qu'il
// te faut, puis pour chaque dimanche joué l'homme du dimanche, le chiffre, le
// duo, ceux qui montent, les badges décrochés et l'équipe type. Sous chacune
// de celles-là, Bravo félicite ses joueurs (bravo.tsx).
//
// Rien ne se chevauche (Sabri, 23/10 : « des balles qui vont sur la tête des
// joueurs […] pas de superpositions qui seraient incohérentes »). Une carte
// ne se tient jamais devant le but quand il y a des ballons au fond du filet :
// elle se pose à côté. Ailleurs, celle qui se tient au milieu du but le cache
// en entier (une moyenne : le meilleur du rang), pour que les poteaux ne
// l'encadrent pas, et aucune carte n'a le but juste au-dessus de la tête. Les
// rangs de cartes sont assez loin l'un de l'autre
// pour que la carte de devant ne cache pas le nom de celle de derrière. Une
// pastille posée au-dessus d'une carte (« ▲ 3 », un badge) se pose au-dessus
// de son nom compris, et le cadre la compte (Place.coiffe). Le ballon qui
// file passe derrière ceux qui sont devant lui, et ses trajets évitent les
// noms.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge3D } from "@/components/sfl/badge-3d";
import { MiniCarte } from "@/components/sfl/mini-carte";
import { SolTerrain } from "@/components/sfl/matchs/sol-terrain";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSaisonClose, useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import type { Actu, Marche, Titre } from "@/lib/sfl/actus";
import type { BoostType } from "@/lib/sfl/engine";
import type { Enjeu, Voisins } from "@/lib/sfl/actus-toi";
import { exploitsDe } from "@/lib/sfl/exploits";
import { entryPP } from "@/lib/sfl/saisie/engine";
import { rangPepiteApres } from "@/lib/sfl/rangs";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { projeter, trace, vue } from "@/lib/sfl/terrain-vu";
import { metal, NOM_METAL, TROPHEES } from "@/lib/sfl/trophees";
import { sources, type Couverture } from "@/lib/sfl/couvertures";
import { preparerPiece, type PieceLigue } from "@/lib/sfl/vestiaire";
import { cn } from "@/lib/utils";
import { ANTON } from "./ecran";
import { Bravo } from "./bravo";
import { pl, useJoueurs } from "./cinematiques";
import "./actus.css";

const DEF = Object.fromEntries(TROPHEES.map((d) => [d.id, d]));

/** Le terrain des rubriques : celui des terrains de la Ligue, un peu plus couché, le but au fond. */
const VUE = vue(270, 500, 40);
export const MILIEU = VUE.l / 2;
/** La ligne de but du fond, et le but de five : 4,5 m sur 1,6 m environ à cette échelle. */
const LIGNE = 11;
const POTEAUX = [MILIEU - 24, MILIEU + 24] as const;
const BARRE = 20;
/** La largeur du dessin avant mise à l'échelle de l'écran. */
const BASE = 330;
/**
 * L'échelle la plus grande : celle d'un téléphone de 449 px. Au-delà
 * (tablette, ordinateur, téléphone tenu en largeur), le terrain garde cette
 * taille et se centre ; les cartes ne grandissent plus avec l'écran.
 */
const ECHELLE_MAX = 449 / BASE;
const MARGE = 12;
const PHI = (1 + Math.sqrt(5)) / 2;
/** Les tailles des cartes debout (fraction de 254 px, comme FORMAT_CARTE). */
export const T = { vedette: 0.27, moyenne: 0.21, petite: 0.16 } as const;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/* ------------------------------ Le défilement ------------------------------ */

const Avancee = createContext<{ abonner: (f: (p: number) => void) => () => void }>({ abonner: () => () => {} });

/** Suivre l'avancée de la scène : f(p) à chaque image où elle change. */
function useAvancee(f: (p: number) => void) {
  const { abonner } = useContext(Avancee);
  const ref = useRef(f);
  useEffect(() => {
    ref.current = f;
  });
  useEffect(() => abonner((p) => ref.current(p)), [abonner]);
}

/**
 * La couverture de la rubrique, quand le dimanche lui en donne une (course.tsx,
 * lib/sfl/couvertures.ts) : la photo remplace le gazon, le terrain n'est plus
 * que ses lignes à la craie, les cartes et les chiffres restent les mêmes.
 */
export const CouvertureRubrique = createContext<Couverture | null>(null);

/* ------------------------------ Les éléments ------------------------------ */

/** Une carte debout sur le terrain, en (u, v) ; d est le moment où elle se lève. */
export interface Place {
  nom: string;
  u: number;
  v: number;
  taille?: number;
  d?: number;
  /** Ta carte : son nom en blanc. */
  moi?: boolean;
  /** Sous le nom, les chiffres du jour. */
  sous?: string;
  /** Sur le coin haut de la carte, en pastille : quand le nom n'a plus la place à côté de lui. */
  badge?: string;
  /** La place qu'occupe, au-dessus de la carte, ce qui s'y pose (en px à l'échelle 1) : le cadre la compte. */
  coiffe?: number;
  /** Une carte à titre (MVP or, Impact rouge, Défensive bleu), de la journée `journee`. */
  distinction?: BoostType;
  /** Ses titres, en étiquette centrée sur le haut de la carte (« MVP·DÉF »). */
  titres?: string;
  journee?: number;
}

/** La hauteur d'une carte debout et de son nom, à l'échelle 1. */
const hauteur = (taille: number) => 254 * taille * PHI + 26;
/** La hauteur (Bulle `haut`) du milieu d'une pastille de hauteur h posée au-dessus d'une carte et de son nom. */
const dessus = (taille: number, h: number) => hauteur(taille) + 4 + h / 2;

function Debout({ p }: { p: Place }) {
  const joueur = useJoueurs()(p.nom);
  const id = useIdentites();
  const { x, y, k } = projeter(p.u, p.v, 0, VUE);
  const taille = p.taille ?? T.petite;
  if (!joueur) return null;
  return (
    <div className="absolute size-0" style={{ left: `calc(50% + ${x}px)`, top: y, zIndex: Math.round(p.v) }}>
      <div className="absolute bottom-0 left-0" style={{ transformOrigin: "50% 100%", transform: `translateX(-50%) scale(${k})` }}>
        <div className="pel-entre flex flex-col items-center" style={{ ["--d" as string]: p.d ?? 0.2 }}>
          {/* En flex : un bouton (MiniCarte) seul dans un bloc garde sous lui
              la place d'une ligne de texte, qui éloignait la carte de son nom. */}
          <div className="relative flex">
            <MiniCarte player={joueur} size={taille} vertical distinction={p.distinction} journee={p.distinction ? p.journee : undefined} />
            {p.titres && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-[5px] py-[1.5px] font-mono text-[9px] leading-[1.2] font-bold whitespace-nowrap text-black shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
                {p.titres}
              </span>
            )}
            {p.badge && (
              <span className="absolute top-0 right-0 translate-x-[45%] -translate-y-[35%] rounded-full bg-white px-[5px] py-[1.5px] font-mono text-[9.5px] leading-[1.2] font-bold whitespace-nowrap text-black tabular-nums shadow-[0_2px_6px_rgba(0,0,0,0.35)]">
                {p.badge}
              </span>
            )}
          </div>
          <span
            className={cn(
              "mt-[4px] flex items-center gap-[5px] rounded-full px-[8px] py-[2px] text-[11px] leading-[1.25] font-bold whitespace-nowrap",
              p.moi ? "bg-white text-black" : "bg-black/70 text-white",
            )}
          >
            {id.nom(p.nom).split(" ")[0]}
            {p.sous && <span className="font-mono text-[9.5px] font-semibold opacity-60 tabular-nums">{p.sous}</span>}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Ce qui flotte au-dessus du terrain en (u, v), à la hauteur w : un chiffre,
 * un badge. `haut` le relève encore de tant de px à l'échelle de l'endroit,
 * comme une carte : au-dessus de la carte qui s'y tient (`dessus`).
 */
export function Bulle({
  u,
  v,
  w = 0,
  haut = 0,
  d = 0.4,
  children,
  className,
}: {
  u: number;
  v: number;
  w?: number;
  haut?: number;
  d?: number;
  children: ReactNode;
  className?: string;
}) {
  const { x, y, k } = projeter(u, v, w, VUE);
  return (
    <div className="absolute size-0" style={{ left: `calc(50% + ${x}px)`, top: y - haut * k, zIndex: 600 }}>
      <div className="absolute top-0 left-0" style={{ transform: `translate(-50%, -50%) scale(${Math.max(0.85, k)})` }}>
        <div className={cn("pel-entre", className)} style={{ ["--d" as string]: d }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Un chiffre en pastille : le nombre en Anton, ce qu'il compte dessous. */
export function Pastille({ n, quoi, clair = false, petit = false }: { n: ReactNode; quoi: string; clair?: boolean; petit?: boolean }) {
  return (
    <span
      className={cn(
        "flex flex-col items-center rounded-2xl pt-1.5 pb-1 whitespace-nowrap shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
        petit ? "min-w-[46px] px-2" : "min-w-[58px] px-3",
        clair ? "bg-white text-black" : "bg-black/75 text-white backdrop-blur-md",
      )}
    >
      <span className={petit ? "text-[24px] leading-none" : "text-[30px] leading-none"} style={{ fontFamily: ANTON }}>
        {n}
      </span>
      <span className={cn("mono-label mt-0.5 text-[8.5px]", clair ? "text-black/55" : "text-white/55")}>{quoi}</span>
    </span>
  );
}

/** Un nombre qui se compte au défilement, de 0 au sien. */
function Compte({ n, d = 0.3 }: { n: number; d?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useAvancee((p) => {
    if (ref.current) ref.current.textContent = String(Math.round(n * clamp01((p - d) * 3)));
  });
  return <span ref={ref}>{n}</span>;
}

/** Les ballons au fond du filet : un par but. */
function Filet({ n, d = 0.55 }: { n: number; d?: number }) {
  const balles = Math.min(n, 8);
  return (
    <>
      {Array.from({ length: balles }, (_, i) => {
        const u = MILIEU + (i - (balles - 1) / 2) * Math.min(9, 40 / Math.max(1, balles - 1));
        const { x, y, k } = projeter(u, LIGNE - 6 + (i % 2) * 2, 3, VUE);
        return (
          <div key={i} className="absolute size-0" style={{ left: `calc(50% + ${x}px)`, top: y, zIndex: 4 }}>
            <span
              className="pel-entre absolute block rounded-full bg-white shadow-[inset_-2px_-2px_0_rgba(0,0,0,0.25)]"
              style={{ ["--d" as string]: d + i * 0.04, width: 9 * k, height: 9 * k, left: -4.5 * k, top: -9 * k }}
            />
          </div>
        );
      })}
    </>
  );
}

/**
 * Le ballon qui suit un trajet sur le terrain au défilement, de p = de à p = a.
 * Il passe derrière ceux qui sont devant lui : sa profondeur est celle d'une
 * carte posée au même endroit (Debout, zIndex = v).
 */
function Ballon({ trajet, de, a }: { trajet: [number, number][]; de: number; a: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useAvancee((p) => {
    const el = ref.current;
    if (!el) return;
    const s = clamp01((p - de) / (a - de)) * (trajet.length - 1);
    const i = Math.min(trajet.length - 2, Math.floor(s));
    const f = s - i;
    const u = trajet[i][0] + (trajet[i + 1][0] - trajet[i][0]) * f;
    const v = trajet[i][1] + (trajet[i + 1][1] - trajet[i][1]) * f;
    // Il décolle un peu au milieu de chaque passe.
    const w = Math.sin(f * Math.PI) * 10 + 3;
    const { x, y, k } = projeter(u, v, w, VUE);
    el.style.transform = `translate(${x - 5 * k}px, ${y - 5 * k}px) scale(${k})`;
    el.style.zIndex = String(Math.round(v));
    el.style.opacity = p < de - 0.02 ? "0" : "1";
  });
  return (
    <span
      ref={ref}
      aria-hidden
      className="absolute top-0 left-1/2 block size-[10px] rounded-full bg-white shadow-[inset_-2px_-2px_0_rgba(0,0,0,0.25),0_4px_8px_rgba(0,0,0,0.4)]"
      style={{ zIndex: Math.round(trajet[0][1]), transformOrigin: "0 0" }}
    />
  );
}

/** Le but du fond : les poteaux, la barre et le filet, en perspective. Le
 *  filet et le cerne des poteaux suivent le mode (globals.css, --but-*) : sur
 *  le papier du mode clair, le blanc seul disparaîtrait. */
function But() {
  const [g, dr] = POTEAUX;
  const fond = LIGNE - 9;
  const mailles = Array.from({ length: 9 }, (_, i) => g + ((dr - g) * i) / 8);
  return (
    <svg aria-hidden className="absolute inset-0 size-full" overflow="visible" style={{ zIndex: 3 }}>
      <svg x="50%" overflow="visible">
        <path
          d={trace([[g, LIGNE, BARRE], [g, fond, BARRE - 4], [dr, fond, BARRE - 4], [dr, LIGNE, BARRE]], true, VUE)}
          style={{ fill: "var(--but-voile)" }}
        />
        <path d={trace([[g, fond, 0], [g, fond, BARRE - 4], [dr, fond, BARRE - 4], [dr, fond, 0]], true, VUE)} style={{ fill: "var(--but-fond)" }} />
        <g strokeWidth={0.7} fill="none" style={{ stroke: "var(--but-filet)" }}>
          {mailles.map((u) => (
            <path key={u} d={trace([[u, fond, 0], [u, fond, BARRE - 4], [u, LIGNE, BARRE]], false, VUE)} />
          ))}
          {[0.25, 0.5, 0.75].map((h) => (
            <path key={h} d={trace([[g, fond, (BARRE - 4) * h], [dr, fond, (BARRE - 4) * h]], false, VUE)} />
          ))}
          <path d={trace([[g, LIGNE, 0], [g, fond, 0], [g, fond, BARRE - 4]], false, VUE)} />
          <path d={trace([[dr, LIGNE, 0], [dr, fond, 0], [dr, fond, BARRE - 4]], false, VUE)} />
        </g>
        <path
          d={trace([[g, LIGNE, 0], [g, LIGNE, BARRE], [dr, LIGNE, BARRE], [dr, LIGNE, 0]], false, VUE)}
          fill="none"
          strokeWidth={4.2}
          strokeLinejoin="round"
          style={{ stroke: "var(--but-cerne)" }}
        />
        <path
          d={trace([[g, LIGNE, 0], [g, LIGNE, BARRE], [dr, LIGNE, BARRE], [dr, LIGNE, 0]], false, VUE)}
          fill="none"
          stroke="#fff"
          strokeWidth={2.6}
          strokeLinejoin="round"
        />
      </svg>
    </svg>
  );
}

/** Un trajet à la craie sur le terrain (la passe du duo). */
function Craie({ points, d = 0.35 }: { points: [number, number][]; d?: number }) {
  return (
    <svg aria-hidden className="pel-fondu absolute inset-0 size-full" overflow="visible" style={{ zIndex: 2, ["--d" as string]: d }}>
      <svg x="50%" overflow="visible">
        <path d={trace(points, false, VUE)} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.6} strokeDasharray="4 5" strokeLinecap="round" />
      </svg>
    </svg>
  );
}

/* ------------------------------- La scène ------------------------------- */

/**
 * Une rubrique : son titre, le terrain avec ses cartes, sa ligne de légende.
 * Le terrain est dessiné pour une largeur de 330 px, puis mis à la largeur
 * de l'écran (jusqu'à ECHELLE_MAX) ; on n'en montre que la moitié du fond,
 * jusqu'à `jusqua`. Dans la grille des grands écrans, une rubrique s'étire à
 * la hauteur de sa voisine : le surplus va entre le titre et le terrain.
 */
export function Scene({
  sur,
  titre,
  places,
  jusqua = 250,
  texte,
  partage,
  action,
  exploits,
  className,
  children,
}: {
  /** La petite ligne au-dessus du titre (« J2 · l'homme du dimanche »). */
  sur: ReactNode;
  titre: ReactNode;
  places: Place[];
  /** Jusqu'où, vers l'avant, on voit le terrain. */
  jusqua?: number;
  texte?: ReactNode;
  partage?: Omit<PieceLigue, "type">;
  action?: ReactNode;
  /** Les clés des exploits de la rubrique : la notification d'une félicitation y ramène (/ligue?exploit=…). */
  exploits?: string[];
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  // Une saison close se relit dans les Actus (epoques.tsx) : sans Bravo ni partage.
  const relue = useSaisonClose();
  const couverture = useContext(CouvertureRubrique);
  const aPartager = relue ? undefined : partage;
  const geste = relue ? undefined : action;
  const ref = useRef<HTMLElement>(null);
  const cadre = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  const abonnes = useRef(new Set<(p: number) => void>());
  const derniere = useRef(0);
  const ctx = useMemo(
    () => ({
      abonner: (f: (p: number) => void) => {
        abonnes.current.add(f);
        f(derniere.current);
        return () => void abonnes.current.delete(f);
      },
    }),
    [],
  );

  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const o = new ResizeObserver(([e]) => setLargeur(e.contentRect.width));
    o.observe(el);
    return () => o.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const defile: HTMLElement | Window = document.getElementById("app-scroll") ?? window;
    let image = 0;
    const maj = () => {
      image = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 quand le haut de la rubrique entre par le bas, 1 quand il a atteint le quart haut.
      const p = calme ? 1 : clamp01((vh - r.top) / (vh * 0.72));
      if (Math.abs(p - derniere.current) < 0.001 && el.style.getPropertyValue("--p")) return;
      derniere.current = p;
      el.style.setProperty("--p", p.toFixed(3));
      abonnes.current.forEach((f) => f(p));
    };
    const demande = () => {
      if (!image) image = requestAnimationFrame(maj);
    };
    maj();
    defile.addEventListener("scroll", demande, { passive: true });
    window.addEventListener("resize", demande);
    return () => {
      cancelAnimationFrame(image);
      defile.removeEventListener("scroll", demande);
      window.removeEventListener("resize", demande);
    };
  }, []);

  // Le cadre épouse ce qu'il montre : du haut de la carte la plus haute (et
  // de ce qui s'y pose), ou de la barre du but, jusqu'à `jusqua`.
  const projetees = places.map((p) => ({ ...p, ...projeter(p.u, p.v, 0, VUE) }));
  const haut = Math.min(
    projeter(MILIEU, LIGNE, BARRE + 6, VUE).y,
    projeter(0, 0, 0, VUE).y,
    ...projetees.map((p) => p.y - (hauteur(p.taille ?? T.petite) + (p.coiffe ?? 0)) * p.k),
  );
  const bas = projeter(MILIEU, jusqua, 0, VUE).y;
  const naturelle = bas - haut + MARGE * 2;
  const s = Math.min(largeur / BASE, ECHELLE_MAX);

  return (
    <section
      ref={ref}
      data-exploits={relue ? undefined : exploits?.join("|")}
      className={cn(
        "relative flex flex-col overflow-hidden md:rounded-3xl",
        couverture
          ? "dark bg-black text-white"
          : "bg-[radial-gradient(120%_70%_at_50%_30%,#ffffff_0%,#e8eae5_75%)] text-foreground dark:bg-[radial-gradient(120%_70%_at_50%_30%,#1d2024_0%,#0c0d0f_75%)] dark:text-white",
        className,
      )}
      style={{ ["--p" as string]: 0 } as CSSProperties}
    >
      {couverture && <FondPhoto c={couverture} />}
      <header className="relative z-10 flex flex-col gap-1 px-5 pt-5">
        <span className="pel-titre mono-label text-[10px] text-foreground/50 dark:text-white/50" style={{ ["--d" as string]: 0 }}>
          {sur}
        </span>
        <h3 className="pel-titre titre-lettrage text-[24px] leading-[0.95]" style={{ ["--d" as string]: 0.06 }}>
          {titre}
        </h3>
      </header>
      {/* La place de la photo, entre le titre et le terrain. */}
      {couverture && <div className="h-[52vw] max-h-64 shrink-0 md:h-56" />}
      <div ref={cadre} className="relative mt-auto w-full" style={{ height: largeur ? naturelle * s : naturelle }}>
        {largeur > 0 && (
          <Avancee.Provider value={ctx}>
            <div
              className="absolute top-0 origin-top-left"
              style={{ left: Math.max(0, Math.round((largeur - BASE * s) / 2)), width: BASE, height: naturelle, transform: `scale(${s})` }}
            >
              <div className="pel-camera absolute inset-0">
                <div className="absolute inset-x-0" style={{ top: MARGE - haut, height: bas + MARGE }}>
                  <SolTerrain ombres={projetees} rayon={26} vue={VUE} gazon={couverture ? "craie" : "vert"} />
                  <But />
                  {children}
                  {places.map((p, i) => (
                    <Debout key={`${p.nom}-${i}`} p={p} />
                  ))}
                </div>
              </div>
            </div>
          </Avancee.Provider>
        )}
      </div>
      {(texte || aPartager || geste) && (
        <div className="relative flex min-h-11 items-center gap-2 pr-1.5 pb-2 pl-5">
          <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground/70 dark:text-white/70">{texte}</span>
          {geste}
          {aPartager && (
            <button
              type="button"
              aria-label="Partager au Vestiaire"
              onClick={() => {
                preparerPiece({ type: "ligue", ...aPartager, lignes: aPartager.lignes.slice(0, 6) });
                router.push("/vestiaire");
              }}
              className="grid size-9 shrink-0 place-items-center rounded-full text-foreground/60 transition-transform active:scale-90 dark:text-white/60"
            >
              <MessageCircle className="size-[18px]" strokeWidth={1.8} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * La photo d'une rubrique couverte : en haut, bord à bord, sous le titre ;
 * elle se fond dans le noir là où les cartes se lèvent, pour que rien ne
 * se lise sur elle que le titre. Elle glisse un peu moins vite que le
 * défilement (--p) ; immobile avec « Réduire les animations ».
 */
function FondPhoto({ c }: { c: Couverture }) {
  const { src, srcSet } = sources(c);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[72%] overflow-hidden"
      style={{ maskImage: "linear-gradient(180deg, #000 36%, transparent 86%)", WebkitMaskImage: "linear-gradient(180deg, #000 36%, transparent 86%)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- une image fixe du moodboard, en srcset */}
      <img
        src={src}
        srcSet={srcSet}
        sizes="(min-width: 768px) 560px, 100vw"
        alt=""
        loading="lazy"
        decoding="async"
        className="pel-photo absolute inset-0 size-full object-cover"
        style={{ objectPosition: c.point }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0)_30%)]" />
    </div>
  );
}

/* ------------------------------ Les rubriques ------------------------------ */

/** Le moment d'entrée de la i-ième carte. */
export const tour = (i: number, de = 0.18, pas = 0.07) => de + i * pas;

/**
 * La place de l'homme du jour : à gauche du but, pas devant, pour que ses
 * buts restent visibles au fond du filet.
 */
const A_COTE_DU_BUT = { u: 66, v: 100 } as const;

/** Ses chiffres : ses buts au fond du filet et comptés près du but, ses passes à droite, ses points devant. */
function SesChiffres({ buts, passes, pp }: { buts: number; passes: number; pp: number }) {
  return (
    <>
      <Filet n={buts} />
      <Bulle u={206} v={46} w={30} d={0.3}>
        <Pastille n={<Compte n={buts} d={0.3} />} quoi={pl(buts, "but", "buts")} />
      </Bulle>
      <Bulle u={232} v={132} w={22} d={0.38}>
        <Pastille n={<Compte n={passes} d={0.38} />} quoi={pl(passes, "passe", "passes")} />
      </Bulle>
      <Bulle u={166} v={200} d={0.5}>
        <Pastille clair n={<>+<Compte n={pp} d={0.5} /></>} quoi="points" />
      </Bulle>
    </>
  );
}

/** Des cartes en rang, de gauche à droite, centrées sur le milieu. */
function rang(noms: string[], v: number, ecart: number, taille: number, d0: number, moi?: string): Place[] {
  return noms.map((nom, i) => ({ nom, u: MILIEU + (i - (noms.length - 1) / 2) * ecart, v, taille, d: tour(i, d0), moi: nom === moi }));
}

/** Ton dimanche : ta carte à côté du but, tes buts au fond du filet, tes chiffres autour. */
export function RubriqueToi({ j, date, className }: { j: number; date: string; className?: string }) {
  const { player, me } = useMyPlayer();
  const { saison, evolution } = useSeason();
  const lignes = saison.entries.filter((e) => e.j === j && e.player === me);
  const joue = lignes.some((e) => e.statut === "Présent" && !e.extraTime);
  const delta = useMemo(() => {
    const avant = Math.max(0, ...saison.journees.map((m) => m.j).filter((x) => x < j && journeeJouee(saison, x)));
    if (!avant) return 0;
    // La règle du classement (rangs.ts), sur la saison des votes appliqués.
    const r1 = rangPepiteApres(saison, me, j, evolution);
    const r0 = rangPepiteApres(saison, me, avant, evolution);
    return r0 && r1 ? r0 - r1 : 0;
  }, [saison, j, me, evolution]);
  if (!joue || !player) return null;
  const buts = lignes.reduce((t, e) => t + e.buts, 0);
  const passes = lignes.reduce((t, e) => t + e.passes, 0);
  const pp = lignes.reduce((t, e) => t + entryPP(e), 0);
  return (
    <Scene
      className={className}
      sur={`J${j} · ${date}`}
      titre="Ton dimanche"
      places={[{ nom: me, ...A_COTE_DU_BUT, taille: T.vedette, d: 0.15, moi: true }]}
      jusqua={225}
      texte={delta > 0 ? `▲ ${delta} au Pépite d'Or` : delta < 0 ? `▼ ${-delta} au Pépite d'Or` : "Même place au Pépite d'Or"}
      partage={{ titre: "Mon dimanche", j, lignes: [{ n: me, v: `${buts} buts · ${passes} passes · +${pp} pts` }] }}
    >
      <SesChiffres buts={buts} passes={passes} pp={pp} />
    </Scene>
  );
}

/**
 * Ce qui se joue dimanche : chaque duel de points, deux cartes face à face,
 * l'écart entre elles. Un duel par rang, les rangs assez loin l'un de l'autre
 * pour que les cartes de devant ne cachent pas les noms du rang du fond.
 */
export function RubriqueEnjeux({ liste, moi }: { liste: Enjeu[]; moi: string }) {
  const duels = liste.slice(0, 3);
  const vs = [45, 180, 315];
  return (
    <Scene
      sur="Le Pépite d'Or"
      titre="Dimanche, ça peut basculer"
      jusqua={vs[duels.length - 1] + 45}
      places={duels.flatMap((d, i) => [
        { nom: d.haut.name, u: 60 + (i % 2) * 12, v: vs[i], taille: T.petite, d: tour(i * 2), moi: d.haut.name === moi, sous: `${d.haut.rank}e` },
        { nom: d.bas.name, u: 210 + (i % 2) * 12, v: vs[i], taille: T.petite, d: tour(i * 2 + 1), moi: d.bas.name === moi, sous: `${d.bas.rank}e` },
      ])}
      texte={duels.map((d) => `${d.haut.rank}e et ${d.bas.rank}e à ${d.ecart} ${pl(d.ecart, "pt", "pts")}`).join(" · ")}
    >
      {duels.map((d, i) => (
        <Bulle key={i} u={MILIEU + (i % 2) * 12} v={vs[i] + 22} d={0.35 + i * 0.12}>
          <Pastille petit n={d.ecart} quoi={pl(d.ecart, "point", "points")} clair={d.haut.name === moi || d.bas.name === moi} />
        </Bulle>
      ))}
    </Scene>
  );
}

/** Ton rival : lui devant le but, toi face à lui, l'écart posé entre vous ; celui qui te suit, derrière. */
export function RubriqueRival({ v }: { v: Voisins }) {
  const id = useIdentites();
  const ecart = v.devant ? v.devant.pp - v.moi.pp : 0;
  // Toi assez loin du but pour qu'il ne te tombe pas sur la tête ; seul en tête, loin devant un but vide.
  const places: Place[] = [
    { nom: v.moi.name, u: v.devant ? 190 : MILIEU, v: v.devant ? 172 : 215, taille: T.moyenne, d: 0.15, moi: true, sous: `${v.moi.rank}e` },
  ];
  if (v.devant) places.push({ nom: v.devant.name, u: 92, v: 52, taille: T.moyenne, d: 0.25, sous: `${v.devant.rank}e` });
  if (v.derriere) places.push({ nom: v.derriere.name, u: 50, v: 262, taille: T.petite, d: 0.4, sous: `${v.derriere.rank}e` });
  return (
    <Scene
      sur={`Toi · ${v.moi.rank}e au Pépite d'Or`}
      titre={v.devant ? `Ton rival : ${id.nom(v.devant.name)}` : "Personne devant toi"}
      places={places}
      jusqua={v.derriere ? 287 : 225}
      texte={v.derriere ? `${id.nom(v.derriere.name)} est à ${v.moi.pp - v.derriere.pp} derrière toi` : undefined}
    >
      {v.devant ? (
        <Bulle u={98} v={100} d={0.45}>
          <Pastille clair n={<Compte n={ecart} d={0.45} />} quoi={`${pl(ecart, "pt", "pts")} d'écart`} />
        </Bulle>
      ) : (
        <Bulle u={222} v={170} w={30} d={0.4}>
          <Pastille clair n="1er" quoi="Pépite d'Or" />
        </Bulle>
      )}
    </Scene>
  );
}

/**
 * Ce qu'il te faut dimanche : l'écart avec celui de devant, traduit en match
 * (une victoire vaut 2, un but ou une passe 1, saisie/engine.ts). Lui dans le
 * but, toi devant, et ce qu'il te faut posé devant toi : la victoire, puis
 * les buts ou passes qui restent, en une pastille. Le ballon file au fond
 * quand tu descends, dans le coin que le gardien ne couvre pas.
 */
export function RubriqueBesoin({ v }: { v: Voisins }) {
  const id = useIdentites();
  if (!v.devant) return null;
  const besoin = v.devant.pp - v.moi.pp + 1;
  const victoire = besoin >= 2;
  const reste = victoire ? besoin - 2 : besoin;
  const morceaux = [
    ...(victoire ? [{ n: "V", l: "gagner" }] : []),
    ...(reste > 0 ? [{ n: `+${reste}`, l: pl(reste, "but/passe", "buts/passes") }] : []),
  ];
  const us = morceaux.length > 1 ? [170, 246] : [196];
  return (
    <Scene
      sur={`${besoin} ${pl(besoin, "point", "points")} pour passer devant`}
      titre={`Ce qu'il te faut pour passer ${id.nom(v.devant.name)}`}
      places={[
        { nom: v.devant.name, u: MILIEU - 28, v: 46, taille: T.petite, d: 0.15 },
        { nom: v.moi.name, u: 54, v: 200, taille: T.moyenne, d: 0.2, moi: true },
      ]}
      jusqua={225}
    >
      <Ballon trajet={[[94, 196], [138, 110], [MILIEU + 18, LIGNE - 4]]} de={0.55} a={0.95} />
      {morceaux.map((m, i) => (
        <Bulle key={m.n} u={us[i]} v={150} d={0.3 + i * 0.07}>
          <Pastille petit n={m.n} quoi={m.l} clair={m.n === "V"} />
        </Bulle>
      ))}
    </Scene>
  );
}

/** Les rubriques d'un dimanche joué, posées sur le terrain. Bravo félicite leurs joueurs. */
export function RubriqueActu({ a }: { a: Actu }) {
  const id = useIdentites();
  const { saison } = useSeason();
  const sur = (quoi: string) => `J${a.j} · ${quoi}`;
  const liste = exploitsDe(a, saison.numero ?? 0, id.nom);
  const bravo = { action: <Bravo exploits={liste} />, exploits: liste.map((e) => e.cle) };
  switch (a.type) {
    case "mvp": {
      const m = a.mvp;
      return (
        <Scene
          {...bravo}
          sur={sur("l'homme du dimanche")}
          titre={id.nom(m.nom)}
          places={[{ nom: m.nom, ...A_COTE_DU_BUT, taille: T.vedette, d: 0.15 }]}
          jusqua={225}
          partage={{ titre: "L'homme du dimanche", j: a.j, lignes: [{ n: m.nom, v: `${m.buts} buts · ${m.passes} passes · +${m.pp} pts` }] }}
        >
          <SesChiffres buts={m.buts} passes={m.passes} pp={m.pp} />
        </Scene>
      );
    }
    case "chiffre": {
      const quoi = a.quoi === "buts" ? pl(a.n, "but", "buts") : pl(a.n, "passe", "passes");
      return (
        <Scene
          {...bravo}
          sur={sur("personne n'a fait mieux")}
          titre={`${a.n} ${quoi} pour ${id.nom(a.nom)}`}
          places={[{ nom: a.nom, u: A_COTE_DU_BUT.u, v: 105, taille: T.vedette, d: 0.15 }]}
          jusqua={200}
          partage={{ titre: `${a.n} ${a.quoi} en un dimanche`, j: a.j, lignes: [{ n: a.nom, v: `${a.n} ${a.quoi}` }] }}
        >
          {a.quoi === "buts" && <Filet n={a.n} d={0.4} />}
          <Bulle u={212} v={100} w={40} d={0.3}>
            <span className="block text-[84px] leading-[0.85] drop-shadow-[0_10px_24px_rgba(0,0,0,0.5)]" style={{ fontFamily: ANTON }}>
              <Compte n={a.n} d={0.3} />
            </span>
          </Bulle>
        </Scene>
      );
    }
    case "duo": {
      // Le passeur à gauche, le buteur à droite du but (pas devant : le filet
      // reste visible). La passe part devant le nom du passeur, arrive à
      // gauche de celui du buteur, et le tir file au fond.
      const passe: [number, number] = [52, 150];
      const tir: [number, number] = [204, 66];
      const trajet: [number, number][] = [[82, 166], [122, 130], [170, 80], [MILIEU + 4, LIGNE - 5]];
      return (
        <Scene
          {...bravo}
          sur={sur("le duo")}
          titre={`${id.nom(a.duo.passeur)} → ${id.nom(a.duo.buteur)}`}
          places={[
            { nom: a.duo.passeur, u: passe[0], v: passe[1], taille: T.moyenne, d: 0.15 },
            { nom: a.duo.buteur, u: tir[0], v: tir[1], taille: T.moyenne, d: 0.25 },
          ]}
          jusqua={205}
          texte="La même passe, le même buteur"
          partage={{ titre: "Le duo", j: a.j, lignes: [{ n: a.duo.passeur, v: "passeur" }, { n: a.duo.buteur, v: `buteur · ×${a.duo.n}` }] }}
        >
          <Craie points={trajet.slice(0, 3)} />
          <Craie points={[trajet[2], [MILIEU + 4, LIGNE - 4]]} d={0.5} />
          <Filet n={a.duo.n} d={0.85} />
          <Ballon trajet={trajet} de={0.4} a={0.9} />
          <Bulle u={196} v={176} d={0.45}>
            <Pastille clair n={<>×<Compte n={a.duo.n} d={0.45} /></>} quoi="ensemble" />
          </Bulle>
        </Scene>
      );
    }
    case "montent": {
      // Le gain au-dessus de chaque carte, nom compris ; le quatrième assez
      // près de l'œil pour que son gain ne touche pas le nom du premier.
      const liste = a.montent.slice(0, 4);
      const poses: [number, number][] = [[MILIEU, 52], [62, 140], [208, 140], [MILIEU, 232]];
      const taille = (i: number) => (i === 0 ? T.moyenne : T.petite);
      return (
        <Scene
          {...bravo}
          sur={sur("au Pépite d'Or")}
          titre={liste.length > 1 ? "Ils montent" : `${id.nom(liste[0].nom)} monte`}
          places={liste.map((m, i) => ({ nom: m.nom, u: poses[i][0], v: poses[i][1], taille: taille(i), d: tour(i), sous: `${m.rang}e`, coiffe: 4 + 26 }))}
          jusqua={liste.length > 3 ? 262 : liste.length > 1 ? 185 : 120}
          partage={{ titre: "Ils montent", j: a.j, lignes: a.montent.map((x) => ({ n: x.nom, v: `▲ ${x.gain} · ${x.rang}e` })) }}
        >
          {liste.map((m, i) => (
            <Bulle key={m.nom} u={poses[i][0]} v={poses[i][1]} haut={dessus(taille(i), 26)} d={0.32 + i * 0.07}>
              <span className="whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[15px] font-black text-black tabular-nums shadow-[0_6px_16px_rgba(0,0,0,0.4)]">
                ▲ {m.gain}
              </span>
            </Bulle>
          ))}
        </Scene>
      );
    }
    case "badge":
    case "badges": {
      // Un badge : en grand, à droite de la carte. Plusieurs : chacun au-dessus
      // de sa carte, nom compris, le plus haut palier d'abord ; au milieu du
      // rang du fond, il se tient en moyenne (il cache le but en entier). En
      // deux rangs au-delà de quatre, celui de devant assez près pour que ses
      // badges passent sous les noms du fond.
      const ds = a.type === "badge" ? [a.d] : [...a.ds.slice(0, 6)].sort((x, y) => y.palier - x.palier);
      const un = ds.length === 1;
      const lignes = ds.length > 4 ? [ds.slice(0, Math.ceil(ds.length / 2)), ds.slice(Math.ceil(ds.length / 2))] : [ds];
      const vs = lignes.length > 1 ? [40, 240] : [70];
      const poses = un
        ? [{ d: ds[0], p: { nom: ds[0].nom, u: MILIEU, v: 70, taille: T.vedette, d: 0.15 } as Place }]
        : lignes.flatMap((l, r) => {
            const milieu = r === 0 && l.length === 3;
            const ordre = milieu ? [l[1], l[0], l[2]] : l;
            return rang(ordre.map((d) => d.nom), vs[r], l.length > 3 ? 70 : l.length > 2 ? 86 : 104, T.petite, 0.15 + r * 0.2).map((p, i) => ({
              d: ordre[i],
              p: { ...p, taille: milieu && i === 1 ? T.moyenne : T.petite, coiffe: 4 + 40 },
            }));
          });
      const places = poses.map((x) => x.p);
      const premier = DEF[ds[0].id];
      const titre = un ? `${id.nom(ds[0].nom)} décroche ${premier.nom} ${NOM_METAL[metal(ds[0].palier)!].toLowerCase()}` : `${ds.length} badges décrochés`;
      return (
        <Scene
          {...bravo}
          sur={sur("ils ont décroché")}
          titre={titre}
          places={places}
          jusqua={lignes.length > 1 ? 270 : 125}
          texte={un ? undefined : ds.map((d) => `${id.nom(d.nom)} · ${DEF[d.id].nom} ${NOM_METAL[metal(d.palier)!].toLowerCase()}`).join(" · ")}
          partage={{ titre: "Ils ont décroché", j: a.j, lignes: ds.map((d) => ({ n: d.nom, v: `${DEF[d.id].nom} · ${NOM_METAL[metal(d.palier)!]}` })) }}
        >
          {poses.map(({ d, p }) =>
            un ? (
              <Bulle key={d.nom + d.id} u={p.u + 96} v={p.v} w={64} d={(p.d ?? 0.2) + 0.2}>
                <Badge3D badge={{ famille: "palier", id: d.id, palier: d.palier }} largeur={92} />
              </Bulle>
            ) : (
              <Bulle key={d.nom + d.id} u={p.u} v={p.v} haut={dessus(p.taille ?? T.petite, 40)} d={(p.d ?? 0.2) + 0.2}>
                <Badge3D badge={{ famille: "palier", id: d.id, palier: d.palier }} largeur={40} />
              </Bulle>
            ),
          )}
        </Scene>
      );
    }
    case "titres":
      return <RubriqueTitres a={a} bravo={bravo} />;
    case "podium-jour":
      return <RubriquePodium a={a} bravo={bravo} />;
    case "equipe": {
      // Deux rangs, le second assez près de l'œil pour que ses cartes passent
      // sous les noms du premier : aucune carte ne cache un nom. Le meilleur du
      // jour au milieu du fond, en moyenne : il cache le but en entier.
      const noms = a.equipe.slice(0, 7).map((e) => e.nom);
      const schema = ({ 3: [1, 2], 4: [1, 3], 5: [3, 2], 6: [3, 3], 7: [3, 4] } as Record<number, number[]>)[noms.length] ?? [noms.length];
      const fond = schema[0] === 3 ? [noms[1], noms[0], noms[2]] : noms.slice(0, schema[0]);
      const devant = noms.slice(schema[0]);
      const places = [
        ...rang(fond, 45, 90, T.petite, 0.15).map((p) => (p.nom === noms[0] ? { ...p, taille: T.moyenne } : p)),
        ...rang(devant, 190, devant.length > 3 ? 74 : devant.length > 2 ? 90 : 120, T.petite, 0.3),
      ];
      return (
        <Scene
          {...bravo}
          sur={sur("les meilleurs du jour")}
          titre="L'équipe type"
          places={places}
          jusqua={235}
          partage={{ titre: "L'équipe type", j: a.j, lignes: a.equipe.map((e) => ({ n: e.nom, v: `+${e.pp} pts` })) }}
        />
      );
    }
    default:
      return null;
  }
}

/* ------------------------------ Les cartes à titre ------------------------------ */

const NOM_TITRE: Record<BoostType, string> = { mvp: "MVP", impact: "Impact", def: "Défensive" };
/** Sur le coin de la carte : ses titres, en capitales courtes. */
const COIN_TITRE: Record<BoostType, string> = { mvp: "MVP", impact: "IMP", def: "DÉF" };

/** « Jouneid », « Jouneid et Zakary », « Abdel, Bilal et Faycal ». */
function enLigne(noms: string[]): string {
  return noms.length < 2 ? (noms[0] ?? "") : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

type Felicitable = { action: ReactNode; exploits: string[] };

/**
 * Les cartes d'un match (Sabri, 26/10 : que les cartes et la reconnaissance
 * des joueurs « soient mises à jour dans l'interface, pour que ce soit aussi
 * gratifiant ») : ses MVP, ses Joueurs Impact et ses Défensives, ex æquo
 * compris, chacun dans la couleur de son plus beau titre (or, rouge, bleu),
 * ses autres titres sur le coin. La hiérarchie des cartes : les MVP au fond,
 * au milieu du but, en moyenne ; les autres en petite. Seul, l'homme du
 * match se tient à côté du but, en grand. Sept cartes au plus sur le
 * terrain ; la ligne du bas les nomme tous.
 */
function RubriqueTitres({ a, bravo }: { a: Extract<Actu, { type: "titres" }>; bravo: Felicitable }) {
  const id = useIdentites();
  const t = a.titres;
  const avec = (type: BoostType) => t.filter((x) => x.types.includes(type)).map((x) => id.nom(x.nom));
  const mvp = avec("mvp");
  const lignes = (["mvp", "impact", "def"] as const)
    .map((type) => ({ type, noms: avec(type) }))
    .filter((l) => l.noms.length > 0);
  const titre = mvp.length
    ? `${enLigne(mvp.map((n) => n.split(" ")[0]))}, ${mvp.length > 1 ? "MVP ex æquo" : "MVP"}`
    : `${enLigne(lignes[0].noms.map((n) => n.split(" ")[0]))}, ${NOM_TITRE[lignes[0].type]}`;
  const texte = lignes.map((l) => `${NOM_TITRE[l.type]} : ${l.noms.join(", ")}${l.noms.length > 1 ? " (ex æquo)" : ""}`).join(" · ");
  const coin = (x: Titre) => x.types.map((y) => COIN_TITRE[y]).join("·");
  const sur = `J${a.j} · ${a.match}${a.score ? ` · ${a.score}` : ""}`;
  const partage = { titre: `Les cartes du ${a.match.toLowerCase()}`, j: a.j, lignes: t.map((x) => ({ n: x.nom, v: x.types.map((y) => NOM_TITRE[y]).join(" · ") })) };

  // Seul : l'homme du match à côté du but, en grand.
  if (t.length === 1) {
    const x = t[0];
    return (
      <Scene
        {...bravo}
        sur={sur}
        titre={titre}
        places={[{ nom: x.nom, ...A_COTE_DU_BUT, taille: T.vedette, d: 0.15, distinction: x.types[0], journee: a.j, titres: coin(x) }]}
        jusqua={200}
        texte={texte}
        partage={partage}
      >
        <Bulle u={212} v={104} w={34} d={0.32}>
          <Pastille clair n={NOM_TITRE[x.types[0]]} quoi={x.types[0] === "mvp" ? "homme du match" : "élu par ses adversaires"} />
        </Bulle>
      </Scene>
    );
  }

  // Le fond : les MVP (trois au plus), le premier au milieu du but ; devant, les autres.
  const visibles = t.slice(0, 7);
  const fondN = Math.min(3, Math.max(1, mvp.length, visibles.length - 4));
  const fond = visibles.slice(0, fondN);
  const devant = visibles.slice(fondN);
  const fondOrdre = fond.length === 3 ? [fond[1], fond[0], fond[2]] : fond;
  // Celui qui se tient au milieu du but le cache en entier : en moyenne, comme un MVP.
  const milieu = fond.length % 2 === 1 ? fondOrdre[(fond.length - 1) / 2] : null;
  const taille = (x: Titre) => (x.types[0] === "mvp" || x === milieu ? T.moyenne : T.petite);
  const places: Place[] = [
    ...rang(fondOrdre.map((x) => x.nom), devant.length ? 45 : 70, fond.length > 2 ? 92 : 112, T.petite, 0.15).map((p, i) => ({
      ...p,
      taille: taille(fondOrdre[i]),
      distinction: fondOrdre[i].types[0],
      journee: a.j,
      titres: coin(fondOrdre[i]),
    })),
    ...rang(devant.map((x) => x.nom), 190, devant.length > 3 ? 74 : devant.length > 2 ? 90 : 120, T.petite, 0.32).map((p, i) => ({
      ...p,
      distinction: devant[i].types[0],
      journee: a.j,
      titres: coin(devant[i]),
    })),
  ];
  return (
    <Scene {...bravo} sur={sur} titre={titre} places={places} jusqua={devant.length ? 235 : 130} texte={texte} partage={partage} />
  );
}

/**
 * Les meilleurs buteurs ou passeurs du jour, en podium : le premier au fond,
 * au milieu du but, en moyenne ; les suivants devant, en petite ; leur
 * chiffre au-dessus de leur carte, nom compris. Ex æquo à la même place.
 */
function RubriquePodium({ a, bravo }: { a: Extract<Actu, { type: "podium-jour" }>; bravo: Felicitable }) {
  const id = useIdentites();
  const m = a.marches.slice(0, 5);
  const unite = (n: number) => (a.quoi === "buts" ? pl(n, "but", "buts") : pl(n, "passe", "passes"));
  const premiers = m.filter((x) => x.place === 1);
  const fond = premiers.length > 3 ? premiers.slice(0, 3) : premiers;
  const devant = m.filter((x) => !fond.includes(x));
  const fondOrdre = fond.length === 3 ? [fond[1], fond[0], fond[2]] : fond;
  // Au-dessus de la carte, nom compris : le chiffre du premier en pastille, celui des autres en petit.
  const COIFFE_TETE = 4 + 52;
  const COIFFE = 4 + 24;
  const poses: { x: Marche; p: Place }[] = [
    ...rang(fondOrdre.map((x) => x.nom), 52, fond.length > 2 ? 92 : 112, T.moyenne, 0.15).map((p, i) => ({
      x: fondOrdre[i],
      p: { ...p, coiffe: COIFFE_TETE },
    })),
    ...rang(devant.map((x) => x.nom), 222, devant.length > 3 ? 70 : devant.length > 2 ? 86 : 120, T.petite, 0.3).map((p, i) => ({
      x: devant[i],
      p: { ...p, coiffe: COIFFE, sous: devant[i].place === 2 ? "2e" : "3e" },
    })),
  ];
  const quoi = a.quoi === "buts" ? "buteurs" : "passeurs";
  const titre = `${enLigne(premiers.map((x) => id.nom(x.nom).split(" ")[0]))}, ${premiers.length > 1 ? `meilleurs ${quoi}` : `meilleur ${quoi.slice(0, -1)}`}`;
  return (
    <Scene
      {...bravo}
      sur={`J${a.j} · les ${quoi} du jour`}
      titre={titre}
      places={poses.map((x) => x.p)}
      jusqua={devant.length ? 262 : 120}
      texte={a.marches.map((x) => `${x.place === 1 ? "1er" : `${x.place}e`} ${id.nom(x.nom)} · ${x.n}`).join(" · ")}
      partage={{ titre: `Les ${quoi} de la J${a.j}`, j: a.j, lignes: a.marches.map((x) => ({ n: x.nom, v: `${x.n} ${unite(x.n)}` })) }}
    >
      {poses.map(({ x, p }) =>
        x.place === 1 ? (
          <Bulle key={x.nom} u={p.u} v={p.v} haut={dessus(p.taille ?? T.petite, 52)} d={(p.d ?? 0.2) + 0.15}>
            <Pastille clair petit n={<Compte n={x.n} d={(p.d ?? 0.2) + 0.15} />} quoi={unite(x.n)} />
          </Bulle>
        ) : (
          <Bulle key={x.nom} u={p.u} v={p.v} haut={dessus(p.taille ?? T.petite, 24)} d={(p.d ?? 0.2) + 0.15}>
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-black/75 px-1.5 text-[13px] font-black text-white tabular-nums shadow-[0_6px_16px_rgba(0,0,0,0.4)]">
              {x.n}
            </span>
          </Bulle>
        ),
      )}
    </Scene>
  );
}
