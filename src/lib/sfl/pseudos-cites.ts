// Les @pseudo d'un message — partagé par l'app (le Vestiaire) et le serveur
// (qui prévient les cités). Module pur : ni navigateur, ni base.

/** Les pseudos cités dans un texte (@kader), en minuscules, sans doublon. */
export function pseudosCites(texte: string): string[] {
  return [...new Set([...texte.matchAll(/@([a-z0-9_.-]{2,30})/gi)].map((m) => m[1].toLowerCase()))];
}
