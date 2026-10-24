// Envoi d'une notification à tous les téléphones abonnés — admin seulement.
//
// Appelée par le panneau « Notifications » de l'admin. L'appelant montre son
// jeton Supabase : la route vérifie qu'il est admin, puis lit les abonnements
// AVEC SES DROITS (la RLS de push_abonnements laisse l'admin tout lire), sans
// clé de service. Les abonnements que le service de push dit morts sont
// effacés au passage.
//
// `essai: true` n'envoie qu'aux téléphones de l'admin lui-même : de quoi voir
// la notification avant de l'envoyer à toute la ligue.
//
// Chaque annonce garde sa trace (motif « annonce », lib/server/push-envoi.ts)
// pour la page Activité : écrite avec la clé secrète, la seule qui le peut ;
// sans elle, l'annonce part quand même.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleVapid } from "@/lib/server/web-push";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { serveur } from "@/lib/sfl/serveur-ligue.server";
import { estNotif } from "@/lib/sfl/push";

export const maxDuration = 60;

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

function erreur(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const cle = cleVapid();
  if (!cle) return erreur("Les notifications ne sont pas encore branchées.", 503);

  const corps = (await req.json().catch(() => ({}))) as {
    accessToken?: string;
    notif?: unknown;
    essai?: unknown;
  };
  if (!corps.accessToken) return erreur("Session requise.", 401);
  if (!estNotif(corps.notif)) return erreur("Titre, texte ou lien invalide.", 400);
  const notif = corps.notif;

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${corps.accessToken}` } },
  });
  const { data: auth, error: authError } = await sb.auth.getUser(corps.accessToken);
  if (authError || !auth.user) return erreur("Session invalide.", 401);
  const { data: profil } = await sb.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle();
  if (!profil?.is_admin) return erreur("Réservé à l'admin.", 403);

  let requete = sb.from("push_abonnements").select("user_id");
  if (corps.essai === true) requete = requete.eq("user_id", auth.user.id);
  const { data: abonnements, error } = await requete;
  if (error) return erreur("Abonnements illisibles.", 500);

  const joueurs = [...new Set((abonnements as { user_id: string }[]).map((a) => a.user_id))];
  const envois = new Map(joueurs.map((uid): [string, Envoi] => [uid, { notif, motif: "annonce" }]));
  const bilan = await prevenir(sb, cle, envois, { traces: serveur(), de: auth.user.id });

  return NextResponse.json({ envoyes: bilan.telephones, morts: bilan.morts, echecs: bilan.echecs });
}
