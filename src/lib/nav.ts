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
  { href: "/", label: "Map", icon: MapPin },
  { href: "/profil", label: "Ma carte", icon: CircleUserRound },
  { href: "/ligue", label: "Ligue", icon: Newspaper },
];

// Les pages imbriquées sous un onglet : on y entre depuis l'onglet, l'onglet
// reste allumé. Sans ça, ouvrir le Wall of Fame ou une saison éteignait toute
// la barre et on ne savait plus où on était.
const SOUS_PAGES: Record<string, string[]> = {
  "/": ["/map"],
  "/profil": ["/carte", "/collection", "/duel", "/reglages", "/avatar"],
  "/ligue": ["/palmares", "/saisons", "/stats"],
};

/** L'onglet de la page courante, par son href ; null hors des onglets. */
export function ongletActif(pathname: string): string | null {
  for (const item of NAV_ITEMS) {
    const racines = [item.href, ...(SOUS_PAGES[item.href] ?? [])];
    if (racines.some((r) => (r === "/" ? pathname === "/" : pathname === r || pathname.startsWith(`${r}/`)))) return item.href;
  }
  return null;
}

// Une seule ligue : la SFL. Le choix de ligue est retiré — choisir une
// autre ligue masquait tout le fil. La clé reste pour effacer l'ancien choix.
export const LEAGUE_KEY = "sfl-league";
