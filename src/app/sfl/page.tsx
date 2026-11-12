// La page publique getbola.app/sfl : la Sunday Five League présentée à qui n'a
// pas de compte, le lien de la bio Instagram de la ligue (12/11/2026).
// Ouverte à tous (AuthGate, PUBLIC_ROUTES), sans barre d'onglets, sans accueil
// de l'app ni guide d'installation : le visiteur découvre d'abord.
//
// Ce fichier reste un composant serveur : il porte l'aperçu du lien (titre,
// description, balises Open Graph), et le HTML servi contient tout le texte.
// La page elle-même est dans components/sfl/page-sfl/page-sfl.tsx, ses textes
// dans lib/sfl/page-sfl.ts.
//
// La racine (layout.tsx) n'a ni openGraph ni twitter, et la fusion des
// métadonnées est superficielle : tout est écrit ici. L'image de l'aperçu est
// le fichier opengraph-image.png posé à côté (le sigle, 1200 × 630, écrit par
// tools/sigle-sfl-exports.ts --apercu-lien), avec son texte de remplacement
// dans opengraph-image.alt.txt. Les adresses relatives sont composées avec
// metadataBase (getbola.app).

import type { Metadata } from "next";
import { PageSfl } from "@/components/sfl/page-sfl/page-sfl";
import { META_SFL } from "@/lib/sfl/page-sfl";

export const metadata: Metadata = {
  title: { absolute: META_SFL.titre },
  description: META_SFL.description,
  alternates: { canonical: "/sfl" },
  openGraph: {
    title: META_SFL.titre,
    description: META_SFL.description,
    url: "/sfl",
    siteName: "Bola",
    locale: "fr_FR",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: META_SFL.titre, description: META_SFL.description },
};

export default function PageSflRoute() {
  return <PageSfl />;
}
