"use client";

// Collection — les packs, le catalogue des cartes et l'achat à l'unité.
//
// C'était un onglet de l'Arène (duels, matchs, compo, collection). Sabri, le
// 22/10 : « Dans Arènes, on retire tout, on garde juste Collection. » Il ne
// reste donc que la collection, à sa propre adresse ; /duel y mène.

import { CollectionPanel } from "@/components/sfl/collection-panel";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useMyPlayer } from "@/components/sfl/player-provider";

export default function CollectionPage() {
  const { me } = useMyPlayer();
  return (
    <div className="shell flex flex-col gap-6 py-4 sm:py-8">
      <div className="flex items-center gap-3">
        <BoutonRetour />
        <h1 className="text-[30px] font-bold tracking-tight">Collection</h1>
      </div>
      <CollectionPanel me={me} />
    </div>
  );
}
