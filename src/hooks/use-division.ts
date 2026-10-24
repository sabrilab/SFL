"use client";

// La division d'un joueur pour le prochain dimanche, une fois la ligue coupée
// (lib/sfl/divisions.ts) : null avant, pour un joueur masqué, ou hors de la
// saison des divisions. Qui n'a jamais joué entre en D3.

import { useMemo } from "react";
import { useSeason } from "@/components/sfl/season-provider";
import { etatDivisions, type Division } from "@/lib/sfl/divisions";
import { isHidden } from "@/lib/sfl/hidden";

export function useDivision(nom: string | null | undefined): Division | null {
  const { saison, vitrine } = useSeason();
  const etat = useMemo(() => etatDivisions(saison), [saison]);
  if (!nom || etat?.phase !== "divisions") return null;
  // Le compte vitrine (compte-vitrine.ts), masqué, se voit en D1 sur son écran.
  if (vitrine && nom === vitrine.nom) return 1;
  if (isHidden(nom)) return null;
  return etat.actuelle.get(nom) ?? 3;
}
