// Ce que l'app montre quand son propre calcul est incomplet, et les paliers
// gardés par le serveur (passe_acquis). Ilyes, 01/11/2026 : des paliers
// déverrouillés au téléphone, verrouillés à l'ordinateur. Le palier affiché
// est le plus haut entre le calcul de l'appareil et celui que le serveur a
// gardé : un palier atteint reste à soi d'un appareil à l'autre, et sur les
// cartes des autres. Un calcul incomplet (session non vérifiée, réponses aux
// missions pas encore chargées, saison « à publier ») ne s'affiche jamais
// seul : il est pris au plus haut avec le dernier bilan du serveur.
//
// Pur : ni React ni réseau.

import { debutNiveau, niveauDe, type BilanXp } from "./missions";
import type { PaliersAtteints } from "./passe";

/** Le bilan d'un joueur tel que le serveur le rend (/api/xp/bilan ; xp-serveur.server.ts, BilanServeur). */
export interface BilanGarde {
  nom: string;
  total: number;
  saisons: Record<string, { xp: number; palier: number }>;
  /** Les XP S gagnées (xp-s.ts) ; absent d'un bilan gardé avant elles. */
  xpS?: number;
  calculeLe: string;
}

/**
 * Deux noms du même joueur, sans tenir compte de la casse : la base écrit le
 * nom du compte (profiles.name, mon_nom), la saison le nom de l'effectif, et
 * « azzedine » est Azzedine (player-provider.tsx). Le bilan du serveur, les
 * paliers gardés et les achats se retrouvent ainsi d'un nom à l'autre.
 */
export const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** La valeur rangée sous ce nom, ou sous le même nom écrit autrement (memeNom). */
export function parNom<T>(rangees: Readonly<Record<string, T>>, nom: string | null | undefined): T | undefined {
  if (!nom) return undefined;
  if (nom in rangees) return rangees[nom];
  const cle = Object.keys(rangees).find((k) => memeNom(k, nom));
  return cle === undefined ? undefined : rangees[cle];
}

/** Les paliers pris saison par saison au plus haut : le calcul de l'appareil et ce que le serveur a gardé. */
export function paliersAuPlusHaut(local: PaliersAtteints, garde: PaliersAtteints | undefined): PaliersAtteints {
  if (!garde) return local;
  const out: Record<string, number> = { ...local };
  for (const [s, p] of Object.entries(garde)) if (p > (out[s] ?? 0)) out[s] = p;
  return out;
}

/** Les skins de nation obtenus par un joueur (achats_xp) : [nation, numéro de série][]. */
export type NationsObtenues = readonly (readonly [string, number])[];

/**
 * Ce que l'XP pose sur les cartes de la ligue, avec ce que la base garde : les
 * paliers au plus haut (passe_acquis) et les skins de nation achetés
 * (achats_xp). Un joueur que cet appareil ne calcule pas (un joueur Bola, hors
 * de l'effectif : ses matchs ne sont lus que sur son téléphone) y entre aussi,
 * avec `vide()` : sans cela, le skin qu'il a payé et les paliers que le
 * serveur lui garde ne se voyaient que chez lui (relecture du 02/11/2026).
 */
export function cartesAvecServeur<T extends { paliers: PaliersAtteints; afrique?: NationsObtenues }>(
  parJoueur: ReadonlyMap<string, T>,
  gardes: Readonly<Record<string, PaliersAtteints>>,
  nations: Readonly<Record<string, NationsObtenues>>,
  vide: () => T
): Map<string, T> {
  const out = new Map(parJoueur);
  const noms = [...out.keys()];
  for (const brut of new Set([...Object.keys(gardes), ...Object.keys(nations)])) {
    // La base range sous le nom du compte ; la carte vit sous le nom de l'effectif (memeNom).
    const nom = out.has(brut) ? brut : (noms.find((n) => memeNom(n, brut)) ?? brut);
    const x = out.get(nom) ?? vide();
    out.set(nom, { ...x, paliers: paliersAuPlusHaut(x.paliers, gardes[brut]), afrique: nations[brut] ?? x.afrique });
  }
  return out;
}

/**
 * Le bilan affiché. `complet` : l'appareil a tout ce qu'il faut (session
 * vérifiée, réponses chargées, saison publiée) ; sinon le total et le palier
 * sont pris au plus haut avec le dernier bilan du serveur. Le palier, lui, est
 * toujours au moins celui que le serveur a gardé.
 */
export function bilanAffiche(b: BilanXp, opts: { complet: boolean; serveur?: BilanGarde | null; garde?: PaliersAtteints }): BilanXp {
  const sp = b.saisonPasse.id;
  const serveur = opts.serveur && opts.serveur.nom ? opts.serveur : null;
  let palier = Math.max(b.palier, opts.garde?.[sp] ?? 0);
  let total = b.total;
  let saison = b.saison;
  if (!opts.complet && serveur) {
    palier = Math.max(palier, serveur.saisons[sp]?.palier ?? 0);
    total = Math.max(total, serveur.total);
    saison = Math.max(saison, serveur.saisons[sp]?.xp ?? 0);
  }
  if (palier === b.palier && total === b.total && saison === b.saison) return b;
  const niveau = niveauDe(total);
  return { ...b, total, saison, niveau, dansLeNiveau: total - debutNiveau(niveau), pourLeSuivant: 100 * niveau, palier };
}

/**
 * Les XP S gagnées que l'écran montre. `complet` : l'appareil a tout ce qu'il
 * faut (bilanAffiche) ; sinon, prises au plus haut avec le dernier bilan du
 * serveur, qui fait foi : un calcul incomplet ne montre jamais moins.
 */
export function xpSAffiche(local: number, opts: { complet: boolean; serveur?: BilanGarde | null }): number {
  const serveur = opts.serveur && opts.serveur.nom ? opts.serveur : null;
  if (opts.complet || !serveur || typeof serveur.xpS !== "number") return local;
  return Math.max(local, serveur.xpS);
}

/** Le palier qui vient de s'ouvrir, s'il faut l'annoncer : plus haut que le dernier vu sur ce téléphone. */
export function palierAAnnoncer(palier: number, dernierVu: number | null): number | null {
  return palier > 0 && palier > (dernierVu ?? 0) ? palier : null;
}
