"use client";

// La porte de la SFL (Sabri, 26/10/2026) : un joueur Bola, venu par un
// parrain et hors de la saison (hooks/use-hors-sfl.ts), n'entre pas dans les
// pages de la ligue du dimanche. Un lien partagé, une notification ou un
// vieil onglet qui y mène l'emmène chez Bola : les Actus de Bola, la Map
// pour le Vestiaire et les Discussions (le salon et la convocation de la
// SFL), Ma carte pour la Collection et la Boutique (les cartes et le
// maillot de la SFL ; /duel mène à la Collection). Le reste (Map, Ma carte,
// Bola, Bola Team, ses messages) est à lui.
//
// Tant que la base n'a pas dit s'il est un joueur Bola (la toute première
// ouverture d'un compte), une page de la SFL reste couverte : on ne la lui
// montre pas un instant avant de le renvoyer (28/10/2026).

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHorsSflEtat } from "@/hooks/use-hors-sfl";

/** Les pages de la SFL, et où elles mènent un joueur Bola. */
const PAGES_SFL: [racine: string, vers: string][] = [
  ["/ligue", "/ligue-vierge"],
  ["/saisons", "/ligue-vierge"],
  ["/palmares", "/ligue-vierge"],
  ["/stats", "/ligue-vierge"],
  ["/vestiaire", "/"],
  ["/discussions", "/"],
  ["/collection", "/profil"],
  ["/boutique", "/profil"],
  ["/duel", "/profil"],
];

export function destinationHorsSfl(pathname: string): string | null {
  for (const [racine, vers] of PAGES_SFL) if (pathname === racine || pathname.startsWith(`${racine}/`)) return vers;
  return null;
}

export function PorteSfl() {
  const horsSfl = useHorsSflEtat();
  const pathname = usePathname();
  const router = useRouter();
  const sfl = pathname ? destinationHorsSfl(pathname) : null;
  const vers = horsSfl === true ? sfl : null;
  useEffect(() => {
    if (vers) router.replace(vers);
  }, [vers, router]);
  // En attendant la réponse (ou le renvoi), la page de la SFL reste couverte.
  if (sfl && horsSfl !== false) return <div aria-hidden className="fixed inset-0 z-30 bg-background" />;
  return null;
}
