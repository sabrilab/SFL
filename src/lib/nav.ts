import type { LucideIcon } from "lucide-react";
import { CircleUserRound, MapPin, Newspaper } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Section visible mais pas encore ouverte (grisée dans la barre). */
  locked?: boolean;
}

// Les sections de l'app, dans l'ordre de l'app Bola :
// 1. Map (à gauche) — les matchs de la ligue sur leur terrain ; pour l'instant,
//    un seul, celui du dimanche
// 2. Profil (au milieu) — la carte du joueur, sa collection, ses matchs
// 3. Feed (à droite) — les nouvelles et les récaps de la ligue
// Discussions et Boutique existent (/discussions, /boutique) mais ne sont pas
// mises en avant : retirées de la navigation à la demande de la ligue.
// Les anciennes routes (/stats, /carte, /collection, /duel, /reglages)
// restent accessibles depuis le Feed et le Profil.
export const NAV_ITEMS: NavItem[] = [
  { href: "/map", label: "Map", icon: MapPin },
  { href: "/profil", label: "Ma carte", icon: CircleUserRound },
  { href: "/", label: "Ligue", icon: Newspaper },
];
