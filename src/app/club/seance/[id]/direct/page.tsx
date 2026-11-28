"use client";

// Le match en direct de l'entraîneur (Bola Club), enfant d'un match :
// compo, chrono, changements, notes sur l'adversaire (components/sfl/club/direct.tsx).

import { useParams } from "next/navigation";
import { DirectDuMatch } from "@/components/sfl/club/direct";

export default function DirectClubPage() {
  const { id } = useParams<{ id: string }>();
  return <DirectDuMatch key={id} id={id} />;
}
