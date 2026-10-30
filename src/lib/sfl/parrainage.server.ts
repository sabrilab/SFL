// Le parrainage côté SERVEUR : rattacher un compte qui vient de naître à
// celui qui l'a fait venir (lib/sfl/parrainage.ts pour le reste).
//
// Appelé par /api/inscription et /api/inscription/sociale, avec le client à
// clé secrète, juste après la création du compte : une ligne dans
// parrainages, et Bola Team offert (team_offerts) si le parrain joue en SFL
// ce jour-là. La ligne de parrainages fait du filleul un joueur Bola
// (hors_sfl en base) : sans elle, un compte validé d'office voyait toute la
// SFL. Son échec est donc rendu, et la route défait le compte (28/10/2026) ;
// celui de team_offerts ne défait rien.

import type { SupabaseClient } from "@supabase/supabase-js";
import { lireEffectifServeur } from "./saison-serveur.server";

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

/**
 * Note le parrainage. `parrain` null : le lien d'une équipe dont le créateur
 * n'existe plus (cree_par effacé) ; la ligne est écrite quand même, sans
 * parrain. Rend l'erreur de la ligne de parrainages, null si elle est posée.
 */
export async function noterFilleul(
  sb: SupabaseClient,
  filleul: string,
  parrain: ParrainServeur | null,
  canal: "lien" | "code" | "equipe",
  equipeId: number | null = null
): Promise<{ error: string | null }> {
  try {
    const { error } = await sb.from("parrainages").upsert(
      {
        filleul,
        parrain: parrain?.id ?? null,
        code: parrain?.code ?? null,
        canal,
        equipe_id: equipeId,
        parrain_sfl: parrain?.sfl ?? false,
      },
      { onConflict: "filleul", ignoreDuplicates: true }
    );
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "parrainage non noté" };
  }
  if (parrain?.sfl) {
    // Bola Team offert : un échec ne coûte que le cadeau.
    await sb
      .from("team_offerts")
      .upsert({ joueur: filleul, par: parrain.id, via: canal }, { onConflict: "joueur", ignoreDuplicates: true })
      .then(() => {}, () => {});
  }
  return { error: null };
}

/**
 * Les comptes de la SFL : les joueurs de l'effectif de la saison (la règle
 * de joueur_sfl en base) et les admins. À eux seuls les annonces de la ligue
 * et le Vestiaire ; un joueur Bola, venu par un parrain, n'en est pas.
 * null : la saison n'a pas pu être lue, l'appelant ne filtre pas.
 */
export async function idsSfl(sb: SupabaseClient): Promise<Set<string> | null> {
  const [roster, { data: profils, error: e2 }] = await Promise.all([
    lireEffectifServeur(sb),
    sb.from("profiles").select("id, name, is_admin"),
  ]);
  if (e2 || !roster) return null;
  const noms = new Set(roster.map((r) => r.name));
  return new Set(
    ((profils ?? []) as { id: string; name: string; is_admin: boolean | null }[])
      .filter((p) => p.is_admin || noms.has(p.name))
      .map((p) => p.id)
  );
}
