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
// 3. Actus (à droite) — le fil de la ligue, en cinématiques (ex-Ligue, 22/10)
// Discussions et Boutique existent (/discussions, /boutique) mais ne sont pas
// mises en avant : retirées de la navigation à la demande de la ligue.
// Les anciennes routes (/stats, /carte, /collection, /duel, /reglages)
// restent accessibles depuis le Feed et le Profil.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Map", icon: MapPin },
  { href: "/profil", label: "Ma carte", icon: CircleUserRound },
  { href: "/ligue", label: "Actus", icon: Newspaper },
];

// Les pages imbriquées sous un onglet : on y entre depuis l'onglet, l'onglet
// reste allumé. Sans ça, ouvrir le Wall of Fame ou une saison éteignait toute
// la barre et on ne savait plus où on était.
const SOUS_PAGES: Record<string, string[]> = {
  "/": ["/map"],
  "/profil": ["/carte", "/collection", "/duel", "/reglages", "/avatar", "/boutique", "/admin", "/parrainage"],
  "/ligue": ["/palmares", "/saisons", "/stats", "/ligue-vierge", "/bola-team"],
};

/** L'onglet de la page courante, par son href ; null hors des onglets. */
export function ongletActif(pathname: string): string | null {
  for (const item of NAV_ITEMS) {
    const racines = [item.href, ...(SOUS_PAGES[item.href] ?? [])];
    if (racines.some((r) => (r === "/" ? pathname === "/" : pathname === r || pathname.startsWith(`${r}/`)))) return item.href;
  }
  return null;
}

// La hiérarchie, comme dans une app iPhone (Sabri, 24/10 : « on n'a pas la
// différence entre les sections parents et enfants ; des fois, on peut pas
// faire un retour ») :
//   · les racines : les trois onglets et la bulle du Vestiaire, avec leurs
//     rangées (SFL · Bola · Bola Team dans les Actus, Vestiaire · Agent dans
//     la bulle, les époques de la ligue). Jamais de retour : on change de
//     racine par la barre d'onglets ;
//   · les pages enfants : un retour en haut à gauche, toujours le même
//     (bouton-retour.tsx). Il ramène à la page d'où l'on vient, à l'endroit
//     où on l'avait laissée ; arrivé de dehors (une notification, un lien,
//     l'app rouverte), il mène au parent ci-dessous.
// Les feuilles (profil d'un joueur, carte en grand, fiche d'un match) se
// ferment par leur croix ou en les tirant vers le bas : ce sont des modales.

/** Le parent d'une page enfant : où mène son retour quand rien de l'app n'est derrière elle. */
export interface Parent {
  href: string;
  /** Son nom, pour le lecteur d'écran : « Revenir à Ma carte ». */
  titre: string;
}

const MA_CARTE: Parent = { href: "/profil", titre: "Ma carte" };
const REGLAGES: Parent = { href: "/reglages", titre: "Réglages" };

/** Les pages enfants, de la plus précise à la plus large (la première qui va l'emporte). */
const PARENTS: [string, Parent][] = [
  // Les rubriques de Ma carte, chacune en grand (ma-carte/rubriques.tsx).
  ["/profil/saison", MA_CARTE],
  ["/profil/xp", MA_CARTE],
  ["/profil/evolution", MA_CARTE],
  ["/profil/badges", MA_CARTE],
  ["/profil/cartes", MA_CARTE],
  ["/profil/flair", MA_CARTE],
  ["/reglages", MA_CARTE],
  ["/collection", MA_CARTE],
  ["/carte", MA_CARTE],
  ["/parrainage", MA_CARTE],
  ["/avatar", REGLAGES],
  ["/boutique", { href: "/collection", titre: "Collection" }],
  ["/admin/activite", MA_CARTE],
  ["/admin", REGLAGES],
  ["/ligue/journee", { href: "/ligue", titre: "Actus" }],
  ["/discussions", { href: "/vestiaire", titre: "Vestiaire" }],
  // La liste des messages privés (une conversation donne son parent elle-même : messages/conversation.tsx).
  ["/messages", { href: "/vestiaire", titre: "Vestiaire" }],
  ["/recherche", { href: "/", titre: "Map" }],
];

/** Le parent d'une page enfant ; null pour une racine. */
export function parentDe(pathname: string): Parent | null {
  return PARENTS.find(([r]) => pathname === r || pathname.startsWith(`${r}/`))?.[1] ?? null;
}

/** Le nom d'une page, pour dire où mène un retour. */
const TITRES: [string, string][] = [
  ["/ligue/journee", "Récap"],
  ["/ligue-vierge", "Bola"],
  ["/ligue", "Actus"],
  ["/bola-team", "Bola Team"],
  ["/palmares", "Wall of Fame"],
  ["/saisons", "Saison"],
  ["/profil/saison", "Ma saison"],
  ["/profil/xp", "Niveau XP"],
  ["/profil/evolution", "Évolution"],
  ["/profil/badges", "Badges"],
  ["/profil/cartes", "Mes cartes"],
  ["/profil/flair", "Le Flair"],
  ["/profil", "Ma carte"],
  ["/reglages", "Réglages"],
  ["/collection", "Collection"],
  ["/parrainage", "Inviter"],
  ["/recherche", "Recherche"],
  ["/vestiaire", "Vestiaire"],
  ["/messages", "Messages"],
  ["/agent", "Bola Agent"],
  ["/admin/activite", "Activité"],
  ["/admin", "Admin"],
  ["/map", "Map"],
];

export function titreDe(url: string): string | null {
  const pathname = url.split(/[?#]/)[0] || "/";
  if (pathname === "/") return "Map";
  return TITRES.find(([r]) => pathname === r || pathname.startsWith(`${r}/`))?.[1] ?? null;
}

/**
 * Les onglets qui gardent l'endroit où on les a laissés, comme sur iOS : y
 * revenir par la barre d'onglets retrouve sa place (memoire-navigation.tsx).
 * Pas la Map, plein écran, qui ne défile pas.
 */
export const RACINES_MEMOIRE = ["/profil", "/ligue"];

// Une seule ligue : la SFL. Le choix de ligue est retiré — choisir une
// autre ligue masquait tout le fil. La clé reste pour effacer l'ancien choix.
export const LEAGUE_KEY = "sfl-league";
