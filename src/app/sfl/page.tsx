// La page publique getbola.app/sfl : la Sunday Five League présentée à qui n'a
// pas de compte, le lien de la bio Instagram de la ligue (12/11/2026).
// Ouverte à tous (AuthGate, lib/sfl/routes-publiques.ts), sans barre d'onglets, sans accueil
// de l'app ni guide d'installation : le visiteur découvre d'abord.
//
// Ce fichier reste un composant serveur : il porte l'aperçu du lien (titre,
// description, balises Open Graph), et le HTML servi contient tout le texte.
// La page elle-même est dans components/sfl/page-sfl/page-sfl.tsx, ses textes
// dans lib/sfl/page-sfl.ts.
//
// Les métadonnées sont écrites avec les textes (METADONNEES_SFL), que relit
// tools/page-sfl-check.ts : ce fichier les exporte telles quelles. L'image de
// l'aperçu est le fichier opengraph-image.png posé à côté (le sigle,
// 1200 × 630, écrit par tools/sigle-sfl-exports.ts --apercu-lien), avec son
// texte de remplacement dans opengraph-image.alt.txt.

import type { Metadata } from "next";
import { PageSfl } from "@/components/sfl/page-sfl/page-sfl";
import { METADONNEES_SFL } from "@/lib/sfl/page-sfl";

export const metadata: Metadata = METADONNEES_SFL;

export default function PageSflRoute() {
  return <PageSfl />;
}
