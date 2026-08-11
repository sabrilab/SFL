// Accès administrateur, en dur : les profils Ilyes et Sabri.
// À terme (Supabase / rôles), remplacer par un vrai contrôle de rôle côté base.

export const ADMIN_PLAYERS = ["Ilyes", "Sabri"] as const;

export function isAdmin(name: string | null | undefined): boolean {
  return !!name && (ADMIN_PLAYERS as readonly string[]).includes(name);
}
