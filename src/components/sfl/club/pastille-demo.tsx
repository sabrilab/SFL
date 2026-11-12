"use client";

// Bola Club est une démonstration : la pastille le dit en haut de chaque
// page de /club, du même dessin que « Essai de design » (ds/
// essai-design.tsx), mais dans la page : elle part avec elle quand on
// défile, sans passer sur le rail collé. Elle nomme le point de vue (« Démo · Entraîneur ») ; la
// toucher passe au suivant : Admin, Entraîneur, Joueur, Parent. Le choix est
// gardé sur le téléphone (lib/sfl/club/store.ts). ?role=admin|entraineur|
// joueur|parent fait de même (un lien direct, les captures). Elle pose aussi
// le marqueur de la première visite : à partir de là, le menu des ligues
// montre le club (choix-ligue.tsx).

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useClub } from "@/hooks/use-club";
import { choisirRole, marquerClubOuvert } from "@/lib/sfl/club/store";
import { ROLES } from "@/lib/sfl/club/types";

export function PastilleDemo() {
  const { role } = useClub();
  const demande = useSearchParams().get("role");
  useEffect(() => {
    marquerClubOuvert();
  }, []);
  useEffect(() => {
    const r = ROLES.find((x) => x.id === demande);
    if (r) choisirRole(r.id);
  }, [demande]);
  const k = ROLES.findIndex((r) => r.id === role);
  const suivant = ROLES[(k + 1) % ROLES.length];
  return (
    <div className="flex justify-center pt-1">
      <button
        type="button"
        onClick={() => choisirRole(suivant.id)}
        aria-label={`Démo, point de vue ${ROLES[k]?.label} ; passer à ${suivant.label}`}
        className="rounded-full bg-foreground px-3.5 py-1.5 text-[12px] leading-none font-semibold text-background transition-opacity active:opacity-60"
      >
        Démo · {ROLES[k]?.label}
      </button>
    </div>
  );
}
