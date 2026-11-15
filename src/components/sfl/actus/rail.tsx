"use client";

// Le rail collé en haut d'un fil : une rangée de puces qu'on fait défiler,
// celle qu'on lit à l'encre pleine, les autres cerclées d'un trait fin. Le
// nom en Anton, et à côté, une étiquette (« à venir », la date d'un
// dimanche). Né avec le rail des journées des Actus (course.tsx,
// RailJournees ; Sabri, 26/10 : que ce soit « facile […] de bien s'y
// retrouver »), sorti ici le 12/11/2026 pour servir aussi au rail des
// catégories de Bola Club (club/rail-categories.tsx), au pixel près. Ce
// composant ne fait que dessiner : celui qui l'appelle sait quelle puce est
// lue, et ce que fait un toucher. `ref` : la rangée qui défile.

import type { Ref } from "react";
import { cn } from "@/lib/utils";
import { ANTON } from "./ecran";

export interface PuceDeRail {
  id: string;
  label: string;
  /** L'étiquette d'à côté : « à venir », une date ; null : le nom seul. */
  sous?: string | null;
}

export function Rail({
  nom,
  puces,
  active,
  onChoisir,
  ref,
}: {
  /** Son nom, pour le lecteur d'écran : « Journées », « Catégories ». */
  nom: string;
  puces: PuceDeRail[];
  active: string | undefined;
  onChoisir: (id: string) => void;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <nav
      aria-label={nom}
      className="sticky top-0 z-30 -my-3 border-b border-foreground/[0.08] bg-background/85 backdrop-blur-xl md:-my-[var(--fib-13,13px)] md:rounded-full md:border md:px-1.5"
    >
      <div ref={ref} className="flex gap-1.5 overflow-x-auto px-5 py-2 [scrollbar-width:none] md:px-0">
        {puces.map((e) => {
          const ici = e.id === active;
          return (
            <button
              key={e.id}
              type="button"
              data-etape={e.id}
              aria-current={ici ? "true" : undefined}
              onClick={() => onChoisir(e.id)}
              className={cn(
                "flex h-9 shrink-0 items-baseline gap-1.5 rounded-full px-3.5 pt-[7px] transition-colors duration-300",
                ici ? "bg-foreground text-background" : "text-encre-3 ring-1 ring-foreground/[0.12] ring-inset",
              )}
            >
              <span className="text-titre leading-none" style={{ fontFamily: ANTON }}>
                {e.label}
              </span>
              {e.sous && <span className={cn("mono-label text-etiquette", ici ? "text-background/65" : "text-encre-3")}>{e.sous}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
