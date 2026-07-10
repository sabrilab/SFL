// Carte joueur SFL — identité visuelle or/brun, volontairement identique
// en thème clair et sombre (comme une carte physique à collectionner).

import { STAT_KEYS, ovr, rareStats, type Player } from "@/lib/sfl/engine";

const GOLD = "#E8C87A";
const GOLD_DIM = "#8A744A";
const ORANGE = "#FF5A1F";
const CARD_BG = "linear-gradient(165deg, #2A1D10 0%, #171009 55%, #33200C 100%)";

const display = {
  fontFamily: "var(--font-anton), 'Arial Black', sans-serif",
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};
const condensed = {
  fontFamily: "var(--font-barlow), 'Arial Narrow', sans-serif",
};

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
  const s = mode === "rare" ? rareStats(player.stats) : player.stats;
  const note = ovr(s);
  const ring = mode === "rare" ? GOLD : GOLD_DIM;

  return (
    <div
      style={{
        position: "relative",
        width: 250 * size,
        borderRadius: 14 * size,
        padding: `${20 * size}px ${16 * size}px ${16 * size}px`,
        background: CARD_BG,
        border: `1.5px solid ${ring}`,
        boxShadow: "0 16px 44px rgba(0,0,0,.55)",
        overflow: "hidden",
        color: GOLD,
        ...condensed,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 75% 15%, rgba(232,200,122,.18), transparent 55%)",
        }}
      />

      <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ ...display, fontSize: 42 * size, color: GOLD, lineHeight: 1 }}>{note}</div>
          <div style={{ fontSize: 14 * size, letterSpacing: 2, color: ORANGE, fontWeight: 800 }}>
            {player.poste}
          </div>
        </div>
        <div
          style={{
            textAlign: "right",
            fontSize: 10 * size,
            letterSpacing: 2,
            color: GOLD_DIM,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          SFL
          <br />
          SUNDAY
          <br />
          FIVE
          <br />
          LEAGUE
        </div>
      </div>

      {/* Emplacement photo — initiale en attendant les vraies photos */}
      <div
        style={{
          position: "relative",
          margin: `${12 * size}px auto`,
          width: 120 * size,
          height: 120 * size,
          borderRadius: "50%",
          background: "linear-gradient(180deg,#3A2A15,#14100A)",
          border: `2px solid ${ring}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...display,
          fontSize: 48 * size,
          color: GOLD,
        }}
      >
        {player.name[0]}
      </div>

      {player.mvp > 0 && (
        <div
          style={{
            position: "relative",
            margin: `0 auto ${10 * size}px`,
            width: "fit-content",
            border: `1px solid ${GOLD}`,
            borderRadius: 6,
            padding: `${3 * size}px ${14 * size}px`,
            fontSize: 12 * size,
            letterSpacing: 3,
            color: GOLD,
            fontWeight: 800,
          }}
        >
          ★ MVP ★
        </div>
      )}

      <div
        style={{
          position: "relative",
          textAlign: "center",
          ...display,
          fontSize: 30 * size,
          color: "#F2E3BC",
          letterSpacing: 3,
          marginBottom: 12 * size,
        }}
      >
        {player.name}
      </div>

      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "repeat(6,1fr)",
          borderTop: `1px solid ${GOLD_DIM}`,
          paddingTop: 10 * size,
        }}
      >
        {STAT_KEYS.map((k) => (
          <div key={k} style={{ textAlign: "center" }}>
            <div style={{ ...display, fontSize: 17 * size, color: GOLD }}>{s[k]}</div>
            <div
              style={{
                fontSize: 9 * size,
                letterSpacing: 1.5,
                color: GOLD_DIM,
                fontWeight: 700,
              }}
            >
              {k}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
