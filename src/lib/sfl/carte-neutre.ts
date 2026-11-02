// La carte d'un nom que la saison ne connaît pas (un compte de Bola, un
// joueur pas encore évalué) : base 75 partout, comme un nouveau de la saison.
// Hors de qui-vient.tsx pour que les hooks la lisent sans tirer les composants.

import type { Player } from "@/lib/sfl/engine";

export function carteNeutre(name: string): Player {
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
