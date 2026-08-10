// Cartes à titre — cartes Boost (MVP / Impact / Défensive) et cartes de
// n°1 de classement. Portées sur le layout « legend » du design Kickoff :
// bandeau de titre plein accent, encart d'identité, nom centré, rangée de
// six stats. Chaque titre garde sa teinte propre.

import { EditorialCard, type CardTint } from "./editorial-card";
import { ovr, type BoostCardData, type BoostType, type Player } from "@/lib/sfl/engine";
import { username } from "@/lib/sfl/usernames";

export const BOOST_LABELS: Record<BoostType, string> = {
  mvp: "MVP",
  impact: "Impact",
  def: "Défensive",
};

interface TitleTheme {
  tint: CardTint;
  badge: string;
}

const BOOST_THEMES: Record<BoostType, TitleTheme> = {
  mvp: { tint: "or", badge: "MVP DU MATCH" },
  impact: { tint: "violet", badge: "JOUEUR IMPACT" },
  def: { tint: "standard", badge: "DÉFENSIVE" },
};

// Un thème par classement — même famille visuelle, teintes réparties.
export const RANKING_THEMES: Record<string, TitleTheme> = {
  mvp: BOOST_THEMES.mvp,
  impact: BOOST_THEMES.impact,
  def: BOOST_THEMES.def,
  pp: { tint: "or", badge: "PÉPITE D'OR" },
  ovr: { tint: "violet", badge: "NOTE GÉNÉRALE" },
  buts: { tint: "rouge", badge: "MEILLEUR BUTEUR" },
  passes: { tint: "standard", badge: "MEILLEUR PASSEUR" },
  presences: { tint: "standard", badge: "TOUJOURS LÀ" },
  discipline: { tint: "rouge", badge: "DISCIPLINE" },
};

export function BoostCard({ card, size = 1 }: { card: BoostCardData; size?: number }) {
  const th = BOOST_THEMES[card.type];
  return (
    <EditorialCard
      layout="legend"
      tint={th.tint}
      badge={th.badge}
      name={card.player}
      username={username(card.player)}
      position={`${card.poste} · ${card.date}`.toUpperCase()}
      overall={card.ovr}
      stats={card.stats}
      photoName={card.player}
      size={size}
    />
  );
}

export function RankingCard({
  rankingId,
  player,
  size = 1,
}: {
  rankingId: string;
  player: Player;
  size?: number;
}) {
  const th = RANKING_THEMES[rankingId];
  if (!th) return null;
  return (
    <EditorialCard
      layout="legend"
      tint={th.tint}
      badge={th.badge}
      name={player.name}
      username={username(player.name)}
      position={player.poste.toUpperCase()}
      overall={ovr(player.stats)}
      stats={player.stats}
      photoName={player.name}
      size={size}
    />
  );
}
