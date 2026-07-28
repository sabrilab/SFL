"use client";

// Source unique des données de saison côté joueurs. Charge la saison saisie par
// l'admin (localStorage, seed en repli), en dérive classements / journées /
// cartes boost via le moteur, et re-calcule quand l'admin modifie la saisie
// (événement "sfl-saisie" ou storage cross-onglet). Demain Supabase : seul le
// store change, ce provider et ses consommateurs restent identiques.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { deriveSeason, type DerivedSeason } from "@/lib/sfl/saisie/engine";
import { saisieStore, seedSaison } from "@/lib/sfl/saisie/store";
import type { Saison } from "@/lib/sfl/saisie/types";

export const SAISIE_EVENT = "sfl-saisie";

interface SeasonValue extends DerivedSeason {
  saison: Saison;
}

const SeasonContext = createContext<SeasonValue | null>(null);

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // setState dans un callback d'événement (pas dans le corps de l'effet).
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener(SAISIE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SAISIE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const saison = useMemo(() => {
    void version; // relit le store à chaque incrément de version (édition admin)
    return isClient ? saisieStore.load() : seedSaison();
  }, [isClient, version]);
  const derived = useMemo(() => deriveSeason(saison), [saison]);
  const value = useMemo<SeasonValue>(() => ({ ...derived, saison }), [derived, saison]);

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeason(): SeasonValue {
  const value = useContext(SeasonContext);
  if (!value) throw new Error("useSeason doit être utilisé dans un SeasonProvider");
  return value;
}
