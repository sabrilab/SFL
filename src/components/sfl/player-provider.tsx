"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { claimDailyLogin } from "@/lib/sfl/ballons";
import { refreshSession } from "@/lib/sfl/auth/session";
import { logActivity } from "@/lib/sfl/activity";
import { useIsClient } from "@/hooks/use-is-client";
import { useSeason } from "@/components/sfl/season-provider";
import { useSession } from "@/hooks/use-session";

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
  // Un joueur masqué doit pouvoir se connecter et se voir : l'identité se
  // résout donc sur la liste complète, pas sur la liste publique.
  const { allPlayers: players } = useSeason();
  const session = useSession();
  // La bascule de profil (réservée à l'admin) est mémorisée AVEC la session
  // pour laquelle elle a été faite : changer de compte l'invalide d'elle-même,
  // sans effet de remise à zéro.
  const [selected, setSelected] = useState<{ forSession: string | null; name: string } | null>(
    null
  );

  // Depuis l'arrivée des comptes, l'identité vient de la session : personne ne
  // joue le profil d'un autre.
  const sessionName = session?.name ?? null;
  const stored = isClient ? localStorage.getItem(STORAGE_KEY) : null;
  const override = selected && selected.forSession === sessionName ? selected.name : null;
  const candidate = override ?? sessionName ?? stored ?? DEFAULT_PLAYER;
  const me = players.some((p) => p.name === candidate) ? candidate : DEFAULT_PLAYER;

  // +2 Ballons à la première ouverture de l'app du jour — une fois connecté
  // seulement : sinon la récompense tombe sur l'écran de connexion, avant même
  // de savoir qui joue.
  // La session se remet à jour depuis le serveur à chaque ouverture : un rôle
  // admin accordé en base est vu sans se déconnecter.
  useEffect(() => {
    void refreshSession();
  }, []);

  useEffect(() => {
    if (!isClient || !sessionName) return;
    logActivity("open");
    const credited = claimDailyLogin(me);
    if (credited > 0) {
      toast.success(`+${credited} Ballons ⚽`, { description: "Connexion du jour" });
    }
  }, [isClient, me, sessionName]);

  function setMe(name: string) {
    localStorage.setItem(STORAGE_KEY, name);
    setSelected({ forSession: sessionName, name });
  }

  return (
    <PlayerContext.Provider value={{ me, setMe }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function useMyPlayer() {
  const { me, setMe } = useContext(PlayerContext);
  const { allPlayers } = useSeason();
  const player = allPlayers.find((p) => p.name === me) ?? allPlayers[0];
  return { me, setMe, player };
}
