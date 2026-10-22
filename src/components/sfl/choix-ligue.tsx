"use client";

// Les trois façons de jouer, côte à côte en tête de l'onglet Actus (Sabri,
// 22/10, « en gros League et Team ») : League, le fil de la SFL, la ligue du
// dimanche avec sa saison ; Bola, le classement à vie des matchs que les
// joueurs ouvrent eux-mêmes (app/ligue-vierge, l'ancienne « Ligue vierge ») ;
// Team, les matchs d'équipe (app/bola-team).

import Link from "next/link";
import { cn } from "@/lib/utils";

const LIGUES = [
  { href: "/ligue", libelle: "League" },
  { href: "/ligue-vierge", libelle: "Bola" },
  { href: "/bola-team", libelle: "Team" },
] as const;

export function ChoixLigue({ actif, className }: { actif: (typeof LIGUES)[number]["href"]; className?: string }) {
  return (
    <nav aria-label="League, Bola ou Team" className={cn("flex items-baseline gap-3.5", className)}>
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
