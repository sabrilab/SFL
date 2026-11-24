// La coquille des pages /admin (refonte du 24/11/2026) : la barre à quatre
// onglets sur téléphone, la colonne sur ordinateur (components/sfl/admin/coquille.tsx).
// Un layout ne se re-rend pas d'une page admin à l'autre : la lentille glisse.

import { CoquilleAdmin } from "@/components/sfl/admin/coquille";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <CoquilleAdmin>{children}</CoquilleAdmin>;
}
