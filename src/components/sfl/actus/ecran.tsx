"use client";

// L'écran d'une publication des Actus : l'image du fil, au format 4:5 des
// réseaux sociaux, où se joue une cinématique (cinematiques.tsx). Elle se
// lance quand l'image est aux trois cinquièmes à l'écran, rejoue à chaque
// retour et au toucher, comme une vidéo du fil ; la barre fine en bas avance
// pendant la scène. Les classes et images clés sont dans actus.css.
//
// Les outils des scènes sont ici :
//   · t(s, du)  : le moment d'entrée et la durée d'un élément ;
//   · Compte    : un nombre qui défile jusqu'au sien ;
//   · Rouleau   : un nombre en colonnes de chiffres, comme un tableau d'affichage ;
//   · Lettres   : un mot qui tombe lettre à lettre.
// « Réduire les animations » : tout s'affiche dans sa pose finale.

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "./actus.css";
import { cn } from "@/lib/utils";

export const ANTON = "var(--font-anton), Anton, sans-serif";

/** Le moment d'entrée d'un élément (en secondes) et sa durée. */
export function t(s: number, du?: number, plus?: CSSProperties): CSSProperties {
  return { ["--t" as string]: `${s}s`, ...(du != null ? { ["--du" as string]: `${du}s` } : {}), ...plus };
}

/** Le tour de lecture : 0 tant que la scène n'a pas été vue. */
const Tour = createContext(0);

function calme() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Ecran({
  duree,
  children,
  fond,
  ratio = 4 / 5,
  className,
}: {
  /** La durée de la scène, en secondes : celle de la barre de lecture. */
  duree: number;
  children: ReactNode;
  fond?: string;
  /** Largeur ÷ hauteur. */
  ratio?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tour, setTour] = useState(0);
  // La scène n'est construite qu'à l'approche : le fil peut être long.
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = false;
    const proche = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setMonte(true);
      },
      { rootMargin: "600px 0px" }
    );
    const vue = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !visible) setTour((n) => n + 1);
        visible = e.isIntersecting;
      },
      { threshold: 0.6 }
    );
    proche.observe(el);
    vue.observe(el);
    return () => {
      proche.disconnect();
      vue.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn("actu-ecran relative isolate w-full overflow-hidden text-white select-none", className)}
      data-joue={tour > 0 ? "" : undefined}
      style={{
        aspectRatio: ratio,
        background:
          fond ??
          "radial-gradient(110% 70% at 50% 0%, rgba(255,255,255,0.13) 0%, transparent 62%), linear-gradient(180deg, #17181d 0%, #0b0c0f 62%, #050506 100%)",
      }}
      onClick={() => setTour((n) => n + 1)}
    >
      {monte && (
        <Tour.Provider value={tour}>
          <div key={tour} className="actu-scene absolute inset-0">
            {children}
          </div>
          <span
            key={`b${tour}`}
            aria-hidden
            className="actu-barre absolute inset-x-0 bottom-0 z-20 h-[2px] bg-white/70"
            style={{ ["--duree" as string]: `${duree}s` }}
          />
        </Tour.Provider>
      )}
    </div>
  );
}

/** Une scène hors du fil (les stories) : elle joue dès qu'elle est montée. */
export function Lecture({ children }: { children: ReactNode }) {
  return <Tour.Provider value={1}>{children}</Tour.Provider>;
}

/** Un nombre qui défile de `de` jusqu'à `n`, à partir de l'instant `a` (s), pendant `du` (s). */
export function useCompte(n: number, a: number, du = 1, de = 0): number {
  const tour = useContext(Tour);
  const [v, setV] = useState(de);
  useEffect(() => {
    if (tour === 0) return;
    if (calme()) {
      // Pas d'animation : le nombre final, tout de suite (dans un rappel, pas dans le corps de l'effet).
      const id = requestAnimationFrame(() => setV(n));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const debut = performance.now() + a * 1000;
    const pas = (now: number) => {
      const x = Math.min(1, Math.max(0, (now - debut) / (du * 1000)));
      const e = 1 - Math.pow(1 - x, 3);
      setV(Math.round(de + (n - de) * e));
      if (x < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [tour, n, a, du, de]);
  return v;
}

export function Compte({ n, a, du, de, prefixe = "" }: { n: number; a: number; du?: number; de?: number; prefixe?: string }) {
  const v = useCompte(n, a, du, de);
  return (
    <span className="tabular-nums">
      {prefixe}
      {v}
    </span>
  );
}

/**
 * Un nombre en rouleaux : chaque chiffre est une colonne 0–9 qui tourne et
 * s'arrête sur le sien. `de` : le nombre d'où partent les colonnes.
 */
export function Rouleau({ n, de = 0, a, du = 1.4, className, style }: { n: number; de?: number; a: number; du?: number; className?: string; style?: CSSProperties }) {
  const cible = String(Math.max(0, n));
  const depart = String(Math.max(0, de)).padStart(cible.length, "0").slice(-cible.length);
  return (
    <span className={cn("inline-flex leading-none tabular-nums", className)} style={style} aria-label={cible}>
      {cible.split("").map((c, i) => {
        const d = Number(c);
        // La colonne part du premier tour (le chiffre de départ) et s'arrête au second : au moins un tour complet.
        const de0 = de === 0 ? 0 : Number(depart[i]);
        return (
          <span key={i} aria-hidden className="relative inline-block overflow-hidden" style={{ height: "1em", width: "0.62em" }}>
            <span
              className="a-rouleau absolute inset-x-0 top-0 flex flex-col items-center"
              style={{ ...t(a + i * 0.12, du), transform: `translateY(${-(d + 10)}em)`, ["--de" as string]: de0 }}
            >
              {[...Array(20)].map((_, k) => (
                <span key={k} style={{ height: "1em", lineHeight: "1em" }}>
                  {k % 10}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Un mot qui tombe lettre à lettre (classe `anim`, à partir de `a`, une lettre tous les `pas`). */
export function Lettres({ texte, a, pas = 0.045, anim = "a-claque", du = 0.5 }: { texte: string; a: number; pas?: number; anim?: string; du?: number }) {
  return (
    <span aria-label={texte}>
      {Array.from(texte).map((c, i) => (
        <span key={i} aria-hidden className={cn("inline-block whitespace-pre", anim)} style={t(a + i * pas, du)}>
          {c}
        </span>
      ))}
    </span>
  );
}
