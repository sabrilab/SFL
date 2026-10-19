"use client";

// La pastille du Vestiaire : combien de messages des autres depuis ma
// dernière lecture. Recomptée à l'ouverture, au retour dans l'app, à chaque
// message (temps réel) et dès que le Vestiaire est lu. Le même nombre va sur
// l'icône de l'app installée (pastille rouge de l'écran d'accueil, iOS 16.4+).

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
      void compterNonLus().then((x) => {
        if (!vivant) return;
        setN(x);
        pastilleIcone(x);
      });
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

function pastilleIcone(n: number) {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    void (n > 0 ? nav.setAppBadge?.(n) : nav.clearAppBadge?.())?.catch(() => {});
  } catch {
    /* navigateur sans pastille d'icône */
  }
}
