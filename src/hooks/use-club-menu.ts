"use client";

// Bola Club : l'entrée du club dans le menu des ligues (choix-ligue.tsx),
// seulement sous le drapeau et une fois /club ouvert sur ce téléphone
// (lib/sfl/club/marqueur.ts). Ce menu est dans les Actus de tous les
// joueurs : ce fichier ne tire donc rien du club. La démo, le moteur et
// l'état (lib/sfl/club/store.ts) ne sont chargés, à part, que si le marqueur
// est posé ; en production il ne l'est jamais, rien n'est chargé.

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Blason } from "@/lib/sfl/blason";
import { BOLA_CLUB } from "@/lib/sfl/club/drapeau";
import { clubOuvert, ecouterMarqueur } from "@/lib/sfl/club/marqueur";

export interface ClubDuMenu {
  nom: string;
  initiales: string;
  blason: Blason;
}

const jamais = () => false;
const rien = () => () => {};

/** Le club à montrer dans le menu des ligues ; null hors du drapeau, ou tant que /club n'a pas été ouvert ici. */
export function useClubDuMenu(): ClubDuMenu | null {
  const ouvert = useSyncExternalStore(BOLA_CLUB ? ecouterMarqueur : rien, BOLA_CLUB ? clubOuvert : jamais, jamais);
  const [club, setClub] = useState<ClubDuMenu | null>(null);
  useEffect(() => {
    if (!ouvert) return;
    let vivant = true;
    let arreter = () => {};
    void import("@/lib/sfl/club/store").then((store) => {
      if (!vivant) return;
      const lire = () => {
        const { nom, initiales, blason } = store.etatClub().club;
        setClub({ nom, initiales, blason });
      };
      lire();
      arreter = store.ecouterClub(lire);
    });
    return () => {
      vivant = false;
      arreter();
    };
  }, [ouvert]);
  return ouvert ? club : null;
}
