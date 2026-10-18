// Ce que les routes de comptes partagent côté SERVEUR : le client Supabase à
// clé secrète, et la liste des pseudos et des noms déjà pris.
//
// La clé secrète n'existe que dans les variables de Vercel (production) et ne
// part jamais au navigateur. Sans elle, les routes répondent « fermé ».

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { ACCOUNTS } from "@/lib/sfl/auth/accounts";
import { username } from "@/lib/sfl/usernames";

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://tpfusliksgxcvfrodchk.supabase.co";
const SECRET = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export function serveur(): SupabaseClient | null {
  if (!SECRET) return null;
  return createClient(SUPABASE_URL, SECRET, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** L'utilisateur qui appelle, d'après son jeton (« Authorization: Bearer … »). */
export async function appelant(sb: SupabaseClient, req: Request): Promise<User | null> {
  const jeton = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!jeton) return null;
  const { data, error } = await sb.auth.getUser(jeton);
  return error ? null : data.user;
}

/** Pseudos qu'aucun joueur ne peut prendre : la ligue et ses services. */
const RESERVES = ["admin", "sfl", "bola", "ligue", "support"];

/**
 * Identifiants et noms déjà pris : comptes, effectif, et comptes prévus.
 * `sauf` : le joueur qui demande (son propre pseudo ne compte pas comme pris).
 */
export async function dejaPris(sb: SupabaseClient, sauf?: string) {
  const { data: profils, error } = await sb.from("profiles").select("id, name, username");
  if (error) throw error;
  const { data: doc } = await sb.from("saison").select("data").eq("id", 1).maybeSingle();
  const roster = ((doc as { data?: { roster?: { name: string }[] } } | null)?.data?.roster ?? []).map(
    (r) => r.name
  );
  const liste = ((profils ?? []) as { id: string; name: string; username: string }[]).filter((p) => p.id !== sauf);
  const moi = ((profils ?? []) as { id: string; name: string }[]).find((p) => p.id === sauf);

  const pseudos = new Set<string>();
  for (const p of liste) pseudos.add(p.username.replace(/^@/, "").toLowerCase());
  // Les comptes prévus par l'admin, même pas encore créés côté serveur : leur
  // identifiant leur est réservé. Un joueur garde le droit de revenir au sien.
  for (const a of ACCOUNTS) if (a.name !== moi?.name) pseudos.add(a.user);
  for (const n of roster) if (n !== moi?.name) pseudos.add(username(n).slice(1));
  for (const r of RESERVES) pseudos.add(r);

  const noms = new Set<string>();
  for (const p of liste) noms.add(p.name.toLowerCase());
  for (const n of roster) noms.add(n.toLowerCase());
  for (const a of ACCOUNTS) noms.add(a.name.toLowerCase());
  return { pseudos, noms };
}
