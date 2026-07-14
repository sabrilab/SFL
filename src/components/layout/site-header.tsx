"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useBallons } from "@/hooks/use-ballons";
import { useIsClient } from "@/hooks/use-is-client";
import { PLAYERS } from "@/lib/sfl/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PLAYER_NAMES = [...PLAYERS].sort((a, b) => a.name.localeCompare(b.name)).map((p) => p.name);

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
  const { me, setMe } = useMyPlayer();

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-5">
        <Link href="/" className="mr-1 font-display text-xl italic tracking-wide">
          S<span className="text-primary">F</span>L
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
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
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <BallonsBadge me={me} />
          <Select value={me} onValueChange={(v) => setMe(v as string)}>
            <SelectTrigger
              size="sm"
              aria-label="Choisir mon profil joueur"
              className="rounded-full border-transparent bg-secondary px-3.5 font-medium dark:bg-secondary"
            >
              <span className="mr-1 flex size-4.5 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-bold">
                {me[0]}
              </span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAYER_NAMES.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Espace admin"
                  className="text-muted-foreground hover:text-foreground"
                  render={
                    <Link href="/admin">
                      <ShieldCheck className="size-5" />
                    </Link>
                  }
                />
              }
            />
            <TooltipContent>Espace admin</TooltipContent>
          </Tooltip>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
