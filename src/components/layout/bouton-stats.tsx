"use client";

// Les stats, en haut des écrans, pour les admins seulement : la page
// Activité & rétention (/admin/activite). Sabri, le 22/10 : « des fois, je
// veux juste aller voir ça sur l'application, et c'est pas assez visible
// quand je suis admin ». Elle n'était qu'au fond des Réglages ; la voici à
// côté de la loupe sur Ma carte et la Ligue, et dans la colonne de boutons
// de la Map (map/page.tsx, à son style). Un joueur ne la voit jamais.

import Link from "next/link";
import { ChartSpline } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

export function BoutonStats({ className }: { className?: string }) {
  const session = useSession();
  if (!session?.admin) return null;
  return (
    <Link
      href="/admin/activite"
      aria-label="Activité et rétention"
      className={cn("glass flex size-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95", className)}
    >
      <ChartSpline className="size-[19px]" strokeWidth={2.1} />
    </Link>
  );
}
