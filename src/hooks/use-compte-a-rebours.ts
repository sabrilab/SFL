"use client";

// Le temps qui reste avant la fin du prix premiers joueurs
// (lib/sfl/compte-a-rebours.ts), relu chaque seconde. Avant l'hydratation, et
// côté serveur, rien (null) : l'heure du téléphone seule fait foi.

import { useEffect, useState } from "react";
import { FIN_PREMIERS_JOUEURS, resteAvant, type Reste } from "@/lib/sfl/compte-a-rebours";

export function useCompteARebours(fin: number = FIN_PREMIERS_JOUEURS): Reste | null {
  const [reste, setReste] = useState<Reste | null>(null);
  useEffect(() => {
    const lire = () => setReste(resteAvant(fin, Date.now()));
    lire();
    const id = window.setInterval(lire, 1000);
    return () => window.clearInterval(id);
  }, [fin]);
  return reste;
}
