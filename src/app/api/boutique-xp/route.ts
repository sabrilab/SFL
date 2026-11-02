// Ouvrir le PACK AFRIQUE 2027 (lib/sfl/pack-afrique.ts) : payé en XP, jamais
// en Ballons ni en euros, jamais gagné par les missions ni par le Passe.
//
// POST { article, cle } :
//   1. une session de membre validé ; le nom vient de profiles ;
//   2. le compte vitrine n'achète rien (403) : son XP est fictive ;
//   3. l'XP gagnée à vie est recalculée ici (lib/sfl/xp-serveur.server.ts,
//      le même journal que le téléphone), jamais lue sur le téléphone ;
//   4. ouvrir_pack_xp (supabase/schema.sql) débite et tire au sort côté
//      serveur, d'un seul tenant, parmi les nations validées qui manquent ;
//      la même clé rejouée rend le même tirage sans second débit ;
//   5. rend { obtenu, serie, solde, deja } ; un refus : 402 « XP
//      insuffisante. » avec le solde réel, 409 « Pack complet. ».

import { NextRequest, NextResponse } from "next/server";
import { COMPTES_VITRINE } from "@/lib/sfl/compte-vitrine";
import { nationsEnJeu, PACK_AFRIQUE } from "@/lib/sfl/pack-afrique";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { bilanServeurDe, xpServeur } from "@/lib/sfl/xp-serveur.server";

export const maxDuration = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const corps = (await req.json().catch(() => null)) as { article?: unknown; cle?: unknown } | null;
  if (corps?.article !== PACK_AFRIQUE.article || typeof corps.cle !== "string" || !UUID.test(corps.cle))
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  const { data: profil } = await sb.from("profiles").select("name, valide").eq("id", moi.id).maybeSingle();
  const p = profil as { name: string; valide: boolean } | null;
  if (!p?.valide || !p.name) return NextResponse.json({ error: "Réservé aux joueurs de la ligue." }, { status: 403 });
  if ((COMPTES_VITRINE as readonly string[]).includes(p.name)) return NextResponse.json({ error: "Compte vitrine." }, { status: 403 });
  const choix = nationsEnJeu();
  if (!choix.length) return NextResponse.json({ error: "Pas encore ouvert." }, { status: 409 });

  const jeton = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const maintenant = new Date();
  let gagnee: number;
  try {
    const x = await xpServeur(sb, { id: moi.id, nom: p.name, jeton }, maintenant);
    gagnee = bilanServeurDe(x, p.name, maintenant).total;
  } catch {
    return NextResponse.json({ error: "Réessaie." }, { status: 503 });
  }

  const { data, error } = await sb.rpc("ouvrir_pack_xp", {
    p_joueur: moi.id,
    p_article: PACK_AFRIQUE.article,
    p_prix: PACK_AFRIQUE.prix,
    p_gagne: gagnee,
    p_choix: choix,
    p_cle: corps.cle,
  });
  if (error) {
    if (error.message.includes("XP insuffisante")) {
      const solde = Number(error.details ?? NaN);
      return NextResponse.json({ error: "XP insuffisante.", solde: Number.isFinite(solde) ? solde : null, gagnee }, { status: 402 });
    }
    if (error.message.includes("Pack complet")) return NextResponse.json({ error: "Pack complet." }, { status: 409 });
    return NextResponse.json({ error: "Réessaie." }, { status: 500 });
  }
  const r = data as { obtenu: string; serie: number; xp: number; solde: number; deja: boolean };
  return NextResponse.json({ obtenu: r.obtenu, serie: r.serie, xp: r.xp, solde: Math.max(0, r.solde), deja: r.deja, gagnee });
}
