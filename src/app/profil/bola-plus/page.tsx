"use client";

// Bola Plus, enfant de Ma carte (lib/nav.ts) : la précommande (Sabri,
// 12/11/2026). Le retour, le titre, puis l'offre et « Je suis intéressé »
// (sfl/bola-plus.tsx). Aucun paiement.

import { OffreBolaPlus } from "@/components/sfl/bola-plus";
import { PageRubrique } from "@/components/sfl/ma-carte/rubriques";

export default function PageBolaPlus() {
  return (
    <PageRubrique titre="Bola Plus">
      <OffreBolaPlus />
    </PageRubrique>
  );
}
