// Stripe pour Bola Plus (Sabri, 16/11/2026 : « je vais devoir connecter mon
// compte Stripe »). Sans dépendance : l'API REST de Stripe par fetch, et la
// signature du webhook vérifiée à la main (HMAC SHA-256, comme le fait la
// bibliothèque officielle). Rien ne s'allume tant que les variables ne sont
// pas posées dans Vercel :
//
//   STRIPE_SECRET_KEY        sk_live_… (ou sk_test_… pour essayer)
//   STRIPE_PRICE_MENSUEL     price_… : le prix mensuel (abonnement, chaque mois)
//   STRIPE_PRICE_ANNUEL      price_… : le prix annuel (abonnement, chaque année)
//   STRIPE_WEBHOOK_SECRET    whsec_… : la clé du webhook /api/stripe/webhook
//   NEXT_PUBLIC_BOLA_PLUS_PAIEMENT=1 : le bouton « S'abonner » remplace « Je suis intéressé »
//
// Aucune table : l'abonnement d'un joueur se lit chez Stripe (recherche par
// metadata.joueur, l'id du compte), si bien qu'aucune migration n'est
// nécessaire pour encaisser. Une table viendra quand l'app devra débloquer
// Bola Plus sans appeler Stripe (avec le ok de Sabri).
//
// Les montants ne sont jamais écrits ici : ils sont dans les prix créés par
// Sabri dans Stripe. lib/sfl/bola-plus.ts reste la source de ce que l'écran
// affiche ; les deux doivent dire la même chose.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Formule } from "@/lib/sfl/bola-plus";

const API = "https://api.stripe.com/v1";

export function stripeBranche(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_MENSUEL && !!process.env.STRIPE_PRICE_ANNUEL;
}

export function prixStripe(formule: Formule): string | null {
  return (formule === "annuel" ? process.env.STRIPE_PRICE_ANNUEL : process.env.STRIPE_PRICE_MENSUEL) ?? null;
}

/** Un appel à l'API Stripe, en formulaire (le format de Stripe). */
async function appel<T>(chemin: string, options: { methode?: "GET" | "POST"; corps?: URLSearchParams } = {}): Promise<T> {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) throw new Error("Stripe n'est pas branché.");
  const r = await fetch(`${API}${chemin}`, {
    method: options.methode ?? "GET",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2025-01-27.acacia" },
    body: options.corps,
    cache: "no-store",
  });
  const json = (await r.json()) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(json.error?.message ?? `Stripe ${r.status}`);
  return json;
}

/** La page de paiement Stripe (Checkout) pour un abonnement. */
export async function sessionPaiement(o: { formule: Formule; joueur: string; email: string | null; nom: string; origine: string }): Promise<string> {
  const prix = prixStripe(o.formule);
  if (!prix) throw new Error("Prix Stripe manquant.");
  const corps = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": prix,
    "line_items[0][quantity]": "1",
    client_reference_id: o.joueur,
    "metadata[joueur]": o.joueur,
    "metadata[nom]": o.nom,
    "metadata[formule]": o.formule,
    "subscription_data[metadata][joueur]": o.joueur,
    "subscription_data[metadata][nom]": o.nom,
    "subscription_data[metadata][formule]": o.formule,
    locale: "fr",
    allow_promotion_codes: "true",
    billing_address_collection: "auto",
    success_url: `${o.origine}/profil/bola-plus?paiement=ok`,
    cancel_url: `${o.origine}/profil/bola-plus?paiement=annule`,
  });
  if (o.email) corps.set("customer_email", o.email);
  const s = await appel<{ url: string }>("/checkout/sessions", { methode: "POST", corps });
  return s.url;
}

export interface Abonnement {
  statut: string;
  formule: string | null;
  fin: number | null;
}

/** L'abonnement en cours d'un joueur, lu chez Stripe (le plus récent qui est actif ou en essai). */
export async function abonnementDe(joueur: string): Promise<Abonnement | null> {
  // L'id du compte est un uuid : il ne contient pas d'apostrophe, la requête reste sûre.
  if (!/^[0-9a-f-]{36}$/i.test(joueur)) return null;
  const q = new URLSearchParams({ query: `metadata['joueur']:'${joueur}'`, limit: "10" });
  const r = await appel<{ data: { status: string; metadata?: Record<string, string>; current_period_end?: number; created: number }[] }>(`/subscriptions/search?${q}`);
  const vivant = r.data.filter((s) => s.status === "active" || s.status === "trialing" || s.status === "past_due").sort((a, b) => b.created - a.created)[0];
  if (!vivant) return null;
  return { statut: vivant.status, formule: vivant.metadata?.formule ?? null, fin: vivant.current_period_end ?? null };
}

/** Le webhook vient bien de Stripe ? En-tête « Stripe-Signature: t=…,v1=… », tolérance de 5 minutes. */
export function signatureValide(corps: string, entete: string | null, secret: string, maintenant = Date.now()): boolean {
  if (!entete) return false;
  const parts = Object.fromEntries(entete.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  const v1 = entete
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!Number.isFinite(t) || v1.length === 0) return false;
  if (Math.abs(maintenant / 1000 - t) > 300) return false;
  const attendu = createHmac("sha256", secret).update(`${t}.${corps}`).digest();
  return v1.some((sig) => {
    const recu = Buffer.from(sig, "hex");
    return recu.length === attendu.length && timingSafeEqual(recu, attendu);
  });
}
