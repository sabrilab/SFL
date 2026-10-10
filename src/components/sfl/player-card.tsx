// Carte joueur — la carte Bola gris et blanc (bola-card.tsx), en deux
// éditions : base (papier blanc) et rare (argent, repères pleins). Elle
// reprend la carte officielle de l'app iPhone Bola, mêlée aux rayures et au
// nom en Anton de la carte d'avant. Pas encore de photo.
// La carte est un objet : elle ne suit pas le thème de l'app.

import { BolaCard } from "./bola-card";
import { ovr, rareStats, type Player, type StatKey } from "@/lib/sfl/engine";
import { username } from "@/lib/sfl/usernames";

export type CardMode = "simple" | "rare";

export function PlayerCard({
  player,
  mode = "rare",
  size = 1,
  highlightStats,
}: {
  player: Player;
  mode?: CardMode;
  size?: number;
  highlightStats?: StatKey[];
}) {
  const stats = mode === "rare" ? rareStats(player.stats) : player.stats;
  return (
    <BolaCard
      edition={mode === "rare" ? "rare" : "base"}
      name={player.name}
      username={username(player.name)}
      position={player.poste}
      overall={ovr(stats)}
      stats={stats}
      highlightStats={highlightStats}
      size={size}
    />
  );
}
