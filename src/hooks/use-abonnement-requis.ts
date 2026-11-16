"use client";

// Faut-il un abonnement Bola Plus pour répondre à la convocation ?
// (lib/sfl/sfl-payant.ts). L'abonnement se lit une fois par visite chez
// Stripe (/api/bola-plus/statut), seulement quand la réponse peut changer
// quelque chose : après la journée gratuite, ou en aperçu admin.

import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/use-session";
import { PAIEMENT_ACTIF } from "@/components/sfl/bola-plus-paiement";
import { isAdmin } from "@/lib/sfl/admin";
import { voitBolaPlus } from "@/lib/sfl/bola-plus";
import { abonnementRequis, apresJourneeGratuite, CLE_APERCU_PAYANT } from "@/lib/sfl/sfl-payant";

let lu: Promise<boolean | null> | null = null;

async function lireAbonnement(): Promise<boolean | null> {
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return null;
    const r = await fetch("/api/bola-plus/statut", { headers: { Authorization: `Bearer ${jeton}` } });
    if (!r.ok) return null;
    const json = (await r.json()) as { abonne?: boolean };
    return json.abonne === true;
  } catch {
    return null;
  }
}

function lireApercu(): boolean {
  try {
    return localStorage.getItem(CLE_APERCU_PAYANT) === "1";
  } catch {
    return false;
  }
}

const rien = () => () => {};

export function useAbonnementRequis(): boolean {
  const session = useSession();
  const nom = session?.name ?? null;
  const apercu = useSyncExternalStore(rien, lireApercu, () => false);
  const [maintenant, setMaintenant] = useState<number | null>(null);
  const [abonne, setAbonne] = useState<boolean | null>(null);

  useEffect(() => {
    const tick = () => setMaintenant(Date.now());
    Promise.resolve().then(tick);
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const utile =
    maintenant != null &&
    ((apercu && isAdmin(nom)) || (PAIEMENT_ACTIF && voitBolaPlus(nom) && !isAdmin(nom) && apresJourneeGratuite(maintenant)));

  useEffect(() => {
    if (!utile) return;
    let fini = false;
    lu ??= lireAbonnement();
    lu.then((a) => {
      if (!fini) setAbonne(a);
      if (a == null) lu = null;
    });
    return () => {
      fini = true;
    };
  }, [utile]);

  if (!utile || maintenant == null) return false;
  return abonnementRequis({ nom, maintenant, paiementActif: PAIEMENT_ACTIF, abonne, apercu });
}
