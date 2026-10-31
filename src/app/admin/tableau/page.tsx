import type { Metadata } from "next";
import { AdminDashboard } from "../admin-dashboard";

export const metadata: Metadata = {
  title: "Admin · tableau complet",
  description: "Feuilles de match, convocations et effectif.",
};

// Le tableau complet d'avant le 30/10/2026 (Vue, Saisie, Feuille, Joueurs),
// gardé tel quel derrière Ligue : aucune fonction ne se perd. ?onglet=grille,
// feuille ou joueurs ; ?mode=votes ou revue pour la Feuille.
export default async function TableauPage({ searchParams }: { searchParams: Promise<{ [k: string]: string | string[] | undefined }> }) {
  const q = await searchParams;
  const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <AdminDashboard onglet={un(q.onglet)} mode={un(q.mode)} />;
}
