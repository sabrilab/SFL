"use client";

// Rendu plat d'une carte de collection : PlayerCard pour Standard/Rare,
// BoostCard (design hors-série distinct) pour Défensive/Impact/MVP.

import { PlayerCard } from "./player-card";
import { BoostCard } from "./boost-card";
import { ovr, type BoostType } from "@/lib/sfl/engine";
import type { CollectionCard } from "@/lib/sfl/collection";

export function CollectionCardVisual({ card, size }: { card: CollectionCard; size: number }) {
  if (card.kind === "simple" || card.kind === "rare") {
    return <PlayerCard player={card.player} mode={card.kind} size={size} />;
  }
  return (
    <BoostCard
      card={{
        player: card.player.name,
        type: card.kind as BoostType,
        ovr: ovr(card.player.stats),
        poste: card.player.poste,
        date: "Hors-série",
        stats: card.player.stats,
      }}
      size={size}
    />
  );
}
