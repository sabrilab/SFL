"use client";

// Les graphiques de la page Activité & rétention — dessinés à la main en SVG,
// sans bibliothèque, aux couleurs de l'app (noir et blanc : tout est en
// `currentColor` et en opacités du premier plan).
//
//   · Courbe — la courbe de croissance : un trait, une aire, la période
//     d'avant en pointillé, le creux grisé. On la parcourt du doigt (ou de
//     la souris) : un repère suit, la bulle donne le jour et la valeur.
//   · CarteHoraire — jours × heures, plus c'est foncé plus la ligue est là.
//   · Cohortes — une ligne par semaine d'arrivée, la part encore là ensuite.
//   · Comparaison — deux barres : ceux qui font un geste, et les autres.

import { useEffect, useRef, useState } from "react";
import type { Cohorte } from "@/lib/sfl/retention";
import { jjmm, pct } from "@/lib/sfl/retention";
import { cn } from "@/lib/utils";

/** Fond au premier plan dosé : 0 → transparent, 1 → plein. */
export const encre = (x: number) =>
  `color-mix(in oklab, var(--foreground) ${Math.round(Math.max(0, Math.min(1, x)) * 100)}%, transparent)`;

/** Un maximum « rond » pour l'axe : 37 → 40, 7 → 8, 1 234 → 1 500. */
function maxRond(v: number): number {
  if (v <= 4) return Math.max(1, Math.ceil(v));
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Largeur réelle d'un élément, suivie au redimensionnement. */
function useLargeur<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* --------------------------------- courbe -------------------------------- */

export function Courbe({
  points,
  avant,
  format,
  creux,
  hauteur = 200,
}: {
  points: { t: number; v: number }[];
  /** Même longueur que `points` : la valeur de la période d'avant, au même rang. */
  avant?: (number | null)[] | null;
  format: (v: number) => string;
  creux?: { de: number; a: number } | null;
  hauteur?: number;
}) {
  const [ref, largeur] = useLargeur<HTMLDivElement>();
  const [actif, setActif] = useState<number | null>(null);
  const n = points.length;

  const gauche = 30;
  const droite = 8;
  // En haut, la place de la bulle : elle ne couvre jamais la courbe.
  const haut = 44;
  const bas = 22;
  const w = Math.max(0, largeur - gauche - droite);
  const h = hauteur - haut - bas;
  const valeurs = [...points.map((p) => p.v), ...(avant ?? []).map((v) => v ?? 0)];
  const max = maxRond(Math.max(1, ...valeurs));
  const x = (i: number) => gauche + (n <= 1 ? w : (i / (n - 1)) * w);
  const y = (v: number) => haut + h - (v / max) * h;

  const trace = (vals: (number | null)[]) => {
    let d = "";
    let leve = true;
    vals.forEach((v, i) => {
      if (v === null) {
        leve = true;
        return;
      }
      d += `${leve ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      leve = false;
    });
    return d;
  };
  const ligne = trace(points.map((p) => p.v));
  const aire = n ? `${ligne}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : "";

  const i = actif ?? n - 1;
  const point = points[i];

  const choisir = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    const rel = (clientX - r.left - gauche) / Math.max(1, w);
    setActif(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };

  // La bande du creux, bornée à la fenêtre affichée.
  let bande: { x0: number; x1: number } | null = null;
  if (creux && n > 1) {
    const i0 = points.findIndex((p) => p.t >= creux.de);
    let i1 = -1;
    for (let k = n - 1; k >= 0; k--) if (points[k].t <= creux.a) { i1 = k; break; }
    if (i0 >= 0 && i1 >= i0) bande = { x0: x(i0), x1: x(i1) };
  }

  const graduations = [0, max / 2, max];
  const reperes = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];

  return (
    <div ref={ref} className="relative select-none" style={{ height: hauteur, touchAction: "pan-y" }}>
      {largeur > 0 && (
        <svg
          width={largeur}
          height={hauteur}
          className="block text-foreground"
          onPointerMove={(e) => choisir(e.clientX)}
          onPointerDown={(e) => choisir(e.clientX)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setActif(null)}
        >
          <defs>
            <linearGradient id="aire-courbe" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {graduations.map((g) => (
            <g key={g}>
              <line
                x1={gauche}
                x2={gauche + w}
                y1={y(g)}
                y2={y(g)}
                stroke="currentColor"
                strokeOpacity={g === 0 ? 0.18 : 0.07}
              />
              <text
                x={gauche - 6}
                y={y(g) + 3}
                textAnchor="end"
                fontSize="9"
                fill="currentColor"
                fillOpacity="0.4"
                className="tabular-nums"
              >
                {format(g)}
              </text>
            </g>
          ))}
          {bande && (
            <g>
              <rect
                x={bande.x0}
                y={haut}
                width={Math.max(2, bande.x1 - bande.x0)}
                height={h}
                fill="currentColor"
                fillOpacity="0.05"
              />
              <text
                x={(bande.x0 + bande.x1) / 2}
                y={haut + 10}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="700"
                letterSpacing="0.08em"
                fill="currentColor"
                fillOpacity="0.35"
              >
                CREUX
              </text>
            </g>
          )}
          <path d={aire} fill="url(#aire-courbe)" />
          {avant && (
            <path
              d={trace(avant)}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="1.5"
              strokeDasharray="3 4"
              strokeLinejoin="round"
            />
          )}
          <path
            d={ligne}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {point && (
            <g>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={haut}
                y2={haut + h}
                stroke="currentColor"
                strokeOpacity="0.25"
              />
              <circle cx={x(i)} cy={y(point.v)} r="4.5" fill="var(--background)" stroke="currentColor" strokeWidth="2" />
            </g>
          )}
          {reperes.map((k) => (
            <text
              key={k}
              x={x(k)}
              y={hauteur - 6}
              textAnchor={k === 0 ? "start" : k === n - 1 ? "end" : "middle"}
              fontSize="9"
              fill="currentColor"
              fillOpacity="0.4"
            >
              {k === n - 1 ? "aujourd'hui" : jjmm(points[k].t)}
            </text>
          ))}
        </svg>
      )}
      {point && largeur > 0 && (
        <div
          className="glass-soft pointer-events-none absolute top-0 rounded-xl px-2.5 py-1.5 text-[11px] leading-tight whitespace-nowrap backdrop-blur-md"
          style={{
            left: Math.min(Math.max(x(i) - 56, 0), largeur - 112),
            width: 112,
          }}
        >
          <span className="mono-label block text-[8.5px] text-foreground/45">
            {new Date(point.t).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
          </span>
          <span className="font-bold tabular-nums">{format(point.v)}</span>
          {avant?.[i] != null && (
            <span className="text-foreground/45 tabular-nums"> · avant {format(avant[i]!)}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ carte horaire ---------------------------- */

const JOURS_COURTS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const JOURS_LONGS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export function CarteHoraire({ carte }: { carte: number[][] }) {
  const max = Math.max(1, ...carte.flat());
  const [choix, setChoix] = useState<[number, number] | null>(null);
  const total = carte.flat().reduce((a, b) => a + b, 0);
  return (
    <div>
      <div className="flex flex-col gap-[3px]">
        {carte.map((ligne, j) => (
          <div key={j} className="flex items-center gap-[3px]">
            <span className="mono-label w-7 shrink-0 text-[8px] text-foreground/40">{JOURS_COURTS[j]}</span>
            {ligne.map((v, hr) => (
              <button
                key={hr}
                onClick={() => setChoix([j, hr])}
                aria-label={`${JOURS_LONGS[j]} ${hr} h : ${v}`}
                className={cn(
                  "aspect-square flex-1 rounded-[3px]",
                  choix?.[0] === j && choix?.[1] === hr && "ring-1 ring-foreground"
                )}
                style={{ background: v ? encre(0.1 + (v / max) * 0.9) : encre(0.04) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex pl-[31px]">
        {[0, 6, 12, 18].map((hr) => (
          <span key={hr} className="mono-label flex-1 text-[8px] text-foreground/30">
            {hr} h
          </span>
        ))}
      </div>
      <p className="mt-2 min-h-[18px] text-[12px] text-foreground/55">
        {choix
          ? `${JOURS_LONGS[choix[0]][0].toUpperCase()}${JOURS_LONGS[choix[0]].slice(1)}, ${choix[1]} h – ${choix[1] + 1} h : ${carte[choix[0]][choix[1]]} présences (${total ? pct(carte[choix[0]][choix[1]] / total) : "0 %"})`
          : "Touche une case pour lire le chiffre."}
      </p>
    </div>
  );
}

/* --------------------------------- cohortes ------------------------------ */

export function Cohortes({ cohortes }: { cohortes: Cohorte[] }) {
  const cols = Math.max(0, ...cohortes.map((c) => c.parts.length));
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="mono-label pr-1 text-left text-[8px] font-bold text-foreground/35">Arrivés</th>
            {Array.from({ length: cols }, (_, k) => (
              <th key={k} className="mono-label min-w-[30px] text-center text-[8px] font-bold text-foreground/35">
                {k === 0 ? "S0" : `+${k}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohortes.map((c) => (
            <tr key={c.semaine}>
              <td className="pr-1 text-[11px] whitespace-nowrap">
                <span className="font-semibold">{jjmm(c.semaine)}</span>
                <span className="text-foreground/40"> · {c.taille}</span>
              </td>
              {Array.from({ length: cols }, (_, k) => {
                const p = c.parts[k];
                if (p === undefined || p === null) return <td key={k} />;
                const fond = c.taille < 3 ? 0.04 + p * 0.25 : 0.06 + p * 0.84;
                return (
                  <td
                    key={k}
                    className="h-7 rounded-[5px] text-center text-[10px] font-bold tabular-nums"
                    style={{
                      background: encre(fond),
                      color: fond > 0.55 ? "var(--background)" : undefined,
                    }}
                  >
                    {Math.round(p * 100)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------- comparaison ---------------------------- */

export function Comparaison({
  label,
  avec,
  sans,
  nAvec,
  nSans,
}: {
  label: string;
  avec: number;
  sans: number;
  nAvec: number;
  nSans: number;
}) {
  const barre = (v: number, fort: boolean) => (
    <span className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/8">
      <span
        className="block h-full rounded-full"
        style={{ width: `${v * 100}%`, background: encre(fort ? 0.85 : 0.3) }}
      />
    </span>
  );
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="text-[11px] text-foreground/45 tabular-nums">
          {avec - sans >= 0 ? "+" : "−"}
          {Math.abs(Math.round((avec - sans) * 100))} pts
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="mono-label w-[68px] shrink-0 text-[8.5px] whitespace-nowrap text-foreground/55">Oui · {nAvec}</span>
        {barre(avec, true)}
        <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums">{pct(avec)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="mono-label w-[68px] shrink-0 text-[8.5px] whitespace-nowrap text-foreground/35">Non · {nSans}</span>
        {barre(sans, false)}
        <span className="w-9 shrink-0 text-right text-[11px] text-foreground/55 tabular-nums">{pct(sans)}</span>
      </div>
    </div>
  );
}
