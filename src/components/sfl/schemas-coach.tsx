"use client";

// Les schémas du coach dessinés par l'app (données et règles dans
// lib/sfl/schemas-coach.ts) : le corps, de face et de dos, la zone visée
// allumée en blanc ; le terrain de five vu de dessus, avec toi, tes
// partenaires, les adversaires, les courses et les passes. Tout en
// currentColor : la charte noir et blanc de l'app, sombre comme clair.

import { useId } from "react";
import {
  NOM_ZONE,
  TRACES,
  allume,
  vuesDe,
  type SchemaCoach,
  type SchemaCorps,
  type SchemaTerrain,
  type ZoneCorps,
} from "@/lib/sfl/schemas-coach";

function legendeCorps(s: SchemaCorps): string {
  return s.zones.map((z) => `${NOM_ZONE[z.zone]}${z.cote === "les deux" ? "" : ` ${z.cote === "droit" ? "droit" : "gauche"}`}`).join(" · ");
}

function CorpsVue({ s }: { s: SchemaCorps }) {
  const halo = useId();
  const vues = vuesDe(s);
  return (
    <div className="flex items-end justify-center gap-5 px-4 pt-5 pb-3">
      {vues.map((vue) => (
        <figure key={vue} className="flex flex-col items-center gap-2">
          <svg viewBox="-2 -2 104 214" className="h-[260px] w-auto text-foreground" role="img" aria-label={legendeCorps(s)}>
            <defs>
              <filter id={`${halo}-${vue}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.2" result="flou" />
                <feMerge>
                  <feMergeNode in="flou" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {(Object.entries(TRACES[vue]) as [ZoneCorps, string[]][]).flatMap(([zone, polys]) =>
              polys.map((points, i) => {
                const on = allume(s, vue, zone, points);
                return (
                  <polygon
                    key={`${zone}-${i}`}
                    points={points}
                    fill="currentColor"
                    fillOpacity={on ? 1 : 0.22}
                    filter={on ? `url(#${halo}-${vue})` : undefined}
                  />
                );
              })
            )}
          </svg>
          <figcaption className="mono-label text-[8.5px] text-foreground/40">{vue === "face" ? "Face" : "Dos"}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Le terrain : repère 0–100 en largeur et en longueur, dessiné en 100 × 160. */
const L = 1.6;

function TerrainVue({ s }: { s: SchemaTerrain }) {
  const id = useId();
  const y = (v: number) => v * L;
  return (
    <div className="px-5 pt-5 pb-3">
      <svg viewBox="-4 -6 108 172" className="mx-auto block h-[260px] w-auto text-foreground" role="img" aria-label={s.legende || "Terrain"}>
        <defs>
          {(["course", "passe", "tir"] as const).map((t) => (
            <marker key={t} id={`${id}-${t}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
            </marker>
          ))}
        </defs>
        {/* Les lignes */}
        <g fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={0.8}>
          <rect x={0} y={0} width={100} height={160} rx={2} />
          <line x1={0} y1={80} x2={100} y2={80} />
          <circle cx={50} cy={80} r={13} />
          <path d="M28 0 A22 22 0 0 0 72 0" />
          <path d="M28 160 A22 22 0 0 1 72 160" />
          <rect x={38} y={-4} width={24} height={4} />
          <rect x={38} y={160} width={24} height={4} />
        </g>
        <circle cx={50} cy={80} r={1} fill="currentColor" fillOpacity={0.22} />
        {/* La zone à prendre */}
        {s.zone && (
          <circle cx={s.zone.x} cy={y(s.zone.y)} r={s.zone.r} fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeOpacity={0.5} strokeWidth={0.7} strokeDasharray="2 2" />
        )}
        {/* Les courses et les passes */}
        {s.fleches.map((f, i) => (
          <line
            key={i}
            x1={f.x1}
            y1={y(f.y1)}
            x2={f.x2}
            y2={y(f.y2)}
            stroke="currentColor"
            strokeOpacity={f.type === "course" ? 0.9 : 0.75}
            strokeWidth={f.type === "tir" ? 1.6 : 1}
            strokeDasharray={f.type === "course" ? "3 2.2" : undefined}
            strokeLinecap="round"
            markerEnd={`url(#${id}-${f.type})`}
          />
        ))}
        {/* Les joueurs */}
        {s.joueurs.map((j, i) =>
          j.role === "moi" ? (
            <g key={i}>
              <circle cx={j.x} cy={y(j.y)} r={7} fill="currentColor" fillOpacity={0.14} />
              <circle cx={j.x} cy={y(j.y)} r={4.2} fill="currentColor" />
            </g>
          ) : j.role === "partenaire" ? (
            <circle key={i} cx={j.x} cy={y(j.y)} r={3.4} fill="currentColor" fillOpacity={0.6} />
          ) : (
            <circle key={i} cx={j.x} cy={y(j.y)} r={3.2} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth={1.1} />
          )
        )}
        {s.ballon && (
          <circle cx={s.ballon.x} cy={y(s.ballon.y)} r={1.8} fill="currentColor" stroke="var(--background)" strokeWidth={0.8} />
        )}
      </svg>
    </div>
  );
}

export function SchemaVue({ schema }: { schema: SchemaCoach }) {
  const legende = schema.legende || (schema.type === "corps" ? legendeCorps(schema) : "");
  return (
    <figure className="w-[min(320px,80vw)] lg:w-[420px]">
      <div className="glass-soft overflow-hidden rounded-[22px]">
        {schema.type === "corps" ? <CorpsVue s={schema} /> : <TerrainVue s={schema} />}
      </div>
      {legende && <figcaption className="mt-1.5 px-1 text-[12.5px] leading-snug text-foreground/50">{legende}</figcaption>}
    </figure>
  );
}
