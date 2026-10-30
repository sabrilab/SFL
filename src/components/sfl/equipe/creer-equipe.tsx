"use client";

// Créer son équipe : un nom, ses initiales (tirées du nom, modifiables), et
// son écusson, dessiné à mesure avec son maillot (24/10 : la forme, le
// motif, trois couleurs de club, l'emblème ; equipe/editeur-blason.tsx).
// Le créateur est capitaine et signe en créant le Règlement Team et la
// Charte de déontologie (on les lui montre ici).

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { EditeurBlason } from "@/components/sfl/equipe/editeur-blason";
import { Maillot } from "@/components/sfl/equipe/maillot";
import { CaseAcceptation, CharteListe, ReglementListe } from "@/components/sfl/equipe/reglement";
import { blasonParDefaut, fondDe, type Blason } from "@/lib/sfl/blason";
import { confirmationSignature, creerEquipe, dessinerBlason, direErreurEquipe, initialesDe } from "@/lib/sfl/equipes";

export function CreerEquipe({
  open,
  onOpenChange,
  apercu,
  onCree,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  apercu?: boolean;
  onCree: () => void;
}) {
  const [nom, setNom] = useState("");
  const [initiales, setInitiales] = useState<string | null>(null);
  const [blason, setBlason] = useState<Blason>(() => blasonParDefaut("noir"));
  const [envoi, setEnvoi] = useState(false);
  const [coche, setCoche] = useState(false);
  const ini = (initiales ?? initialesDe(nom)).slice(0, 3);
  const pret = nom.trim().length >= 3 && /^[A-Z0-9]{1,3}$/.test(ini);

  async function creer() {
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    setEnvoi(true);
    try {
      const id = await creerEquipe(nom, ini, fondDe(blason));
      // L'écusson ensuite : s'il ne passait pas, l'équipe existe déjà, en noir et blanc.
      await dessinerBlason(id, blason).catch(() => {});
      navigator.vibrate?.([12, 60, 24]);
      toast.success(confirmationSignature(nom.trim()));
      onOpenChange(false);
      onCree();
    } catch (e) {
      toast.error(direErreurEquipe(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-titre-g font-bold tracking-tight">Créer mon équipe</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          <div className="flex items-end justify-center gap-5 py-1">
            <Ecusson initiales={ini || "?"} fond={fondDe(blason)} blason={blason} taille={104} />
            <Maillot initiales={ini || "?"} fond={fondDe(blason)} blason={blason} taille={120} />
          </div>
          <div className="grid grid-cols-[1fr_96px] gap-2">
            <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de l'équipe" maxLength={20} />
            <Input
              value={ini}
              onChange={(e) => setInitiales(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3))}
              placeholder="Initiales"
              aria-label="Initiales"
              className="text-center font-bold tracking-wider"
            />
          </div>
          <EditeurBlason valeur={blason} onChange={setBlason} initiales={ini} fond={fondDe(blason)} apercu={false} />
          <ReglementListe />
          <CharteListe />
          <CaseAcceptation coche={coche} onChange={setCoche} />
          <Button variant="vert" disabled={!pret || !coche || envoi} onClick={creer} className="h-12 rounded-full text-lecture font-semibold">
            Signer et créer l&apos;équipe
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
