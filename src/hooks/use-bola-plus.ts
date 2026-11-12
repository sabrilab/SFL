"use client";

// Mon intérêt pour Bola Plus (lib/sfl/bola-plus-store.ts) : lu une fois pour
// toute l'app, partagé entre la tuile de Ma carte et la page Bola Plus.
//
// L'intérêt appartient au compte connecté (la session), pas au profil que
// l'admin regarde : la base écrit sous l'identité de celui qui touche.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import type { Formule, Interet } from "@/lib/sfl/bola-plus";
import { annulerInteret, APERCU, BOLA_PLUS_EVENT, chargerInteret, interetEnMemoire, noterInteret } from "@/lib/sfl/bola-plus-store";
import { tic } from "@/lib/sfl/haptique";

function abonner(onChange: () => void) {
  window.addEventListener(BOLA_PLUS_EVENT, onChange);
  return () => window.removeEventListener(BOLA_PLUS_EVENT, onChange);
}

export interface BolaPlus {
  /** Mon intérêt ; null si je n'ai rien noté (ou tant que ce n'est pas lu). */
  interet: Interet | null;
  /** « Je suis intéressé », ou changer de formule une fois noté. */
  noter: (formule: Formule | null) => void;
  annuler: () => void;
  /** Une écriture est en route : les boutons attendent. */
  occupe: boolean;
}

export function useBolaPlus(): BolaPlus {
  const session = useSession();
  const nom = session?.name ?? null;
  // En production, seul un compte vérifié par le serveur a une ligne à lire.
  const lisible = !!nom && (APERCU || !!session?.server);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    if (lisible && nom) void chargerInteret(nom);
  }, [lisible, nom]);

  const interet = useSyncExternalStore(
    abonner,
    () => (nom ? (interetEnMemoire(nom) ?? null) : null),
    () => null
  );

  const ecrire = useCallback(
    (geste: (nom: string) => Promise<void>) => {
      if (!nom || occupe) return;
      tic();
      setOccupe(true);
      geste(nom)
        .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Pas enregistré."))
        .finally(() => setOccupe(false));
    },
    [nom, occupe]
  );

  const noter = useCallback((formule: Formule | null) => ecrire((n) => noterInteret(n, formule)), [ecrire]);
  const annuler = useCallback(() => ecrire(annulerInteret), [ecrire]);

  return { interet, noter, annuler, occupe };
}
