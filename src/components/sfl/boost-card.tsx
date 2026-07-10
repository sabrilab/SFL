// Cartes Boost SFL : MVP (or), Joueur Impact (feu), Défensive (bleu).
// Gagnées via les figures de match — n'altèrent pas la carte principale.

import { STAT_KEYS, type BoostCardData } from "@/lib/sfl/engine";

const display = {
  fontFamily: "var(--font-anton), 'Arial Black', sans-serif",
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};
const condensed = {
  fontFamily: "var(--font-barlow), 'Arial Narrow', sans-serif",
};

const THEMES = {
  mvp: {
    label: "MVP DU MATCH",
    edition: null as string | null,
    ring: "#F4C542",
    ring2: "#8A5A12",
    bg: "radial-gradient(120% 90% at 50% 12%, #6A4E12 0%, #241A06 42%, #0B0803 100%)",
    rays: "conic-gradient(from 210deg at 62% 34%, rgba(244,197,66,.55), transparent 42%, rgba(244,197,66,.32) 62%, transparent 82%)",
    name: "linear-gradient(180deg,#FBE9A8,#C9962E)",
    stat: "#F4C542",
    statLabel: "#B98F32",
    ovr: "#F4E4A6",
    pos: "#F4C542",
    crown: true,
    laurel: true,
    star: false,
  },
  impact: {
    label: "JOUEUR IMPACT",
    edition: "SPÉCIAL ÉDITION",
    ring: "#FF5A1F",
    ring2: "#7A1E05",
    bg: "radial-gradient(120% 90% at 50% 10%, #5A1806 0%, #250A03 45%, #0A0402 100%)",
    rays: "linear-gradient(115deg, transparent 30%, rgba(255,90,31,.5) 48%, rgba(255,150,60,.7) 55%, rgba(255,90,31,.4) 62%, transparent 78%)",
    name: "linear-gradient(180deg,#F2EDE6,#B9B0A6)",
    stat: "#F5EFE8",
    statLabel: "#C77C4E",
    ovr: "#F2EDE6",
    pos: "#FF7A3F",
    crown: false,
    laurel: false,
    star: true,
  },
  def: {
    label: "DÉFENSIVE",
    edition: "DEFENSIVE SPECIAL",
    ring: "#7FD4FF",
    ring2: "#1C4E77",
    bg: "radial-gradient(120% 90% at 50% 22%, #123A5C 0%, #0A1B30 48%, #04070F 100%)",
    rays: "radial-gradient(60% 46% at 50% 30%, rgba(64,170,255,.5), transparent 62%)",
    name: "linear-gradient(180deg,#EAF4FF,#9DB3C6)",
    stat: "#EAF4FF",
    statLabel: "#5B8FB5",
    ovr: "#DCEBFB",
    pos: "#7FD4FF",
    crown: false,
    laurel: false,
    star: false,
  },
};

export const BOOST_LABELS: Record<BoostCardData["type"], string> = {
  mvp: "MVP",
  impact: "Impact",
  def: "Défensive",
};

export function BoostCard({ card, size = 1 }: { card: BoostCardData; size?: number }) {
  const th = THEMES[card.type];
  const S = (n: number) => n * size;

  return (
    <div
      style={{
        position: "relative",
        width: S(260),
        borderRadius: S(16),
        overflow: "hidden",
        background: th.bg,
        border: `${S(2)}px solid ${th.ring}`,
        boxShadow: `0 ${S(14)}px ${S(36)}px rgba(0,0,0,.55), inset 0 0 ${S(40)}px rgba(0,0,0,.5)`,
        color: "#fff",
        ...condensed,
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: th.rays, opacity: 0.9 }} />
      <div
        style={{
          position: "absolute",
          inset: S(6),
          border: `1px solid ${th.ring}66`,
          borderRadius: S(12),
          pointerEvents: "none",
        }}
      />

      {/* En-tête */}
      <div style={{ position: "relative", padding: `${S(14)}px ${S(16)}px 0`, textAlign: "center" }}>
        <div
          style={{
            ...display,
            fontStyle: "italic",
            fontSize: S(22),
            color: "#fff",
            textShadow: `0 0 ${S(14)}px ${th.ring}`,
          }}
        >
          S<span style={{ color: th.ring }}>F</span>L
        </div>
        <div style={{ fontSize: S(8), letterSpacing: S(3), color: "#ffffffbb", fontWeight: 700 }}>
          SUNDAY FIVE LEAGUE
        </div>
        {th.crown && (
          <div style={{ fontSize: S(20), marginTop: S(2), filter: `drop-shadow(0 0 ${S(6)}px ${th.ring})` }}>
            ♔
          </div>
        )}
      </div>

      {/* OVR + poste */}
      <div style={{ position: "absolute", top: S(58), left: S(14), zIndex: 3, textAlign: "left" }}>
        {card.type === "impact" && (
          <div style={{ fontSize: S(11), letterSpacing: S(2), color: "#fff", fontWeight: 800 }}>OVR</div>
        )}
        <div
          style={{
            ...display,
            fontSize: S(40),
            lineHeight: 0.9,
            color: th.ovr,
            textShadow: `0 ${S(2)}px ${S(6)}px #000`,
          }}
        >
          {card.ovr}
        </div>
        <div style={{ ...display, fontSize: S(15), color: th.pos }}>{card.poste}</div>
        {card.type === "def" && (
          <div style={{ marginTop: S(8), width: S(50), textAlign: "center" }}>
            <div
              style={{
                width: S(46),
                height: S(52),
                margin: "0 auto",
                background: "linear-gradient(180deg,#cfd8e2,#3a4a5c)",
                clipPath: "polygon(50% 0,100% 22%,100% 74%,50% 100%,0 74%,0 22%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${th.ring}`,
              }}
            >
              <span style={{ ...display, fontSize: S(15), color: "#1a2430" }}>DEF</span>
            </div>
            <div
              style={{
                fontSize: S(6.5),
                letterSpacing: S(1),
                color: th.ring,
                fontWeight: 800,
                marginTop: S(2),
              }}
            >
              DEFENSIVE
              <br />
              SPECIAL
            </div>
          </div>
        )}
      </div>

      {/* Emplacement photo */}
      <div
        style={{
          position: "relative",
          height: S(150),
          margin: `${S(6)}px ${S(10)}px 0`,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: S(120),
            height: S(140),
            borderRadius: `${S(60)}px ${S(60)}px ${S(12)}px ${S(12)}px`,
            background: `linear-gradient(180deg, ${th.ring}22, transparent)`,
            border: `1px dashed ${th.ring}55`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: S(9),
            letterSpacing: S(2),
            color: "#ffffff88",
            textAlign: "center",
            padding: S(8),
          }}
        >
          PHOTO
          <br />
          {card.player.toUpperCase()}
        </div>
      </div>

      {/* Nom */}
      <div style={{ position: "relative", textAlign: "center", marginTop: S(-6) }}>
        <div
          style={{
            ...display,
            fontSize: S(34),
            lineHeight: 1,
            background: th.name,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: `drop-shadow(0 ${S(2)}px ${S(3)}px #000)`,
          }}
        >
          {card.player.toUpperCase()}
        </div>
      </div>

      {/* Bannière du type */}
      <div style={{ position: "relative", textAlign: "center", margin: `${S(6)}px auto ${S(4)}px`, width: "82%" }}>
        <div
          style={{
            ...display,
            fontSize: S(17),
            color: "#fff",
            padding: `${S(5)}px 0`,
            background: `linear-gradient(90deg, transparent, ${th.ring2}, ${th.ring}, ${th.ring2}, transparent)`,
            clipPath: "polygon(6% 0,94% 0,100% 50%,94% 100%,6% 100%,0 50%)",
            textShadow: `0 ${S(1)}px ${S(2)}px #000`,
          }}
        >
          {th.star ? "★ " : ""}
          {th.label}
          {th.star ? " ★" : ""}
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "repeat(6,1fr)",
          padding: `${S(8)}px ${S(10)}px`,
          borderTop: `1px solid ${th.ring}44`,
          background: "rgba(0,0,0,.35)",
        }}
      >
        {STAT_KEYS.map((k) => (
          <div key={k} style={{ textAlign: "center" }}>
            <div style={{ fontSize: S(8.5), letterSpacing: S(1), color: th.statLabel, fontWeight: 800 }}>
              {k}
            </div>
            <div style={{ ...display, fontSize: S(18), color: th.stat, textShadow: `0 0 ${S(6)}px ${th.ring}55` }}>
              {card.stats[k]}
            </div>
          </div>
        ))}
      </div>

      {/* Pied */}
      <div style={{ position: "relative", textAlign: "center", padding: `${S(4)}px 0 ${S(8)}px` }}>
        {th.laurel && <div style={{ fontSize: S(16), color: th.ring }}>🌿 ⚽ 🌿</div>}
        {th.edition && (
          <div style={{ fontSize: S(8), letterSpacing: S(4), color: `${th.ring}cc`, fontWeight: 800, marginTop: S(2) }}>
            {th.edition}
          </div>
        )}
      </div>
    </div>
  );
}
