// Les textes de la page publique getbola.app/club (components/sfl/page-club) :
// Bola Club présenté au président, au secrétaire ou à l'entraîneur d'un club
// amateur qui n'a jamais entendu parler de Bola. C'est le lien de la campagne
// de mails vers les clubs francophones (Nord, Pas-de-Calais, Belgique…),
// demandée par Sabri le 27/11/2026 : la page dit ce que le club reçoit, puis
// recueille une demande de démo (app/api/clubs/route.ts, table club_demandes).
//
// Tout ce qui se lit sur la page est ici, avec l'aperçu de son lien et les
// règles du formulaire (erreurDemande), que relisent l'écran et la route :
// une seule règle, aux deux bouts.
//
// Le ton : celui de la marque, des phrases courtes au présent, sans point
// d'exclamation ni texte qui guide ; mais on vouvoie, parce qu'on écrit à un
// club, pas à un joueur. Aucune mention de la ligue du dimanche : c'est une
// page Bola. Aucun prix : les formules ne sont pas arrêtées.
// Les captures sont celles du club de démonstration « FC Démo » (sabrilab/SFL
// PR #270), de vraies captures de l'app, sans un vrai nom.
//
// Pur : ni React, ni navigateur.

import type { Metadata } from "next";
import { CHEMIN_CLUB } from "./routes-publiques";

export const META_CLUB = {
  titre: "Bola Club · L'app de votre club de foot",
  description:
    "Convocations, présences, stats de match et une carte de joueur qui monte avec chaque licencié. Demandez une démo pour votre club.",
} as const;

export const METADONNEES_CLUB: Metadata = {
  title: { absolute: META_CLUB.titre },
  description: META_CLUB.description,
  alternates: { canonical: CHEMIN_CLUB },
  openGraph: {
    title: META_CLUB.titre,
    description: META_CLUB.description,
    url: CHEMIN_CLUB,
    siteName: "Bola",
    locale: "fr_FR",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: META_CLUB.titre, description: META_CLUB.description },
};

/** L'ancre du formulaire : les boutons du haut et de la barre y mènent. */
export const ANCRE_DEMANDE = "demande";

export const HAUT_CLUB = {
  etiquette: "Bola Club",
  titre: ["Votre club.", "Une carte par licencié."],
  ligne: "Convocations, présences, stats.\nToute la saison dans une app.",
  bouton: "Demander une démo",
  second: "Voir l’app",
} as const;

/**
 * Les joueurs du haut : une carte par catégorie, chacune son maillot. Les
 * photos sont générées par Magnific à la demande de Sabri (27/11/2026 :
 * « des images de joueurs de différentes catégories avec des maillots
 * différents pour mettre un peu plus d'âme ») ; ce sont des personnes qui
 * n'existent pas, jamais présentées comme des licenciés. Tant qu'une photo
 * manque, la carte montre la couleur de son maillot et son initiale.
 */
export interface JoueurClub {
  id: string;
  categorie: string;
  prenom: string;
  poste: string;
  note: number;
  /** La couleur du maillot (le repli sans photo). */
  maillot: string;
  photo: string;
  lue: string;
}

export const JOUEURS_CLUB: readonly JoueurClub[] = [
  { id: "u11", categorie: "U11", prenom: "Nolan", poste: "ATT", note: 64, maillot: "#7fb7e6", photo: "/club/joueurs/u11.webp", lue: "Un jeune joueur de U11 en maillot rayé bleu ciel" },
  { id: "u15", categorie: "U15 F", prenom: "Inès", poste: "MIL", note: 71, maillot: "#f2c230", photo: "/club/joueurs/u15-filles.webp", lue: "Une joueuse de U15 en maillot jaune" },
  { id: "seniors", categorie: "Seniors", prenom: "Karim", poste: "ATT", note: 79, maillot: "#b3262e", photo: "/club/joueurs/seniors.webp", lue: "Un joueur senior en maillot rouge, sous les projecteurs" },
  { id: "feminines", categorie: "Féminines", prenom: "Awa", poste: "DÉF", note: 77, maillot: "#1f6b45", photo: "/club/joueurs/feminines.webp", lue: "Une joueuse senior, capitaine, en maillot vert" },
  { id: "veterans", categorie: "Vétérans", prenom: "Didier", poste: "G", note: 72, maillot: "#2a2a2a", photo: "/club/joueurs/veterans.webp", lue: "Un vétéran en maillot noir et blanc qui lace ses chaussures" },
];

/** L'entraîneuse : la photo des quatre vues. */
export const COACH_CLUB = { photo: "/club/joueurs/coach.webp", lue: "Une entraîneuse au bord du terrain, un carnet à la main" } as const;

export const MANIFESTE_CLUB = {
  ligne: ["Du plus petit", "au plus ancien."],
  phrase: "Chaque licencié compte. Chacun a sa carte.",
} as const;

export const CHIFFRES_CLUB = [
  { valeur: "1", texte: "app pour tout le club" },
  { valeur: "4", texte: "cartes : joueur, parent, entraîneur, présidence" },
  { valeur: "0", texte: "feuille de papier" },
] as const;

/** Une capture de l'app : sa source, ce qu'elle montre, sa taille en pixels. */
export interface CaptureClub {
  src: string;
  lue: string;
  largeur: number;
  hauteur: number;
}

/** Un écran entier de téléphone (390 × 844 en double densité). */
const ECRAN = { largeur: 780, hauteur: 1688 } as const;

/** Une section : son étiquette, son titre, ses phrases, et l'écran qui l'illustre. */
export interface SectionClub {
  id: string;
  etiquette: string;
  titre: string;
  phrases: readonly string[];
  capture: CaptureClub;
}

/**
 * Les sections montrent le rendu de l'app Bola Club tel qu'on le dessine
 * (27/11/2026, fils « Concevoir l'app Bola Club par rôle » et « Ajouter les
 * séances d'entraînement ») : la Map du club, le match, l'Actu, la gestion,
 * le planning de l'entraîneur. Club et joueurs fictifs (FC Démo).
 */
export const SECTIONS_CLUB: readonly SectionClub[] = [
  {
    id: "map",
    etiquette: "La Map du club",
    titre: "Le club, c’est la maison.",
    phrases: ["Tous les matchs de la semaine autour du stade.", "À domicile, à l’extérieur, toutes les équipes."],
    capture: { src: "/club/app/map.webp", lue: "La Map du club : le stade et les matchs de la semaine de chaque équipe", ...ECRAN },
  },
  {
    id: "match",
    etiquette: "Le jour du match",
    titre: "Il vient. Ou pas.",
    phrases: ["La convocation arrive sur le téléphone.", "Joueurs et parents répondent en un geste."],
    capture: { src: "/club/app/match.webp", lue: "Un match U13 : le lieu, le rendez-vous, les convoqués et la réponse", ...ECRAN },
  },
  {
    id: "planning",
    etiquette: "L’entraîneur",
    titre: "La semaine, séance par séance.",
    phrases: ["Programmes, exercices, appel.", "Chaque équipe a son planning."],
    capture: { src: "/club/app/planning.webp", lue: "Le planning de l’entraîneur : les entraînements de la semaine", largeur: 780, hauteur: 1410 },
  },
  {
    id: "actu",
    etiquette: "Actu",
    titre: "La vie du club, en direct.",
    phrases: ["Résultats, joueur du mois, annonces.", "Et les autres clubs Bola autour."],
    capture: { src: "/club/app/actu.webp", lue: "L’Actu du club : un résultat, le joueur du mois, un mot de la présidente", ...ECRAN },
  },
  {
    id: "club",
    etiquette: "La présidence",
    titre: "Tout le club dans la main.",
    phrases: ["Licences, équipes, accords parentaux.", "Ce qui reste à faire, au même endroit."],
    capture: { src: "/club/app/club.webp", lue: "L’espace de la présidente : licences, choses à faire, équipes", ...ECRAN },
  },
];

/** L'écran sur ordinateur : le planning, vu par l'administration. */
export const ORDINATEUR_CLUB = {
  etiquette: "Sur ordinateur",
  titre: "Le bureau du club.",
  phrase: "Le même club, en grand, pour préparer la semaine.",
  capture: { src: "/club/app/ordinateur-planning.webp", lue: "Le planning de tout le club sur ordinateur", largeur: 1400, hauteur: 1078 },
} as const;

/** Une vue : le rôle, ce qu'il y fait, et sa carte. */
export interface RoleClub {
  id: string;
  nom: string;
  phrase: string;
  carte: CaptureClub;
}

export const ROLES_CLUB = {
  etiquette: "Quatre cartes",
  titre: "Chacun a la sienne.",
  roles: [
    { id: "joueur", nom: "Joueur", phrase: "Sa note, sa saison, ses convocations.", carte: { src: "/club/app/carte-joueur.webp", lue: "La carte d’un joueur U13 et sa note qui monte", ...ECRAN } },
    { id: "parent", nom: "Parent", phrase: "La progression de son enfant.", carte: { src: "/club/app/carte-parent.webp", lue: "La carte d’un parent et la progression de son enfant", ...ECRAN } },
    { id: "entraineur", nom: "Entraîneur", phrase: "Ses équipes, ceux qui montent.", carte: { src: "/club/app/carte-entraineur.webp", lue: "La carte d’un entraîneur et ses équipes", ...ECRAN } },
    { id: "presidente", nom: "Présidence", phrase: "Le club entier, en chiffres.", carte: { src: "/club/app/carte-presidente.webp", lue: "La carte de la présidente et les chiffres du club", ...ECRAN } },
  ] satisfies RoleClub[],
} as const;

// ─────────────── Le formulaire ───────────────

export const PAYS = ["France", "Belgique", "Suisse", "Luxembourg", "Autre"] as const;
export type Pays = (typeof PAYS)[number];

export const TAILLES = [
  { id: "moins-60", texte: "Moins de 60" },
  { id: "60-200", texte: "60 à 200" },
  { id: "200-500", texte: "200 à 500" },
  { id: "plus-500", texte: "Plus de 500" },
] as const;
export type Taille = (typeof TAILLES)[number]["id"];

export const ROLES_CONTACT = ["Président", "Secrétaire", "Responsable sportif", "Entraîneur", "Autre"] as const;
export type RoleContact = (typeof ROLES_CONTACT)[number];

export interface DemandeClub {
  club: string;
  ville: string;
  pays: Pays;
  licencies: Taille;
  nom: string;
  role: RoleContact;
  email: string;
  telephone: string;
  message: string;
}

export const FORMULAIRE_CLUB = {
  etiquette: "Démo",
  titre: "Essayez Bola Club avec votre club.",
  phrase: "Laissez vos coordonnées.\nOn vous montre l’app.",
  champs: {
    club: "Nom du club",
    ville: "Ville",
    pays: "Pays",
    licencies: "Licenciés",
    nom: "Votre nom",
    role: "Votre rôle",
    email: "Email",
    telephone: "Téléphone",
    message: "Un mot",
  },
  facultatif: "facultatif",
  envoyer: "Demander une démo",
  envoi: "Envoi…",
  merci: { titre: "C’est noté.", phrase: "On revient vers vous très vite." },
  confidentialite: "Vos coordonnées servent seulement à vous recontacter.",
  lienConfidentialite: "Confidentialité",
} as const;

export const LIMITES = {
  club: [2, 80],
  ville: [2, 60],
  nom: [2, 60],
  message: [0, 1000],
} as const;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TELEPHONE = /^[0-9 +().-]{6,20}$/;

/** Le formulaire nettoyé : espaces resserrés, email en minuscules. */
export function nettoyerDemande(d: Partial<Record<keyof DemandeClub, unknown>>): DemandeClub {
  const t = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
  return {
    club: t(d.club),
    ville: t(d.ville),
    pays: t(d.pays) as Pays,
    licencies: t(d.licencies) as Taille,
    nom: t(d.nom),
    role: t(d.role) as RoleContact,
    email: t(d.email).toLowerCase(),
    telephone: t(d.telephone),
    message: String(d.message ?? "").trim(),
  };
}

/** Ce qui ne va pas dans la demande (le premier champ fautif), ou null. */
export function erreurDemande(d: DemandeClub): { champ: keyof DemandeClub; texte: string } | null {
  const long = (v: string, [min, max]: readonly [number, number]) => v.length >= min && v.length <= max;
  if (!long(d.club, LIMITES.club)) return { champ: "club", texte: "Le nom du club, s’il vous plaît." };
  if (!long(d.ville, LIMITES.ville)) return { champ: "ville", texte: "La ville du club." };
  if (!PAYS.includes(d.pays)) return { champ: "pays", texte: "Le pays du club." };
  if (!TAILLES.some((x) => x.id === d.licencies)) return { champ: "licencies", texte: "Le nombre de licenciés." };
  if (!long(d.nom, LIMITES.nom)) return { champ: "nom", texte: "Votre nom." };
  if (!ROLES_CONTACT.includes(d.role)) return { champ: "role", texte: "Votre rôle au club." };
  if (d.email.length > 120 || !EMAIL.test(d.email)) return { champ: "email", texte: "Un email valide." };
  if (d.telephone && !TELEPHONE.test(d.telephone)) return { champ: "telephone", texte: "Un numéro de téléphone valide." };
  if (!long(d.message, LIMITES.message)) return { champ: "message", texte: "Un mot de 1 000 caractères au plus." };
  return null;
}

/** La source de la visite (« ?utm_source=… », « ?utm_campaign=… ») : ce que la base accepte, ou null. */
export function sourceDemande(params: URLSearchParams): string | null {
  const brut = [params.get("utm_source"), params.get("utm_campaign")].filter(Boolean).join(".").toLowerCase();
  const s = brut.replace(/[^a-z0-9._-]/g, "").slice(0, 60);
  return s || null;
}
