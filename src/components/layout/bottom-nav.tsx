"use client";

// La barre d'onglets — celle d'iOS 26, « Liquid Glass », comme dans l'app
// iPhone Bola (GolderApp.swift, un TabView natif) : une capsule de verre qui
// flotte au-dessus du contenu, trois onglets icône + libellé, et sous
// l'onglet choisi une lentille de verre plus claire qui glisse d'un onglet à
// l'autre avec un ressort. Le symbole choisi est plein, les autres au trait.
//
// Sur la Map (plan clair), le verre devient clair et l'encre noire ;
// ailleurs, l'app est sombre : verre fumé, encre blanche — exactement le
// `toolbarColorScheme` de l'onglet Jouer dans l'app.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CarteIcon, MapIcon, TropheeIcon } from "./nav-icons";

const TABS = [
  { href: "/", Icon: MapIcon, label: "Map" },
  { href: "/profil", Icon: CarteIcon, label: "Ma carte" },
  { href: "/ligue", Icon: TropheeIcon, label: "Ligue" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const actif = TABS.findIndex(({ href }) =>
    href === "/" ? pathname === "/" || pathname === "/map" : pathname.startsWith(href)
  );
  const clair = actif === 0;
  const encre = clair ? "#0a0b0d" : "#ffffff";

  return (
    <nav
      aria-label="Onglets"
      // `flex` vit dans la classe : un `display` en ligne écraserait `lg:hidden`.
      className="liquid-tabbar fixed left-1/2 z-40 flex -translate-x-1/2 lg:hidden"
      data-clair={clair ? "" : undefined}
      style={{
        bottom: "max(calc(env(safe-area-inset-bottom) - 4px), 14px)",
        width: "min(calc(100% - 42px), 380px)",
        // La place de la lentille : un tiers, décalé de l'onglet choisi.
        ["--onglet" as string]: Math.max(0, actif),
      }}
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
            <Icon plein={choisi} />
            <span className="liquid-tabbar__libelle" style={{ fontWeight: choisi ? 600 : 500 }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
