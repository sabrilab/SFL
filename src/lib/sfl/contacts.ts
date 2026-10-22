// Les emails de contact des joueurs, rangés à part dans la table contacts
// (supabase/schema.sql) : le joueur lit le sien, l'admin les lit tous, les
// autres membres aucun. Ils vivaient dans profiles.contact_email, que toute
// la ligue lit (noms, pseudos) : n'importe quel membre pouvait les demander
// à l'API (fuite fermée le 22/10/2026, avec la politique de confidentialité).
//
// L'écriture ne change pas : routes serveur, création de compte et app
// écrivent toujours profiles.contact_email, et un trigger de la base range
// aussitôt l'email dans contacts en laissant la colonne vide. La lecture,
// elle, passe par ici.
//
// Module partagé : le client (sa session, RLS) et les routes serveur (clé
// secrète) s'en servent. Base pas encore migrée (aperçus Vercel) : on relit
// l'ancienne colonne.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Table pas encore créée (migration à venir) : PostgreSQL ou l'API REST. */
function sansTable(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

/** Les emails que l'appelant peut lire, par id de joueur (tous pour l'admin ou la clé secrète). */
export async function emailsDeContact(sb: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await sb.from("contacts").select("user_id, email");
  if (!error) return new Map((data ?? []).map((l) => [l.user_id as string, l.email as string]));
  if (!sansTable(error.code)) throw new Error(error.message);
  const { data: anciens, error: e2 } = await sb.from("profiles").select("id, contact_email").not("contact_email", "is", null);
  if (e2) throw new Error(e2.message);
  return new Map((anciens ?? []).map((p) => [p.id as string, p.contact_email as string]));
}

/** L'email d'un joueur, ou null (absent, ou illisible pour l'appelant). */
export async function emailDe(sb: SupabaseClient, id: string): Promise<string | null> {
  const { data, error } = await sb.from("contacts").select("email").eq("user_id", id).maybeSingle();
  if (!error) return (data?.email as string | undefined) ?? null;
  if (!sansTable(error.code)) throw new Error(error.message);
  const { data: ancien } = await sb.from("profiles").select("contact_email").eq("id", id).maybeSingle();
  return (ancien?.contact_email as string | null | undefined) ?? null;
}

/** Les ids des comptes qui portent cet email (routes serveur, clé secrète). */
export async function idsParEmail(sb: SupabaseClient, email: string): Promise<string[]> {
  const cherche = email.trim().toLowerCase();
  const { data, error } = await sb.from("contacts").select("user_id").eq("email", cherche);
  if (!error) return (data ?? []).map((l) => l.user_id as string);
  if (!sansTable(error.code)) throw new Error(error.message);
  const { data: anciens } = await sb.from("profiles").select("id").eq("contact_email", cherche);
  return (anciens ?? []).map((p) => p.id as string);
}
