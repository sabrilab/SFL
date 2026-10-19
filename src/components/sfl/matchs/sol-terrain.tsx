"use client";

// Le sol du terrain vu en perspective (lib/sfl/terrain-vu.ts) : le terrain
// couché, son épaisseur, ses bandes, son tracé à la craie, et l'ombre de
// chaque carte posée dessus. Partagé par la feuille de match (Map) et les
// terrains de la Ligue (carte-journee.tsx).

import { useId } from "react";
import { arc, projeter, rectArrondi, trace, vue as vueParDefaut, type Vue } from "@/lib/sfl/terrain-vu";

const DEFAUT = vueParDefaut();

/** Une carte posée : sa place sur le terrain (u, v) et sa projection. */
export interface Ombre {
  u: number;
  v: number;
  x: number;
  y: number;
  k: number;
}

export function SolTerrain({
  ombres,
  rayon = 22,
  vue = DEFAUT,
  gazon = "nuit",
}: {
  ombres: Ombre[];
  /** Demi-largeur de l'ombre, à l'échelle 1. */
  rayon?: number;
  /** Le point de vue (terrain-vu.ts) ; celui de la feuille de match par défaut. */
  vue?: Vue;
  /**
   * Le gazon : « nuit » (la feuille de match) ou « vert », un vert translucide
   * qui s'efface en dégradé vers les bords du cadre (les terrains de la Ligue ;
   * Sabri, 19/10 : « bien vert, avec le petit dégradé en bord de carte, pas
   * trop opaque »).
   */
  gazon?: "nuit" | "vert";
}) {
  const vert = gazon === "vert";
  const id = useId().replace(/:/g, "");
  const { l, h } = vue;
  const t = (points: [number, number, number?][], ferme = false) => trace(points, ferme, vue);
  const but = (v: number, sens: 1 | -1): [number, number][] => [
    [82, v],
    [82, v + sens * 5.4],
    ...arc(135, v + sens * 5.4, 53, 180, sens === 1 ? 0 : 360),
    [188, v],
  ];
  return (
    <svg
      aria-hidden
      className="absolute inset-0 size-full"
      overflow="visible"
      style={
        vert
          ? {
              maskImage: "radial-gradient(75% 70% at 50% 50%, #000 62%, transparent 100%)",
              WebkitMaskImage: "radial-gradient(75% 70% at 50% 50%, #000 62%, transparent 100%)",
            }
          : undefined
      }
    >
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={vert ? "#1e7a3e" : "#17191d"} stopOpacity={vert ? 0.62 : 1} />
          <stop offset="1" stopColor={vert ? "#36a157" : "#24272c"} stopOpacity={vert ? 0.72 : 1} />
        </linearGradient>
        <radialGradient id={`${id}o`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}c`}>
          <path d={t(rectArrondi(0, 0, l, h, 10), true)} />
        </clipPath>
      </defs>
      <svg x="50%" overflow="visible">
        {/* L'épaisseur du terrain, sous le bord avant. */}
        <path
          d={t([[4, h], [l - 4, h], [l - 4, h, -14], [4, h, -14]], true)}
          fill={vert ? "#0f3d1f" : "#08090b"}
          fillOpacity={vert ? 0.8 : 1}
        />
        <path d={t(rectArrondi(0, 0, l, h, 10), true)} fill={`url(#${id}f)`} />
        <g clipPath={`url(#${id}c)`} fill={vert ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)"}>
          {Array.from({ length: Math.ceil(h / 100) }, (_, i) => (
            <path
              key={i}
              d={t([[0, i * 100], [l, i * 100], [l, i * 100 + 50], [0, i * 100 + 50]], true)}
            />
          ))}
        </g>
        <g
          fill="none"
          stroke={vert ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.55)"}
          strokeWidth={1.7}
          strokeLinejoin="round"
        >
          <path d={t(rectArrondi(11, 11, l - 11, h - 11, 4), true)} />
          <path d={t([[11, h / 2], [l - 11, h / 2]])} />
          <path d={t(but(11, 1))} />
          <path d={t(but(h - 11, -1))} />
          <path d={t(arc(l / 2, h / 2, 43.5, 0, 360, 40), true)} />
        </g>
        {ombres.map(({ u, v, x, y, k }, i) => (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx={rayon * k}
            ry={(projeter(u, v + 9, 0, vue).y - projeter(u, v - 9, 0, vue).y) / 2}
            fill={`url(#${id}o)`}
          />
        ))}
      </svg>
    </svg>
  );
}
