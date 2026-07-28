"use client";

// TEMPORAIRE — pop-up de validation du circuit de déploiement.
//
// Elle affiche le commit et l'heure du build, figés au moment du
// `next build` côté serveur (donc identiques pour tout le monde, et
// stables entre le rendu serveur et l'hydratation). Si ces valeurs
// changent après un push, c'est que Vercel a bien reconstruit et
// republié le site : le circuit commit → production fonctionne.
//
// À supprimer une fois le circuit validé (ce fichier, son montage dans
// `layout.tsx`, et rien d'autre).

import { useState, useSyncExternalStore } from "react";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SPLASH_DONE_EVENT, isSplashDone } from "@/components/sfl/app-splash";

// L'écran de chargement est un système extérieur à React de notre point de
// vue : on s'y abonne plutôt que de recopier son état dans un effet.
// L'instantané serveur vaut toujours `false`, donc le HTML prérendu et la
// première hydratation concordent.
function subscribeToSplash(onChange: () => void) {
  window.addEventListener(SPLASH_DONE_EVENT, onChange);
  return () => window.removeEventListener(SPLASH_DONE_EVENT, onChange);
}

export function DeployTestDialog({
  commit,
  builtAt,
}: {
  commit: string;
  builtAt: string;
}) {
  // On attend la fin de l'écran de chargement : il est en z-[200] et
  // masquerait complètement la pop-up (z-50) si on ouvrait tout de suite.
  const splashDone = useSyncExternalStore(
    subscribeToSplash,
    isSplashDone,
    () => false
  );
  const [dismissed, setDismissed] = useState(false);
  const open = splashDone && !dismissed;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && setDismissed(true)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <Rocket className="size-4" /> Test de déploiement
          </DialogTitle>
          <DialogDescription>
            Si tu vois cette fenêtre, le commit est bien parti en production.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Commit</dt>
          <dd className="font-mono">{commit}</dd>
          <dt className="text-muted-foreground">Build</dt>
          <dd className="font-mono">{builtAt}</dd>
        </dl>
        <DialogFooter>
          <Button onClick={() => setDismissed(true)} className="font-semibold">
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
