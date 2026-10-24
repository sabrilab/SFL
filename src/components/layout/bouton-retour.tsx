"use client";

// Le retour des pages enfants, en haut à gauche, comme dans une app iPhone :
// le rond de verre et son chevron, ceux du design system (le récap d'un
// dimanche, la discussion d'un match). Il ramène à la page de l'app d'où
// l'on vient, à l'endroit où on l'avait laissée (memoire-navigation.tsx) ;
// arrivé de dehors (une notification, un lien partagé, l'app rouverte sur
// cette page), il mène au parent de la page (lib/nav.ts, parentDe), sans
// laisser derrière lui une page où revenir.
//
// <BoutonRetour />                               le parent de lib/nav.ts
// <BoutonRetour parent="/ligue" titre="Actus" /> un parent donné
// <BoutonRetour onRetour={fermer} titre="…" />   un retour dans la page (une fiche ouverte)
//
// Dans une fenêtre (ui/sheet.tsx), chaque écran posé sur un autre le reçoit
// de même, avec onRetour : il ramène à l'écran d'avant. `givre` : sur un
// verre clair qui le reste dans les deux modes (la carte touchée), la nacre
// de la Map, comme la croix d'à côté.

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { parentDe, titreDe } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { pageDAvant, usePageDAvant } from "./memoire-navigation";

/** « Revenir à le match » s'écrit « Revenir au match » ; « à les », « aux ». */
function revenirA(nom: string) {
  if (/^les /i.test(nom)) return `Revenir aux ${nom.slice(4)}`;
  if (/^le /i.test(nom)) return `Revenir au ${nom.slice(3)}`;
  return `Revenir à ${nom}`;
}

export function BoutonRetour({
  parent,
  titre,
  onRetour,
  givre,
  className,
}: {
  parent?: string;
  /** Le nom du parent, pour le lecteur d'écran : « Revenir à Ma carte ». */
  titre?: string;
  onRetour?: () => void;
  givre?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const avant = usePageDAvant();
  const p = parent ? { href: parent, titre: titre ?? titreDe(parent) } : parentDe(pathname);
  const nom = (onRetour ? titre : avant !== null ? titreDe(avant) : p?.titre) ?? "la page d'avant";

  function retour() {
    if (onRetour) return onRetour();
    if (pageDAvant() !== null) router.back();
    else router.replace(p?.href ?? "/");
  }

  return (
    <button
      type="button"
      data-slot="retour"
      onClick={retour}
      aria-label={revenirA(nom)}
      className={cn(givre ? "bouton-givre size-10" : "bouton-secondaire size-11", "flex shrink-0 items-center justify-center", className)}
    >
      <ChevronLeft className="size-5" />
    </button>
  );
}
