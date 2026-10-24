"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { idDe } from "@/lib/sfl/comptes";
import { isArbitre, isHidden } from "@/lib/sfl/hidden";
import type { Player } from "@/lib/sfl/engine";
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

/**
 * Les profils que j'ai le droit d'ouvrir. Un joueur masqué (Sabri, hidden.ts)
 * reste hors des classements et des listes, mais son profil s'ouvre comme
 * celui de n'importe qui pour ceux qui le suivent et ceux qu'il suit (Sabri,
 * 24/10 : « Permet aux gens qui sont abonnés à moi et qui s'abonnent à eux
 * de voir tout mon profil comme les autres »). Ils voient ses vraies données :
 * la vitrine (compte-vitrine.ts) ne vit que sur son téléphone. Un arbitre
 * garde sa page à lui.
 */
export function useProfilsOuverts(): { ouvert: (nom: string | null | undefined) => boolean; relies: Player[] } {
  const s = useSuivis();
  const { allPlayers } = useSeason();
  const { me } = useMyPlayer();
  return useMemo(() => {
    const relie = (nom: string) => !!me && nom !== me && !isArbitre(nom) && (s.suit(me, nom) || s.suit(nom, me));
    return {
      ouvert: (nom) => !!nom && (!isHidden(nom) || nom === me || relie(nom)),
      relies: allPlayers.filter((p) => isHidden(p.name) && relie(p.name)),
    };
  }, [s, allPlayers, me]);
}
