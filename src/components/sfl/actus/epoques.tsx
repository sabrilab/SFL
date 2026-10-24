"use client";

// Les époques des Actus : le présent ou le passé (Sabri, 24/10 : le Wall of
// Fame « dans la section Actu, mais il faudrait une fonctionnalité qui puisse
// gérer les types de données qu'on veut voir, soit dans le passé ou dans le
// présent »). Une rangée en haut de l'onglet choisit le temps, le reste de la
// page suit, avec les mêmes gestes à chaque époque :
//   · la saison en cours (/ligue) : la course et le fil, comme avant ;
//   · une saison close (/saisons/N) : son podium, son classement final en
//     cartes, ses matchs, et chacun de ses dimanches avec son terrain et ses
//     rubriques, relus dans l'archive ;
//   · le Wall of Fame (/palmares) : toutes les saisons, les légendes de
//     carrière et ton parcours.
// Chaque époque garde son adresse : les anciens liens (le Wall of Fame, une
// saison) restent bons, et le journal d'activité compte toujours les
// ouvertures du Wall of Fame (/palmares).

import Link from "next/link";
import { useMemo } from "react";
import { Crown } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { cn } from "@/lib/utils";

/** « present », le numéro d'une saison close, ou « palmares » (toutes les saisons). */
export type Epoque = "present" | "palmares" | number;

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
 * La rangée des époques : une pilule par saison, puis le Wall of Fame, dans
 * l'or de la carrière. Au-delà de trois, la rangée défile. Depuis les
 * classements ou les matchs (`vue`), une autre saison s'ouvre sur la même vue.
 */
export function ChoixEpoque({
  epoque,
  epoques,
  vue = "fil",
  className,
}: {
  epoque: Epoque;
  epoques: ChoixDEpoque[];
  vue?: "fil" | "classements" | "matchs";
  className?: string;
}) {
  const remonter = () => document.getElementById("app-scroll")?.scrollTo({ top: 0 });
  return (
    <nav
      aria-label="Époque"
      className={cn(
        "glass flex gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:self-start",
        className,
      )}
    >
      {epoques.map((e) => {
        const ici = e.id === epoque;
        const fame = e.id === "palmares";
        return (
          <Link
            key={String(e.id)}
            href={vue !== "fil" && e.id !== "palmares" ? `${e.href}?vue=${vue}` : e.href}
            aria-current={ici ? "page" : undefined}
            onClick={remonter}
            className={cn(
              "flex flex-1 shrink-0 items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-semibold whitespace-nowrap md:flex-none md:px-5",
              ici ? "bouton-principal" : "bouton-discret",
              // Le Wall of Fame garde l'or de la carrière, même éteint.
              fame ? "bouton--or" : !ici && "text-muted-foreground",
            )}
          >
            {fame && <Crown className="size-3.5" strokeWidth={2.4} />}
            {e.label}
          </Link>
        );
      })}
    </nav>
  );
}
