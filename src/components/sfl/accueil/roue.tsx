"use client";

// La roue de l'accueil : une colonne qui tourne sous le doigt et se cale sur
// une valeur, comme celles de l'iPhone (la date de naissance, accueil.tsx).
// Le défilement est celui du navigateur, élan compris, calé par scroll-snap
// (accueil.css) ; la valeur au centre est lue pendant qu'elle tourne. Une
// valeur touchée vient au centre ; au clavier, les flèches.

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** La hauteur d'une ligne ; la roue en montre cinq. */
const LIGNE = 40;
const VISIBLES = 5;

export function Roue({
  options,
  index,
  onChange,
  label,
  className,
}: {
  options: string[];
  index: number;
  onChange: (i: number) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const depart = useRef(index);
  const courant = useRef(index);
  const image = useRef(0);
  /** La ligne que vise un défilement lancé par le code : rien n'est lu avant d'y être. */
  const cible = useRef<number | null>(null);

  // À l'ouverture, la roue est déjà sur sa valeur, sans tourner.
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = depart.current * LIGNE;
  }, []);

  // La valeur change d'ailleurs (le 31 d'un mois de 30 jours) : la roue suit.
  useEffect(() => {
    courant.current = index;
    const el = ref.current;
    if (el && Math.round(el.scrollTop / LIGNE) !== index) {
      cible.current = index;
      el.scrollTo({ top: index * LIGNE, behavior: "smooth" });
    }
  }, [index]);

  useEffect(() => () => cancelAnimationFrame(image.current), []);

  function lire() {
    cancelAnimationFrame(image.current);
    image.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(options.length - 1, Math.round(el.scrollTop / LIGNE)));
      if (cible.current !== null) {
        if (i === cible.current) cible.current = null;
        return;
      }
      if (i === courant.current) return;
      courant.current = i;
      navigator.vibrate?.(3);
      onChange(i);
    });
  }

  const aller = (i: number) =>
    ref.current?.scrollTo({ top: Math.max(0, Math.min(options.length - 1, i)) * LIGNE, behavior: "smooth" });

  return (
    <div className={cn("relative", className)} style={{ height: LIGNE * VISIBLES }}>
      {/* La bande de la valeur choisie, au centre. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-[13px] bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        style={{ height: LIGNE }}
      />
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        aria-activedescendant={`${id}-${index}`}
        tabIndex={0}
        onScroll={lire}
        // Le doigt reprend la main sur un défilement lancé par le code.
        onPointerDown={() => (cible.current = null)}
        onWheel={() => (cible.current = null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            aller(index + 1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            aller(index - 1);
          }
        }}
        className="accueil-roue relative h-full overflow-y-scroll overscroll-contain rounded-[13px] outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <div aria-hidden style={{ height: LIGNE * 2 }} />
        {options.map((o, i) => (
          <div
            key={i}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === index}
            onClick={() => aller(i)}
            className={cn(
              "accueil-roue__ligne grid cursor-pointer place-items-center text-[19px] font-semibold tabular-nums transition-colors duration-150 select-none",
              i === index ? "text-white" : "text-white/40"
            )}
            style={{ height: LIGNE }}
          >
            {o}
          </div>
        ))}
        <div aria-hidden style={{ height: LIGNE * 2 }} />
      </div>
    </div>
  );
}
