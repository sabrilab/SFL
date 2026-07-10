import type { Metadata } from "next";
import {
  ClipboardList,
  MapPin,
  Send,
  Sparkles,
  Users,
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-3xl italic">
            AD<span className="text-primary">MIN</span>
          </h1>
          <Badge variant="secondary">Bientôt</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          L&apos;interface d&apos;administration arrive : elle permettra d&apos;envoyer les
          feuilles de match, les convocations et la localisation sans toucher au classeur
          Excel.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="opacity-80">
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
