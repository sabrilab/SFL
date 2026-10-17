"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ongletActif } from "@/lib/nav";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Une seule ligue : la SFL. Le choix de ligue est retiré — choisir une
// autre ligue masquait tout le fil. La clé reste pour effacer l'ancien choix.
export const LEAGUES = ["SFL"] as const;
export const LEAGUE_KEY = "sfl-league";

/** Le badge de la ligue : capitales grasses, en italique. */
function BadgeLigue() {
  return (
    <span
      aria-label="Sunday Five League"
      className="flex h-7 items-center rounded-full bg-secondary px-3 text-[13px] font-black tracking-[0.04em] uppercase italic"
    >
      SFL
    </span>
  );
}



export function SiteHeader() {
  const pathname = usePathname();
  // Chacun est lié à son compte : l'en-tête affiche le sien, sans choix
  // possible. (Le nom vient de la session ; il mène au profil.)
  const { me } = useMyPlayer();
  const onglet = ongletActif(pathname);
  // Sur le plan clair de la Map (téléphone), le verre fumé ne se lirait plus :
  // les bulles prennent l'encre pleine des boutons du plan. Même forme, même
  // place, seule la teinte s'adapte.
  const plan = cn((pathname === "/" || pathname === "/map") && "max-lg:bg-[rgba(10,11,13,0.86)]!");

  return (
    // Le seuil de `sticky` se mesure depuis le haut réel du conteneur, que le
    // padding ne décale pas : il faut donc y réintégrer l'inset haut, sinon le
    // header revient se coller sous l'encoche dès qu'on défile.
    // Le même en-tête partout, Map comprise : le logo BOLA ne bouge jamais
    // d'une page à l'autre. Avant, la Map cachait l'en-tête sur téléphone et
    // posait son propre logo en haut à droite — changer d'onglet donnait
    // l'impression de changer de site. Sur la Map, il flotte sur le plan.
    <header
      className="sticky z-40 px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="mx-auto flex h-14 max-w-5xl min-w-0 items-center gap-2">
        {/* Bulle gauche : le logo BOLA + ligue courante */}
        <div className={cn("glass flex min-w-0 items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4", plan)}>
          <Link href="/" aria-label="Bola — accueil" className="flex shrink-0 items-center">
            <Image src="/bola/logo-blanc.svg" alt="Bola" width={72} height={17} priority />
          </Link>
          <BadgeLigue />
          <Link
            href="/recherche"
            aria-label="Rechercher un joueur ou une journée"
            className="flex size-7 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:text-foreground"
          >
            <Search className="size-4" />
          </Link>
        </div>

        <nav className="glass hidden items-center gap-1 rounded-full px-1.5 py-1.5 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = onglet === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                  // Section pas encore ouverte : la page d'aperçu existe mais
                  // la fonctionnalité est verrouillée — l'onglet le montre.
                  item.locked && !active && "opacity-45"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bulle droite : Ballons, profil, réglages */}
        <div className={cn("glass ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-1.5 py-1.5", plan)}>
          <Link
            href="/profil"
            aria-label="Mon compte"
            className="flex items-center gap-1.5 rounded-full bg-secondary py-1.5 pr-1.5 pl-1.5 text-sm font-medium sm:pr-3.5"
          >
            <span className="flex size-4.5 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-bold">
              {me[0]}
            </span>
            {/* Sous 640 px, l'initiale suffit : le nom reprend sa place dès
                qu'il y a de quoi l'afficher sans pousser la bulle dehors. */}
            <span className="hidden max-w-[110px] truncate sm:inline">{me}</span>
          </Link>

          <Tooltip>
            {/* Masqués sous 640 px : Profil → ⋯ y mène aussi. */}
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Réglages"
                  className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
                  render={
                    <Link href="/reglages">
                      <Settings className="size-5" />
                    </Link>
                  }
                />
              }
            />
            <TooltipContent>Réglages</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
