// La une — les vidéos mises en avant sur l'accueil.
//
// Un simple registre, ordonné : la première entrée occupe la grande carte.
// Tant que les uploads n'existent pas, l'admin ajoute ici un fichier posé
// dans public/videos/ et son image de couverture. Le jour où les vidéos
// arriveront par la base, seule la source de cette liste changera.
//
// Les fichiers sont réencodés pour le web avant d'entrer : 720p, moov en
// tête (la lecture démarre sans attendre le fichier entier), audio léger.
// Une carte de fil ne doit pas coûter 17 Mo de données mobiles.

export interface VideoUne {
  id: string;
  /** Rubrique affichée en pastille : « Actu », « Compile », « Bureau »… */
  rubrique: string;
  /** Journée concernée, si la vidéo en dépend. */
  journee?: number;
  titre: string;
  /** Ligne de contexte sous le titre. */
  meta: string;
  /** MP4 (H.264) d'abord : décodage matériel partout, meilleure batterie. */
  src: string;
  /** WebM (VP9) en repli — plus léger, et lisible là où le H.264 manque. */
  srcWebm?: string;
  poster: string;
  /** Durée, en secondes — affichée en pastille. */
  duree: number;
}

export const VIDEOS_UNE: VideoUne[] = [
  {
    id: "j8-bensou",
    rubrique: "Actu",
    journee: 8,
    titre: "Bensou Dictador reste le premier de la ligue",
    meta: "Sunday Five League",
    src: "/videos/j8-bensou.mp4",
    srcWebm: "/videos/j8-bensou.webm",
    poster: "/videos/j8-bensou.jpg",
    duree: 17,
  },
];

/** « 2:41 » — la durée telle qu'on la lit sur une pastille de lecture. */
export function dureeLisible(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = Math.round(secondes % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
