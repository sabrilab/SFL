"use client";

// La liste des pronos (lib/sfl/pronos-store.ts), chargée une fois pour toute
// l'app et suivie en temps réel. À part de use-pronos.ts, pour que le calcul
// de l'XP (use-missions.ts) la lise sans boucle d'imports.

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import type { Prono } from "@/lib/sfl/pronos";
import { APERCU_PRONOS, chargerPronos, pronosEnMemoire, PRONOS_EVENT } from "@/lib/sfl/pronos-store";
import { supabase } from "@/lib/supabase";

const AUCUN: Prono[] = [];
let abonnes = 0;
let arreter: (() => void) | null = null;
let seq = 0;

function abonner(onChange: () => void) {
  window.addEventListener(PRONOS_EVENT, onChange);
  return () => window.removeEventListener(PRONOS_EVENT, onChange);
}

function suivre(depuisLaBase: boolean): () => void {
  abonnes++;
  if (abonnes === 1) {
    const charger = () =>
      chargerPronos(depuisLaBase).catch(() => {
        /* base injoignable : on garde ce qu'on a */
      });
    void charger();
    if (depuisLaBase && !APERCU_PRONOS) {
      const sb = supabase();
      try {
        const canal = sb
          .channel(`sfl-pronos-${++seq}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "pronos" }, charger)
          .subscribe();
        arreter = () => void sb.removeChannel(canal);
      } catch {
        // Sans temps réel, les pronos se rechargent à la prochaine ouverture.
      }
    }
  }
  return () => {
    abonnes--;
    if (abonnes === 0) {
      arreter?.();
      arreter = null;
    }
  };
}

/** Tous les pronos que l'app connaît (ceux de la base ; dans un aperçu, ceux du téléphone). */
export function useListePronos(): Prono[] {
  const session = useSession();
  const depuisLaBase = !!session?.server;
  useEffect(() => suivre(depuisLaBase), [depuisLaBase]);
  return useSyncExternalStore(abonner, pronosEnMemoire, () => AUCUN);
}
