"use client";

// Les divisions après la révélation du dimanche (02/11/2026, revelation.ts) :
// dans le dimanche des Actus, à la place du vote une fois qu'il est fini.
// Ceux qui montent ↑, ceux qui descendent ↓, avec leurs points du dimanche,
// puis toi. Tant que la journée ne compte pas, rien : les divisions ne
// bougent qu'à 19 h, toutes ensemble (Sabri, 02/11 : rien dès la fin des
// matchs). Modèle : l'ancienne rubrique actus/divisions.tsx (df5f0ff^), en
// plus court.

import { useSeason } from "@/components/sfl/season-provider";
import { PastilleDivision } from "@/components/sfl/metal-division";
import { Nom } from "@/components/sfl/nom";
import { dernierBilan, enPoints, phraseBilan, type Mouvement } from "@/lib/sfl/divisions";
import { isHidden } from "@/lib/sfl/hidden";
import { cn } from "@/lib/utils";

/** Au plus, par sens : les mieux classés d'abord. */
const MAX = 6;

function Ligne({ m }: { m: Mouvement }) {
  const monte = m.vers < m.de;
  return (
    <li className="flex items-center gap-2.5 py-1">
      <span className={cn("w-4 text-center text-[15px] font-bold", monte ? "text-[#1f8a4c] dark:text-[#84d68c]" : "text-[#c8352b] dark:text-[#FF6B5E]")} aria-hidden>
        {monte ? "↑" : "↓"}
      </span>
      <span className="min-w-0 flex-1 truncate text-corps font-semibold">
        <Nom n={m.nom} />
      </span>
      {m.joue && <span className="mono-label text-encre-3 tabular-nums">{`${m.points > 0 ? "+" : ""}${enPoints(m.points)}`}</span>}
      <PastilleDivision x={m.vers} className="h-[22px] min-w-[34px] rounded-[7px] text-[14px]" />
    </li>
  );
}

export function DivisionsApres({ j, me }: { j: number; me: string }) {
  const { divisions, revelation } = useSeason();
  const bilan = dernierBilan(divisions);
  if (!divisions || !bilan || bilan.j !== j || !revelation.comptees.has(j)) return null;
  const publics = [...bilan.parNom.values()].filter((m) => !isHidden(m.nom));
  const montent = publics.filter((m) => m.vers < m.de).sort((a, b) => a.rang - b.rang);
  const descendent = publics.filter((m) => m.vers > m.de).sort((a, b) => a.rang - b.rang);
  const toi = phraseBilan(divisions, bilan, me);
  return (
    <section className="glass mx-4 flex flex-col gap-3 rounded-[26px] p-[18px] md:mx-0">
      <h2 className="text-titre font-bold tracking-tight">
        Les divisions <span className="text-encre-3">· après la J{j}</span>
      </h2>
      {montent.length + descendent.length === 0 ? (
        <p className="text-corps text-encre-2">Personne ne change de division.</p>
      ) : (
        <ul className="flex flex-col">
          {montent.slice(0, MAX).map((m) => (
            <Ligne key={m.nom} m={m} />
          ))}
          {montent.length > MAX && <li className="mono-label py-1 pl-6 text-encre-3">+{montent.length - MAX}</li>}
          {descendent.slice(0, MAX).map((m) => (
            <Ligne key={m.nom} m={m} />
          ))}
          {descendent.length > MAX && <li className="mono-label py-1 pl-6 text-encre-3">+{descendent.length - MAX}</li>}
        </ul>
      )}
      {toi && <p className="border-t border-border/60 pt-3 text-corps font-semibold">{toi}.</p>}
    </section>
  );
}
