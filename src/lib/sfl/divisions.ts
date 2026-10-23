// Les divisions de la Sunday Five League (Sabri, 23/10 : « dimanche, c'est le
// dernier jour sans division. Battez-vous pour qu'au terme de ce dimanche-là,
// on découpe la ligue en trois divisions »).
//
// Le calendrier, saison 1 :
//   · jusqu'à la J3, une seule ligue. L'app annonce les divisions et montre à
//     chacun où il tomberait si on coupait ce soir (la projection) ;
//   · la J3 jouée, le Pépite d'Or de la saison coupe la ligue en divisions
//     de 30 joueurs (Sabri, 23/10 : « Il faut faire des divisions de 30
//     joueurs ») : les 30 premiers en D1, les 30 suivants en D2, les autres
//     en D3. À égalité de points, même division : les ex æquo de la 30e
//     place entrent tous en D1. Qui n'a pas encore joué de la saison entre
//     en D3, la division ouverte ;
//   · dès la J4, chaque dimanche joué fait bouger : les points Pépite de la
//     journée (saisie/engine.ts, entryPP) font monter (MONTEE ou plus),
//     rester, ou descendre (DESCENTE ou moins), d'une division à la fois. Un
//     absent garde sa division ; une absence injustifiée (−2) fait descendre.
//
// Rien n'est stocké : tout se relit dans les feuilles de la saison, comme les
// classements, si bien qu'une feuille corrigée corrige les divisions. Le
// réglage est ici et nulle part ailleurs.
//
// L'annonce, jusqu'au soir de la J3 (bas du fichier) : quand elle court, son
// édition (la semaine, puis le dimanche même), la fenêtre de sa notification
// (la veille dès 18 h, le dimanche de 9 h au coup d'envoi) et ses phrases,
// les mêmes dans les Actus (actus/divisions.tsx), à l'ouverture de l'app
// (annonce-divisions.tsx) et sur le téléphone (/api/divisions/annoncer).
//
// Les règles officielles de Bola (dépôt BOLA, docs/gameplay 04 et 11) ne
// prévoient des divisions que pour les équipes du mode Team, avec montées et
// descentes en fin de saison. La ligue du dimanche suit la règle de Sabri.

import { rankPlayers, type RankedPlayer } from "./engine";
import { isHidden } from "./hidden";
import { jourMoisDuLibelle, voteOuvert } from "./convocation-temps";
import { heureMin } from "./ligue-vierge";
import { matchsDeJournee, premierCoupDEnvoi } from "./matchs-du-jour";
import { computeJournees, computeStandings, entryPP } from "./saisie/engine";
import { journeeJouee } from "./saisie/mutations";
import { numeroSaison, type Saison } from "./saisie/types";

export type Division = 1 | 2 | 3;
export const DIVISIONS: readonly Division[] = [1, 2, 3];

export const REGLES_DIVISIONS = {
  /** La saison où naissent les divisions. */
  saison: 1,
  /** Les places de la D1 et de la D2 au découpage ; la D3 prend les autres. */
  taille: 30,
  /** La première journée jouée en divisions ; celle d'avant fait le découpage. */
  depuis: 4,
  /** Les points de la journée qui font monter d'une division. */
  montee: 9,
  /** Les points de la journée (ou moins) qui font descendre d'une division. */
  descente: 3,
} as const;

/** La journée qui coupe la ligue : la dernière sans divisions. */
export const J_DECOUPAGE = REGLES_DIVISIONS.depuis - 1;

/** Une place au découpage : la division, et le rang au Pépite d'Or qui l'a donnée. */
export interface PlaceDecoupage {
  nom: string;
  division: Division;
  rang: number;
  pp: number;
}

export interface Decoupage {
  /** Chaque division, du mieux classé au moins bien classé. */
  divisions: Record<Division, PlaceDecoupage[]>;
  parNom: Map<string, PlaceDecoupage>;
  /** Combien de joueurs classés. */
  classes: number;
}

/**
 * Le Pépite d'Or coupé en divisions de REGLES_DIVISIONS.taille joueurs, sur
 * les journées jouées jusqu'à `jusqua` (toutes si absent). Une journée pas
 * encore jouée ne compte pas : sa feuille donne déjà le point de présence à
 * chacun de ses joueurs, et des nouveaux à 1 point feraient bouger les
 * places avant d'avoir touché un ballon. Seuls comptent ceux qui ont joué un
 * match de la saison ; les joueurs masqués restent hors de la liste publique.
 */
export function decouper(saison: Saison, jusqua?: number): Decoupage {
  const jouees = new Set(saison.journees.map((m) => m.j).filter((j) => journeeJouee(saison, j)));
  const entries = saison.entries.filter((e) => jouees.has(e.j) && (jusqua == null || e.j <= jusqua));
  const classes: RankedPlayer[] = rankPlayers(
    computeStandings({ ...saison, entries }).filter((p) => p.matchs > 0 && !isHidden(p.name))
  );
  const { taille } = REGLES_DIVISIONS;
  const divisions: Record<Division, PlaceDecoupage[]> = { 1: [], 2: [], 3: [] };
  const parNom = new Map<string, PlaceDecoupage>();
  for (const p of classes) {
    // Le rang des ex æquo est le même (rankPlayers) : à la 30e place, tous entrent.
    const division: Division = p.rank <= taille ? 1 : p.rank <= taille * 2 ? 2 : 3;
    const place = { nom: p.name, division, rang: p.rank, pp: p.pp };
    divisions[division].push(place);
    parNom.set(p.name, place);
  }
  return { divisions, parNom, classes: classes.length };
}

/**
 * Ce qui sépare un joueur des divisions voisines au découpage : les points
 * qu'il lui faut pour rejoindre le dernier de la division du dessus (à
 * égalité, on y entre), et son avance sur le premier de celle du dessous.
 */
export function ecartsDecoupage(d: Decoupage, nom: string): { monter: number | null; avance: number | null } {
  const place = d.parNom.get(nom);
  if (!place) return { monter: null, avance: null };
  const dessus = place.division > 1 ? d.divisions[(place.division - 1) as Division].at(-1) : undefined;
  const dessous = place.division < 3 ? d.divisions[(place.division + 1) as Division][0] : undefined;
  return {
    monter: dessus ? dessus.pp - place.pp : null,
    avance: dessous ? place.pp - dessous.pp : null,
  };
}

/** Où va un joueur après un dimanche joué en division `de`, avec `points` sur la journée. */
export function apresLaJournee(de: Division, points: number): Division {
  if (points >= REGLES_DIVISIONS.montee) return Math.max(1, de - 1) as Division;
  if (points <= REGLES_DIVISIONS.descente) return Math.min(3, de + 1) as Division;
  return de;
}

/** Un dimanche joué en divisions, joueur par joueur. */
export interface Mouvement {
  nom: string;
  /** La division où il a joué ce dimanche. */
  de: Division;
  /** Celle où il jouera le suivant. */
  vers: Division;
  /** Ses points Pépite de la journée. */
  points: number;
}

export interface EtatDivisions {
  /** « annonce » : avant la fin de la J3, la projection ; « divisions » : la ligue est coupée. */
  phase: "annonce" | "divisions";
  /** La division de chacun pour le prochain dimanche ; en annonce, celle de la projection. */
  actuelle: Map<string, Division>;
  /** Le découpage de la J3 (ou la projection de ce soir, en annonce). */
  decoupage: Decoupage;
  /** Les dimanches joués en divisions, dans l'ordre, avec qui monte et qui descend. */
  journees: { j: number; mouvements: Mouvement[] }[];
}

/** La saison des divisions ; null pour une saison qui n'en a pas (la saison 0). */
export function etatDivisions(saison: Saison): EtatDivisions | null {
  if (numeroSaison(saison) !== REGLES_DIVISIONS.saison) return null;
  if (!journeeJouee(saison, J_DECOUPAGE)) {
    const decoupage = decouper(saison);
    return {
      phase: "annonce",
      actuelle: new Map([...decoupage.parNom].map(([n, p]) => [n, p.division])),
      decoupage,
      journees: [],
    };
  }
  const decoupage = decouper(saison, J_DECOUPAGE);
  const actuelle = new Map<string, Division>([...decoupage.parNom].map(([n, p]) => [n, p.division]));
  const journees: EtatDivisions["journees"] = [];
  const jouees = [...new Set(saison.journees.map((m) => m.j))]
    .filter((j) => j >= REGLES_DIVISIONS.depuis && journeeJouee(saison, j))
    .sort((a, b) => a - b);
  for (const j of jouees) {
    // Les points de la journée, par joueur : présents et absents injustifiés
    // seulement. Un absent excusé, un blessé, un suspendu ne bougent pas.
    const points = new Map<string, number>();
    const compte = new Set<string>();
    for (const e of saison.entries) {
      if (e.j !== j) continue;
      if ((e.statut === "Présent" && !e.extraTime) || e.statut === "Absence injustifiée") compte.add(e.player);
      points.set(e.player, (points.get(e.player) ?? 0) + entryPP(e));
    }
    const mouvements: Mouvement[] = [];
    for (const nom of compte) {
      if (isHidden(nom)) continue;
      const de = actuelle.get(nom) ?? 3;
      const pts = points.get(nom) ?? 0;
      const vers = apresLaJournee(de, pts);
      mouvements.push({ nom, de, vers, points: pts });
      actuelle.set(nom, vers);
    }
    mouvements.sort((a, b) => a.de - b.de || b.points - a.points || a.nom.localeCompare(b.nom, "fr"));
    journees.push({ j, mouvements });
  }
  return { phase: "divisions", actuelle, decoupage, journees };
}

/** La division d'un joueur pour le prochain dimanche (D3 pour qui n'a jamais joué). */
export function divisionDe(etat: EtatDivisions, nom: string): Division {
  return etat.actuelle.get(nom) ?? 3;
}

/** Ce que le dernier dimanche joué en divisions a fait de chacun. */
export interface BilanDivisions {
  j: number;
  parNom: Map<string, Mouvement>;
  montees: number;
  descentes: number;
}

/** Le bilan du dernier dimanche joué en divisions ; null avant la J4 jouée. */
export function dernierBilan(etat: EtatDivisions | null): BilanDivisions | null {
  const derniere = etat?.journees.at(-1);
  if (!derniere) return null;
  return {
    j: derniere.j,
    parNom: new Map(derniere.mouvements.map((m) => [m.nom, m])),
    montees: derniere.mouvements.filter((m) => m.vers < m.de).length,
    descentes: derniere.mouvements.filter((m) => m.vers > m.de).length,
  };
}

/** « 11 pts », « 1 pt », « −2 pts ». */
export const enPoints = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n)} ${Math.abs(n) > 1 ? "pts" : "pt"}`;

/**
 * Ce que le dernier dimanche a fait d'un joueur, sans point final : « Tu
 * montes en D1 avec 11 pts », « Tu restes en D2 avec 6 pts, 9 pts dimanche
 * et tu montes ». null pour un joueur masqué ou sans division.
 */
export function phraseBilan(etat: EtatDivisions, bilan: BilanDivisions, nom: string): string | null {
  if (isHidden(nom)) return null;
  const m = bilan.parNom.get(nom);
  if (!m) {
    const d = etat.actuelle.get(nom);
    return d ? `Tu restes en ${nomDivision(d)}` : null;
  }
  if (m.vers < m.de) return `Tu montes en ${nomDivision(m.vers)} avec ${enPoints(m.points)}`;
  if (m.vers > m.de) return `Tu descends en ${nomDivision(m.vers)} avec ${enPoints(m.points)}`;
  const reste = `Tu restes en ${nomDivision(m.vers)} avec ${enPoints(m.points)}`;
  return m.vers > 1 ? `${reste}, ${REGLES_DIVISIONS.montee} pts dimanche et tu montes` : reste;
}

/* ------------------------------- L'annonce ------------------------------- */
// Jusqu'au dimanche de la J3, l'app annonce les divisions (Sabri : « ça fait
// des annonces jusqu'à dimanche ») : la rubrique des Actus, l'écran de
// l'ouverture, la convocation, et une notification la veille.

/** Le jour, l'heure (en minutes) et l'année qu'il est à Paris. */
function aParis(d: Date): { annee: number; mois: number; jour: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { annee: v("year"), mois: v("month"), jour: v("day"), minutes: v("hour") * 60 + v("minute") };
}

/** Le jour et le mois de la journée du découpage, lus dans son libellé (« 25 oct. »). */
function jourDuDecoupage(saison: Saison) {
  const j3 = saison.journees.find((m) => m.j === J_DECOUPAGE);
  return j3 ? jourMoisDuLibelle(j3.date) : null;
}

/**
 * Le coup d'envoi de la J3 : celui de son premier match (matchs-du-jour.ts),
 * sinon l'heure de la journée, sinon celle de la convocation, sinon 13 h.
 */
function coupDEnvoiDuDecoupage(saison: Saison, convocation?: string | null): string {
  const heure = saison.journees.find((m) => m.j === J_DECOUPAGE)?.heure ?? convocation ?? "13h00";
  const journee = computeJournees(saison).find((x) => x.j === J_DECOUPAGE);
  return premierCoupDEnvoi(matchsDeJournee(journee, [], { heure, lieu: null }), heure);
}

/**
 * L'annonce court jusqu'au bout du dernier dimanche sans divisions, minuit
 * (Paris), pendant que la feuille se remplit. Sans date pour la J3, elle
 * court tant que la J3 n'est pas jouée.
 */
export function annonceEnCours(saison: Saison, maintenant: Date): boolean {
  if (numeroSaison(saison) !== REGLES_DIVISIONS.saison) return false;
  const jm = jourDuDecoupage(saison);
  if (!jm) return !journeeJouee(saison, J_DECOUPAGE);
  const ici = aParis(maintenant);
  return ici.mois < jm.mois || (ici.mois === jm.mois && ici.jour <= jm.jour);
}

/** « avant » le dimanche, « jour » le dimanche même ; null une fois l'annonce passée. */
export type EditionAnnonce = "avant" | "jour";

export function editionAnnonce(saison: Saison, maintenant: Date): EditionAnnonce | null {
  if (!annonceEnCours(saison, maintenant)) return null;
  const j3 = saison.journees.find((m) => m.j === J_DECOUPAGE);
  return j3 && voteOuvert(j3.date, maintenant) ? "jour" : "avant";
}

/** La ligue est coupée, la J4 pas encore jouée : les divisions de la J4 s'affichent. */
export function decoupageAnnonce(saison: Saison, maintenant: Date): boolean {
  return (
    numeroSaison(saison) === REGLES_DIVISIONS.saison &&
    !annonceEnCours(saison, maintenant) &&
    journeeJouee(saison, J_DECOUPAGE) &&
    !journeeJouee(saison, REGLES_DIVISIONS.depuis)
  );
}

/** Quand part la notification de l'annonce : la veille de la J3 dès 18 h, le jour même de 9 h au coup d'envoi (Paris). */
export const FENETRE_NOTIFICATION = { veille: 18 * 60, matin: 9 * 60 } as const;

export function fenetreNotification(saison: Saison, maintenant: Date, heureConvocation?: string | null): boolean {
  if (numeroSaison(saison) !== REGLES_DIVISIONS.saison || journeeJouee(saison, J_DECOUPAGE)) return false;
  const jm = jourDuDecoupage(saison);
  if (!jm) return false;
  const ici = aParis(maintenant);
  const veille = new Date(Date.UTC(ici.annee, jm.mois - 1, jm.jour - 1));
  if (ici.mois === veille.getUTCMonth() + 1 && ici.jour === veille.getUTCDate()) return ici.minutes >= FENETRE_NOTIFICATION.veille;
  if (ici.mois === jm.mois && ici.jour === jm.jour)
    return ici.minutes >= FENETRE_NOTIFICATION.matin && ici.minutes < heureMin(coupDEnvoiDuDecoupage(saison, heureConvocation));
  return false;
}

const pts = (n: number) => `${n} ${n > 1 ? "pts" : "pt"}`;

/** « 1re », « 26e » : le rang d'une place. */
const ordinal = (n: number) => (n === 1 ? "1re" : `${n}e`);

/**
 * Où tombe un joueur au découpage, en toutes lettres : « tu serais en D2, à
 * 3 pts de la D1 et 1 pt devant la D3 ». Tant que personne n'est classé sous
 * sa division, sa place la remplace (`place`, par défaut) : « tu serais en
 * D1, à la 26e des 30 places ». null pour qui n'est pas classé.
 */
export function taDivision(d: Decoupage, nom: string, { place: avecPlace = true }: { place?: boolean } = {}): string | null {
  const place = d.parNom.get(nom);
  if (!place) return null;
  const { monter, avance } = ecartsDecoupage(d, nom);
  const ecarts = [
    monter != null ? `à ${pts(monter)} de la ${nomDivision((place.division - 1) as Division)}` : null,
    avance != null ? `${pts(avance)} devant la ${nomDivision((place.division + 1) as Division)}` : null,
  ].filter(Boolean);
  if (avecPlace && avance == null && place.division < 3) {
    // Le rang dans sa division, compté depuis son premier : la D2 commence après la 30e place.
    const premier = d.divisions[place.division][0].rang;
    ecarts.push(`à la ${ordinal(place.rang - premier + 1)} des ${REGLES_DIVISIONS.taille} places`);
  }
  return `tu serais en ${nomDivision(place.division)}${ecarts.length ? `, ${ecarts.join(" et ")}` : ""}`;
}

/** « D2 », pour les étiquettes. */
export function nomDivision(d: Division): string {
  return `D${d}`;
}

/** Ce que l'annonce dit à tous, sans point final. */
export function enteteAnnonce(edition: EditionAnnonce): string {
  return `${edition === "jour" ? "Ce soir" : `Après la J${J_DECOUPAGE}`}, la ligue se coupe en trois`;
}

/**
 * Ce que l'annonce dit à un joueur, sans point final : où il tomberait si on
 * coupait maintenant, ou ce qui le placera. null pour un joueur masqué.
 */
export function phraseAnnonce(
  saison: Saison,
  d: Decoupage,
  nom: string,
  edition: EditionAnnonce,
  options: { place?: boolean } = {}
): string | null {
  if (isHidden(nom)) return null;
  const ta = taDivision(d, nom, options);
  if (ta) return `${edition === "jour" ? "Pour l'instant" : "Si on coupait ce soir"}, ${ta}`;
  if (saison.entries.some((e) => e.j === J_DECOUPAGE && e.player === nom))
    return `Tes points ${edition === "jour" ? "d'aujourd'hui" : "de dimanche"} te placent`;
  return `Sans match cette saison, tu commences en ${nomDivision(3)}`;
}

/**
 * La place dans sa division (« à la 26e des 30 places ») entre dans le texte
 * de la notification, comme dans l'app : avec des divisions de 30, tous les
 * classés tombent en D1 avant la J3, et la place leur dit ce qu'ils risquent.
 * Sabri l'a choisie le 23/10 ; false rend le texte de son premier accord.
 */
export const PLACE_DANS_LA_NOTIFICATION = true;

/** La notification de l'annonce, pour un joueur (titre ≤ 60 signes, texte ≤ 180, lib/sfl/push.ts). */
export function notificationAnnonce(saison: Saison, d: Decoupage, nom: string, edition: EditionAnnonce): { titre: string; texte: string } {
  const phrase =
    phraseAnnonce(saison, d, nom, edition, { place: PLACE_DANS_LA_NOTIFICATION }) ??
    `Dès la J${REGLES_DIVISIONS.depuis}, chacun joue dans sa division`;
  return {
    titre: `J${J_DECOUPAGE} · Dernier dimanche sans divisions`,
    texte: `${enteteAnnonce(edition)}. ${phrase}.`,
  };
}
