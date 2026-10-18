"use client";

// Les votes des figures de match de la saison en cours, à jour en temps réel.
// Rien sans session serveur : la table est protégée par RLS (membres validés).

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { chargerVotes, votesEnMemoire, VOTES_EVENT, type VoteFigure } from "@/lib/sfl/votes";
import { supabase } from "@/lib/supabase";

let seq = 0;
const AUCUN: VoteFigure[] = [];

function abonner(onChange: () => void) {
  window.addEventListener(VOTES_EVENT, onChange);
  return () => window.removeEventListener(VOTES_EVENT, onChange);
}

/** Charge et suit les votes de la saison `numero`. À monter une seule fois (SeasonProvider). */
export function useSuiviVotes(numero: number): void {
  const session = useSession();
  const actif = !!session?.server;
  useEffect(() => {
    if (!actif) return;
    const charger = () => chargerVotes(numero).catch(() => {
      /* base injoignable : on garde ce qu'on a */
    });
    void charger();
    const sb = supabase();
    let canal: ReturnType<typeof sb.channel> | null = null;
    try {
      canal = sb
        .channel(`sfl-votes-${++seq}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "votes_figures" }, charger)
        .subscribe();
    } catch {
      // Sans temps réel, les votes se rechargent à la prochaine ouverture.
    }
    return () => {
      if (canal) sb.removeChannel(canal);
    };
  }, [actif, numero]);
}

/** Les votes en mémoire (vide au rendu serveur). */
export function useVotes(): VoteFigure[] {
  return useSyncExternalStore(abonner, votesEnMemoire, () => AUCUN);
}
