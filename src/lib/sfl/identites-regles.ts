// Identité d'un joueur — les règles pures, partagées par le serveur et l'app.

/**
 * Un prénom et un nom devinés d'un nom de saison, pour préremplir : le
 * premier mot est le prénom, le reste le nom (souvent une initiale, ou rien).
 */
export function separerNom(nom: string): { prenom: string; nom: string } {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return { prenom: mots[0] ?? "", nom: mots.slice(1).join(" ") };
}
