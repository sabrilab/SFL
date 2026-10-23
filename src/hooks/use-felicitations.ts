"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import {
  enDemo,
  felicitationsDeLaBase,
  felicitationsDemo,
  FELICITATIONS_EVENT,
  felicitationsRevision,
  type Felicitation,
} from "@/lib/sfl/felicitations";

function subscribe(onChange: () => void) {
  window.addEventListener(FELICITATIONS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(FELICITATIONS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Les félicitations de la ligue (lib/sfl/felicitations), par exploit ; rien au rendu serveur. */
export function useFelicitations(): { pour: (cle: string) => Felicitation[]; toutes: Felicitation[] } {
  const rev = useSyncExternalStore(subscribe, felicitationsRevision, () => -1);
  const { saison, allPlayers } = useSeason();
  const { me } = useMyPlayer();
  return useMemo(() => {
    const toutes: Felicitation[] =
      rev < 0
        ? []
        : enDemo()
          ? felicitationsDemo(
              saison,
              allPlayers.map((p) => p.name),
              me
            )
          : felicitationsDeLaBase();
    const parExploit = new Map<string, Felicitation[]>();
    for (const f of toutes) parExploit.set(f.exploit, [...(parExploit.get(f.exploit) ?? []), f]);
    return { pour: (cle) => parExploit.get(cle) ?? [], toutes };
  }, [rev, saison, allPlayers, me]);
}
