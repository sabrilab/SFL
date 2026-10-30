import type { Metadata } from "next";
import { PageEffectif } from "@/components/sfl/admin/ligue/page-effectif";

export const metadata: Metadata = { title: "Admin · Effectif" };

export default function EffectifPage() {
  return <PageEffectif />;
}
