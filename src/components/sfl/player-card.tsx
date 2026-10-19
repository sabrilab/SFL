// Carte joueur — la carte Bola gris et blanc (bola-card.tsx), construite au
// nombre d'or : le visage d'abord, puis la note, le nom et les stats. Une
// seule édition s'affiche : la simple (papier blanc, les notes brutes). La
// rare n'est plus montrée depuis le 17/10 (décision de Sabri) ; ses stats
// (rareStats) restent le point de départ des cartes MVP, Impact et Défensive
// (computeBoostCards). `mode` n'est gardé que pour les appels existants. La photo posée par le joueur
// (partagée avec toute la ligue, voir lib/sfl/photos) remplit le portrait
// carré. En petit, la carte se simplifie d'elle-même (voir palierCarte).
// En haut à droite du portrait, le badge que le joueur a choisi (son meilleur
// par défaut, voir lib/sfl/badge-carte).
// La carte est un objet : elle ne suit pas le thème de l'app.

"use client";

import { BolaCard } from "./bola-card";
import { useBadgeCarte } from "@/hooks/use-badge-carte";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { ovr, type Player, type StatKey } from "@/lib/sfl/engine";
import { useIdentites } from "@/hooks/use-identites";

export type CardMode = "simple" | "rare";

export function PlayerCard({
  player,
  size = 1,
  highlightStats,
  onglet,
  affiche,
  pseudo,
}: {
  player: Player;
  /** Aperçu : le nom et le pseudo en cours de saisie (identite.tsx). */
  affiche?: string;
  pseudo?: string;
  /** Sans effet : la carte affichée est toujours la simple. */
  mode?: CardMode;
  size?: number;
  highlightStats?: StatKey[];
  /** En pastille : la note aux couleurs d'une équipe. */
  onglet?: { fond: string; encre: string };
}) {
  const stats = player.stats;
  const photo = usePhotoPerso(player.name);
  const badge = useBadgeCarte(player.name);
  const identite = useIdentites();
  return (
    <BolaCard
      edition="base"
      name={player.name}
      affiche={affiche ?? identite.nom(player.name)}
      username={pseudo ?? identite.pseudo(player.name)}
      position={player.poste}
      overall={ovr(stats)}
      stats={stats}
      highlightStats={highlightStats}
      size={size}
      photo={photo}
      onglet={onglet}
      badge={badge}
    />
  );
}
