"use client";

// Le choix de la langue.
//
// <ChoixLangue />   à l'entrée (connexion, inscription) : deux pastilles en
//                   haut, seulement là où une autre langue que le français
//                   a du sens (le pays de connexion ou la langue du
//                   téléphone, lib/i18n/langues.ts) ; ailleurs, rien.
// <ReglageLangue /> dans les Réglages : toutes les langues, toujours.
//
// Chaque langue s'écrit dans la sienne (« العربية », pas « Arabe »), comme
// dans les réglages d'un iPhone.

import { cn } from "@/lib/utils";
import { useIsClient } from "@/hooks/use-is-client";
import { useLangue, useT } from "@/lib/i18n/langue";
import { INFO_LANGUE, LANGUES } from "@/lib/i18n/langues";

export function ChoixLangue({ className }: { className?: string }) {
  const isClient = useIsClient();
  const { langue, proposees, choisir } = useLangue();
  const t = useT();
  if (!isClient || proposees.length < 2) return null;
  return (
    <div role="radiogroup" aria-label={t("Langue")} className={cn("glass-soft flex rounded-full p-[3px]", className)}>
      {proposees.map((l) => {
        const active = l === langue;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            lang={l}
            onClick={() => choisir(l)}
            className={cn(
              "min-w-[44px] rounded-full px-[11px] py-[5px] text-petit font-bold transition-colors",
              active ? "bg-foreground text-background" : "text-encre-3"
            )}
          >
            {INFO_LANGUE[l].court}
          </button>
        );
      })}
    </div>
  );
}

export function ReglageLangue() {
  const isClient = useIsClient();
  const { langue, choisir } = useLangue();
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t("Langue")} className="glass flex rounded-2xl p-1">
      {LANGUES.map((l) => {
        const active = isClient && l === langue;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            lang={l}
            onClick={() => choisir(l)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-xl py-3.5 text-ligne font-semibold",
              active ? "bouton-principal" : "bouton-discret text-encre-3"
            )}
          >
            <span className="relative">{INFO_LANGUE[l].nom}</span>
          </button>
        );
      })}
    </div>
  );
}
