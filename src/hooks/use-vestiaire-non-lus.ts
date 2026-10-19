"use client";

// La pastille du Vestiaire : combien de messages des autres depuis ma
// dernière lecture. Recomptée à l'ouverture, au retour dans l'app, à chaque
// message (temps réel) et dès que le Vestiaire est lu.

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { EVT_LU, compterNonLus, ecouterVestiaire } from "@/lib/sfl/vestiaire";

export function useVestiaireNonLus(): number {
  const session = useSession();
  const [n, setN] = useState(0);
  const actif = !!session?.server && !session.enAttente;

  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    const compter = () => {
      if (document.visibilityState !== "visible") return;
      void compterNonLus().then((x) => vivant && setN(x));
    };
    compter();
    const stop = ecouterVestiaire(compter);
    window.addEventListener(EVT_LU, compter);
    document.addEventListener("visibilitychange", compter);
    return () => {
      vivant = false;
      stop();
      window.removeEventListener(EVT_LU, compter);
      document.removeEventListener("visibilitychange", compter);
    };
  }, [actif]);

  return actif ? n : 0;
}
