"use client";

// Les photos de la ligue, tenues à jour : la liste est relue au lancement et
// à chaque retour sur l'app, et la photo du joueur connecté restée sur cet
// appareil (posée hors ligne, ou avant le partage) part à la ligue. Même
// chose pour le badge choisi pour la carte (lib/sfl/badges-choisis), pour ce
// qu'il porte sur sa carte depuis la passe (lib/sfl/habillages-choisis), et pour
// les noms et pseudos confirmés (lib/sfl/identites), et pour la ville de
// chacun sur la Map (lib/sfl/villes), posée d'office d'après la connexion
// tant que le joueur n'en a pas donné. Et qui suit qui, et les félicitations
// des Actus (lib/sfl/suivis, lib/sfl/felicitations). Et les arbitres, leurs
// matchs et leurs notes (lib/sfl/arbitres).

import { useEffect } from "react";
import { useSession } from "@/hooks/use-session";
import { envoyerBadgeEnAttente, rafraichirBadges } from "@/lib/sfl/badges-choisis";
import { envoyerHabillageEnAttente, rafraichirHabillages } from "@/lib/sfl/habillages-choisis";
import { rafraichirIdentites } from "@/lib/sfl/identites";
import { rafraichirFelicitations } from "@/lib/sfl/felicitations";
import { envoyerPhotosEnAttente, rafraichirPhotos } from "@/lib/sfl/photos";
import { rafraichirSuivis } from "@/lib/sfl/suivis";
import { rafraichirArbitres } from "@/lib/sfl/arbitres";
import { poserVilleDevinee, rafraichirVilles } from "@/lib/sfl/villes";

export function PhotosSync() {
  const session = useSession();
  const nom = session?.server ? session.name : null;

  useEffect(() => {
    void rafraichirPhotos();
    void rafraichirBadges();
    void rafraichirHabillages();
    void rafraichirIdentites();
    void rafraichirVilles();
    void rafraichirSuivis();
    void rafraichirFelicitations();
    void rafraichirArbitres();
    const auRetour = () => {
      if (document.visibilityState !== "visible") return;
      void rafraichirPhotos();
      void rafraichirBadges();
      void rafraichirHabillages();
      void rafraichirIdentites();
      void rafraichirVilles();
      void rafraichirSuivis();
      void rafraichirFelicitations();
      void rafraichirArbitres();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, []);

  useEffect(() => {
    if (!nom) return;
    void envoyerPhotosEnAttente(nom);
    void envoyerBadgeEnAttente(nom);
    void envoyerHabillageEnAttente(nom);
    // Pas encore de ville sur la Map : celle que devine la connexion.
    void rafraichirVilles().then(() => poserVilleDevinee(nom));
  }, [nom]);

  return null;
}
