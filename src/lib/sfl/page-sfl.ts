// Les textes de la page publique getbola.app/sfl (components/sfl/page-sfl) :
// la Sunday Five League présentée à quelqu'un qui n'a pas de compte, le lien
// de la bio Instagram de la ligue (12/11/2026).
//
// Tout ce qui se lit sur la page est ici, et rien d'autre : le banc
// tools/page-sfl-check.ts relit ce fichier. Il vérifie que chaque fait suit
// le code (le barème contre entryPP, les heures contre convocation-temps.ts
// et revelation.ts, le 75 contre carte-neutre.ts), qu'aucun nom de l'effectif
// n'y figure, et qu'aucun mot non décidé n'y entre (un prix, une adresse,
// une heure de coup d'envoi, un chiffre de la ligue).
//
// Le ton est celui du site de la marque : des phrases de deux à cinq mots,
// au présent, qui tutoient ; ni point d'exclamation, ni texte qui guide.
// La page est en français seulement (son cadre force lang et dir).
// Typographie : l'apostrophe courbe du site, des espaces insécables autour
// des guillemets, devant les deux-points et entre un nombre et son unité ;
// un saut de ligne (\n) sépare deux phrases qui ne se suivent pas sur la
// même ligne.
//
// Pur : ni React, ni horloge, ni lecture de la saison.

/** Les adresses où mène la page : toutes dans l'app, aucune vers l'extérieur. */
export const LIENS_SFL = {
  inscription: "/inscription",
  connexion: "/connexion",
  confidentialite: "/confidentialite",
  app: "/",
} as const;

/** L'aperçu du lien (titre de l'onglet, description, texte de l'image). */
export const META_SFL = {
  titre: "SFL · Sunday Five League, Lille",
  description:
    "Cinq contre cinq, chaque dimanche à Lille. Noirs contre Blancs, trois divisions, le classement Pépite d’Or. Ta carte bouge avec toi.",
  image: "SFL, Sunday Five League",
} as const;

/** Les boutons : un visiteur, puis un joueur déjà connecté. */
export const BOUTONS_SFL = {
  creer: "Créer mon compte",
  connecter: "Se connecter",
  ouvrir: "Ouvrir Bola",
} as const;

export const HAUT_SFL = {
  etiquette: "Sunday Five League",
  titre: ["Lille.", "Chaque dimanche."],
  ligne: "Cinq contre cinq.",
} as const;

/** Une ligne de la semaine : le jour (et son heure dessous), puis ce qui s'y passe. */
export interface LigneSemaine {
  jour: string;
  heure?: string;
  phrase: string;
  /** La réponse scellée, montrée à côté de sa phrase. */
  pastille?: string;
}

export const SEMAINE_SFL = {
  etiquette: "La semaine",
  titre: "Dis «\u00a0Je viens\u00a0».",
  lignes: [
    { jour: "Lundi", phrase: "La convocation arrive." },
    { jour: "Jusqu’à vendredi", phrase: "Une réponse, une seule.", pastille: "Je viens" },
    { jour: "Vendredi", heure: "19\u00a0h", phrase: "Tu découvres ton équipe." },
    { jour: "Dimanche", phrase: "Tu joues." },
    { jour: "Dimanche", heure: "19\u00a0h", phrase: "Points, classement, divisions, titres." },
  ] satisfies LigneSemaine[],
} as const;

export const DIMANCHE_SFL = {
  etiquette: "Le dimanche",
  titre: "Noirs contre Blancs.",
  camps: ["Noirs", "Blancs"],
  contre: "contre",
  phrases: [
    "Match\u00a01, Match\u00a02.",
    "Chacun son heure, son lieu, son terrain.",
    "Les équipes se font seules.\nÉquilibrées.",
    "La feuille de match se tient en direct.",
  ],
} as const;

/** La carte montrée : celle d'un compte neuf (carte-neutre.ts), au nom de « Toi ». */
export const CARTE_SFL = {
  etiquette: "Ta carte",
  titre: "Ta carte bouge avec toi.",
  nom: "Toi",
  note: 75,
  lue: "Ta carte, 75",
  /** Ce qui fait monter quoi (saisie/evolution.ts). */
  lignes: [
    { geste: "Un but", stat: "TIR" },
    { geste: "Une passe décisive", stat: "PAS" },
    { geste: "Défensive", stat: "DEF" },
    { geste: "Impact", stat: "DRI" },
    { geste: "MVP", stat: "Tes deux meilleures" },
    { geste: "Trois dimanches de suite, à l’heure", stat: "PHY" },
  ],
  phrases: ["Elle part à 75.", "Elle ne descend jamais."],
} as const;

/** Une tuile du barème : les points Pépite d'un geste (saisie/engine.ts, BAREME). */
export interface TuileBareme {
  cle: "presence" | "victoire" | "but" | "passe" | "cleanSheet" | "mvp" | "retard" | "absence";
  points: number;
  libelle: string;
}

export const CLASSEMENT_SFL = {
  etiquette: "Le classement",
  titre: "La Pépite d’Or.",
  bareme: [
    { cle: "presence", points: 1, libelle: "Tu viens." },
    { cle: "victoire", points: 2, libelle: "Tu gagnes." },
    { cle: "but", points: 1, libelle: "Un but." },
    { cle: "passe", points: 1, libelle: "Une passe décisive." },
    { cle: "cleanSheet", points: 3, libelle: "Clean sheet." },
    { cle: "mvp", points: 2, libelle: "MVP." },
    { cle: "retard", points: -1, libelle: "En retard." },
    { cle: "absence", points: -2, libelle: "Absent sans prévenir." },
  ] satisfies TuileBareme[],
  divisions: ["D1", "D2", "D3"],
  phrases: ["Refaites chaque dimanche par le classement.", "Chaque division a son premier.", "La D1 joue le Match\u00a01."],
} as const;

/** « +2 », « −1 » : le signe typographique, jamais le trait d'union. */
export function pointsLisibles(points: number): string {
  return `${points < 0 ? "−" : "+"}${Math.abs(points)}`;
}

export const TITRES_SFL = {
  etiquette: "Chaque match",
  titre: "Trois titres.",
  cartes: [
    { edition: "mvp", nom: "MVP", lue: "Carte MVP" },
    { edition: "impact", nom: "Impact", lue: "Carte Impact" },
    { edition: "def", nom: "Défensive", lue: "Carte Défensive" },
  ],
  phrases: [
    "Le MVP ne se vote pas.\nIl se lit sur la feuille de match.",
    "Un Impact et une Défensive par équipe.\nL’équipe d’en face vote.",
  ],
  saison: {
    etiquette: "En fin de saison",
    phrases: [
      "Pépite d’Or. Buteurs. Passeurs. Défenseurs. MVP.",
      "Les trois premiers gardent leur écusson.\nPour toujours.",
      "Chaque saison reste au Wall of Fame.",
    ],
  },
} as const;

export const FIN_SFL = {
  etiquette: "Bola",
  titre: "À toi de jouer.",
  etapes: ["Crée ta carte.", "Sur la Map\u00a0: «\u00a0Rejoindre la ligue\u00a0».", "La ligue te répond."],
  pied: {
    ligue: "Sunday Five League · Lille",
    confidentialite: "Confidentialité",
    droits: "© 2026 Bola",
  },
} as const;

/** Tout ce que la page écrit, à plat : ce que relit le banc. */
export function textesPageSfl(): string[] {
  return [
    META_SFL.titre,
    META_SFL.description,
    META_SFL.image,
    ...Object.values(BOUTONS_SFL),
    HAUT_SFL.etiquette,
    ...HAUT_SFL.titre,
    HAUT_SFL.ligne,
    SEMAINE_SFL.etiquette,
    SEMAINE_SFL.titre,
    ...SEMAINE_SFL.lignes.flatMap((l) => [l.jour, l.heure ?? "", l.phrase, l.pastille ?? ""]),
    DIMANCHE_SFL.etiquette,
    DIMANCHE_SFL.titre,
    ...DIMANCHE_SFL.camps,
    DIMANCHE_SFL.contre,
    ...DIMANCHE_SFL.phrases,
    CARTE_SFL.etiquette,
    CARTE_SFL.titre,
    CARTE_SFL.nom,
    CARTE_SFL.lue,
    ...CARTE_SFL.lignes.flatMap((l) => [l.geste, l.stat]),
    ...CARTE_SFL.phrases,
    CLASSEMENT_SFL.etiquette,
    CLASSEMENT_SFL.titre,
    ...CLASSEMENT_SFL.bareme.flatMap((t) => [pointsLisibles(t.points), t.libelle]),
    ...CLASSEMENT_SFL.divisions,
    ...CLASSEMENT_SFL.phrases,
    TITRES_SFL.etiquette,
    TITRES_SFL.titre,
    ...TITRES_SFL.cartes.flatMap((c) => [c.nom, c.lue]),
    ...TITRES_SFL.phrases,
    TITRES_SFL.saison.etiquette,
    ...TITRES_SFL.saison.phrases,
    FIN_SFL.etiquette,
    FIN_SFL.titre,
    ...FIN_SFL.etapes,
    ...Object.values(FIN_SFL.pied),
  ].filter(Boolean);
}
