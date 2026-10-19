"use client";

// Le titre des deux écrans de la bulle de discussion : « Vestiaire » (la
// discussion de la ligue) et « Agent » (Bola Agent, le coach personnel ; à la
// demande de Sabri le 19/10/2026, un onglet à côté de la discussion). Le titre
// de l'écran ouvert en blanc, l'autre en gris : on passe de l'un à l'autre en
// le touchant, comme les grands titres d'Apple Music.

import Link from "next/link";

const ECRANS = [
  { href: "/vestiaire", label: "Vestiaire" },
  { href: "/agent", label: "Agent" },
] as const;

export function TitreDiscussion({ actif }: { actif: "/vestiaire" | "/agent" }) {
  return (
    <nav aria-label="Discussion" className="flex min-w-0 items-baseline gap-3.5">
      {ECRANS.map(({ href, label }) =>
        href === actif ? (
          <h1 key={href} className="text-[clamp(26px,7.6vw,30px)] font-bold tracking-tight lg:text-[34px]">
            {label}
          </h1>
        ) : (
          <Link
            key={href}
            href={href}
            replace
            className="text-[clamp(26px,7.6vw,30px)] font-bold tracking-tight text-foreground/25 transition-colors active:text-foreground/45 lg:text-[34px]"
          >
            {label}
          </Link>
        )
      )}
    </nav>
  );
}
