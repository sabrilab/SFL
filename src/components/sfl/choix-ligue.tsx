"use client";

// Les deux ligues de l'onglet Ligue, côte à côte (Sabri, 22/10) : la SFL, la
// ligue du dimanche avec sa saison, et la Ligue vierge, qui compte à vie les
// matchs Bola que les joueurs ouvrent eux-mêmes (app/ligue-vierge).

import Link from "next/link";
import { cn } from "@/lib/utils";

const LIGUES = [
  { href: "/ligue", libelle: "SFL" },
  { href: "/ligue-vierge", libelle: "Ligue vierge" },
] as const;

export function ChoixLigue({ actif, className }: { actif: "/ligue" | "/ligue-vierge"; className?: string }) {
  return (
    <nav aria-label="Ligue" className={cn("flex gap-5 px-1", className)}>
      {LIGUES.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={actif === l.href ? "page" : undefined}
          className={cn(
            "text-[22px] font-bold tracking-tight transition-colors",
            actif === l.href ? "text-foreground" : "text-foreground/30"
          )}
        >
          {l.libelle}
        </Link>
      ))}
    </nav>
  );
}
