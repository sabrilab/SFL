"use client";

// Le terrain d'un exercice (Bola Club), dessiné à l'échelle depuis son plan
// (lib/sfl/club/plans.ts) : la pelouse tondue en bandes, les limites de la
// zone à la craie, les plots orange, les joueurs aux couleurs des chasubles
// (deux équipes, les jokers, le gardien, l'entraîneur), le ballon, les buts et
// les mini-buts avec leur filet, les haies, les cerceaux, l'échelle, et ce qui
// se passe : la course en pointillé, la passe en trait plein, la conduite en
// vague, le tir plus épais. Sous le dessin, la taille de la zone.
//
// Les couleurs viennent des variables de la version de couleurs choisie
// (club/couleurs.ts, --terrain-*) ; sans elles, les valeurs d'ici. En
// vignette (dans une ligne de programme), le même dessin sans légende.

import { useId } from "react";
import { planDe, type Equipe, type Plan, type Pt } from "@/lib/sfl/club/plans";
import type { Exercice } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";

const M = 2.4;

const C = {
  pelouse: "var(--terrain-pelouse, #2f7d47)",
  bande: "var(--terrain-bande, #2a7240)",
  craie: "var(--terrain-craie, rgba(255,255,255,0.92))",
  plot: "var(--terrain-plot, #ff7a1a)",
  a: "var(--terrain-a, #ffd23f)",
  b: "var(--terrain-b, #3d7bff)",
  j: "var(--terrain-j, #ff4d6d)",
  g: "var(--terrain-g, #b9f227)",
  c: "var(--terrain-c, #111111)",
  fleche: "var(--terrain-fleche, #ffffff)",
  passe: "var(--terrain-passe, #ffffff)",
};

const COULEUR: Record<Equipe, string> = { a: C.a, b: C.b, j: C.j, g: C.g, c: C.c };

/** La boîte des plots et des sous-zones : la limite d'une zone balisée. */
function boite(p: Plan): { x: number; y: number; l: number; h: number } | null {
  const pts: Pt[] = [...(p.plots ?? [])];
  if (pts.length < 3) return null;
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const b = { x: Math.min(...xs), y: Math.min(...ys), l: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  return b.l < 1 || b.h < 1 ? null : b;
}

function Cadre({ p, k }: { p: Plan; k: number }) {
  const t = 0.16 * k;
  const craie = { stroke: C.craie, strokeWidth: t, fill: "none" } as const;
  if (p.cadre === "libre") return null;
  if (p.cadre === "cercle") return <circle cx={p.l / 2} cy={p.h / 2} r={Math.min(p.l, p.h) / 2 - 0.6} {...craie} strokeDasharray={`${0.8 * k} ${0.6 * k}`} />;
  if (p.cadre === "triangle" && p.plots) return <polygon points={p.plots.map((q) => q.join(",")).join(" ")} {...craie} />;
  if (p.cadre === "zone") {
    if (p.zones?.length) return <>{p.zones.map((z, i) => <rect key={i} x={z.p[0]} y={z.p[1]} width={z.l} height={Math.max(z.h, 0.01)} {...craie} />)}</>;
    const b = boite(p);
    return b ? <rect x={b.x} y={b.y} width={b.l} height={b.h} {...craie} /> : null;
  }
  // Les lignes d'un vrai terrain.
  const grands = (p.buts ?? []).filter((b) => !b.m);
  return (
    <>
      <rect x={0} y={0} width={p.l} height={p.h} {...craie} />
      {p.cadre === "largeur" && <line x1={p.l / 2} y1={0} x2={p.l / 2} y2={p.h} {...craie} opacity={0.5} />}
      {p.cadre === "demi" && grands.length === 2 && (
        <>
          {grands[0].cote === "droite" || grands[0].cote === "gauche" ? (
            <line x1={p.l / 2} y1={0} x2={p.l / 2} y2={p.h} {...craie} />
          ) : (
            <line x1={0} y1={p.h / 2} x2={p.l} y2={p.h / 2} {...craie} />
          )}
          <circle cx={p.l / 2} cy={p.h / 2} r={Math.min(p.l, p.h) * 0.16} {...craie} />
        </>
      )}
      {p.cadre === "demi" && grands.length < 2 && p.zones === undefined && (
        <>
          <line x1={0} y1={p.h} x2={p.l} y2={p.h} {...craie} />
          <path d={`M ${p.l / 2 - 8} ${p.h} A 8 8 0 0 1 ${p.l / 2 + 8} ${p.h}`} {...craie} />
        </>
      )}
      {grands.map((b, i) => {
        // La surface (16,5 m × 40,3 m) et les 5,5 m, contre la ligne de but, bornées à la zone.
        const vertical = b.cote === "haut" || b.cote === "bas";
        const prof = Math.min(16.5, (vertical ? p.h : p.l) * (p.cadre === "surface" ? 0.85 : 0.3));
        const large = Math.min(40.3, (vertical ? p.l : p.h) - 2);
        const prof5 = Math.min(5.5, prof * 0.34);
        const large5 = Math.min(18.3, large * 0.46);
        const pt = (dx: number, dy: number) => (vertical ? [b.p[0] + dx, b.p[1] + (b.cote === "bas" ? dy : -dy)] : [b.p[0] + (b.cote === "droite" ? dy : -dy), b.p[1] + dx]);
        const rect = (lg: number, pr: number) => {
          const a = pt(-lg / 2, 0);
          const c = pt(lg / 2, pr);
          return <rect x={Math.min(a[0], c[0])} y={Math.min(a[1], c[1])} width={Math.abs(c[0] - a[0])} height={Math.abs(c[1] - a[1])} {...craie} />;
        };
        const spot = pt(0, Math.min(11, prof * 0.66));
        return (
          <g key={i}>
            {rect(large, prof)}
            {rect(large5, prof5)}
            <circle cx={spot[0]} cy={spot[1]} r={0.35 * k} fill={C.craie} />
          </g>
        );
      })}
    </>
  );
}

function But({ p, cote, m, k }: { p: Pt; cote: "haut" | "bas" | "gauche" | "droite"; m?: boolean; k: number }) {
  const larg = m ? 2 : 7.32;
  const prof = m ? 1 : 1.8;
  const vertical = cote === "haut" || cote === "bas";
  // Le filet derrière la ligne, du côté opposé à l'ouverture.
  const dx = vertical ? 0 : cote === "droite" ? -prof : 0;
  const dy = vertical ? (cote === "bas" ? -prof : 0) : 0;
  const x = vertical ? p[0] - larg / 2 : p[0] + dx;
  const y = vertical ? p[1] + dy : p[1] - larg / 2;
  const w = vertical ? larg : prof;
  const h = vertical ? prof : larg;
  const id = useId();
  return (
    <g>
      <defs>
        <pattern id={id} width={0.5} height={0.5} patternUnits="userSpaceOnUse">
          <path d="M0 0 L0.5 0.5 M0.5 0 L0 0.5" stroke="rgba(255,255,255,0.45)" strokeWidth={0.06} />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} stroke={C.craie} strokeWidth={0.22 * k} rx={0.15} />
    </g>
  );
}

function Fleche({ f, k, marque }: { f: NonNullable<Plan["fleches"]>[number]; k: number; marque: string }) {
  const [x1, y1] = f.de;
  const [x2, y2] = f.a;
  let d = f.par ? `M ${x1} ${y1} Q ${f.par[0]} ${f.par[1]} ${x2} ${y2}` : `M ${x1} ${y1} L ${x2} ${y2}`;
  if (f.t === "conduite" && !f.par) {
    // Une vague le long du trajet : la conduite de balle.
    const lg = Math.hypot(x2 - x1, y2 - y1);
    const n = Math.max(2, Math.round(lg / (1.6 * k)));
    const ux = (x2 - x1) / lg;
    const uy = (y2 - y1) / lg;
    const a = 0.45 * k;
    const pts: string[] = [`M ${x1} ${y1}`];
    for (let i = 1; i <= n; i++) {
      const t0 = ((i - 0.5) / n) * lg;
      const t1 = (i / n) * lg;
      const s = i % 2 ? 1 : -1;
      pts.push(`Q ${x1 + ux * t0 - uy * a * s} ${y1 + uy * t0 + ux * a * s} ${x1 + ux * t1} ${y1 + uy * t1}`);
    }
    d = pts.join(" ");
  }
  const couleur = f.t === "passe" || f.t === "tir" ? C.passe : C.fleche;
  return (
    <path
      d={d}
      fill="none"
      stroke={couleur}
      strokeWidth={(f.t === "tir" ? 0.26 : 0.17) * k}
      strokeDasharray={f.t === "course" ? `${0.7 * k} ${0.45 * k}` : undefined}
      strokeLinecap="round"
      markerEnd={`url(#${marque})`}
      opacity={0.95}
    />
  );
}

export function TerrainExercice({ e, vignette = false, className }: { e: Pick<Exercice, "id" | "theme" | "espace">; vignette?: boolean; className?: string }) {
  const p = planDe(e);
  const marque = useId();
  const k = Math.max(p.l, p.h * 1.4) / 26;
  const W = p.l + 2 * M * k;
  const H = p.h + 2 * M * k;
  const bandes = 8;
  return (
    <figure className={cn("flex flex-col gap-1.5", className)}>
      <svg
        viewBox={`${-M * k} ${-M * k} ${W} ${H}`}
        className={cn("block w-full overflow-hidden", vignette ? "rounded-[12px]" : "rounded-[18px]")}
        role="img"
        aria-label={`Terrain : ${p.dit}`}
      >
        <defs>
          <marker id={marque} viewBox="0 0 10 10" refX={7} refY={5} markerWidth={4.5} markerHeight={4.5} orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={C.fleche} />
          </marker>
        </defs>
        <rect x={-M * k} y={-M * k} width={W} height={H} fill={C.pelouse} />
        {Array.from({ length: bandes }, (_, i) =>
          i % 2 ? <rect key={i} x={-M * k + (W / bandes) * i} y={-M * k} width={W / bandes} height={H} fill={C.bande} /> : null,
        )}
        <Cadre p={p} k={k} />
        {p.zones && p.cadre !== "zone" && p.zones.map((z, i) => <rect key={i} x={z.p[0]} y={z.p[1]} width={z.l} height={z.h} fill="none" stroke={C.craie} strokeWidth={0.12 * k} strokeDasharray={`${0.6 * k} ${0.5 * k}`} />)}
        {p.echelle && (
          <g stroke="#f4f1e8" strokeWidth={0.12 * k}>
            <rect x={p.echelle.p[0]} y={p.echelle.p[1] - 0.6 * k} width={p.echelle.l} height={1.2 * k} fill="none" />
            {Array.from({ length: Math.round(p.echelle.l / 0.6) }, (_, i) => (
              <line key={i} x1={p.echelle!.p[0] + i * 0.6} y1={p.echelle!.p[1] - 0.6 * k} x2={p.echelle!.p[0] + i * 0.6} y2={p.echelle!.p[1] + 0.6 * k} />
            ))}
          </g>
        )}
        {p.cerceaux?.map((c, i) => <circle key={i} cx={c[0]} cy={c[1]} r={0.75 * k} fill="none" stroke={C.j} strokeWidth={0.18 * k} />)}
        {p.haies?.map((h, i) => (
          <g key={i} stroke={C.plot} strokeWidth={0.2 * k} strokeLinecap="round">
            <line x1={h[0]} y1={h[1] - 0.9 * k} x2={h[0]} y2={h[1] + 0.9 * k} />
            <line x1={h[0] - 0.3 * k} y1={h[1] - 0.9 * k} x2={h[0] + 0.3 * k} y2={h[1] - 0.9 * k} />
            <line x1={h[0] - 0.3 * k} y1={h[1] + 0.9 * k} x2={h[0] + 0.3 * k} y2={h[1] + 0.9 * k} />
          </g>
        ))}
        {p.buts?.map((b, i) => <But key={i} {...b} k={k} />)}
        {p.fleches?.map((f, i) => <Fleche key={i} f={f} k={k} marque={marque} />)}
        {p.plots?.map((q, i) => (
          <path
            key={i}
            d={`M ${q[0]} ${q[1] - 0.55 * k} L ${q[0] + 0.45 * k} ${q[1] + 0.35 * k} L ${q[0] - 0.45 * k} ${q[1] + 0.35 * k} Z`}
            fill={C.plot}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={0.05 * k}
          />
        ))}
        {p.joueurs?.map((j, i) => (
          <g key={i}>
            <circle cx={j.p[0]} cy={j.p[1] + 0.12 * k} r={0.72 * k} fill="rgba(0,0,0,0.25)" />
            <circle cx={j.p[0]} cy={j.p[1]} r={0.7 * k} fill={COULEUR[j.e]} stroke="rgba(255,255,255,0.9)" strokeWidth={0.12 * k} />
            {j.e === "c" && (
              <text x={j.p[0]} y={j.p[1] + 0.32 * k} textAnchor="middle" fontSize={0.9 * k} fontWeight={700} fill="#fff">
                E
              </text>
            )}
          </g>
        ))}
        {p.ballons?.map((b, i) => (
          <g key={i}>
            <circle cx={b[0]} cy={b[1]} r={0.38 * k} fill="#fff" stroke="#111" strokeWidth={0.06 * k} />
            <circle cx={b[0]} cy={b[1]} r={0.13 * k} fill="#111" />
          </g>
        ))}
      </svg>
      {!vignette && <figcaption className="px-1 text-corps text-encre-3">{p.dit}</figcaption>}
    </figure>
  );
}

/** La légende des couleurs, sous un grand terrain. */
export function LegendeTerrain() {
  const items: [string, string][] = [
    [C.a, "Équipe"],
    [C.b, "Adversaire"],
    [C.j, "Joker"],
    [C.g, "Gardien"],
    [C.plot, "Plot"],
  ];
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 px-1">
      {items.map(([c, l]) => (
        <span key={l} className="flex items-center gap-1.5 text-petit text-encre-3">
          <span className="size-2.5 rounded-full" style={{ background: c }} />
          {l}
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-petit text-encre-3">
        <svg width="18" height="6" aria-hidden>
          <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2" />
        </svg>
        Course
      </span>
      <span className="flex items-center gap-1.5 text-petit text-encre-3">
        <svg width="18" height="6" aria-hidden>
          <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        Passe
      </span>
    </div>
  );
}
