"use client";

// Bola Club : le club de la démonstration, le point de vue choisi et « moi »
// (lib/sfl/club/store.ts). « Moi » est un membre fictif du FC Démo, jamais le
// compte connecté : la présidente (admin), l'entraîneur des U13 et des U17,
// un joueur des U17, le parent d'un U13. `agir` applique un changement
// (lib/sfl/club/mutations.ts) et dit un refus comme l'app dit ses erreurs.
// L'entrée du club dans le menu des ligues a son fichier à elle, léger
// (hooks/use-club-menu.ts) : celui-ci tire la démo et le moteur des cartes.

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Resultat } from "@/lib/sfl/club/mutations";
import { droits } from "@/lib/sfl/club/regles";
import { cartesDuClub } from "@/lib/sfl/club/saison";
import { agirSurLeClub, ecouterClub, etatClub, etatClubServeur, moiDe } from "@/lib/sfl/club/store";
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
