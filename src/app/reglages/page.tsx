"use client";

import Link from "next/link";
import { useApparence } from "@/components/layout/apparence";
import { ecrireApparence } from "@/lib/sfl/apparence";
import { Moon, Sun, SunMoon, ShieldCheck, ChevronRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useIsClient } from "@/hooks/use-is-client";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { isAdmin } from "@/lib/sfl/admin";
import { AccountCard } from "@/components/sfl/auth/account-card";
import { ReglageNotifications } from "@/components/sfl/notifications/reglage-notifications";
import { ReglageConfidentialite } from "@/components/sfl/confidentialite/reglage";
import { useT } from "@/lib/i18n/langue";
import { ReglageLangue } from "@/components/sfl/langue/choix-langue";

// Le mode de l'app : clair, sombre, ou Auto, qui suit le réglage du
// téléphone (le mot d'iOS). Le sombre reste le défaut. Le même choix se fait
// d'un toucher en haut de Ma carte (bouton-theme.tsx), entre clair et sombre.
const THEME_OPTIONS = [
  { value: "clair", label: "Clair", icon: Sun },
  { value: "sombre", label: "Sombre", icon: Moon },
  { value: "auto", label: "Auto", icon: SunMoon },
] as const;

export default function ReglagesPage() {
  const apparence = useApparence();
  const isClient = useIsClient();
  const current = isClient ? apparence : null;
  const { me } = useMyPlayer();
  const admin = isClient && isAdmin(me);
  const t = useT();

  return (
    // Au téléphone et sur iPad en hauteur, une colonne. Sur un écran large
    // (iPad en largeur, ordinateur), deux : l'entrée de l'admin, le compte et
    // l'apparence à gauche, les notifications et la confidentialité à droite. Les colonnes
    // sont « contents » en dessous : l'ordre et l'écart restent ceux d'avant.
    <div className="mx-auto flex max-w-2xl flex-col gap-7 px-5 py-4 sm:py-8 lg:grid lg:max-w-[1000px] lg:grid-cols-2 lg:items-start lg:gap-x-[var(--fib-34)] lg:px-8">
      <div className="flex items-center gap-2.5 lg:col-span-2">
        <BoutonRetour />
        <span className="glass flex size-11 items-center justify-center rounded-2xl">
          <Settings className="size-5" />
        </span>
        <div>
          <p className="text-corps font-medium text-encre-3">{t("Personnalisation")}</p>
          <h1 className="text-titre-l font-bold tracking-tight">{t("Réglages")}</h1>
        </div>
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-7">
        {/* L'admin : une seule entrée, en tête (refonte du 24/11/2026) ; le
          reste (notification, base, design, note du Labo) est dans son
          onglet Plus, les accès dans Joueurs. */}
        {admin && (
          <section>
            <h2 className="mb-3 px-1 text-sm font-semibold text-encre-3">Admin</h2>
            <Link
              href="/admin"
              className="glass flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 transition-opacity active:opacity-70"
            >
              <ShieldCheck className="size-5 text-encre-2" strokeWidth={1.75} />
              <span className="flex-1 text-lecture font-semibold">Espace admin</span>
              <ChevronRight className="size-4 text-encre-3" />
            </Link>
          </section>
        )}

        <AccountCard />

        <section>
          <h2 className="mb-3 px-1 text-sm font-semibold text-encre-3">{t("Apparence")}</h2>
          <div role="radiogroup" aria-label={t("Apparence")} className="glass flex rounded-2xl p-1">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = current === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => ecrireApparence(value)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1.5 rounded-xl py-3 text-xs font-semibold",
                    active ? "bouton-principal" : "bouton-discret text-encre-3",
                  )}
                >
                  <Icon className="relative size-5" />
                  <span className="relative">{t(label)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-3 px-1 text-sm font-semibold text-encre-3">{t("Langue")}</h2>
          <ReglageLangue />
        </section>
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-7">
        <section>
          <h2 className="mb-3 px-1 text-sm font-semibold text-encre-3">{t("Notifications")}</h2>
          <ReglageNotifications />
        </section>

        <section>
          <h2 className="mb-3 px-1 text-sm font-semibold text-encre-3">{t("Confidentialité")}</h2>
          <ReglageConfidentialite />
        </section>

        {/* Section « Profil » (accès à l'avatar 3D) masquée volontairement,
          comme dans Ma carte : la création d'avatar n'est pas encore prête
          à être montrée. L'écran reste accessible en direct sur /avatar. */}

      </div>
    </div>
  );
}
