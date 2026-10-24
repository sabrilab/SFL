// Le parrainage côté SERVEUR : rattacher un compte qui vient de naître à
// celui qui l'a fait venir (lib/sfl/parrainage.ts pour le reste).
//
// Appelé par /api/inscription et /api/inscription/sociale, avec le client à
// clé secrète, juste après la création du compte : une ligne dans
// parrainages, et Bola Team offert (team_offerts) si le parrain joue en SFL
// ce jour-là. Un échec ici ne défait jamais le compte.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ParrainServeur {
  id: string;
  code: string | null;
  sfl: boolean;
}

/** Le parrain d'un code : actif, compte accepté. null sinon. */
export async function parrainDuCode(sb: SupabaseClient, brut: unknown): Promise<ParrainServeur | null> {
  const code = String(brut ?? "").trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9][a-z0-9._]{2,19}$/.test(code)) return null;
  const { data } = await sb
    .from("parrainage_codes")
    .select("joueur, profiles!inner(valide)")
    .eq("code", code)
    .eq("actif", true)
    .eq("profiles.valide", true)
    .maybeSingle();
  const id = (data as { joueur?: string } | null)?.joueur;
  if (!id) return null;
  return { id, code, sfl: await joueurSfl(sb, id) };
}

/** Joueur SFL : son nom est dans l'effectif de la saison (joueur_sfl en base). */
export async function joueurSfl(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data } = await sb.rpc("joueur_sfl", { j: id });
  return data === true;
}

export async function noterFilleul(
  sb: SupabaseClient,
  filleul: string,
  parrain: ParrainServeur,
  canal: "lien" | "code" | "equipe",
  equipeId: number | null = null
): Promise<void> {
  try {
    await sb.from("parrainages").upsert(
      { filleul, parrain: parrain.id, code: parrain.code, canal, equipe_id: equipeId, parrain_sfl: parrain.sfl },
      { onConflict: "filleul", ignoreDuplicates: true }
    );
    if (parrain.sfl) {
      await sb
        .from("team_offerts")
        .upsert({ joueur: filleul, par: parrain.id, via: canal }, { onConflict: "joueur", ignoreDuplicates: true });
    }
  } catch {
    // Le compte existe : le parrainage manquera aux statistiques, rien de plus.
  }
}

/**
 * Les comptes de la SFL : les joueurs de l'effectif de la saison (la règle
 * de joueur_sfl en base) et les admins. À eux seuls les annonces de la ligue
 * et le Vestiaire ; un joueur Bola, venu par un parrain, n'en est pas.
 * null : la saison n'a pas pu être lue, l'appelant ne filtre pas.
 */
export async function idsSfl(sb: SupabaseClient): Promise<Set<string> | null> {
  const [{ data: doc, error: e1 }, { data: profils, error: e2 }] = await Promise.all([
    sb.from("saison").select("data").eq("id", 1).maybeSingle(),
    sb.from("profiles").select("id, name, is_admin"),
  ]);
  const roster = (doc as { data?: { roster?: { name: string }[] } } | null)?.data?.roster;
  if (e1 || e2 || !roster) return null;
  const noms = new Set(roster.map((r) => r.name));
  return new Set(
    ((profils ?? []) as { id: string; name: string; is_admin: boolean | null }[])
      .filter((p) => p.is_admin || noms.has(p.name))
      .map((p) => p.id)
  );
}
