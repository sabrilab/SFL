// Bola 27 (bola-app#33), le jeu seul : remplace « next/link » (il n'y a pas de Next dans le site statique). Un lien
// ordinaire ; les réglages propres à Next (préchargement, remplacement de l'historique…) sont ignorés.
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children?: ReactNode;
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
};

export default function Lien({ href, children, prefetch, replace, scroll, shallow, passHref, legacyBehavior, ...reste }: Props) {
  void [prefetch, replace, scroll, shallow, passHref, legacyBehavior];
  return (
    <a href={href} {...reste}>
      {children}
    </a>
  );
}
