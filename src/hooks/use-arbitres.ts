"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useSeason } from "@/components/sfl/season-provider";
import { ARBITRES_EVENT, arbitresRevision, etatArbitres, statsArbitre, type Arbitrage, type EtatArbitres, type StatsArbitre } from "@/lib/sfl/arbitres";

function subscribe(onChange: () => void) {
  window.addEventListener(ARBITRES_EVENT, onChange);
  return () => window.removeEventListener(ARBITRES_EVENT, onChange);
}

export interface Arbitres extends EtatArbitres {
  estArbitre: (nom: string) => boolean;
  /** L'arbitre d'un match de la saison en cours. */
  duMatch: (j: number, n: number) => Arbitrage | null;
  /** Les chiffres de sa carte. */
  stats: (nom: string) => StatsArbitre;
}

const VIDE: EtatArbitres = { arbitres: [], arbitrages: [], avis: {}, mesNotes: {}, demo: false };

/** Les arbitres de la ligue (lib/sfl/arbitres), leurs matchs et leurs notes ; rien au rendu serveur. */
export function useArbitres(): Arbitres {
  const rev = useSyncExternalStore(subscribe, arbitresRevision, () => -1);
  const { saison } = useSeason();
  return useMemo(() => {
    const e = rev < 0 ? VIDE : etatArbitres();
    const numero = saison.numero ?? 0;
    // Une journée est jouée quand ses résultats sont saisis ; une saison close l'a été.
    const jouees = new Set(saison.entries.filter((x) => x.result).map((x) => x.j));
    const jouee = (s: number, j: number) => (s === numero ? jouees.has(j) : s < numero);
    const arbitres = new Set(e.arbitres);
    return {
      ...e,
      estArbitre: (nom) => arbitres.has(nom),
      duMatch: (j, n) => e.arbitrages.find((a) => a.saison === numero && a.j === j && a.n === n) ?? null,
      stats: (nom) => statsArbitre(nom, e, jouee),
    };
  }, [rev, saison]);
}
