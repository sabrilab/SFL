"use client";

// Les duels du dimanche, sous la feuille de match (fiche du match, Map) :
// les contrats acceptés des deux côtés (lib/sfl/missions.ts). Un contrat
// signé d'un seul côté n'apparaît pas ici ; toute la ligue le voit dans les
// Actus (Contrats en jeu, actus/contrats-en-jeu.tsx). Chacun y porte le
// maillot de son camp (lib/sfl/maillot-des-photos.ts).

import { CarteDe, FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useSeason } from "@/components/sfl/season-provider";
import { ANTON } from "@/components/sfl/actus/ecran";
import { useDuelsAcceptes } from "@/hooks/use-missions";
import { MAILLOTS, type Camp } from "@/lib/sfl/maillots";
import { cn } from "@/lib/utils";

function Cote({ nom, camp, droite }: { nom: string; camp: Camp; droite?: boolean }) {
  const { allPlayers } = useSeason();
  const p = allPlayers.find((x) => x.name === nom);
  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-2.5", droite && "flex-row-reverse text-right")}>
      {p ? (
        <MiniCarte player={p} size={FORMAT_CARTE.petite} onglet={MAILLOTS[camp]} maillot={camp} />
      ) : (
        <CarteDe name={nom} size={FORMAT_CARTE.petite} />
      )}
      <span className="line-clamp-2 min-w-0 text-[15px] leading-[1.15] font-bold break-words">
        <Nom n={nom} />
      </span>
    </span>
  );
}

export function DuelsDuJour({
  j,
  matchs,
}: {
  j: number | null | undefined;
  /** Une journée en plusieurs lieux : ses matchs dans celui-ci (0 = Match 1). */
  matchs?: number[];
}) {
  const duels = useDuelsAcceptes(j).filter((d) => !matchs || matchs.includes(d.terrain));
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
            className={cn("flex flex-col gap-2 px-4 py-3", i > 0 && "border-t border-contraste/8")}
          >
            <div className="flex items-center gap-2">
              <Cote nom={d.noirs} camp="Noirs" />
              <span className="shrink-0 text-[17px] leading-none text-foreground/35" style={{ fontFamily: ANTON }}>
                VS
              </span>
              <Cote nom={d.blancs} camp="Blancs" droite />
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
