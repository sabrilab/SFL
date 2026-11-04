"use client";

// La carte d'un entraîneur de Bola Team (Ilyes, 02/11/2026 : « une équipe =
// 7 joueurs + 1 entraîneur », une nouvelle carte Entraîneur, direction
// « Tableau » ; Sabri : « une nouvelle carte du type entraîneur »).
//
// La carte Bola elle-même (bola-card.tsx, édition « entraineur ») : sa photo
// du studio comme tout le monde, l'étiquette ENTRAÎNEUR, son nom, son pseudo
// et son équipe (« lucien · mons academy », comme « yanis · mc » : sous la
// note, trois chiffres et pas un de plus ; ses rencontres dirigées vont sur
// la fiche), l'écusson de son équipe à la place du numéro (et dans la
// pastille), et à la place de la note de joueur sa note d'entraîneur, à la
// place des six stats ses trois caractéristiques (lib/sfl/entraineur.ts),
// calculées par le serveur et gardées en base (use-carte-entraineur.ts). Sa
// carte de joueur ne change pas : c'est une seconde carte, comme celle d'un
// arbitre. Ni badge, ni habillage de joueur.
//
// Pour la carte d'une personne, lue en base et qui s'ouvre en grand :
// carte-entraineur-de.tsx.

import { BolaCard } from "./bola-card";
import type { FinitionEntraineur } from "@/components/sfl/skins-entraineur";
import { faceEntraineur, type EquipeEntraineur, type StatsEntraineur } from "@/lib/sfl/entraineur";

const ZERO = { VIT: 0, TIR: 0, PAS: 0, DRI: 0, DEF: 0, PHY: 0 };

export function CarteEntraineur({
  nom,
  affiche,
  pseudo,
  equipe,
  photo,
  stats,
  finition,
  size = 1,
}: {
  nom: string;
  /** Le nom montré, s'il diffère du nom de saison (identites). */
  affiche?: string;
  pseudo?: string;
  /** Son équipe : son écusson est sur la carte (sans équipe, un ancien entraîneur : pas d'écusson). */
  equipe?: EquipeEntraineur | null;
  photo?: string | null;
  /** Ses trois caractéristiques officielles (75 partout au départ). */
  stats: StatsEntraineur;
  finition?: FinitionEntraineur | null;
  size?: number;
}) {
  return (
    <BolaCard
      edition="entraineur"
      name={nom}
      affiche={affiche}
      username={pseudo}
      position="entraîneur"
      overall={0}
      stats={ZERO}
      size={size}
      photo={photo}
      entraineur={faceEntraineur(stats, { finition, equipe: equipe ?? undefined })}
    />
  );
}
