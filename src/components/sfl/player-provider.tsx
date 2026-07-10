"use client";

import { createContext, useContext, useState } from "react";
import { PLAYERS } from "@/lib/sfl/data";
import { useIsClient } from "@/hooks/use-is-client";

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
  const [selected, setSelected] = useState<string | null>(null);

  const stored = isClient ? localStorage.getItem(STORAGE_KEY) : null;
  const candidate = selected ?? stored ?? DEFAULT_PLAYER;
  const me = PLAYERS.some((p) => p.name === candidate) ? candidate : DEFAULT_PLAYER;

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
  const player = PLAYERS.find((p) => p.name === me) ?? PLAYERS[0];
  return { me, setMe, player };
}
