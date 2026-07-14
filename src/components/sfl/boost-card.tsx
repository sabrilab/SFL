// Cartes Boost SFL — même socle que les cartes joueur (taille, disposition,
// écusson) mais un style "énergie radiante" nettement premium et distinct :
// MVP (couronne, or double-anneau), Impact (flamme, édition spéciale),
// Défensive (bouclier, glace bleue). Gagnées via les figures de match —
// n'altèrent pas la carte principale du joueur.

import { CardShell, type CardTheme } from "./card-shell";
import { ovr, type BoostCardData, type BoostType, type Player } from "@/lib/sfl/engine";

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

// Thèmes des classements (design du n°1 sur chaque classement stats) — un
// style distinct par classement, dans le même esprit "énergie radiante"
// que les cartes Boost, mais leur propre identité de couleur/glyphe.
const RANKING_ONLY_THEMES: Record<string, CardTheme> = {
  pp: {
    motif: "rays",
    frameBg:
      "linear-gradient(160deg,#FFD9A0 0%,#E8A33D 25%,#7A4A12 50%,#F3C879 75%,#B87A22 100%)",
    framePad: 3.4,
    bg: "radial-gradient(130% 110% at 50% 10%, #2B1A06 0%, #160D02 50%, #070401 100%)",
    text: "#F7E2BC",
    accent: "#E8A33D",
    label: "#B98544",
    nameColor: "#F7E2BC",
    nameGrad: "linear-gradient(180deg,#FFE8BE 10%,#E8A33D 55%,#8A5518 100%)",
    divider: "#E8A33D40",
    ballA: "#E8A33D",
    ballB: "#0E0803",
    logoBar: "linear-gradient(90deg,#F3C879,#7A4A12)",
    logoColor: "#FFFFFF",
    wordmarkColor: "#ffffffcc",
    diamondBg: "#160D02",
    diamondBorder: "#E8A33D",
    raysBg:
      "conic-gradient(from 140deg at 45% 25%, rgba(232,163,61,.55), transparent 42%, rgba(232,163,61,.3) 62%, transparent 84%)",
    grainOpacity: 0.18,
    grainBlend: "screen",
    fadeOverlay:
      "linear-gradient(180deg, rgba(7,4,1,.5) 0%, rgba(7,4,1,0) 24%, rgba(7,4,1,0) 55%, rgba(7,4,1,.85) 78%, rgba(7,4,1,.96) 100%)",
    photoFadeTo: "#160D02",
    innerBorder: "#E8A33D55",
    glow: "0 0 34px rgba(232,163,61,.5), 0 16px 40px rgba(0,0,0,.65)",
    banner: { label: "Pépite d'Or", ring: "#F3C879", ring2: "#7A4A12", text: "#FBE7BE" },
    glyph: "gem",
    glyphColor: "#E8A33D",
  },
  ovr: {
    motif: "rays",
    frameBg:
      "linear-gradient(160deg,#E5D4FF 0%,#B18AFF 25%,#4B237A 50%,#D2B8FF 75%,#7C4FBF 100%)",
    framePad: 3.4,
    bg: "radial-gradient(130% 110% at 50% 8%, #200F35 0%, #120A1E 48%, #06030B 100%)",
    text: "#EAE0FF",
    accent: "#B18AFF",
    label: "#9678BD",
    nameColor: "#EAE0FF",
    nameGrad: "linear-gradient(180deg,#F1E7FF 10%,#B18AFF 55%,#6737A6 100%)",
    divider: "#B18AFF40",
    ballA: "#B18AFF",
    ballB: "#0B0614",
    logoBar: "linear-gradient(90deg,#C7A6FF,#4B237A)",
    logoColor: "#FFFFFF",
    wordmarkColor: "#ffffffcc",
    diamondBg: "#120A1E",
    diamondBorder: "#B18AFF",
    raysBg:
      "conic-gradient(from 200deg at 55% 28%, rgba(177,138,255,.55), transparent 40%, rgba(177,138,255,.3) 60%, transparent 82%)",
    grainOpacity: 0.18,
    grainBlend: "screen",
    fadeOverlay:
      "linear-gradient(180deg, rgba(6,3,11,.5) 0%, rgba(6,3,11,0) 24%, rgba(6,3,11,0) 55%, rgba(6,3,11,.85) 78%, rgba(6,3,11,.96) 100%)",
    photoFadeTo: "#120A1E",
    innerBorder: "#B18AFF55",
    glow: "0 0 34px rgba(177,138,255,.5), 0 16px 40px rgba(0,0,0,.65)",
    banner: { label: "Meilleur OVR", ring: "#D2B8FF", ring2: "#4B237A", text: "#F1E7FF" },
    glyph: "star",
    glyphColor: "#B18AFF",
  },
  buts: {
    motif: "rays",
    frameBg:
      "linear-gradient(160deg,#FFC2C2 0%,#FF4040 25%,#7A0D0D 50%,#FF8A8A 75%,#B31F1F 100%)",
    framePad: 3.4,
    bg: "radial-gradient(130% 110% at 50% 6%, #330707 0%, #180303 50%, #090101 100%)",
    text: "#FDE1E1",
    accent: "#FF6B6B",
    label: "#C46E6E",
    nameColor: "#FDE1E1",
    nameGrad: "linear-gradient(180deg,#FFDCDC 10%,#FF6B6B 60%,#B31F1F 100%)",
    divider: "#FF404040",
    ballA: "#FF6B6B",
    ballB: "#150202",
    logoBar: "linear-gradient(90deg,#FF8A8A,#7A0D0D)",
    logoColor: "#FFFFFF",
    wordmarkColor: "#ffffffcc",
    diamondBg: "#180303",
    diamondBorder: "#FF6B6B",
    raysBg:
      "radial-gradient(60% 46% at 50% 24%, rgba(255,80,80,.55), transparent 62%)",
    grainOpacity: 0.18,
    grainBlend: "screen",
    fadeOverlay:
      "linear-gradient(180deg, rgba(9,1,1,.5) 0%, rgba(9,1,1,0) 24%, rgba(9,1,1,0) 55%, rgba(9,1,1,.85) 78%, rgba(9,1,1,.96) 100%)",
    photoFadeTo: "#180303",
    innerBorder: "#FF6B6B55",
    glow: "0 0 34px rgba(255,90,90,.5), 0 16px 40px rgba(0,0,0,.65)",
    banner: { label: "Buteur", ring: "#FF8A8A", ring2: "#7A0D0D", text: "#FEE3E3" },
    glyph: "target",
    glyphColor: "#FF6B6B",
  },
  passes: {
    motif: "rays",
    frameBg:
      "linear-gradient(160deg,#C6FFEA 0%,#38E2A6 25%,#0D5A45 50%,#8CFFDA 75%,#159E75 100%)",
    framePad: 3.4,
    bg: "radial-gradient(130% 110% at 50% 10%, #032922 0%, #011712 50%, #000705 100%)",
    text: "#DBFFF1",
    accent: "#38E2A6",
    label: "#4FA689",
    nameColor: "#DBFFF1",
    nameGrad: "linear-gradient(180deg,#D9FFEF 10%,#38E2A6 55%,#0D6B51 100%)",
    divider: "#38E2A640",
    ballA: "#38E2A6",
    ballB: "#010c09",
    logoBar: "linear-gradient(90deg,#8CFFDA,#0D5A45)",
    logoColor: "#FFFFFF",
    wordmarkColor: "#ffffffcc",
    diamondBg: "#011712",
    diamondBorder: "#38E2A6",
    raysBg:
      "linear-gradient(115deg, transparent 25%, rgba(56,226,166,.5) 45%, rgba(140,255,218,.65) 55%, rgba(56,226,166,.35) 65%, transparent 82%)",
    grainOpacity: 0.16,
    grainBlend: "screen",
    fadeOverlay:
      "linear-gradient(180deg, rgba(0,7,5,.5) 0%, rgba(0,7,5,0) 24%, rgba(0,7,5,0) 55%, rgba(0,7,5,.85) 78%, rgba(0,7,5,.96) 100%)",
    photoFadeTo: "#011712",
    innerBorder: "#38E2A655",
    glow: "0 0 34px rgba(56,226,166,.45), 0 16px 40px rgba(0,0,0,.65)",
    banner: { label: "Passeur", ring: "#8CFFDA", ring2: "#0D5A45", text: "#E4FFF4" },
    glyph: "send",
    glyphColor: "#38E2A6",
  },
  presences: {
    motif: "rays",
    frameBg:
      "linear-gradient(160deg,#F2F4F7 0%,#C7CEDA 25%,#4A5568 50%,#E3E7EE 75%,#6B7684 100%)",
    framePad: 3.4,
    bg: "radial-gradient(130% 110% at 50% 12%, #1A1E26 0%, #0F1116 50%, #050608 100%)",
    text: "#EDEFF3",
    accent: "#C7CEDA",
    label: "#8791A1",
    nameColor: "#EDEFF3",
    nameGrad: "linear-gradient(180deg,#F7F8FA 10%,#C7CEDA 55%,#5C6577 100%)",
    divider: "#C7CEDA40",
    ballA: "#C7CEDA",
    ballB: "#0A0C10",
    logoBar: "linear-gradient(90deg,#E3E7EE,#4A5568)",
    logoColor: "#FFFFFF",
    wordmarkColor: "#ffffffcc",
    diamondBg: "#0F1116",
    diamondBorder: "#C7CEDA",
    raysBg: "radial-gradient(65% 50% at 50% 26%, rgba(199,206,218,.4), transparent 62%)",
    grainOpacity: 0.16,
    grainBlend: "screen",
    fadeOverlay:
      "linear-gradient(180deg, rgba(5,6,8,.5) 0%, rgba(5,6,8,0) 24%, rgba(5,6,8,0) 55%, rgba(5,6,8,.85) 78%, rgba(5,6,8,.96) 100%)",
    photoFadeTo: "#0F1116",
    innerBorder: "#C7CEDA55",
    glow: "0 0 34px rgba(199,206,218,.4), 0 16px 40px rgba(0,0,0,.65)",
    banner: { label: "Toujours là", ring: "#E3E7EE", ring2: "#4A5568", text: "#F0F1F4" },
    glyph: "badge",
    glyphColor: "#C7CEDA",
  },
  discipline: {
    motif: "rays",
    frameBg:
      "linear-gradient(160deg,#E6E9F0 0%,#A9B4C4 25%,#2B2F38 50%,#D4D9E2 75%,#565D6B 100%)",
    framePad: 3.4,
    bg: "radial-gradient(130% 110% at 50% 14%, #14161B 0%, #0A0B0D 50%, #030304 100%)",
    text: "#EAECF0",
    accent: "#A9B4C4",
    label: "#7C8595",
    nameColor: "#EAECF0",
    nameGrad: "linear-gradient(180deg,#F3F4F7 10%,#A9B4C4 55%,#454B56 100%)",
    divider: "#A9B4C440",
    ballA: "#A9B4C4",
    ballB: "#08090b",
    logoBar: "linear-gradient(90deg,#D4D9E2,#2B2F38)",
    logoColor: "#FFFFFF",
    wordmarkColor: "#ffffffcc",
    diamondBg: "#0A0B0D",
    diamondBorder: "#A9B4C4",
    raysBg: "radial-gradient(60% 46% at 50% 24%, rgba(169,180,196,.4), transparent 62%)",
    grainOpacity: 0.16,
    grainBlend: "screen",
    fadeOverlay:
      "linear-gradient(180deg, rgba(3,3,4,.5) 0%, rgba(3,3,4,0) 24%, rgba(3,3,4,0) 55%, rgba(3,3,4,.85) 78%, rgba(3,3,4,.96) 100%)",
    photoFadeTo: "#0A0B0D",
    innerBorder: "#A9B4C455",
    glow: "0 0 34px rgba(169,180,196,.4), 0 16px 40px rgba(0,0,0,.65)",
    banner: { label: "Fair-play", ring: "#D4D9E2", ring2: "#2B2F38", text: "#EDEFF2" },
    glyph: "scale",
    glyphColor: "#A9B4C4",
  },
};

// Un thème par classement (les 3 hors-série + les 6 classements stats),
// utilisé pour afficher le n°1 de chaque classement avec un design distinct.
export const RANKING_THEMES: Record<string, CardTheme> = {
  mvp: BOOST_THEMES.mvp,
  impact: BOOST_THEMES.impact,
  def: BOOST_THEMES.def,
  ...RANKING_ONLY_THEMES,
};

export function RankingCard({
  rankingId,
  player,
  size = 1,
}: {
  rankingId: string;
  player: Player;
  size?: number;
}) {
  const theme = RANKING_THEMES[rankingId];
  if (!theme) return null;
  return (
    <CardShell
      theme={theme}
      size={size}
      ovrValue={ovr(player.stats)}
      poste={player.poste}
      name={player.name}
      stats={player.stats}
      photoName={player.name}
    />
  );
}
