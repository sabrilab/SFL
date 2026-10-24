// Les pictogrammes du ciel de l'aperçu météo (meteo-match.tsx), gravés comme
// la carte : un trait d'encre, et des hachures fines là où une gravure
// ombrerait (le disque du soleil, le ventre du nuage). Encre seule
// (currentColor). Dessin sur 32 × 32.

import { useId } from "react";
import { cn } from "@/lib/utils";
import type { Ciel } from "@/lib/sfl/meteo";

const NUAGE = "M9.5 24h13.2a4.8 4.8 0 0 0 .5-9.6 6.6 6.6 0 0 0-12.6 1.7A4 4 0 0 0 9.5 24z";
const NUAGE_HAUT = "M9.5 19h13.2a4.8 4.8 0 0 0 .5-9.6 6.6 6.6 0 0 0-12.6 1.7A4 4 0 0 0 9.5 19z";

export function PictoMeteo({ ciel, className }: { ciel: Ciel; className?: string }) {
  const id = useId().replace(/:/g, "");
  const hachure = `h${id}`;
  const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.35, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const rayons = (cx: number, cy: number, r1: number, r2: number, n = 12) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = i % 2 ? r2 - 1.2 : r2;
      return <line key={i} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} {...trait} strokeWidth={1.1} />;
    });
  const nuage = (d: string) => (
    <>
      <path d={d} fill={`url(#${hachure})`} stroke="none" opacity={0.55} />
      <path d={d} {...trait} />
    </>
  );
  const sous = (fn: (x: number, i: number) => React.ReactNode) => [11.5, 16, 20.5].map((x, i) => <g key={i}>{fn(x, i)}</g>);
  const masque = `m${id}`;
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("text-foreground", className)}>
      <defs>
        <pattern id={hachure} width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="2.2" stroke="currentColor" strokeWidth="0.55" />
        </pattern>
        {/* Le soleil passe derrière le nuage : on l'efface sous lui (un masque, pas un fond peint). */}
        <mask id={masque} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <rect width="32" height="32" fill="white" />
          <path d={ciel === "averse" ? NUAGE_HAUT : NUAGE} fill="black" stroke="black" strokeWidth="2.4" />
        </mask>
      </defs>
      {ciel === "soleil" && (
        <>
          <circle cx="16" cy="16" r="5.6" fill={`url(#${hachure})`} />
          <circle cx="16" cy="16" r="5.6" {...trait} />
          {rayons(16, 16, 8.4, 12.6)}
        </>
      )}
      {ciel === "lune" && (
        <>
          <path d="M20.5 7.5a9 9 0 1 0 4 15.6A7.4 7.4 0 0 1 20.5 7.5z" fill={`url(#${hachure})`} />
          <path d="M20.5 7.5a9 9 0 1 0 4 15.6A7.4 7.4 0 0 1 20.5 7.5z" {...trait} />
        </>
      )}
      {ciel === "eclaircie" && (
        <>
          <g mask={`url(#${masque})`}>
            <circle cx="21.5" cy="10" r="3.8" {...trait} />
            {rayons(21.5, 10, 5.6, 8.2, 10)}
          </g>
          {nuage(NUAGE)}
        </>
      )}
      {ciel === "nuage" && nuage(NUAGE)}
      {ciel === "brume" && [10, 14.5, 19, 23.5].map((y, i) => <line key={y} x1={i % 2 ? 9 : 6} y1={y} x2={i % 2 ? 26 : 23} y2={y} {...trait} />)}
      {(ciel === "pluie" || ciel === "averse") && (
        <>
          {ciel === "averse" && (
            <>
              <g mask={`url(#${masque})`}>
                <circle cx="22.5" cy="7.5" r="3" {...trait} />
                {rayons(22.5, 7.5, 4.6, 6.8, 10)}
              </g>
            </>
          )}
          {nuage(NUAGE_HAUT)}
          {sous((x) => <line x1={x} y1={22} x2={x - 2.2} y2={27.5} {...trait} />)}
        </>
      )}
      {ciel === "bruine" && (
        <>
          {nuage(NUAGE_HAUT)}
          {sous((x, i) => (
            <>
              <circle cx={x} cy={i % 2 ? 23 : 24.5} r="0.85" fill="currentColor" />
              <circle cx={x - 1.4} cy={i % 2 ? 27 : 28.2} r="0.85" fill="currentColor" />
            </>
          ))}
        </>
      )}
      {ciel === "neige" && (
        <>
          {nuage(NUAGE_HAUT)}
          {sous((x, i) => {
            const y = i % 2 ? 23.5 : 26;
            return [0, 60, 120].map((a) => (
              <line key={a} x1={x - Math.cos((a * Math.PI) / 180) * 1.7} y1={y - Math.sin((a * Math.PI) / 180) * 1.7} x2={x + Math.cos((a * Math.PI) / 180) * 1.7} y2={y + Math.sin((a * Math.PI) / 180) * 1.7} {...trait} strokeWidth={1} />
            ));
          })}
        </>
      )}
      {ciel === "orage" && (
        <>
          {nuage(NUAGE_HAUT)}
          <path d="M17.2 19.5l-3.4 5.2h3.4l-2 5" {...trait} />
        </>
      )}
      {ciel === "vent" && (
        <>
          <path d="M4.5 12.5h15.2a3.3 3.3 0 1 0-3.2-4" {...trait} />
          <path d="M4.5 17.5h20a3.6 3.6 0 1 1-3.5 4.4" {...trait} />
          <path d="M8.5 22.5h7" {...trait} />
          <path d="M6.5 7.5h5" {...trait} strokeWidth={1} opacity={0.6} />
        </>
      )}
    </svg>
  );
}
