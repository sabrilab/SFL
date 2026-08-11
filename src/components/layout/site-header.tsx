"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useBallons } from "@/hooks/use-ballons";
import { useIsClient } from "@/hooks/use-is-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Ligues Golder — l'utilisateur appartient à la SFL ; les autres sont
// visibles pour montrer qu'on peut changer de ligue (v1 locale).
export const LEAGUES = ["SFL", "WFL", "KFL"] as const;
export const LEAGUE_KEY = "sfl-league";

function LeagueSwitcher() {
  const isClient = useIsClient();
  const [league, setLeague] = useState<string | null>(null);
  const current = league ?? (isClient ? (localStorage.getItem(LEAGUE_KEY) ?? "SFL") : "SFL");

  function change(next: string) {
    localStorage.setItem(LEAGUE_KEY, next);
    setLeague(next);
    window.dispatchEvent(new Event("sfl-league"));
  }

  return (
    <Select value={current} onValueChange={(v) => change(v as string)}>
      <SelectTrigger
        size="sm"
        aria-label="Changer de ligue"
        className="h-7 gap-1 rounded-full border-transparent bg-secondary px-2.5 dark:bg-secondary"
      >
        {/* Style "ligue de combat" : capitales larges et écrasées */}
        <span className="scale-y-90 text-[11px] font-black tracking-[0.3em] uppercase">
          {current}
        </span>
      </SelectTrigger>
      <SelectContent>
        {LEAGUES.map((l) => (
          <SelectItem key={l} value={l}>
            <span className="scale-y-90 text-xs font-black tracking-[0.25em] uppercase">{l}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


function BallonsBadge({ me }: { me: string }) {
  const isClient = useIsClient();
  const balance = useBallons(me);

  return (
    <Link
      href="/collection"
      aria-label="Mes Ballons — ouvrir la collection"
      className="flex items-center gap-1 rounded-full bg-secondary py-1.5 pr-3 pl-2 text-sm font-bold tabular-nums"
    >
      <span aria-hidden>⚽</span>
      {isClient ? balance : 0}
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  // Chacun est lié à son compte : l'en-tête affiche le sien, sans choix
  // possible. (Le nom vient de la session ; il mène au profil.)
  const { me } = useMyPlayer();

  return (
    // Le seuil de `sticky` se mesure depuis le haut réel du conteneur, que le
    // padding ne décale pas : il faut donc y réintégrer l'inset haut, sinon le
    // header revient se coller sous l'encoche dès qu'on défile.
    <header
      className="sticky z-40 px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2">
        {/* Bulle gauche : logo Golder + ligue courante */}
        <div className="glass flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-4">
          <Link
            href="/"
            className="font-sans text-base font-extrabold tracking-tighter"
          >
            Golder
          </Link>
          <LeagueSwitcher />
        </div>

        <nav className="glass hidden items-center gap-1 rounded-full px-1.5 py-1.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
        <div className="glass ml-auto flex items-center gap-1.5 rounded-full px-1.5 py-1.5">
          <BallonsBadge me={me} />
          <Link
            href="/profil"
            aria-label="Mon compte"
            className="flex items-center gap-1.5 rounded-full bg-secondary py-1.5 pr-3.5 pl-1.5 text-sm font-medium"
          >
            <span className="flex size-4.5 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-bold">
              {me[0]}
            </span>
            {me}
          </Link>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Réglages"
                  className="text-muted-foreground hover:text-foreground"
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
