"use client";

// Choisir le style des cartes, depuis Ma carte : sa propre carte dans chaque
// style, côte à côte, et on touche celle qu'on veut. Le choix vaut pour
// toutes les cartes de la ligue, sur cet appareil (lib/sfl/style-carte).

import { useState } from "react";
import { Check } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { PlayerCard } from "@/components/sfl/player-card";
import { StyleForce, useStyleCarte } from "@/hooks/use-style-carte";
import { NOMS_STYLE, STYLES_CARTE, choisirStyle, type StyleCarte } from "@/lib/sfl/style-carte";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

/** La carte d'un joueur dans un style donné, le temps de la montrer. */
function CarteDansStyle({ player, style, size }: { player: Player; style: StyleCarte; size: number }) {
  // PlayerCard lit le style courant ; on le force pour cette seule vignette.
  return (
    <StyleForce style={style}>
      <PlayerCard player={player} size={size} />
    </StyleForce>
  );
}

export function ChoixStyle({ player, className }: { player: Player; className?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const actif = useStyleCarte();

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={cn("glass-soft rounded-full py-[15px] text-center text-[15px] font-semibold text-foreground/70", className)}
      >
        Style
      </button>

      <Sheet open={ouvert} onOpenChange={setOuvert}>
        <SheetContent side="bottom" className="mx-auto max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] px-0 pt-6 pb-8 sm:max-w-xl">
          <SheetTitle className="px-5 text-[19px] font-extrabold tracking-tight">Le style des cartes</SheetTitle>
          <div className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
            {STYLES_CARTE.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => choisirStyle(s)}
                aria-pressed={actif === s}
                // À l'ouverture, la rangée s'arrête sur le style en cours.
                ref={actif === s ? (el) => el?.scrollIntoView({ inline: "center", block: "nearest" }) : undefined}
                className="flex shrink-0 snap-center flex-col items-center gap-3 outline-none"
              >
                <span
                  className={cn(
                    "rounded-[22px] p-[5px] transition-colors",
                    actif === s ? "ring-2 ring-foreground" : "ring-1 ring-transparent"
                  )}
                >
                  <CarteDansStyle player={player} style={s} size={0.7} />
                </span>
                <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                  {NOMS_STYLE[s]}
                  {actif === s && <Check className="size-4" aria-hidden />}
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
