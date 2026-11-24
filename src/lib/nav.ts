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
  "/profil": ["/carte", "/collection", "/duel", "/reglages", "/avatar", "/boutique", "/parrainage"],
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
const JOUEURS_ADMIN: Parent = { href: "/admin/joueurs", titre: "Joueurs" };
const PLUS_ADMIN: Parent = { href: "/admin/plus", titre: "Plus" };

/** Les pages enfants, de la plus précise à la plus large (la première qui va l'emporte). */
const PARENTS: [string, Parent][] = [
  // Les rubriques de Ma carte, chacune en grand (ma-carte/rubriques.tsx).
  ["/profil/saison", MA_CARTE],
  ["/profil/xp", MA_CARTE],
  ["/profil/evolution", MA_CARTE],
  ["/profil/badges", MA_CARTE],
  ["/profil/cartes", MA_CARTE],
  ["/profil/flair", MA_CARTE],
  ["/profil/entraineur", MA_CARTE],
  // Bola Plus, la précommande (sfl/bola-plus.tsx).
  ["/profil/bola-plus", MA_CARTE],
  ["/reglages", MA_CARTE],
  ["/collection", MA_CARTE],
  ["/carte", MA_CARTE],
  ["/parrainage", MA_CARTE],
  ["/avatar", REGLAGES],
  ["/boutique", { href: "/collection", titre: "Collection" }],
  // L'admin (refonte du 24/11/2026) : quatre racines, Journée (/admin),
  // Joueurs, Analytics et Plus, sans retour (on change de racine par la
  // barre admin, components/sfl/admin/coquille.tsx). Leurs sous-pages
  // reviennent à leur onglet ; « Retour à l'app » (colonne d'ordinateur,
  // dernière ligne de Plus) mène aux Réglages.
  ["/admin/comptes", JOUEURS_ADMIN],
  ["/admin/ligue/effectif", JOUEURS_ADMIN],
  ["/admin/tableau", PLUS_ADMIN],
  ["/admin/notifications", PLUS_ADMIN],
  ["/admin/setup", PLUS_ADMIN],
  ["/admin/design", PLUS_ADMIN],
  ["/admin/ligue", PLUS_ADMIN],
  ["/ligue/journee", { href: "/ligue", titre: "Actus" }],
  ["/discussions", { href: "/vestiaire", titre: "Vestiaire" }],
  // La liste des messages privés (une conversation donne son parent elle-même : messages/conversation.tsx).
  ["/messages", { href: "/vestiaire", titre: "Vestiaire" }],
  ["/recherche", { href: "/", titre: "Map" }],
];

/** Le parent d'une page enfant ; null pour une racine. */
export function parentDe(pathname: string): Parent | null {
  if (ongletAdmin(pathname) && RACINES_ADMIN.includes(pathname)) return null;
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
  ["/profil/entraineur", "Entraîneur"],
  ["/profil/bola-plus", "Bola Plus"],
  ["/profil", "Ma carte"],
  ["/reglages", "Réglages"],
  ["/collection", "Collection"],
  ["/parrainage", "Inviter"],
  ["/recherche", "Recherche"],
  ["/vestiaire", "Vestiaire"],
  ["/messages", "Messages"],
  ["/agent", "Bola Agent"],
  ["/admin/activite", "Analytics"],
  ["/admin/joueurs", "Joueurs"],
  ["/admin/comptes", "Les accès"],
  ["/admin/ligue/effectif", "Effectif"],
  ["/admin/plus", "Plus"],
  ["/admin/tableau", "Tableau complet"],
  ["/admin/notifications", "Notification"],
  ["/admin/setup", "Installation Supabase"],
  ["/admin/design", "Design"],
  ["/admin", "Journée"],
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
export const RACINES_MEMOIRE = ["/profil", "/ligue", "/admin", "/admin/joueurs", "/admin/activite", "/admin/plus"];

// ───────────── L'admin : quatre onglets (refonte du 24/11/2026) ─────────────
// La demande du 24/11 : « trop d'informations, trop de boutons ». Les traces
// d'usage (activity, 30 j) ont donné l'ordre : la journée d'abord, puis
// Analytics et les accès. Sur téléphone, une capsule en bas ; sur
// ordinateur, une colonne à gauche (components/sfl/admin/coquille.tsx).

export type OngletAdmin = "journee" | "joueurs" | "analytics" | "plus";

export const ONGLETS_ADMIN: { id: OngletAdmin; href: string; libelle: string }[] = [
  { id: "journee", href: "/admin", libelle: "Journée" },
  { id: "joueurs", href: "/admin/joueurs", libelle: "Joueurs" },
  { id: "analytics", href: "/admin/activite", libelle: "Analytics" },
  { id: "plus", href: "/admin/plus", libelle: "Plus" },
];

/** Les quatre racines de l'admin : jamais de retour, la barre suffit. */
export const RACINES_ADMIN = ONGLETS_ADMIN.map((o) => o.href);

const sous = (pathname: string, r: string) => pathname === r || pathname.startsWith(`${r}/`);

/** L'onglet admin d'une page ; null hors de l'admin. */
export function ongletAdmin(pathname: string): OngletAdmin | null {
  if (!sous(pathname, "/admin")) return null;
  if (pathname === "/admin") return "journee";
  if (["/admin/joueurs", "/admin/comptes", "/admin/ligue/effectif"].some((r) => sous(pathname, r))) return "joueurs";
  if (sous(pathname, "/admin/activite")) return "analytics";
  return "plus";
}

// Une seule ligue : la SFL. Le choix de ligue est retiré — choisir une
// autre ligue masquait tout le fil. La clé reste pour effacer l'ancien choix.
export const LEAGUE_KEY = "sfl-league";
