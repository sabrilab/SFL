"use client";

// Les duels du dimanche, sous la feuille de match (fiche du match, Map) :
// les contrats acceptés des deux côtés (lib/sfl/missions.ts). Un contrat
// accepté d'un seul côté reste entre son auteur et l'app : la base ne le
// montre à personne d'autre, et il n'apparaît pas ici.

import { CarteDe, FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useSeason } from "@/components/sfl/season-provider";
import { ANTON } from "@/components/sfl/actus/ecran";
import { useDuelsAcceptes } from "@/hooks/use-missions";
import { cn } from "@/lib/utils";

/** Les onglets de la feuille de match (lib/sfl/feuille.ts). */
const NOIRS = { fond: "#0A0B0D", encre: "#F4F5F2" };
const BLANCS = { fond: "#F4F3EF", encre: "#0A0B0D" };

function Cote({ nom, onglet, droite }: { nom: string; onglet: { fond: string; encre: string }; droite?: boolean }) {
  const { allPlayers } = useSeason();
  const p = allPlayers.find((x) => x.name === nom);
  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-2.5", droite && "flex-row-reverse text-right")}>
      {p ? (
        <MiniCarte player={p} size={FORMAT_CARTE.petite} onglet={onglet} />
      ) : (
        <CarteDe name={nom} size={FORMAT_CARTE.petite} />
      )}
      <span className="line-clamp-2 min-w-0 text-[15px] leading-[1.15] font-bold break-words">
        <Nom n={nom} />
      </span>
    </span>
  );
}

export function DuelsDuJour({ j }: { j: number | null | undefined }) {
  const duels = useDuelsAcceptes(j);
  if (!duels.length) return null;
  return (
    <section aria-labelledby="duels-du-jour" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h3 id="duels-du-jour" className="mono-label text-muted-foreground">
          {duels.length > 1 ? `${duels.length} duels` : "Un duel"}
        </h3>
      </div>
      <div className="glass flex flex-col overflow-hidden rounded-[22px]">
        {duels.map((d, i) => (
          <div
            key={`${d.noirs}-${d.blancs}`}
            className={cn("flex flex-col gap-2 px-4 py-3", i > 0 && "border-t border-white/8")}
          >
            <div className="flex items-center gap-2">
              <Cote nom={d.noirs} onglet={NOIRS} />
              <span className="shrink-0 text-[17px] leading-none text-foreground/35" style={{ fontFamily: ANTON }}>
                VS
              </span>
              <Cote nom={d.blancs} onglet={BLANCS} droite />
            </div>
            {duels.some((x) => x.label !== d.label) && (
              <span className="mono-label self-center text-[9px] text-foreground/40">{d.label}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
