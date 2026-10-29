"use client";

// L'admin corrige une réponse à la convocation (30/10/2026) : la vraie,
// celle que voient les joueurs (public.presence), et non plus la copie du
// document de saison qu'affichait l'ancien tableau de bord. La règle
// « presence: correction admin » (supabase/schema.sql) l'autorise à lui seul.

import { supabase } from "@/lib/supabase";
import type { Reponse } from "./presence";

export async function corrigerPresence(convocationId: number, nom: string, reponse: Reponse | null): Promise<string | null> {
  try {
    const sb = supabase();
    const { data: profil, error: e1 } = await sb.from("profiles").select("id").eq("name", nom).maybeSingle();
    if (e1) return e1.message;
    const id = (profil as { id?: string } | null)?.id;
    if (!id) return `${nom} n'a pas de compte.`;
    const { error } = reponse
      ? await sb.from("presence").upsert({ convocation_id: convocationId, player_id: id, reponse }, { onConflict: "convocation_id,player_id" })
      : await sb.from("presence").delete().eq("convocation_id", convocationId).eq("player_id", id);
    return error ? error.message : null;
  } catch (e) {
    return e instanceof Error ? e.message : "Base injoignable.";
  }
}
