// Les fiches de Bola Plus (Sabri, 16/11/2026, 19:33) : « quand on clique sur
// la section en question, on [a] tout le détail de ce que ça inclut ». Une
// carte du carrousel (maillots, matchs filmés, cadeaux, cérémonies, « Ramène 5
// abonnés ») s'ouvre sur sa fiche plein écran, déroulée comme une keynote :
// une image, un titre, une ligne, chapitre après chapitre.
//
// D'où viennent les images (public/bola-plus-fiches/, deux largeurs) :
//   - les maillots : les rendus 3D du vrai patron (bola-site, /sponsoring,
//     tenue complète, sans sponsor) : maillot, short, chaussettes, face et dos ;
//   - les matchs filmés : le kit Twitch, YouTube et Instagram de la SFL
//     (sfl-content, reseaux/kit-chrome, décision D5 : le direct sur Twitch et
//     YouTube en même temps) ;
//   - les pépites et les trophées : générés (Higgsfield, 16/11), sans joueur.
// Rien de payant, rien d'envoyé : de la lecture.

/** Une image d'une fiche : son nom dans public/bola-plus-fiches/ et sa largeur la plus grande. */
export interface ImageFiche {
  image: string;
  alt: string;
  /** Largeur × hauteur de l'original, pour réserver la place. */
  largeur: number;
  hauteur: number;
}

/** Un chapitre : une ou deux images côte à côte, un titre, une ligne, et parfois une liste courte. */
export interface Chapitre {
  images: readonly ImageFiche[];
  titre: string;
  texte?: string;
  liste?: readonly { gauche: string; droite: string }[];
}

/** Une étape de « Ramène 5 abonnés » : son numéro, son titre, sa ligne, et combien de ronds sont pleins. */
export interface Etape {
  titre: string;
  texte: string;
  pleins: number;
}

export type Fiche = { id: string; titre: string; chapitres: readonly Chapitre[] } | { id: "parrainage"; titre: string; etapes: readonly Etape[] };

const img = (image: string, alt: string, largeur: number, hauteur: number): ImageFiche => ({ image, alt, largeur, hauteur });

const KIT = { l: 1020, h: 1500 };
const TROPHEE = { l: 896, h: 1120 };

export const FICHES: Record<string, Fiche> = {
  maillots: {
    id: "maillots",
    titre: "Tes maillots",
    chapitres: [
      {
        images: [img("noir-face", "Le jeu noir : maillot, short et chaussettes, de face", KIT.l, KIT.h), img("noir-dos", "Le jeu noir, de dos : ton nom et ton numéro", KIT.l, KIT.h)],
        titre: "Le noir.",
        texte: "Maillot, short, chaussettes.",
      },
      {
        images: [img("blanc-face", "Le jeu blanc : maillot, short et chaussettes, de face", KIT.l, KIT.h), img("blanc-dos", "Le jeu blanc, de dos : ton nom et ton numéro", KIT.l, KIT.h)],
        titre: "Le blanc.",
        texte: "Le même, en blanc.",
      },
      {
        images: [img("noir-dos", "Le dos du maillot noir, à ton nom", KIT.l, KIT.h)],
        titre: "À ton nom.",
        texte: "Ton nom et ton numéro au dos. Noirs contre Blancs, chaque dimanche.",
      },
    ],
  },
  "matchs-filmes": {
    id: "matchs-filmes",
    titre: "Tes matchs filmés",
    chapitres: [
      {
        images: [img("direct-live", "Le direct de la SFL, le dimanche", 1200, 480)],
        titre: "En direct.",
        texte: "Sur Twitch et YouTube en même temps, chaque dimanche.",
      },
      {
        images: [img("resume", "Le résumé d'une journée sur YouTube : Noirs 5, Blancs 4", 1280, 720)],
        titre: "Les résumés.",
        texte: "Sur YouTube : le résumé de la journée et les meilleurs moments.",
      },
      {
        images: [img("story", "Une story Instagram de la SFL : « Dimanche. »", 1080, 1920)],
        titre: "Partout.",
        texte: "Sur TikTok et Instagram : le direct, les buts, les résumés, tout mélangé.",
      },
    ],
  },
  cadeaux: {
    id: "cadeaux",
    titre: "Des cadeaux",
    chapitres: [
      {
        images: [img("pepites", "Image générée : trois pépites d'or de tailles différentes, chacune dans son écrin noir", TROPHEE.l, TROPHEE.h)],
        titre: "De l'or. Du vrai.",
        texte: "Le podium de la Pépite d'Or repart avec une pépite d'or.",
        liste: [
          { gauche: "1er", droite: "3 g" },
          { gauche: "2e", droite: "2 g" },
          { gauche: "3e", droite: "1 g" },
        ],
      },
      {
        images: [img("pepite-ecrin", "Image générée : une pépite d'or dans son écrin noir", TROPHEE.l, TROPHEE.h)],
        titre: "Dans son écrin.",
        texte: "Remise à la cérémonie de fin de saison.",
      },
    ],
  },
  ceremonies: {
    id: "ceremonies",
    titre: "Les cérémonies officielles",
    chapitres: [
      {
        images: [img("trophees", "Image générée : cinq trophées sur un podium de marbre, dans le stade de piliers", 1024, 688)],
        titre: "Cinq trophées.",
        texte: "Remis sur le podium, à la fin de chaque saison.",
      },
      { images: [img("trophee-pepite", "Image générée : le trophée de la Pépite d'Or, une pépite d'or sur un socle de marbre noir", TROPHEE.l, TROPHEE.h)], titre: "La Pépite d'Or.", texte: "Le premier du classement." },
      { images: [img("trophee-buteur", "Image générée : le trophée du meilleur buteur, un crampon chromé qui frappe le ballon", TROPHEE.l, TROPHEE.h)], titre: "Meilleur buteur.", texte: "Le plus de buts de la saison." },
      { images: [img("trophee-passeur", "Image générée : le trophée du meilleur passeur, un arc chromé qui suit le ballon", TROPHEE.l, TROPHEE.h)], titre: "Meilleur passeur.", texte: "Le plus de passes décisives." },
      { images: [img("trophee-defenseur", "Image générée : le trophée du meilleur défenseur, un mur de marbre blanc", TROPHEE.l, TROPHEE.h)], titre: "Meilleur défenseur.", texte: "Le Mur de la saison." },
      { images: [img("trophee-mvp", "Image générée : le trophée du MVP, un ballon de verre noir sur une colonne de marbre", TROPHEE.l, TROPHEE.h)], titre: "MVP.", texte: "Le plus de fois meilleur joueur du match." },
    ],
  },
  parrainage: {
    id: "parrainage",
    titre: "Ramène 5 abonnés",
    etapes: [
      { titre: "Partage ton lien.", texte: "Ma carte, puis Inviter : ton lien, à envoyer à qui tu veux.", pleins: 0 },
      { titre: "Ils s'inscrivent.", texte: "Avec ton lien, ils arrivent chez toi.", pleins: 2 },
      { titre: "Ils s'abonnent.", texte: "Chaque abonné compte. Il en faut cinq.", pleins: 4 },
      { titre: "Le tien est offert.", texte: "Cinq abonnés : ton abonnement ne te coûte plus rien, tant qu'ils restent abonnés.", pleins: 5 },
    ],
  },
};

/** Le chemin d'une image de fiche, à 600 ou 1200 px de large. */
export const fichierFiche = (image: string, l: 600 | 1200) => `/bola-plus-fiches/${image}-${l}.webp`;
/** Le srcset d'une image de fiche (la grande ne dépasse pas l'original). */
export const sourcesFiche = (i: ImageFiche) => `${fichierFiche(i.image, 600)} 600w, ${fichierFiche(i.image, 1200)} ${Math.min(1200, i.largeur)}w`;
