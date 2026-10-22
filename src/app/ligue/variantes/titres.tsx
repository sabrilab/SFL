"use client";

// Les en-têtes à l'essai pour l'onglet League (Sabri, 22/10 : « le sigle SFL
// ou Bola, est-ce que ça remplace le mot ligue ou ça vient en bas ? »).
//   a · l'actuel (ChoixLigue) : League | Team, les badges dessous ;
//   b · le badge remplace le mot : le logo de la ligue en grand à côté de
//       « Team », un chevron pour passer de l'une à l'autre ;
//   c · le mot reste, et la ligue se choisit dans une pilule [SFL | Bola]
//       collée à sa droite.

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type Ligue = "sfl" | "bola";

const LOGOS = {
  sfl: { libelle: "SFL", src: "/bola/sfl.svg", ratio: 70 / 18 },
  bola: { libelle: "Bola", src: "/bola/logo-blanc.svg", ratio: 74 / 18 },
} as const;

function Logo({ ligue, h }: { ligue: Ligue; h: number }) {
  const { src, libelle, ratio } = LOGOS[ligue];
  return (
    <span
      role="img"
      aria-label={libelle}
      className="block shrink-0 bg-current"
      style={{ height: h, width: Math.round(h * ratio), mask: `url(${src}) center / contain no-repeat`, WebkitMask: `url(${src}) center / contain no-repeat` }}
    />
  );
}

const MOT = "text-[28px] leading-none font-bold tracking-tight whitespace-nowrap";

/** b · le logo de la ligue tient la place du mot. */
export function TitreLogo({ ligue, onLigue }: { ligue: Ligue; onLigue: (l: Ligue) => void }) {
  const autre: Ligue = ligue === "sfl" ? "bola" : "sfl";
  return (
    <nav aria-label="League ou Team" className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onLigue(autre)}
        aria-label={`Passer à ${LOGOS[autre].libelle}`}
        className="flex items-center gap-1.5 text-foreground"
      >
        <Logo ligue={ligue} h={24} />
        <ChevronDown className="size-[18px] opacity-50" strokeWidth={2.5} />
      </button>
      <Link href="/bola-team" className={cn(MOT, "text-foreground/30")}>
        Team
      </Link>
    </nav>
  );
}

/** c · le mot League, la pilule de la ligue à sa droite. */
export function TitrePilule({ ligue, onLigue }: { ligue: Ligue; onLigue: (l: Ligue) => void }) {
  return (
    <nav aria-label="League ou Team" className="flex items-center gap-3">
      <span className={cn(MOT, "text-foreground")}>League</span>
      <div role="tablist" aria-label="SFL ou Bola" className="glass flex items-center rounded-full p-[3px]">
        {(["sfl", "bola"] as const).map((l) => (
          <button
            key={l}
            role="tab"
            type="button"
            aria-selected={ligue === l}
            onClick={() => onLigue(l)}
            className={cn(
              "rounded-full px-2.5 py-[7px] transition-colors",
              ligue === l ? "bg-foreground text-background" : "text-foreground/45"
            )}
          >
            <Logo ligue={l} h={12} />
          </button>
        ))}
      </div>
      <Link href="/bola-team" className={cn(MOT, "ml-1 text-foreground/30")}>
        Team
      </Link>
    </nav>
  );
}
