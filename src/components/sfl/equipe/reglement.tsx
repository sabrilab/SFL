"use client";

// Le Règlement Team (docs/gameplay/11) : ce qu'on signe pour entrer dans une
// équipe, ou pour en créer une. C'est le seul texte de règles du mode Team.
// L'écran de signature suit la « Formule d'acceptation » : le titre avec la
// version, l'essentiel en 8 points, une case décochée par défaut, et un
// bouton inactif tant qu'elle ne l'est pas.

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { Check } from "lucide-react";
import { ACCEPTATION, REGLEMENT, VERSION_REGLEMENT, confirmationSignature, direErreurEquipe, signerReglement, type Equipe } from "@/lib/sfl/equipes";
import { cn } from "@/lib/utils";

export function ReglementListe() {
  return (
    <div className="flex flex-col gap-2">
      <p className="mono-label text-muted-foreground">Règlement Team · version {VERSION_REGLEMENT.slice(1)}</p>
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

/** La case à cocher de la signature, décochée par défaut. */
export function CaseAcceptation({ coche, onChange }: { coche: boolean; onChange: (c: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={coche}
      onClick={() => onChange(!coche)}
      className="grid grid-cols-[24px_1fr] gap-3 rounded-[18px] bg-card px-4 py-3.5 text-left text-[13.5px] leading-snug"
    >
      <span
        className={cn(
          "mt-0.5 grid size-6 place-items-center rounded-[7px] border-2 transition-colors",
          coche ? "border-foreground bg-foreground text-background" : "border-foreground/40"
        )}
      >
        {coche && <Check className="size-4" strokeWidth={3} />}
      </span>
      <span>
        <strong className="font-semibold">J&apos;ai lu et j&apos;accepte le Règlement Team (version 1).</strong>
        {ACCEPTATION.slice(ACCEPTATION.indexOf(")") + 2)}
      </span>
    </button>
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
  const [coche, setCoche] = useState(false);
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
      toast.success(confirmationSignature(equipe.nom));
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
              <CaseAcceptation coche={coche} onChange={setCoche} />
              <Button disabled={!coche || envoi} onClick={signer} className="h-12 rounded-full text-[15px] font-semibold">
                Signer et rejoindre {equipe.nom}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
