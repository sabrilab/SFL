// Cartes à titre — MVP / Impact / Défensive et n°1 de classement. Depuis le
// 19/10 (Sabri : « ce sont toutes les mêmes cartes »), elles ne gardent plus
// de design à part : elles montrent la carte actuelle du joueur (PlayerCard,
// la carte Bola), la même partout. Le titre reste dit à côté de la carte par
// l'écran qui l'affiche. Les anciennes cartes éditoriales (editorial-card)
// ne servent plus qu'à la page de travail /design-cartes.

"use client";

import { PlayerCard } from "./player-card";
import { useSeason } from "./season-provider";
import type { BoostCardData, BoostType, Player } from "@/lib/sfl/engine";

export const BOOST_LABELS: Record<BoostType, string> = {
  mvp: "MVP",
  impact: "Impact",
  def: "Défensive",
};

// Les classements qui avaient une carte de n°1 à eux. Gardé pour les écrans
// qui nomment le titre ; la carte, elle, est la même pour tous.
export const RANKING_THEMES: Record<string, { badge: string }> = {
  mvp: { badge: "MVP DU MATCH" },
  impact: { badge: "JOUEUR IMPACT" },
  def: { badge: "DÉFENSIVE" },
  pp: { badge: "PÉPITE D'OR" },
  ovr: { badge: "NOTE GÉNÉRALE" },
  buts: { badge: "MEILLEUR BUTEUR" },
  passes: { badge: "MEILLEUR PASSEUR" },
  presences: { badge: "TOUJOURS LÀ" },
  discipline: { badge: "DISCIPLINE" },
};

/** Le joueur tel qu'il est aujourd'hui, à défaut tel que la carte l'a figé. */
function useJoueurActuel(nom: string, repli: () => Player): Player {
  const { allPlayers } = useSeason();
  return allPlayers.find((p) => p.name === nom) ?? repli();
}

export function BoostCard({ card, size = 1 }: { card: BoostCardData; size?: number }) {
  const player = useJoueurActuel(card.player, () => ({
    name: card.player,
    poste: card.poste,
    pp: 0,
    matchs: 0,
    buts: 0,
    passes: 0,
    statut: "Actif",
    stats: card.stats,
    mvp: 0,
    impact: 0,
    def: 0,
  }));
  return <PlayerCard player={player} size={size} />;
}

export function RankingCard({
  player,
  size = 1,
}: {
  rankingId?: string;
  player: Player;
  size?: number;
}) {
  const actuel = useJoueurActuel(player.name, () => player);
  return <PlayerCard player={actuel} size={size} />;
}
