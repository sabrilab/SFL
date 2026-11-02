"use client";

// La carte d'un entraîneur de Bola Team (étude du 02/11/2026, branche
// coach-etude ; Sabri : « une équipe composée de 7 joueurs et un
// entraîneur […] une nouvelle carte du type entraîneur »).
//
// La carte Bola elle-même (bola-card.tsx, édition « entraineur ») : sa photo
// du studio comme tout le monde, l'étiquette ENTRAÎNEUR, son nom, son pseudo
// et son équipe, et à la place de la note de joueur sa note d'entraîneur,
// à la place des six stats ses six caractéristiques (lib/sfl/entraineur.ts).
// Sa carte de joueur ne change pas : c'est une seconde carte, comme celle
// d'un arbitre. Ni badge, ni habillage de joueur, ni numéro.
//
// Rien ne la branche encore aux données : ses faits (feuille de match,
// check-in, note fair-play, Indice de Force) restent à créer.

import { BolaCard } from "./bola-card";
import type { FinitionEntraineur } from "@/components/sfl/skins-entraineur";
import { faceEntraineur, type StatsEntraineur } from "@/lib/sfl/entraineur";

const ZERO = { VIT: 0, TIR: 0, PAS: 0, DRI: 0, DEF: 0, PHY: 0 };

export function CarteEntraineur({
  nom,
  pseudo,
  equipe,
  photo,
  stats,
  finition,
  size = 1,
}: {
  nom: string;
  pseudo?: string;
  /** Le nom de son équipe, à la place du poste d'un joueur. */
  equipe: string;
  photo?: string | null;
  /** Ses six caractéristiques officielles, ou null avant la première mise à jour. */
  stats: StatsEntraineur | null;
  finition?: FinitionEntraineur | null;
  size?: number;
}) {
  return (
    <BolaCard
      edition="entraineur"
      name={nom}
      username={pseudo}
      position={equipe}
      overall={0}
      stats={ZERO}
      size={size}
      photo={photo}
      entraineur={faceEntraineur(stats, finition)}
    />
  );
}
