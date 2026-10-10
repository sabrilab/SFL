"use client";

// Tab bar — répliquée du design de référence : « le seul élément liquid glass ».
// Icônes sans libellé ; l'onglet actif est une pilule blanche pleine avec
// l'icône noire, les inactifs sont des traits blancs à 58 %. Discussions et
// Boutique sont retirées de la barre à la demande de la ligue (la pastille
// bleue de notification reste prête pour le jour où elles reviennent).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BallIcon, MapIcon, PersonIcon } from "./nav-icons";

const TABS: { href: string; Icon: typeof BallIcon; label: string; dot?: boolean }[] = [
  { href: "/", Icon: MapIcon, label: "Map" },
  { href: "/profil", Icon: PersonIcon, label: "Ma carte" },
  { href: "/ligue", Icon: BallIcon, label: "Ligue" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      // `flex` doit vivre dans la classe, pas dans le style : un `display`
      // en ligne écraserait `md:hidden` et la tab bar resterait affichée sur
      // les grands écrans, par-dessus la navigation de l'en-tête.
      className="fixed inset-x-[18px] z-40 flex lg:hidden"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 12px)",
        gap: 4,
        padding: 6,
        borderRadius: 999,
        // Verre sombre : lisible sur les pages noires comme sur le plan clair
        // de la Map, où un verre blanc à 7 % disparaissait.
        background: "rgba(14,17,21,0.78)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 16px 36px rgba(0,0,0,0.7)",
      }}
    >
      {TABS.map(({ href, Icon, label, dot }) => {
        const active = href === "/" ? pathname === "/" || pathname === "/map" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="relative flex flex-1 items-center justify-center rounded-full py-3 transition-transform active:scale-[0.94]"
            style={active ? { background: "#fff" } : undefined}
          >
            <Icon stroke={active ? "#0A0A0A" : "rgba(255,255,255,0.58)"} />
            {dot && !active && (
              <span
                className="absolute"
                style={{
                  top: 10,
                  right: 22,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#6FA8FF",
                  boxShadow: "0 0 8px rgba(111,168,255,0.7)",
                }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
