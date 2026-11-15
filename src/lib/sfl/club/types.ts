// Bola Club : les données d'un club abonné (bola-app#14). Le club achète un
// paquet de licences ; chaque licence active le compte d'un licencié. Le
// compte appartient au joueur, la licence au club. Tout est plat et
// sérialisable : aujourd'hui le club de démonstration, gardé sur le
// téléphone (demo.ts, store.ts) ; les tables viendront avec le branchement
// réel (supabase/schema.sql : clubs, club_licences, club_categories,
// club_membres). Aucune lecture ni écriture en base ici.

import type { Blason } from "@/lib/sfl/blason";
import type { Stats } from "@/lib/sfl/engine";
import type { Poste } from "@/lib/sfl/inscription";

export type Role = "admin" | "entraineur" | "joueur" | "parent";
export const ROLES: { id: Role; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "entraineur", label: "Entraîneur" },
  { id: "joueur", label: "Joueur" },
  { id: "parent", label: "Parent" },
];

/** Qui regarde : son rôle, et sa ligne dans le club (un staff, un joueur, un parent). */
export interface Moi {
  role: Role;
  id: string;
}

export type Palier = "club60" | "club200" | "club500";

export interface Categorie {
  id: string;
  nom: string;
  /** Son rang dans le rail. */
  ordre: number;
  /** Les entraîneurs qui la tiennent (ids du staff). */
  entraineurs: string[];
  /** L'âge qu'on n'y dépasse pas (U13 : 13) ; null sans limite. Le surclassement va vers plus âgé. */
  ageMax: number | null;
  /** Une catégorie féminine : on n'y surclasse que depuis une autre. */
  feminine?: boolean;
}

export interface Membre {
  id: string;
  prenom: string;
  nom: string;
  /** « 2014-03-12 ». */
  naissance: string;
  poste: Poste;
  categorie: string;
  /** Joue aussi avec une catégorie plus âgée. */
  surclasseEn: string | null;
  /** La carte de départ : 75 partout pour un compte neuf. */
  base: Stats;
  /** L'accord de son parent, quand il a moins de 15 ans ; null : pas encore donné. */
  accordParentalLe: string | null;
}

export interface Staff {
  id: string;
  prenom: string;
  nom: string;
  role: "admin" | "entraineur";
}

export interface ParentClub {
  id: string;
  prenom: string;
  nom: string;
  /** Son enfant mineur (un joueur du club). */
  enfant: string;
}

export type StatutLicence = "active" | "invitee" | "attente_accord" | "libre";

/** Une licence prise ; les libres ne sont pas des lignes : le total moins celles-ci. */
export interface Licence {
  id: string;
  statut: Exclude<StatutLicence, "libre">;
  /** Le compte qui la porte (un joueur ou un staff) ; null tant que l'invitation n'est pas ouverte. */
  compte: string | null;
  /** Une invitation : le nom écrit par le club, et sa catégorie. */
  invite?: { nom: string; categorie: string | null };
}

export type EtatAppel = "present" | "retard" | "absent";
export type Reponse = "present" | "absent";

export interface LigneStats {
  buts: number;
  passes: number;
}

export interface Seance {
  id: string;
  genre: "match" | "entrainement";
  categorie: string;
  /** « 2026-11-14 ». */
  jour: string;
  /** « 14h00 ». */
  heure: string;
  lieu: string;
  /** Un match : l'adversaire, et le score une fois joué. */
  adversaire?: string;
  score: { nous: number; eux: number } | null;
  convoques: string[];
  reponses: Record<string, Reponse>;
  /** L'appel, joueur par joueur ; vide tant qu'il n'est pas fait. */
  appel: Record<string, EtatAppel>;
  stats: Record<string, LigneStats>;
}

export interface NotePrivee {
  id: string;
  membre: string;
  /** L'entraîneur ou l'admin qui l'a écrite. */
  auteur: string;
  jour: string;
  texte: string;
}

export interface Annonce {
  id: string;
  /** null : tout le club. */
  categorie: string | null;
  auteur: string;
  jour: string;
  texte: string;
}

export interface Club {
  nom: string;
  initiales: string;
  blason: Blason;
  palier: Palier;
  licencesTotal: number;
  /** Le jour de la démo, figé : les captures ne bougent pas. */
  jour: string;
  categories: Categorie[];
  membres: Membre[];
  staff: Staff[];
  parents: ParentClub[];
  licences: Licence[];
  seances: Seance[];
  notes: NotePrivee[];
  annonces: Annonce[];
  /** Qui est « moi » sous chaque point de vue de la démo. */
  demo: Record<Role, string>;
}

/** Les paliers d'abonnement, affichés à titre indicatif : rien ne se paie dans l'app. */
export const PALIERS: Record<Palier, { nom: string; licences: number; an: number; mois: number }> = {
  club60: { nom: "Club 60", licences: 60, an: 590, mois: 59 },
  club200: { nom: "Club 200", licences: 200, an: 1490, mois: 149 },
  club500: { nom: "Club 500", licences: 500, an: 2990, mois: 299 },
};
export const LICENCE_EN_PLUS = 8;

export const nomComplet = (p: { prenom: string; nom: string }) => `${p.prenom} ${p.nom}`;
/** « Prénom N. » : une signature, un buteur. */
export const nomCourt = (p: { prenom: string; nom: string }) => `${p.prenom} ${p.nom[0]}.`;
