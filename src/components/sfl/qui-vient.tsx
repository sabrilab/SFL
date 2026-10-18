"use client";

// Qui vient : les joueurs d'un match à venir, en vraies cartes Bola (photo
// comprise), plutôt qu'en noms colorés. On reconnaît un visage avant un nom.
// Chaque carte s'ouvre en grand au toucher (MiniCarte).
//
// Un nom que la saison ne connaît pas encore (joueur pas évalué) garde une
// carte neutre à 75 : il est là, il a sa place dans la rangée.

import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
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
  size = FORMAT_CARTE.petite,
  className,
}: {
  noms: string[];
  /** Places encore libres : des cadres vides en bout de rangée. */
  places?: number;
  /** Échelle de la carte (voir FORMAT_CARTE ; 0.24 ≈ une pastille de 61 px). */
  size?: number;
  className?: string;
}) {
  const { allPlayers } = useSeason();
  const parNom = new Map(allPlayers.map((p) => [p.name, p]));
  // Le cadre libre a la silhouette de la carte au même format : carré en pastille.
  const w = Math.round(254 * size);
  const h = w < 70 ? w : Math.round(w * 1.617);
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
            className="border-[1.5px] border-dashed border-foreground/20"
            style={{ width: w, height: h, borderRadius: w < 70 ? w * 0.24 : 10 }}
          />
          <span className="text-[11px] text-muted-foreground">libre</span>
        </div>
      ))}
    </div>
  );
}
