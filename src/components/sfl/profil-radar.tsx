"use client";

// Le profil de jeu : le radar hexagonal des six notes. Il vivait dans Ma
// carte ; depuis le 22/10 (Sabri : « il faudrait que le radar du joueur soit
// dans la fonction de comparaison »), il est dans « Comparer avec ma carte »
// (comparer-cartes.tsx) : RadarDuel y superpose ton profil et le sien.
// ProfilRadar, le radar d'un seul joueur, reste disponible.

import { STAT_KEYS, type Player } from "@/lib/sfl/engine";

/* ------------------------- Radar « PROFIL DE JEU » ------------------------ */
// Géométrie reprise du design : hexagone pointe en haut, centre (110,110),
// rayon 84, anneaux à 100/75/50/25 %, rayon de valeur = R × note/100.
// Polygone blanc, points blancs — sauf le point faible, en accent bleu. Le
// blanc est celui du mode (currentColor sur text-contraste) : l'encre en clair.

const RADAR_LABELS: [number, number, number, "middle" | "start" | "end"][] = [
  [110, 10, 22, "middle"], // VIT
  [194, 58, 72, "start"], // TIR
  [194, 166, 180, "start"], // PAS
  [110, 216, 228, "middle"], // DRI
  [26, 166, 180, "end"], // DEF
  [26, 58, 72, "end"], // PHY
];

const STAT_FR: Record<string, string> = {
  VIT: "vitesse",
  TIR: "tir",
  PAS: "passe",
  DRI: "dribble",
  DEF: "défense",
  PHY: "physique",
};

export function ProfilRadar({ stats, overall }: { stats: Player["stats"]; overall: number }) {
  const CX = 110;
  const CY = 110;
  const R = 84;
  const angle = (i: number) => -Math.PI / 2 + (i * Math.PI) / 3;
  const px = (i: number, r: number) => (CX + Math.cos(angle(i)) * r).toFixed(1);
  const py = (i: number, r: number) => (CY + Math.sin(angle(i)) * r).toFixed(1);
  const ring = (f: number) => STAT_KEYS.map((_, i) => `${px(i, R * f)},${py(i, R * f)}`).join(" ");
  const value = (i: number) => (R * stats[STAT_KEYS[i]]) / 100;

  const worst = STAT_KEYS.reduce((a, k) => (stats[k] < stats[a] ? k : a), STAT_KEYS[0]);
  const best = STAT_KEYS.reduce((a, k) => (stats[k] > stats[a] ? k : a), STAT_KEYS[0]);

  return (
    <section className="glass flex flex-col items-center rounded-[28px] px-[18px] pt-6 pb-5">
      <div className="flex w-full items-start justify-between">
        <div>
          <p className="mono-label text-foreground/40">Profil de jeu</p>
          <p className="mt-[5px] text-[12.5px] text-foreground/45">Six critères</p>
        </div>
        <div className="text-right">
          <div className="text-[30px] leading-none font-extrabold tracking-tight">{overall}</div>
          <p className="mono-label mt-[5px] text-foreground/40">Général</p>
        </div>
      </div>

      <svg viewBox="-12 -10 244 248" className="mt-2.5 w-full max-w-[258px] overflow-visible text-contraste">
        <polygon points={ring(1)} fill="currentColor" fillOpacity={0.035} stroke="currentColor" strokeOpacity={0.14} strokeWidth="1" />
        <polygon points={ring(0.75)} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth="1" />
        <polygon points={ring(0.5)} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth="1" />
        <polygon points={ring(0.25)} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth="1" />
        <path
          d={STAT_KEYS.map((_, i) => `M${CX},${CY} L${px(i, R)},${py(i, R)}`).join(" ")}
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth="1"
        />
        <polygon
          points={STAT_KEYS.map((_, i) => `${px(i, value(i))},${py(i, value(i))}`).join(" ")}
          fill="currentColor"
          fillOpacity={0.16}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {STAT_KEYS.map((k, i) => (
          <circle
            key={k}
            cx={px(i, value(i))}
            cy={py(i, value(i))}
            r="3.4"
            fill={k === worst ? "#6FA8FF" : "currentColor"}
          />
        ))}
        <g
          style={{ fontFamily: "var(--font-jbmono)", fontSize: 9, letterSpacing: 1.4 }}
          fill="currentColor"
          fillOpacity={0.45}
        >
          {STAT_KEYS.map((k, i) => (
            <text key={k} x={RADAR_LABELS[i][0]} y={RADAR_LABELS[i][1]} textAnchor={RADAR_LABELS[i][3]}>
              {k}
            </text>
          ))}
        </g>
        <g style={{ fontSize: 13, fontWeight: 800 }} fill="currentColor">
          {STAT_KEYS.map((k, i) => (
            <text
              key={k}
              x={RADAR_LABELS[i][0]}
              y={RADAR_LABELS[i][2]}
              textAnchor={RADAR_LABELS[i][3]}
              fill={k === worst ? "#6FA8FF" : "currentColor"}
            >
              {stats[k]}
            </text>
          ))}
        </g>
      </svg>

      <div className="mt-3.5 flex w-full items-center justify-between border-t border-contraste/9 pt-3.5">
        {/* Une carte parfaitement plate n'a pas de point faible : le dire, plutôt
            que d'annoncer « −0 » sur un critère pris au hasard. */}
        {stats[best] === stats[worst] ? (
          <p className="text-[12.5px] text-foreground/45">Profil parfaitement équilibré</p>
        ) : (
          <>
            <p className="text-[12.5px] text-foreground/45">Point faible : {STAT_FR[worst]}</p>
            <p className="mono-label text-primary">
              −{stats[best] - stats[worst]} VS {best}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Deux profils de jeu sur le même radar : le sien en plein (polygone blanc),
 * le tien en pointillés. À chaque sommet, les deux notes, la plus haute en
 * plein. Noir et blanc.
 */
export function RadarDuel({ toi, lui, nomLui }: { toi: Player["stats"]; lui: Player["stats"]; nomLui: string }) {
  const CX = 110;
  const CY = 110;
  const R = 84;
  const angle = (i: number) => -Math.PI / 2 + (i * Math.PI) / 3;
  const px = (i: number, r: number) => (CX + Math.cos(angle(i)) * r).toFixed(1);
  const py = (i: number, r: number) => (CY + Math.sin(angle(i)) * r).toFixed(1);
  const ring = (f: number) => STAT_KEYS.map((_, i) => `${px(i, R * f)},${py(i, R * f)}`).join(" ");
  const poly = (s: Player["stats"]) => STAT_KEYS.map((k, i) => `${px(i, (R * s[k]) / 100)},${py(i, (R * s[k]) / 100)}`).join(" ");

  return (
    <section className="glass flex flex-col items-center rounded-[28px] px-[18px] pt-5 pb-4">
      <p className="mono-label w-full text-foreground/40">Profil de jeu</p>
      <svg viewBox="-12 -10 244 248" className="mt-2 w-full max-w-[258px] overflow-visible text-contraste">
        <polygon points={ring(1)} fill="currentColor" fillOpacity={0.035} stroke="currentColor" strokeOpacity={0.14} strokeWidth="1" />
        <polygon points={ring(0.75)} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth="1" />
        <polygon points={ring(0.5)} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth="1" />
        <polygon points={ring(0.25)} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth="1" />
        <path d={STAT_KEYS.map((_, i) => `M${CX},${CY} L${px(i, R)},${py(i, R)}`).join(" ")} stroke="currentColor" strokeOpacity={0.1} strokeWidth="1" />
        <polygon points={poly(lui)} fill="currentColor" fillOpacity={0.16} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <polygon points={poly(toi)} fill="none" stroke="currentColor" strokeOpacity={0.75} strokeWidth="1.6" strokeDasharray="4 3" strokeLinejoin="round" />
        <g style={{ fontFamily: "var(--font-jbmono)", fontSize: 9, letterSpacing: 1.4 }} fill="currentColor" fillOpacity={0.45}>
          {STAT_KEYS.map((k, i) => (
            <text key={k} x={RADAR_LABELS[i][0]} y={RADAR_LABELS[i][1]} textAnchor={RADAR_LABELS[i][3]}>
              {k}
            </text>
          ))}
        </g>
        <g style={{ fontSize: 12, fontWeight: 800 }}>
          {STAT_KEYS.map((k, i) => (
            <text key={k} x={RADAR_LABELS[i][0]} y={RADAR_LABELS[i][2]} textAnchor={RADAR_LABELS[i][3]}>
              <tspan fill="currentColor" fillOpacity={toi[k] >= lui[k] ? 1 : 0.4}>{toi[k]}</tspan>
              <tspan fill="currentColor" fillOpacity={0.3}> · </tspan>
              <tspan fill="currentColor" fillOpacity={lui[k] >= toi[k] ? 1 : 0.4}>{lui[k]}</tspan>
            </text>
          ))}
        </g>
      </svg>
      <div className="mt-2 flex w-full items-center justify-center gap-5 text-[12.5px] text-foreground/60">
        <span className="flex items-center gap-1.5">
          <svg width="18" height="4" aria-hidden><line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 3" /></svg>
          Toi
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="4" aria-hidden className="text-contraste"><line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="2" /></svg>
          {nomLui}
        </span>
      </div>
    </section>
  );
}
