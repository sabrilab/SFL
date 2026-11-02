"use client";

// L'admin de la ligue, à qui un joueur Bola écrit pour rejoindre la SFL
// (Map, dimanche en vitrine, 02/11/2026 : l'entrée en SFL se fait quand
// l'admin pose son nom dans l'effectif). Le premier admin trouvé ; lu une
// fois par ouverture de l'app.

import { supabase } from "@/lib/supabase";

let lu: Promise<string | null> | null = null;

export function idAdminLigue(): Promise<string | null> {
  lu ??= (async () => {
    try {
      const { data } = await supabase().from("profiles").select("id").eq("is_admin", true).limit(1);
      return (data?.[0] as { id: string } | undefined)?.id ?? null;
    } catch {
      return null;
    }
  })();
  return lu;
}
