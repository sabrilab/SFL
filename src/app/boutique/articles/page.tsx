"use client";

// La grille de la boutique : un rayon (Maillots, Vestiaire, Survêts,
// Fondateurs, Tout, Favoris), ses articles, de quoi les filtrer et les trier.
//
//   · l'en-tête : retour, le nom du rayon, les favoris, les Ballons ; dessous
//     le nombre d'articles montrés ;
//   · une barre qui reste collée en haut sur téléphone : « Filtrer » à gauche (avec le
//     nombre de filtres actifs), « Trier » à droite ;
//   · téléphone : « Filtrer » ouvre une feuille plein écran, avec les quatre
//     sections (components/boutique/filtres.tsx) et, collés en bas, « Tout
//     effacer » (dès qu'un filtre est actif) et le bouton « Voir les N
//     articles », dont le compte suit chaque case ;
//   · ordinateur (≥ 1024) : les filtres sont un panneau à gauche, qu'on
//     masque (« Masquer les filtres ») pour donner toute la largeur à la grille ;
//   · la grille : deux colonnes bord à bord sur téléphone, trois dès 768 px.
//
// Le rayon, les filtres et le tri vivent dans l'adresse (lib/boutique/
// catalogue.ts) : un lien se partage tel quel, et le retour depuis une fiche
// retrouve la grille comme on l'a laissée. Chaque case remplace l'adresse
// sans défiler ni empiler d'historique.

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { CarteProduit } from "@/components/boutique/carte-produit";
import { EnTeteBoutique } from "@/components/boutique/en-tete";
import { Filtres } from "@/components/boutique/filtres";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useFavorisBoutique } from "@/hooks/use-favoris-boutique";
import {
  SANS_FILTRE,
  TRIS,
  colorisMontre,
  ecrireRecherche,
  filtrer,
  lireRecherche,
  nombreArticles,
  nombreDeFiltres,
  titreDuRayon,
  trier,
  voirLesArticles,
  type Recherche,
  type Tri,
} from "@/lib/boutique/catalogue";
import { PRODUITS } from "@/lib/boutique/produits";
import { cn } from "@/lib/utils";

export default function Articles() {
  // useSearchParams impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={null}>
      <Grille />
    </Suspense>
  );
}

function Grille() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const favoris = useFavorisBoutique();
  const recherche = useMemo(() => lireRecherche(new URLSearchParams(params.toString())), [params]);
  const { rayon, filtres, tri } = recherche;
  const [feuille, setFeuille] = useState(false);
  const [panneau, setPanneau] = useState(true);

  const liste = useMemo(
    () => trier(filtrer(PRODUITS, rayon, filtres, favoris), tri),
    [rayon, filtres, tri, favoris],
  );
  const actifs = nombreDeFiltres(filtres);

  const aller = (suite: Partial<Recherche>) => {
    const q = ecrireRecherche({ ...recherche, ...suite });
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  const effacer = () => aller({ filtres: SANS_FILTRE });

  return (
    <div className="shell flex flex-col py-4 sm:py-8">
      {/* Au-dessus de la barre collée : sa rallonge sous l'encoche ne le couvre pas. */}
      <div className="relative z-30 flex flex-col gap-2 pb-3">
        <EnTeteBoutique titre={titreDuRayon(rayon)} />
        {/* Rien à compter : « Aucun article » le dit plus bas, la ligne garde sa place. */}
        <p className={cn("text-corps text-encre-3 tabular-nums", liste.length === 0 && "invisible")}>{nombreArticles(liste.length)}</p>
      </div>

      {/* Collée sous l'encoche de l'iPhone ; sa rallonge (before) couvre l'encoche du même fond. */}
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-5 flex h-13 items-center justify-between border-b border-contraste/8 bg-background px-5 before:absolute before:inset-x-0 before:bottom-full before:h-[env(safe-area-inset-top,0px)] before:bg-background lg:static lg:mx-0 lg:bg-transparent lg:px-0">
        <button
          type="button"
          onClick={() => setFeuille(true)}
          className="-ml-1 flex h-11 items-center gap-2 px-1 text-ligne font-semibold lg:hidden"
        >
          <SlidersHorizontal className="size-4" />
          {actifs ? `Filtrer (${actifs})` : "Filtrer"}
        </button>
        <button
          type="button"
          onClick={() => setPanneau((v) => !v)}
          aria-expanded={panneau}
          className="hidden h-11 items-center gap-2 text-ligne font-semibold lg:flex"
        >
          <SlidersHorizontal className="size-4" />
          {panneau ? "Masquer les filtres" : "Afficher les filtres"}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger className="-mr-1 flex h-11 items-center gap-1.5 px-1 text-ligne font-semibold outline-none">
            Trier
            <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-[14px] p-1.5">
            <DropdownMenuRadioGroup value={tri} onValueChange={(v) => aller({ tri: v as Tri })}>
              {TRIS.map((t) => (
                <DropdownMenuRadioItem key={t.id} value={t.id} className="min-h-11 rounded-[10px] pl-3 text-ligne font-medium">
                  {t.titre}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-start gap-8 pt-0.5 sm:pt-4 lg:pt-6">
        {panneau && (
          <aside className="sticky top-8 hidden w-60 shrink-0 lg:block">
            {actifs > 0 && (
              <button type="button" onClick={effacer} className="mb-3 text-corps font-semibold underline underline-offset-4">
                Tout effacer
              </button>
            )}
            <Filtres filtres={filtres} onChange={(f) => aller({ filtres: f })} />
          </aside>
        )}

        {liste.length > 0 ? (
          <div className="-mx-5 grid min-w-0 flex-1 grid-cols-2 gap-x-0.5 gap-y-6 sm:mx-0 sm:gap-x-3 md:grid-cols-3">
            {liste.map((p, i) => (
              <CarteProduit
                key={p.id}
                produit={p}
                coloris={colorisMontre(p, filtres)}
                priority={i < 4}
                sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 320px"
              />
            ))}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-3 py-24 text-center">
            <p className="text-titre font-bold">{rayon === "favoris" && !actifs ? "Aucun favori" : "Aucun article"}</p>
            {actifs > 0 && (
              <button type="button" onClick={effacer} className="text-lecture font-semibold underline underline-offset-4">
                Tout effacer
              </button>
            )}
          </div>
        )}
      </div>

      <Sheet open={feuille} onOpenChange={setFeuille} titre="les filtres">
        <SheetContent side="bottom" className="gap-0 overflow-y-auto rounded-none data-[side=bottom]:h-dvh data-[side=bottom]:border-t-0 lg:hidden">
          {/* Sur la rangée de la croix (ui/sheet.tsx la pose 16 px plus bas que le contenu). */}
          <div className="mt-4 flex h-14 shrink-0 items-center px-5">
            <SheetTitle className="titre-lettrage text-titre-m leading-none font-black">Filtrer</SheetTitle>
          </div>
          <Filtres filtres={filtres} onChange={(f) => aller({ filtres: f })} className="mx-5" />
          <div className="sticky bottom-0 mt-auto flex gap-2.5 bg-popover px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
            {actifs > 0 && (
              <button type="button" onClick={effacer} className="bouton-secondaire shrink-0 px-5 py-4 text-lecture font-bold">
                Tout effacer
              </button>
            )}
            <button
              type="button"
              disabled={liste.length === 0}
              onClick={() => setFeuille(false)}
              className={cn("bouton-principal min-w-0 flex-1 py-4 text-lecture font-bold", liste.length === 0 && "opacity-40")}
            >
              {voirLesArticles(liste.length)}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
