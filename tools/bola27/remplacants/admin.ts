// Bola 27 (bola-app#33), le jeu seul : remplace « @/lib/sfl/admin ». Personne n'est administrateur sur l'adresse
// publique : le lien vers le studio du jeu (/jouer/studio, réservé aux admins dans l'app) n'apparaît jamais.
export const ADMIN_PLAYERS = [] as const;

export function isAdmin(): boolean {
  return false;
}
