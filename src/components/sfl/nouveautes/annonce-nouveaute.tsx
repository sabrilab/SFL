"use client";

// Les diapos de chaque nouveauté annoncée (lib/sfl/nouveautes.ts). Une
// nouveauté de plus : son entrée dans NOUVEAUTES, ses diapos dans un fichier à
// elle, et sa ligne ici. Seulement si Sabri a dit de l'annoncer. `aller` : le
// geste qui mène où elle se trouve, sous « C'est compris » ; avec
// `principal`, c'est lui le bouton principal (le parrainage : « Inviter »).

import type { ReactNode } from "react";
import type { Player } from "@/lib/sfl/engine";
import type { Aller } from "@/lib/sfl/nouveautes";
import { Diaporama, type Diapo } from "./diaporama";
import { diaposJourneesEtBlessures } from "./journees-et-blessures";
import { diaposNouveautes2710 } from "./nouveautes-27-10";
import { diaposConfirmerResultats } from "./confirmer-resultats";
import { diaposCarteBola } from "./carte-bola";
import { diaposParrainage } from "./parrainage";

const DIAPOS: Record<string, { diapos: (player: Player) => Diapo[]; aller?: Aller }> = {
  "journees-et-blessures": { diapos: diaposJourneesEtBlessures, aller: { label: "Voir Ma carte", href: "/profil" } },
  "nouveautes-27-10": { diapos: diaposNouveautes2710, aller: { label: "Voir Ma carte", href: "/profil/xp?vue=autres" } },
  "confirmer-resultats": { diapos: diaposConfirmerResultats, aller: { label: "Voir Bola", href: "/ligue-vierge" } },
  "carte-bola": { diapos: diaposCarteBola, aller: { label: "Voir mes missions", href: "/profil/xp?vue=missions" } },
  parrainage: { diapos: diaposParrainage, aller: { label: "Inviter", href: "/parrainage", principal: true } },
};

export function AnnonceNouveaute({ id, player, onFini }: { id: string; player: Player; onFini: () => void }): ReactNode {
  const n = DIAPOS[id];
  if (!n) return null;
  return <Diaporama diapos={n.diapos(player)} aller={n.aller} onFini={onFini} />;
}
