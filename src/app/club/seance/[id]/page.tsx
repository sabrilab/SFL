"use client";

// Un match ou une séance du club (Bola Club), enfant de /club : convocation,
// appel, saisie rapide des stats (components/sfl/club/seance.tsx).

import { useParams } from "next/navigation";
import { SeanceDuClub } from "@/components/sfl/club/seance";

export default function SeanceClubPage() {
  const { id } = useParams<{ id: string }>();
  return <SeanceDuClub key={id} id={id} />;
}
