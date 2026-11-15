// Une section repliable : un <details> natif (clavier et lecteur d'écran
// sans une ligne de code), son titre, un chevron qui tourne, un filet
// au-dessus. Les sections des filtres (ouvertes) et celles de la fiche
// (Description ouverte, les autres fermées). Le chevron ne tourne pas avec
// « Réduire les animations » (règle globale de globals.css).

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Accordeon({
  titre,
  ouvert,
  className,
  children,
}: {
  titre: string;
  ouvert?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details open={ouvert} className={cn("group border-t border-contraste/8", className)}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-lecture font-bold select-none [&::-webkit-details-marker]:hidden">
        {titre}
        <ChevronDown className="size-5 shrink-0 text-encre-3 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}
