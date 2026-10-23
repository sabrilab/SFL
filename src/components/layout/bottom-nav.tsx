"use client";

// La barre d'onglets — celle d'iOS 26, « Liquid Glass », comme dans l'app
// iPhone Bola (GolderApp.swift, un TabView natif) : une capsule de verre qui
// flotte au-dessus du contenu, trois onglets icône + libellé, et sous
// l'onglet choisi une lentille de verre plus claire qui glisse d'un onglet à
// l'autre avec un ressort. Le symbole choisi est plein, les autres au trait.
// À droite, détachée, la pastille ronde du Vestiaire (la discussion de la
// ligue), avec le nombre de messages pas encore lus. L'onglet Map compte mes
// invitations sans réponse (à un match, et depuis le 23/10 à une équipe du
// mode Team) et les messages pas lus des discussions de mes matchs (22/10) ;
// l'icône de l'app, ces messages-là, ceux du Vestiaire et ceux de la
// discussion de mon équipe.
// La Recherche, qui était là, est montée en haut des écrans
// (BoutonRecherche, à la demande de Sabri le 19/10) : le Vestiaire, où l'on
// revient sans cesse, reste sous le pouce.
//
// Sur ordinateur, la même capsule, posée en bas au centre. Pendant qu'on
// écrit au Vestiaire (le clavier ouvert), la barre s'efface : data-clavier
// sur <html>, posé par le Vestiaire.
//
// Sur la Map (plan clair), le verre devient clair et l'encre noire ;
// ailleurs, le verre suit le mode de l'app : fumé et encre blanche en
// sombre, clair et encre noire en clair (23/10) — exactement le
// `toolbarColorScheme` de l'onglet Jouer dans l'app.

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActusIcon, CarteIcon, MapIcon, VestiaireIcon } from "./nav-icons";
import { ongletActif } from "@/lib/nav";
import { pastilleIcone, useVestiaireNonLus } from "@/hooks/use-vestiaire-non-lus";
import { useInvitationsMatch } from "@/hooks/use-invitations";
import { useDiscussionsMatch } from "@/hooks/use-discussions-match";
import { useMonEquipe } from "@/hooks/use-mon-equipe";
import { useModeClair } from "@/hooks/use-mode-clair";

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
  const clair = useModeClair() || surMap(pathname);
  const encre = clair ? "#0a0b0d" : "#ffffff";
  // Du nouveau dans la discussion : le nombre, sur la bulle.
  const nonLus = useVestiaireNonLus();
  // Une invitation sans réponse (un match, une équipe), un message pas lu
  // dans la discussion d'un de mes matchs : le nombre, sur l'onglet Map.
  const invitations = useInvitationsMatch();
  const discussions = useDiscussionsMatch().nonLus;
  const { nonLus: equipe, invitations: invitationsEquipe } = useMonEquipe();
  const surOngletMap = invitations + invitationsEquipe.length + discussions;
  // L'icône de l'app : tous les messages pas lus, comme les notifications.
  useEffect(() => pastilleIcone(nonLus + discussions + equipe), [nonLus, discussions, equipe]);

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
              <span className="relative flex">
                <Icon plein={choisi} />
                {href === "/" && surOngletMap > 0 && <Pastille n={surOngletMap} clair={clair} />}
              </span>
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
          {nonLus > 0 && !vestiaire && <Pastille n={nonLus} clair={clair} />}
        </span>
      </Link>
    </div>
  );
}

/** Le rouge des pastilles d'iOS, cerclé du fond pour se détacher du verre
 *  (seule couleur de la barre : c'est une alerte). */
function Pastille({ n, clair }: { n: number; clair: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute -top-2 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full px-[5px] text-[11.5px] leading-none font-bold tabular-nums text-white"
      style={{ background: "#FF3B30", boxShadow: `0 0 0 2px ${clair ? "#ffffff" : "#0a0b0d"}` }}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

/** Sous la barre d'état : un voile, pour que le texte qui défile ne passe
 *  pas sous l'heure et la batterie (sur l'app installée, la barre d'état est
 *  transparente). À la couleur du fond en sombre, une ombre d'encre en clair
 *  (globals.css, .voile-etat). Hors de la Map, qui a son propre voile ;
 *  partout pour les écrans d'avant l'app (la connexion s'ouvre sur « / »). */
export function VoileEtat({ partout = false }: { partout?: boolean }) {
  const pathname = usePathname();
  if (!partout && surMap(pathname)) return null;
  return <div aria-hidden className="voile-etat pointer-events-none fixed inset-x-0 top-0 z-30" />;
}
