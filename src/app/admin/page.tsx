import type { Metadata } from "next";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = {
  title: "Admin",
  description: "Interface d'administration SFL — feuilles de match, convocations, joueurs.",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
