"use client";

// L'en-tête des façons de jouer (Sabri, 22/10) : deux onglets, League et
// Team. Sous League, le choix de la ligue se fait par son badge :
//   · SFL — la ligue privée du dimanche, avec sa saison (/ligue) ;
//   · Bola — la ligue globale, le classement à vie des matchs que les
//     joueurs ouvrent eux-mêmes (/ligue-vierge) ; régions et mondial plus tard.
// Team, les équipes et leurs défis (/bola-team).
// Les badges sont les logos (public/bola/sfl.svg, logo-blanc.svg), teintés
// comme le texte par un masque : pleins quand on y est, effacés sinon.

import Link from "next/link";
import { cn } from "@/lib/utils";

type Actif = "/ligue" | "/ligue-vierge" | "/bola-team";

const BADGES = [
  { href: "/ligue", libelle: "SFL", src: "/bola/sfl.svg", l: 70 },
  { href: "/ligue-vierge", libelle: "Bola", src: "/bola/logo-blanc.svg", l: 74 },
] as const;

function Badge({ src, libelle, l }: { src: string; libelle: string; l: number }) {
  return (
    <span
      role="img"
      aria-label={libelle}
      className="block h-[18px] bg-current"
      style={{ width: l, mask: `url(${src}) center / contain no-repeat`, WebkitMask: `url(${src}) center / contain no-repeat` }}
    />
  );
}

export function ChoixLigue({ actif, className }: { actif: Actif; className?: string }) {
  const league = actif !== "/bola-team";
  const onglet = (on: boolean) =>
    cn("text-[28px] leading-none font-bold tracking-tight whitespace-nowrap transition-colors", on ? "text-foreground" : "text-foreground/30");
  return (
    <nav aria-label="League ou Team" className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline gap-3.5">
        <Link href="/ligue" aria-current={league ? "page" : undefined} className={onglet(league)}>
          League
        </Link>
        <Link href="/bola-team" aria-current={!league ? "page" : undefined} className={onglet(!league)}>
          Team
        </Link>
      </div>
      {league && (
        <div className="flex items-center gap-5" aria-label="SFL ou Bola">
          {BADGES.map((b) => (
            <Link
              key={b.href}
              href={b.href}
              aria-current={actif === b.href ? "page" : undefined}
              className={cn("py-1 transition-colors", actif === b.href ? "text-foreground" : "text-foreground/30")}
            >
              <Badge src={b.src} libelle={b.libelle} l={b.l} />
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
