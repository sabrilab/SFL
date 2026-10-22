"use client";

// Le Règlement Team (docs/gameplay/11) : ce qu'on signe pour entrer dans une
// équipe, ou pour en créer une. C'est le seul texte de règles du mode Team.

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { REGLEMENT, direErreurEquipe, signerReglement, type Equipe } from "@/lib/sfl/equipes";

export function ReglementListe() {
  return (
    <div className="flex flex-col gap-2">
      <p className="mono-label text-muted-foreground">Règlement Team</p>
      <ol className="flex flex-col gap-1.5 rounded-[18px] bg-card px-4 py-3.5">
        {REGLEMENT.map((r, i) => (
          <li key={i} className="grid grid-cols-[18px_1fr] gap-2 text-[13.5px] leading-snug">
            <span className="font-bold text-muted-foreground tabular-nums">{i + 1}</span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Entrer dans l'équipe qui m'invite : signer le règlement. */
export function SignerReglement({
  equipe,
  onOpenChange,
  apercu,
  onSigne,
}: {
  equipe: Equipe | null;
  onOpenChange: (o: boolean) => void;
  apercu?: boolean;
  onSigne: () => void;
}) {
  const [envoi, setEnvoi] = useState(false);
  async function signer() {
    if (!equipe) return;
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    setEnvoi(true);
    try {
      await signerReglement(equipe.id);
      navigator.vibrate?.([12, 60, 24]);
      onOpenChange(false);
      onSigne();
    } catch (e) {
      toast.error(direErreurEquipe(e));
    } finally {
      setEnvoi(false);
    }
  }
  return (
    <Sheet open={!!equipe} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        {equipe && (
          <>
            <SheetHeader className="flex-row items-center gap-3 px-5 pt-5 pb-0">
              <Ecusson initiales={equipe.initiales} fond={equipe.fond} taille={44} />
              <SheetTitle className="text-[24px] font-bold tracking-tight">{equipe.nom}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4">
              <ReglementListe />
              <Button disabled={envoi} onClick={signer} className="h-12 rounded-full text-[15px] font-semibold">
                Je signe et je rejoins
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
