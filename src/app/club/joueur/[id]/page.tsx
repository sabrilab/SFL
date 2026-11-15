"use client";

// La fiche d'un joueur du club (Bola Club), enfant de /club : sa carte, son
// évolution, ses présences, et pour son entraîneur ses notes privées, son
// poste, son surclassement (components/sfl/club/fiche-joueur-club.tsx).

import { useParams } from "next/navigation";
import { FicheJoueurClub } from "@/components/sfl/club/fiche-joueur-club";

export default function JoueurClubPage() {
  const { id } = useParams<{ id: string }>();
  return <FicheJoueurClub key={id} id={id} />;
}
