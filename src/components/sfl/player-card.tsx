// Carte joueur SFL — deux éditions fidèles aux visuels officiels :
// Standard (parchemin, coups de pinceau orange/noir) et Rare (noir & or).
// Indépendante du thème clair/sombre, comme une carte physique.

import { CardShell, type CardTheme, type StatsLayout } from "./card-shell";
import { ovr, rareStats, type Player, type StatKey } from "@/lib/sfl/engine";

const IDENTITY_THEMES: Record<"simple" | "rare", CardTheme> = {
  simple: {
    motif: "brush",
    frameBg: "#C9B488",
    framePad: 1.5,
    bg: "linear-gradient(170deg,#F1E6CB 0%,#EADBB8 55%,#E2CFA6 100%)",
    text: "#181310",
    accent: "#B4551F",
    label: "#8A6437",
    nameColor: "#181310",
    nameGrad: null,
    divider: "#18131022",
    ballA: "#181310",
    ballB: "#EADBB8",
    logoBar: "linear-gradient(90deg,#C05A1E,#7A340F)",
    logoColor: "#181310",
    wordmarkColor: "#181310cc",
    diamondBg: "#E2CFA6",
    diamondBorder: "#C9B488",
    strokeColors: ["#C86428", "#9A4517"],
    strokeDark: "#181310",
    grainOpacity: 0.35,
    grainBlend: "multiply",
    fadeOverlay:
      "linear-gradient(180deg, rgba(241,230,203,.92) 0%, rgba(241,230,203,.55) 30%, rgba(241,230,203,0) 48%, rgba(241,230,203,0) 62%, rgba(234,219,184,.9) 78%, rgba(234,219,184,.97) 100%)",
    photoFadeTo: "#EADBB8",
    glow: "0 10px 30px rgba(60,40,10,.35)",
    banner: null,
  },
  rare: {
    motif: "brush",
    frameBg:
      "linear-gradient(160deg,#FBE9A8 0%,#C9964A 25%,#8A5A18 50%,#F0C75A 75%,#B9852E 100%)",
    framePad: 3,
    bg: "radial-gradient(130% 100% at 50% 0%, #1A1206 0%, #0C0804 45%, #060402 100%)",
    text: "#F2CE7B",
    accent: "#F2CE7B",
    label: "#C9964A",
    nameColor: "#F2CE7B",
    nameGrad: "linear-gradient(180deg,#FBE9A8 15%,#E8C266 55%,#B9852E 100%)",
    divider: "#F2CE7B33",
    ballA: "#F2CE7B",
    ballB: "#0C0804",
    logoBar: "linear-gradient(90deg,#FF6A2A,#B33E0E)",
    logoColor: "#FFFFFF",
    wordmarkColor: "#ffffffbb",
    diamondBg: "#0C0804",
    diamondBorder: "#D9AC55",
    strokeColors: ["#FF7A2E", "#B33E0E"],
    strokeDark: "#180D04",
    grainOpacity: 0.22,
    grainBlend: "screen",
    fadeOverlay:
      "linear-gradient(180deg, rgba(6,4,2,.55) 0%, rgba(6,4,2,0) 22%, rgba(6,4,2,0) 55%, rgba(6,4,2,.82) 78%, rgba(6,4,2,.95) 100%)",
    photoFadeTo: "#120C05",
    innerBorder: "#F2CE7B3a",
    glow: "0 0 26px rgba(240,190,90,.35), 0 14px 38px rgba(0,0,0,.6)",
    banner: { label: "Rare", ring: "#F0C75A", ring2: "#8A5A18", text: "#F2CE7B" },
  },
};

export type CardMode = "simple" | "rare";

export function PlayerCard({
  player,
  mode = "rare",
  size = 1,
  highlightStats,
  statsLayout,
}: {
  player: Player;
  mode?: CardMode;
  size?: number;
  highlightStats?: StatKey[];
  statsLayout?: StatsLayout;
}) {
  const stats = mode === "rare" ? rareStats(player.stats) : player.stats;
  return (
    <CardShell
      theme={IDENTITY_THEMES[mode]}
      size={size}
      ovrValue={ovr(stats)}
      poste={player.poste}
      name={player.name}
      stats={stats}
      photoName={player.name}
      highlightStats={highlightStats}
      statsLayout={statsLayout}
    />
  );
}
