// Les finitions offertes, hors de la passe : une carte qu'on habille à la
// main. La première, onyx, à la carte de Sabri (24/10 : « t'as vu ma carte,
// mais elle n'est pas blanche […] tu fais une espèce de skin noir ultra
// stylé »). La deuxième, le verre, à la même carte le soir (« transparente
// comme du verre ») : la dernière offerte est celle que « auto » porte.
// Puis deux à la carte d'Ilyes, Pépite d'Or de la saison 0 (24/10 : « on
// va lui faire un skin propre à lui, qu'il pourra choisir ») : la pépite,
// tout en or, et la palestine, le drapeau au dos (skins-offerts.ts).
//
// Elles s'ajoutent à ce que la passe a débloqué (use-habillage.ts) : rien
// choisi (« auto ») porte la dernière, donc celle qui est offerte ; le
// joueur peut toujours en porter une autre de la passe, ou rien. La carte
// des autres la montre comme une finition gagnée.

import type { Finition } from "@/components/sfl/finitions-carte";

export const FINITIONS_OFFERTES: Readonly<Record<string, readonly Finition[]>> = {
  Sabri: ["onyx", "verre"],
  Ilyes: ["pepite", "palestine"],
};

/** Ce que Personnaliser ma carte dit d'un skin offert : son nom, ce qu'il est, pourquoi il est offert. */
export const SKINS_OFFERTS: Readonly<Partial<Record<Finition, { titre: string; quoi: string; comment: string }>>> = {
  onyx: { titre: "Onyx", quoi: "La carte noire guillochée.", comment: "Offert" },
  verre: { titre: "Verre", quoi: "La plaque de verre fumé, gravée.", comment: "Offert" },
  pepite: { titre: "Pépite d'or", quoi: "Tout en or, gravé or sur or. La photo reste telle quelle.", comment: "Offert · Pépite d'Or saison 0" },
  palestine: { titre: "Palestine", quoi: "Le drapeau de la Palestine au dos de la carte.", comment: "Offert · Pépite d'Or saison 0" },
};

/** Les finitions offertes à un joueur, par son nom de saison. */
export function finitionsOffertes(nom: string): readonly Finition[] {
  return FINITIONS_OFFERTES[nom] ?? [];
}
