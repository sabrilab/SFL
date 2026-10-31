"use client";

// L'essai de design en cours, partout dans l'app (lib/ds/essai.ts) : la
// feuille qui réécrit les réglages de tokens.css sur ce téléphone, et une
// petite pilule en haut de l'écran pour ne pas oublier qu'on regarde un
// essai, pas l'app des joueurs. La pilule ramène à Admin → Design, ou arrête
// l'essai. Sans essai, ce composant ne rend rien.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { arreterEssai, ecouterEssai, feuilleDEssai, lireEssai, nombreDeChangements, type Essai } from "@/lib/ds/essai";

export function EssaiDesign() {
  const [essai, setEssai] = useState<Essai | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Micro-tâche : aucun setState synchrone dans le corps de l'effet.
    Promise.resolve().then(() => setEssai(lireEssai()));
    return ecouterEssai(setEssai);
  }, []);

  if (!essai || nombreDeChangements(essai) === 0) return null;
  const surLaPage = pathname === "/admin/design";

  return (
    <>
      <style data-essai-design="">{feuilleDEssai(essai)}</style>
      {!surLaPage && (
        <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+6px)] z-[100] flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-foreground py-1 pr-1 pl-3.5 text-[12px] font-semibold text-background shadow-lg">
            <Link href="/admin/design">Essai de design</Link>
            <button
              type="button"
              onClick={arreterEssai}
              className="rounded-full bg-background/15 px-2.5 py-1 transition-opacity active:opacity-60"
            >
              Arrêter
            </button>
          </div>
        </div>
      )}
    </>
  );
}
