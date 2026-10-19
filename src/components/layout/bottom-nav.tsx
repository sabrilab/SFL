"use client";

// La barre d'onglets — celle d'iOS 26, « Liquid Glass », comme dans l'app
// iPhone Bola (GolderApp.swift, un TabView natif) : une capsule de verre qui
// flotte au-dessus du contenu, trois onglets icône + libellé, et sous
// l'onglet choisi une lentille de verre plus claire qui glisse d'un onglet à
// l'autre avec un ressort. Le symbole choisi est plein, les autres au trait.
// À droite, détachée, la pastille ronde de la Recherche : l'onglet de
// recherche d'iOS 26 (Tab(role: .search)).
//
// C'est la seule navigation de l'app, sur téléphone comme sur ordinateur :
// rien en haut de l'écran, ni logo ni en-tête collant (les guidelines
// d'Apple). Sur ordinateur, la même capsule, posée en bas au centre.
//
// Sur la Map (plan clair), le verre devient clair et l'encre noire ;
// ailleurs, l'app est sombre : verre fumé, encre blanche — exactement le
// `toolbarColorScheme` de l'onglet Jouer dans l'app.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarteIcon, MapIcon, RechercheIcon, TropheeIcon } from "./nav-icons";
import { ongletActif } from "@/lib/nav";
import { useVestiaireNonLus } from "@/hooks/use-vestiaire-non-lus";

const TABS = [
  { href: "/", Icon: MapIcon, label: "Map" },
  { href: "/profil", Icon: CarteIcon, label: "Ma carte" },
  { href: "/ligue", Icon: TropheeIcon, label: "Ligue" },
] as const;

const surMap = (pathname: string) => pathname === "/" || pathname === "/map";

export function BottomNav() {
  const pathname = usePathname();
  const onglet = ongletActif(pathname);
  const actif = TABS.findIndex(({ href }) => href === onglet);
  const recherche = pathname === "/recherche" || pathname.startsWith("/recherche/");
  const clair = surMap(pathname);
  const encre = clair ? "#0a0b0d" : "#ffffff";
  // La pastille du Vestiaire, sur l'onglet Ligue : du nouveau dans la discussion.
  const nonLus = useVestiaireNonLus();

  return (
    <div
      className="fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-2"
      style={{
        bottom: "max(calc(env(safe-area-inset-bottom) - 4px), 14px)",
        width: "min(calc(100% - 32px), 430px)",
      }}
    >
      <nav
        aria-label="Onglets"
        className="liquid-tabbar relative flex min-w-0 flex-1"
        data-clair={clair ? "" : undefined}
        // La place de la lentille : un tiers, décalé de l'onglet choisi.
        style={{ ["--onglet" as string]: Math.max(0, actif) }}
      >
        {/* La lentille de l'onglet choisi */}
        {actif >= 0 && <span aria-hidden className="liquid-tabbar__lentille" />}

        {TABS.map(({ href, Icon, label }, i) => {
          const choisi = i === actif;
          return (
            <Link
              key={href}
              href={href}
              aria-current={choisi ? "page" : undefined}
              className="liquid-tabbar__onglet"
              style={{ color: encre }}
            >
              <span className="relative">
                <Icon plein={choisi} />
                {href === "/ligue" && nonLus > 0 && (
                  <span
                    aria-label={`${nonLus} nouveaux messages au Vestiaire`}
                    className="absolute -top-1 -right-2.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold tabular-nums"
                    style={{ background: encre, color: clair ? "#ffffff" : "#0a0b0d" }}
                  >
                    {nonLus > 9 ? "9+" : nonLus}
                  </span>
                )}
              </span>
              <span className="liquid-tabbar__libelle" style={{ fontWeight: choisi ? 600 : 500 }}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <Link
        href="/recherche"
        aria-label="Recherche"
        aria-current={recherche ? "page" : undefined}
        className="liquid-tabbar liquid-tabbar--rond"
        data-clair={clair ? "" : undefined}
        data-choisi={recherche ? "" : undefined}
        style={{ color: encre }}
      >
        <RechercheIcon plein={recherche} />
      </Link>
    </div>
  );
}

/** Sous la barre d'état : un voile à la couleur du fond, pour que le texte
 *  qui défile ne passe pas sous l'heure et la batterie (sur l'app installée,
 *  la barre d'état est transparente). Hors de la Map, qui a son propre voile. */
export function VoileEtat() {
  const pathname = usePathname();
  if (surMap(pathname)) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-30 bg-gradient-to-b from-background via-background/85 to-transparent"
      style={{ height: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
    />
  );
}
