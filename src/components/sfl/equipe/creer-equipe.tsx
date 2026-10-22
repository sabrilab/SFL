"use client";

// Créer son équipe : un nom, ses initiales (tirées du nom, modifiables), un
// écusson noir ou blanc qui se dessine à mesure. Le créateur est capitaine
// et a signé le Règlement Team en créant (on le lui montre ici).

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { CaseAcceptation, ReglementListe } from "@/components/sfl/equipe/reglement";
import { confirmationSignature, creerEquipe, direErreurEquipe, initialesDe, type Fond } from "@/lib/sfl/equipes";
import { cn } from "@/lib/utils";

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
  const [fond, setFond] = useState<Fond>("noir");
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
      await creerEquipe(nom, ini, fond);
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
          <SheetTitle className="text-[26px] font-bold tracking-tight">Créer mon équipe</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          <div className="flex justify-center py-2">
            <Ecusson initiales={ini || "?"} fond={fond} taille={104} />
          </div>
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de l'équipe" maxLength={20} />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              value={ini}
              onChange={(e) => setInitiales(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3))}
              placeholder="Initiales"
              aria-label="Initiales"
              className="font-bold tracking-wider"
            />
            <div className="grid grid-flow-col gap-1 rounded-full bg-secondary p-1">
              {(["noir", "blanc"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-label={f === "noir" ? "Écusson noir" : "Écusson blanc"}
                  onClick={() => setFond(f)}
                  className={cn("grid size-9 place-items-center rounded-full transition-colors", fond === f && "bg-foreground/15")}
                >
                  <span className={cn("size-5 rounded-full border-2", f === "noir" ? "border-white bg-black" : "border-black bg-white")} />
                </button>
              ))}
            </div>
          </div>
          <ReglementListe />
          <CaseAcceptation coche={coche} onChange={setCoche} />
          <Button disabled={!pret || !coche || envoi} onClick={creer} className="h-12 rounded-full text-[15px] font-semibold">
            Signer et créer l&apos;équipe
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
