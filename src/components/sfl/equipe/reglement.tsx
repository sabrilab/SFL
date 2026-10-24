"use client";

// Le Règlement Team (docs/gameplay/11) et, depuis le 24/10, la Charte de
// déontologie (Sabri : « un règlement déontologique aussi, qu'ils doivent
// signer ») : ce qu'on signe pour entrer dans une équipe, ou pour en créer
// une. Ce sont les seuls textes de règles du mode Team. L'écran de
// signature suit la « Formule d'acceptation » : le titre avec la version,
// l'essentiel en 8 points, la Charte, une case décochée par défaut, et un
// bouton inactif tant qu'elle ne l'est pas. Au-dessus (passe du 23/10) : qui
// m'invite, jusqu'à quand, et les cartes de ceux qui ont déjà signé — on
// sait où l'on entre avant de signer.
//
// Un membre qui avait signé la version 1 signe la 2 (SignerCharte) : la
// page Team et l'ouverture de l'app la lui présentent (reponse-equipe.tsx).

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { Check } from "lucide-react";
import {
  ACCEPTATION,
  CHARTE,
  REGLEMENT,
  VERSION_REGLEMENT,
  confirmationSignature,
  direErreurEquipe,
  etatEquipe,
  inviteur,
  signataires,
  signerCharte,
  signerReglement,
  type Equipe,
} from "@/lib/sfl/equipes";
import { finInvitation, quandTombe } from "@/lib/sfl/equipes-temps";
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

export function CharteListe() {
  return (
    <div className="flex flex-col gap-2">
      <p className="mono-label text-muted-foreground">Charte de déontologie · version {VERSION_REGLEMENT.slice(1)}</p>
      <ol className="flex flex-col gap-1.5 rounded-[18px] bg-card px-4 py-3.5">
        {CHARTE.map((r, i) => (
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
        <strong className="font-semibold">{ACCEPTATION.slice(0, ACCEPTATION.indexOf(")") + 2)}</strong>
        {ACCEPTATION.slice(ACCEPTATION.indexOf(")") + 2)}
      </span>
    </button>
  );
}

/** Entrer dans l'équipe qui m'invite : signer le règlement. */
export function SignerReglement({
  equipe,
  moi,
  onOpenChange,
  apercu,
  onSigne,
}: {
  equipe: Equipe | null;
  /** Mon identifiant : mon invitation dit qui m'invite et jusqu'à quand. */
  moi?: string | null;
  onOpenChange: (o: boolean) => void;
  apercu?: boolean;
  onSigne: () => void;
}) {
  const [envoi, setEnvoi] = useState(false);
  const [coche, setCoche] = useState(false);
  // La case repart décochée à chaque ouverture (Formule d'acceptation).
  const fermer = (o: boolean) => {
    if (!o) setCoche(false);
    onOpenChange(o);
  };
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
      fermer(false);
      onSigne();
    } catch (e) {
      toast.error(direErreurEquipe(e));
    } finally {
      setEnvoi(false);
    }
  }
  const invitation = equipe?.membres.find((m) => m.id === moi && m.statut === "invite");
  const deja = equipe ? signataires(equipe) : [];
  return (
    <Sheet open={!!equipe} onOpenChange={fermer}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        {equipe && (
          <>
            <SheetHeader className="flex-row items-center gap-3 px-5 pt-5 pb-0">
              <Ecusson initiales={equipe.initiales} fond={equipe.fond} blason={equipe.blason} taille={44} />
              <span className="flex min-w-0 flex-col gap-0.5 pr-10">
                <SheetTitle className="truncate text-[24px] font-bold tracking-tight">{equipe.nom}</SheetTitle>
                {invitation && (
                  <span className="truncate text-[13.5px] text-muted-foreground">
                    {[`${inviteur(equipe, invitation)} t'invite`, invitation.depuis && `jusqu'à ${quandTombe(finInvitation(invitation.depuis))}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </span>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4">
              {deja.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="mono-label text-muted-foreground">{etatEquipe(equipe)}</p>
                  <div className="flex flex-wrap gap-x-2 gap-y-2.5">
                    {deja.map((m) => (
                      <span key={m.id} className="flex w-[52px] flex-col items-center gap-1">
                        <CarteDe name={m.name} size={FORMAT_CARTE.petite} />
                        <span className="w-full truncate text-center text-[11.5px] font-medium">{m.name.split(" ")[0]}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <ReglementListe />
              <CharteListe />
              <CaseAcceptation coche={coche} onChange={setCoche} />
              <Button variant="vert" disabled={!coche || envoi} onClick={signer} className="h-12 rounded-full text-[15px] font-semibold">
                Signer et rejoindre {equipe.nom}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Un membre de l'équipe signe la nouvelle version : le Règlement (2 points la victoire) et la Charte. */
export function SignerCharte({
  equipe,
  open,
  onOpenChange,
  apercu,
  onSigne,
}: {
  equipe: Equipe | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  apercu?: boolean;
  onSigne: () => void;
}) {
  const [envoi, setEnvoi] = useState(false);
  const [coche, setCoche] = useState(false);
  const fermer = (o: boolean) => {
    if (!o) setCoche(false);
    onOpenChange(o);
  };
  async function signer() {
    if (!equipe) return;
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    setEnvoi(true);
    try {
      await signerCharte(equipe.id);
      navigator.vibrate?.([12, 60, 24]);
      toast.success(`Règlement Team et Charte ${VERSION_REGLEMENT} signés.`);
      fermer(false);
      onSigne();
    } catch (e) {
      toast.error(direErreurEquipe(e));
    } finally {
      setEnvoi(false);
    }
  }
  return (
    <Sheet open={open && !!equipe} onOpenChange={fermer}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        {equipe && (
          <>
            <SheetHeader className="flex-row items-center gap-3 px-5 pt-5 pb-0">
              <Ecusson initiales={equipe.initiales} fond={equipe.fond} blason={equipe.blason} taille={44} />
              <span className="flex min-w-0 flex-col gap-0.5 pr-10">
                <SheetTitle className="truncate text-[24px] font-bold tracking-tight">{equipe.nom}</SheetTitle>
                <span className="mono-label text-muted-foreground">
                  {signataires(equipe).filter((m) => m.reglement === VERSION_REGLEMENT).length} / {signataires(equipe).length} ont signé
                </span>
              </span>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4">
              <CharteListe />
              <ReglementListe />
              <CaseAcceptation coche={coche} onChange={setCoche} />
              <Button variant="vert" disabled={!coche || envoi} onClick={signer} className="h-12 rounded-full text-[15px] font-semibold">
                Signer
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
