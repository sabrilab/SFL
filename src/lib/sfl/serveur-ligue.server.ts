// Ce que les routes de comptes partagent côté SERVEUR : le client Supabase à
// clé secrète, la liste des pseudos et des noms déjà pris, et les noms des
// joueurs Bola (que l'admin ne donne pas à un nouveau joueur de l'effectif).
//
// La clé secrète n'existe que dans les variables de Vercel (production) et ne
// part jamais au navigateur. Sans elle, les routes répondent « fermé ».

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { ACCOUNTS } from "@/lib/sfl/auth/accounts";
import { username } from "@/lib/sfl/usernames";
import { lireEffectifServeur } from "./saison-serveur.server";

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

/** Admin de la ligue ? Lu dans profiles, jamais dans le jeton ni ses métadonnées. */
export async function estAdmin(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data } = await sb.from("profiles").select("is_admin").eq("id", id).maybeSingle();
  return !!(data as { is_admin?: boolean } | null)?.is_admin;
}

/** Pseudos qu'aucun joueur ne peut prendre : la ligue et ses services. */
const RESERVES = ["admin", "sfl", "bola", "ligue", "support"];

/**
 * Identifiants et noms déjà pris : comptes, effectif, et comptes prévus.
 * `sauf` : le joueur qui demande (son propre pseudo ne compte pas comme pris).
 */
export async function dejaPris(sb: SupabaseClient, sauf?: string) {
  // nom_affiche : le nom que l'app montre (voir /api/identite). Avant la
  // migration de la base (aperçus), la colonne n'existe pas encore.
  let { data: profils, error } = await sb.from("profiles").select("id, name, username, nom_affiche");
  if (error) ({ data: profils, error } = await sb.from("profiles").select("id, name, username"));
  if (error) throw error;
  const roster = ((await lireEffectifServeur(sb)) ?? []).map((r) => r.name);
  const liste = ((profils ?? []) as { id: string; name: string; username: string; nom_affiche?: string | null }[]).filter(
    (p) => p.id !== sauf
  );
  const moi = ((profils ?? []) as { id: string; name: string }[]).find((p) => p.id === sauf);

  const pseudos = new Set<string>();
  for (const p of liste) pseudos.add(p.username.replace(/^@/, "").toLowerCase());
  // Les comptes prévus par l'admin, même pas encore créés côté serveur : leur
  // identifiant leur est réservé. Un joueur garde le droit de revenir au sien.
  for (const a of ACCOUNTS) if (a.name !== moi?.name) pseudos.add(a.user);
  for (const n of roster) if (n !== moi?.name) pseudos.add(username(n).slice(1));
  for (const r of RESERVES) pseudos.add(r);

  const noms = new Set<string>();
  for (const p of liste) {
    noms.add(p.name.toLowerCase());
    if (p.nom_affiche) noms.add(p.nom_affiche.toLowerCase());
  }
  for (const n of roster) noms.add(n.toLowerCase());
  for (const a of ACCOUNTS) noms.add(a.name.toLowerCase());
  return { pseudos, noms };
}

/**
 * Les noms (en minuscules : nom et nom affiché) des joueurs Bola : venus par
 * un parrain ou un lien d'équipe (parrainages), absents de l'effectif. Un
 * joueur que l'admin ajoute à l'effectif sous l'un de ces noms prendrait le
 * compte de ce joueur Bola, et toute sa SFL avec (28/10/2026).
 */
export async function nomsJoueursBola(sb: SupabaseClient): Promise<Map<string, string>> {
  const { data: filleuls, error } = await sb.from("parrainages").select("filleul");
  if (error) throw error;
  const ids = new Set(((filleuls ?? []) as { filleul: string }[]).map((f) => f.filleul));
  const noms = new Map<string, string>();
  if (ids.size === 0) return noms;
  type Profil = { id: string; name: string; nom_affiche?: string | null };
  // nom_affiche : absent avant la migration de la base (aperçus), comme dans dejaPris.
  let lu = await sb.from("profiles").select("id, name, nom_affiche");
  if (lu.error) lu = (await sb.from("profiles").select("id, name")) as typeof lu;
  if (lu.error) throw lu.error;
  const profils = (lu.data ?? []) as Profil[];
  const roster = new Set(((await lireEffectifServeur(sb)) ?? []).map((r) => r.name));
  for (const p of profils) {
    if (!ids.has(p.id) || roster.has(p.name)) continue;
    noms.set(p.name.toLowerCase(), p.id);
    if (p.nom_affiche) noms.set(p.nom_affiche.toLowerCase(), p.id);
  }
  return noms;
}
