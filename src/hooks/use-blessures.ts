"use client";

// Les blessures déclarées (lib/sfl/blessures-store.ts), chargées une fois
// pour toute l'app et suivies en temps réel, comme les pronos
// (use-liste-pronos.ts).

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useSaisonClose, useSeason } from "@/components/sfl/season-provider";
import { useSession } from "@/hooks/use-session";
import { bilanJournees, blessesEnCours, journeesParJoueur, type BilanJournees, type Blessure } from "@/lib/sfl/blessures";
import { APERCU_BLESSURES, blessuresEnMemoire, BLESSURES_EVENT, chargerBlessures } from "@/lib/sfl/blessures-store";
import { supabase } from "@/lib/supabase";

const AUCUNE: Blessure[] = [];
let abonnes = 0;
let arreter: (() => void) | null = null;
let seq = 0;

function abonner(onChange: () => void) {
  window.addEventListener(BLESSURES_EVENT, onChange);
  return () => window.removeEventListener(BLESSURES_EVENT, onChange);
}

function suivre(depuisLaBase: boolean): () => void {
  abonnes++;
  if (abonnes === 1) {
    const charger = () =>
      chargerBlessures(depuisLaBase).catch(() => {
        /* base injoignable : on garde ce qu'on a */
      });
    void charger();
    if (depuisLaBase && !APERCU_BLESSURES) {
      const sb = supabase();
      try {
        const canal = sb
          .channel(`sfl-blessures-${++seq}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "blessures" }, charger)
          .subscribe();
        arreter = () => void sb.removeChannel(canal);
      } catch {
        // Sans temps réel, les blessures se rechargent à la prochaine ouverture.
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

/** Toutes les blessures que l'app connaît. */
export function useBlessures(): Blessure[] {
  const session = useSession();
  const depuisLaBase = !!session?.server;
  useEffect(() => suivre(depuisLaBase), [depuisLaBase]);
  return useSyncExternalStore(abonner, blessuresEnMemoire, () => AUCUNE);
}

/** Ses journées de la saison lue : jouées, manquées sur blessure, sur combien. */
export function useBilanJournees(joueur: string): BilanJournees {
  const { saison } = useSeason();
  const liste = useBlessures();
  return useMemo(() => bilanJournees(saison, liste, joueur), [saison, liste, joueur]);
}

/** Pour un classement : les journées jouées de chacun, et qui est blessé en ce moment. */
export function useJourneesDuClassement(): { journees: Map<string, number>; blesses: Set<string> } {
  const { saison } = useSeason();
  const liste = useBlessures();
  return useMemo(() => {
    const blesses = blessesEnCours(liste, saison.numero ?? 0);
    // L'admin peut aussi l'avoir mis « Blessure » dans l'effectif.
    for (const r of saison.roster) if (r.profil === "Blessure") blesses.add(r.name);
    return {
      journees: new Map([...journeesParJoueur(saison.entries)].map(([n, s]) => [n, s.size])),
      blesses,
    };
  }, [saison, liste]);
}

/**
 * Est-il blessé en ce moment (déclaré, ou « Blessure » dans l'effectif) ?
 * Pour le sigle posé sur sa carte (mini-carte.tsx) : jamais dans une saison close.
 */
export function useEstBlesse(nom: string): boolean {
  const { saison } = useSeason();
  const close = useSaisonClose();
  const liste = useBlessures();
  if (close) return false;
  const numero = saison.numero ?? 0;
  return (
    liste.some((b) => b.saison === numero && b.joueur === nom && b.fin == null) ||
    saison.roster.some((r) => r.name === nom && r.profil === "Blessure")
  );
}
