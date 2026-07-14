import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Trophy, IdCard, Swords, Package } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Les cinq onglets de l'app joueur :
// 1. Accueil — convocations à accepter + vue d'ensemble
// 2. Stats — classement des joueurs + matchs joués
// 3. Duel — comparaisons par paires, classement personnel façon Elo
// 4. Collection — packs booster, cartes à collectionner, boutique Ballons
// 5. Ma carte — carte du joueur, cartes Boost, évolution EvoDay
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: CalendarCheck },
  { href: "/stats", label: "Stats", icon: Trophy },
  { href: "/duel", label: "Duel", icon: Swords },
  { href: "/collection", label: "Collection", icon: Package },
  { href: "/carte", label: "Ma carte", icon: IdCard },
];
