"use client";

// L'aperçu d'un skin de nation sur la carte d'un joueur : la même carte que
// partout (PlayerCard, DosCarte, Card3D), habillée de la nation. Servi au
// banc d'aperçu, à la cérémonie du pack et à la collection des nations.

import { Card3D } from "@/components/sfl/card-3d";
import { DosCarte } from "@/components/sfl/dos-carte";
import { matiereDe, type HabillageCarte } from "@/components/sfl/finitions-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import type { Player } from "@/lib/sfl/engine";
import type { CodeNation } from "@/lib/sfl/pack-afrique";

export const habillageNation = (nation: CodeNation, autour?: HabillageCarte): HabillageCarte => ({
  ...autour,
  finition: `afrique-${nation}`,
});

export function ApercuNation({
  nation,
  player,
  vue,
  taille = 1,
  autour,
}: {
  nation: CodeNation;
  player: Player;
  /** face, dos (à plat), ou 3d (à tourner ; « 3d-dos » : posée sur son dos). */
  vue: "face" | "dos" | "3d" | "3d-dos";
  taille?: number;
  /** Les signes, le cran, le rang que la carte porte déjà. */
  autour?: HabillageCarte;
}) {
  const habillage = habillageNation(nation, autour);
  if (vue === "face") return <PlayerCard player={player} size={taille} habillage={habillage} />;
  if (vue === "dos") return <DosCarte matiere={matiereDe("base", habillage)} nom={player.name} size={taille} habillage={habillage} />;
  return (
    <Card3D
      cacheKey={`afrique-${nation}-${player.name}-${vue}`}
      size={taille}
      startFace={vue === "3d-dos" ? "back" : "front"}
      apercu
      render={(s) => <PlayerCard player={player} size={s} habillage={habillage} />}
    />
  );
}
