"use client";

// Carte joueur SFL — deux éditions fidèles aux visuels officiels :
// Standard (parchemin, coups de pinceau orange/noir) et Rare (noir & or).
// Indépendante du thème clair/sombre, comme une carte physique.

import { useId, useState } from "react";
import { ovr, rareStats, type Player, type Stats } from "@/lib/sfl/engine";

const STAT_ORDER: (keyof Stats)[] = ["VIT", "TIR", "PAS", "DRI", "PHY", "DEF"];

const display = {
  fontFamily: "var(--font-anton), 'Arial Black', sans-serif",
  textTransform: "uppercase" as const,
};
const condensed = {
  fontFamily: "var(--font-barlow), 'Arial Narrow', sans-serif",
};

// Grain papier (bruit SVG inline, aucun asset externe)
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const THEME = {
  simple: {
    frame: "#C9B488",
    bg: "linear-gradient(170deg,#F1E6CB 0%,#EADBB8 55%,#E2CFA6 100%)",
    text: "#181310",
    accent: "#B4551F",
    label: "#8A6437",
    name: "#181310",
    nameGrad: null as string | null,
    divider: "#18131022",
    ballA: "#181310",
    ballB: "#B4551F",
    logoBar: "linear-gradient(90deg,#C05A1E,#7A340F)",
    diamond: "#E2CFA6",
    strokeOpacity: 0.85,
    glow: "0 10px 30px rgba(60,40,10,.35)",
  },
  rare: {
    frame: "gold",
    bg: "radial-gradient(130% 100% at 50% 0%, #1A1206 0%, #0C0804 45%, #060402 100%)",
    text: "#F2CE7B",
    accent: "#F2CE7B",
    label: "#C9964A",
    name: "#F2CE7B",
    nameGrad: "linear-gradient(180deg,#FBE9A8 15%,#E8C266 55%,#B9852E 100%)",
    divider: "#F2CE7B33",
    ballA: "#F2CE7B",
    ballB: "#0C0804",
    logoBar: "linear-gradient(90deg,#FF6A2A,#B33E0E)",
    diamond: "#0C0804",
    strokeOpacity: 0.9,
    glow: "0 0 26px rgba(240,190,90,.35), 0 14px 38px rgba(0,0,0,.6)",
  },
};

function Ball({ size, a, b }: { size: number; a: string; b: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill={b} stroke={a} strokeWidth="1.6" />
      <polygon points="12,7.4 16.2,10.4 14.6,15.2 9.4,15.2 7.8,10.4" fill={a} />
      <g stroke={a} strokeWidth="1.2">
        <line x1="12" y1="7.4" x2="12" y2="2.6" />
        <line x1="16.2" y1="10.4" x2="20.6" y2="8.6" />
        <line x1="14.6" y1="15.2" x2="17.6" y2="19.4" />
        <line x1="9.4" y1="15.2" x2="6.4" y2="19.4" />
        <line x1="7.8" y1="10.4" x2="3.4" y2="8.6" />
      </g>
    </svg>
  );
}

// Coups de pinceau diagonaux (orange + noir), rugosité via feTurbulence
function BrushStrokes({
  id,
  opacity,
  variant,
}: {
  id: string;
  opacity: number;
  variant: "simple" | "rare";
}) {
  return (
    <svg
      viewBox="0 0 260 330"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-hidden
    >
      <defs>
        <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.12 0.9" numOctaves="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="18" />
        </filter>
        <linearGradient id={`${id}-o`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={variant === "rare" ? "#FF7A2E" : "#C86428"} />
          <stop offset="100%" stopColor={variant === "rare" ? "#B33E0E" : "#9A4517"} />
        </linearGradient>
      </defs>
      <g filter={`url(#${id})`} opacity={opacity} transform="rotate(-32 130 150)">
        <rect x="-60" y="86" width="420" height="26" fill={`url(#${id}-o)`} />
        <rect x="-40" y="120" width="400" height="12" fill={variant === "rare" ? "#180D04" : "#181310"} />
        <rect x="-70" y="140" width="430" height="18" fill={`url(#${id}-o)`} opacity="0.7" />
        {variant === "rare" && (
          <rect x="-50" y="62" width="410" height="9" fill="#FF7A2E" opacity="0.45" />
        )}
      </g>
      {variant === "rare" && (
        <g opacity="0.8">
          {[
            [40, 60, 1.4], [210, 45, 1.1], [230, 150, 1.6], [30, 210, 1.2],
            [200, 250, 1.4], [70, 120, 1], [180, 90, 1.2], [120, 40, 1],
            [240, 210, 1], [55, 275, 1.3],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#F8CE7E" opacity={0.7} />
          ))}
        </g>
      )}
    </svg>
  );
}

export type CardMode = "simple" | "rare";

export function PlayerCard({
  player,
  mode = "rare",
  size = 1,
}: {
  player: Player;
  mode?: CardMode;
  size?: number;
}) {
  const rawId = useId();
  const fid = `sfl-brush-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  // La photo n'est affichée qu'une fois réellement chargée (sinon initiale).
  const [photoState, setPhotoState] = useState<"loading" | "ok" | "none">("loading");

  const th = THEME[mode];
  const s = mode === "rare" ? rareStats(player.stats) : player.stats;
  const note = ovr(s);
  const S = (n: number) => n * size;

  const frameStyle =
    mode === "rare"
      ? {
          padding: S(3),
          borderRadius: S(20),
          background:
            "linear-gradient(160deg,#FBE9A8 0%,#C9964A 25%,#8A5A18 50%,#F0C75A 75%,#B9852E 100%)",
          boxShadow: th.glow,
        }
      : {
          padding: S(1.5),
          borderRadius: S(20),
          background: th.frame,
          boxShadow: th.glow,
        };

  return (
    <div style={{ position: "relative", display: "inline-block", paddingBottom: S(mode === "rare" ? 40 : 22), ...condensed }}>
      <div style={frameStyle}>
        <div
          style={{
            position: "relative",
            width: S(254),
            height: S(330),
            borderRadius: S(17),
            overflow: "hidden",
            background: th.bg,
            color: th.text,
          }}
        >
          {/* Grain papier */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: GRAIN,
              opacity: mode === "simple" ? 0.35 : 0.22,
              mixBlendMode: mode === "simple" ? "multiply" : "screen",
              pointerEvents: "none",
            }}
          />
          {/* Coups de pinceau */}
          <BrushStrokes id={fid} opacity={th.strokeOpacity} variant={mode} />
          {mode === "simple" && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(241,230,203,.92) 0%, rgba(241,230,203,.55) 30%, rgba(241,230,203,0) 48%, rgba(241,230,203,0) 62%, rgba(234,219,184,.9) 78%, rgba(234,219,184,.97) 100%)",
              }}
            />
          )}
          {mode === "rare" && (
            <>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(6,4,2,.55) 0%, rgba(6,4,2,0) 22%, rgba(6,4,2,0) 55%, rgba(6,4,2,.82) 78%, rgba(6,4,2,.95) 100%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: S(6),
                  borderRadius: S(13),
                  border: `1px solid #F2CE7B3a`,
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              />
            </>
          )}

          {/* Photo (ou initiale) */}
          <div
            style={{
              position: "absolute",
              top: S(10),
              left: "50%",
              transform: "translateX(-50%)",
              width: S(170),
              height: S(190),
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            {photoState !== "none" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/players/${player.name}.png`}
                alt=""
                onLoad={() => setPhotoState("ok")}
                onError={() => setPhotoState("none")}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  objectPosition: "bottom",
                  filter: "drop-shadow(0 6px 14px rgba(0,0,0,.35))",
                  visibility: photoState === "ok" ? "visible" : "hidden",
                }}
              />
            )}
            {photoState !== "ok" && (
              <div
                style={{
                  ...display,
                  position: "absolute",
                  bottom: S(24),
                  fontSize: S(120),
                  lineHeight: 1,
                  color: mode === "simple" ? "#18131014" : "#F2CE7B14",
                  WebkitTextStroke: `${S(1.5)}px ${mode === "simple" ? "#18131066" : "#F2CE7B77"}`,
                }}
              >
                {player.name[0]}
              </div>
            )}
          </div>

          {/* Logo + note + poste (colonne gauche, au-dessus de la photo) */}
          <div style={{ position: "absolute", top: S(13), left: S(15), zIndex: 3 }}>
            <div
              style={{
                ...display,
                fontStyle: "italic",
                fontSize: S(24),
                lineHeight: 0.95,
                color: mode === "simple" ? "#181310" : "#FFFFFF",
                textShadow: mode === "rare" ? `0 0 ${S(10)}px rgba(255,140,60,.55)` : "none",
                letterSpacing: 0.5,
              }}
            >
              SFL
            </div>
            <div
              style={{
                width: S(30),
                height: S(3),
                margin: `${S(2)}px 0 ${S(4)}px`,
                background: th.logoBar,
                borderRadius: S(2),
              }}
            />
            <div
              style={{
                fontSize: S(6.5),
                fontWeight: 800,
                letterSpacing: S(1.6),
                lineHeight: 1.6,
                color: mode === "simple" ? "#181310cc" : "#ffffffbb",
                textTransform: "uppercase",
              }}
            >
              Sunday
              <br />
              Five
              <br />
              League
            </div>

            <div
              style={{
                ...display,
                fontSize: S(46),
                lineHeight: 1,
                marginTop: S(12),
                color: th.text,
                textShadow: mode === "rare" ? `0 ${S(2)}px ${S(8)}px rgba(0,0,0,.8)` : "none",
              }}
            >
              {note}
            </div>
            <div
              style={{
                ...display,
                fontSize: S(15),
                letterSpacing: S(1.5),
                color: th.accent,
                marginTop: S(1),
              }}
            >
              {player.poste}
            </div>
          </div>

          {/* Nom */}
          <div
            style={{
              position: "absolute",
              top: S(202),
              left: 0,
              right: 0,
              textAlign: "center",
              zIndex: 4,
            }}
          >
            <div
              style={{
                ...display,
                fontSize: S(35),
                lineHeight: 1,
                letterSpacing: S(2),
                color: th.nameGrad ? "transparent" : th.name,
                ...(th.nameGrad
                  ? {
                      background: th.nameGrad,
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      filter: `drop-shadow(0 ${S(2)}px ${S(3)}px rgba(0,0,0,.6))`,
                    }
                  : {}),
              }}
            >
              {player.name}
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              position: "absolute",
              left: S(14),
              right: S(14),
              top: S(252),
              borderTop: `1px solid ${th.divider}`,
              paddingTop: S(9),
              display: "grid",
              gridTemplateColumns: "repeat(6,1fr)",
              zIndex: 4,
            }}
          >
            {STAT_ORDER.map((k) => (
              <div key={k} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: S(8.5),
                    fontWeight: 800,
                    letterSpacing: S(1),
                    color: th.label,
                    textTransform: "uppercase",
                  }}
                >
                  {k}
                </div>
                <div style={{ ...display, fontSize: S(21), lineHeight: 1.15, color: th.text }}>
                  {s[k]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pointe basse (losange) + ballon */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: S(mode === "rare" ? 22 : 4),
          transform: "translateX(-50%) rotate(45deg)",
          width: S(30),
          height: S(30),
          background: th.diamond,
          borderRight: `${S(mode === "rare" ? 2.5 : 1.5)}px solid ${mode === "rare" ? "#D9AC55" : th.frame}`,
          borderBottom: `${S(mode === "rare" ? 2.5 : 1.5)}px solid ${mode === "rare" ? "#D9AC55" : th.frame}`,
          borderRadius: S(4),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: S(mode === "rare" ? 24 : 6),
          transform: "translateX(-50%)",
          zIndex: 2,
          lineHeight: 0,
        }}
      >
        <Ball size={S(19)} a={th.ballA} b={mode === "simple" ? "#EADBB8" : th.ballB} />
      </div>

      {/* Bannière RARE */}
      {mode === "rare" && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            transform: "translateX(-50%)",
            width: S(140),
            clipPath: "polygon(7% 0,93% 0,100% 50%,93% 100%,7% 100%,0 50%)",
            background: "linear-gradient(160deg,#F0C75A,#8A5A18)",
            padding: S(1.5),
          }}
        >
          <div
            style={{
              clipPath: "polygon(7% 0,93% 0,100% 50%,93% 100%,7% 100%,0 50%)",
              background: "#120C05",
              textAlign: "center",
              padding: `${S(4)}px 0`,
              fontSize: S(10),
              fontWeight: 800,
              letterSpacing: S(5),
              color: "#F2CE7B",
              textTransform: "uppercase",
            }}
          >
            Rare
          </div>
        </div>
      )}
    </div>
  );
}
