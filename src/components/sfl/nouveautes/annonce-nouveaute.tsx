"use client";

// Les diapos de chaque nouveauté annoncée (lib/sfl/nouveautes.ts). Une
// nouveauté de plus : son entrée dans NOUVEAUTES, ses diapos dans un fichier à
// elle, et sa ligne ici. Seulement si Sabri a dit de l'annoncer.

import type { ReactNode } from "react";
import type { Player } from "@/lib/sfl/engine";
import { Diaporama, type Diapo } from "./diaporama";
import { diaposJourneesEtBlessures } from "./journees-et-blessures";
import { diaposNouveautes2710 } from "./nouveautes-27-10";
import { diaposConfirmerResultats } from "./confirmer-resultats";

const DIAPOS: Record<string, { diapos: (player: Player) => Diapo[]; aller?: { label: string; href: string } }> = {
  "journees-et-blessures": { diapos: diaposJourneesEtBlessures, aller: { label: "Voir Ma carte", href: "/profil" } },
  "nouveautes-27-10": { diapos: diaposNouveautes2710, aller: { label: "Voir Ma carte", href: "/profil/xp?vue=autres" } },
  "confirmer-resultats": { diapos: diaposConfirmerResultats, aller: { label: "Voir Bola", href: "/ligue-vierge" } },
};

export function AnnonceNouveaute({ id, player, onFini }: { id: string; player: Player; onFini: () => void }): ReactNode {
  const n = DIAPOS[id];
  if (!n) return null;
  return <Diaporama diapos={n.diapos(player)} aller={n.aller} onFini={onFini} />;
}
