"use client";

// Le nom d'un joueur tel que la ligue le voit : celui qu'il a confirmé (voir
// lib/sfl/identites), sinon son nom de saison. `n` : le nom de saison, la clé.

import { useIdentites } from "@/hooks/use-identites";

export function Nom({ n }: { n: string }) {
  return <>{useIdentites().nom(n)}</>;
}
