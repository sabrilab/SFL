// Le lien d'un parrain, /p/<code> (lib/sfl/parrainage.ts) : ce que chaque
// joueur partage pour faire venir quelqu'un dans Bola. Page publique (hors de
// la porte de connexion, voir AuthGate).
//
// Le serveur lit qui invite avant d'envoyer la page : l'aperçu du lien dans
// WhatsApp ou Snapchat (titre, description) le dit déjà. La page elle-même
// est dans lien.tsx.

import type { Metadata } from "next";
import { cache } from "react";
import type { Parrain } from "@/lib/sfl/parrainage";
import { LienParrain } from "./lien";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const CLE_PUBLIQUE =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

/** Qui invite ; « injoignable » : la base n'a pas répondu (ou ne connaît pas encore la fonction). */
const lire = cache(async (code: string): Promise<Parrain | null | "injoignable"> => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/parrain_info`, {
      method: "POST",
      headers: { apikey: CLE_PUBLIQUE, "Content-Type": "application/json" },
      body: JSON.stringify({ c: code }),
      cache: "no-store",
    });
    if (!r.ok) return "injoignable";
    return ((await r.json()) as Parrain | null) ?? null;
  } catch {
    return "injoignable";
  }
});

type Props = { params: Promise<{ code: string }> };

function normaliser(brut: string): string {
  try {
    return decodeURIComponent(brut).trim().toLowerCase();
  } catch {
    return brut.toLowerCase();
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const p = await lire(normaliser(code));
  if (!p || p === "injoignable") return { title: "Rejoins Bola" };
  const titre = `${p.affiche} t'invite sur Bola`;
  const description = p.sfl ? "Crée ta carte. Bola Team offert." : "Crée ta carte et joue près de chez toi.";
  return { title: { absolute: titre }, description, openGraph: { title: titre, description } };
}

export default async function Page({ params }: Props) {
  const { code } = await params;
  const normalise = normaliser(code);
  const p = await lire(normalise);
  return <LienParrain code={normalise} initial={p === "injoignable" ? undefined : p} />;
}
