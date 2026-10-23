// Fabrique d'identifiants et de mots de passe provisoires — SERVEUR UNIQUEMENT.
//
// L'identifiant se déduit du nom, comme dans tools/generate-accounts.ts : un
// joueur ajouté en cours de saison reçoit celui que le générateur lui
// donnerait.
//
// Le mot de passe, lui, ne se déduit plus de rien. Jusqu'au 22/10/2026 il
// sortait du nom (un mot parmi 24 et un nombre parmi 90), par le même
// algorithme que le générateur : quiconque lisait le dépôt pouvait le
// recalculer. Il est désormais tiré au hasard, montré une seule fois à
// l'admin, et ne sert qu'à entrer : la base oblige le joueur à en choisir un
// à lui dès sa connexion (table mot_de_passe_a_changer).

import { randomInt } from "node:crypto";
import { username } from "@/lib/sfl/usernames";

/** Lettres et chiffres sans sosie à l'écrit ni à l'oral (pas de i, l, o, 0, 1). */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Mot de passe provisoire : trois blocs de quatre, tirés au hasard (≈ 2⁵⁹). */
export function motDePasseProvisoire(): string {
  const bloc = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${bloc()}-${bloc()}-${bloc()}`;
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
