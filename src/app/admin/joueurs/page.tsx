import type { Metadata } from "next";
import { PageJoueurs } from "@/components/sfl/admin/joueurs/page-joueurs";

export const metadata: Metadata = { title: "Admin · Joueurs" };

// L'onglet Joueurs de l'admin (24/11/2026) : créer un compte, valider les
// inscriptions, tout l'effectif avec ses cartes et ses accès.
export default function JoueursPage() {
  return <PageJoueurs />;
}
