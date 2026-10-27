// Les annonces de la ligue par notification : la convocation du dimanche,
// ouverte le lundi matin pour toute la ligue, et les résultats d'une
// journée, une fois sa feuille remplie (Sabri, 24/10 : « Les convocations du
// dimanche s'ouvrent le lundi matin pour toute la ligue », « Les
// publications de MVP et des résultats, tu peux le faire »).
//
// Ce module dit QUAND et QUOI ; /api/ligue/annoncer envoie, une seule fois
// par joueur (annonces_envois), et l'app la sonne à l'ouverture
// (lib/sfl/ligue-annonce.ts), comme les divisions et l'outsider.
//
//   · La convocation : « J4 · Dimanche 1er novembre » — « 12h30 à
//     l'Hippodrome de Marcq. Tu viens ? ». Du lundi 9 h au samedi 22 h, pour
//     la convocation ouverte du prochain dimanche. Toucher ouvre la Map, sur
//     le prochain match, où l'on répond (Je viens, Pas dispo).
//   · Les résultats : quand la feuille de la journée a tous ses résultats,
//     que l'admin n'y a plus touché depuis CALME, et au plus tôt 90 minutes
//     après le coup d'envoi ; jusqu'au surlendemain. Chacun reçoit le sien :
//     le MVP « J3 · Tu es le MVP », un joueur du jour son score, les autres
//     les MVP. Toucher ouvre les Actus.
// Jamais la nuit : de 22 h (22 h 30 pour les résultats) à 9 h, l'annonce
// attend le matin.
//
// Pur : aucune lecture de base, aucune horloge à lui.

import { instantParis, jourMoisDuLibelle, labelDateFr, prochainDimanche } from "./convocation-temps";
import { aParis } from "./divisions";
import { findPlayerMatch } from "./engine";
import { isHidden } from "./hidden";
import { computeJournees } from "./saisie/engine";
import { appliquerMvpAuto } from "./saisie/mvp";
import { journeeJouee, terrainDeJournee } from "./saisie/mutations";
import { numeroSaison, type JourneeMeta, type Saison } from "./saisie/types";

/** La feuille ne bouge plus depuis ce temps-là : l'admin a fini de la remplir. */
export const CALME = 30 * 60_000;
/** Les résultats partent au plus tôt ce temps après le coup d'envoi. */
const APRES_COUP_D_ENVOI = 90;
/** L'heure de la ligue quand la journée ne dit pas la sienne (Sabri, 24/10). */
const HEURE_LIGUE = "12h30";

const minutes = (heure: string) => {
  const m = heure.match(/(\d{1,2})\s*h\s*(\d{2})?/i);
  return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : 13 * 60;
};

/** La convocation ouverte, telle que la table convocations la garde. */
export interface ConvocationOuverte {
  id: number;
  date_label: string;
  created_at: string;
}

export interface AnnonceConvocation {
  /** La clé de l'envoi (annonces_envois, push_envois.ref). */
  cle: string;
  j: number;
  titre: string;
  texte: string;
}

/** « 1er novembre », « 8 novembre ». */
function leDimanche(d: Date): string {
  return labelDateFr(d).replace(/^1 /, "1er ");
}

/** « à l'Hippodrome de Marcq », « au Five de Lille », « à Croix ». */
function aLieu(nom: string): string {
  if (/^[aeiouyéèh]/i.test(nom)) return `à l'${nom}`;
  if (/^(Le )/.test(nom)) return `au ${nom.slice(3)}`;
  if (/^(Les )/.test(nom)) return `aux ${nom.slice(4)}`;
  if (/^(La )/.test(nom)) return `à la ${nom.slice(3)}`;
  return `à ${nom}`;
}

/** La journée de ce dimanche dans la saison, si l'admin l'a déjà créée. */
function journeeDuDimanche(saison: Saison, d: Date): JourneeMeta | undefined {
  const cible = labelDateFr(d);
  const jm = jourMoisDuLibelle(cible);
  return saison.journees.find((m) => {
    const x = jourMoisDuLibelle(m.date);
    return !!x && !!jm && x.jour === jm.jour && x.mois === jm.mois;
  });
}

/**
 * La convocation à annoncer à cet instant, ou null : celle du prochain
 * dimanche, du lundi 9 h au samedi 22 h (Paris). Le numéro, l'heure et le
 * lieu viennent de la saison : la journée de ce dimanche si l'admin l'a
 * créée, sinon la suivante de la dernière, à son heure et sur son terrain.
 */
export function convocationAAnnoncer(
  saison: Saison,
  convocation: ConvocationOuverte | null,
  maintenant: Date
): AnnonceConvocation | null {
  if (!convocation) return null;
  const ici = instantParis(maintenant);
  if (ici.jourIso === 7 || ici.heure < 9 || ici.heure >= 22) return null;
  const dimanche = prochainDimanche(maintenant);
  if (convocation.date_label !== labelDateFr(dimanche)) return null;
  // Ouverte cette semaine : une convocation d'avant ne s'annonce plus.
  if (maintenant.getTime() - new Date(convocation.created_at).getTime() > 7 * 24 * 3600_000) return null;

  const derniere = [...saison.journees].sort((a, b) => b.j - a.j)[0];
  const propre = journeeDuDimanche(saison, dimanche);
  const meta = propre ?? derniere;
  const j = propre?.j ?? (derniere?.j ?? 0) + 1;
  const heure = meta?.heure ?? HEURE_LIGUE;
  const terrain = terrainDeJournee(saison, meta ?? {});
  return {
    cle: `convocation-s${numeroSaison(saison)}-c${convocation.id}`,
    j,
    titre: `J${j} · Dimanche ${leDimanche(dimanche)}`,
    texte: `${heure}${terrain ? ` ${aLieu(terrain.nom)}` : ""}. Tu viens ?`,
  };
}

export interface AnnonceResultats {
  cle: string;
  j: number;
}

/**
 * La journée dont les résultats sont à annoncer, ou null : la dernière jouée,
 * toutes ses lignes « Présent » d'une équipe avec leur résultat, la saison
 * immobile depuis CALME (`publieLe`, saison.updated_at), 90 minutes au moins
 * après son coup d'envoi, jusqu'au surlendemain, de 9 h à 22 h 30 (Paris).
 */
export function resultatsAAnnoncer(saison: Saison, publieLe: number, maintenant: Date): AnnonceResultats | null {
  if (maintenant.getTime() - publieLe < CALME) return null;
  const ici = aParis(maintenant);
  if (ici.minutes < 9 * 60 || ici.minutes >= 22 * 60 + 30) return null;
  const meta = [...saison.journees].sort((a, b) => b.j - a.j).find((m) => journeeJouee(saison, m.j));
  if (!meta) return null;
  const lignes = saison.entries.filter((e) => e.j === meta.j && e.statut === "Présent" && e.team && !e.extraTime);
  if (lignes.length === 0 || lignes.some((e) => !e.result)) return null;

  const jm = jourMoisDuLibelle(meta.date);
  if (!jm) return null;
  const jour = Date.UTC(ici.annee, jm.mois - 1, jm.jour);
  const aujourdhui = Date.UTC(ici.annee, ici.mois - 1, ici.jour);
  const ecart = Math.round((aujourdhui - jour) / (24 * 3600_000));
  if (ecart < 0 || ecart > 2) return null;
  if (ecart === 0 && ici.minutes < minutes(meta.heure ?? HEURE_LIGUE) + APRES_COUP_D_ENVOI) return null;
  return { cle: `resultats-s${numeroSaison(saison)}-j${meta.j}`, j: meta.j };
}

const pluriel = (n: number, un: string, des: string) => `${n} ${n > 1 ? des : un}`;

/** « Kader », « Kader et Léo », « Kader, Léo et Awa ». */
function etListe(noms: string[]): string {
  return noms.length <= 1 ? (noms[0] ?? "") : `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}`;
}

/** Le texte des résultats d'une journée pour un joueur (son nom de saison). */
export function texteResultats(saison: Saison, j: number, joueur: string): { titre: string; texte: string } {
  const s = appliquerMvpAuto(saison);
  // Jamais un joueur masqué (Sabri, un arbitre, une place X) dans un texte envoyé à la ligue.
  const mvps = [...new Set(s.entries.filter((e) => e.j === j && e.mvp && !isHidden(e.player)).map((e) => e.player))];
  const ligne = s.entries.find((e) => e.j === j && e.player === joueur && e.statut === "Présent" && !e.extraTime);
  const prenom = (nom: string) => nom.split(" ")[0];

  if (ligne?.mvp) {
    return {
      titre: `J${j} · Tu es le MVP`,
      texte: `${pluriel(ligne.buts, "but", "buts")}, ${pluriel(ligne.passes, "passe décisive", "passes décisives")}. Ta carte est dans les Actus.`,
    };
  }
  const journee = computeJournees(s).find((x) => x.j === j);
  const place = journee ? findPlayerMatch(journee, joueur) : null;
  if (ligne && place) {
    const pour = place.team.score;
    const contre = place.opponents.score;
    const issue = pour > contre ? "Victoire" : pour < contre ? "Défaite" : "Nul";
    // Le MVP de SON match : chaque match a le sien.
    const duMatch = new Set([...place.team.players, ...place.opponents.players].map((p) => p.name));
    const siens = mvps.filter((n) => duMatch.has(n));
    return {
      titre: `J${j} · ${issue} ${pour} – ${contre}`,
      texte: [`Avec les ${place.team.name}.`, siens.length ? `MVP du match : ${etListe(siens.map(prenom))}.` : ""]
        .filter(Boolean)
        .join(" "),
    };
  }
  const duJour = mvps.length ? `MVP du jour : ${etListe(mvps.map(prenom))}.` : "";
  return { titre: `J${j} · Les résultats sont là`, texte: [duJour, "Scores et classement dans les Actus."].filter(Boolean).join(" ") };
}
