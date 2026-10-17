import type { Metadata } from "next";

// Le Labo reste invisible pour l'instant (décision de Sabri, 17/10) : aucun
// lien dans l'app, et pas d'indexation. On l'ouvre en tapant /labo.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function LaboLayout({ children }: { children: React.ReactNode }) {
  return children;
}
