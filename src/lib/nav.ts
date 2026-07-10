import type { LucideIcon } from "lucide-react";
import { Home, LayoutGrid } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/composants", label: "Composants", icon: LayoutGrid },
];
