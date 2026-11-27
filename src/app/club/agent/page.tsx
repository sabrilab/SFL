"use client";

// L'agent de l'entraîneur (Bola Club), enfant de /club : sa discussion sur son
// équipe (components/sfl/club/agent-club.tsx).

import { Suspense } from "react";
import { AgentClub } from "@/components/sfl/club/agent-club";

export default function AgentClubPage() {
  return (
    <Suspense>
      <AgentClub />
    </Suspense>
  );
}
