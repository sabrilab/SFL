// Route d'installation — s'exécute sur le serveur (Vercel), qui a accès à
// Supabase. C'est elle qui crée les 71 comptes et publie la convocation :
// l'admin n'a plus qu'à appuyer sur un bouton dans /admin/setup.
//
// Préalables côté tableau de bord (faits par l'admin) : projet réveillé,
// « Confirm email » désactivé, tables créées (schéma SQL), inscriptions
// ouvertes le temps de l'opération puis refermées.
//
// Sécurité : cette route n'utilise QUE la clé publishable (aucun secret) —
// elle fait exactement ce que n'importe quel navigateur pourrait faire, mais
// en série et sans erreur de saisie. Les inscriptions étant refermées après
// l'installation, la route devient inerte.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SEED_ACCOUNTS } from "@/lib/sfl/auth/seed.server";
import { username } from "@/lib/sfl/usernames";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

// Taille de lot : reste sous le délai des fonctions serverless ; la page
// enchaîne les lots jusqu'au bout.
const BATCH = 12;

function client() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const email = (user: string) => `${user}@sfl.local`;

interface SetupBody {
  action?: string;
  from?: number;
  journee?: number;
  jour?: string;
  date_label?: string;
  heure?: string;
  lieu?: string;
  adminUser?: string;
  adminPassword?: string;
}

export async function POST(req: NextRequest) {
  // Le corps ne se lit qu'une fois : tout est parsé ici, chaque action pioche.
  const body = (await req.json().catch(() => ({}))) as SetupBody;
  const { action, from = 0 } = body;

  /* ------------------------ Création des comptes ------------------------ */
  if (action === "seed") {
    const slice = SEED_ACCOUNTS.slice(from, from + BATCH);
    let created = 0;
    let existing = 0;
    const errors: string[] = [];

    for (const a of slice) {
      try {
        const { error } = await client().auth.signUp({
          email: email(a.user),
          password: a.password,
          options: { data: { name: a.name, username: username(a.name) } },
        });
        if (!error) created += 1;
        else if (/already registered|already exists/i.test(error.message)) existing += 1;
        else errors.push(`${a.name} : ${error.message}`);
      } catch (e) {
        errors.push(`${a.name} : ${e instanceof Error ? e.message : "réseau"}`);
      }
      // Rythme calme, pour rester sous les limites du plan gratuit.
      await new Promise((r) => setTimeout(r, 250));
    }

    const next = from + BATCH < SEED_ACCOUNTS.length ? from + BATCH : null;
    return NextResponse.json({
      created,
      existing,
      errors,
      next,
      total: SEED_ACCOUNTS.length,
    });
  }

  /* --------------------- Publication de la convocation ------------------- */
  // Se connecte en tant qu'admin (mot de passe par défaut, ou celui fourni)
  // et publie la convocation passée dans le corps de la requête.
  if (action === "convocation") {
    const { journee, jour, date_label, heure, lieu, adminUser, adminPassword } = body;
    if (!journee || !jour || !date_label || !heure || !lieu) {
      return NextResponse.json({ error: "Convocation incomplète." }, { status: 400 });
    }
    const admin = SEED_ACCOUNTS.find((a) => a.user === (adminUser ?? "ilyes"));
    const sb = client();
    const { error: authError } = await sb.auth.signInWithPassword({
      email: email(admin?.user ?? "ilyes"),
      password: adminPassword ?? admin?.password ?? "",
    });
    if (authError) {
      return NextResponse.json(
        { error: `Connexion admin refusée : ${authError.message}` },
        { status: 401 }
      );
    }
    await sb.from("convocations").update({ statut: "cloturee" }).eq("statut", "ouverte");
    const { error } = await sb
      .from("convocations")
      .insert({ journee, jour, date_label, heure, lieu, effectif: 10 });
    await sb.auth.signOut();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  /* ------------------------------- État --------------------------------- */
  if (action === "status") {
    const sb = client();
    const admin = SEED_ACCOUNTS.find((a) => a.user === "ilyes");
    const { error: authError } = await sb.auth.signInWithPassword({
      email: email("ilyes"),
      password: admin?.password ?? "",
    });
    if (authError) {
      return NextResponse.json({
        reachable: !/fetch failed|network/i.test(authError.message),
        adminLogin: false,
        detail: authError.message,
      });
    }
    const { count } = await sb.from("profiles").select("id", { count: "exact", head: true });
    const { data: convs } = await sb
      .from("convocations")
      .select("journee")
      .eq("statut", "ouverte")
      .limit(1);
    await sb.auth.signOut();
    return NextResponse.json({
      reachable: true,
      adminLogin: true,
      profiles: count ?? 0,
      convocation: convs?.[0]?.journee ?? null,
    });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
