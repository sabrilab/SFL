"use client";

// Filet d'erreur de route. Sans ce fichier, une exception dans une page fait
// tomber l'app sur l'écran d'erreur brut de Next — hors thème, en anglais, et
// sans moyen de repartir.
//
// Il MONTRE la panne, dépliée d'office. Une leçon apprise à nos dépens : le
// détail replié derrière un « voir plus », personne ne l'ouvre, et la capture
// d'écran qu'on reçoit ne dit rien de la cause. On cherche alors à l'aveugle
// pendant que l'appareil concerné reste bloqué. Le diagnostic doit tenir dans
// la première capture, sans un seul geste de plus.
//
// Et il offre la sortie de secours qui résout la majorité des cas sur mobile :
// vider le cache de l'app.

import { useState } from "react";
import { Check, Copy, LifeBuoy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reparerApp } from "@/lib/reparer";

/** Le rapport de panne, en texte brut — celui qu'on copie ou qu'on photographie. */
function rapport(error: Error & { digest?: string }): string {
  const lignes = [
    `${error.name}: ${error.message}`,
    error.digest ? `digest ${error.digest}` : "",
    typeof window !== "undefined" ? `page ${window.location.pathname}` : "",
    typeof navigator !== "undefined" ? `nav ${navigator.userAgent}` : "",
    // La pile est minifiée en production, mais elle nomme le fragment et la
    // fonction : c'est souvent tout ce qu'il faut pour situer la panne.
    error.stack ? `\n${error.stack.split("\n").slice(1, 7).join("\n")}` : "",
  ];
  return lignes.filter(Boolean).join("\n");
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reparation, setReparation] = useState(false);
  const [copie, setCopie] = useState(false);

  // Un fragment de code introuvable : c'est presque toujours un cache resté
  // sur une version précédente de l'app. On le dit, et on propose le remède.
  const cacheSuspect =
    /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
      `${error.name} ${error.message}`
    );

  const texte = rapport(error);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-5 py-12 text-center">
      <h1 className="font-heading text-xl font-bold">Quelque chose a cassé</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {cacheSuspect
          ? "Ton appareil garde une ancienne version de l'app. Répare-la : tes données ne bougent pas."
          : "Cet écran n'a pas pu s'afficher. Tes données ne sont pas perdues — réessaie, ou répare l'app."}
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button
          onClick={reset}
          variant={cacheSuspect ? "secondary" : "default"}
          className="gap-2 font-semibold"
        >
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

      {/* La panne, en clair et DÉPLIÉE : c'est ce bloc qu'on photographie. */}
      <div className="mt-8 w-full text-left">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="mono-label text-foreground/35">Détail de l&apos;erreur</span>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(texte).then(
                () => setCopie(true),
                () => {}
              );
            }}
            className="mono-label flex items-center gap-1.5 rounded-full bg-white/6 px-2.5 py-1.5 text-foreground/55"
          >
            {copie ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copie ? "Copié" : "Copier"}
          </button>
        </div>
        <pre className="glass-soft max-h-[38dvh] overflow-auto rounded-2xl px-3.5 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/60">
          {texte}
        </pre>
      </div>

      <p className="mt-4 text-[11.5px] leading-relaxed text-foreground/30">
        « Réparer l&apos;app » vide le cache et recharge. Ta session, ta saison et tes Ballons
        sont conservés.
      </p>
    </div>
  );
}
