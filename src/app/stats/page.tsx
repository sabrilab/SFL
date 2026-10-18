import { redirect } from "next/navigation";

// Les classements vivent dans la Ligue depuis le 17/10 (onglet Classements,
// tous les classements en direct) ; le vote du jour aussi. Les anciens liens
// vers /stats y mènent.
export default function StatsPage() {
  redirect("/ligue?vue=classements");
}
