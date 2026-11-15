"use client";

// Les classements internes du club (Bola Club) : progression, assiduité,
// buteurs, au mois ou à la saison (components/sfl/club/classements-club.tsx).

import { Suspense } from "react";
import { ClassementsClub } from "@/components/sfl/club/classements-club";
import { PageClub } from "@/components/sfl/club/entete-club";

export default function ClassementsClubPage() {
  // useSearchParams (?cat=) impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={null}>
      <PageClub onglet="classements">
        <ClassementsClub />
      </PageClub>
    </Suspense>
  );
}
