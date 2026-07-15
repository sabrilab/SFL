"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, ShieldCheck, ChevronRight, Settings, PersonStanding } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/hooks/use-is-client";

const THEME_OPTIONS = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
] as const;

export default function ReglagesPage() {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();
  const current = isClient ? (theme ?? "system") : "system";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-7 px-5 py-4 sm:py-8">
      <div className="flex items-center gap-2.5">
        <span className="glass flex size-11 items-center justify-center rounded-2xl">
          <Settings className="size-5" />
        </span>
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">Personnalisation</p>
          <h1 className="text-[28px] font-bold tracking-tight">Réglages</h1>
        </div>
      </div>

      <section>
        <h2 className="mb-3 px-1 text-sm font-semibold text-muted-foreground">Apparence</h2>
        <div className="glass flex rounded-2xl p-1">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = current === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1.5 rounded-xl py-3 text-xs font-semibold transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-xl bg-foreground/10 ring-1 ring-foreground/10" />
                )}
                <Icon className="relative size-5" />
                <span className="relative">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 px-1 text-sm font-semibold text-muted-foreground">Profil</h2>
        <Link
          href="/avatar"
          className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity active:opacity-70"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
            <PersonStanding className="size-[18px]" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Mon avatar</span>
            <span className="block text-[12px] text-muted-foreground">
              Créer et personnaliser son avatar 3D
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </section>

      <section>
        <h2 className="mb-3 px-1 text-sm font-semibold text-muted-foreground">Général</h2>
        <Link
          href="/admin"
          className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity active:opacity-70"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
            <ShieldCheck className="size-[18px]" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">Espace admin</span>
            <span className="block text-[12px] text-muted-foreground">
              Gérer les matchs, convocations et résultats
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </section>
    </div>
  );
}
