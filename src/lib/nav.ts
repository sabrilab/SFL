import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Trophy, IdCard, Swords } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Les quatre onglets de l'app joueur :
// 1. Accueil — convocations à accepter + vue d'ensemble
// 2. Stats — classement des joueurs + matchs joués
// 3. Ma carte — carte du joueur, cartes Boost, évolution EvoDay
// 4. Duel — comparaisons par paires, classement personnel façon Elo
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: CalendarCheck },
  { href: "/stats", label: "Stats", icon: Trophy },
  { href: "/duel", label: "Duel", icon: Swords },
  { href: "/carte", label: "Ma carte", icon: IdCard },
];
