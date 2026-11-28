// Le rappel d'une heure avant le match (Bola, 28/11/2026 : « il faudrait que
// les joueurs reçoivent une notification 1 heure avant leur match »).
//
// Le dimanche, chaque joueur de la feuille (placé dans une équipe) reçoit,
// une heure avant le rendez-vous de SON match :
//   « Match dans 1 h · Rendez-vous 11h00 »
//   « Noirs 1 contre Blancs 1 · Tu joues en noir · Coup d'envoi 11h15 ·
//     Terrain 1 · Hippodrome de Marcq, 137 Boulevard Clémenceau 59700 Marcq-en-Barœul »
// Le rendez-vous, c'est toujours 15 minutes avant le coup d'envoi (Bola, même
// jour : « Donne toujours rendez-vous 15 minutes avant la vraie heure du
// match »). Le coup d'envoi, le lieu et le terrain sont ceux que l'app lui
// montre déjà (matchs-du-jour.ts) : ceux du match, sinon ceux de la journée.
// La couleur vient du nom de son équipe (« Noirs 1 » → en noir).
//
// Ce module dit seulement QUI prévenir, et quand : la route
// /api/journees/rappel (appelée toutes les 5 minutes le dimanche) envoie,
// et la table journee_rappels garantit qu'un joueur n'est prévenu qu'une fois
// par match.
//
// La fenêtre : de 60 minutes avant le rendez-vous jusqu'au rendez-vous. Un
// appel qui arrive en retard prévient encore ; après, plus rien. Un joueur ajouté à la feuille
// dans la fenêtre est prévenu au passage suivant.
//
// Pur : aucune lecture de base ni d'écran.

import { anneeProche, dateDeParis } from "./convocation-temps";
import { isHidden } from "./hidden";
import { heuresDeJournee, type SaisonLue } from "./missions";
import { matchsDeJournee } from "./matchs-du-jour";
import { terrainDeJournee } from "./saisie/mutations";
import type { Saison } from "./saisie/types";

/** Le rendez-vous, avant le coup d'envoi ; le rappel, avant le rendez-vous. */
export const RENDEZ_VOUS = 15 * 60_000;
export const AVANT = 60 * 60_000;

export interface RappelMatch {
  /** Numéro de saison, journée, place du match dans la journée (0 = Match 1). */
  saison: number;
  j: number;
  n: number;
  coupEnvoi: Date;
  rendezVous: Date;
  titre: string;
  /** Les joueurs à prévenir (noms de la saison), chacun avec son texte (sa couleur). */
  joueurs: { nom: string; texte: string }[];
}

const MOIS = ["jan", "fev", "mar", "avr", "mai", "juin", "juil", "aou", "sep", "oct", "nov", "dec"];

/** « 29 nov. » → { jour: 29, mois: 11 }. */
function jourMois(libelle: string): { jour: number; mois: number } | null {
  const m = libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .match(/(\d{1,2})\s*([a-z]{3,})/);
  if (!m) return null;
  const mois = MOIS.findIndex((p) => m[2].startsWith(p));
  return mois < 0 ? null : { jour: Number(m[1]), mois: mois + 1 };
}

/** « 13h », « 13h30 », « 13:30 » → [13, 30] ; null si illisible. */
function lireHeure(h: string): [number, number] | null {
  const m = h.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
  return m ? [Number(m[1]), Number(m[2] ?? 0)] : null;
}

/** L'heure de Paris d'un instant, comme l'app l'écrit : « 11h00 ». */
export function heureDeParis(d: Date): string {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(d)
    .split(":");
  return `${Number(h)}h${m}`;
}

/** « Noirs 1 » → « noir », « Blancs 2 » → « blanc » ; une autre équipe, son nom. */
export function couleurDe(equipe: string): string {
  const mot = equipe.trim().split(/\s+/)[0] ?? equipe;
  const c = mot.toLowerCase().replace(/s$/, "");
  return c === "noir" || c === "blanc" ? c : equipe;
}

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Les matchs de la saison publiée dont le rappel est dû maintenant, avec
 * leurs joueurs. `saison` est la saison publiée, sans brouillons ni figer
 * (SaisonServeur.direct) : la feuille telle que l'admin vient de la poser.
 */
export function rappelsDus(saison: Saison, numero: number, maintenant: Date): RappelMatch[] {
  const t = maintenant.getTime();
  const out: RappelMatch[] = [];
  for (const meta of saison.journees) {
    const jm = jourMois(meta.date);
    if (!jm) continue;
    const annee = anneeProche(jm.jour, jm.mois, maintenant);
    // Pas le bon jour : rien à calculer (le moteur est cher).
    const midi = dateDeParis(annee, jm.mois, jm.jour, 12).getTime();
    if (Math.abs(midi - t) > 24 * 3600_000) continue;

    const h = heuresDeJournee(saison as SaisonLue, meta.j, maintenant);
    if (!h || h.suspens) continue;
    const lieuJournee = terrainDeJournee(saison, meta);
    const matchs = matchsDeJournee(h.journee, saison.terrains ?? [], { heure: h.heure, lieu: lieuJournee });
    for (const m of matchs) {
      const hm = lireHeure(m.heure);
      if (!hm) continue;
      const coupEnvoi = dateDeParis(annee, jm.mois, jm.jour, hm[0], hm[1]);
      const rendezVous = new Date(coupEnvoi.getTime() - RENDEZ_VOUS);
      const reste = rendezVous.getTime() - t;
      if (reste > AVANT || reste < 0) continue;
      const match = h.journee.matches?.[m.n];
      if (!match) continue;
      const lieu = m.lieu ? [m.lieu.nom, m.lieu.adresse].filter(Boolean).join(", ") : null;
      const joueurs: { nom: string; texte: string }[] = [];
      for (const [equipe, noms] of [
        [match.teamA.name, m.noirs],
        [match.teamB.name, m.blancs],
      ] as const) {
        for (const nom of noms) {
          if (isHidden(nom) || joueurs.some((x) => x.nom === nom)) continue;
          const texte = [
            `${match.teamA.name} contre ${match.teamB.name}`,
            `Tu joues en ${couleurDe(equipe)}`,
            `Coup d'envoi ${heureDeParis(coupEnvoi)}`,
            m.terrain,
            lieu,
          ]
            .filter(Boolean)
            .join(" · ");
          joueurs.push({ nom, texte: couper(texte, 180) });
        }
      }
      if (!joueurs.length) continue;
      out.push({
        saison: numero,
        j: meta.j,
        n: m.n,
        coupEnvoi,
        rendezVous,
        titre: `Match dans 1 h · Rendez-vous ${heureDeParis(rendezVous)}`,
        joueurs,
      });
    }
  }
  return out;
}
