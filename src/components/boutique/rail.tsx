// Une rangée qui défile au doigt, d'un cran à l'autre (scroll-snap), sans
// barre de défilement : le hero et les panneaux de l'accueil, la galerie et
// « Tu aimeras aussi » de la fiche. `overflow-x-auto` est aussi ce que le
// verrou d'iOS (pwa/viewport-lock.tsx) reconnaît pour laisser glisser.

import { cn } from "@/lib/utils";

export function Rail({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      {...props}
    />
  );
}
