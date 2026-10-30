"use client";

// Ce que la carte d'un joueur porte (finitions-carte.ts) : ce qu'il a
// débloqué dans le Passe Bola (lib/sfl/passe.ts), toutes saisons (un palier
// atteint reste acquis, saison par saison du Passe : paliersDe), les finitions qui lui sont offertes
// (finitions-offertes.ts), ceux que ses recrues ont ouverts (skins-recrues.ts :
// 3 recrues actives, Recruteur ; 5, Filigrane ; son numéro, Fondateur), et ce
// qu'il a choisi d'en porter (habillages-choisis.ts).
//   · le skin : son choix, s'il est débloqué ; rien de choisi (« auto »), ou
//     « - », la carte de base. Rien n'est imposé (Sabri, 24/10 : « il faut
//     choisir, parmi les filtres qu'il a, celui qu'il veut mettre en avant
//     […] ça ne doit pas être imposé ») : Personnaliser ma carte
//     (personnaliser-carte.tsx). Le traitement de la photo n'est plus dans
//     la passe (24/10) : la carte ne le porte plus ;
//   · les signes débloqués qu'il a choisis, aucun sinon ;
//   · le cran du cadre (missions réussies) et le rang (XP à vie) : d'office.
// Un choix qui n'est pas débloqué ne se porte pas : la carte d'un autre
// joueur ne montre que ce qu'il a gagné.

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { MATIERES, type Finition, type HabillageCarte } from "@/components/sfl/finitions-carte";
import {
  HABILLAGE_EVENT,
  habillageChoisi,
  habillageRevision,
  lireChoixHabillage,
  type ChoixHabillage,
} from "@/lib/sfl/habillages-choisis";
import { finitionsOffertes } from "@/lib/sfl/finitions-offertes";
import { finitionsRecrues } from "@/components/sfl/skins-recrues";
import type { Rang } from "@/lib/sfl/missions";
import { debloquesDe, type PaliersAtteints } from "@/lib/sfl/passe";
import { SAISONS_PASSE } from "@/lib/sfl/saisons-passe";

/** Ce que l'XP pose sur les cartes de la ligue (XpLigueProvider, xp-ligue.tsx). */
export interface CartesXp {
  /**
   * Par joueur : son rang (XP à vie), le palier atteint dans chaque saison du
   * Passe (saisons-passe.ts), le cran du cadre, ses recrues actives et son
   * numéro de Fondateur.
   */
  parJoueur: Map<string, { rang: Rang | null; paliers: PaliersAtteints; cran: number; recrues: number; fondateur: number | null }>;
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
  const lignes = JSON.parse(surLesCartes) as [string, Rang | null, PaliersAtteints, number, number?, (number | null)?][];
  return {
    parJoueur: new Map(
      lignes.map(([nom, rang, paliers, cran, recrues, fondateur]) => [nom, { rang, paliers, cran, recrues: recrues ?? 0, fondateur: fondateur ?? null }])
    ),
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

const AUCUN: PaliersAtteints = {};

/** Les paliers qu'un joueur a atteints, saison du Passe par saison : ce qu'il a débloqué. */
export function usePaliers(nom: string): PaliersAtteints {
  return useContext(CartesXpContext)?.parJoueur.get(nom)?.paliers ?? AUCUN;
}

/** Les recrues actives d'un joueur et son numéro de Fondateur (0 et null tant que rien n'est chargé). */
export function useRecruesCarte(nom: string): { recrues: number; fondateur: number | null } {
  const x = useContext(CartesXpContext)?.parJoueur.get(nom);
  return { recrues: x?.recrues ?? 0, fondateur: x?.fondateur ?? null };
}

/**
 * Les skins d'un joueur : ceux que son palier a débloqués, ceux qui lui sont
 * offerts, puis ceux de ses recrues.
 */
export function finitionsDe(nom: string, paliers: PaliersAtteints, recrues = 0, fondateur: number | null = null): Finition[] {
  const passe = debloquesDe(paliers, SAISONS_PASSE).finitions.filter((f): f is Finition => f in MATIERES);
  const autres = [...finitionsOffertes(nom), ...finitionsRecrues(recrues, fondateur)];
  return [...passe, ...autres.filter((f, i) => !passe.includes(f) && autres.indexOf(f) === i)];
}

/** Ce que la carte du joueur porte. Vide tant que l'XP de la ligue n'est pas calculé. */
export function useHabillage(nom: string): HabillageCarte {
  const cartes = useContext(CartesXpContext);
  const choix = useChoixHabillage(nom);
  return useMemo(() => {
    if (!cartes) return {};
    const x = cartes.parJoueur.get(nom);
    const paliers = x?.paliers ?? AUCUN;
    const fondateur = x?.fondateur ?? null;
    const finitions = finitionsDe(nom, paliers, x?.recrues ?? 0, fondateur);
    // « Tes couleurs » se porte avec son pays.
    const voulue = choix.finition === "couleurs" && !choix.pays ? "-" : choix.finition;
    const finition = voulue !== "auto" && voulue !== "-" && finitions.includes(voulue) ? voulue : undefined;
    const ouverts = debloquesDe(paliers, SAISONS_PASSE).signes;
    const cran = Math.min(4, x?.cran ?? 0) as HabillageCarte["cran"];
    return {
      finition,
      pays: finition === "couleurs" ? choix.pays : undefined,
      signes: choix.signes.filter((g) => ouverts.includes(g)),
      cran,
      rang: x?.rang ?? undefined,
      // La carte Fondateur porte son numéro (la ligne de série, bola-card.tsx).
      fondateur: finition === "fondateur" && fondateur ? fondateur : undefined,
    };
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
