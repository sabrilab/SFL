// Cartes Boost SFL — même socle que les cartes joueur (taille, disposition,
// écusson) mais un style "énergie radiante" nettement premium et distinct :
// MVP (couronne, or double-anneau), Impact (flamme, édition spéciale),
// Défensive (bouclier, glace bleue). Gagnées via les figures de match —
// n'altèrent pas la carte principale du joueur.

import { CardShell, type CardTheme } from "./card-shell";
import type { BoostCardData, BoostType } from "@/lib/sfl/engine";

const BOOST_THEMES: Record<BoostType, CardTheme> = {
  mvp: {
    motif: "rays",
    frameBg:
      "linear-gradient(160deg,#FFF3C6 0%,#F4C542 22%,#8A5A12 50%,#FBE9A8 75%,#C9962E 100%)",
    framePad: 3.4,
    bg: "radial-gradient(130% 110% at 50% 8%, #241A06 0%, #120C03 48%, #060402 100%)",
    text: "#F4E4A6",
    accent: "#F4C542",
    label: "#B98F32",
    nameColor: "#F4E4A6",
    nameGrad: "linear-gradient(180deg,#FFF3C6 10%,#F4C542 55%,#9C6B14 100%)",
    divider: "#F4C54240",
    ballA: "#F4C542",
    ballB: "#0C0804",
    logoBar: "linear-gradient(90deg,#FFCF5C,#8A5A12)",
    logoColor: "#FFFFFF",
    wordmarkColor: "#ffffffcc",
    diamondBg: "#0C0804",
    diamondBorder: "#F4C542",
    raysBg:
      "conic-gradient(from 210deg at 60% 30%, rgba(244,197,66,.6), transparent 40%, rgba(244,197,66,.35) 60%, transparent 82%)",
    grainOpacity: 0.18,
    grainBlend: "screen",
    fadeOverlay:
      "linear-gradient(180deg, rgba(6,4,2,.5) 0%, rgba(6,4,2,0) 24%, rgba(6,4,2,0) 55%, rgba(6,4,2,.85) 78%, rgba(6,4,2,.96) 100%)",
    photoFadeTo: "#120C03",
    innerBorder: "#F4C54255",
    glow: "0 0 34px rgba(244,197,66,.5), 0 16px 40px rgba(0,0,0,.65)",
    banner: { label: "MVP du match", ring: "#FFDE83", ring2: "#8A5A12", text: "#FCEBB0" },
    glyph: "crown",
    glyphColor: "#F4C542",
  },
  impact: {
    motif: "rays",
    frameBg:
      "linear-gradient(160deg,#FFB88A 0%,#FF5A1F 25%,#7A1E05 50%,#FF8A4A 75%,#B33E0E 100%)",
    framePad: 3.4,
    bg: "radial-gradient(130% 110% at 50% 6%, #360C02 0%, #1A0601 50%, #0A0402 100%)",
    text: "#FCE9DD",
    accent: "#FF8A4A",
    label: "#C77C4E",
    nameColor: "#FCE9DD",
    nameGrad: "linear-gradient(180deg,#FFE3D0 10%,#FF8A4A 60%,#B33E0E 100%)",
    divider: "#FF7A3F40",
    ballA: "#FF8A4A",
    ballB: "#120602",
    logoBar: "linear-gradient(90deg,#FF8A4A,#7A1E05)",
    logoColor: "#FFFFFF",
    wordmarkColor: "#ffffffcc",
    diamondBg: "#1A0601",
    diamondBorder: "#FF7A3F",
    raysBg:
      "linear-gradient(115deg, transparent 25%, rgba(255,90,31,.55) 45%, rgba(255,160,70,.75) 55%, rgba(255,90,31,.4) 65%, transparent 82%)",
    grainOpacity: 0.18,
    grainBlend: "screen",
    fadeOverlay:
      "linear-gradient(180deg, rgba(10,4,2,.5) 0%, rgba(10,4,2,0) 24%, rgba(10,4,2,0) 55%, rgba(10,4,2,.85) 78%, rgba(10,4,2,.96) 100%)",
    photoFadeTo: "#1A0601",
    innerBorder: "#FF7A3F55",
    glow: "0 0 34px rgba(255,110,40,.5), 0 16px 40px rgba(0,0,0,.65)",
    banner: {
      label: "Joueur Impact",
      sub: "Édition spéciale",
      ring: "#FFA36B",
      ring2: "#7A1E05",
      text: "#FEE3D2",
    },
    glyph: "flame",
    glyphColor: "#FF7A3F",
  },
  def: {
    motif: "rays",
    frameBg:
      "linear-gradient(160deg,#D8F1FF 0%,#7FD4FF 25%,#1C4E77 50%,#A6E3FF 75%,#2E6E99 100%)",
    framePad: 3.4,
    bg: "radial-gradient(130% 110% at 50% 14%, #0F2C42 0%, #081A28 50%, #04070F 100%)",
    text: "#E2F4FF",
    accent: "#7FD4FF",
    label: "#5B8FB5",
    nameColor: "#E2F4FF",
    nameGrad: "linear-gradient(180deg,#EAF7FF 10%,#7FD4FF 60%,#2E6E99 100%)",
    divider: "#7FD4FF40",
    ballA: "#7FD4FF",
    ballB: "#04070F",
    logoBar: "linear-gradient(90deg,#7FD4FF,#1C4E77)",
    logoColor: "#FFFFFF",
    wordmarkColor: "#ffffffcc",
    diamondBg: "#081A28",
    diamondBorder: "#7FD4FF",
    raysBg: "radial-gradient(65% 50% at 50% 26%, rgba(80,190,255,.5), transparent 62%)",
    grainOpacity: 0.16,
    grainBlend: "screen",
    fadeOverlay:
      "linear-gradient(180deg, rgba(3,10,16,.5) 0%, rgba(3,10,16,0) 24%, rgba(3,10,16,0) 55%, rgba(3,10,16,.85) 78%, rgba(3,10,16,.96) 100%)",
    photoFadeTo: "#081A28",
    innerBorder: "#7FD4FF55",
    glow: "0 0 34px rgba(80,190,255,.45), 0 16px 40px rgba(0,0,0,.65)",
    banner: { label: "Défensive", ring: "#A6E3FF", ring2: "#1C4E77", text: "#E2F4FF" },
    glyph: "shield",
    glyphColor: "#7FD4FF",
  },
};

export const BOOST_LABELS: Record<BoostType, string> = {
  mvp: "MVP",
  impact: "Impact",
  def: "Défensive",
};

export function BoostCard({ card, size = 1 }: { card: BoostCardData; size?: number }) {
  return (
    <CardShell
      theme={BOOST_THEMES[card.type]}
      size={size}
      ovrValue={card.ovr}
      poste={card.poste}
      name={card.player}
      stats={card.stats}
      photoName={card.player}
    />
  );
}
