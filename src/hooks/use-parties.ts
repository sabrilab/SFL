"use client";

// Les matchs ouverts par les joueurs, à jour en temps réel, et mon identifiant
// en base (pour savoir si j'en suis, si je l'organise, si je suis invité).
//
// Rien sans session serveur : les matchs vivent en base, et les règles RLS
// ont besoin de savoir qui demande. Le reste de la Map continue sans eux.

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { listerParties, monId, type Partie } from "@/lib/sfl/matchs";
import { supabase } from "@/lib/supabase";

let seq = 0;

export function useParties(): { parties: Partie[]; moi: string | null; actif: boolean; recharger: () => void } {
  const session = useSession();
  const actif = !!session?.server;
  const [parties, setParties] = useState<Partie[]>([]);
  const [moi, setMoi] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const recharger = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!actif) return;
    let fini = false;
    const charger = () =>
      listerParties()
        .then((p) => !fini && setParties(p))
        .catch(() => {
          /* base injoignable : la Map garde ce qu'elle a */
        });
    void monId().then((id) => !fini && setMoi(id));
    void charger();
    const sb = supabase();
    let canal: ReturnType<typeof sb.channel> | null = null;
    try {
      canal = sb
        .channel(`sfl-matchs-${++seq}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "matchs" }, charger)
        .on("postgres_changes", { event: "*", schema: "public", table: "match_joueurs" }, charger)
        .subscribe();
    } catch {
      // Sans temps réel, la liste se recharge à chaque action.
    }
    return () => {
      fini = true;
      if (canal) sb.removeChannel(canal);
    };
  }, [actif, tick]);

  return { parties: actif ? parties : [], moi: actif ? moi : null, actif, recharger };
}
