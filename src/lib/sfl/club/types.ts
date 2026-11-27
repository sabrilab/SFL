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
import type { Cote, ZoneCorps } from "@/lib/sfl/schemas-coach";

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
  /** Le programme d'un entraînement : ses exercices dans l'ordre, chacun avec ses minutes ; absent ou vide tant qu'il n'est pas fait. */
  programme?: LigneProgramme[];
  /** Le bilan d'un entraînement, après coup : le ressenti du groupe (1 à 10) et la remarque de l'entraîneur. */
  bilan?: Bilan;
}

export interface Bilan {
  /** Le ressenti moyen du groupe, de 1 (facile) à 10 (épuisant). */
  ressenti: number;
  remarque: string;
  auteur: string;
}

/** Une ligne de l'inventaire du club. */
export interface Materiel {
  id: string;
  nom: string;
  quantite: number;
  /** Combien sont à remplacer (abîmés, perdus). */
  aRemplacer: number;
}

/** Un modèle de convocation : le groupe habituel d'une catégorie, à reprendre d'un geste. */
export interface Groupe {
  id: string;
  categorie: string;
  nom: string;
  joueurs: string[];
}

/** Une mesure d'un joueur : sa taille, sa VMA, et son poids s'il est adulte. */
export interface Mesure {
  id: string;
  membre: string;
  jour: string;
  tailleCm?: number;
  poidsKg?: number;
  /** En km/h. */
  vma?: number;
}

/**
 * Une blessure d'un joueur, notée par son staff (suivi.ts, ETAPES_REPRISE) :
 * la zone du corps (celles des schémas de Bola Agent), le côté, la gravité
 * dite par l'entraîneur, et l'étape de la reprise où il en est. Vue
 * seulement par le staff, le joueur et son parent.
 */
export interface Blessure {
  id: string;
  membre: string;
  /** Le jour où c'est arrivé. */
  jour: string;
  zone: ZoneCorps;
  cote: Cote;
  gravite: "legere" | "moyenne" | "serieuse";
  /** Ce qui s'est passé, ce qu'a dit le médecin ; « » si rien. */
  note: string;
  /** L'étape de la reprise (0 : repos … 5 : match), et le jour où elle a été franchie. */
  etape: number;
  etapeLe: string;
  /** Le feu vert d'un médecin, demandé pour une blessure sérieuse avant le retour au contact. */
  feuVert: boolean;
  /** Le jour du retour complet, une fois la reprise finie. */
  retour: string | null;
}

export interface LigneProgramme {
  /** Un exercice de la bibliothèque (exercices.ts) ou du club. */
  exercice: string;
  minutes: number;
}

export type ThemeExercice = "echauffement" | "motricite" | "technique" | "jeu" | "finition" | "physique" | "renforcement" | "gardien" | "retour";

/** Ce qu'un exercice travaille : la base des séances proposées (proposition.ts). */
export type Qualite = "motricite" | "technique" | "tactique" | "finition" | "vitesse" | "vma" | "endurance" | "renforcement" | "prevention" | "bienetre";

/** Un exercice : ceux de Bola (exercices.ts, BIBLIOTHEQUE), ou ceux qu'un club écrit. */
export interface Exercice {
  id: string;
  nom: string;
  theme: ThemeExercice;
  /** La durée conseillée. */
  minutes: number;
  /** Le nombre de joueurs, au moins et au plus. */
  joueurs: [number, number];
  espace: string;
  materiel: string;
  /** Ce qu'on y travaille, en une phrase. */
  but: string;
  deroule: string[];
  variante?: string;
  /** L'âge conseillé, de … à … ans (99 : sans limite). Absent : de 6 à 99. */
  ages?: [number, number];
  /** Ce qu'il travaille ; absent : déduit du thème. */
  qualites?: Qualite[];
  /** Sauts, sprints à fond ou frappes puissantes : allégé pendant une poussée de croissance. */
  impact?: boolean;
  origine: "bola" | "club";
  /** Un exercice du club : qui l'a écrit. */
  auteur?: string;
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
  /** Les exercices écrits par le club, à côté de ceux de Bola. */
  exercices: Exercice[];
  /** Les mesures des joueurs (suivi.ts), seulement pour le staff, le joueur et son parent. */
  mesures: Mesure[];
  materiel: Materiel[];
  groupes: Groupe[];
  blessures: Blessure[];
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
