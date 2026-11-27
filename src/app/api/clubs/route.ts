// Demande de démo Bola Club — SERVEUR, PUBLIQUE (27/11/2026).
//
// Le formulaire de getbola.app/club (components/sfl/page-club) arrive ici :
// la route relit la demande avec les mêmes règles que l'écran
// (lib/sfl/page-club.ts, erreurDemande) et la range dans la table
// club_demandes, que seul l'admin lit. L'écriture passe par la clé secrète de
// Supabase (serveur(), production seulement) : la table n'a aucune écriture
// ouverte au navigateur.
//
// Sans clé (un aperçu Vercel, un build local), rien n'est écrit : la route
// répond « essai » et l'écran dit merci comme en production, pour qu'on
// puisse voir la page entière sans toucher à la base.
//
// Un champ piège invisible (site) écarte les robots ; la même adresse pour le
// même club dans les dix minutes ne fait pas deux lignes.

import { NextRequest, NextResponse } from "next/server";
import { serveur } from "@/lib/sfl/serveur-ligue.server";
import { erreurDemande, nettoyerDemande } from "@/lib/sfl/page-club";

export async function POST(req: NextRequest) {
  const corps = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corps) return NextResponse.json({ error: "Formulaire illisible." }, { status: 400 });
  if (corps.site) return NextResponse.json({ error: "Refusé." }, { status: 400 });

  const d = nettoyerDemande(corps);
  const erreur = erreurDemande(d);
  if (erreur) return NextResponse.json({ error: erreur.texte, champ: erreur.champ }, { status: 400 });

  const source = typeof corps.source === "string" && /^[a-z0-9._-]{1,60}$/.test(corps.source) ? corps.source : null;

  const sb = serveur();
  if (!sb) return NextResponse.json({ ok: true, essai: true });

  try {
    const depuis = new Date(Date.now() - 10 * 60_000).toISOString();
    const { data: deja } = await sb
      .from("club_demandes")
      .select("id")
      .eq("email", d.email)
      .eq("club", d.club)
      .gte("created_at", depuis)
      .limit(1);
    if (deja && deja.length > 0) return NextResponse.json({ ok: true });

    const { error } = await sb.from("club_demandes").insert({
      club: d.club,
      ville: d.ville,
      pays: d.pays,
      licencies: d.licencies,
      nom: d.nom,
      role: d.role,
      email: d.email,
      telephone: d.telephone || null,
      message: d.message || null,
      source,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "L’envoi n’est pas passé. Réessayez dans un instant." }, { status: 502 });
  }
}
