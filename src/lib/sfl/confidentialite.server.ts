// L'accord à la politique de confidentialité, vu du serveur — SERVEUR
// UNIQUEMENT. Les routes qui envoient un visage ou des questions à un
// prestataire (/api/photo-studio vers fal.ai, /api/agent vers Anthropic) le
// vérifient avant de le faire : un téléphone resté sur une ancienne version
// de l'app, sans la case de l'ouverture, ne passe pas outre.
//
// La lecture se fait avec les droits du joueur (RLS : il lit ses lignes).
// Seule une base pas encore migrée (aperçus Vercel : la table n'existe pas,
// 42P01 ou PGRST205) laisse passer, la case de l'ouverture restant le premier
// garde. Toute autre erreur de lecture refuse (audit de sécurité du
// 03/11/2026, T15) : une panne ne fait rien partir chez un prestataire.

import type { SupabaseClient } from "@supabase/supabase-js";
import { VERSION_ACCEPTEE } from "./confidentialite";

/** Le message des routes quand l'accord manque. */
export const SANS_ACCORD = "Accepte d'abord la politique de confidentialité : ferme et rouvre l'app.";

/** true : accord à une version qui vaut encore (VERSION_ACCEPTEE ou plus récente), ou table absente ; false : aucun, ou lecture en échec. */
export async function accordEnregistre(sb: SupabaseClient, uid: string): Promise<boolean> {
  const { data, error } = await sb
    .from("consentements")
    .select("id")
    .eq("user_id", uid)
    .gte("version", VERSION_ACCEPTEE)
    .limit(1);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return true;
    console.error("[confidentialite]", error.code, error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
