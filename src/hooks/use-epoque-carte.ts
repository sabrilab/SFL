"use client";

// La carte d'une saison close qui a son édition d'époque (la saison 0 :
// finitions-carte.ts, lib/sfl/epoques.ts) : sa saison, sa date d'émission
// et son numéro, ou null pour une carte d'aujourd'hui.
//
// La saison de la carte vient d'elle-même (`saison` : une carte d'une saison
// close montrée hors de son archive, dans Ma carte, sur un profil, au Wall
// of Fame, ou ouverte en grand), sinon de l'archive qu'on relit
// (SaisonArchiveProvider : les Actus d'une saison close, ses récaps). La
// saison en cours n'a jamais d'édition d'époque, même la saison 0 d'un
// appareil de test.

import { useMemo } from "react";
import { aSonEpoque } from "@/components/sfl/finitions-carte";
import { useSaisonClose, useSeason } from "@/components/sfl/season-provider";
import type { BoostType } from "@/lib/sfl/engine";
import { emissionDe, type EmissionCarte } from "@/lib/sfl/epoques";
import { numeroSaison } from "@/lib/sfl/saisie/types";

/** La saison d'une carte : la sienne, ou celle de l'archive qu'on relit ; undefined pour la saison en cours. */
export function useSaisonDeCarte(saison?: number): number | undefined {
  const { saison: lue } = useSeason();
  const close = useSaisonClose();
  return saison ?? (close ? numeroSaison(lue) : undefined);
}

/**
 * L'émission de la carte de saison de `nom`, ou de sa carte à titre
 * (`titre`, de la journée `j`), si sa saison a son édition d'époque.
 */
export function useEpoqueCarte(nom: string, saison?: number, titre?: BoostType, j?: number): EmissionCarte | null {
  const { saison: lue } = useSeason();
  const close = useSaisonClose();
  const numero = saison ?? (close ? numeroSaison(lue) : undefined);
  return useMemo(() => {
    if (!aSonEpoque(numero)) return null;
    // Ses lignes : la saison qu'on relit, sinon son archive.
    const source = close && numeroSaison(lue) === numero ? lue : lue.archives?.find((a) => a.numero === numero);
    if (!source) return { saison: numero, le: null, n: null, sur: null };
    return emissionDe(source, nom, titre ? { type: titre, j } : undefined);
  }, [numero, close, lue, nom, titre, j]);
}
