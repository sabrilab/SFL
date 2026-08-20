// Fabrique d'identifiants — SERVEUR UNIQUEMENT.
//
// Reprend mot pour mot l'algorithme de tools/generate-accounts.ts : un joueur
// ajouté en cours de saison reçoit exactement le mot de passe que le
// générateur lui donnerait si on le relançait. Les deux ne peuvent donc pas
// diverger, et régénérer la table n'invalide jamais un accès déjà distribué.
//
// Ce module ne part JAMAIS dans le bundle du navigateur : le mot de passe se
// déduit du nom, et le publier côté client reviendrait à publier les mots de
// passe de toute la ligue.

import { createHash } from "node:crypto";
import { username } from "@/lib/sfl/usernames";

/** Mots simples, sans accent ni ambiguïté à l'oral. */
const MOTS = [
  "ballon", "corner", "lucarne", "pivot", "tacle", "volee", "passe", "sprint",
  "cage", "arret", "duel", "reprise", "louche", "praline", "roulette", "sombrero",
  "pointu", "gardien", "buteur", "capitaine", "terrain", "sifflet", "maillot", "crampon",
];

/** Générateur déterministe : même nom = même mot de passe à chaque exécution. */
function seededInt(seed: string, max: number): number {
  const h = createHash("sha256").update(seed).digest();
  return ((h[0] << 16) | (h[1] << 8) | h[2]) % max;
}

export function motDePassePour(name: string): string {
  const mot = MOTS[seededInt(`${name}|mot`, MOTS.length)];
  const num = 10 + seededInt(`${name}|num`, 90);
  return `${mot}${num}`;
}

/**
 * Identifiant libre pour ce nom. `pris` contient les identifiants déjà
 * attribués : deux joueurs ne peuvent pas partager le leur, exactement comme
 * dans le générateur (suffixe numérique en cas de collision).
 */
export function identifiantPour(name: string, pris: Set<string>): string {
  const base = username(name).slice(1);
  let user = base;
  let n = 2;
  while (pris.has(user)) user = `${base}${n++}`;
  return user;
}
