"use client";

// Les photos de la ligue, tenues à jour : la liste est relue au lancement et
// à chaque retour sur l'app, et la photo du joueur connecté restée sur cet
// appareil (posée hors ligne, ou avant le partage) part à la ligue.

import { useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { envoyerPhotosEnAttente, rafraichirPhotos } from "@/lib/sfl/photos";

export function PhotosSync() {
  const session = useSession();
  const nom = session?.server ? session.name : null;

  useEffect(() => {
    void rafraichirPhotos();
    const auRetour = () => {
      if (document.visibilityState === "visible") void rafraichirPhotos();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, []);

  useEffect(() => {
    if (nom) void envoyerPhotosEnAttente(nom);
  }, [nom]);

  return null;
}
