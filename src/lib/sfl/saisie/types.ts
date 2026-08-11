// Modèle de données « brut » de la saisie admin — l'équivalent des feuilles
// SAISIE MATCH et JOUEURS & RÈGLES de l'Excel. Tout le reste de l'app (classements,
// journées, cartes boost) est DÉRIVÉ de ces données par saisie/engine.ts.
//
// C'est volontairement plat et sérialisable : aujourd'hui stocké en localStorage
// (maquette), demain persisté tel quel dans Supabase — le moteur ne changera pas.

export type PlayerStatutSaisie =
  | "Présent"
  | "Absent justifié"
  | "Absence injustifiée"
  | "Blessure"
  | "Suspendu";

export type MatchResult = "Victoire" | "Défaite" | "Nul";

// Une ligne = un joueur pour un match d'une journée (comme une ligne SAISIE MATCH).
export interface MatchEntry {
  j: number; // numéro de journée
  player: string;
  team: string | null; // équipe du jour (couleur) ; null = journée « à plat »
  statut: PlayerStatutSaisie;
  result: MatchResult | null;
  sflTime: boolean;
  buts: number;
  passes: number;
  cleanSheet: boolean;
  mvp: boolean;
  impact: boolean;
  def: boolean;
  retard: boolean; // retard non prévenu
  // Feuille de match en direct. Barème : 2 arrêts = 1 point Pépite, et
  // 2 interceptions = 1 point Pépite (les deux comptent séparément).
  arrets?: number;
  interceptions?: number;
  note?: string; // mention affichée (ex. « Extra time »)
  teamScoreBonus?: number; // buts d'équipe non attribués à un joueur (ex. but d'extra time)
  pepiteBonus?: number; // points Pépite manuels (ex. +1 pour un extra time)
  extraTime?: boolean; // n'ouvre ni présence ni match : seuls note/bonus s'appliquent
}

// Fiche joueur (comme JOUEURS & RÈGLES) : base fixe de la carte + méta.
export interface RosterEntry {
  name: string;
  poste: string | null;
  profil: string; // "Actif" | "Blessure" | "En attente" | ...
  base: number[] | null; // [VIT, TIR, PAS, DRI, DEF, PHY] ; null = non évalué (→ 75)
}

export interface JourneeMeta {
  j: number;
  date: string;
  sflTime: boolean;
}

// Événement minuté d'un match — alimente la timeline et la détection du
// tournant. Optionnel : tant que le classeur ne porte pas les minutes, les
// modules concernés ne s'affichent pas, le reste du récap est inchangé.
export interface MatchEvent {
  j: number;
  matchId?: string; // id du match dans la journée (si plusieurs)
  minute: number;
  team: string; // couleur qui marque
  player: string;
  passeur?: string;
  type?: "but" | "csc"; // défaut : but
}

// Convocation d'un match à venir : date/heure/lieu + réponses des joueurs.
// La liste des confirmés pré-remplit ensuite l'assistant « Nouvelle journée ».
export type ConvocationReponse = "present" | "absent";

export interface Convocation {
  id: number;
  jour: string; // "Dimanche"
  date: string; // "26 juillet"
  heure: string; // "13h00"
  lieu: string;
  statut: "ouverte" | "clôturée";
  reponses: Record<string, ConvocationReponse>;
}

// État complet de la saison, unité de stockage (localStorage / Supabase).
export interface Saison {
  journees: JourneeMeta[];
  roster: RosterEntry[];
  entries: MatchEntry[];
  convocations: Convocation[];
  /** Buts minutés, quand le classeur les fournit. */
  events?: MatchEvent[];
}

export type AlertLevel = "error" | "warning";

export interface SaisieAlert {
  level: AlertLevel;
  j: number;
  player: string;
  message: string;
}
