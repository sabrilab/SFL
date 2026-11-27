"use client";

// Le bilan d'un entraînement (Bola Club), l'onglet « Bilan » de sa page à
// partir du jour de la séance : le ressenti du groupe, de 1 (facile) à 10
// (épuisant), et la remarque de l'entraîneur (lib/sfl/club/suivi.ts). Un
// ressenti de 8 et plus rend la séance suivante plus douce quand on la
// propose (proposition.ts). « Enregistrer » dans une bande au bas de l'écran.

import { useState } from "react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { bilanSeance } from "@/lib/sfl/club/mutations";
import { RESSENTI_DUR } from "@/lib/sfl/club/suivi";
import type { Seance } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CHAMP, NOMBRE } from "./puces";

const MOTS: Record<number, string> = { 1: "Très facile", 3: "Facile", 5: "Moyen", 7: "Dur", 9: "Très dur", 10: "Épuisant" };

export function BilanSeance({ s }: { s: Seance }) {
  const { agir } = useClub();
  const [ressenti, setRessenti] = useState<number | null>(s.bilan?.ressenti ?? null);
  const [remarque, setRemarque] = useState(s.bilan?.remarque ?? "");
  const sale = ressenti !== (s.bilan?.ressenti ?? null) || remarque !== (s.bilan?.remarque ?? "");
  const enregistrer = () => {
    if (ressenti === null || !agir((c, moi) => bilanSeance(c, moi, s.id, ressenti, remarque))) return;
    navigator.vibrate?.([10, 40, 18]);
    toast.success("Bilan enregistré");
  };
  const mot = ressenti === null ? null : (MOTS[ressenti] ?? MOTS[ressenti - 1]);
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono-label text-encre-3">Ressenti du groupe</span>
          {ressenti !== null && (
            <span className="flex items-baseline gap-2">
              <span className="text-corps text-encre-2">{mot}</span>
              <span style={{ ...NOMBRE, fontSize: 30 }} className="tabular-nums">
                {ressenti}
                <span className="text-[18px] text-encre-3">/10</span>
              </span>
            </span>
          )}
        </div>
        <div role="radiogroup" aria-label="Ressenti du groupe" className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={ressenti === n}
              onClick={() => setRessenti(n)}
              className={cn("h-11 text-lecture font-semibold tabular-nums", ressenti === n ? "bouton-principal" : "bouton-secondaire text-encre-2")}
            >
              {n}
            </button>
          ))}
        </div>
        {ressenti !== null && ressenti >= RESSENTI_DUR && <span className="text-corps text-encre-2">La prochaine séance proposée sera plus douce.</span>}
      </div>
      <textarea
        aria-label="Remarque"
        placeholder="Remarque"
        value={remarque}
        onChange={(e) => setRemarque(e.target.value)}
        rows={4}
        maxLength={500}
        className={cn(CHAMP, "resize-none")}
      />
      <div className="sticky bottom-0 z-20 -mx-5 -mb-4 bg-gradient-to-t from-background from-[82%] to-transparent px-5 pt-7 pb-[calc(env(safe-area-inset-bottom,0px)+104px)]">
        <button type="button" disabled={ressenti === null || !sale} onClick={enregistrer} className="bouton-principal h-12 w-full text-[15px] font-semibold">
          Enregistrer
        </button>
      </div>
    </>
  );
}
