import type { LucideIcon } from "lucide-react";
import { CircleUserRound, MapPin, Newspaper } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Section visible mais pas encore ouverte (grisée dans la barre). */
  locked?: boolean;
}

// Les sections de l'app :
// 1. Map — où se joue le prochain match de la ligue (la Map de BOLA)
// 2. Feed — la vie de la ligue : journées, classements, convocations
// 3. Profil — sa carte, sa collection, ses matchs
// Discussions et Boutique existent (/discussions, /boutique) mais ne sont pas
// mises en avant : retirées de la navigation à la demande de la ligue.
// Les anciennes routes (/stats, /carte, /collection, /duel, /reglages)
// restent accessibles depuis le Feed et le Profil.
export const NAV_ITEMS: NavItem[] = [
  { href: "/map", label: "Map", icon: MapPin },
  { href: "/", label: "Feed", icon: Newspaper },
  { href: "/profil", label: "Profil", icon: CircleUserRound },
];
