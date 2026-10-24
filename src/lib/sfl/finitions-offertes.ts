// Les finitions offertes, hors de la passe : une carte qu'on habille à la
// main. La première, onyx, à la carte de Sabri (24/10 : « t'as vu ma carte,
// mais elle n'est pas blanche […] tu fais une espèce de skin noir ultra
// stylé »). La deuxième, le verre, à la même carte le soir (« transparente
// comme du verre ») : la dernière offerte est celle que « auto » porte.
//
// Elles s'ajoutent à ce que la passe a débloqué (use-habillage.ts) : rien
// choisi (« auto ») porte la dernière, donc celle qui est offerte ; le
// joueur peut toujours en porter une autre de la passe, ou rien. La carte
// des autres la montre comme une finition gagnée.

import type { Finition } from "@/components/sfl/finitions-carte";

export const FINITIONS_OFFERTES: Readonly<Record<string, readonly Finition[]>> = {
  Sabri: ["onyx", "verre"],
};

/** Les finitions offertes à un joueur, par son nom de saison. */
export function finitionsOffertes(nom: string): readonly Finition[] {
  return FINITIONS_OFFERTES[nom] ?? [];
}
