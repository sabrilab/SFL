"use client";

// L'insigne du rang et le viseur de la DA « Lune » (actus/lune.css) : le
// symbole Bola, le croissant, la lettre du rang dans la balle ; le viseur
// devient l'orbite de la balle autour de la carte. Les couleurs viennent du
// rang (fiche--S, --A, --B : actus/missions.css).

import { useId } from "react";
import type { EtatViseur } from "@/components/sfl/actus/missions";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import type { Rang } from "@/lib/sfl/missions";
import { cn } from "@/lib/utils";

const f = (n: number) => Math.round(n * 100) / 100;

// Le symbole dans sa boîte de 112,373 (finitions-carte.ts, dos-carte.tsx) : le disque
// est centré en (73,186 ; 159,672), la balle en (86,45 ; 181,133), de rayon 34,725.
const S_LUNE = 84 / 112.373;
const LUNE = {
  transform: `translate(${f(50 - 73.186 * S_LUNE)} ${f(50 - 159.672 * S_LUNE)}) scale(${f(S_LUNE)})`,
  balle: {
    x: f(50 + (86.45 - 73.186) * S_LUNE),
    y: f(50 + (181.133 - 159.672) * S_LUNE),
  },
};

export function InsigneLune({ rang }: { rang: Rang }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className="insigne-lune" aria-hidden>
      <svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0" style={{ stopColor: "rgb(var(--r-feu))" }} />
            <stop offset="0.55" style={{ stopColor: "rgb(var(--r-lueur))" }} />
            <stop offset="1" style={{ stopColor: "var(--r-sombre)" }} />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="rgb(var(--r-lueur) / 0.35)"
          strokeWidth="0.8"
          strokeDasharray="1 3"
        />
        <path
          d={LOGO_BOLA.symbole}
          transform={LUNE.transform}
          fill={`url(#${id}g)`}
        />
        <text
          x={LUNE.balle.x}
          y={LUNE.balle.y}
          dy="0.36em"
          textAnchor="middle"
          className="insigne-lune__lettre"
        >
          {rang}
        </text>
      </svg>
    </span>
  );
}

export function ViseurLune({
  etat,
  petit,
}: {
  etat: EtatViseur;
  petit?: boolean;
}) {
  const classes = cn(
    "fiche__viseur",
    `fiche__viseur--${etat}`,
    petit && "fiche__viseur--petit",
    "viseur-lune",
  );
  return (
    <span key={etat} className={classes} aria-hidden>
      <i className="v-orbite" />
      <i className="v-balle" />
    </span>
  );
}
