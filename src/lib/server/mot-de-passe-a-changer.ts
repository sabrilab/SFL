// Qui doit encore choisir son mot de passe, lu côté SERVEUR avec la clé
// secrète (qui passe outre la RLS) : une ligne dans mot_de_passe_a_changer
// (motif « origine » : d'origine, devenu public ; « provisoire » : donné par
// l'admin) suffit. La base refuse déjà tout à ces comptes (est_membre,
// is_league_admin, mot_de_passe_choisi ; audit de sécurité du 03/11/2026) ;
// une route qui agit avec la clé secrète doit le refuser elle-même.
//
// Deux appelants, une seule lecture :
//   · lib/server/push-envoi.ts (motDePasseAChanger) : personne n'est prévenu
//     tant qu'il doit changer son mot de passe ;
//   · lib/sfl/serveur-ligue.server.ts (estAdmin) : un tel compte n'est pas
//     admin pour les routes (04/11/2026).
//
// Fermé par défaut : une erreur de lecture rend null (l'appelant refuse).
// Seule une base sans la table (42P01 / PGRST205 : aperçu pas encore migré)
// rend l'ensemble vide, comme avant la table. Le journal ne garde que le code
// d'erreur, jamais un identifiant.
//
// SERVEUR UNIQUEMENT.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Codes d'une table absente (Postgres, puis PostgREST). */
export const TABLE_ABSENTE = new Set(["42P01", "PGRST205"]);

/**
 * Ceux des comptes `ids` qui doivent encore changer leur mot de passe ; null
 * si la table n'a pas pu être lue. `etiquette` préfixe la ligne du journal
 * (« [push] », « [admin] »).
 */
export async function lireMotDePasseAChanger(
  sb: SupabaseClient,
  ids: string[],
  etiquette: string
): Promise<Set<string> | null> {
  if (ids.length === 0) return new Set();
  const { data, error } = await sb.from("mot_de_passe_a_changer").select("user_id").in("user_id", ids);
  if (error) {
    if (TABLE_ABSENTE.has(error.code)) return new Set();
    console.error(`${etiquette} mot_de_passe_a_changer`, error.code);
    return null;
  }
  return new Set(((data ?? []) as { user_id: string }[]).map((x) => x.user_id));
}
