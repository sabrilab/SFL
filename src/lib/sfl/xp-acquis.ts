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
  calculeLe: string;
}

/** Les paliers pris saison par saison au plus haut : le calcul de l'appareil et ce que le serveur a gardé. */
export function paliersAuPlusHaut(local: PaliersAtteints, garde: PaliersAtteints | undefined): PaliersAtteints {
  if (!garde) return local;
  const out: Record<string, number> = { ...local };
  for (const [s, p] of Object.entries(garde)) if (p > (out[s] ?? 0)) out[s] = p;
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

/** Le palier qui vient de s'ouvrir, s'il faut l'annoncer : plus haut que le dernier vu sur ce téléphone. */
export function palierAAnnoncer(palier: number, dernierVu: number | null): number | null {
  return palier > 0 && palier > (dernierVu ?? 0) ? palier : null;
}
