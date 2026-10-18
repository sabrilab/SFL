"use client";

// Les photos de la ligue, tenues à jour : la liste est relue au lancement et
// à chaque retour sur l'app, et la photo du joueur connecté restée sur cet
// appareil (posée hors ligne, ou avant le partage) part à la ligue. Même
// chose pour le badge choisi pour la carte (lib/sfl/badges-choisis).

import { useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { envoyerBadgeEnAttente, rafraichirBadges } from "@/lib/sfl/badges-choisis";
import { envoyerPhotosEnAttente, rafraichirPhotos } from "@/lib/sfl/photos";

export function PhotosSync() {
  const session = useSession();
  const nom = session?.server ? session.name : null;

  useEffect(() => {
    void rafraichirPhotos();
    void rafraichirBadges();
    const auRetour = () => {
      if (document.visibilityState !== "visible") return;
      void rafraichirPhotos();
      void rafraichirBadges();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, []);

  useEffect(() => {
    if (!nom) return;
    void envoyerPhotosEnAttente(nom);
    void envoyerBadgeEnAttente(nom);
  }, [nom]);

  return null;
}
