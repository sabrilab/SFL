// Bola Club (bola-app#14), le club d'un licencié : /club et ses pages. Tout
// vit derrière le drapeau BOLA_CLUB (lib/sfl/club/drapeau.ts) : en
// production, chaque adresse d'ici affiche la page introuvable de l'app,
// sans une ligne du club, et rien d'autre de l'app ne lit le club. En aperçu et en développement, ouvrir /club suffit, connecté
// comme d'habitude (la porte de connexion n'est pas touchée) : rien à
// configurer. La pastille « Démo » (club/pastille-demo.tsx) dit qu'on
// regarde une démonstration et change de point de vue, en haut de la page.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PastilleDemo } from "@/components/sfl/club/pastille-demo";
import { BOLA_CLUB } from "@/lib/sfl/club/drapeau";

export default function ClubLayout({ children }: { children: React.ReactNode }) {
  if (!BOLA_CLUB) notFound();
  return (
    <>
      {/* useSearchParams (?role=) impose une frontière Suspense côté App Router. */}
      <Suspense fallback={null}>
        <PastilleDemo />
      </Suspense>
      {children}
    </>
  );
}
