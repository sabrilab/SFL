// Bola Club : le fil des actus du club (bola-app#14 : « Actus = actus du
// club : résultats du week-end par catégorie, convocations, cartes qui
// montent, annonces du staff »). Ce qu'un rôle y lit : l'admin et les
// entraîneurs, tout le club ; un joueur (ou son parent), le club et sa
// catégorie. Le rail filtre sur une catégorie ; une annonce à tout le club
// reste sous chaque catégorie.
//
// L'ordre : ce qui vient d'abord, le plus proche en tête (les convocations
// des séances à venir) ; puis ce qui est passé, le plus récent en tête : les
// annonces, le dernier résultat de chaque catégorie, et ses cartes qui
// montent (les joueurs dont la carte officielle a changé à ce match-là).
// Pur.

import { STAT_KEYS, type StatKey } from "@/lib/sfl/engine";
import { droits, seancePassee } from "./regles";
import { cartesDuClub, matchsJoues, mvpsDe } from "./saison";
import type { Annonce, Club, Moi, Seance } from "./types";

export type Publication =
  | { genre: "convocation"; id: string; jour: string; categorie: string; seance: Seance }
  | { genre: "resultat"; id: string; jour: string; categorie: string; seance: Seance; buteurs: { id: string; buts: number }[]; mvp: string[] }
  | { genre: "cartes"; id: string; jour: string; categorie: string; cartes: { id: string; gains: Partial<Record<StatKey, number>> }[] }
  | { genre: "annonce"; id: string; jour: string; categorie: string | null; annonce: Annonce };

/** Les buteurs d'un match, le meilleur d'abord. */
export function buteursDe(s: Seance): { id: string; buts: number }[] {
  return Object.entries(s.stats)
    .filter(([, l]) => l.buts > 0)
    .map(([id, l]) => ({ id, buts: l.buts }))
    .sort((a, b) => b.buts - a.buts || a.id.localeCompare(b.id));
}

/** Les cartes devenues officielles à ce match : les joueurs dont une mise à jour tombe dessus. */
export function cartesQuiMontent(club: Club, match: Seance): { id: string; gains: Partial<Record<StatKey, number>> }[] {
  const out: { id: string; gains: Partial<Record<StatKey, number>>; total: number }[] = [];
  for (const [id, carte] of cartesDuClub(club)) {
    const maj = carte.ev?.majs.find((m) => carte.matchs[m.apresJ - 1]?.id === match.id);
    if (maj) out.push({ id, gains: maj.gains, total: STAT_KEYS.reduce((s, k) => s + (maj.gains[k] ?? 0), 0) });
  }
  return out.sort((a, b) => b.total - a.total || a.id.localeCompare(b.id)).map(({ id, gains }) => ({ id, gains }));
}

/** Le fil, pour ce rôle ; `categorie` : le choix du rail, null pour « Tout ». */
export function filDuClub(club: Club, moi: Moi, categorie: string | null): Publication[] {
  const d = droits(club, moi);
  const visible = (c: string | null) => (c === null ? true : d.lit(c)) && (categorie === null || c === null || c === categorie);
  const avenir: Publication[] = [];
  const passe: Publication[] = [];

  for (const s of club.seances) {
    if (seancePassee(s, club.jour) || s.jour < club.jour || !visible(s.categorie)) continue;
    // Un joueur ne lit que les convocations qui le concernent (sa catégorie, ou celle où il est surclassé et convoqué).
    if (d.joueur && !s.convoques.includes(d.joueur.id) && d.joueur.categorie !== s.categorie) continue;
    avenir.push({ genre: "convocation", id: `c-${s.id}`, jour: s.jour, categorie: s.categorie, seance: s });
  }
  avenir.sort((a, b) => a.jour.localeCompare(b.jour) || a.id.localeCompare(b.id));

  for (const a of club.annonces) {
    if (visible(a.categorie)) passe.push({ genre: "annonce", id: a.id, jour: a.jour, categorie: a.categorie, annonce: a });
  }
  const joues = matchsJoues(club);
  for (const c of club.categories) {
    if (!visible(c.id)) continue;
    const dernier = joues.filter((s) => s.categorie === c.id).at(-1);
    if (!dernier) continue;
    passe.push({ genre: "resultat", id: `r-${dernier.id}`, jour: dernier.jour, categorie: c.id, seance: dernier, buteurs: buteursDe(dernier), mvp: mvpsDe(club, dernier) });
    const cartes = cartesQuiMontent(club, dernier);
    if (cartes.length) passe.push({ genre: "cartes", id: `m-${dernier.id}`, jour: dernier.jour, categorie: c.id, cartes });
  }
  const ORDRE = { annonce: 0, resultat: 1, cartes: 2, convocation: 3 } as const;
  passe.sort((a, b) => b.jour.localeCompare(a.jour) || ORDRE[a.genre] - ORDRE[b.genre] || a.id.localeCompare(b.id));
  return [...avenir, ...passe];
}

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2026-11-14 » → « Samedi 14 novembre » (la date seule, sans fuseau). */
export function jourLong(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return `${JOURS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${d === 1 ? "1er" : d} ${MOIS[m - 1]}`;
}

/** « 12 novembre ». */
export function jourMoyen(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MOIS[m - 1]}`;
}
