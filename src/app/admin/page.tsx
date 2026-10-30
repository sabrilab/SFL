import type { Metadata } from "next";
import { PageJournee } from "@/components/sfl/admin/journee/page-journee";

export const metadata: Metadata = {
  title: "Admin",
  description: "La journée de la ligue : la préparer, la publier, la jouer.",
};

// L'admin s'ouvre sur la journée qui vient (30/10/2026). Tout le reste de la
// ligue est derrière ≡ (/admin/ligue) ; l'ancien tableau complet, avec
// chacune de ses fonctions, reste sous /admin/tableau.
export default function AdminPage() {
  return <PageJournee />;
}
