import type { Metadata } from "next";
import { PageJournee } from "@/components/sfl/admin/journee/page-journee";

export const metadata: Metadata = {
  title: "Admin · Journée",
  description: "La journée de la ligue : la préparer, la publier, la jouer.",
};

// L'admin s'ouvre sur la journée qui vient (30/10/2026), son premier onglet
// (24/11/2026). Le reste de la ligue est dans les onglets Joueurs et Plus ;
// l'ancien tableau complet, avec chacune de ses fonctions, reste sous
// /admin/tableau.
export default function AdminPage() {
  return <PageJournee />;
}
