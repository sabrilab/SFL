"use client";

// La porte de la SFL (Sabri, 26/10/2026) : un joueur Bola, venu par un
// parrain et hors de la saison (hooks/use-hors-sfl.ts), n'entre pas dans les
// pages de la ligue du dimanche. Un lien partagé, une notification ou un
// vieil onglet qui y mène l'emmène chez Bola : les Actus de Bola, ou la Map
// pour le Vestiaire. Le reste (Map, Ma carte, Bola, Bola Team, ses messages)
// est à lui.

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHorsSfl } from "@/hooks/use-hors-sfl";

/** Les pages de la SFL, et où elles mènent un joueur Bola. */
const PAGES_SFL: [racine: string, vers: string][] = [
  ["/ligue", "/ligue-vierge"],
  ["/saisons", "/ligue-vierge"],
  ["/palmares", "/ligue-vierge"],
  ["/stats", "/ligue-vierge"],
  ["/vestiaire", "/"],
];

export function destinationHorsSfl(pathname: string): string | null {
  for (const [racine, vers] of PAGES_SFL) if (pathname === racine || pathname.startsWith(`${racine}/`)) return vers;
  return null;
}

export function PorteSfl() {
  const horsSfl = useHorsSfl();
  const pathname = usePathname();
  const router = useRouter();
  const vers = horsSfl && pathname ? destinationHorsSfl(pathname) : null;
  useEffect(() => {
    if (vers) router.replace(vers);
  }, [vers, router]);
  return null;
}
