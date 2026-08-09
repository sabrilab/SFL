"use client";

// Carte joueur « éditoriale » — portage DOM/CSS fidèle de la carte retenue
// dans le design Kickoff (card3d.js, layouts « editorial » et « legend »,
// police sans-serif). Photo plein cadre sur fond teinté, typo Anton +
// JetBrains Mono, rangée de six stats, filigrane géant, vignette et grain.
//
// Le moteur du design travaille sur un canvas de 1024×1536 : toutes les
// cotes ci-dessous sont exprimées dans ces unités et converties en pixels
// par `u()` — ainsi la spec du design reste lisible et vérifiable ligne à
// ligne contre card3d.js.
//
// Deux variantes, comme dans le design : « sombre » (encre blanche, voiles
// noirs) et « clair » (encre noire, plaques ivoire). Les cartes restent des
// objets — elles ne suivent pas le thème de l'app, la variante est un choix.

import { useId, useState } from "react";
import { STAT_KEYS, type StatKey, type Stats } from "@/lib/sfl/engine";
import { usePlayerPhoto } from "@/hooks/use-player-photo";

export type CardTint = "standard" | "or" | "violet" | "rouge";
export type CardVariant = "sombre" | "clair";
export type CardLayout = "editorial" | "legend";

// Teintes du design (dégradé sous la photo, du haut-gauche au bas-droit).
const TINTS: Record<CardTint, [string, string, string]> = {
  standard: ["#2f3a2a", "#1d2320", "#101413"],
  or: ["#4a3a16", "#2c2411", "#14110b"],
  violet: ["#33285a", "#1f1a38", "#12101d"],
  rouge: ["#4a1c22", "#2a1116", "#140a0d"],
};

const ACCENT = "#F0F0F0";
const W = 1024;
const H = 1536;
const PAD = 68;

// Grain du design (turbulence SVG en tuile, comme grain() dans card3d.js).
const GRAIN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='96' height='96' filter='url(%23n)'/></svg>`
  );

const ANTON = "var(--font-anton), Anton, sans-serif";
const JBMONO = "var(--font-jbmono), ui-monospace, monospace";

/** Réduit la taille du nom pour tenir dans la largeur (fitFont du design). */
function fitName(name: string, max: number, width: number) {
  // Anton est très condensée : ~0.52 em de chasse moyenne par caractère.
  return Math.min(max, width / (0.52 * Math.max(1, name.length)));
}

export interface EditorialCardProps {
  layout?: CardLayout;
  variant?: CardVariant;
  tint?: CardTint;
  name: string;
  username?: string;
  club?: string;
  position: string;
  overall: number;
  /** Numéro de maillot — sert de filigrane ; à défaut, la note générale. */
  number?: number;
  badge?: string;
  stats: Stats;
  highlightStats?: StatKey[];
  photoName?: string;
  size?: number;
}

export function EditorialCard({
  layout = "editorial",
  variant = "sombre",
  tint = "standard",
  name,
  username,
  club = "SFL",
  position,
  overall,
  number,
  badge,
  stats,
  highlightStats,
  photoName,
  size = 1,
}: EditorialCardProps) {
  const rid = useId();
  void rid;
  const light = variant === "clair";
  // 254 px de large à taille 1 (largeur historique des cartes de l'app).
  const u = (n: number) => n * size * (254 / W);
  const INK = (a: number) => (light ? `rgba(20,21,22,${a})` : `rgba(255,255,255,${a})`);
  const SCRIM = (a: number) => (light ? `rgba(248,246,242,${a})` : `rgba(6,8,7,${a})`);
  const onAccent = light ? "rgba(252,250,246,0.95)" : "rgba(10,14,8,0.92)";
  const t = TINTS[tint];

  const photoUrl = usePlayerPhoto(photoName ?? name);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photoOk = loadedUrl === photoUrl;
  const photoFailed = failedUrl === photoUrl;

  const watermark = String(number ?? overall);
  const nameUp = name.toUpperCase();
  const isLegend = layout === "legend";
  const nameSize = isLegend
    ? fitName(nameUp, 200, W - PAD * 2)
    : fitName(nameUp, 210, W - PAD * 2);
  // Baseline du nom en éditorial (H-356) — le badge et l'username s'y calent.
  const ny = H - 356;

  const mono = (fs: number, w: number, ls: number, color: string) => ({
    fontFamily: JBMONO,
    fontSize: u(fs),
    fontWeight: w,
    letterSpacing: u(ls),
    color,
    lineHeight: 1,
  });

  return (
    <div
      data-card-part="body"
      style={{
        position: "relative",
        width: u(W),
        height: u(H),
        borderRadius: u(56),
        overflow: "hidden",
        background: `linear-gradient(135deg, ${t[0]} 0%, ${t[1]} 50%, ${t[2]} 100%)`,
        boxShadow: light
          ? "0 12px 34px rgba(30,26,18,0.35)"
          : "0 14px 38px rgba(0,0,0,0.55)",
        fontFamily: ANTON,
      }}
    >
      {/* Calque « joueur » du pipeline 3D : photo, filigrane et voile bas
          voyagent ensemble pour que la photo reste assombrie sous le nom
          une fois les calques séparés. */}
      <div data-card-part="player" style={{ position: "absolute", inset: 0 }}>
      {/* Photo plein cadre (ou motif d'attente du design) */}
      {!photoFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          onLoad={() => setLoadedUrl(photoUrl)}
          onError={() => setFailedUrl(photoUrl)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 10%",
            transform: "scale(1.04)",
            visibility: photoOk ? "visible" : "hidden",
          }}
        />
      )}
      {!photoOk && (
        <div aria-hidden style={{ position: "absolute", inset: 0 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `repeating-linear-gradient(45deg, transparent 0 ${u(34)}px, rgba(255,255,255,0.07) ${u(34)}px ${u(64)}px)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(circle at 50% 34%, ${ACCENT}3a, transparent 70%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "24%",
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: u(340),
              lineHeight: 1,
              color: "rgba(255,255,255,0.14)",
            }}
          >
            {nameUp[0]}
          </div>
        </div>
      )}

      {/* Filigrane géant */}
      <div
        style={{
          position: "absolute",
          lineHeight: 1,
          color: ACCENT,
          ...(isLegend
            ? {
                left: 0,
                right: 0,
                textAlign: "center" as const,
                top: u(H * 0.72 - 900 * 0.8),
                fontSize: u(900),
                opacity: light ? 0.5 : 0.62,
                mixBlendMode: (light ? "multiply" : "overlay") as React.CSSProperties["mixBlendMode"],
              }
            : {
                right: u(40),
                textAlign: "right" as const,
                top: u((light ? H - 620 : H - 300) - (light ? 500 : 640) * 0.8),
                fontSize: u(light ? 500 : 640),
                opacity: light ? 0.16 : 0.3,
                mixBlendMode: (light ? "multiply" : "screen") as React.CSSProperties["mixBlendMode"],
              }),
        }}
      >
        {watermark}
      </div>

      {/* Voile bas — dans le calque joueur (voir plus haut) */}
      {(isLegend || !light) && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            top: u(H * (isLegend ? 0.46 : 0.42)),
            background: isLegend
              ? `linear-gradient(180deg, ${SCRIM(0)}, ${SCRIM(0.68)} 50%, ${SCRIM(0.97)})`
              : `linear-gradient(180deg, ${SCRIM(0)}, ${SCRIM(0.72)} 55%, ${SCRIM(0.96)})`,
          }}
        />
      )}
      </div>

      {/* Voile haut */}
      {!isLegend && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: u(380),
            background: `linear-gradient(180deg, ${SCRIM(light ? 0 : 0.82)}, ${SCRIM(0)})`,
          }}
        />
      )}

      {/* Plaques ivoire de la variante claire (éditorial uniquement) */}
      {light && !isLegend && (
        <>
          <div style={{ position: "absolute", left: u(44), top: u(44), width: u(W - 88), height: u(216), borderRadius: u(44), background: "rgba(250,249,246,0.82)", border: `${u(2)}px solid rgba(20,21,22,0.1)` }} />
          <div style={{ position: "absolute", left: u(44), top: u(H - 480), width: u(W - 88), height: u(436), borderRadius: u(44), background: "rgba(250,249,246,0.82)", border: `${u(2)}px solid rgba(20,21,22,0.1)` }} />
        </>
      )}

      {isLegend ? (
        <>
          {/* Bandeau du titre */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: u(128),
              background: ACCENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: u(fitName(badge ?? "LEGENDARY", 82, W - 120)),
                letterSpacing: u(12),
                color: onAccent,
                lineHeight: 1,
              }}
            >
              {badge ?? "LEGENDARY"}
            </span>
          </div>

          {/* Encart d'identité */}
          <div
            style={{
              position: "absolute",
              left: u(PAD),
              top: u(168),
              minWidth: u(300),
              borderRadius: u(22),
              background: SCRIM(0.72),
              padding: `${u(24)}px ${u(26)}px ${u(20)}px`,
              display: "flex",
              flexDirection: "column",
              gap: u(16),
              alignItems: "flex-start",
            }}
          >
            <span style={mono(30, 700, 5, INK(1))}>{club}</span>
            <span style={mono(26, 600, 0, INK(0.55))}>
              {position}
              {username ? ` · ${username}` : ""}
            </span>
            <span style={{ fontSize: u(54), lineHeight: 1, color: ACCENT }}>GÉN {overall}</span>
          </div>

          {/* Nom centré */}
          <div
            style={{
              position: "absolute",
              left: u(PAD),
              right: u(PAD),
              top: u(H - 250 - nameSize * 0.8),
              textAlign: "center",
              fontSize: u(nameSize),
              letterSpacing: u(2),
              lineHeight: 1,
              color: INK(1),
              whiteSpace: "nowrap",
            }}
          >
            {nameUp}
          </div>
          <div style={{ position: "absolute", left: u(PAD), right: u(PAD), top: u(H - 214), height: u(2), background: INK(0.16) }} />
        </>
      ) : (
        <>
          {/* En-tête : club, poste, disque de note */}
          <div style={{ position: "absolute", left: u(PAD), top: u(132 - 32 * 0.8), ...mono(32, 700, 9, INK(0.86)) }}>
            {club}
          </div>
          <div style={{ position: "absolute", left: u(PAD), top: u(182 - 30 * 0.8), ...mono(30, 700, 5, ACCENT) }}>
            {position.toUpperCase()}
          </div>
          <div
            style={{
              position: "absolute",
              left: u(W - PAD - 168),
              top: u(72),
              width: u(168),
              height: u(168),
              borderRadius: "50%",
              background: ACCENT,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: u(4),
            }}
          >
            <span style={{ fontSize: u(89), lineHeight: 1, color: onAccent }}>{overall}</span>
            <span style={mono(18, 700, 3, onAccent)}>GÉN</span>
          </div>

          {/* Badge éventuel, puis nom et username */}
          {badge && (
            <div
              style={{
                position: "absolute",
                left: u(PAD),
                top: u(ny - 96 - 64),
                height: u(64),
                borderRadius: u(32),
                background: ACCENT,
                display: "inline-flex",
                alignItems: "center",
                padding: `0 ${u(28)}px`,
                ...mono(28, 700, 4, onAccent),
              }}
            >
              {badge}
            </div>
          )}
          <div
            style={{
              position: "absolute",
              left: u(PAD - 4),
              right: u(PAD),
              top: u(ny - nameSize * 0.8),
              fontSize: u(nameSize),
              lineHeight: 1,
              color: INK(1),
              whiteSpace: "nowrap",
            }}
          >
            {nameUp}
          </div>
          {username && (
            <div style={{ position: "absolute", left: u(PAD), top: u(ny + 58 - 40 * 0.8), ...mono(40, 600, 0, INK(0.6)) }}>
              {username}
            </div>
          )}
          <div style={{ position: "absolute", left: u(PAD), right: u(PAD), top: u(ny + 104), height: u(2), background: INK(0.22) }} />
        </>
      )}

      {/* Rangée des six stats */}
      <div
        data-card-part="stats"
        style={{
          position: "absolute",
          left: u(PAD),
          right: u(PAD),
          top: u((isLegend ? H - 118 : H - 130) - 60 * 0.8),
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
        }}
      >
        {STAT_KEYS.map((k, i) => {
          const active = highlightStats?.includes(k);
          return (
            <div
              key={k}
              style={{
                position: "relative",
                textAlign: "center",
                borderLeft: i > 0 ? `${u(2)}px solid ${INK(isLegend ? 0.12 : 0.14)}` : "none",
              }}
            >
              <div style={{ fontSize: u(60), lineHeight: 1, color: active ? ACCENT : INK(1), textShadow: active ? `0 0 ${u(18)}px ${ACCENT}88` : "none" }}>
                {stats[k]}
              </div>
              <div style={{ marginTop: u(10), ...mono(24, 700, 3, active ? ACCENT : INK(0.55)) }}>{k}</div>
            </div>
          );
        })}
      </div>

      {/* Vignette + grain du design */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(120% 120% at 50% 45%, transparent 60%, rgba(0,0,0,${isLegend ? 0.44 : 0.4}))`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `url("${GRAIN}")`,
          backgroundSize: u(192),
          opacity: isLegend ? 0.18 : 0.16,
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}
