// La tuile d'une pièce : un carré gris très clair, le même dans les deux
// modes (un îlot clair, comme le papier d'une carte), où la vue à plat se
// pose sans cadre ni ombre. Les fichiers à plat sont sur blanc pur :
// multipliés sur le gris, leur blanc disparaît et le vêtement reste seul.
// `cadre` change la proportion (la galerie de la fiche est en 4:5).

import Image from "next/image";
import { cn } from "@/lib/utils";

export const FOND_TUILE = "bg-[#ECECEA]";

export function Tuile({
  src,
  sizes,
  priority,
  className,
  imageClassName,
  children,
}: {
  src: string;
  sizes: string;
  priority?: boolean;
  /** La proportion et l'arrondi ; par défaut un carré aux bords à peine cassés. */
  className?: string;
  imageClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={cn("relative block aspect-square overflow-hidden rounded-[2px]", FOND_TUILE, className)}>
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        draggable={false}
        className={cn("object-contain mix-blend-multiply", imageClassName)}
      />
      {children}
    </span>
  );
}
