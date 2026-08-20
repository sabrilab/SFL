// Liste des comptes (avec mots de passe par défaut) — SERVEUR, ADMIN SEUL.
//
// Les mots de passe en clair ne partent JAMAIS dans le bundle du navigateur :
// ils vivent dans un module serveur, et cette route ne les rend qu'à un
// appelant qui prouve être l'admin — en présentant son jeton de session
// Supabase, vérifié côté serveur, avec le drapeau is_admin lu dans profiles.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SEED_ACCOUNTS } from "@/lib/sfl/auth/seed.server";
import { motDePassePour } from "@/lib/sfl/auth/derive.server";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

export async function POST(req: NextRequest) {
  const { accessToken } = (await req.json().catch(() => ({}))) as { accessToken?: string };
  if (!accessToken) {
    return NextResponse.json({ error: "Session serveur requise." }, { status: 401 });
  }

  // Le jeton parle pour l'appelant : Supabase valide sa signature, et les
  // règles RLS s'appliquent à ses requêtes.
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: auth, error: authError } = await sb.auth.getUser(accessToken);
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Session invalide." }, { status: 401 });
  }

  const { data: profile } = await sb
    .from("profiles")
    .select("is_admin")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });
  }

  // La liste embarquée est figée à la compilation : les joueurs ajoutés en
  // cours de saison n'y sont pas, et leurs accès seraient perdus dès la
  // fenêtre de création refermée. On complète donc avec les profils que la
  // base connaît en plus — leur mot de passe se déduit de leur nom, par le
  // même algorithme, donc rien n'a besoin d'être stocké.
  const connus = new Set(SEED_ACCOUNTS.map((a) => a.name));
  const { data: profils } = await sb.from("profiles").select("name, username");

  const ajoutes = ((profils ?? []) as { name: string; username: string }[])
    .filter((p) => !connus.has(p.name))
    .map((p) => ({
      name: p.name,
      user: p.username.replace(/^@/, ""),
      password: motDePassePour(p.name),
      ajoute: true as const,
    }));

  const accounts = [
    ...SEED_ACCOUNTS.map((a) => ({ name: a.name, user: a.user, password: a.password })),
    ...ajoutes,
  ].sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return NextResponse.json({ accounts });
}
