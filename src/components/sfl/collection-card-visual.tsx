"use client";

// Rendu plat d'une carte de collection : la carte actuelle du joueur, quelle
// que soit son espèce (Standard, Défensive, Impact, MVP). Plus de design
// hors-série depuis le 19/10 : toutes les cartes sont les mêmes.

import { PlayerCard } from "./player-card";
import type { CollectionCard } from "@/lib/sfl/collection";

export function CollectionCardVisual({ card, size }: { card: CollectionCard; size: number }) {
  return <PlayerCard player={card.player} size={size} />;
}
