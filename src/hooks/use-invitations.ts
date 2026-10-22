"use client";

// La pastille de l'onglet Map : mes invitations à un match encore sans
// réponse (Sabri, 22/10). Recomptée à l'ouverture, au retour dans l'app et
// à chaque changement de mes lignes de match (temps réel).

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { aujourdhuiIso, monId } from "@/lib/sfl/matchs";
import { supabase } from "@/lib/supabase";

let seq = 0;

export function useInvitationsMatch(): number {
  const session = useSession();
  const [n, setN] = useState(0);
  const actif = !!session?.server && !session.enAttente;

  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    const sb = supabase();
    let canal: ReturnType<typeof sb.channel> | null = null;
    const compter = async () => {
      const moi = await monId();
      if (!moi || !vivant) return;
      const { count } = await sb
        .from("match_joueurs")
        .select("match_id, matchs!inner(jour)", { count: "exact", head: true })
        .eq("player_id", moi)
        .eq("statut", "invite")
        .gte("matchs.jour", aujourdhuiIso());
      if (vivant) setN(count ?? 0);
      if (!canal && vivant) {
        try {
          canal = sb
            .channel(`sfl-invitations-${++seq}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "match_joueurs", filter: `player_id=eq.${moi}` }, () => void compter())
            .subscribe();
        } catch {
          /* sans temps réel, on recompte au retour dans l'app */
        }
      }
    };
    const auRetour = () => document.visibilityState === "visible" && void compter();
    void compter();
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      vivant = false;
      document.removeEventListener("visibilitychange", auRetour);
      if (canal) sb.removeChannel(canal);
    };
  }, [actif]);

  return actif ? n : 0;
}
