"use client";

// La barre d'onglets — celle d'iOS 26, « Liquid Glass », comme dans l'app
// iPhone Bola (GolderApp.swift, un TabView natif) : une capsule de verre qui
// flotte au-dessus du contenu, trois onglets icône + libellé, et sous
// l'onglet choisi une lentille de verre plus claire qui glisse d'un onglet à
// l'autre avec un ressort. Le symbole choisi est plein, les autres au trait.
// À droite, détachée, la pastille ronde du Vestiaire (la discussion de la
// ligue), avec le nombre de messages pas encore lus. La Recherche, qui était
// là, est montée en haut des écrans (BoutonRecherche, à la demande de Sabri
// le 19/10) : le Vestiaire, où l'on revient sans cesse, reste sous le pouce.
//
// Sur ordinateur, la même capsule, posée en bas au centre. Pendant qu'on
// écrit au Vestiaire (le clavier ouvert), la barre s'efface : data-clavier
// sur <html>, posé par le Vestiaire.
//
// Sur la Map (plan clair), le verre devient clair et l'encre noire ;
// ailleurs, l'app est sombre : verre fumé, encre blanche — exactement le
// `toolbarColorScheme` de l'onglet Jouer dans l'app.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActusIcon, CarteIcon, MapIcon, VestiaireIcon } from "./nav-icons";
import { ongletActif } from "@/lib/nav";
import { useVestiaireNonLus } from "@/hooks/use-vestiaire-non-lus";

const TABS = [
  { href: "/", Icon: MapIcon, label: "Map" },
  { href: "/profil", Icon: CarteIcon, label: "Ma carte" },
  { href: "/ligue", Icon: ActusIcon, label: "Actus" },
] as const;

const surMap = (pathname: string) => pathname === "/" || pathname === "/map";

export function BottomNav() {
  const pathname = usePathname();
  const onglet = ongletActif(pathname);
  const actif = TABS.findIndex(({ href }) => href === onglet);
  // La bulle ouvre la discussion : le Vestiaire, et Bola Agent à côté.
  const vestiaire = pathname === "/vestiaire" || pathname === "/agent";
  const clair = surMap(pathname);
  const encre = clair ? "#0a0b0d" : "#ffffff";
  // Du nouveau dans la discussion : le nombre, sur la bulle.
  const nonLus = useVestiaireNonLus();

  return (
    <div
      className="fixed left-1/2 z-40 flex [html[data-clavier]_&]:hidden -translate-x-1/2 items-center gap-2"
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
              <Icon plein={choisi} />
              <span className="liquid-tabbar__libelle" style={{ fontWeight: choisi ? 600 : 500 }}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <Link
        href="/vestiaire"
        aria-label={nonLus > 0 ? `Vestiaire, ${nonLus} nouveaux messages` : "Vestiaire"}
        aria-current={vestiaire ? "page" : undefined}
        className="liquid-tabbar liquid-tabbar--rond"
        data-clair={clair ? "" : undefined}
        data-choisi={vestiaire ? "" : undefined}
        style={{ color: encre }}
      >
        <span className="relative">
          <VestiaireIcon plein={vestiaire} />
          {nonLus > 0 && !vestiaire && (
            <span
              aria-hidden
              className="absolute -top-2 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full px-[5px] text-[11.5px] leading-none font-bold tabular-nums text-white"
              // Le rouge des pastilles d'iOS, cerclé du fond pour se détacher
              // du verre (seule couleur de la barre : c'est une alerte).
              style={{ background: "#FF3B30", boxShadow: `0 0 0 2px ${clair ? "#ffffff" : "#0a0b0d"}` }}
            >
              {nonLus > 9 ? "9+" : nonLus}
            </span>
          )}
        </span>
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
