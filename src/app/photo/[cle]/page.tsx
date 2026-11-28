// Le lien d'une photo de journée, /photo/<clé> (« j7-365 »,
// lib/sfl/photos-echos.ts) : ce que l'on colle dans une story Instagram ou
// Snapchat, ou qu'on envoie (Bola, 28/11/2026). Page publique (AuthGate).
//
// La photo ne s'y montre, et ne sert d'aperçu au lien, que si elle peut
// sortir de l'app (photo_peut_sortir : chacun de ses joueurs a accepté
// l'usage hors de l'app et n'a pas mis ses photos en privé). Sinon, comme le
// lien d'une vidéo (/v/<id>) : la journée, sans image. Connecté, on file au
// fil de sa journée, dans les Actus.

import type { Metadata } from "next";
import { cache } from "react";
import { photoDeCle } from "@/lib/sfl/photos-journees";
import { LienPhoto } from "./lien";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const CLE_PUBLIQUE =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

/** La photo peut-elle se montrer hors de l'app ? Au moindre doute, non. */
const sortable = cache(async (noms: string[]): Promise<boolean> => {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/photo_peut_sortir`, {
      method: "POST",
      headers: { apikey: CLE_PUBLIQUE, "Content-Type": "application/json" },
      body: JSON.stringify({ noms }),
      cache: "no-store",
    });
    return r.ok && (await r.json()) === true;
  } catch {
    return false;
  }
});

type Props = { params: Promise<{ cle: string }>; searchParams: Promise<{ de?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cle } = await params;
  const p = photoDeCle(cle);
  const titre = p ? `La J${p.journee}, dans Bola` : "Une photo Bola";
  const description = "Sunday Five League. À voir dans l'app Bola.";
  const image = p && (await sortable(p.joueurs)) ? [{ url: p.src, width: p.largeur, height: p.hauteur }] : undefined;
  return {
    title: { absolute: titre },
    description,
    openGraph: { title: titre, description, images: image },
    twitter: { card: image ? "summary_large_image" : "summary", title: titre, description, images: image?.map((i) => i.url) },
    robots: { index: false },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const [{ cle }, { de }] = await Promise.all([params, searchParams]);
  const p = photoDeCle(cle);
  const montrer = p ? await sortable(p.joueurs) : false;
  return (
    <LienPhoto
      cle={cle.toLowerCase()}
      photo={p ? { src: montrer ? p.src : null, journee: p.journee, date: p.date, largeur: p.largeur, hauteur: p.hauteur } : null}
      de={typeof de === "string" ? de : null}
    />
  );
}
