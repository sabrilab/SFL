// Inscription autonome — SERVEUR, PUBLIQUE.
//
// Un joueur crée son compte lui-même : la route vérifie le formulaire (les
// mêmes règles que l'écran, lib/sfl/inscription.ts), choisit son nom de
// ligue, crée le compte Supabase et pose sa fiche privée. Le compte naît EN
// ATTENTE (profiles.valide = false, posé par le trigger) : il se connecte,
// voit sa carte, mais ne lit rien de la ligue tant que l'admin ne l'a pas
// accepté.
//
// La création passe par la clé secrète de Supabase, lue dans les variables
// d'environnement de Vercel (production seulement) et jamais envoyée au
// navigateur. C'est elle qui permet de garder « Allow new users to sign up »
// FERMÉ dans Supabase : personne ne peut créer de compte en contournant
// cette route et ses contrôles.
//
// GET ?pseudo=… dit seulement si un pseudo est libre (pour l'écran).

import { NextRequest, NextResponse } from "next/server";
import { dejaPris, serveur } from "@/lib/sfl/serveur-ligue.server";
import {
  capitaliser,
  erreurInscription,
  erreurPseudo,
  nettoyerNom,
  nomDeLigue,
  normaliserPseudo,
  type Inscription,
} from "@/lib/sfl/inscription";

const FERME = NextResponse.json(
  { error: "Les inscriptions ne sont pas encore ouvertes. Demande ton accès à l'admin." },
  { status: 503 }
);

export async function GET(req: NextRequest) {
  const sb = serveur();
  if (!sb) return FERME;
  const pseudo = normaliserPseudo(req.nextUrl.searchParams.get("pseudo") ?? "");
  const erreur = erreurPseudo(pseudo);
  if (erreur) return NextResponse.json({ libre: false, raison: erreur });
  try {
    const { pseudos } = await dejaPris(sb);
    return NextResponse.json({ libre: !pseudos.has(pseudo), pseudo });
  } catch {
    return NextResponse.json({ error: "Serveur de la ligue injoignable." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return FERME;

  const corps = (await req.json().catch(() => null)) as (Inscription & { site?: string }) | null;
  if (!corps) return NextResponse.json({ error: "Formulaire illisible." }, { status: 400 });
  // Champ piège invisible : un humain ne le remplit jamais.
  if (corps.site) return NextResponse.json({ error: "Refusé." }, { status: 400 });

  const f: Inscription = {
    ...corps,
    prenom: capitaliser(nettoyerNom(String(corps.prenom ?? ""))),
    nom: capitaliser(nettoyerNom(String(corps.nom ?? ""))),
    pseudo: normaliserPseudo(String(corps.pseudo ?? "")),
    email: String(corps.email ?? "").trim().toLowerCase(),
    taille: Number(corps.taille),
    poids: Number(corps.poids),
    pointure: Number(corps.pointure),
    motDePasse: String(corps.motDePasse ?? ""),
  };
  const erreur = erreurInscription(f);
  if (erreur) return NextResponse.json({ error: erreur }, { status: 400 });

  let pris: Awaited<ReturnType<typeof dejaPris>>;
  try {
    pris = await dejaPris(sb);
  } catch {
    return NextResponse.json({ error: "Serveur de la ligue injoignable." }, { status: 502 });
  }
  if (pris.pseudos.has(f.pseudo)) {
    return NextResponse.json({ error: "Ce pseudo est déjà pris.", champ: "pseudo" }, { status: 409 });
  }

  // Un email = un joueur.
  const { data: memeEmail } = await sb
    .from("profiles")
    .select("id")
    .eq("contact_email", f.email)
    // Un passage par Google/Apple laissé en plan ne bloque pas l'email.
    .eq("pseudo_a_choisir", false)
    .limit(1);
  if (memeEmail && memeEmail.length > 0) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email. Connecte-toi, ou demande à l'admin.", champ: "email" },
      { status: 409 }
    );
  }

  const name = nomDeLigue(f.prenom, f.nom, pris.noms);

  // L'email de connexion reste technique (pseudo@sfl.local), comme pour tous
  // les comptes de la ligue : on se connecte avec son pseudo. L'email réel
  // va dans profiles.contact_email.
  const { data: cree, error: errCreation } = await sb.auth.admin.createUser({
    email: `${f.pseudo}@sfl.local`,
    password: f.motDePasse,
    email_confirm: true,
    user_metadata: { name, username: `@${f.pseudo}`, inscription: "libre" },
  });
  if (errCreation || !cree.user) {
    const deja = /already|exists|registered/i.test(errCreation?.message ?? "");
    return NextResponse.json(
      { error: deja ? "Ce pseudo est déjà pris." : "Création du compte impossible pour l'instant." },
      { status: deja ? 409 : 500 }
    );
  }
  const id = cree.user.id;

  // Le trigger a posé le profil (en attente). On complète, et on annule tout
  // si la fiche ne passe pas : pas de compte à moitié créé.
  const { error: errProfil } = await sb
    .from("profiles")
    .update({ contact_email: f.email, pseudo_change_le: new Date().toISOString() })
    .eq("id", id);
  const { error: errFiche } = await sb.from("fiches").insert({
    player_id: id,
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
  if (errProfil || errFiche) {
    await sb.auth.admin.deleteUser(id).catch(() => {});
    return NextResponse.json({ error: "Création du compte impossible pour l'instant." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pseudo: f.pseudo, name });
}
