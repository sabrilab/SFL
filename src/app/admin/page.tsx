import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  ClipboardList,
  MapPin,
  Send,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Admin",
  description: "Interface d'administration SFL — convocations, feuilles de match, joueurs.",
};

const MODULES = [
  {
    icon: Send,
    title: "Convocations",
    description:
      "Créer la convocation du dimanche, définir l'heure, et suivre les réponses des joueurs en temps réel.",
  },
  {
    icon: ClipboardList,
    title: "Feuille de match",
    description:
      "Saisir les équipes, scores, buts, passes décisives et figures de match (MVP, Impact, Défensive) de chaque journée.",
  },
  {
    icon: MapPin,
    title: "Localisation",
    description:
      "Définir le terrain du match et partager la position avec tous les joueurs convoqués.",
  },
  {
    icon: Users,
    title: "Joueurs",
    description:
      "Gérer l'effectif : statuts (actif, blessé, suspendu), postes, photos de carte et sanctions.",
  },
  {
    icon: Sparkles,
    title: "EvoDay",
    description:
      "Lancer l'évolution mensuelle des cartes : calcul des budgets de points et validation des répartitions.",
  },
];

export default function AdminPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-4 sm:py-8">
      <div>
        <p className="text-[13px] font-medium text-muted-foreground">Espace administrateur</p>
        <div className="flex items-center gap-3">
          <h1 className="text-[34px] font-bold tracking-tight">Admin</h1>
          <Badge variant="secondary" className="rounded-full">Bientôt</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          L&apos;interface d&apos;administration arrive : elle permettra d&apos;envoyer les
          feuilles de match, les convocations et la localisation sans toucher au classeur
          Excel.
        </p>
      </div>

      {/* Outil déjà disponible */}
      <Link
        href="/generateur"
        className="flex items-center gap-3 rounded-3xl bg-card px-5 py-4 transition-opacity active:opacity-70"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/15">
          <Wand2 className="size-5 text-primary" />
        </span>
        <span className="flex-1">
          <span className="flex items-center gap-2">
            <span className="text-base font-semibold">Générateur de cartes</span>
            <Badge className="rounded-full">Dispo</Badge>
          </span>
          <span className="block text-[13px] text-muted-foreground">
            6 stats de base → Rare + les 3 Boost, avec export PNG.
          </span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="rounded-3xl border-0 opacity-80 shadow-none">
            <CardHeader>
              <Icon className="size-5 text-primary" />
              <CardTitle className="pt-1 text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
