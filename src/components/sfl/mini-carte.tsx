"use client";

// La carte d'un joueur en vignette, pour les classements : sa vraie carte
// Bola (photo comprise), en petit. La toucher l'ouvre en grand, en 3D.

import { PlayerCard } from "@/components/sfl/player-card";
import { useCardViewer } from "@/components/sfl/card-viewer";
import { prechaufferCarte } from "@/components/sfl/card-3d";
import { useSeason } from "@/components/sfl/season-provider";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

/**
 * Les trois formats de la carte d'un joueur, partout où l'app parle de lui
 * (Sabri, 18/10 : « à chaque fois, notre hiérarchie de carte en grand, petit
 * ou moyen ») : la taille à passer à la carte (254 px × size). D'un format au
 * suivant, le rapport est φ, et chacun tombe dans un palier de la carte :
 *   · grande  — 127 px, la compacte : le joueur au centre d'un module ;
 *   · moyenne — 78 px (127/φ), la réduite : un podium, un joueur mis en avant ;
 *   · petite  — 48 px (78/φ), la pastille : une ligne de classement, une liste.
 * La carte complète (≥ 170 px) reste aux fiches et à Ma carte.
 */
const PHI = (1 + Math.sqrt(5)) / 2;
export const FORMAT_CARTE = { grande: 0.5, moyenne: 0.5 / PHI, petite: 0.5 / (PHI * PHI) } as const;

export function MiniCarte({
  player,
  size = 0.2,
  detail,
  className,
  onglet,
  cle,
}: {
  player: Player;
  /** La largeur, en fraction de 254 px (voir FORMAT_CARTE). */
  size?: number;
  /** Le sous-titre du grand format (« 1er au Pépite d'Or · 12 pts »). */
  detail?: string;
  className?: string;
  /** La note aux couleurs d'une équipe (feuille de match). */
  onglet?: { fond: string; encre: string };
  /** La clé de la 3D en cache, quand la carte n'est pas l'actuelle (une carte d'une saison passée). */
  cle?: string;
}) {
  const { open } = useCardViewer();
  return (
    <button
      type="button"
      onPointerDown={(e) => prechaufferCarte(e.currentTarget)}
      onClick={(e) => {
        e.stopPropagation();
        open({
          cacheKey: cle ?? `mini-${player.name}`,
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

/**
 * La carte d'un joueur retrouvé par son nom dans la saison : pour les modules
 * qui ne tiennent que des noms. Un nom inconnu (un invité, un joueur masqué)
 * garde une pastille neutre à son initiale, au même format.
 */
export function CarteDe({
  name,
  size = FORMAT_CARTE.petite,
  detail,
  className,
  inerte = false,
}: {
  name: string;
  size?: number;
  detail?: string;
  className?: string;
  /** Sans bouton : dans une ligne déjà cliquable, la carte n'est qu'une image. */
  inerte?: boolean;
}) {
  const { allPlayers } = useSeason();
  const cle = name.trim().toLowerCase();
  const player = allPlayers.find((p) => p.name.toLowerCase() === cle);
  if (player && inerte) return <span className={cn("shrink-0", className)}><PlayerCard player={player} size={size} /></span>;
  if (player) return <MiniCarte player={player} size={size} detail={detail} className={className} />;
  const cote = 254 * size;
  // Même silhouette que la carte : carrée en pastille (< 70 px), au format carte au-delà.
  const haut = cote < 70 ? cote : cote * 1.617;
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center bg-secondary font-bold text-muted-foreground", className)}
      style={{ width: cote, height: haut, borderRadius: cote < 70 ? cote * 0.24 : cote * 0.06, fontSize: Math.min(cote, 43) * 0.4 }}
    >
      {name.trim()[0]?.toUpperCase()}
    </span>
  );
}
