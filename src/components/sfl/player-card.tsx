// Carte joueur — la carte Bola gris et blanc (bola-card.tsx), construite au
// nombre d'or : le visage d'abord, puis la note, le nom et les stats. Deux
// éditions ici : base (papier blanc) et rare (argent, repères pleins) ;
// bola-card sait aussi faire l'édition mvp. La photo posée par le joueur
// (partagée avec toute la ligue, voir lib/sfl/photos) remplit le portrait
// carré. En petit, la carte se simplifie d'elle-même (voir palierCarte).
// La carte est un objet : elle ne suit pas le thème de l'app.

"use client";

import { BolaCard } from "./bola-card";
import { usePhotoPerso } from "@/hooks/use-player-photo";
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
  const photo = usePhotoPerso(player.name);
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
      photo={photo}
    />
  );
}
