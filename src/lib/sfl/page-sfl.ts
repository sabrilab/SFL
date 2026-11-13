// Les textes de la page publique getbola.app/sfl (components/sfl/page-sfl) :
// la Sunday Five League présentée à quelqu'un qui n'a pas de compte, le lien
// de la bio Instagram de la ligue (12/11/2026).
//
// Tout ce qui se lit sur la page est ici, avec l'aperçu de son lien
// (METADONNEES_SFL) et ses boutons (le texte et l'adresse de chacun) : le banc
// tools/page-sfl-check.ts relit ce fichier. Ce qu'il tient, et rien de plus :
//   · les faits que le code sait dire le suivent : le barème (entryPP), les
//     heures (convocation-temps.ts, revelation.ts), le lundi de la convocation
//     (vercel.json), le 75 (carte-neutre.ts), ce qui fait monter chaque stat
//     et la série de trois dimanches (saisie/evolution.ts), les titres votés
//     (votes.ts), les classements de fin de saison (fin-de-saison.ts), les
//     trois divisions (divisions.ts) ;
//   · les phrases de règle que le code ne sait pas dire sont figées dans le
//     banc : en changer une, c'est la relire contre la règle ;
//   · aucun nom de l'effectif n'y figure ; aucun nombre hors de ceux de la
//     page (75, 19 h, Match 1 et 2, D1 à D3, le barème, 2026) ; aucun nom
//     propre hors d'une liste (donc aucun lieu que Lille) ; aucun mot rejeté
//     (un prix, « Hippodrome », « prono »…).
// Depuis le 13/11 (retour sur bola-app#6 : « Si sfl avec vrais joueurs »), la page
// montre de vrais joueurs : leurs noms, notes, points, la journée, le match
// et le score viennent de l'instantané (page-sfl-instantane.ts, écrit par
// tools/page-sfl-instantane.ts), jamais d'ici. Ce fichier ne fait que les
// mettre en forme (etiquetteMatch, placeEtPoints), sans un mot de plus que
// « pts ».
//
// Le ton est celui du site de la marque : des phrases de deux à cinq mots,
// au présent, qui tutoient ; ni point d'exclamation, ni texte qui guide.
// La page est en français seulement (son cadre force lang et dir).
// Typographie : l'apostrophe courbe du site, des espaces insécables autour
// des guillemets, devant les deux-points, entre un nombre et son unité, et
// entre un article et son nom là où la ligne les séparait ;
// un saut de ligne (\n) sépare deux phrases qui ne se suivent pas sur la
// même ligne.
//
// Pur : ni React, ni horloge, ni lecture de la saison.

import type { Metadata } from "next";
import { CHEMIN_SFL } from "./routes-publiques";

/** Les adresses où mène la page : toutes dans l'app, aucune vers l'extérieur. */
export const LIENS_SFL = {
  inscription: "/inscription",
  connexion: "/connexion",
  confidentialite: "/confidentialite",
  app: "/",
} as const;

/**
 * L'aperçu du lien (titre de l'onglet, description, texte de l'image). La
 * description dit « foot » : la page ne l'écrit nulle part (son haut reprend
 * le texte du site, où le ballon est à l'image), et c'est elle que lisent un
 * moteur de recherche et l'aperçu d'un lien partagé.
 */
export const META_SFL = {
  titre: "SFL · Sunday Five League, Lille",
  description:
    "Foot à cinq, chaque dimanche à Lille. Noirs contre Blancs, trois divisions, le classement Pépite d’Or. Ta carte bouge avec toi.",
  image: "SFL, Sunday Five League",
} as const;

/**
 * Les métadonnées de la route (app/sfl/page.tsx les exporte telles quelles).
 * La racine (layout.tsx) n'a ni openGraph ni twitter, et la fusion des
 * métadonnées est superficielle : tout est écrit ici. Les adresses relatives
 * sont composées avec metadataBase (getbola.app) ; l'image est le fichier
 * opengraph-image.png posé à côté de la route.
 */
export const METADONNEES_SFL: Metadata = {
  title: { absolute: META_SFL.titre },
  description: META_SFL.description,
  alternates: { canonical: CHEMIN_SFL },
  openGraph: {
    title: META_SFL.titre,
    description: META_SFL.description,
    url: CHEMIN_SFL,
    siteName: "Bola",
    locale: "fr_FR",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: META_SFL.titre, description: META_SFL.description },
};

/** Un bouton : ce qu'il dit, et où il mène. */
export interface BoutonSfl {
  texte: string;
  vers: string;
}

/** Les boutons : un visiteur, puis un joueur déjà connecté. */
export const BOUTONS_SFL = {
  creer: { texte: "Créer mon compte", vers: LIENS_SFL.inscription },
  connecter: { texte: "Se connecter", vers: LIENS_SFL.connexion },
  ouvrir: { texte: "Ouvrir Bola", vers: LIENS_SFL.app },
} as const satisfies Record<string, BoutonSfl>;

export const HAUT_SFL = {
  /** Ce qu'un lecteur d'écran dit du sigle. */
  sigle: "SFL",
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
  /** Le mot d'un match dans sa journée : « Match 1 ». */
  match: "Match",
  phrases: [
    "Match\u00a01, Match\u00a02.",
    "Chacun son heure, son lieu, son terrain.",
    "Les équipes se font seules.\nÉquilibrées.",
    "La feuille de match se tient en direct.",
  ],
} as const;

/**
 * Ta carte : la carte montrée est celle d'un vrai joueur, avant et après une
 * mise à jour (l'instantané, CARTE_MONTEE). `note` : la note de départ d'un
 * compte neuf (carte-neutre.ts), que dit « Elle part à 75. ».
 */
export const CARTE_SFL = {
  etiquette: "Ta carte",
  titre: "Ta carte bouge avec toi.",
  note: 75,
  /** Ce qui fait monter quoi (saisie/evolution.ts) : `cle` nomme le geste pour le banc. */
  lignes: [
    { cle: "but", geste: "Un but", stat: "TIR" },
    { cle: "passe", geste: "Une passe décisive", stat: "PAS" },
    { cle: "defensive", geste: "Défensive", stat: "DEF" },
    { cle: "impact", geste: "Impact", stat: "DRI" },
    { cle: "mvp", geste: "MVP", stat: "Tes deux meilleures" },
    { cle: "serie", geste: "Trois dimanches de suite, à l’heure", stat: "PHY" },
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
  /** L'unité des points d'un joueur classé. */
  points: "pts",
  phrases: ["Refaites chaque dimanche par le classement.", "Chaque division a son premier.", "La D1 joue le Match\u00a01."],
} as const;

/** « 1er · 43 pts », « 2e · 41 pts » : la place d'un joueur dans sa division, et ses points (l'instantané). */
export function placeEtPoints(place: number, points: number): string {
  return `${place}${place === 1 ? "er" : "e"} · ${points}\u00a0${CLASSEMENT_SFL.points}`;
}

/** « J4 · 1 nov. · Match 1 » : le vrai match d'où viennent une compo ou des titres (l'instantané). */
export function etiquetteMatch(m: { journee: number; date: string; match: number }): string {
  return `J${m.journee} · ${m.date.replace(/ /g, "\u00a0")} · ${DIMANCHE_SFL.match}\u00a0${m.match}`;
}

/** « +2 », « −1 » : le signe typographique, jamais le trait d'union. */
export function pointsLisibles(points: number): string {
  return `${points < 0 ? "−" : "+"}${Math.abs(points)}`;
}

export const TITRES_SFL = {
  etiquette: "Chaque match",
  titre: "Trois titres.",
  /** Les trois éditions, dans l'ordre ; les cartes et leurs textes de remplacement sont dans l'instantané (TITRES). */
  cartes: [
    { edition: "mvp", nom: "MVP" },
    { edition: "impact", nom: "Impact" },
    { edition: "def", nom: "Défensive" },
  ],
  phrases: [
    "Le MVP ne se vote pas.\nIl se lit sur la feuille de match.",
    "Un Impact et une\u00a0Défensive par équipe.\nL’équipe d’en face vote.",
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
    ...Object.values(BOUTONS_SFL).map((b) => b.texte),
    HAUT_SFL.sigle,
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
    DIMANCHE_SFL.match,
    ...DIMANCHE_SFL.phrases,
    CARTE_SFL.etiquette,
    CARTE_SFL.titre,
    ...CARTE_SFL.lignes.flatMap((l) => [l.geste, l.stat]),
    ...CARTE_SFL.phrases,
    CLASSEMENT_SFL.etiquette,
    CLASSEMENT_SFL.titre,
    ...CLASSEMENT_SFL.bareme.flatMap((t) => [pointsLisibles(t.points), t.libelle]),
    ...CLASSEMENT_SFL.divisions,
    CLASSEMENT_SFL.points,
    ...CLASSEMENT_SFL.phrases,
    TITRES_SFL.etiquette,
    TITRES_SFL.titre,
    ...TITRES_SFL.cartes.map((c) => c.nom),
    ...TITRES_SFL.phrases,
    TITRES_SFL.saison.etiquette,
    ...TITRES_SFL.saison.phrases,
    FIN_SFL.etiquette,
    FIN_SFL.titre,
    ...FIN_SFL.etapes,
    ...Object.values(FIN_SFL.pied),
  ].filter(Boolean);
}
