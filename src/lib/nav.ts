import type { LucideIcon } from "lucide-react";
import { CalendarCheck, Trophy, IdCard } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Les trois onglets de l'app joueur :
// 1. Accueil — convocations à accepter + vue d'ensemble
// 2. Stats — classement des joueurs + matchs joués
// 3. Ma carte — carte du joueur, cartes Boost, évolution EvoDay
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: CalendarCheck },
  { href: "/stats", label: "Stats", icon: Trophy },
  { href: "/carte", label: "Ma carte", icon: IdCard },
];
