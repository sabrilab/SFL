// Prénom, nom et pseudo du joueur — SERVEUR.
//
// Les noms de saison ont été tapés par l'admin, parfois de travers. Le joueur
// corrige ici son prénom et son nom, choisit son pseudo et donne son email
// (obligatoire : la ligue doit pouvoir joindre chacun). Tant qu'il ne l'a
// pas fait (profiles.identite_le), l'app le lui demande avant tout le reste.
//
// Le nom de saison (profiles.name) ne change pas : c'est la clé des journées,
// des photos et des compositions. Le prénom et le nom vont dans sa fiche
// (privée) et l'app affiche partout profiles.nom_affiche, tiré du prénom
// selon l'usage de la ligue (nomDeLigue : le prénom seul, puis l'initiale du
// nom en cas d'homonyme). Le pseudo suit les règles de /api/pseudo : unique,
// et un changement tous les 30 jours (garde_pseudo, dans la base).
//
// GET  : { prenom, nom, pseudo, prochain, email, affiche, confirme }.
// POST { prenom, nom, pseudo, email } : enregistre et confirme. Jeton du joueur en
//      Authorization: Bearer.

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appelant, dejaPris, serveur } from "@/lib/sfl/serveur-ligue.server";
import { emailDe } from "@/lib/sfl/contacts";
import { capitaliser, emailValide, erreurPseudo, nettoyerNom, nomDeLigue, normaliserPseudo } from "@/lib/sfl/inscription";
import { separerNom } from "@/lib/sfl/identites-regles";

const FERME = NextResponse.json({ error: "Modification indisponible pour l'instant." }, { status: 503 });

type Profil = {
  name: string;
  username: string;
  pseudo_change_le: string | null;
  contact_email: string | null;
  nom_affiche: string | null;
  identite_le: string | null;
};

async function lire(sb: SupabaseClient, id: string) {
  // L'email est rangé à part (table contacts, lib/sfl/contacts.ts).
  const [{ data: p }, { data: f }, email] = await Promise.all([
    sb.from("profiles").select("name, username, pseudo_change_le, nom_affiche, identite_le").eq("id", id).maybeSingle(),
    sb.from("fiches").select("prenom, nom").eq("player_id", id).maybeSingle(),
    emailDe(sb, id).catch(() => null),
  ]);
  return {
    profil: p ? ({ ...p, contact_email: email } as Profil) : null,
    fiche: f as { prenom: string; nom: string } | null,
  };
}

export async function GET(req: NextRequest) {
  const sb = serveur();
  if (!sb) return FERME;
  const user = await appelant(sb, req);
  if (!user) return NextResponse.json({ error: "Reconnecte-toi." }, { status: 401 });

  const { profil, fiche } = await lire(sb, user.id);
  if (!profil) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  const affiche = profil.nom_affiche ?? profil.name;
  const devine = separerNom(affiche);
  return NextResponse.json({
    prenom: fiche?.prenom ?? devine.prenom,
    nom: fiche?.nom ?? devine.nom,
    pseudo: profil.username.replace(/^@/, ""),
    prochain: profil.pseudo_change_le
      ? new Date(new Date(profil.pseudo_change_le).getTime() + 30 * 864e5).toISOString()
      : null,
    // L'email technique des comptes créés par l'admin (@sfl.local) n'en est pas un.
    email: profil.contact_email ?? (user.email && !user.email.endsWith("@sfl.local") ? user.email : ""),
    affiche,
    confirme: !!profil.identite_le,
  });
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return FERME;
  const user = await appelant(sb, req);
  if (!user) return NextResponse.json({ error: "Reconnecte-toi." }, { status: 401 });

  const corps = (await req.json().catch(() => null)) as {
    prenom?: string;
    nom?: string;
    pseudo?: string;
    email?: string;
  } | null;
  const prenom = capitaliser(nettoyerNom(String(corps?.prenom ?? ""))).slice(0, 40);
  const nom = capitaliser(nettoyerNom(String(corps?.nom ?? "")));
  const pseudo = normaliserPseudo(String(corps?.pseudo ?? ""));
  const email = String(corps?.email ?? "").trim().toLowerCase();
  if (!prenom) return NextResponse.json({ error: "Ton prénom manque.", champ: "prenom" }, { status: 400 });
  if (!nom) return NextResponse.json({ error: "Ton nom manque.", champ: "nom" }, { status: 400 });
  const ep = erreurPseudo(pseudo);
  if (ep) return NextResponse.json({ error: `Pseudo : ${ep}`, champ: "pseudo" }, { status: 400 });
  if (!emailValide(email) || email.endsWith("@sfl.local")) {
    return NextResponse.json({ error: "Ton email ne semble pas valide.", champ: "email" }, { status: 400 });
  }

  const { profil, fiche } = await lire(sb, user.id);
  if (!profil) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });

  let pris: Awaited<ReturnType<typeof dejaPris>>;
  try {
    pris = await dejaPris(sb, user.id);
  } catch {
    return NextResponse.json({ error: "Serveur de la ligue injoignable." }, { status: 502 });
  }

  // 1 · Le pseudo d'abord : c'est lui qui peut être refusé (pris, 30 jours).
  if (pseudo !== profil.username.replace(/^@/, "")) {
    if (pris.pseudos.has(pseudo)) {
      return NextResponse.json({ error: "Ce pseudo est déjà pris.", champ: "pseudo" }, { status: 409 });
    }
    const { error } = await sb.from("profiles").update({ username: `@${pseudo}` }).eq("id", user.id);
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Ce pseudo est déjà pris.", champ: "pseudo" }, { status: 409 });
      }
      if (error.code === "P0001" || error.code === "22023") {
        return NextResponse.json({ error: error.message, champ: "pseudo" }, { status: 409 });
      }
      return NextResponse.json({ error: "Enregistrement impossible pour l'instant." }, { status: 500 });
    }
  }

  // 2 · Le nom affiché : son propre nom de saison ne compte pas comme pris
  // (dejaPris le compte encore par l'effectif de la saison).
  const noms = new Set(pris.noms);
  noms.delete(profil.name.toLowerCase());
  if (profil.nom_affiche) noms.delete(profil.nom_affiche.toLowerCase());
  const affiche = nomDeLigue(prenom, nom, noms);

  const { error: errFiche } = fiche
    ? await sb.from("fiches").update({ prenom, nom }).eq("player_id", user.id)
    : await sb.from("fiches").insert({ player_id: user.id, prenom, nom });
  if (errFiche) return NextResponse.json({ error: "Enregistrement impossible pour l'instant." }, { status: 500 });

  const { error: errProfil } = await sb
    .from("profiles")
    .update({ nom_affiche: affiche, contact_email: email, identite_le: new Date().toISOString() })
    .eq("id", user.id);
  if (errProfil) {
    const doublon = errProfil.code === "23505";
    return NextResponse.json(
      { error: doublon ? "Un autre joueur vient de prendre ce nom. Réessaie." : "Enregistrement impossible pour l'instant." },
      { status: doublon ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true, prenom, nom, pseudo, email, affiche });
}
