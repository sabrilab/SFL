"use client";

// L'en-tête des ligues. Sabri, 24/10 : « il n'y a qu'une seule ligue Bola,
// et on pourra filtrer soit si on parle de nous (un joueur et sa place dans
// la ligue Bola), soit avec le mode team ». Le sigle de la ligue où l'on
// est, qui déroule l'autre (trois côte à côte, c'était « trop complexe »,
// 22/10) :
//   · SFL — la ligue privée du dimanche, avec sa saison (/ligue) ;
//   · Bola — la ligue globale, et dedans, à droite du sigle, le filtre
//     Joueurs / Équipes : le classement à vie des matchs que les joueurs
//     ouvrent eux-mêmes (/ligue-vierge), ou les équipes, leur championnat
//     et leurs défis (/bola-team). On est dans la ligue Bola en joueur, en
//     équipe, ou les deux ; plus de logo « Bola Team » à part (« la
//     pertinence du logo, je sais pas si c'est pertinent »).
// Les badges sont les logos (public/bola/sfl.svg, logo-blanc.svg), teintés
// comme le texte par un masque : pleins quand on y est, effacés sinon. Le
// sigle SFL (tools/sigle-sfl.ts, 23/10) a les métriques du logo BOLA : à
// hauteur égale, les lettres de SFL et de BOLA ont la même taille.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";
import { cn } from "@/lib/utils";
import { useHorsSfl } from "@/hooks/use-hors-sfl";

type Actif = "/ligue" | "/ligue-vierge" | "/bola-team";

const BADGES = [
  { href: "/ligue", libelle: "SFL", src: "/bola/sfl.svg", l: 54.4 },
  { href: "/ligue-vierge", libelle: "Bola", src: "/bola/logo-blanc.svg", l: 74 },
] as const;
// l : la largeur pour 18 px de haut. BOLA (1000 × 237) tient dans 74, donc à
// 97,4 % de sa hauteur ; SFL (735 × 237) y est réduit d'autant : 54,4.

/** Dans la ligue Bola : soi (Joueurs) ou son équipe (Équipes). */
function FiltreBola({ actif }: { actif: Actif }) {
  const vues = [
    { href: "/ligue-vierge", label: "Joueurs" },
    { href: "/bola-team", label: "Équipes" },
  ] as const;
  return (
    <nav aria-label="Filtre" className="glass flex gap-0.5 rounded-full p-1">
      {vues.map((v) => (
        <Link
          key={v.href}
          href={v.href}
          aria-current={actif === v.href ? "page" : undefined}
          className={cn(
            "px-3 py-1.5 text-corps font-semibold whitespace-nowrap",
            actif === v.href ? "bouton-principal" : "bouton-discret text-muted-foreground"
          )}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * L'en-tête des ligues : le logo de la ligue où l'on est, en grand ; le
 * toucher déroule l'autre. Dans Bola, le filtre Joueurs / Équipes à sa
 * droite. La loupe à droite ; `children` se pose juste avant elle (le choix
 * de la saison, dans les Actus).
 */
export function EnteteLigue({ actif, className, children }: { actif: Actif; className?: string; children?: React.ReactNode }) {
  const liens = [
    { href: "/ligue", ligue: "sfl" },
    { href: "/ligue-vierge", ligue: "bola" },
  ] as const;
  const [ouvert, setOuvert] = useState(false);
  const ici = actif === "/ligue" ? liens[0] : liens[1];
  // Un joueur Bola, hors de la SFL (hooks/use-hors-sfl.ts) : le seul sigle
  // de Bola, sans l'autre ligue à dérouler.
  const horsSfl = useHorsSfl();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("pointerdown", fermer);
    return () => document.removeEventListener("pointerdown", fermer);
  }, [ouvert]);
  return (
    <div className={cn("flex items-center justify-between", className)}>
      {horsSfl ? (
        <span className="flex items-center py-1.5 text-foreground">
          <SigleLigue ligue="bola" hauteur={22} />
        </span>
      ) : (
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={ouvert}
          onClick={() => setOuvert((o) => !o)}
          className="flex items-center gap-2 py-1.5 text-foreground"
        >
          <SigleLigue ligue={ici.ligue} hauteur={22} />
          <ChevronDown className={cn("size-[18px] opacity-50 transition-transform", ouvert && "rotate-180")} />
        </button>
        {ouvert && (
          <nav
            role="menu"
            aria-label="Ligue"
            className="absolute top-full left-0 z-50 mt-2 flex min-w-[200px] flex-col rounded-[20px] border border-foreground/10 bg-popover/95 p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            {liens.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                role="menuitem"
                aria-current={ici.href === l.href ? "page" : undefined}
                onClick={() => setOuvert(false)}
                className={cn(
                  "flex h-12 items-center rounded-[14px] px-3.5 transition-colors",
                  ici.href === l.href ? "bg-foreground/[0.08] text-foreground" : "text-encre-2"
                )}
              >
                <SigleLigue ligue={l.ligue} hauteur={16} />
              </Link>
            ))}
          </nav>
        )}
      </div>
      )}
      <div className="flex items-center gap-2">
        {ici.ligue === "bola" && <FiltreBola actif={actif} />}
        {children}
        <BoutonRecherche className="size-10" />
      </div>
    </div>
  );
}

/** Le sigle de la ligue d'un match (Map, fiche, ouverture d'un match) : le
 *  logo SFL ou Bola, à la couleur du texte ; Team, c'est « Bola Team » : le
 *  logo Bola suivi de TEAM (Sabri, 22/10). */
export function SigleLigue({ ligue, hauteur = 12, className }: { ligue: "sfl" | "bola" | "team"; hauteur?: number; className?: string }) {
  if (ligue === "team")
    return (
      <span role="img" aria-label="Bola Team" className={cn("inline-flex shrink-0 items-center", className)} style={{ gap: hauteur * 0.3 }}>
        <SigleLigue ligue="bola" hauteur={hauteur} />
        <span aria-hidden className="font-sans font-black tracking-[0.04em] uppercase italic" style={{ fontSize: hauteur * 0.95, lineHeight: `${hauteur}px` }}>
          Team
        </span>
      </span>
    );
  const b = BADGES[ligue === "sfl" ? 0 : 1];
  return (
    <span
      role="img"
      aria-label={b.libelle}
      className={cn("inline-block shrink-0 bg-current align-middle", className)}
      style={{ height: hauteur, width: (b.l / 18) * hauteur, mask: `url(${b.src}) center / contain no-repeat`, WebkitMask: `url(${b.src}) center / contain no-repeat` }}
    />
  );
}
