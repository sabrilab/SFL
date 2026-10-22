"use client";

// Les deux fils de l'onglet Actus, côte à côte (Sabri, 22/10) : les Actus de
// la SFL, la ligue du dimanche avec sa saison, et la Ligue vierge, qui compte
// à vie les matchs Bola que les joueurs ouvrent eux-mêmes (app/ligue-vierge).

import Link from "next/link";
import { cn } from "@/lib/utils";

const LIGUES = [
  { href: "/ligue", libelle: "Actus" },
  { href: "/ligue-vierge", libelle: "Ligue vierge" },
] as const;

export function ChoixLigue({ actif, className }: { actif: "/ligue" | "/ligue-vierge"; className?: string }) {
  return (
    <nav aria-label="Actus ou Ligue vierge" className={cn("flex items-baseline gap-4", className)}>
      {LIGUES.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={actif === l.href ? "page" : undefined}
          className={cn(
            "text-[28px] leading-none font-bold tracking-tight whitespace-nowrap transition-colors",
            actif === l.href ? "text-foreground" : "text-foreground/30"
          )}
        >
          {l.libelle}
        </Link>
      ))}
    </nav>
  );
}
