import Link from "next/link";
import { Rocket, Smartphone, WifiOff, Blocks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FEATURES = [
  {
    icon: Smartphone,
    title: "Mobile-first",
    description:
      "L'interface est conçue et testée d'abord pour mobile (~80% du travail de design), puis adaptée aux écrans plus larges.",
  },
  {
    icon: WifiOff,
    title: "Installable & hors-ligne",
    description:
      "Manifeste PWA, icônes et service worker inclus : l'app s'installe sur l'écran d'accueil et fonctionne hors-ligne.",
  },
  {
    icon: Blocks,
    title: "Modules shadcn/ui",
    description:
      "Les composants d'interface (boutons, cartes, dialogues, formulaires...) s'ajoutent à la demande via la CLI shadcn.",
  },
  {
    icon: Rocket,
    title: "Prête pour Vercel",
    description:
      "Next.js App Router, optimisé pour un déploiement zero-config sur Vercel.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 sm:py-14">
      <section className="flex flex-col items-start gap-4">
        <Badge variant="secondary">PWA prête à l&apos;emploi</Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Bienvenue sur SFL
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Base d&apos;application Next.js, pensée mobile-first, installable comme une
          app native et prête à recevoir de nouveaux modules d&apos;interface au fil
          du développement.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button render={<Link href="/composants">Voir les composants</Link>} />
          <Button
            variant="outline"
            render={
              <a href="https://vercel.com/new" target="_blank" rel="noreferrer">
                Déployer sur Vercel
              </a>
            }
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="size-6 text-primary" />
              <CardTitle className="pt-2">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </section>
    </div>
  );
}
