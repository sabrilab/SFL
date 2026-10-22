// La loupe, en haut des écrans : la Recherche (joueurs, matchs, terrains),
// qui était la pastille ronde de la barre d'onglets jusqu'au 19/10. Sabri :
// « la loupe, elle doit être en haut, pas en bas » ; sa place en bas est au
// Vestiaire. Sur la Map, la loupe est dans la colonne de boutons du plan
// (map/page.tsx), à son style.

import Link from "next/link";
import { RechercheIcon } from "./nav-icons";
import { cn } from "@/lib/utils";

export function BoutonRecherche({ className }: { className?: string }) {
  return (
    <Link
      href="/recherche"
      aria-label="Recherche"
      className={cn("bouton-secondaire flex size-11 shrink-0 items-center justify-center", className)}
    >
      <span className="scale-[0.82]">
        <RechercheIcon />
      </span>
    </Link>
  );
}
