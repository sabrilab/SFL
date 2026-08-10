"use client";

// Journal d'activité — alimente le tableau de bord admin (qui se connecte,
// quand, rétention). Écrit en base UNIQUEMENT quand la session vient du
// serveur ; silencieux sinon (rien ne casse hors ligne, rien n'est bloquant).

import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/sfl/auth/session";

export type ActivityKind = "login" | "open" | "presence";

/** Trace un événement, sans jamais bloquer ni faire échouer l'appelant. */
export function logActivity(kind: ActivityKind) {
  try {
    const session = getSession();
    if (!session?.server) return;
    // « open » : une seule fois par jour et par appareil.
    if (kind === "open") {
      const key = `sfl-activity-open-${new Date().toISOString().slice(0, 10)}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    }
    const sb = supabase();
    sb.auth
      .getUser()
      .then(({ data }) => {
        const uid = data.user?.id;
        if (!uid) return;
        return sb.from("activity").insert({ player_id: uid, kind });
      })
      .catch(() => {});
  } catch {
    // jamais bloquant
  }
}
