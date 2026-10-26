// Les carrousels publiés avec une vidéo des Actus (Sabri, 26/10/2026 :
// « Publie un carousel avec la vidéo qu'on peut voir dans l'onglet actu ») :
// la publication de la vidéo devient un carrousel, la vidéo d'abord, puis
// ses images à faire glisser (actus/video.tsx, PublicationVideo).
//
// Les images sont les visuels faits pour Instagram (4:5, 1080×1350) : elles
// sont publiques de toute façon, donc posées dans public/actus/, à côté des
// couvertures. N'y mettre que des joueurs qui ont dit oui à leur carte hors
// de l'app (Admin → Activité → Confidentialité). La vidéo, elle, reste dans
// son bucket privé.

import { DEMO_VIDEOS, VIDEO_FACTICE } from "@/lib/sfl/videos";

export interface Diapo {
  src: string;
  alt: string;
}

const j3 = (fichier: string, alt: string): Diapo => ({
  src: `/actus/j3/${fichier}.webp`,
  alt,
});

const J3: Diapo[] = [
  j3("00-couverture", "J3 : 12 cartes débloquées"),
  j3("01-souley", "Souley, carte MVP"),
  j3("02-jouneid", "Jouneiid, carte MVP"),
  j3("03-coucoupops", "Coucoupop's, carte MVP"),
  j3("04-youss", "Youss', carte MVP"),
  j3("05-ibrahim", "Ibrahim, carte MVP"),
  j3("06-ilyes", "Ilyes, carte Impact"),
  j3("07-abdel", "Abdel, carte Impact"),
  j3("08-moh", "Moh, carte Impact"),
  j3("09-gail", "Gaïl, carte Défensive"),
  j3("10-sebovic", "Sebovic, carte Défensive"),
  j3("11-ayman", "Ayman, carte Défensive"),
  j3("12-xabi", "Xabi, carte Défensive"),
];

/** Par identifiant de vidéo, les images qui la suivent dans sa publication. */
const CARROUSELS: Record<string, Diapo[]> = {
  "j3-le-recap": J3,
};

/** Les images d'une vidéo ; aucune : la publication reste une vidéo seule. */
export function diaposDe(video: string): Diapo[] {
  if (CARROUSELS[video]) return CARROUSELS[video];
  // Dans un aperçu, la vidéo factice montre le carrousel de la J3.
  return DEMO_VIDEOS && video === VIDEO_FACTICE.id ? J3 : [];
}
