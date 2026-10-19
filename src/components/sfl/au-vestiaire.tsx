"use client";

// « Au Vestiaire » — partager ce qu'on regarde dans la discussion de la
// ligue, en un geste : le Vestiaire s'ouvre, la pièce attend dans la barre
// d'écriture, il ne reste qu'à ajouter de quoi chambrer.
//   · AuVestiaire        : le bouton en toutes lettres (classements, feuilles) ;
//   · AuVestiaireRond    : le bouton rond, en coin de chaque rubrique de la
//                          Ligue (À l'honneur, la course, le récap…). Sabri,
//                          19/10 : partager les éléments de la Ligue fait
//                          venir les joueurs ; ceux que l'élément met en avant
//                          sont prévenus (lib/sfl/pieces-joueurs.ts).

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { preparerPiece, type Piece } from "@/lib/sfl/vestiaire";
import { cn } from "@/lib/utils";

function usePartager(piece: Piece) {
  const router = useRouter();
  return (e: React.MouseEvent) => {
    e.stopPropagation();
    preparerPiece(piece);
    router.push("/vestiaire");
  };
}

export function AuVestiaire({ piece, className }: { piece: Piece; className?: string }) {
  const partager = usePartager(piece);
  return (
    <button
      type="button"
      onClick={partager}
      className={cn(
        "glass-soft flex items-center justify-center gap-1.5 rounded-full px-4 py-3 text-[14px] font-semibold transition-transform active:scale-[0.98]",
        className
      )}
    >
      <MessageCircle className="size-4" />
      Au Vestiaire
    </button>
  );
}

export function AuVestiaireRond({ piece, className }: { piece: Piece; className?: string }) {
  const partager = usePartager(piece);
  return (
    <button
      type="button"
      onClick={partager}
      aria-label="Partager au Vestiaire"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-transform active:scale-90",
        className
      )}
    >
      <MessageCircle className="size-4" />
    </button>
  );
}
