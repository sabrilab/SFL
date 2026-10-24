"use client";

// Ce que la carte d'un joueur porte (finitions-carte.ts) : ce qu'il a
// débloqué dans la passe, toutes saisons (un palier atteint reste acquis,
// palierMaxDe), les finitions qui lui sont offertes (finitions-offertes.ts),
// et ce qu'il a choisi d'en porter (habillages-choisis.ts).
//   · la finition et le traitement de la photo : son choix, s'il est
//     débloqué ; « auto » (rien choisi) porte le dernier débloqué ; « - »,
//     rien ;
//   · les signes débloqués, le cran du cadre (missions réussies) et le rang
//     (XP à vie) : d'office.
// Un choix qui n'est pas débloqué ne se porte pas : la carte d'un autre
// joueur ne montre que ce qu'il a gagné.

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { HabillageCarte } from "@/components/sfl/finitions-carte";
import {
  HABILLAGE_EVENT,
  habillageChoisi,
  habillageRevision,
  lireChoixHabillage,
  type ChoixHabillage,
} from "@/lib/sfl/habillages-choisis";
import { finitionsOffertes } from "@/lib/sfl/finitions-offertes";
import { debloquesDe, type Rang } from "@/lib/sfl/missions";

/** Ce que l'XP pose sur les cartes de la ligue (XpLigueProvider, xp-ligue.tsx). */
export interface CartesXp {
  /** Par joueur : son rang (XP à vie), le plus haut palier débloqué, le cran du cadre. */
  parJoueur: Map<string, { rang: Rang | null; palier: number; cran: number }>;
  /** Change avec l'un d'eux : la 3D recapture. */
  revision: string;
}

export const CartesXpContext = createContext<CartesXp | null>(null);

function empreinte(texte: string): string {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Relit XpLigue.surLesCartes (use-missions.ts). */
export function lireCartesXp(surLesCartes: string): CartesXp {
  const lignes = JSON.parse(surLesCartes) as [string, Rang | null, number, number][];
  return {
    parJoueur: new Map(lignes.map(([nom, rang, palier, cran]) => [nom, { rang, palier, cran }])),
    revision: empreinte(surLesCartes),
  };
}

function subscribe(onChange: () => void) {
  window.addEventListener(HABILLAGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(HABILLAGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const rien = () => null;

/** Le choix d'un joueur, réévalué à chaque changement. */
export function useChoixHabillage(nom: string): ChoixHabillage {
  const getSnapshot = useCallback(() => habillageChoisi(nom), [nom]);
  const brut = useSyncExternalStore(subscribe, getSnapshot, rien);
  return useMemo(() => lireChoixHabillage(brut), [brut]);
}

/** Le plus haut palier qu'un joueur a atteint, toutes saisons : ce qu'il a débloqué. */
export function usePalierMax(nom: string): number {
  return useContext(CartesXpContext)?.parJoueur.get(nom)?.palier ?? 0;
}

/** Ce que la carte du joueur porte. Vide tant que l'XP de la ligue n'est pas calculé. */
export function useHabillage(nom: string): HabillageCarte {
  const cartes = useContext(CartesXpContext);
  const choix = useChoixHabillage(nom);
  return useMemo(() => {
    if (!cartes) return {};
    const x = cartes.parJoueur.get(nom);
    const d = debloquesDe(x?.palier ?? 0);
    // Les finitions de la passe, puis celles qui lui sont offertes : « auto » porte la dernière.
    const finitions = [...d.finitions, ...finitionsOffertes(nom).filter((f) => !d.finitions.includes(f))];
    const finition =
      choix.finition === "-"
        ? undefined
        : choix.finition !== "auto" && finitions.includes(choix.finition)
          ? choix.finition
          : finitions.at(-1);
    const traitement =
      choix.traitement === "-"
        ? undefined
        : choix.traitement !== "auto" && d.traitements.includes(choix.traitement)
          ? choix.traitement
          : d.traitements.at(-1);
    const cran = Math.min(4, x?.cran ?? 0) as HabillageCarte["cran"];
    return { finition, traitement, signes: d.signes, cran, rang: x?.rang ?? undefined };
  }, [cartes, nom, choix]);
}

/**
 * Un compteur qui change avec les choix de la ligue et avec ce que l'XP pose
 * sur les cartes : de quoi recapturer les cartes 3D.
 */
export function useHabillageRevision(): string {
  const choix = useSyncExternalStore(subscribe, habillageRevision, () => 0);
  return `${choix}.${useContext(CartesXpContext)?.revision ?? "-"}`;
}
