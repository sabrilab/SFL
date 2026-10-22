// La politique de confidentialité, en entier, ouverte à tous (AuthGate) : le
// texte est dans components/sfl/confidentialite/politique.tsx.

import type { Metadata } from "next";
import { PagePolitique } from "@/components/sfl/confidentialite/page-politique";
import { TextePolitique } from "@/components/sfl/confidentialite/politique";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Ce que Bola garde sur toi, pourquoi, qui le voit, et comment tout reprendre.",
};

export default function ConfidentialitePage() {
  return (
    <PagePolitique>
      <TextePolitique />
    </PagePolitique>
  );
}
