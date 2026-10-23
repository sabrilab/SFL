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

import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge3D } from "@/components/sfl/badge-3d";
import { MiniCarte } from "@/components/sfl/mini-carte";
import { SolTerrain } from "@/components/sfl/matchs/sol-terrain";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import type { Actu } from "@/lib/sfl/actus";
import type { Enjeu, Voisins } from "@/lib/sfl/actus-toi";
import { rankPlayers } from "@/lib/sfl/engine";
import { exploitsDe } from "@/lib/sfl/exploits";
import { isHidden } from "@/lib/sfl/hidden";
import { computeStandings, entryPP } from "@/lib/sfl/saisie/engine";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { projeter, trace, vue } from "@/lib/sfl/terrain-vu";
import { metal, NOM_METAL, TROPHEES } from "@/lib/sfl/trophees";
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
}

const hauteur = (taille: number) => 254 * taille * PHI + 26;

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
          <div className="relative">
            <MiniCarte player={joueur} size={taille} vertical />
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

/** Ce qui flotte au-dessus du terrain en (u, v), à la hauteur w : un chiffre, un badge. */
export function Bulle({ u, v, w = 0, d = 0.4, children, className }: { u: number; v: number; w?: number; d?: number; children: ReactNode; className?: string }) {
  const { x, y, k } = projeter(u, v, w, VUE);
  return (
    <div className="absolute size-0" style={{ left: `calc(50% + ${x}px)`, top: y, zIndex: 600 }}>
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

/** Le ballon qui suit un trajet sur le terrain au défilement, de p = de à p = a. */
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
    el.style.opacity = p < de - 0.02 ? "0" : "1";
  });
  return (
    <span
      ref={ref}
      aria-hidden
      className="absolute top-0 left-1/2 block size-[10px] rounded-full bg-white shadow-[inset_-2px_-2px_0_rgba(0,0,0,0.25),0_4px_8px_rgba(0,0,0,0.4)]"
      style={{ zIndex: 650, transformOrigin: "0 0" }}
    />
  );
}

/** Le but du fond : les poteaux, la barre et le filet, en perspective. */
function But() {
  const [g, dr] = POTEAUX;
  const fond = LIGNE - 9;
  const mailles = Array.from({ length: 9 }, (_, i) => g + ((dr - g) * i) / 8);
  return (
    <svg aria-hidden className="absolute inset-0 size-full" overflow="visible" style={{ zIndex: 3 }}>
      <svg x="50%" overflow="visible">
        <path
          d={trace([[g, LIGNE, BARRE], [g, fond, BARRE - 4], [dr, fond, BARRE - 4], [dr, LIGNE, BARRE]], true, VUE)}
          fill="rgba(255,255,255,0.08)"
        />
        <path d={trace([[g, fond, 0], [g, fond, BARRE - 4], [dr, fond, BARRE - 4], [dr, fond, 0]], true, VUE)} fill="rgba(255,255,255,0.06)" />
        <g stroke="rgba(255,255,255,0.28)" strokeWidth={0.7} fill="none">
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

  // Le cadre épouse ce qu'il montre : du haut de la carte la plus haute (ou
  // de la barre du but) jusqu'à `jusqua`.
  const projetees = places.map((p) => ({ ...p, ...projeter(p.u, p.v, 0, VUE) }));
  const haut = Math.min(
    projeter(MILIEU, LIGNE, BARRE + 6, VUE).y,
    projeter(0, 0, 0, VUE).y,
    ...projetees.map((p) => p.y - hauteur(p.taille ?? T.petite) * p.k),
  );
  const bas = projeter(MILIEU, jusqua, 0, VUE).y;
  const naturelle = bas - haut + MARGE * 2;
  const s = Math.min(largeur / BASE, ECHELLE_MAX);

  return (
    <section
      ref={ref}
      data-exploits={exploits?.join("|")}
      className={cn(
        "relative flex flex-col overflow-hidden bg-[radial-gradient(120%_70%_at_50%_30%,#1d2024_0%,#0c0d0f_75%)] text-white md:rounded-3xl",
        className,
      )}
      style={{ ["--p" as string]: 0 } as CSSProperties}
    >
      <header className="relative z-10 flex flex-col gap-1 px-5 pt-5">
        <span className="pel-titre mono-label text-[10px] text-white/50" style={{ ["--d" as string]: 0 }}>
          {sur}
        </span>
        <h3 className="pel-titre titre-lettrage text-[24px] leading-[0.95]" style={{ ["--d" as string]: 0.06 }}>
          {titre}
        </h3>
      </header>
      <div ref={cadre} className="relative mt-auto w-full" style={{ height: largeur ? naturelle * s : naturelle }}>
        {largeur > 0 && (
          <Avancee.Provider value={ctx}>
            <div
              className="absolute top-0 origin-top-left"
              style={{ left: Math.max(0, Math.round((largeur - BASE * s) / 2)), width: BASE, height: naturelle, transform: `scale(${s})` }}
            >
              <div className="pel-camera absolute inset-0">
                <div className="absolute inset-x-0" style={{ top: MARGE - haut, height: bas + MARGE }}>
                  <SolTerrain ombres={projetees} rayon={26} vue={VUE} gazon="vert" />
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
      {(texte || partage || action) && (
        <div className="flex min-h-11 items-center gap-2 pr-1.5 pb-2 pl-5">
          <span className="min-w-0 flex-1 text-[13px] leading-snug text-white/70">{texte}</span>
          {action}
          {partage && (
            <button
              type="button"
              aria-label="Partager au Vestiaire"
              onClick={() => {
                preparerPiece({ type: "ligue", ...partage, lignes: partage.lignes.slice(0, 6) });
                router.push("/vestiaire");
              }}
              className="grid size-9 shrink-0 place-items-center rounded-full text-white/60 transition-transform active:scale-90"
            >
              <MessageCircle className="size-[18px]" strokeWidth={1.8} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Les rubriques ------------------------------ */

/** Le moment d'entrée de la i-ième carte. */
export const tour = (i: number, de = 0.18, pas = 0.07) => de + i * pas;

/** Des cartes en rang, de gauche à droite, centrées sur le milieu. */
function rang(noms: string[], v: number, ecart: number, taille: number, d0: number, moi?: string): Place[] {
  return noms.map((nom, i) => ({ nom, u: MILIEU + (i - (noms.length - 1) / 2) * ecart, v, taille, d: tour(i, d0), moi: nom === moi }));
}

/** Ton dimanche : ta carte au point de penalty, tes buts au fond du filet, tes chiffres autour. */
export function RubriqueToi({ j, date, className }: { j: number; date: string; className?: string }) {
  const { player, me } = useMyPlayer();
  const { saison } = useSeason();
  const lignes = saison.entries.filter((e) => e.j === j && e.player === me);
  const joue = lignes.some((e) => e.statut === "Présent" && !e.extraTime);
  const delta = useMemo(() => {
    const avant = Math.max(0, ...saison.journees.map((m) => m.j).filter((x) => x < j && journeeJouee(saison, x)));
    if (!avant) return 0;
    const rangDe = (s: typeof saison) => rankPlayers(computeStandings(s).filter((p) => !isHidden(p.name))).find((p) => p.name === me)?.rank;
    const r1 = rangDe({ ...saison, entries: saison.entries.filter((e) => e.j <= j) });
    const r0 = rangDe({ ...saison, entries: saison.entries.filter((e) => e.j <= avant) });
    return r0 && r1 ? r0 - r1 : 0;
  }, [saison, j, me]);
  if (!joue || !player) return null;
  const buts = lignes.reduce((t, e) => t + e.buts, 0);
  const passes = lignes.reduce((t, e) => t + e.passes, 0);
  const pp = lignes.reduce((t, e) => t + entryPP(e), 0);
  return (
    <Scene
      className={className}
      sur={`J${j} · ${date}`}
      titre="Ton dimanche"
      places={[{ nom: me, u: MILIEU, v: 100, taille: T.vedette, d: 0.15, moi: true }]}
      texte={delta > 0 ? `▲ ${delta} au Pépite d'Or` : delta < 0 ? `▼ ${-delta} au Pépite d'Or` : "Même place au Pépite d'Or"}
      partage={{ titre: "Mon dimanche", j, lignes: [{ n: me, v: `${buts} buts · ${passes} passes · +${pp} pts` }] }}
    >
      <Filet n={buts} />
      <Bulle u={44} v={110} w={34} d={0.3}>
        <Pastille n={<Compte n={buts} d={0.3} />} quoi={pl(buts, "but", "buts")} />
      </Bulle>
      <Bulle u={226} v={110} w={34} d={0.38}>
        <Pastille n={<Compte n={passes} d={0.38} />} quoi={pl(passes, "passe", "passes")} />
      </Bulle>
      <Bulle u={MILIEU} v={176} w={0} d={0.5}>
        <Pastille clair n={<>+<Compte n={pp} d={0.5} /></>} quoi="points" />
      </Bulle>
    </Scene>
  );
}

/** Ce qui se joue dimanche : chaque duel de points, deux cartes face à face, l'écart entre elles. */
export function RubriqueEnjeux({ liste, moi }: { liste: Enjeu[]; moi: string }) {
  const duels = liste.slice(0, 3);
  const vs = [52, 150, 248];
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
        <Bulle key={i} u={MILIEU + (i % 2) * 12} v={vs[i]} w={22} d={0.35 + i * 0.12}>
          <Pastille petit n={d.ecart} quoi={pl(d.ecart, "point", "points")} clair={d.haut.name === moi || d.bas.name === moi} />
        </Bulle>
      ))}
    </Scene>
  );
}

/** Ton rival : lui devant le but, toi face à lui, l'écart entre vous ; celui qui te suit, derrière. */
export function RubriqueRival({ v }: { v: Voisins }) {
  const id = useIdentites();
  const ecart = v.devant ? v.devant.pp - v.moi.pp : 0;
  const places: Place[] = [{ nom: v.moi.name, u: v.devant ? 178 : MILIEU, v: 165, taille: T.moyenne, d: 0.15, moi: true, sous: `${v.moi.rank}e` }];
  if (v.devant) places.push({ nom: v.devant.name, u: 92, v: 52, taille: T.moyenne, d: 0.25, sous: `${v.devant.rank}e` });
  if (v.derriere) places.push({ nom: v.derriere.name, u: 70, v: 250, taille: T.petite, d: 0.4, sous: `${v.derriere.rank}e` });
  return (
    <Scene
      sur={`Toi · ${v.moi.rank}e au Pépite d'Or`}
      titre={v.devant ? `Ton rival : ${id.nom(v.devant.name)}` : "Personne devant toi"}
      places={places}
      jusqua={v.derriere ? 275 : 225}
      texte={v.derriere ? `${id.nom(v.derriere.name)} est à ${v.moi.pp - v.derriere.pp} derrière toi` : undefined}
    >
      {v.devant ? (
        <Bulle u={222} v={30} w={34} d={0.45}>
          <Pastille clair n={<Compte n={ecart} d={0.45} />} quoi={`${pl(ecart, "pt", "pts")} d'écart`} />
        </Bulle>
      ) : (
        <Bulle u={MILIEU + 70} v={150} w={30} d={0.4}>
          <Pastille clair n="1er" quoi="Pépite d'Or" />
        </Bulle>
      )}
    </Scene>
  );
}

/**
 * Ce qu'il te faut dimanche : l'écart avec celui de devant, traduit en match
 * (une victoire vaut 2, un but ou une passe 1, saisie/engine.ts). Lui dans le
 * but, toi au point de penalty, et ce qu'il te faut posé entre vous ; le
 * ballon file au fond quand tu descends.
 */
export function RubriqueBesoin({ v }: { v: Voisins }) {
  const id = useIdentites();
  if (!v.devant) return null;
  const besoin = v.devant.pp - v.moi.pp + 1;
  const victoire = besoin >= 2;
  const reste = victoire ? besoin - 2 : besoin;
  const max = victoire ? 2 : 3;
  const morceaux = [...(victoire ? [{ n: "V", l: "gagner" }] : []), ...Array.from({ length: Math.min(reste, max) }, () => ({ n: "+1", l: "but/passe" }))];
  return (
    <Scene
      sur={`${besoin} ${pl(besoin, "point", "points")} pour passer devant`}
      titre={`Ce qu'il te faut pour passer ${id.nom(v.devant.name)}`}
      places={[
        { nom: v.devant.name, u: MILIEU, v: 26, taille: T.petite, d: 0.15 },
        { nom: v.moi.name, u: 62, v: 190, taille: T.moyenne, d: 0.2, moi: true },
      ]}
      jusqua={235}
      texte={reste > max ? `Et ${reste - max} de plus` : undefined}
    >
      <Ballon trajet={[[74, 186], [120, 110], [MILIEU + 10, LIGNE - 5]]} de={0.55} a={0.95} />
      {morceaux.map((m, i) => (
        <Bulle key={i} u={186 + (i - (morceaux.length - 1) / 2) * 62} v={165} w={4} d={0.3 + i * 0.07}>
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
          places={[{ nom: m.nom, u: MILIEU, v: 100, taille: T.vedette, d: 0.15 }]}
          jusqua={215}
          partage={{ titre: "L'homme du dimanche", j: a.j, lignes: [{ n: m.nom, v: `${m.buts} buts · ${m.passes} passes · +${m.pp} pts` }] }}
        >
          <Filet n={m.buts} />
          <Bulle u={44} v={110} w={34} d={0.3}>
            <Pastille n={<Compte n={m.buts} d={0.3} />} quoi={pl(m.buts, "but", "buts")} />
          </Bulle>
          <Bulle u={226} v={110} w={34} d={0.38}>
            <Pastille n={<Compte n={m.passes} d={0.38} />} quoi={pl(m.passes, "passe", "passes")} />
          </Bulle>
          <Bulle u={MILIEU} v={176} w={0} d={0.5}>
            <Pastille clair n={<>+<Compte n={m.pp} d={0.5} /></>} quoi="points" />
          </Bulle>
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
          places={[{ nom: a.nom, u: MILIEU - 40, v: 105, taille: T.vedette, d: 0.15 }]}
          jusqua={200}
          partage={{ titre: `${a.n} ${a.quoi} en un dimanche`, j: a.j, lignes: [{ n: a.nom, v: `${a.n} ${a.quoi}` }] }}
        >
          {a.quoi === "buts" && <Filet n={a.n} d={0.4} />}
          <Bulle u={MILIEU + 72} v={100} w={40} d={0.3}>
            <span className="block text-[84px] leading-[0.85] drop-shadow-[0_10px_24px_rgba(0,0,0,0.5)]" style={{ fontFamily: ANTON }}>
              <Compte n={a.n} d={0.3} />
            </span>
          </Bulle>
        </Scene>
      );
    }
    case "duo": {
      const passe: [number, number] = [52, 150];
      const tir: [number, number] = [172, 72];
      return (
        <Scene
          {...bravo}
          sur={sur("le duo")}
          titre={`${id.nom(a.duo.passeur)} → ${id.nom(a.duo.buteur)}`}
          places={[
            { nom: a.duo.passeur, u: passe[0], v: passe[1], taille: T.moyenne, d: 0.15, sous: "passeur" },
            { nom: a.duo.buteur, u: tir[0], v: tir[1], taille: T.moyenne, d: 0.25, sous: "buteur" },
          ]}
          jusqua={205}
          texte="La même passe, le même buteur"
          partage={{ titre: "Le duo", j: a.j, lignes: [{ n: a.duo.passeur, v: "passeur" }, { n: a.duo.buteur, v: `buteur · ×${a.duo.n}` }] }}
        >
          <Craie points={[[passe[0] + 14, passe[1] - 4], [110, 128], [tir[0] - 16, tir[1] + 6]]} />
          <Craie points={[[tir[0] - 10, tir[1] - 6], [MILIEU + 4, LIGNE - 4]]} d={0.5} />
          <Filet n={a.duo.n} d={0.85} />
          <Ballon trajet={[[passe[0] + 14, passe[1] - 4], [110, 128], [tir[0] - 16, tir[1] + 6], [MILIEU + 4, LIGNE - 5]]} de={0.4} a={0.9} />
          <Bulle u={98} v={96} w={30} d={0.45}>
            <Pastille clair n={<>×<Compte n={a.duo.n} d={0.45} /></>} quoi="ensemble" />
          </Bulle>
        </Scene>
      );
    }
    case "montent": {
      const liste = a.montent.slice(0, 4);
      const poses: [number, number][] = [[MILIEU, 60], [70, 140], [200, 140], [MILIEU, 215]];
      return (
        <Scene
          {...bravo}
          sur={sur("au Pépite d'Or")}
          titre={liste.length > 1 ? "Ils montent" : `${id.nom(liste[0].nom)} monte`}
          places={liste.map((m, i) => ({ nom: m.nom, u: poses[i][0], v: poses[i][1], taille: i === 0 ? T.moyenne : T.petite, d: tour(i), sous: `${m.rang}e` }))}
          jusqua={liste.length > 3 ? 250 : liste.length > 1 ? 180 : 120}
          partage={{ titre: "Ils montent", j: a.j, lignes: a.montent.map((x) => ({ n: x.nom, v: `▲ ${x.gain} · ${x.rang}e` })) }}
        >
          {liste.map((m, i) => (
            <Bulle key={m.nom} u={poses[i][0]} v={poses[i][1]} w={(254 * (i === 0 ? T.moyenne : T.petite) * PHI) / VUE.sin + 12} d={0.32 + i * 0.07}>
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
      const ds = a.type === "badge" ? [a.d] : a.ds.slice(0, 6);
      const un = ds.length === 1;
      const lignes = ds.length > 4 ? [ds.slice(0, Math.ceil(ds.length / 2)), ds.slice(Math.ceil(ds.length / 2))] : [ds];
      const places = lignes.flatMap((l, r) => rang(l.map((d) => d.nom), 70 + r * 135, l.length > 3 ? 62 : l.length > 2 ? 80 : 104, un ? T.vedette : T.petite, 0.15 + r * 0.2));
      const premier = DEF[ds[0].id];
      const titre = un ? `${id.nom(ds[0].nom)} décroche ${premier.nom} ${NOM_METAL[metal(ds[0].palier)!].toLowerCase()}` : `${ds.length} badges décrochés`;
      return (
        <Scene
          {...bravo}
          sur={sur("ils ont décroché")}
          titre={titre}
          places={places}
          jusqua={lignes.length > 1 ? 240 : 125}
          texte={un ? undefined : ds.map((d) => `${id.nom(d.nom)} · ${DEF[d.id].nom} ${NOM_METAL[metal(d.palier)!].toLowerCase()}`).join(" · ")}
          partage={{ titre: "Ils ont décroché", j: a.j, lignes: ds.map((d) => ({ n: d.nom, v: `${DEF[d.id].nom} · ${NOM_METAL[metal(d.palier)!]}` })) }}
        >
          {ds.map((d, i) => {
            const p = places[i];
            // Au-dessus de la carte : sa hauteur à l'écran, ramenée en hauteur de terrain.
            const w = (254 * p.taille! * PHI) / VUE.sin + 14;
            return (
              <Bulle key={d.nom + d.id} u={p.u + (un ? 62 : 0)} v={p.v} w={un ? 70 : w} d={(p.d ?? 0.2) + 0.2}>
                <Badge3D badge={{ famille: "palier", id: d.id, palier: d.palier }} largeur={un ? 92 : 40} />
              </Bulle>
            );
          })}
        </Scene>
      );
    }
    case "equipe": {
      const noms = a.equipe.slice(0, 7).map((e) => e.nom);
      const schema = ({ 3: [1, 2], 4: [2, 2], 5: [2, 1, 2], 6: [3, 3], 7: [3, 1, 3] } as Record<number, number[]>)[noms.length] ?? [noms.length];
      const places = schema.flatMap((n, r) => {
        const debut = schema.slice(0, r).reduce((t, x) => t + x, 0);
        const l = noms.slice(debut, debut + n);
        return rang(l, 55 + r * 95, n > 2 ? 82 : 110, T.petite, 0.15 + r * 0.15);
      });
      return (
        <Scene
          {...bravo}
          sur={sur("les meilleurs du jour")}
          titre="L'équipe type"
          places={places}
          jusqua={45 + schema.length * 95}
          partage={{ titre: "L'équipe type", j: a.j, lignes: a.equipe.map((e) => ({ n: e.nom, v: `+${e.pp} pts` })) }}
        />
      );
    }
    default:
      return null;
  }
}
