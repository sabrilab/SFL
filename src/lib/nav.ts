import type { LucideIcon } from "lucide-react";
import { CircleUserRound, MessagesSquare, Newspaper, ShoppingBag } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Section visible mais pas encore ouverte (grisée dans la barre). */
  locked?: boolean;
}

// Les quatre sections de l'app (réorganisation issue du design de référence) :
// 1. Feed — la vie de la ligue : journées, classements, convocations
// 2. Discussions — les canaux du vestiaire (verrouillé : nécessite les comptes)
// 3. Profil — sa carte, sa collection, ses matchs
// 4. Boutique — récompenses réelles payables en points (verrouillé)
// Les anciennes routes (/stats, /carte, /collection, /duel, /reglages)
// restent accessibles depuis le Feed et le Profil.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Feed", icon: Newspaper },
  { href: "/discussions", label: "Discussions", icon: MessagesSquare, locked: true },
  { href: "/profil", label: "Profil", icon: CircleUserRound },
  { href: "/boutique", label: "Boutique", icon: ShoppingBag, locked: true },
];
