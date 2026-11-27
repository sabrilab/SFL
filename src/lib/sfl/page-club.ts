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

/** L'écran du haut : l'effectif du club en cartes. */
export const CAPTURE_HAUT = { src: "/club/effectif.webp", lue: "L’effectif d’un club en cartes de joueur, triées par note" } as const;

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
  { valeur: "4", texte: "vues : admin, entraîneur, joueur, parent" },
  { valeur: "0", texte: "feuille de papier" },
] as const;

/** Une section : son étiquette, son titre, ses phrases, et la capture qui l'illustre. */
export interface SectionClub {
  id: string;
  etiquette: string;
  titre: string;
  phrases: readonly string[];
  capture: { src: string; lue: string };
}

/** Les captures font 780 × 1200 (le haut d'un écran de 390 × 600, en double densité). */
export const CAPTURE = { largeur: 780, hauteur: 1200 } as const;

export const SECTIONS_CLUB: readonly SectionClub[] = [
  {
    id: "actus",
    etiquette: "Actus du club",
    titre: "Tout le club au même endroit.",
    phrases: ["Convocations, résultats, annonces.", "Chaque catégorie a son fil."],
    capture: { src: "/club/actus.webp", lue: "Les actus d’un club : deux convocations, présents et absents" },
  },
  {
    id: "match",
    etiquette: "Le jour du match",
    titre: "Présent ou absent, en un geste.",
    phrases: ["L’entraîneur convoque, fait l’appel.", "Il saisit le score et les stats."],
    capture: { src: "/club/match.webp", lue: "La saisie d’un match : le score, les buts et les passes de chaque joueur" },
  },
  {
    id: "progression",
    etiquette: "Progression",
    titre: "Le suivi de chaque joueur.",
    phrases: ["Sa carte monte avec ses matchs.", "Évolution, présences, notes du staff."],
    capture: { src: "/club/progression.webp", lue: "La fiche d’un joueur vue par son entraîneur : sa carte et son évolution" },
  },
  {
    id: "licences",
    etiquette: "Administration",
    titre: "Les licences en un coup d’œil.",
    phrases: ["Invitez par lien, ou importez votre liste.", "L’accord des parents pour les plus jeunes."],
    capture: { src: "/club/licences.webp", lue: "L’administration d’un club : les licences, l’invitation, le staff" },
  },
];

export const ROLES_CLUB = {
  etiquette: "Quatre vues",
  titre: "Chacun voit ce qui le regarde.",
  roles: [
    { nom: "Admin", phrase: "Licences, catégories, staff." },
    { nom: "Entraîneur", phrase: "Convocations, appel, stats." },
    { nom: "Joueur", phrase: "Sa carte, ses convocations." },
    { nom: "Parent", phrase: "La carte de son enfant." },
  ],
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
