"use client";

// L'en-tête des trois écrans de la boutique : le retour, le titre (le nom de
// la boutique, celui du rayon ; rien sur une fiche), puis deux petites
// entrées à droite. Le cœur ouvre le rayon des favoris (il est plein quand
// on y est) ; le ballon et son
// solde ouvrent le guichet des Ballons (guichet-ballons.tsx), qui ne prend
// plus de place dans la vitrine (Sabri, 12/11/2026).

import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { BallIcon } from "@/components/layout/nav-icons";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useBallons } from "@/hooks/use-ballons";
import { adresseGrille } from "@/lib/boutique/catalogue";
import { cn } from "@/lib/utils";
import { GuichetBallons, milliers } from "./guichet-ballons";

export function EnTeteBoutique({ titre, favoris, className }: { titre?: string; /** On est dans le rayon des favoris. */ favoris?: boolean; className?: string }) {
  const { player } = useMyPlayer();
  const ballons = useBallons(player.name);
  const [guichet, setGuichet] = useState(false);

  return (
    <header className={cn("flex items-center gap-2", className)}>
      <BoutonRetour />
      {titre ? (
        <h1 className="titre-lettrage ml-1 min-w-0 flex-1 truncate text-titre-fort leading-tight min-[390px]:text-titre-m sm:text-titre-g">{titre}</h1>
      ) : (
        <span className="flex-1" />
      )}
      <Link
        href={adresseGrille({ rayon: "favoris" })}
        aria-label="Favoris"
        aria-current={favoris ? "page" : undefined}
        className="bouton-secondaire flex size-11 shrink-0 items-center justify-center"
      >
        <Heart className="size-5" strokeWidth={1.8} fill={favoris ? "currentColor" : "none"} />
      </Link>
      <button
        type="button"
        onClick={() => setGuichet(true)}
        aria-label="Acheter des Ballons"
        className="bouton-secondaire flex h-11 shrink-0 items-center gap-1.5 pr-3 pl-2.5 text-ligne font-bold tabular-nums"
      >
        <BallIcon stroke="currentColor" />
        {milliers(ballons)}
      </button>
      <GuichetBallons ouvert={guichet} onOpenChange={setGuichet} />
    </header>
  );
}
