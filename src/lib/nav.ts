import type { LucideIcon } from "lucide-react";
import { CircleUserRound, Newspaper } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Section visible mais pas encore ouverte (grisée dans la barre). */
  locked?: boolean;
}

// Les sections de l'app (réorganisation issue du design de référence) :
// 1. Feed — la vie de la ligue : journées, classements, convocations
// 2. Profil — sa carte, sa collection, ses matchs
// Discussions et Boutique existent (/discussions, /boutique) mais ne sont pas
// mises en avant : retirées de la navigation à la demande de la ligue.
// Les anciennes routes (/stats, /carte, /collection, /duel, /reglages)
// restent accessibles depuis le Feed et le Profil.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Feed", icon: Newspaper },
  { href: "/profil", label: "Profil", icon: CircleUserRound },
];
