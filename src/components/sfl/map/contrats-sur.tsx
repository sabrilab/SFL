"use client";

// Les contrats sur une cible touchée sur la Map, avec le filtre Contrats
// (map/contrats-map.ts) : les affiches des Actus (actus/contrats-en-jeu.tsx)
// qui la visent, ses face-à-face d'abord, elle sous le viseur, puis son profil,
// qui s'ouvre dans la même fenêtre, avec un retour vers les contrats
// (ui/sheet.tsx). Ouverts depuis la pile de joueurs, les contrats y ramènent
// par leur retour (`onRetour`).

import { useRef } from "react";
import { Affiche, AfficheDuel } from "@/components/sfl/actus/contrats-en-jeu";
import { Button } from "@/components/ui/button";
import { FeuilleProfil } from "@/components/sfl/card-viewer";
import { Sheet, SheetContent, SheetHeader, SheetTitle, type Fenetre } from "@/components/ui/sheet";
import { useIdentites } from "@/hooks/use-identites";
import type { MissionsDeLaLigue } from "@/hooks/use-missions";
import { prenom } from "@/lib/sfl/missions";
import { ciblesDe } from "./contrats-map";

export function ContratsSur({
  nom,
  lg,
  onFermer,
  onRetour,
}: {
  nom: string | null;
  lg: MissionsDeLaLigue | null;
  onFermer: () => void;
  onRetour?: () => void;
}) {
  const identite = useIdentites();
  const fenetre = useRef<Fenetre | null>(null);
  const duels = lg && nom ? lg.faceAFace.filter((f) => f.duel.noirs === nom || f.duel.blancs === nom) : [];
  const contrats = lg && nom ? lg.contrats.filter((e) => ciblesDe(e).includes(nom)) : [];
  const n = duels.length + contrats.length;
  return (
    <Sheet open={!!lg && !!nom && n > 0} onOpenChange={(o) => !o && onFermer()} fenetreRef={fenetre} titre="les contrats">
      <SheetContent
        side="bottom"
        onRetour={onRetour}
        className="max-h-[88dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
      >
        <SheetHeader className="px-5 pt-5 pb-0">
          <p className="mono-label text-muted-foreground">
            J{lg?.d.j} · {n} contrat{n > 1 ? "s" : ""}
          </p>
          <SheetTitle className="text-[26px] font-bold tracking-tight">
            Contrats sur {nom ? (nom === lg?.moi ? "toi" : prenom(identite.nom(nom))) : ""}
          </SheetTitle>
        </SheetHeader>
        {lg && (
          <div className="flex snap-x snap-mandatory scroll-px-4 items-stretch gap-3 overflow-x-auto overscroll-x-contain px-4 pt-2 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {duels.map((f) => (
              <AfficheDuel key={`${f.duel.noirs}-${f.duel.blancs}`} f={f} lg={lg} />
            ))}
            {contrats.map((e) => (
              <Affiche key={e.joueur} e={e} lg={lg} vise={nom ?? undefined} />
            ))}
          </div>
        )}
        <div className="px-4">
          <Button variant="secondary" className="h-11 w-full" onClick={() => nom && fenetre.current?.poser(<FeuilleProfil nom={nom} />, "son profil")}>
            {nom === lg?.moi ? "Mon profil" : "Son profil"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
