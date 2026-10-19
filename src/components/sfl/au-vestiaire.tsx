"use client";

// « Au Vestiaire » — partager ce qu'on regarde (un classement, une feuille de
// match) dans la discussion de la ligue, en un geste : la Ligue bascule sur le
// Vestiaire, la pièce attend dans la barre d'écriture, il ne reste qu'à
// ajouter de quoi chambrer.

import { useRouter, usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { preparerPiece, type Piece } from "@/lib/sfl/vestiaire";
import { cn } from "@/lib/utils";

export function AuVestiaire({ piece, className }: { piece: Piece; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        preparerPiece(piece);
        if (pathname !== "/ligue") router.push("/ligue?vue=vestiaire");
        document.getElementById("app-scroll")?.scrollTo({ top: 0 });
      }}
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
