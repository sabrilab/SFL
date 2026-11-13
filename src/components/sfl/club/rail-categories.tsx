"use client";

// Le rail des catégories d'un club (Bola Club, bola-app#14 : « rail de
// catégories »), collé en haut des trois onglets du club : « Tout », puis
// les catégories que ce point de vue lit (tout le club pour l'admin et les
// entraîneurs ; la sienne pour un joueur ou son parent). La même rangée de
// puces que le rail des journées des Actus (actus/rail.tsx). Le choix est
// dans l'adresse (?cat=u13) : il suit d'un onglet à l'autre, et le retour
// d'une fiche le retrouve.

import { usePathname, useSearchParams } from "next/navigation";
import { Rail } from "@/components/sfl/actus/rail";
import { useClub } from "@/hooks/use-club";
import type { Categorie } from "@/lib/sfl/club/types";

/** Les catégories que ce point de vue lit, dans l'ordre du rail. */
export function useCategoriesLues(): Categorie[] {
  const { club, droits } = useClub();
  return club.categories.filter((c) => droits.lit(c.id)).sort((a, b) => a.ordre - b.ordre);
}

/** La catégorie choisie dans le rail (null : « Tout »), et de quoi en changer. */
export function useCategorieChoisie(): [string | null, (id: string | null) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const lues = useCategoriesLues();
  const brute = params.get("cat");
  const choisie = lues.some((c) => c.id === brute) ? brute : null;
  const changer = (id: string | null) => {
    const p = new URLSearchParams(params.toString());
    if (id) p.set("cat", id);
    else p.delete("cat");
    const q = p.toString();
    // L'App Router suit history.replaceState : useSearchParams voit le nouveau choix.
    window.history.replaceState(null, "", q ? `${pathname}?${q}` : pathname);
  };
  return [choisie, changer];
}

const TOUT = "tout";

export function RailCategories() {
  const lues = useCategoriesLues();
  const [choisie, changer] = useCategorieChoisie();
  return (
    <Rail
      nom="Catégories"
      puces={[{ id: TOUT, label: "Tout" }, ...lues.map((c) => ({ id: c.id, label: c.nom }))]}
      active={choisie ?? TOUT}
      onChoisir={(id) => changer(id === TOUT ? null : id)}
    />
  );
}
