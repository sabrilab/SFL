"use client";

// Les époques des Actus : le présent ou le passé (Sabri, 24/10 : le Wall of
// Fame « dans la section Actu, mais il faudrait une fonctionnalité qui puisse
// gérer les types de données qu'on veut voir, soit dans le passé ou dans le
// présent »). Un seul bouton, à côté de la loupe, dit la saison qu'on lit et
// déroule les autres (Sabri, 24/10 : « saison 0, 1 et wall of fame, ça fait
// 3 boutons […] Faut réduire ça ») ; le reste de la page suit, avec les mêmes
// onglets à chaque époque (Pépite d'Or, Classement, Match ; course.tsx) :
//   · la saison en cours (/ligue) : la course et le fil, comme avant ;
//   · une saison close (/saisons/N) : son classement final en cartes, son
//     palmarès, ses matchs, et chacun de ses dimanches avec son terrain et
//     ses rubriques, relus dans l'archive ;
//   · le Wall of Fame (/palmares) : toutes les saisons, les légendes de
//     carrière et ton parcours.
// Chaque époque garde son adresse : les anciens liens (le Wall of Fame, une
// saison) restent bons, et le journal d'activité compte toujours les
// ouvertures du Wall of Fame (/palmares).

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Crown } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { cn } from "@/lib/utils";

/** « present », le numéro d'une saison close, ou « palmares » (toutes les saisons). */
export type Epoque = "present" | "palmares" | number;

/** Les onglets d'une époque : la Pépite d'Or (la course et le fil), les classements, les matchs. */
export type Vue = "fil" | "classements" | "matchs";

export interface ChoixDEpoque {
  id: Epoque;
  href: string;
  label: string;
}

/** Les époques de la ligue : la saison en cours, les saisons closes (la plus récente d'abord), le Wall of Fame. */
export function useEpoques(): ChoixDEpoque[] {
  const { saison } = useSeason();
  const numero = saison.numero ?? 0;
  const archives = saison.archives;
  return useMemo(
    () => [
      { id: "present", href: "/ligue", label: `Saison ${numero}` },
      ...[...(archives ?? [])]
        .sort((a, b) => b.numero - a.numero)
        .map((a) => ({ id: a.numero, href: `/saisons/${a.numero}`, label: a.nom })),
      { id: "palmares", href: "/palmares", label: "Wall of Fame" },
    ],
    [numero, archives],
  );
}

/**
 * Le choix de l'époque : un bouton qui dit la saison lue (le Wall of Fame
 * dans l'or de la carrière) et déroule les autres, comme le sigle de la
 * ligue déroule les ligues. Changer de temps garde l'onglet : les
 * classements de la saison passée, puis ceux de toute la carrière ; le Wall
 * of Fame n'a pas de matchs, il s'ouvre alors sur sa Pépite d'Or.
 */
export function ChoixEpoque({
  epoque,
  epoques,
  vue = "fil",
  className,
}: {
  epoque: Epoque;
  epoques: ChoixDEpoque[];
  vue?: Vue;
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("pointerdown", fermer);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", fermer);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);
  const ici = epoques.find((e) => e.id === epoque) ?? epoques[0];
  const lien = (e: ChoixDEpoque) => {
    const v = e.id === "palmares" && vue === "matchs" ? "fil" : vue;
    return v === "fil" ? e.href : `${e.href}?vue=${v}`;
  };
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className={cn(
          "bouton-secondaire flex h-10 items-center gap-1.5 pr-3 pl-4 text-[14px] font-semibold whitespace-nowrap",
          ici.id === "palmares" && "bouton--or",
        )}
      >
        {ici.id === "palmares" && <Crown className="size-3.5" strokeWidth={2.4} />}
        {ici.label}
        <ChevronDown className={cn("size-4 opacity-60 transition-transform", ouvert && "rotate-180")} />
      </button>
      {ouvert && (
        <nav
          role="menu"
          aria-label="Saison"
          className="absolute top-full right-0 z-50 mt-2 flex min-w-[220px] flex-col rounded-[20px] border border-foreground/10 bg-popover/95 p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          {epoques.map((e) => (
            <Link
              key={String(e.id)}
              href={lien(e)}
              role="menuitem"
              aria-current={e.id === epoque ? "page" : undefined}
              onClick={() => {
                setOuvert(false);
                document.getElementById("app-scroll")?.scrollTo({ top: 0 });
              }}
              className={cn(
                "flex h-12 items-center justify-between gap-6 rounded-[14px] px-3.5 text-[15px] font-semibold transition-colors",
                e.id === epoque ? "bg-foreground/[0.08] text-foreground" : "text-foreground/60",
                // Le Wall of Fame, après un trait : le temps long, dans l'or de la carrière.
                e.id === "palmares" && "relative mt-2 text-[#5a3f06] before:absolute before:inset-x-3.5 before:-top-1 before:h-px before:bg-foreground/10 dark:text-[#f0d38a]",
              )}
            >
              <span className="flex items-center gap-2">
                {e.id === "palmares" && <Crown className="size-4" strokeWidth={2.4} />}
                {e.label}
              </span>
              {e.id === "present" && <span className="mono-label text-[10px] text-foreground/40">En cours</span>}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
