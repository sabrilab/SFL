"use client";

// L'en-tête des façons de jouer (Sabri, 22/10) : trois sigles côte à côte,
// SFL · Bola · Bola Team, le plein est la page où l'on est (il a gardé cet
// en-tête avec « La course », l'onglet Actus) :
//   · SFL — la ligue privée du dimanche, avec sa saison (/ligue) ;
//   · Bola — la ligue globale, le classement à vie des matchs que les
//     joueurs ouvrent eux-mêmes (/ligue-vierge) ; régions et mondial plus tard.
//   · Bola Team — les équipes et leurs défis (/bola-team).
// Les badges sont les logos (public/bola/sfl.svg, logo-blanc.svg), teintés
// comme le texte par un masque : pleins quand on y est, effacés sinon.

import Link from "next/link";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";
import { cn } from "@/lib/utils";

type Actif = "/ligue" | "/ligue-vierge" | "/bola-team";

const BADGES = [
  { href: "/ligue", libelle: "SFL", src: "/bola/sfl.svg", l: 70 },
  { href: "/ligue-vierge", libelle: "Bola", src: "/bola/logo-blanc.svg", l: 74 },
] as const;

/**
 * L'en-tête des trois onglets (Actus, Bola, Team) : les trois sigles, le
 * plein est la page où l'on est, et la loupe à droite.
 */
export function EnteteLigue({ actif, className }: { actif: Actif; className?: string }) {
  const liens = [
    { href: "/ligue", ligue: "sfl" },
    { href: "/ligue-vierge", ligue: "bola" },
    { href: "/bola-team", ligue: "team" },
  ] as const;
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <nav aria-label="Ligue" className="flex items-center gap-4">
        {liens.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={actif === l.href ? "page" : undefined}
            className={cn("py-1.5 transition-colors", actif === l.href ? "text-foreground" : "text-foreground/30")}
          >
            <SigleLigue ligue={l.ligue} hauteur={16} />
          </Link>
        ))}
      </nav>
      <BoutonRecherche className="size-10" />
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
