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
// En dessous du grand format (palier « complète », < 170 px : la Ligue, les
// terrains, les listes), c'est la carte photo (carte-photo.tsx) : la photo
// resserrée sur le visage, la note et le nom en bas (Sabri, 19/10).
// Avec `distinction`, c'est une carte à titre : la même carte, en or (MVP),
// en rouge (Impact) ou en bleu (Défensive) (Sabri, 22/10, teinte-carte.ts).
// Avec `maillot`, le joueur porte le maillot de son camp dans ce match : la
// photo est repeinte par le code (Sabri, 23/10, lib/sfl/maillot-des-photos).

"use client";

import { BolaCard, palierCarte } from "./bola-card";
import { CartePhoto } from "./carte-photo";
import { useBadgeCarte } from "@/hooks/use-badge-carte";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { usePhotoAuMaillot } from "@/hooks/use-photo-au-maillot";
import type { Camp } from "@/lib/sfl/maillots";
import { ovr, type BoostType, type Player, type StatKey } from "@/lib/sfl/engine";
import { useIdentites } from "@/hooks/use-identites";
import type { HabillageCarte } from "./finitions-carte";

export type CardMode = "simple" | "rare";

export function PlayerCard({
  player,
  size = 1,
  highlightStats,
  onglet,
  affiche,
  pseudo,
  vertical,
  distinction,
  habillage,
  maillot,
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
  /** En petit, la carte reste debout (les terrains) au lieu de la pastille. */
  vertical?: boolean;
  /** Une carte à titre : MVP (or), Impact (rouge), Défensive (bleu). */
  distinction?: BoostType;
  /** Ce que la carte porte (finitions-carte.ts) ; gagne sur celui du joueur (l'essai dans la passe). */
  habillage?: HabillageCarte;
  /** Le camp du joueur dans un match : sa photo porte ce maillot-là. */
  maillot?: Camp;
}) {
  const stats = player.stats;
  const photo = usePhotoAuMaillot(usePhotoPerso(player.name), maillot);
  const badge = useBadgeCarte(player.name);
  const identite = useIdentites();
  if (palierCarte(254 * size) !== "complete")
    return (
      <CartePhoto
        name={player.name}
        affiche={affiche ?? identite.nom(player.name)}
        position={player.poste}
        overall={ovr(stats)}
        size={size}
        photo={photo}
        onglet={onglet}
        badge={badge}
        vertical={vertical}
        distinction={distinction}
        habillage={habillage}
      />
    );
  return (
    <BolaCard
      edition={distinction ?? "base"}
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
      habillage={habillage}
    />
  );
}
