import { redirect } from "next/navigation";

// L'ancien écran ≡ de l'admin est devenu l'onglet Plus (24/11/2026) ; son
// Effectif est passé dans Joueurs (/admin/ligue/effectif reste ouvert).
export default function LiguePage() {
  redirect("/admin/plus");
}
