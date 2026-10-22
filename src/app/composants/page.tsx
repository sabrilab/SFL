import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Composants",
  description: "Modules d'interface disponibles, installés via shadcn/ui.",
};

const TONS = [
  { ton: "", geste: "Voir le classement" },
  { ton: "bouton--vert", geste: "Je viens" },
  { ton: "bouton--or", geste: "Créer ma carte" },
  { ton: "bouton--mauve", geste: "Partager" },
  { ton: "bouton--braise", geste: "Prendre une place" },
  { ton: "bouton--rouge", geste: "Annuler" },
];

export default function ComponentsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Composants</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Modules d&apos;UI déjà installés (
          <code className="rounded bg-muted px-1 py-0.5">npx shadcn add &lt;composant&gt;</code>{" "}
          pour en ajouter d&apos;autres).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Boutons</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Les trois rangs (app/boutons.css) : le verre de nuit allumé, le verre
              fumé, le texte seul. */}
          <div className="flex flex-col gap-3">
            <p className="mono-label text-muted-foreground">Rangs</p>
            <button type="button" className="bouton-principal flex h-12 items-center justify-center text-[15px] font-semibold">
              Je viens
            </button>
            <button type="button" className="bouton-secondaire flex h-12 items-center justify-center text-[15px] font-semibold">
              Pas dispo
            </button>
            <button type="button" className="bouton-discret flex h-11 items-center justify-center text-[14px] font-semibold">
              Plus tard
            </button>
          </div>
          {/* Les six tons, un par famille de gestes, sur chaque rang. */}
          <div className="flex flex-col gap-3">
            <p className="mono-label text-muted-foreground">Tons</p>
            <div className="grid grid-cols-2 gap-3">
              {TONS.map((t) => (
                <button key={t.geste} type="button" className={`bouton-principal ${t.ton} flex h-12 items-center justify-center text-[15px] font-semibold`}>
                  {t.geste}
                </button>
              ))}
              {TONS.map((t) => (
                <button key={t.geste} type="button" className={`bouton-secondaire ${t.ton} flex h-12 items-center justify-center text-[15px] font-semibold`}>
                  {t.geste}
                </button>
              ))}
              {TONS.map((t) => (
                <button key={t.geste} type="button" className={`bouton-discret ${t.ton} flex h-11 items-center justify-center text-[14px] font-semibold`}>
                  {t.geste}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <p className="mono-label text-muted-foreground">Ronds, éteint</p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" aria-label="Envoyer" className="bouton-principal grid size-10 place-items-center">
                ↑
              </button>
              <button type="button" aria-label="Fermer" className="bouton-secondaire grid size-10 place-items-center">
                ✕
              </button>
              <Button>Composant</Button>
              <Button variant="secondary">Secondaire</Button>
              <Button disabled>Éteint</Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-[22px] bg-[#e9eae6] p-4">
            <p className="mono-label text-[#5c5d59]">Sur la Map</p>
            <div className="flex items-center gap-3">
              <button type="button" className="bouton-encre bouton--vert flex h-11 items-center px-[18px] text-[15.5px] font-semibold">
                Ouvrir un match
              </button>
              <button type="button" aria-label="Recherche" className="bouton-givre grid size-10 place-items-center">
                ⌕
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge>Nouveau</Badge>
            <Badge variant="secondary">Beta</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formulaire</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="toi@exemple.com" />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="notifs" />
            <Label htmlFor="notifs">Notifications</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Onglets</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="apercu">
            <TabsList>
              <TabsTrigger value="apercu">Aperçu</TabsTrigger>
              <TabsTrigger value="details">Détails</TabsTrigger>
            </TabsList>
            <TabsContent value="apercu" className="text-sm text-muted-foreground">
              Contenu de l&apos;aperçu.
            </TabsContent>
            <TabsContent value="details" className="text-sm text-muted-foreground">
              Contenu détaillé.
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Infobulle</CardTitle>
        </CardHeader>
        <CardContent>
          <Tooltip>
            <TooltipTrigger render={<Button variant="outline">Survole-moi</Button>} />
            <TooltipContent>Un exemple d&apos;infobulle.</TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Card, Dialog, Sheet, Dropdown, Navigation Menu, Avatar, Skeleton, Select et
        Toaster (sonner) sont aussi installés et prêts à l&apos;emploi.
      </p>
    </div>
  );
}
