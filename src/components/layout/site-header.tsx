"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Profils protégés par un petit mot de passe (pas de vraie sécurité —
// juste de quoi éviter qu'on se fasse usurper son profil pour de rire).
const PROFILE_PASSWORDS: Record<string, string> = {
  Ilyes: "azy",
};

// Ligues Goccer — l'utilisateur appartient à la SFL ; les autres sont
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

function ProfilePasswordDialog({
  name,
  open,
  onOpenChange,
  onSuccess,
}: {
  name: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (name: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function reset() {
    setPassword("");
    setError(false);
  }

  function submit() {
    if (!name) return;
    if (password === PROFILE_PASSWORDS[name]) {
      onSuccess(name);
      onOpenChange(false);
      reset();
    } else {
      setError(true);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Lock className="size-4" /> Profil protégé
          </DialogTitle>
          <DialogDescription>
            Le profil {name} est protégé par un mot de passe.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="password"
          autoFocus
          placeholder="Mot de passe"
          value={password}
          aria-invalid={error}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        {error && <p className="text-xs text-destructive">Mot de passe incorrect.</p>}
        <DialogFooter>
          <Button onClick={submit} className="font-semibold">
            Se connecter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { me, setMe } = useMyPlayer();
  const [pendingProfile, setPendingProfile] = useState<string | null>(null);

  function selectProfile(name: string) {
    if (PROFILE_PASSWORDS[name]) {
      setPendingProfile(name);
    } else {
      setMe(name);
    }
  }

  return (
    <header className="sticky top-3 z-40 px-4">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2">
        {/* Bulle gauche : logo Goccer + ligue courante */}
        <div className="flex items-center gap-2 rounded-full bg-background/75 py-1.5 pr-1.5 pl-4 shadow-lg shadow-black/20 ring-1 ring-border/60 backdrop-blur-xl">
          <Link
            href="/"
            className="font-sans text-base font-extrabold tracking-tighter"
          >
            Goccer
          </Link>
          <LeagueSwitcher />
        </div>

        <nav className="hidden items-center gap-1 rounded-full bg-background/75 px-1.5 py-1.5 shadow-lg shadow-black/20 ring-1 ring-border/60 backdrop-blur-xl md:flex">
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

        {/* Bulle droite : Ballons, profil, admin, thème */}
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-background/75 px-1.5 py-1.5 shadow-lg shadow-black/20 ring-1 ring-border/60 backdrop-blur-xl">
          <BallonsBadge me={me} />
          <Select value={me} onValueChange={(v) => selectProfile(v as string)}>
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
                  <span className="flex items-center gap-1.5">
                    {name}
                    {PROFILE_PASSWORDS[name] && <Lock className="size-3 text-muted-foreground" />}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ProfilePasswordDialog
            name={pendingProfile}
            open={pendingProfile !== null}
            onOpenChange={(open) => {
              if (!open) setPendingProfile(null);
            }}
            onSuccess={(name) => setMe(name)}
          />

          {/* Admin + thème : cachés sur mobile pour que la bulle tienne à l'écran */}
          <span className="hidden md:inline-flex">
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
          </span>
          <span className="hidden md:inline-flex">
            <ThemeToggle />
          </span>
        </div>
      </div>
    </header>
  );
}
