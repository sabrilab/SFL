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
          <CardTitle className="text-base">Boutons & badges</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button>Primaire</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="outline">Contour</Button>
          <Button variant="ghost">Fantôme</Button>
          <Badge>Nouveau</Badge>
          <Badge variant="secondary">Beta</Badge>
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
