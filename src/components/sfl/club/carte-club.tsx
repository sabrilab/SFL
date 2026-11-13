"use client";

// La carte d'un joueur d'un club (Bola Club, bola-app#14) : la vraie carte
// Bola, aux trois formats de l'app (mini-carte.tsx, FORMAT_CARTE : grande
// 127 px, moyenne 78 px, petite 48 px, au nombre d'or), ou la carte complète
// d'une fiche. Elle appelle BolaCard et CartePhoto directement, jamais
// PlayerCard ni MiniCarte : ceux-là cherchent la photo, le badge, l'habillage
// et le réseau d'un joueur par son nom de saison, et un joueur de club
// homonyme prendrait ceux d'un joueur de la ligue. Les joueurs de la
// démonstration n'ont pas de photo : la carte montre son état sans photo,
// l'initiale. Les couleurs du club n'y vont jamais : elles ne vivent que sur
// l'écusson. La toucher l'ouvre en grand (card-viewer.tsx), sans Suivre ni
// profil : ce n'est pas un joueur de la ligue.

import { BolaCard, palierCarte } from "@/components/sfl/bola-card";
import { CartePhoto } from "@/components/sfl/carte-photo";
import { useCardViewer } from "@/components/sfl/card-viewer";
import { prechaufferCarte } from "@/components/sfl/card-3d";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useClub } from "@/hooks/use-club";
import { categorieDe } from "@/lib/sfl/club/regles";
import type { CarteClub as Carte } from "@/lib/sfl/club/saison";
import { nomComplet } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";

export type FormatCarte = keyof typeof FORMAT_CARTE;

/** Le dessin seul : la carte complète dès 170 px, la carte photo en dessous. */
export function DessinCarteClub({ carte, size }: { carte: Carte; size: number }) {
  const m = carte.membre;
  if (palierCarte(254 * size) !== "complete")
    return <CartePhoto name={nomComplet(m)} affiche={m.prenom} position={m.poste} overall={carte.note} size={size} photo={null} />;
  return <BolaCard name={nomComplet(m)} affiche={m.prenom} username={m.nom.toLowerCase()} position={m.poste} overall={carte.note} stats={carte.stats} size={size} photo={null} />;
}

export function CarteClub({
  id,
  format = "petite",
  size,
  inerte = false,
  className,
}: {
  /** Le joueur du club. */
  id: string;
  format?: FormatCarte;
  /** Une autre largeur, en fraction de 254 px (la carte complète d'une fiche). */
  size?: number;
  /** Sans bouton : dans une ligne déjà cliquable, la carte n'est qu'une image. */
  inerte?: boolean;
  className?: string;
}) {
  const { club, cartes } = useClub();
  const { open } = useCardViewer();
  const carte = cartes.get(id);
  if (!carte) return null;
  const s = size ?? FORMAT_CARTE[format];
  const m = carte.membre;
  if (inerte)
    return (
      <span className={cn("shrink-0", className)}>
        <DessinCarteClub carte={carte} size={s} />
      </span>
    );
  return (
    <button
      type="button"
      onPointerDown={(e) => prechaufferCarte(e.currentTarget)}
      onClick={(e) => {
        e.stopPropagation();
        open({
          cacheKey: `club-${id}-${carte.note}-${m.poste}`,
          mode: "simple",
          title: nomComplet(m),
          subtitle: `${club.nom} · ${categorieDe(club, m.categorie)?.nom ?? ""}`,
          render: (taille) => <DessinCarteClub carte={carte} size={taille} />,
        });
      }}
      aria-label={`Voir la carte de ${nomComplet(m)}`}
      className={cn("relative shrink-0 transition-transform active:scale-95", className)}
    >
      <DessinCarteClub carte={carte} size={s} />
    </button>
  );
}
