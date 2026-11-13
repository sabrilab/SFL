"use client";

// La carte d'une pièce dans la grille et dans « Tu aimeras aussi ». De haut
// en bas : la tuile (la vue à plat de devant), le badge, le nom, le type, le
// nombre de couleurs, le prix. Toute la carte mène à la fiche. Dans une
// rangée, les prix sont à la même hauteur (un nom sur deux lignes ne décale
// pas celui du voisin).
//
// La deuxième photo (le dos) : au survol sur ordinateur ; sur téléphone, en
// gardant le doigt posé (350 ms), le temps du toucher : relâcher ne suit
// alors pas le lien, et le menu du navigateur ne s'ouvre pas. Un doigt qui
// glisse (on fait défiler la grille) annule l'attente.
//
// Le cœur, en haut à droite de la tuile, marque la pièce en favori sur
// l'appareil (hooks/use-favoris-boutique.ts). Il est posé à côté du lien,
// pas dedans : le toucher ne suit pas le lien. Son encre est sombre dans les
// deux modes : la tuile reste claire.

import { useRef, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { basculerFavori, useFavorisBoutique } from "@/hooks/use-favoris-boutique";
import { adresseFiche, nombreCouleurs, prix } from "@/lib/boutique/catalogue";
import type { Produit } from "@/lib/boutique/produits";
import { cn } from "@/lib/utils";
import { Tuile } from "./tuile";

const APPUI_LONG = 350;

export function Coeur({ id, nom, className }: { id: string; nom: string; className?: string }) {
  const favori = useFavorisBoutique().includes(id);
  return (
    <button
      type="button"
      onClick={() => basculerFavori(id)}
      aria-pressed={favori}
      aria-label={favori ? `Retirer ${nom} des favoris` : `Ajouter ${nom} aux favoris`}
      className={cn("flex size-11 items-center justify-center text-[#121316] active:scale-90", className)}
    >
      <Heart className="size-5" strokeWidth={1.8} fill={favori ? "currentColor" : "none"} />
    </button>
  );
}

export function CarteProduit({
  produit,
  coloris = 0,
  sizes,
  priority,
  className,
}: {
  produit: Produit;
  /** Le coloris montré : le premier, ou celui du filtre de couleur. */
  coloris?: number;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [devant, dos] = (produit.coloris[coloris] ?? produit.coloris[0]).aPlat;
  const [retournee, setRetournee] = useState(false);
  const attente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longue = useRef(false);

  const lacher = () => {
    if (attente.current) clearTimeout(attente.current);
    attente.current = null;
    setRetournee(false);
  };

  return (
    <article className={cn("group relative flex flex-col", className)}>
      <Link
        href={adresseFiche(produit.id)}
        draggable={false}
        className="flex flex-1 flex-col select-none [-webkit-touch-callout:none]"
        onPointerDown={(e) => {
          longue.current = false;
          if (e.pointerType === "mouse") return;
          attente.current = setTimeout(() => {
            longue.current = true;
            setRetournee(true);
          }, APPUI_LONG);
        }}
        onPointerUp={lacher}
        onPointerCancel={lacher}
        onPointerLeave={lacher}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          if (longue.current) e.preventDefault();
          longue.current = false;
        }}
      >
        <Tuile src={devant} sizes={sizes} priority={priority}>
          <Tuile
            src={dos}
            sizes={sizes}
            className={cn(
              "absolute inset-0 aspect-auto opacity-0 transition-opacity duration-200 group-hover:opacity-100",
              retournee && "opacity-100",
            )}
          />
        </Tuile>
        <span className="flex flex-1 flex-col px-3 pt-3 sm:px-1">
          {produit.badge && <span className="mono-label text-encre-3">{produit.badge}</span>}
          <span className="mt-1 text-ligne leading-snug font-bold">{produit.nom}</span>
          <span className="text-corps leading-snug text-encre-3">{produit.type}</span>
          <span className="text-corps leading-snug text-encre-3">{nombreCouleurs(produit.coloris.length)}</span>
          <span className="mt-auto pt-2 text-ligne font-bold tabular-nums">{prix(produit.euros)}</span>
        </span>
      </Link>
      <Coeur id={produit.id} nom={produit.nom} className="absolute top-0 right-0" />
    </article>
  );
}
