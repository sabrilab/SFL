"use client";

// « S'abonner » à Bola Plus : la page de paiement Stripe
// (/api/bola-plus/paiement, lib/server/stripe.server.ts). Le bouton ne
// remplace « Je suis intéressé » (sfl/bola-plus.tsx) que lorsque
// NEXT_PUBLIC_BOLA_PLUS_PAIEMENT vaut 1 dans Vercel. Le nom du prestataire
// n'apparaît jamais à l'écran : seulement sur sa propre page de paiement.

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Formule } from "@/lib/sfl/bola-plus";
import { metadataIci } from "@/lib/sfl/bola-plus-parcours-store";

/** Le paiement Stripe est ouvert (NEXT_PUBLIC_BOLA_PLUS_PAIEMENT=1, posé dans Vercel quand les clés y sont). */
export const PAIEMENT_ACTIF = process.env.NEXT_PUBLIC_BOLA_PLUS_PAIEMENT === "1";

/** « S'abonner » : la page de paiement Stripe (/api/bola-plus/paiement), puis retour sur la page. */
export function BoutonSAbonner({ formule }: { formule: Formule }) {
  const [enCours, setEnCours] = useState(false);
  async function payer() {
    if (enCours) return;
    setEnCours(true);
    try {
      const { data } = await supabase().auth.getSession();
      const jeton = data.session?.access_token;
      if (!jeton) throw new Error("Reconnecte-toi, puis réessaie.");
      const r = await fetch("/api/bola-plus/paiement", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ formule, parcours: metadataIci() }),
      });
      const json = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !json.url) throw new Error(json.error ?? "Le paiement n'a pas pu s'ouvrir.");
      window.location.assign(json.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Le paiement n'a pas pu s'ouvrir.");
      setEnCours(false);
    }
  }
  return (
    <button type="button" onClick={payer} aria-disabled={enCours || undefined} className="bouton-principal h-[52px] w-full text-lecture font-bold aria-disabled:opacity-40">
      S&apos;abonner
    </button>
  );
}
