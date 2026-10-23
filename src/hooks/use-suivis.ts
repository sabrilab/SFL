"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { idDe } from "@/lib/sfl/comptes";
import { enDemo, liensDeLaBase, liensDemo, SUIVIS_EVENT, suivisLus, suivisRevision, type Lien } from "@/lib/sfl/suivis";

function subscribe(onChange: () => void) {
  window.addEventListener(SUIVIS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SUIVIS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export interface Suivis {
  /** Ceux qui suivent ce joueur. */
  abonnes: (nom: string) => string[];
  /** Ceux qu'il suit. */
  abonnements: (nom: string) => string[];
  /** a suit-il b ? */
  suit: (a: string, b: string) => boolean;
  /** Peut-on le suivre : un compte accepté par l'admin. */
  suivable: (nom: string) => boolean;
  /** La liste vient de la base (ou de la démonstration), pas d'un cache. */
  lue: boolean;
}

const VIDE: Suivis = { abonnes: () => [], abonnements: () => [], suit: () => false, suivable: () => false, lue: false };

/** Qui suit qui dans la ligue (lib/sfl/suivis), en noms de saison ; rien au rendu serveur. */
export function useSuivis(): Suivis {
  const rev = useSyncExternalStore(subscribe, suivisRevision, () => -1);
  const { allPlayers } = useSeason();
  const { me } = useMyPlayer();
  return useMemo(() => {
    if (rev < 0) return VIDE;
    const demo = enDemo();
    const liens: Lien[] = demo
      ? liensDemo(
          [...allPlayers].sort((a, b) => b.pp - a.pp).map((p) => p.name),
          me
        )
      : liensDeLaBase();
    const abonnes = new Map<string, string[]>();
    const abonnements = new Map<string, string[]>();
    for (const [a, b] of liens) {
      abonnes.set(b, [...(abonnes.get(b) ?? []), a]);
      abonnements.set(a, [...(abonnements.get(a) ?? []), b]);
    }
    const cles = new Set(liens.map(([a, b]) => `${a}>${b}`));
    const ligue = new Set(allPlayers.map((p) => p.name));
    return {
      abonnes: (n) => abonnes.get(n) ?? [],
      abonnements: (n) => abonnements.get(n) ?? [],
      suit: (a, b) => cles.has(`${a}>${b}`),
      suivable: (n) => (demo ? ligue.has(n) : !!idDe(n)),
      lue: demo || suivisLus(),
    };
  }, [rev, allPlayers, me]);
}
