import type { Metadata } from "next";
import { PagePlus } from "@/components/sfl/admin/page-plus";

export const metadata: Metadata = { title: "Admin · Plus" };

// L'onglet Plus de l'admin (24/11/2026) : tout ce qui n'est ni la journée,
// ni les joueurs, ni Analytics. Remplace l'écran ≡ (/admin/ligue).
export default function PlusPage() {
  return <PagePlus />;
}
