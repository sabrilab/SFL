"use client";

// L'en-tête d'un club (Bola Club, bola-app#14 : « écusson du club en
// haut »), le même sous ses trois onglets : l'écusson et le nom du club, qui
// déroulent les ligues comme le sigle des Actus (choix-ligue.tsx : SFL,
// Bola, le club) ; à droite, selon le point de vue, le rond de l'admin
// (« Gérer le club ») ou celui de l'entraîneur (« Catégories »), et pour un
// joueur sa carte (pour un parent, celle de son enfant), qui mène à sa
// fiche : sa carte et son évolution ; dessous,
// les onglets de verre des Actus : Actus, Effectif, Classements ; puis le
// rail des catégories, collé en haut. Un parent lit le nom de son enfant
// sous l'en-tête. Les couleurs du club ne vivent que sur l'écusson : tout le
// reste est noir et blanc, clair comme sombre.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Layers, Settings } from "lucide-react";
import { LigneClubDuMenu, SigleLigue } from "@/components/sfl/choix-ligue";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { useClub } from "@/hooks/use-club";
import { fondDe } from "@/lib/sfl/blason";
import { nomComplet } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CarteClub } from "./carte-club";
import { RailCategories } from "./rail-categories";

export type OngletClub = "actus" | "effectif" | "classements";

const ONGLETS: { id: OngletClub; label: string; href: string }[] = [
  { id: "actus", label: "Actus", href: "/club" },
  { id: "effectif", label: "Effectif", href: "/club/effectif" },
  { id: "classements", label: "Classements", href: "/club/classements" },
];

const LIGUES = [
  { href: "/ligue", ligue: "sfl" },
  { href: "/ligue-vierge", ligue: "bola" },
] as const;

function MenuDuClub() {
  const { club } = useClub();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("pointerdown", fermer);
    return () => document.removeEventListener("pointerdown", fermer);
  }, [ouvert]);
  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className="flex max-w-full items-center gap-2.5 py-0.5 text-foreground"
      >
        {/* Le nom suit : l'écusson ne le répète pas au lecteur d'écran. */}
        <span aria-hidden className="grid shrink-0">
          <Ecusson initiales={club.initiales} fond={fondDe(club.blason)} blason={club.blason} taille={40} />
        </span>
        <span className="titre-lettrage truncate text-[22px] leading-none">{club.nom}</span>
        <ChevronDown className={cn("size-[18px] shrink-0 opacity-50 transition-transform", ouvert && "rotate-180")} />
      </button>
      {ouvert && (
        <nav
          role="menu"
          aria-label="Ligue"
          className="absolute top-full left-0 z-50 mt-2 flex min-w-[200px] flex-col rounded-[20px] border border-foreground/10 bg-popover/95 p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          {LIGUES.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              role="menuitem"
              onClick={() => setOuvert(false)}
              className="flex h-12 items-center rounded-[14px] px-3.5 text-encre-2 transition-colors"
            >
              <SigleLigue ligue={l.ligue} hauteur={16} />
            </Link>
          ))}
          <LigneClubDuMenu club={club} actif onClick={() => setOuvert(false)} />
        </nav>
      )}
    </div>
  );
}

/** Le haut d'un onglet du club, et son contenu sous le rail des catégories. */
export function PageClub({ onglet, children }: { onglet: OngletClub; children: React.ReactNode }) {
  const { club, role, droits } = useClub();
  const cat = useSearchParams().get("cat");
  const enfant = role === "parent" ? droits.joueur : null;
  return (
    <div className="mx-auto flex w-full max-w-[470px] flex-col gap-6 pt-2 pb-8">
      <header className="flex flex-col gap-4">
        <h1 className="sr-only">{club.nom}</h1>
        <div className="flex items-center justify-between gap-3 px-5">
          <MenuDuClub />
          {droits.administre ? (
            <Link href="/club/admin" aria-label="Gérer le club" className="bouton-secondaire grid size-11 shrink-0 place-items-center">
              <Settings className="size-[18px]" strokeWidth={2.2} />
            </Link>
          ) : role === "entraineur" ? (
            <Link href="/club/categories" aria-label="Catégories" className="bouton-secondaire grid size-11 shrink-0 place-items-center">
              <Layers className="size-[18px]" strokeWidth={2.2} />
            </Link>
          ) : droits.joueur ? (
            <Link
              href={`/club/joueur/${droits.joueur.id}`}
              aria-label={role === "parent" ? `La carte de ${nomComplet(droits.joueur)}` : "Ma carte"}
              className="shrink-0 transition-transform active:scale-95"
            >
              <CarteClub id={droits.joueur.id} format="petite" inerte />
            </Link>
          ) : null}
        </div>
        {enfant && <span className="mono-label px-5 text-encre-3">Parent de {nomComplet(enfant)}</span>}
        <nav aria-label="Vue" className="glass mx-5 flex gap-1 rounded-full p-1">
          {ONGLETS.map((o) => (
            <Link
              key={o.id}
              href={cat ? `${o.href}?cat=${encodeURIComponent(cat)}` : o.href}
              replace
              scroll={false}
              aria-current={onglet === o.id ? "page" : undefined}
              className={cn(
                "flex-1 px-3 py-2 text-center text-corps font-semibold whitespace-nowrap",
                onglet === o.id ? "bouton-principal" : "bouton-discret text-muted-foreground",
              )}
            >
              {o.label}
            </Link>
          ))}
        </nav>
      </header>
      <RailCategories />
      {children}
    </div>
  );
}
