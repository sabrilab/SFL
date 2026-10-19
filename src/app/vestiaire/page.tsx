"use client";

// Le Vestiaire, sa page : la bulle à droite de la barre d'onglets
// (bottom-nav.tsx). Tout est dans components/sfl/vestiaire.tsx ; une feuille
// de match touchée dans le fil ouvre sa journée dans la Ligue.

import { useRouter } from "next/navigation";
import { Vestiaire } from "@/components/sfl/vestiaire";

export default function VestiairePage() {
  const router = useRouter();
  return <Vestiaire onOuvrirJournee={(j) => router.push(`/ligue?j=${j}`)} />;
}
