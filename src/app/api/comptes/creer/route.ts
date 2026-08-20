// Création du compte d'un joueur ajouté en cours de saison — SERVEUR, ADMIN.
//
// La table des comptes embarquée dans l'app est figée à la compilation : un
// joueur ajouté à l'effectif depuis l'espace admin n'y figure pas, et n'a donc
// aucun moyen de se connecter. Cette route lui fabrique ses accès et crée son
// compte Supabase, pour que l'admin n'ait rien à faire d'autre que l'ajouter.
//
// Le mot de passe est DÉDUIT du nom, par le même algorithme que le générateur
// (derive.server.ts) : il ne dépend d'aucun stockage, et régénérer la table un
// jour ne cassera pas un accès déjà distribué.
//
// Sécurité : aucune clé secrète. La route agit avec la clé publishable, comme
// n'importe quel navigateur, et n'accepte que l'appelant qui prouve être admin
// en présentant son jeton de session Supabase.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { identifiantPour, motDePassePour } from "@/lib/sfl/auth/derive.server";
import { username } from "@/lib/sfl/usernames";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

const email = (user: string) => `${user}@sfl.local`;

export async function POST(req: NextRequest) {
  const { accessToken, name } = (await req.json().catch(() => ({}))) as {
    accessToken?: string;
    name?: string;
  };
  if (!accessToken) return NextResponse.json({ error: "Session serveur requise." }, { status: 401 });
  if (!name?.trim()) return NextResponse.json({ error: "Nom manquant." }, { status: 400 });

  const joueur = name.trim();

  // 1 · L'appelant est-il admin ? Le jeton parle pour lui, RLS s'applique.
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

  // 2 · Ce joueur a-t-il déjà un compte ? Le mot de passe étant déduit du nom,
  //     on peut le lui redonner sans rien créer.
  const { data: existant } = await sb
    .from("profiles")
    .select("username")
    .eq("name", joueur)
    .maybeSingle();
  if (existant) {
    const user = (existant as { username: string }).username.replace(/^@/, "");
    return NextResponse.json({ user, password: motDePassePour(joueur), deja: true });
  }

  // 3 · Un identifiant libre : deux joueurs ne peuvent pas partager le leur.
  const { data: tous } = await sb.from("profiles").select("username");
  const pris = new Set(
    ((tous ?? []) as { username: string }[]).map((p) => p.username.replace(/^@/, ""))
  );
  const user = identifiantPour(joueur, pris);
  const password = motDePassePour(joueur);

  // 4 · Création du compte. La session de l'admin n'est pas touchée : ce
  //     client-ci ne persiste rien.
  const neuf = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await neuf.auth.signUp({
    email: email(user),
    password,
    options: { data: { name: joueur, username: username(joueur) } },
  });

  if (error) {
    const ferme = /signup|not allowed|disabled/i.test(error.message);
    return NextResponse.json(
      {
        error: ferme
          ? "Les inscriptions sont fermées sur Supabase. Ouvre-les le temps de l'ajout (Authentication → Sign In / Providers → Allow new users to sign up), puis referme-les."
          : error.message,
        user,
        password,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ user, password });
}
