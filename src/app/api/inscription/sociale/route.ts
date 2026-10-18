// Inscription par Google ou Apple — SERVEUR.
//
// Le joueur touche « Google » ou « Apple » : Supabase crée son compte au
// retour du fournisseur, et le trigger handle_new_user lui pose un profil
// PROVISOIRE (nom et pseudo tirés de son identifiant, pseudo_a_choisir, en
// attente). L'écran d'inscription enchaîne alors les mêmes questions que
// l'inscription classique, sans email ni mot de passe, et cette route pose le
// vrai nom de ligue, le pseudo et la fiche, avec les mêmes contrôles que
// /api/inscription. Le compte reste en attente : l'admin l'accepte comme les
// autres.
//
// Trois actions, toutes avec le jeton du joueur (Authorization: Bearer) :
//   · « verifier » : avant les questions. Si l'email du fournisseur est déjà
//     celui d'un membre, c'est un membre qui s'est trompé de bouton : le
//     compte provisoire est supprimé, et l'écran lui dit de se connecter avec
//     son pseudo puis de lier Google ou Apple dans Réglages ;
//   · « finir » : pose le nom, le pseudo et la fiche ;
//   · « annuler » : supprime le compte provisoire (le joueur fait demi-tour).
//
// Seul un compte encore provisoire peut passer ici : un compte fini ou un
// membre n'a rien à y faire, et aucune action ne touche un autre compte.

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { appelant, dejaPris, serveur } from "@/lib/sfl/serveur-ligue.server";
import {
  capitaliser,
  erreurInscription,
  nettoyerNom,
  nomDeLigue,
  normaliserPseudo,
  type Inscription,
} from "@/lib/sfl/inscription";

const FERME = NextResponse.json(
  { error: "Les inscriptions ne sont pas encore ouvertes. Demande ton accès à l'admin." },
  { status: 503 }
);

type Corps = Partial<Omit<Inscription, "motDePasse">> & { action?: string; site?: string };

/** L'email du fournisseur appartient-il déjà à un autre compte de la ligue ? */
async function emailDeMembre(sb: SupabaseClient, user: User): Promise<boolean> {
  const email = user.email?.toLowerCase();
  if (!email) return false;
  const { data } = await sb
    .from("profiles")
    .select("id")
    .eq("contact_email", email)
    .eq("pseudo_a_choisir", false)
    .neq("id", user.id)
    .limit(1);
  return !!data && data.length > 0;
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return FERME;

  const user = await appelant(sb, req);
  if (!user) return NextResponse.json({ error: "Reconnecte-toi avec Google ou Apple." }, { status: 401 });

  const { data: profil } = await sb
    .from("profiles")
    .select("pseudo_a_choisir")
    .eq("id", user.id)
    .maybeSingle();
  if (!(profil as { pseudo_a_choisir?: boolean } | null)?.pseudo_a_choisir) {
    return NextResponse.json({ error: "Ce compte est déjà créé.", fini: true }, { status: 409 });
  }

  const corps = ((await req.json().catch(() => null)) ?? {}) as Corps;

  if (corps.action === "annuler") {
    await sb.auth.admin.deleteUser(user.id).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (corps.action === "verifier") {
    if (await emailDeMembre(sb, user)) {
      await sb.auth.admin.deleteUser(user.id).catch(() => {});
      return NextResponse.json({ ok: true, dejaMembre: true });
    }
    // Le fournisseur donne souvent le prénom et le nom : l'écran les propose.
    const m = (user.user_metadata ?? {}) as Record<string, string | undefined>;
    const complet = nettoyerNom(m.full_name ?? m.name ?? "");
    const prenom = m.given_name ?? complet.split(" ")[0] ?? "";
    const nom = m.family_name ?? complet.split(" ").slice(1).join(" ");
    return NextResponse.json({ ok: true, email: user.email ?? null, prenom, nom });
  }

  if (corps.action !== "finir") return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  // Champ piège invisible : un humain ne le remplit jamais.
  if (corps.site) return NextResponse.json({ error: "Refusé." }, { status: 400 });

  const email = (user.email ?? "").trim().toLowerCase();
  const f: Inscription = {
    prenom: capitaliser(nettoyerNom(String(corps.prenom ?? ""))),
    nom: capitaliser(nettoyerNom(String(corps.nom ?? ""))),
    pseudo: normaliserPseudo(String(corps.pseudo ?? "")),
    naissance: String(corps.naissance ?? ""),
    email,
    taille: Number(corps.taille),
    poids: Number(corps.poids),
    pointure: Number(corps.pointure),
    maillot: corps.maillot as Inscription["maillot"],
    pied: corps.pied as Inscription["pied"],
    poste: corps.poste as Inscription["poste"],
    motDePasse: "",
  };
  const erreur = erreurInscription(f, new Date(), { sansMotDePasse: true });
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });

  let pris: Awaited<ReturnType<typeof dejaPris>>;
  try {
    pris = await dejaPris(sb, user.id);
  } catch {
    return NextResponse.json({ error: "Serveur de la ligue injoignable." }, { status: 502 });
  }
  if (pris.pseudos.has(f.pseudo)) {
    return NextResponse.json({ error: "Ce pseudo est déjà pris.", champ: "pseudo" }, { status: 409 });
  }
  if (await emailDeMembre(sb, user)) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email. Connecte-toi avec ton pseudo.", champ: "email" },
      { status: 409 }
    );
  }

  const name = nomDeLigue(f.prenom, f.nom, pris.noms);

  // Le pseudo passe par garde_pseudo (base) : pseudo_a_choisir étant encore
  // vrai, ce premier choix ne compte pas, et il date le prochain changement.
  const { error: errProfil } = await sb
    .from("profiles")
    .update({ name, username: `@${f.pseudo}`, contact_email: email || null, pseudo_a_choisir: false })
    .eq("id", user.id);
  if (errProfil) {
    const doublon = errProfil.code === "23505";
    return NextResponse.json(
      doublon
        ? { error: "Ce pseudo est déjà pris.", champ: "pseudo" }
        : { error: "Création du compte impossible pour l'instant." },
      { status: doublon ? 409 : 500 }
    );
  }

  const { error: errFiche } = await sb.from("fiches").upsert({
    player_id: user.id,
    prenom: f.prenom,
    nom: f.nom,
    naissance: f.naissance,
    taille_cm: Math.round(f.taille),
    poids_kg: Math.round(f.poids * 10) / 10,
    pointure: Math.round(f.pointure * 2) / 2,
    maillot: f.maillot,
    pied: f.pied,
    poste: f.poste,
  });
  if (errFiche) {
    // On remet le compte en provisoire : le joueur peut réessayer.
    await sb.from("profiles").update({ pseudo_a_choisir: true }).eq("id", user.id);
    return NextResponse.json({ error: "Création du compte impossible pour l'instant." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pseudo: f.pseudo, name });
}
