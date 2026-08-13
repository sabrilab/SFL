"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Moon,
  Sun,
  Monitor,
  ShieldCheck,
  ChevronRight,
  Settings,
  FlaskConical,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Locked } from "@/components/sfl/locked";
import { useIsClient } from "@/hooks/use-is-client";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { isAdmin } from "@/lib/sfl/admin";
import { AccountCard } from "@/components/sfl/auth/account-card";

const THEME_OPTIONS = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
] as const;

export default function ReglagesPage() {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();
  const current = isClient ? (theme ?? "system") : "system";
  const { me } = useMyPlayer();
  const admin = isClient && isAdmin(me);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-7 px-5 py-4 sm:py-8">
      <div className="flex items-center gap-2.5">
        <span className="glass flex size-11 items-center justify-center rounded-2xl">
          <Settings className="size-5" />
        </span>
        <div>
          <p className="text-[13px] font-medium text-foreground/45">Personnalisation</p>
          <h1 className="text-[28px] font-bold tracking-tight">Réglages</h1>
        </div>
      </div>

      <AccountCard />

      <section>
        <h2 className="mb-3 px-1 text-sm font-semibold text-foreground/45">Apparence</h2>
        {/* Sombre uniquement pour l'instant : le clair sera réactivé quand
            toutes les pages seront portées sur le design. */}
        <Locked label="Bientôt" note="La version claire arrive — l'app reste en sombre pour l'instant.">
        <div className="glass flex rounded-2xl p-1">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = current === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1.5 rounded-xl py-3 text-xs font-semibold transition-colors",
                  active ? "text-foreground" : "text-foreground/45 hover:text-foreground"
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
        </Locked>
      </section>

      {/* Section « Profil » (accès à l'avatar 3D) masquée volontairement,
          comme dans Ma carte : la création d'avatar n'est pas encore prête
          à être montrée. L'écran reste accessible en direct sur /avatar. */}

      {admin && (
        <section>
          <h2 className="mb-3 px-1 text-sm font-semibold text-foreground/45">Général</h2>
          <Link
            href="/admin"
            className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity active:opacity-70"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
              <ShieldCheck className="size-[18px]" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Espace admin</span>
              <span className="block text-[12px] text-foreground/45">
                Gérer les matchs, convocations et résultats
              </span>
            </span>
            <ChevronRight className="size-4 text-foreground/45" />
          </Link>
          <Link
            href="/admin/setup"
            className="glass mt-2.5 flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity active:opacity-70"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
              <ShieldCheck className="size-[18px]" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Installation Supabase</span>
              <span className="block text-[12px] text-foreground/45">
                Comptes, tables et présence partagée — guide pas à pas
              </span>
            </span>
            <ChevronRight className="size-4 text-foreground/45" />
          </Link>
          <Link
            href="/admin/comptes"
            className="glass mt-2.5 flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity active:opacity-70"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
              <ShieldCheck className="size-[18px]" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Les accès</span>
              <span className="block text-[12px] text-foreground/45">
                Identifiants des 71 joueurs, prêts à envoyer
              </span>
            </span>
            <ChevronRight className="size-4 text-foreground/45" />
          </Link>
          <Link
            href="/admin/activite"
            className="glass mt-2.5 flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity active:opacity-70"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
              <ShieldCheck className="size-[18px]" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Activité &amp; rétention</span>
              <span className="block text-[12px] text-foreground/45">
                Qui se connecte, quand — et les emails collectés
              </span>
            </span>
            <ChevronRight className="size-4 text-foreground/45" />
          </Link>
          {/* Page statique servie depuis public/ : une vraie navigation, pas
              une route Next — d'où le <a> et non <Link>. Elle s'ouvre à qui a
              l'adresse, sans compte : c'est le lien qu'on transmet. */}
          <a
            href="/note-labo.html"
            target="_blank"
            rel="noreferrer"
            className="glass mt-2.5 flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity active:opacity-70"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
              <FlaskConical className="size-[18px]" />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Note — Le Labo</span>
              <span className="block text-[12px] text-foreground/45">
                Direction produit : la carte par les tests · lien partageable
              </span>
            </span>
            <ArrowUpRight className="size-4 text-foreground/45" />
          </a>
        </section>
      )}
    </div>
  );
}
