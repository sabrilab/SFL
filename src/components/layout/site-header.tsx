"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMyPlayer } from "@/components/sfl/player-provider";
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

export function SiteHeader() {
  const pathname = usePathname();
  const { me, setMe } = useMyPlayer();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
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
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Select value={me} onValueChange={(v) => setMe(v as string)}>
            <SelectTrigger size="sm" aria-label="Choisir mon profil joueur">
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
