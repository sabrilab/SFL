// Liste des comptes (avec mots de passe par défaut) — SERVEUR, ADMIN SEUL.
//
// Les mots de passe en clair ne partent JAMAIS dans le bundle du navigateur :
// ils vivent dans un module serveur, et cette route ne les rend qu'à un
// appelant qui prouve être l'admin — en présentant son jeton de session
// Supabase, vérifié côté serveur, avec le drapeau is_admin lu dans profiles.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SEED_ACCOUNTS } from "@/lib/sfl/auth/seed.server";
import { identifiantPour, motDePassePour } from "@/lib/sfl/auth/derive.server";

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

  // La liste part de L'EFFECTIF, pas des comptes existants.
  //
  // Longtemps elle ne montrait que les comptes déjà créés : un joueur ajouté
  // à l'effectif dont l'inscription avait échoué n'apparaissait nulle part,
  // et ses accès restaient introuvables. Or ils n'ont jamais besoin d'être
  // stockés — identifiant et mot de passe se déduisent du nom. On peut donc
  // les donner à tout le monde, compte créé ou non, et signaler ceux qui
  // restent à inscrire.
  const { data: profils } = await sb.from("profiles").select("name, username");
  const profilsListe = (profils ?? []) as { name: string; username: string }[];
  const aUnCompte = new Map(profilsListe.map((p) => [p.name, p.username.replace(/^@/, "")]));

  const { data: doc } = await sb.from("saison").select("data").eq("id", 1).maybeSingle();
  const roster =
    (doc as { data?: { roster?: { name: string }[] } } | null)?.data?.roster ?? [];

  interface Ligne {
    name: string;
    user: string;
    password: string;
    ajoute?: boolean;
    sansCompte?: boolean;
  }

  const parNom = new Map<string, Ligne>();
  const pris = new Set<string>();

  // 1 · La liste d'origine fait foi pour ceux qu'elle contient.
  for (const a of SEED_ACCOUNTS) {
    parNom.set(a.name, { name: a.name, user: a.user, password: a.password });
    pris.add(a.user);
  }
  // 2 · Les comptes créés depuis : leur identifiant vient de la base.
  for (const p of profilsListe) {
    if (parNom.has(p.name)) continue;
    const user = p.username.replace(/^@/, "");
    parNom.set(p.name, { name: p.name, user, password: motDePassePour(p.name), ajoute: true });
    pris.add(user);
  }
  // 3 · Le reste de l'effectif : accès calculés, compte encore à créer.
  for (const r of [...roster].sort((a, b) => a.name.localeCompare(b.name, "fr"))) {
    if (parNom.has(r.name)) continue;
    const user = identifiantPour(r.name, pris);
    pris.add(user);
    parNom.set(r.name, {
      name: r.name,
      user,
      password: motDePassePour(r.name),
      ajoute: true,
      sansCompte: true,
    });
  }

  const accounts = [...parNom.values()]
    .map((l) => (aUnCompte.has(l.name) ? { ...l, sansCompte: false } : l))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return NextResponse.json({ accounts, sansCompte: accounts.filter((a) => a.sansCompte).length });
}
