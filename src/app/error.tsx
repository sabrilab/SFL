"use client";

// Filet d'erreur de route. Sans ce fichier, une exception dans une page fait
// tomber l'app sur l'écran d'erreur brut de Next — hors thème, en anglais, et
// sans moyen de repartir.

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-16 text-center">
      <h1 className="font-heading text-xl font-bold">Quelque chose a cassé</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cet écran n&apos;a pas pu s&apos;afficher. Tes données ne sont pas
        perdues — réessaie, ou reviens à l&apos;accueil.
      </p>
      <Button onClick={reset} className="mt-6 gap-2 font-semibold">
        <RotateCcw className="size-4" /> Réessayer
      </Button>
    </div>
  );
}
