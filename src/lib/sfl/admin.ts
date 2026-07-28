// Accès administrateur. Pour l'instant un seul admin, en dur : le profil Ilyes.
// À terme (Supabase / rôles), remplacer par un vrai contrôle de rôle côté base.

export const ADMIN_PLAYERS = ["Ilyes"] as const;

export function isAdmin(name: string | null | undefined): boolean {
  return !!name && (ADMIN_PLAYERS as readonly string[]).includes(name);
}
