// Les comptes de la ligue — SERVEUR, ADMIN SEUL.
//
// Pour chaque joueur de l'effectif : son identifiant, s'il a un compte, et
// s'il doit encore choisir son mot de passe. AUCUN mot de passe : il n'en
// existe plus nulle part en clair. Jusqu'au 22/10/2026, cette route rendait
// les mots de passe d'origine, déduits du nom — les mêmes qu'on lisait dans
// le dépôt public. Un joueur qui a perdu le sien reçoit désormais un mot de
// passe provisoire (/api/comptes/reinitialiser), qu'il remplace en entrant.
//
// L'appelant présente son jeton de session (« Authorization: Bearer … ») :
// Supabase en vérifie la signature, is_admin est lu dans profiles, et chaque
// lecture passe par les règles RLS de l'admin.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ACCOUNTS } from "@/lib/sfl/auth/accounts";
import { identifiantPour } from "@/lib/sfl/auth/derive.server";
import { lireEffectifServeur } from "@/lib/sfl/saison-serveur.server";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

export interface CompteLigue {
  name: string;
  user: string;
  /** Ajouté à l'effectif en cours de saison, hors liste d'origine. */
  ajoute?: boolean;
  /** Dans l'effectif, mais pas encore inscrit côté serveur. */
  sansCompte?: boolean;
  /** Doit encore choisir son mot de passe (d'origine, ou provisoire). */
  aChanger?: "origine" | "provisoire";
}

export async function POST(req: NextRequest) {
  const accessToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Session serveur requise." }, { status: 401 });
  }

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

  // La liste part de L'EFFECTIF, pas des comptes existants : un joueur ajouté
  // à l'effectif dont l'inscription a échoué doit apparaître, avec son
  // identifiant (il se déduit du nom) et « à inscrire ».
  const { data: profils } = await sb.from("profiles").select("id, name, username");
  const profilsListe = (profils ?? []) as { id: string; name: string; username: string }[];
  const aUnCompte = new Map(profilsListe.map((p) => [p.name, p.username.replace(/^@/, "")]));

  // Qui doit encore choisir son mot de passe. Avant la migration de la base
  // (aperçus), la table n'existe pas : personne.
  const { data: aChangerListe } = await sb.from("mot_de_passe_a_changer").select("user_id, motif");
  const motifParId = new Map(
    ((aChangerListe ?? []) as { user_id: string; motif: string }[]).map((r) => [
      r.user_id,
      r.motif === "provisoire" ? ("provisoire" as const) : ("origine" as const),
    ])
  );
  const motifParNom = new Map(profilsListe.map((p) => [p.name, motifParId.get(p.id)]));

  const roster = (await lireEffectifServeur(sb)) ?? [];

  const parNom = new Map<string, CompteLigue>();
  const pris = new Set<string>();

  // 1 · La liste d'origine fait foi pour ceux qu'elle contient.
  for (const a of ACCOUNTS) {
    parNom.set(a.name, { name: a.name, user: a.user });
    pris.add(a.user);
  }
  // 2 · Les comptes créés depuis : leur identifiant vient de la base.
  for (const p of profilsListe) {
    if (parNom.has(p.name)) continue;
    const user = p.username.replace(/^@/, "");
    parNom.set(p.name, { name: p.name, user, ajoute: true });
    pris.add(user);
  }
  // 3 · Le reste de l'effectif : identifiant calculé, compte encore à créer.
  for (const r of [...roster].sort((a, b) => a.name.localeCompare(b.name, "fr"))) {
    if (parNom.has(r.name)) continue;
    const user = identifiantPour(r.name, pris);
    pris.add(user);
    parNom.set(r.name, { name: r.name, user, ajoute: true, sansCompte: true });
  }

  // Sans compte : seulement s'il est dans l'effectif de la saison. Un nom de
  // la liste d'origine dont le compte a été supprimé (membre que la saison
  // n'a pas gardé) n'a plus rien à recevoir : il n'apparaît pas.
  const dansLaSaison = new Set(roster.map((r) => r.name));
  const accounts = [...parNom.values()]
    .flatMap((l): CompteLigue[] => {
      if (!aUnCompte.has(l.name)) return dansLaSaison.has(l.name) ? [{ ...l, sansCompte: true }] : [];
      const motif = motifParNom.get(l.name);
      return [{ ...l, sansCompte: false, ...(motif ? { aChanger: motif } : {}) }];
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return NextResponse.json({ accounts, sansCompte: accounts.filter((a) => a.sansCompte).length });
}
