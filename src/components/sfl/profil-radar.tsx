"use client";

// Le profil de jeu d'un joueur : le radar hexagonal de ses six notes, le
// point faible en bleu. Il vivait dans Ma carte ; depuis le 22/10 (Sabri :
// « on le met à la place de Comparer ma carte dans Recherche »), il est sur
// le profil d'un joueur qu'on recherche, sous son nom.

import { STAT_KEYS, type Player } from "@/lib/sfl/engine";

/* ------------------------- Radar « PROFIL DE JEU » ------------------------ */
// Géométrie reprise du design : hexagone pointe en haut, centre (110,110),
// rayon 84, anneaux à 100/75/50/25 %, rayon de valeur = R × note/100.
// Polygone blanc, points blancs — sauf le point faible, en accent bleu.

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

      <svg viewBox="-12 -10 244 248" className="mt-2.5 w-full max-w-[258px] overflow-visible">
        <polygon points={ring(1)} fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        <polygon points={ring(0.75)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <polygon points={ring(0.5)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <polygon points={ring(0.25)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <path
          d={STAT_KEYS.map((_, i) => `M${CX},${CY} L${px(i, R)},${py(i, R)}`).join(" ")}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
        <polygon
          points={STAT_KEYS.map((_, i) => `${px(i, value(i))},${py(i, value(i))}`).join(" ")}
          fill="rgba(255,255,255,0.16)"
          stroke="#fff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {STAT_KEYS.map((k, i) => (
          <circle
            key={k}
            cx={px(i, value(i))}
            cy={py(i, value(i))}
            r="3.4"
            fill={k === worst ? "#6FA8FF" : "#fff"}
          />
        ))}
        <g
          style={{ fontFamily: "var(--font-jbmono)", fontSize: 9, letterSpacing: 1.4 }}
          fill="rgba(255,255,255,0.45)"
        >
          {STAT_KEYS.map((k, i) => (
            <text key={k} x={RADAR_LABELS[i][0]} y={RADAR_LABELS[i][1]} textAnchor={RADAR_LABELS[i][3]}>
              {k}
            </text>
          ))}
        </g>
        <g style={{ fontSize: 13, fontWeight: 800 }} fill="#fff">
          {STAT_KEYS.map((k, i) => (
            <text
              key={k}
              x={RADAR_LABELS[i][0]}
              y={RADAR_LABELS[i][2]}
              textAnchor={RADAR_LABELS[i][3]}
              fill={k === worst ? "#6FA8FF" : "#fff"}
            >
              {stats[k]}
            </text>
          ))}
        </g>
      </svg>

      <div className="mt-3.5 flex w-full items-center justify-between border-t border-white/9 pt-3.5">
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
