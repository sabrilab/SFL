"use client";

// Filet d'erreur de route. Sans ce fichier, une exception dans une page fait
// tomber l'app sur l'écran d'erreur brut de Next — hors thème, en anglais, et
// sans moyen de repartir.
//
// Il ne se contente plus de dire « ça a cassé » : il MONTRE la panne. Sans
// message ni empreinte, un écran d'erreur reçu en capture ne dit rien de la
// cause, et on cherche à l'aveugle. Et il offre la sortie de secours qui
// résout la grande majorité des cas sur mobile : vider le cache de l'app.

import { useState } from "react";
import { LifeBuoy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reparerApp } from "@/lib/reparer";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reparation, setReparation] = useState(false);

  // Un fragment de code introuvable : c'est presque toujours un cache resté
  // sur une version précédente de l'app. On le dit, et on propose le remède.
  const cacheSuspect =
    /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
      `${error.name} ${error.message}`
    );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 py-16 text-center">
      <h1 className="font-heading text-xl font-bold">Quelque chose a cassé</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {cacheSuspect
          ? "Ton appareil garde une ancienne version de l'app. Répare-la : tes données ne bougent pas."
          : "Cet écran n'a pas pu s'afficher. Tes données ne sont pas perdues — réessaie, ou répare l'app."}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset} variant={cacheSuspect ? "secondary" : "default"} className="gap-2 font-semibold">
          <RotateCcw className="size-4" /> Réessayer
        </Button>
        <Button
          onClick={() => {
            setReparation(true);
            void reparerApp();
          }}
          variant={cacheSuspect ? "default" : "secondary"}
          disabled={reparation}
          className="gap-2 font-semibold"
        >
          <LifeBuoy className="size-4" /> {reparation ? "Réparation…" : "Réparer l'app"}
        </Button>
      </div>

      {/* La panne, en clair : c'est ce bloc qu'on demande en capture d'écran. */}
      <details className="mt-8 w-full text-left">
        <summary className="mono-label cursor-pointer text-foreground/35">
          Détail de l&apos;erreur
        </summary>
        <pre className="glass-soft mt-2 overflow-x-auto rounded-2xl px-3.5 py-3 font-mono text-[11px] leading-relaxed text-foreground/60">
          {error.name}: {error.message}
          {error.digest ? `\ndigest ${error.digest}` : ""}
        </pre>
      </details>

      <p className="mt-4 text-[11.5px] leading-relaxed text-foreground/30">
        « Réparer l&apos;app » vide le cache et recharge. Ta session, ta saison et tes Ballons
        sont conservés.
      </p>
    </div>
  );
}
