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

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { envoyer, type Abonnement } from "@/lib/server/web-push";
import { estNotif, VAPID_PUBLIC_KEY } from "@/lib/sfl/push";

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
  const privee = process.env.VAPID_PRIVATE_KEY;
  if (!privee) return erreur("Les notifications ne sont pas encore branchées.", 503);

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

  let requete = sb.from("push_abonnements").select("endpoint, p256dh, auth");
  if (corps.essai === true) requete = requete.eq("user_id", auth.user.id);
  const { data: abonnements, error } = await requete;
  if (error) return erreur("Abonnements illisibles.", 500);

  const cle = {
    publique: VAPID_PUBLIC_KEY,
    privee,
    sujet: process.env.VAPID_SUBJECT ?? "https://sfl-eight.vercel.app",
  };
  const resultats = await Promise.all(
    (abonnements as Abonnement[]).map(async (ab) => ({ ab, r: await envoyer(ab, notif, cle) }))
  );

  const morts = resultats.filter((x) => x.r === "mort").map((x) => x.ab.endpoint);
  if (morts.length > 0) await sb.from("push_abonnements").delete().in("endpoint", morts);

  return NextResponse.json({
    envoyes: resultats.filter((x) => x.r === "envoye").length,
    morts: morts.length,
    echecs: resultats.filter((x) => x.r === "echec").length,
  });
}
