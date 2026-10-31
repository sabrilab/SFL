"use client";

// « Écrire » : un message privé à ce joueur (/messages/<lui>), à côté de
// « Suivre », comme « Message » sur Instagram. Sur son profil, en pilule ;
// sur sa carte touchée (card-viewer.tsx), en rond, sur le verre clair. Ni
// sur ma propre carte, ni pour un joueur sans compte accepté (on ne peut pas
// lui écrire). Ouvert depuis une feuille, il la ferme en partant.

import Link from "next/link";
import { Send } from "lucide-react";
import { useFenetre } from "@/components/ui/sheet";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { idDe } from "@/lib/sfl/comptes";
import { cn } from "@/lib/utils";

export function BoutonEcrire({ nom, rond = false, className }: { nom: string; rond?: boolean; className?: string }) {
  const { me } = useMyPlayer();
  const fenetre = useFenetre();
  const id = idDe(nom);
  if (!me || nom === me || !id) return null;
  return (
    <Link
      href={`/messages/${id}`}
      onClick={(e) => {
        e.stopPropagation();
        fenetre?.fermer();
      }}
      aria-label={rond ? "Écrire" : undefined}
      className={cn(
        "flex shrink-0 items-center justify-center gap-1.5 font-semibold whitespace-nowrap",
        rond ? "bouton-givre size-11" : "bouton-secondaire h-10 px-6 text-ligne",
        className
      )}
    >
      <Send className={cn(rond ? "size-[18px]" : "size-4", "-translate-x-px translate-y-px")} strokeWidth={2.2} />
      {!rond && "Écrire"}
    </Link>
  );
}
