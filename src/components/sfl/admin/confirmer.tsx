"use client";

// Confirmer avant de supprimer — une seule fenêtre pour tout l'espace admin.
//
// 27/10/2026 : Afid est sorti de l'effectif d'un seul toucher. Désormais,
// chaque suppression demande d'abord : le nom de ce qui part en titre, le
// bouton rouge à droite, « Annuler » à gauche, comme une alerte iOS. Ce qui
// part de la saison reste dans la corbeille (saisie/corbeille.ts) ; ce qui
// ne s'y retrouve pas le dit (`definitif`).

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

export interface Confirmation {
  titre: string;
  /** Une ligne sous le titre, quand ce qui part n'est pas évident. */
  detail?: string;
  /** Le mot du bouton rouge : « Supprimer », « Retirer »… */
  action: string;
  faire: () => void;
}

export function Confirmer({
  confirmation,
  onFermer,
}: {
  confirmation: Confirmation | null;
  onFermer: () => void;
}) {
  return (
    <Dialog open={!!confirmation} onOpenChange={(o) => !o && onFermer()}>
      <DialogContent showCloseButton={false} className="gap-3 rounded-3xl p-5 text-center sm:max-w-xs">
        {confirmation && (
          <>
            <DialogTitle className="text-[17px] leading-snug font-semibold">{confirmation.titre}</DialogTitle>
            {confirmation.detail && (
              <DialogDescription className="text-[13px]">{confirmation.detail}</DialogDescription>
            )}
            <DialogFooter className="mx-0 mb-0 grid grid-cols-2 gap-2 rounded-none border-0 bg-transparent p-0 pt-2 sm:flex-none">
              <Button variant="secondary" onClick={onFermer} className="rounded-full">
                Annuler
              </Button>
              <Button
                variant="rouge"
                autoFocus={false}
                onClick={() => {
                  const faire = confirmation.faire;
                  onFermer();
                  faire();
                }}
                className="rounded-full"
              >
                {confirmation.action}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
