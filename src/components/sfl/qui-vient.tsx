"use client";

// Qui vient : les joueurs d'un match à venir, en vraies cartes Bola (photo
// comprise), plutôt qu'en noms colorés. On reconnaît un visage avant un nom.
// Chaque carte s'ouvre en grand au toucher (MiniCarte).
//
// Un nom que la saison ne connaît pas encore (joueur pas évalué) garde une
// carte neutre à 75 : il est là, il a sa place dans la rangée.

import { MiniCarte } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

function carteNeutre(name: string): Player {
  return {
    name,
    poste: "—",
    pp: 0,
    matchs: 0,
    buts: 0,
    passes: 0,
    statut: "Actif",
    stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 },
    mvp: 0,
    impact: 0,
    def: 0,
  };
}

export function QuiVient({
  noms,
  places = 0,
  size = 0.24,
  className,
}: {
  noms: string[];
  /** Places encore libres : des cadres vides en bout de rangée. */
  places?: number;
  /** Échelle de la carte (0.24 ≈ 61 × 91 px). */
  size?: number;
  className?: string;
}) {
  const { allPlayers } = useSeason();
  const parNom = new Map(allPlayers.map((p) => [p.name, p]));
  const w = Math.round(255 * size);
  const h = Math.round(380 * size);
  return (
    <div className={cn("-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]", className)}>
      {noms.map((nom) => (
        <div key={nom} className="flex shrink-0 flex-col items-center gap-1">
          <MiniCarte player={parNom.get(nom) ?? carteNeutre(nom)} size={size} />
          <span className="max-w-[72px] truncate text-[11px] font-semibold">{nom}</span>
        </div>
      ))}
      {Array.from({ length: Math.min(places, 10) }, (_, i) => (
        <div key={`libre-${i}`} className="flex shrink-0 flex-col items-center gap-1" aria-hidden>
          <span
            className="rounded-[10px] border-[1.5px] border-dashed border-foreground/20"
            style={{ width: w, height: h }}
          />
          <span className="text-[11px] text-muted-foreground">libre</span>
        </div>
      ))}
    </div>
  );
}
