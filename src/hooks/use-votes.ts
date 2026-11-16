"use client";

// Les votes des figures de match de la saison en cours, à jour en temps réel.
// Rien sans session serveur : la table est protégée par RLS (membres validés).
// Tant qu'ils ne sont pas relus (useVotesPrets), mes voix données sur un autre
// téléphone, ou avant de fermer l'app, ne sont pas encore là : l'étiquette de
// la Map et l'encart de Ma carte n'en concluent rien (vote-du-jour.tsx).

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { chargerVotes, votesCharges, votesEnMemoire, VOTES_EVENT, type VoteFigure } from "@/lib/sfl/votes";
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

/**
 * Les votes de la saison sont-ils relus (chargerVotes) ? Le même magasin que
 * useVotes : vrai dès qu'ils arrivent. Vrai aussi sans session serveur : rien
 * ne viendra (le vote dit alors « Reconnecte-toi pour voter »). Le
 * SeasonProvider fait le même calcul (votesPrets) pour la révélation.
 */
export function useVotesPrets(): boolean {
  const session = useSession();
  const charges = useSyncExternalStore(abonner, votesCharges, () => false);
  return !session?.server || charges;
}
