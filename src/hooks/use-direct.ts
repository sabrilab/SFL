"use client";

// Les feuilles de match en direct de la saison en cours, à jour en temps réel.
// Rien sans session serveur : la table est protégée par RLS (membres validés).

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { chargerFeuilles, DIRECT_EVENT, feuillesEnMemoire, type FeuilleDirect } from "@/lib/sfl/direct";
import { supabase } from "@/lib/supabase";

let seq = 0;
const AUCUNE: FeuilleDirect[] = [];

function abonner(onChange: () => void) {
  window.addEventListener(DIRECT_EVENT, onChange);
  return () => window.removeEventListener(DIRECT_EVENT, onChange);
}

/** Charge et suit les feuilles de la saison `numero`. À monter une seule fois (SeasonProvider). */
export function useSuiviDirect(numero: number): void {
  const session = useSession();
  const actif = !!session?.server;
  useEffect(() => {
    if (!actif) return;
    const charger = () =>
      chargerFeuilles(numero).catch(() => {
        /* base injoignable ou table pas encore créée : on garde ce qu'on a */
      });
    void charger();
    const sb = supabase();
    let canal: ReturnType<typeof sb.channel> | null = null;
    try {
      canal = sb
        .channel(`sfl-direct-${++seq}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "feuilles_direct" }, charger)
        .subscribe();
    } catch {
      // Sans temps réel, les feuilles se rechargent à la prochaine ouverture.
    }
    return () => {
      if (canal) sb.removeChannel(canal);
    };
  }, [actif, numero]);
}

/** Les feuilles en mémoire (vide au rendu serveur). */
export function useFeuillesDirect(): FeuilleDirect[] {
  return useSyncExternalStore(abonner, feuillesEnMemoire, () => AUCUNE);
}
