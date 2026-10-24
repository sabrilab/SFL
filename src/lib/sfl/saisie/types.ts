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
  /** Recopiée pour le compte vitrine, sur son seul téléphone (compte-vitrine.ts) : jamais écrite. */
  vitrine?: true;
}

// Fiche joueur (comme JOUEURS & RÈGLES) : base fixe de la carte + méta.
export interface RosterEntry {
  name: string;
  poste: string | null;
  profil: string; // "Actif" | "Blessure" | "En attente" | ...
  base: number[] | null; // [VIT, TIR, PAS, DRI, DEF, PHY] ; null = non évalué (→ 75)
  /** Posée par le compte vitrine (compte-vitrine.ts) : la base d'avant, ou une fiche ajoutée. Jamais écrite. */
  vitrine?: { base: number[] | null } | "ajout";
}

export interface JourneeMeta {
  j: number;
  date: string;
  sflTime: boolean;
  /** Coup d'envoi, « 13h00 ». Absent : celui de la convocation. */
  heure?: string;
  /** Le terrain où elle se joue (saison.terrains) ; absent : le terrain par défaut. */
  terrainId?: number;
  /**
   * MVP choisi par l'app d'après les stats du match, sans vote (saisie/mvp.ts).
   * Posé sur chaque journée créée depuis le 15/10 ; absent sur les anciennes,
   * qui gardent leurs MVP tels qu'ils ont été désignés.
   */
  mvpAuto?: boolean;
  /**
   * Les matchs de la journée, Match 1 d'abord : qui s'y affronte, et l'heure,
   * le lieu et le terrain de chacun quand ce ne sont pas ceux de la journée.
   * Absent : les équipes s'apparient d'elles-mêmes (saisie/engine.ts), à
   * l'heure et au lieu de la journée.
   */
  matchsDuJour?: MatchDuJour[];
}

/**
 * Un match d'une journée (« Match 2 »), Noirs contre Blancs. Sabri, 23/10 :
 * « Dans une journée, il faudrait que je puisse changer l'heure de chaque
 * terrain. Et également l'endroit. » Puis : « Noir contre blanc, juste
 * match 1 et match 2, c'est ça qui les diffère. Même le terrain qu'ils vont
 * occuper […], et l'heure à laquelle ils vont jouer, et même l'endroit. »
 *
 * Les deux équipes y sont écrites en toutes lettres : l'appariement ne
 * dépend plus de l'ordre des lignes, qu'un absent en tête de feuille ou un
 * changement d'équipe en direct suffisait à rebattre — et l'heure d'un
 * match serait partie avec.
 */
export interface MatchDuJour {
  /** Les deux équipes (noms des lignes de saisie) : les Noirs, puis les Blancs. */
  equipes: [string, string];
  /** Son coup d'envoi, « 14h30 » ; absent : celui de la journée. */
  heure?: string;
  /** Son lieu, l'adresse sur la Map (un id de saison.terrains) ; absent : celui de la journée. */
  lieuId?: number;
  /** Le terrain qu'il occupe sur place, « Terrain 3 » ou « 3 ». */
  terrain?: string;
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

/** Une équipe composée pour dimanche — révélée aux joueurs vendredi 19h. */
export interface ConvocationTeam {
  name: string; // « Noirs 1 », « Blancs 1 »… (avant le 23/10, une couleur : « Orange »)
  players: string[];
}

export interface Convocation {
  id: number;
  jour: string; // "Dimanche"
  date: string; // "26 juillet"
  heure: string; // "13h00"
  lieu: string;
  statut: "ouverte" | "clôturée";
  reponses: Record<string, ConvocationReponse>;
  // Composées par l'admin depuis les confirmés ; l'app les révèle aux joueurs
  // à partir du vendredi 19h (voir lib/sfl/convocation-temps.ts).
  teams?: ConvocationTeam[];
}

/**
 * Une saison close, gardée telle quelle : ses journées, ses lignes, et l'effectif
 * tel qu'il était ce jour-là. On la relit, on ne la modifie plus. Le moteur la
 * dérive exactement comme une saison en cours.
 */
export interface SaisonArchivee {
  numero: number;
  nom: string; // « Saison 0 »
  /** Date de clôture, ISO. */
  cloturee: string;
  journees: JourneeMeta[];
  roster: RosterEntry[];
  entries: MatchEntry[];
  events?: MatchEvent[];
}

// État complet de la saison, unité de stockage (localStorage / Supabase).
//
// Les saisons closes voyagent DANS le même document que la saison en cours :
// une seule ligne en base, une seule synchro, aucune migration de schéma, et
// chaque appareil reçoit l'archive avec la saison nouvelle. Le document grossit
// d'une saison à chaque clôture — quelques dizaines de Ko, sans conséquence.
export interface Saison {
  /** Numéro de la saison en cours. Absent = 0, la toute première. */
  numero?: number;
  journees: JourneeMeta[];
  roster: RosterEntry[];
  entries: MatchEntry[];
  convocations: Convocation[];
  /** Buts minutés, quand le classeur les fournit. */
  events?: MatchEvent[];
  /** Les saisons closes, de la plus ancienne à la plus récente. */
  archives?: SaisonArchivee[];
  /** Les terrains de la ligue, posés sur la Map. */
  terrains?: Terrain[];
}

/**
 * Un terrain où la ligue joue : un nom, une adresse, un point sur la Map.
 * La convocation garde son `lieu` en texte libre ; la Map retrouve le terrain
 * par ce nom, et à défaut prend celui marqué par défaut.
 */
export interface Terrain {
  id: number;
  nom: string;
  adresse: string;
  lat: number;
  lng: number;
  /** La commune, pour le lettrage de la Map (« LILLE »). */
  commune?: string;
  /** Le terrain habituel : celui des matchs dont le lieu ne nomme aucun autre. */
  defaut?: boolean;
}

/** Le numéro d'une saison, 0 quand il n'a jamais été posé. */
export function numeroSaison(s: Pick<Saison, "numero">): number {
  return s.numero ?? 0;
}

export type AlertLevel = "error" | "warning";

export interface SaisieAlert {
  level: AlertLevel;
  j: number;
  player: string;
  message: string;
}
