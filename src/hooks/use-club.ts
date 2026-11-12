"use client";

// Bola Club : le club de la démonstration, le point de vue choisi et « moi »
// (lib/sfl/club/store.ts). « Moi » est un membre fictif du FC Démo, jamais le
// compte connecté : la présidente (admin), l'entraîneur des U13 et des U17,
// un joueur des U17, le parent d'un U13. `agir` applique un changement
// (lib/sfl/club/mutations.ts) et dit un refus comme l'app dit ses erreurs.
// useClubDuMenu : l'entrée du club dans le menu des ligues (choix-ligue.tsx),
// seulement sous le drapeau et une fois /club ouvert sur ce téléphone.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { BOLA_CLUB } from "@/lib/sfl/club/drapeau";
import type { Resultat } from "@/lib/sfl/club/mutations";
import { droits } from "@/lib/sfl/club/regles";
import { cartesDuClub } from "@/lib/sfl/club/saison";
import { agirSurLeClub, clubOuvert, ecouterClub, ecouterMarqueur, etatClub, etatClubServeur, moiDe } from "@/lib/sfl/club/store";
import type { Club, Moi } from "@/lib/sfl/club/types";

export function useClub() {
  const etat = useSyncExternalStore(ecouterClub, etatClub, etatClubServeur);
  const { club, role } = etat;
  const moi = useMemo(() => moiDe(etat), [etat]);
  const d = useMemo(() => droits(club, moi), [club, moi]);
  const cartes = useMemo(() => cartesDuClub(club), [club]);
  /** Vrai si le changement est passé ; sinon le refus est dit. */
  const agir = useCallback((mutation: (club: Club, moi: Moi) => Resultat): boolean => {
    const refus = agirSurLeClub(mutation);
    if (refus) toast.error(refus);
    return refus === null;
  }, []);
  return { club, role, moi, droits: d, cartes, agir };
}

const jamais = () => false;
const rien = () => () => {};
const pasDeClub = () => null;

/** Le club à montrer dans le menu des ligues ; null hors du drapeau, ou tant que /club n'a pas été ouvert ici. */
export function useClubDuMenu(): Pick<Club, "nom" | "initiales" | "blason"> | null {
  const ouvert = useSyncExternalStore(BOLA_CLUB ? ecouterMarqueur : rien, BOLA_CLUB ? clubOuvert : jamais, jamais);
  const etat = useSyncExternalStore(ecouterClub, ouvert ? etatClub : pasDeClub, pasDeClub);
  return ouvert && etat ? etat.club : null;
}
