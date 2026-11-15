"use client";

// L'effectif du club (Bola Club) : tous les joueurs en cartes, filtrés et
// triés (components/sfl/club/effectif.tsx).

import { Suspense } from "react";
import { Effectif } from "@/components/sfl/club/effectif";
import { PageClub } from "@/components/sfl/club/entete-club";

export default function EffectifClubPage() {
  // useSearchParams (?cat=, ?tri=) impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={null}>
      <PageClub onglet="effectif">
        <Effectif />
      </PageClub>
    </Suspense>
  );
}
