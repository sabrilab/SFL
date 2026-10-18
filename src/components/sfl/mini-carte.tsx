"use client";

// La carte d'un joueur en vignette, pour les classements : sa vraie carte
// Bola (photo comprise), en petit. La toucher l'ouvre en grand, en 3D.

import { PlayerCard } from "@/components/sfl/player-card";
import { useCardViewer } from "@/components/sfl/card-viewer";
import { prechaufferCarte } from "@/components/sfl/card-3d";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

export function MiniCarte({
  player,
  size = 0.2,
  detail,
  className,
  onglet,
}: {
  player: Player;
  /** 0.2 ≈ 51 × 76 px. */
  size?: number;
  /** Le sous-titre du grand format (« 1er au Pépite d'Or · 12 pts »). */
  detail?: string;
  className?: string;
  /** La note aux couleurs d'une équipe (feuille de match). */
  onglet?: { fond: string; encre: string };
}) {
  const { open } = useCardViewer();
  return (
    <button
      type="button"
      onPointerDown={(e) => prechaufferCarte(e.currentTarget)}
      onClick={(e) => {
        e.stopPropagation();
        open({
          cacheKey: `mini-${player.name}`,
          mode: "simple",
          title: player.name,
          subtitle: detail,
          render: (s) => <PlayerCard player={player} size={s} />,
        });
      }}
      aria-label={`Voir la carte de ${player.name}`}
      className={cn("shrink-0 transition-transform active:scale-95", className)}
    >
      <PlayerCard player={player} size={size} onglet={onglet} />
    </button>
  );
}
