"use client";

// Socle visuel commun à toutes les cartes SFL (joueur Standard/Rare et
// cartes Boost MVP/Impact/Défensive) : même écusson, même taille, même
// disposition (logo, OVR, photo, nom, stats, pied). Seul le thème change.

import { useId, useState } from "react";
import { STAT_KEYS, type Stats, type StatKey } from "@/lib/sfl/engine";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import { Crown, Flame, ShieldCheck, Gem, Star, Target, Send, BadgeCheck, Scale } from "lucide-react";

export const display = {
  fontFamily: "var(--font-anton), 'Arial Black', sans-serif",
  textTransform: "uppercase" as const,
};
export const condensed = {
  fontFamily: "var(--font-barlow), 'Arial Narrow', sans-serif",
};

// Grain papier (bruit SVG inline, aucun asset externe)
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

export interface CardTheme {
  /** brush = coups de pinceau (cartes identité) · rays = énergie radiante (cartes Boost) */
  motif: "brush" | "rays";
  frameBg: string;
  framePad: number;
  bg: string;
  text: string;
  accent: string;
  label: string;
  nameColor: string;
  nameGrad: string | null;
  divider: string;
  ballA: string;
  ballB: string;
  logoBar: string;
  logoColor: string;
  wordmarkColor: string;
  diamondBg: string;
  diamondBorder: string;
  strokeColors?: [string, string];
  strokeDark?: string;
  raysBg?: string;
  grainOpacity: number;
  grainBlend: "multiply" | "screen";
  fadeOverlay: string | null;
  /** Couleur vers laquelle le bas de la photo s'estompe (évite une coupe nette). */
  photoFadeTo: string;
  innerBorder?: string;
  glow: string;
  banner: { label: string; sub?: string; ring: string; ring2: string; text: string } | null;
  glyph?: "crown" | "flame" | "shield" | "gem" | "star" | "target" | "send" | "badge" | "scale";
  glyphColor?: string;
}

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

// Coups de pinceau diagonaux, rugosité via feTurbulence (cartes identité)
function BrushStrokes({
  id,
  opacity,
  colors,
  dark,
}: {
  id: string;
  opacity: number;
  colors: [string, string];
  dark: string;
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
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <g filter={`url(#${id})`} opacity={opacity} transform="rotate(-32 130 150)">
        <rect x="-60" y="86" width="420" height="26" fill={`url(#${id}-o)`} />
        <rect x="-40" y="120" width="400" height="12" fill={dark} />
        <rect x="-70" y="140" width="430" height="18" fill={`url(#${id}-o)`} opacity="0.7" />
      </g>
    </svg>
  );
}

// Particules d'énergie (cartes Boost)
function EnergyParticles({ color }: { color: string }) {
  const pts: [number, number, number][] = [
    [40, 50, 1.5], [220, 40, 1.1], [235, 145, 1.7], [25, 200, 1.3],
    [205, 245, 1.5], [65, 115, 1], [190, 85, 1.3], [115, 35, 1],
    [245, 205, 1.1], [50, 270, 1.4], [150, 300, 1],
  ];
  return (
    <svg
      viewBox="0 0 260 330"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-hidden
    >
      {pts.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={0.75} />
      ))}
    </svg>
  );
}

const GLYPHS = {
  crown: Crown,
  flame: Flame,
  shield: ShieldCheck,
  gem: Gem,
  star: Star,
  target: Target,
  send: Send,
  badge: BadgeCheck,
  scale: Scale,
};

/**
 * Disposition du bloc des 6 stats.
 * - `row`   : les 6 alignées sur une seule ligne (disposition d'origine)
 * - `fut`   : 2 colonnes de 3, libellé à gauche / valeur à droite — la
 *             convention des vraies cartes de foot, la plus lisible
 * - `stack` : 2 colonnes de 3, libellé au-dessus de la valeur, centré
 * - `bars`  : comme `fut`, plus une micro-jauge de niveau sous chaque stat
 */
export type StatsLayout = "row" | "fut" | "stack" | "bars";

// Échelle des jauges : on part de 50 plutôt que de 0, sinon toutes les
// barres sont pleines aux trois quarts et ne distinguent plus rien.
const BAR_FLOOR = 50;

export function CardShell({
  theme,
  size = 1,
  ovrValue,
  poste,
  name,
  stats,
  photoName,
  highlightStats,
  statsLayout = "row",
}: {
  theme: CardTheme;
  size?: number;
  ovrValue: number;
  poste: string;
  name: string;
  stats: Stats;
  photoName: string;
  highlightStats?: StatKey[];
  statsLayout?: StatsLayout;
}) {
  const rawId = useId();
  const fid = `sfl-brush-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const photoUrl = usePlayerPhoto(photoName);
  // On mémorise l'URL chargée / en échec plutôt qu'un simple état : quand le
  // joueur ajoute sa photo, l'URL change et la carte retente le chargement.
  // Avec un booléen, une carte passée en échec le serait restée pour toujours.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photoOk = loadedUrl === photoUrl;
  const photoFailed = failedUrl === photoUrl;
  const S = (n: number) => n * size;
  const th = theme;
  const Glyph = th.glyph ? GLYPHS[th.glyph] : null;

  const bottomPad = th.banner ? 40 : 22;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        paddingBottom: S(bottomPad),
        ...condensed,
      }}
    >
      <div
        data-card-part="frame"
        style={{
          padding: S(th.framePad),
          borderRadius: S(20),
          background: th.frameBg,
          boxShadow: th.glow,
        }}
      >
        <div
          data-card-part="body"
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
          {/* Grain */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: GRAIN,
              opacity: th.grainOpacity,
              mixBlendMode: th.grainBlend,
              pointerEvents: "none",
            }}
          />

          {/* Motif de fond */}
          {th.motif === "brush" && th.strokeColors && (
            <BrushStrokes id={fid} opacity={0.85} colors={th.strokeColors} dark={th.strokeDark ?? "#181310"} />
          )}
          {th.motif === "rays" && (
            <>
              <div style={{ position: "absolute", inset: 0, background: th.raysBg }} />
              <EnergyParticles color={th.ballA} />
            </>
          )}

          {th.fadeOverlay && <div style={{ position: "absolute", inset: 0, background: th.fadeOverlay }} />}
          {th.innerBorder && (
            <div
              style={{
                position: "absolute",
                inset: S(6),
                borderRadius: S(13),
                border: `1px solid ${th.innerBorder}`,
                pointerEvents: "none",
                zIndex: 5,
              }}
            />
          )}

          {/* Glyphe premium (Boost uniquement), coin haut-droit */}
          {Glyph && (
            <div
              style={{
                position: "absolute",
                top: S(14),
                right: S(14),
                zIndex: 3,
                color: th.glyphColor ?? th.accent,
                filter: `drop-shadow(0 0 ${S(6)}px ${th.glyphColor ?? th.accent})`,
              }}
            >
              <Glyph width={S(22)} height={S(22)} strokeWidth={2} fill={th.glyph === "crown" ? "currentColor" : "none"} />
            </div>
          )}

          {/* Photo (ou initiale) — buste cadré tête au centre-haut de la carte */}
          <div
            data-card-part="player"
            style={{
              position: "absolute",
              top: S(32),
              left: "50%",
              transform: "translateX(-50%)",
              width: S(232),
              height: S(160),
              overflow: "hidden",
              zIndex: 2,
            }}
          >
            {!photoFailed && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                onLoad={() => setLoadedUrl(photoUrl)}
                onError={() => setFailedUrl(photoUrl)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "50% 12%",
                  filter: "drop-shadow(0 6px 14px rgba(0,0,0,.35))",
                  visibility: photoOk ? "visible" : "hidden",
                }}
              />
            )}
            {!photoOk && (
              <div
                style={{
                  ...display,
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: S(120),
                  lineHeight: 1,
                  color: `${th.text}14`,
                  WebkitTextStroke: `${S(1.5)}px ${th.text}66`,
                }}
              >
                {photoName[0]}
              </div>
            )}
            {/* Fondu bas de photo : évite la coupe nette du buste détouré */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(180deg, transparent 68%, ${th.photoFadeTo} 100%)`,
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Logo + note + poste */}
          <div style={{ position: "absolute", top: S(13), left: S(15), zIndex: 3 }}>
            <div
              style={{
                ...display,
                fontStyle: "italic",
                fontSize: S(24),
                lineHeight: 0.95,
                color: th.logoColor,
                textShadow: th.motif === "rays" ? `0 0 ${S(10)}px ${th.accent}88` : "none",
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
                color: th.wordmarkColor,
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
                textShadow: th.motif === "rays" ? `0 ${S(2)}px ${S(8)}px rgba(0,0,0,.8)` : "none",
              }}
            >
              {ovrValue}
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
              {poste}
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
                color: th.nameGrad ? "transparent" : th.nameColor,
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
              {name}
            </div>
          </div>

          {/* Stats */}
          <div
            data-card-part="stats"
            style={{
              position: "absolute",
              left: S(14),
              right: S(14),
              // Trois lignes au lieu d'une : le bloc remonte pour tenir
              // sous le nom sans déborder du bas de la carte.
              top: S(statsLayout === "row" ? 252 : 240),
              borderTop: `1px solid ${th.divider}`,
              paddingTop: S(statsLayout === "row" ? 9 : 7),
              display: "grid",
              // `column` remplit colonne par colonne : VIT/TIR/PAS à gauche,
              // DRI/DEF/PHY à droite — et non en zigzag ligne par ligne.
              ...(statsLayout === "row"
                ? { gridTemplateColumns: "repeat(6,1fr)" }
                : {
                    gridTemplateColumns: "repeat(2,1fr)",
                    gridTemplateRows: "repeat(3,1fr)",
                    gridAutoFlow: "column",
                    columnGap: S(12),
                  }),
              zIndex: 4,
            }}
          >
            {STAT_KEYS.map((k) => {
              const active = highlightStats?.includes(k);
              const labelColor = active ? th.accent : th.label;
              const valueColor = active ? th.accent : th.text;
              const cell = {
                borderRadius: S(7),
                background: active ? `${th.accent}26` : "transparent",
                boxShadow: active ? `0 0 0 ${S(1.2)}px ${th.accent}66` : "none",
              };

              if (statsLayout === "row") {
                return (
                  <div key={k} style={{ ...cell, textAlign: "center", padding: `${S(2)}px 0` }}>
                    <div
                      style={{
                        fontSize: S(8.5),
                        fontWeight: 800,
                        letterSpacing: S(1),
                        color: labelColor,
                        textTransform: "uppercase",
                      }}
                    >
                      {k}
                    </div>
                    <div style={{ ...display, fontSize: S(21), lineHeight: 1.15, color: valueColor }}>
                      {stats[k]}
                    </div>
                  </div>
                );
              }

              if (statsLayout === "stack") {
                return (
                  <div key={k} style={{ ...cell, textAlign: "center", padding: `${S(1)}px 0` }}>
                    <div
                      style={{
                        fontSize: S(8),
                        fontWeight: 800,
                        letterSpacing: S(1),
                        color: labelColor,
                        textTransform: "uppercase",
                      }}
                    >
                      {k}
                    </div>
                    <div style={{ ...display, fontSize: S(19), lineHeight: 1.05, color: valueColor }}>
                      {stats[k]}
                    </div>
                  </div>
                );
              }

              // `fut` et `bars` : libellé à gauche, valeur à droite, alignés
              // sur la même ligne de base — la lecture se fait en colonne.
              return (
                <div key={k} style={{ ...cell, padding: `${S(1)}px ${S(3)}px` }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: S(4),
                    }}
                  >
                    <span
                      style={{
                        fontSize: S(9),
                        fontWeight: 800,
                        letterSpacing: S(0.8),
                        color: labelColor,
                        textTransform: "uppercase",
                      }}
                    >
                      {k}
                    </span>
                    <span
                      style={{
                        ...display,
                        fontSize: S(20),
                        lineHeight: 1,
                        color: valueColor,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {stats[k]}
                    </span>
                  </div>
                  {statsLayout === "bars" && (
                    <div
                      style={{
                        height: S(2),
                        marginTop: S(1.5),
                        borderRadius: S(2),
                        background: `${th.label}33`,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(0, Math.min(100, ((stats[k] - BAR_FLOOR) / (99 - BAR_FLOOR)) * 100))}%`,
                          background: active ? th.accent : th.text,
                          opacity: active ? 1 : 0.55,
                          borderRadius: S(2),
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pointe basse (losange) + ballon */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: S(th.banner ? 22 : 4),
          transform: "translateX(-50%) rotate(45deg)",
          width: S(30),
          height: S(30),
          background: th.diamondBg,
          borderRight: `${S(th.banner ? 2.5 : 1.5)}px solid ${th.diamondBorder}`,
          borderBottom: `${S(th.banner ? 2.5 : 1.5)}px solid ${th.diamondBorder}`,
          borderRadius: S(4),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: S(th.banner ? 24 : 6),
          transform: "translateX(-50%)",
          zIndex: 2,
          lineHeight: 0,
        }}
      >
        <Ball size={S(19)} a={th.ballA} b={th.ballB} />
      </div>

      {/* Bannière (Rare + Boost) */}
      {th.banner && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            transform: "translateX(-50%)",
            width: S(150),
            clipPath: "polygon(7% 0,93% 0,100% 50%,93% 100%,7% 100%,0 50%)",
            background: `linear-gradient(160deg,${th.banner.ring},${th.banner.ring2})`,
            padding: S(1.5),
          }}
        >
          <div
            style={{
              clipPath: "polygon(7% 0,93% 0,100% 50%,93% 100%,7% 100%,0 50%)",
              background: "#100C08",
              textAlign: "center",
              padding: `${S(4)}px 0 ${S(3)}px`,
            }}
          >
            <div
              style={{
                fontSize: S(10),
                fontWeight: 800,
                letterSpacing: S(4),
                color: th.banner.text,
                textTransform: "uppercase",
              }}
            >
              {th.banner.label}
            </div>
            {th.banner.sub && (
              <div
                style={{
                  fontSize: S(5.5),
                  fontWeight: 700,
                  letterSpacing: S(2),
                  color: `${th.banner.text}aa`,
                  textTransform: "uppercase",
                  marginTop: S(1),
                }}
              >
                {th.banner.sub}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
