// Carte joueur — deux éditions sur le layout « éditorial » du design
// Kickoff : Standard (teinte verte) et Rare (teinte or, badge RARE).
// La carte est un objet : elle ne suit pas le thème clair/sombre de l'app
// (variante « clair » disponible via EditorialCard pour les usages dédiés).

import { EditorialCard } from "./editorial-card";
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
    <EditorialCard
      layout="editorial"
      tint={mode === "rare" ? "or" : "standard"}
      badge={mode === "rare" ? "RARE" : undefined}
      name={player.name}
      username={username(player.name)}
      position={player.poste}
      overall={ovr(stats)}
      stats={stats}
      highlightStats={highlightStats}
      photoName={player.name}
      size={size}
    />
  );
}
