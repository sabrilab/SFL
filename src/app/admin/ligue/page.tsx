import type { Metadata } from "next";
import { PageLigue } from "@/components/sfl/admin/ligue/page-ligue";

export const metadata: Metadata = { title: "Admin · Ligue" };

export default function LiguePage() {
  return <PageLigue />;
}
