"use client";

// Les photos d'un dimanche, dans son fil d'Actus (Bola, 28/11/2026 : « les
// photos qui sont prises pendant la J7, tu me les mettes au scroll dans
// l'onglet Actu, dans la J7 […] pareil pour la J8 et la J9 »). Elles viennent
// de la même liste que la grille de Ma carte (lib/sfl/photos-journees.ts) et
// se glissent entre les rubriques du dimanche (course.tsx, Dimanche) : une
// photo en largeur seule, deux photos en hauteur côte à côte. Les toucher
// ouvre la visionneuse plein écran de Ma carte, sur toutes les photos du
// dimanche, avec les joueurs qu'on y voit. Le carrousel « J7, en images. »
// en tête des Actus ne change pas.

import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import type { PhotoJournee } from "@/lib/sfl/photos-journees";

/** Ouvre la visionneuse sur la photo donnée (son rang dans les photos du dimanche). */
export const OuvrirPhoto = createContext<(p: PhotoJournee) => void>(() => {});

export function BlocPhotos({
  bloc,
  className,
}: {
  bloc: PhotoJournee[];
  className?: string;
}) {
  const ouvrir = useContext(OuvrirPhoto);
  const seule = bloc.length === 1;
  return (
    <div
      className={cn(
        "grid gap-[2px] overflow-hidden md:rounded-[18px]",
        seule ? "grid-cols-1" : "grid-cols-2",
        className,
      )}
    >
      {bloc.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => ouvrir(p)}
          aria-label="Voir la photo"
          className={cn(
            "relative block w-full overflow-hidden bg-contraste/[0.06]",
            seule && p.largeur >= p.hauteur ? "aspect-[16/10]" : "aspect-[4/5]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.src}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </button>
      ))}
    </div>
  );
}
