"use client";

// Le nombre d'inscriptions qui attendent l'accord de l'admin : la marque de
// l'onglet Joueurs de la barre admin (components/sfl/admin/coquille.tsx).
// Même règle que la liste « À valider » (components/sfl/admin/inscriptions.tsx) :
// un profil pas encore validé, qui a fini son inscription (passé par Google
// ou Apple sans choisir son pseudo, ce n'est pas encore une demande).
//
// Relu au retour sur l'app et quand une inscription est acceptée ou refusée
// (signalerInscriptions, appelé par la liste). Sans session admin vérifiée
// par le serveur, la base ne dirait rien : 0.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/use-session";

const EVENEMENT = "sfl-inscriptions";

/** À appeler après avoir accepté ou refusé une inscription. */
export function signalerInscriptions() {
  window.dispatchEvent(new Event(EVENEMENT));
}

export function useInscriptionsEnAttente(): number {
  const session = useSession();
  const partage = !!(session?.server && session.admin);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!partage) return;
    let vivant = true;
    const lire = async () => {
      const { count, error } = await supabase()
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("valide", false)
        .eq("pseudo_a_choisir", false);
      if (vivant && !error) setN(count ?? 0);
    };
    void lire();
    const relire = () => void lire();
    window.addEventListener("focus", relire);
    window.addEventListener(EVENEMENT, relire);
    return () => {
      vivant = false;
      window.removeEventListener("focus", relire);
      window.removeEventListener(EVENEMENT, relire);
    };
  }, [partage]);

  return partage ? n : 0;
}
