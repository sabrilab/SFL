"use client";

// Les actus du club (Bola Club) : l'en-tête du club, ses trois onglets, le
// rail des catégories, puis le fil (components/sfl/club/fil-club.tsx).

import { Suspense } from "react";
import { PageClub } from "@/components/sfl/club/entete-club";
import { FilClub } from "@/components/sfl/club/fil-club";

export default function ClubPage() {
  // useSearchParams (?cat=) impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={null}>
      <PageClub onglet="actus">
        <FilClub />
      </PageClub>
    </Suspense>
  );
}
