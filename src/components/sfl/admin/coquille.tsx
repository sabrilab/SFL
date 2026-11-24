"use client";

// La coquille de l'admin (refonte du 24/11/2026, maquette v3 validée le
// 24/11) : quatre onglets, Journée, Joueurs, Analytics et Plus,
// dans l'ordre que donnent les traces d'usage (la journée d'abord, puis
// Analytics et les accès). Montée par app/admin/layout.tsx : elle ne se
// re-rend pas d'une page admin à l'autre, la lentille glisse.
//
// Sur téléphone et tablette tenue droite, la vraie barre de l'app (la
// capsule liquid-tabbar de bottom-nav.tsx) à quatre onglets, la lentille en
// voile léger plutôt qu'en aplat (globals.css, .liquid-tabbar--admin), et
// sous elle un fondu de la couleur du fond pour que les listes ne passent
// pas sous le verre. Sur ordinateur (≥ 1024 px), une colonne fixe à gauche,
// avec « Retour à l'app » en bas ; sur téléphone, ce retour est la dernière
// ligne de Plus.
//
// Tout est rendu DANS #app-scroll, comme les pages : sur iPhone, WebKit
// dessine #app-scroll sous tout ce qui est posé sur <body>, quel que soit le
// z-index ; posée sur body, la barre passerait au-dessus de la fiche plein
// écran d'Analytics et du bouton Publier. Fondu z-30, Publier z-35, barre
// z-40 ; les feuilles (portail sur body) passent au-dessus.
// Aucun transform ni filtre sur le conteneur : les `position: fixed` des
// pages se placeraient par rapport à lui.
//
// Les variables posées ici servent aux éléments fixes des pages :
// --admin-bas (le bas de la capsule, safe-area comprise) et --admin-barre
// (son haut ; 0 sur ordinateur). Choix capsule ou colonne en CSS seulement
// (lg:hidden / lg:flex) : pas d'éclair à l'hydratation.
//
// Un non-admin ne voit ni barre ni colonne : chaque page garde son
// « Espace réservé ». La vraie protection est en base (RLS) et côté API.

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartSpline, ClipboardPen, Ellipsis, Users } from "lucide-react";
import { ONGLETS_ADMIN, ongletAdmin, type OngletAdmin } from "@/lib/nav";
import { remonter, retrouverOnglet } from "@/components/layout/memoire-navigation";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSession } from "@/hooks/use-session";
import { useIsClient } from "@/hooks/use-is-client";
import { useInscriptionsEnAttente } from "@/hooks/use-inscriptions-en-attente";
import { isAdmin } from "@/lib/sfl/admin";
import { cn } from "@/lib/utils";

const ICONE = { className: "size-[21px]", strokeWidth: 1.75, "aria-hidden": true } as const;
const ICONES: Record<OngletAdmin, ReactNode> = {
  journee: <ClipboardPen {...ICONE} />,
  joueurs: <Users {...ICONE} />,
  analytics: <ChartSpline {...ICONE} />,
  plus: <Ellipsis {...ICONE} />,
};

/** Toucher l'onglet où l'on est déjà remonte en haut ; sinon, retrouver sa place. */
function toucher(e: React.MouseEvent, pathname: string, href: string) {
  if (pathname === href && !window.location.search) {
    e.preventDefault();
    remonter();
  } else retrouverOnglet(href);
}

export function useEstAdmin(): boolean {
  const client = useIsClient();
  const { me } = useMyPlayer();
  const session = useSession();
  return client && (isAdmin(me) || !!session?.admin);
}

export function CoquilleAdmin({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const admin = useEstAdmin();
  const onglet = ongletAdmin(pathname);
  if (!admin || !onglet) return <>{children}</>;
  return (
    <div className="coquille-admin lg:pl-[232px]" data-onglet={onglet}>
      <ColonneAdmin actif={onglet} pathname={pathname} />
      {children}
      <div aria-hidden className="fondu-admin pointer-events-none fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-background to-transparent lg:hidden" />
      <BarreAdmin actif={onglet} pathname={pathname} />
    </div>
  );
}

/** La capsule de l'app, à quatre onglets. */
function BarreAdmin({ actif, pathname }: { actif: OngletAdmin; pathname: string }) {
  const index = ONGLETS_ADMIN.findIndex((o) => o.id === actif);
  const attente = useInscriptionsEnAttente();
  return (
    <div
      dir="ltr"
      className="barre-admin fixed left-1/2 z-40 flex -translate-x-1/2 lg:hidden"
      style={{ bottom: "var(--admin-bas)", width: "min(calc(100% - 32px), 430px)" }}
    >
      <nav
        aria-label="Admin"
        className="liquid-tabbar liquid-tabbar--admin relative flex min-w-0 flex-1"
        style={{ ["--onglet" as string]: index, ["--onglets" as string]: ONGLETS_ADMIN.length }}
      >
        <span aria-hidden className="liquid-tabbar__lentille" />
        {ONGLETS_ADMIN.map((o) => {
          const choisi = o.id === actif;
          const marque = o.id === "joueurs" && attente > 0 ? attente : 0;
          return (
            <Link
              key={o.id}
              href={o.href}
              aria-current={choisi ? "page" : undefined}
              aria-label={marque ? `${o.libelle}, ${marque} à valider` : undefined}
              onClick={(e) => toucher(e, pathname, o.href)}
              className="liquid-tabbar__onglet"
            >
              <span className="relative flex">
                {ICONES[o.id]}
                {marque > 0 && (
                  <span
                    aria-hidden
                    className="absolute -top-2 -right-3.5 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-[10px] leading-none font-semibold text-background tabular-nums ring-2 ring-background"
                  >
                    {marque > 9 ? "9+" : marque}
                  </span>
                )}
              </span>
              <span className="liquid-tabbar__libelle" style={{ fontWeight: choisi ? 600 : 500 }}>
                {o.libelle}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Sur ordinateur, la même barre devient une colonne. */
function ColonneAdmin({ actif, pathname }: { actif: OngletAdmin; pathname: string }) {
  const attente = useInscriptionsEnAttente();
  return (
    <aside
      aria-label="Admin"
      className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col gap-0.5 border-r border-border/60 bg-background px-3 pb-6 lg:flex"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 24px)" }}
    >
      <div className="mb-6 flex items-baseline gap-2 px-3">
        <span className="titre-lettrage text-titre-m">SFL</span>
        <span className="text-corps text-encre-3">admin</span>
      </div>
      {ONGLETS_ADMIN.map((o) => {
        const choisi = o.id === actif;
        const marque = o.id === "joueurs" ? attente : 0;
        return (
          <Link
            key={o.id}
            href={o.href}
            aria-current={choisi ? "page" : undefined}
            onClick={(e) => toucher(e, pathname, o.href)}
            className={cn(
              "flex h-10 items-center gap-3 rounded-petit px-3 text-ligne transition-colors",
              choisi ? "bg-foreground/[0.06] font-semibold text-foreground" : "font-medium text-encre-2 hover:bg-foreground/[0.03]"
            )}
          >
            {ICONES[o.id]}
            <span className="flex-1">{o.libelle}</span>
            {marque > 0 && <span className="text-corps text-encre-3 tabular-nums">{marque}</span>}
          </Link>
        );
      })}
      <div className="mt-auto px-3">
        <Link href="/reglages" className="text-corps text-encre-3 transition-colors hover:text-foreground">
          Retour à l&apos;app
        </Link>
      </div>
    </aside>
  );
}
