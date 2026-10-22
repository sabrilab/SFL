"use client";

// Défier une équipe (le call-out) : face à face des deux écussons, puis
// quand et où. L'équipe défiée accepte ou refuse depuis sa page Team.

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { defier, direErreurEquipe, type Equipe } from "@/lib/sfl/equipes";
import { aujourdhuiIso } from "@/lib/sfl/matchs";

export function Defier({
  mienne,
  adversaire,
  onOpenChange,
  apercu,
  onDefie,
}: {
  mienne: Equipe | null;
  adversaire: Equipe | null;
  onOpenChange: (o: boolean) => void;
  apercu?: boolean;
  onDefie: () => void;
}) {
  const [jour, setJour] = useState("");
  const [heure, setHeure] = useState("20:00");
  const [lieu, setLieu] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const pret = !!jour && /^\d{2}:\d{2}$/.test(heure) && lieu.trim().length > 0;

  async function envoyer() {
    if (!mienne || !adversaire) return;
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    setEnvoi(true);
    try {
      await defier(mienne.id, adversaire.id, jour, heure, lieu);
      navigator.vibrate?.([12, 60, 24]);
      toast.success(`${adversaire.nom} est défié.`);
      onOpenChange(false);
      onDefie();
    } catch (e) {
      toast.error(direErreurEquipe(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Sheet open={!!adversaire} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-[26px] font-bold tracking-tight">Défier</SheetTitle>
        </SheetHeader>
        {mienne && adversaire && (
          <div className="flex flex-col gap-5 px-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
              <div className="flex flex-col items-center gap-2">
                <Ecusson initiales={mienne.initiales} fond={mienne.fond} taille={72} />
                <span className="text-center text-[14px] font-semibold">{mienne.nom}</span>
              </div>
              <span className="text-[15px] font-bold text-muted-foreground">VS</span>
              <div className="flex flex-col items-center gap-2">
                <Ecusson initiales={adversaire.initiales} fond={adversaire.fond} taille={72} />
                <span className="text-center text-[14px] font-semibold">{adversaire.nom}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={jour} min={aujourdhuiIso()} onChange={(e) => setJour(e.target.value)} aria-label="Le jour" />
              <Input type="time" value={heure} step={900} onChange={(e) => setHeure(e.target.value)} aria-label="L'heure" />
            </div>
            <Input value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Le terrain" maxLength={120} />
            <Button disabled={!pret || envoi} onClick={envoyer} className="h-12 rounded-full text-[15px] font-semibold">
              Envoyer le défi
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
