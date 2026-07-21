"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { claimDailyLogin } from "@/lib/sfl/ballons";
import { useIsClient } from "@/hooks/use-is-client";
import { useSeason } from "@/components/sfl/season-provider";

const STORAGE_KEY = "sfl-me";
const DEFAULT_PLAYER = "Smail";

interface PlayerContextValue {
  me: string;
  setMe: (name: string) => void;
}

const PlayerContext = createContext<PlayerContextValue>({
  me: DEFAULT_PLAYER,
  setMe: () => {},
});

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  const { players } = useSeason();
  const [selected, setSelected] = useState<string | null>(null);

  const stored = isClient ? localStorage.getItem(STORAGE_KEY) : null;
  const candidate = selected ?? stored ?? DEFAULT_PLAYER;
  const me = players.some((p) => p.name === candidate) ? candidate : DEFAULT_PLAYER;

  // +2 Ballons à la première ouverture de l'app du jour.
  useEffect(() => {
    if (!isClient) return;
    const credited = claimDailyLogin(me);
    if (credited > 0) {
      toast.success(`+${credited} Ballons ⚽`, { description: "Connexion du jour" });
    }
  }, [isClient, me]);

  function setMe(name: string) {
    localStorage.setItem(STORAGE_KEY, name);
    setSelected(name);
  }

  return (
    <PlayerContext.Provider value={{ me, setMe }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function useMyPlayer() {
  const { me, setMe } = useContext(PlayerContext);
  const { players } = useSeason();
  const player = players.find((p) => p.name === me) ?? players[0];
  return { me, setMe, player };
}
