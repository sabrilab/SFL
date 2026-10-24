"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { claimDailyLogin } from "@/lib/sfl/ballons";
import { refreshSession, suivreSessionServeur } from "@/lib/sfl/auth/session";
import { logActivity } from "@/lib/sfl/activity";
import { useIsClient } from "@/hooks/use-is-client";
import { useSeason } from "@/components/sfl/season-provider";
import { useSession } from "@/hooks/use-session";

const STORAGE_KEY = "sfl-me";
const DEFAULT_PLAYER = "Smail";

interface PlayerContextValue {
  me: string;
  setMe: (name: string) => void;
  /**
   * true = un joueur est connecté mais son nom n'est pas dans la saison
   * chargée. AuthGate montre alors un écran d'attente : jamais la carte d'un
   * autre à la place de la sienne.
   */
  inconnu: boolean;
}

const PlayerContext = createContext<PlayerContextValue>({
  me: DEFAULT_PLAYER,
  setMe: () => {},
  inconnu: false,
});

const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

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
  // Le nom de la saison fait foi (casse comprise) : « azzedine » est Azzedine.
  const trouve = players.find((p) => memeNom(p.name, candidate))?.name;
  // Connecté mais absent de la saison chargée : on ne retombe JAMAIS sur un
  // autre joueur. Avant, c'était Smail par défaut — un joueur se connectait et
  // ouvrait la carte de Smail (22/10). Le nom de session reste, AuthGate
  // bloque l'app tant que la saison ne le connaît pas.
  const inconnu = isClient && !!sessionName && !override && !trouve;
  const me = trouve ?? (sessionName && !override ? sessionName : DEFAULT_PLAYER);

  // +2 Ballons à la première ouverture de l'app du jour — une fois connecté
  // seulement : sinon la récompense tombe sur l'écran de connexion, avant même
  // de savoir qui joue.
  // La session se remet à jour depuis le serveur à chaque ouverture : un rôle
  // admin accordé en base est vu sans se déconnecter.
  // Une PWA sur iPhone ne se recharge pas en revenant au premier plan : on
  // revérifie aussi au retour dans l'app et au retour du réseau.
  useEffect(() => {
    const verifier = () => {
      if (document.visibilityState === "visible") void refreshSession();
    };
    verifier();
    const arreter = suivreSessionServeur();
    document.addEventListener("visibilitychange", verifier);
    window.addEventListener("online", verifier);
    return () => {
      arreter();
      document.removeEventListener("visibilitychange", verifier);
      window.removeEventListener("online", verifier);
    };
  }, []);

  useEffect(() => {
    if (!isClient || !sessionName) return;
    logActivity("open");
    // Les Ballons sont retirés de l'app : plus de récompense affichée à
    // l'ouverture. Le compteur interne reste, sans rien montrer.
    claimDailyLogin(me);
  }, [isClient, me, sessionName]);

  function setMe(name: string) {
    localStorage.setItem(STORAGE_KEY, name);
    setSelected({ forSession: sessionName, name });
  }

  return (
    <PlayerContext.Provider value={{ me, setMe, inconnu }}>
      {children}
    </PlayerContext.Provider>
  );
}

/** Le joueur connecté est-il absent de la saison chargée ? (voir AuthGate) */
export function useJoueurInconnu(): boolean {
  return useContext(PlayerContext).inconnu;
}

/**
 * Le joueur connecté joue-t-il en Bola, hors de la SFL (venu par un
 * parrain, season-provider.tsx) ? Ce qui n'appartient qu'à la saison SFL
 * (convocation du dimanche, Vestiaire) ne s'affiche pas pour lui.
 */
export function useJoueurBola(): boolean {
  return useSeason().bola !== null;
}

export function useMyPlayer() {
  const { me, setMe } = useContext(PlayerContext);
  const { allPlayers } = useSeason();
  const player = allPlayers.find((p) => p.name === me) ?? allPlayers[0];
  return { me, setMe, player };
}
