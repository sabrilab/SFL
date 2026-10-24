"use client";

// La règle de l'accueil : un nombre qu'on règle en faisant glisser une règle
// graduée sous une aiguille (la taille, le poids, la pointure, accueil.tsx).
// Le nombre, en grand, suit le doigt. Comme la roue (roue.tsx), le
// défilement est celui du navigateur, calé sur chaque cran (accueil.css) ;
// − et + règlent au cran près, les flèches du clavier aussi, et sur un
// ordinateur on la tire à la souris.

import { useEffect, useLayoutEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** L'écart entre deux crans, en px. */
const CRAN = 10;

const virgule = (v: number) => String(v).replace(".", ",");

export function Regle({
  label,
  unite,
  min,
  max,
  pas = 1,
  majeur = 10,
  moyen = 5,
  valeur,
  onChange,
  compact = false,
}: {
  label: string;
  unite: string;
  min: number;
  max: number;
  pas?: number;
  /** Tous les combien un grand cran, avec son nombre. */
  majeur?: number;
  /** Tous les combien un cran moyen. */
  moyen?: number;
  valeur: number;
  onChange: (v: number) => void;
  /** Un écran bas : le nombre et la règle se resserrent. */
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const crans = Math.round((max - min) / pas) + 1;
  const indice = (v: number) => Math.round((v - min) / pas);
  const depart = useRef(indice(valeur));
  const courant = useRef(valeur);
  const image = useRef(0);
  const tire = useRef<{ x: number; gauche: number } | null>(null);
  /** Le cran que vise un défilement lancé par le code : rien n'est lu avant d'y être. */
  const cible = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollLeft = depart.current * CRAN;
  }, []);

  // Réglé d'ailleurs (− et +, le clavier) : la règle suit.
  useEffect(() => {
    courant.current = valeur;
    const el = ref.current;
    const i = Math.round((valeur - min) / pas);
    if (el && Math.round(el.scrollLeft / CRAN) !== i) {
      cible.current = i;
      el.scrollTo({ left: i * CRAN, behavior: "smooth" });
    }
  }, [valeur, min, pas]);

  useEffect(() => () => cancelAnimationFrame(image.current), []);

  function lire() {
    cancelAnimationFrame(image.current);
    image.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(crans - 1, Math.round(el.scrollLeft / CRAN)));
      if (cible.current !== null) {
        if (i === cible.current) cible.current = null;
        return;
      }
      const v = Math.round((min + i * pas) * 10) / 10;
      if (v === courant.current) return;
      courant.current = v;
      navigator.vibrate?.(2);
      onChange(v);
    });
  }

  const regler = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 10) / 10)));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-[13px]">
        <button
          type="button"
          onClick={() => regler(valeur - pas)}
          aria-label={`${label} : moins`}
          className="bouton-secondaire grid size-[34px] shrink-0 place-items-center"
        >
          <Minus className="size-4" />
        </button>
        <div className="flex min-w-0 flex-col items-center">
          <span className="mono-label text-white/45">{label}</span>
          <span className={cn("flex items-baseline gap-[5px]", compact ? "mt-[2px]" : "mt-[3px]")}>
            <span
              className={cn("font-display leading-none tracking-wide text-white tabular-nums", compact ? "text-[32px]" : "text-[44px]")}
            >
              {virgule(valeur)}
            </span>
            <span className="mono-label text-white/45">{unite}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => regler(valeur + pas)}
          aria-label={`${label} : plus`}
          className="bouton-secondaire grid size-[34px] shrink-0 place-items-center"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className={cn("relative", compact ? "mt-[5px]" : "mt-[8px]")}>
        {/* L'aiguille, au milieu. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-0 left-1/2 z-10 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.45)]",
            compact ? "h-[23px]" : "h-[30px]"
          )}
        />
        <div
          ref={ref}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={valeur}
          aria-valuetext={`${virgule(valeur)} ${unite}`}
          onScroll={lire}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              regler(valeur - pas);
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              regler(valeur + pas);
            }
          }}
          onWheel={() => (cible.current = null)}
          onPointerDown={(e) => {
            // Le doigt reprend la main sur un défilement lancé par le code.
            cible.current = null;
            // À la souris, on tire la règle ; au doigt, le navigateur s'en charge.
            if (e.pointerType !== "mouse" || !ref.current) return;
            tire.current = { x: e.clientX, gauche: ref.current.scrollLeft };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!tire.current || !ref.current) return;
            ref.current.scrollLeft = tire.current.gauche - (e.clientX - tire.current.x);
          }}
          onPointerUp={() => {
            if (!tire.current || !ref.current) return;
            tire.current = null;
            const i = Math.round(ref.current.scrollLeft / CRAN);
            ref.current.scrollTo({ left: i * CRAN, behavior: "smooth" });
          }}
          className={cn(
            "accueil-regle flex overflow-x-scroll overscroll-x-contain rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-white/50",
            compact ? "h-[40px]" : "h-[55px]"
          )}
        >
          {/* Des cales plutôt qu'un padding, que Safari oublie au bout d'un défilement : le premier et le dernier cran viennent sous l'aiguille. */}
          <span aria-hidden className="shrink-0" style={{ width: `calc(50% - ${CRAN / 2}px)` }} />
          {Array.from({ length: crans }, (_, i) => {
            const v = Math.round((min + i * pas) * 10) / 10;
            const grand = Math.abs(v / majeur - Math.round(v / majeur)) < 1e-6;
            const milieu = !grand && Math.abs(v / moyen - Math.round(v / moyen)) < 1e-6;
            return (
              <span key={i} className="accueil-regle__cran relative flex h-full shrink-0 justify-center" style={{ width: CRAN }}>
                <span
                  className={cn(
                    "w-[1.5px] rounded-full",
                    grand ? "bg-white/70" : milieu ? "bg-white/40" : "bg-white/25",
                    compact ? (grand ? "h-[20px]" : milieu ? "h-[13px]" : "h-[8px]") : grand ? "h-[26px]" : milieu ? "h-[18px]" : "h-[11px]"
                  )}
                />
                {grand && (
                  <span
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 font-mono font-semibold text-white/45 tabular-nums",
                      compact ? "top-[24px] text-[9px]" : "top-[32px] text-[10px]"
                    )}
                  >
                    {virgule(v)}
                  </span>
                )}
              </span>
            );
          })}
          <span aria-hidden className="shrink-0" style={{ width: `calc(50% - ${CRAN / 2}px)` }} />
        </div>
      </div>
    </div>
  );
}
