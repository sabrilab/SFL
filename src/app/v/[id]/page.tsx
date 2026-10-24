// Le lien d'une vidéo de Bola, /v/<id> (lib/sfl/videos.ts) : ce que l'on
// partage sur Snapchat ou WhatsApp. Page publique (AuthGate), mais la vidéo
// n'y est pas : hors de l'app, on n'en voit que le titre, jamais une image.
// Connecté, on file au lecteur, dans les Actus ; sinon, se connecter ou
// créer son compte (par le parrain qui a partagé, ?de=<code>).
//
// Le serveur lit le titre avant d'envoyer la page : l'aperçu du lien le
// donne, sans image.

import type { Metadata } from "next";
import { cache } from "react";
import { LienVideo } from "./lien";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const CLE_PUBLIQUE =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

export interface InfoVideo {
  id: string;
  titre: string;
}

/** Le titre ; null : inconnue ou pas publiée ; « injoignable » : la base n'a pas répondu. */
const lire = cache(async (id: string): Promise<InfoVideo | null | "injoignable"> => {
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/video_info`, {
      method: "POST",
      headers: { apikey: CLE_PUBLIQUE, "Content-Type": "application/json" },
      body: JSON.stringify({ v: id }),
      cache: "no-store",
    });
    if (!r.ok) return "injoignable";
    return ((await r.json()) as InfoVideo | null) ?? null;
  } catch {
    return "injoignable";
  }
});

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ de?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const v = await lire(id.toLowerCase());
  const titre = v && v !== "injoignable" ? v.titre : "Une vidéo Bola";
  const description = "À voir dans l'app Bola.";
  return { title: { absolute: titre }, description, openGraph: { title: titre, description }, robots: { index: false } };
}

export default async function Page({ params, searchParams }: Props) {
  const [{ id }, { de }] = await Promise.all([params, searchParams]);
  const v = await lire(id.toLowerCase());
  return <LienVideo id={id.toLowerCase()} de={typeof de === "string" ? de : null} initial={v === "injoignable" ? undefined : v} />;
}
