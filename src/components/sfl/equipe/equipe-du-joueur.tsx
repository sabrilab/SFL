"use client";

// L'équipe d'un joueur, sous son nom (Sabri, 24/10 : « quand on clique sur
// le profil d'un joueur, on peut voir, par exemple dans sa description ou
// quelque part, qu'il fait partie de telle équipe. Cette équipe a une page
// sur Bola ») : son écusson, le nom de l'équipe, son rôle et la ville. La
// toucher ouvre la page de l'équipe (/bola-team/[id]). Sur le profil d'un
// autre joueur (profil-joueur.tsx) et sur Ma carte. Rien sans équipe, ni
// pour une équipe en formation qu'on ne voit pas (hooks/use-equipes.ts).
// La carte du joueur, elle, ne change pas.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { useEquipeDe } from "@/hooks/use-equipes";
import type { Role } from "@/lib/sfl/equipes";
import { cn } from "@/lib/utils";

export const NOM_ROLE: Record<Role, string> = { capitaine: "Capitaine", vice: "Vice-capitaine", membre: "Joueur" };

export function EquipeDuJoueur({ nom, className }: { nom: string; className?: string }) {
  const sienne = useEquipeDe(nom);
  if (!sienne) return null;
  const { equipe: e, membre } = sienne;
  return (
    <Link
      href={`/bola-team/${e.id}`}
      className={cn(
        "glass flex max-w-full items-center gap-[var(--fib-8)] rounded-full py-[5px] pr-3 pl-[5px] text-left transition-transform active:scale-[0.97]",
        className
      )}
    >
      <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={36} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] leading-tight font-bold tracking-tight">{e.nom}</span>
        <span className="mono-label truncate text-[9px] text-foreground/45">
          {[NOM_ROLE[membre.role], e.ville].filter(Boolean).join(" · ")}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-foreground/35" strokeWidth={2.4} />
    </Link>
  );
}
