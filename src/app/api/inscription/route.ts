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
// Venu par le lien d'une équipe (champ equipe = le jeton, mode Team) : le
// capitaine qui a partagé le lien s'en porte garant. Le compte est validé
// aussitôt et le joueur arrive invité dans l'équipe (il signe le Règlement
// sur la page Team).
//
// Venu par le lien d'un joueur, ou avec son code (champ parrain, canal
// « lien » ou « code », parrainage) : de même, le parrain s'en porte garant
// et le compte entre aussitôt, dans Bola et pas dans la saison SFL. Le
// parrainage est noté (lib/sfl/parrainage.server.ts), le capitaine d'un lien
// d'équipe comptant comme parrain ; Bola Team est offert si ce parrain joue
// en SFL. Un code inconnu ou coupé ne bloque rien : le compte naît en
// attente, comme sans lien.
//
// GET ?pseudo=… dit seulement si un pseudo est libre (pour l'écran).

import { NextRequest, NextResponse } from "next/server";
import { dejaPris, serveur } from "@/lib/sfl/serveur-ligue.server";
import { idsParEmail } from "@/lib/sfl/contacts";
import { joueurSfl, noterFilleul, parrainDuCode } from "@/lib/sfl/parrainage.server";
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

  const corps = (await req.json().catch(() => null)) as
    | (Inscription & { site?: string; equipe?: string; parrain?: string; canal?: string })
    | null;
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

  // Un email = un joueur (les emails sont rangés à part : table contacts).
  const memes = await idsParEmail(sb, f.email).catch(() => [] as string[]);
  const { data: memeEmail } = memes.length
    ? await sb
        .from("profiles")
        .select("id")
        .in("id", memes)
        // Un passage par Google/Apple laissé en plan ne bloque pas l'email.
        .eq("pseudo_a_choisir", false)
        .limit(1)
    : { data: [] };
  if (memeEmail && memeEmail.length > 0) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email. Connecte-toi, ou demande à l'admin.", champ: "email" },
      { status: 409 }
    );
  }

  // Le lien d'équipe, vérifié avant de créer quoi que ce soit : valable 72 h,
  // l'équipe pas dissoute, une place libre, et jamais plus de comptes
  // ouverts par ce lien que de places restantes (un lien qui fuit ne fait
  // pas entrer n'importe qui dans la ligue). Comme pour une invitation, seuls
  // les membres prennent une place (equipe_inviter, supabase/schema.sql).
  type Lien = { jeton: string; equipe_id: number; cree_par: string | null; utilisations: number };
  let lien: Lien | null = null;
  if (corps.equipe) {
    const perime = NextResponse.json({ error: "Le lien de l'équipe n'est plus valable. Demande-en un nouveau." }, { status: 410 });
    const { data } = await sb
      .from("equipe_liens")
      .select("jeton, equipe_id, cree_par, utilisations, equipes!inner(dissoute_le)")
      .eq("jeton", String(corps.equipe))
      .gt("expire_le", new Date().toISOString())
      .is("equipes.dissoute_le", null)
      .maybeSingle();
    if (!data) return perime;
    lien = data as unknown as Lien;
    const { count } = await sb
      .from("equipe_membres")
      .select("joueur", { count: "exact", head: true })
      .eq("equipe_id", lien.equipe_id)
      .eq("statut", "membre");
    const places = 7 - (count ?? 0);
    if (places <= 0 || lien.utilisations >= places) return perime;
  }

  const parrain = !lien && corps.parrain ? await parrainDuCode(sb, corps.parrain) : null;
  const entre = !!lien || !!parrain;

  const name = nomDeLigue(f.prenom, f.nom, pris.noms);

  // L'email de connexion reste technique (pseudo@sfl.local), comme pour tous
  // les comptes de la ligue : on se connecte avec son pseudo. L'email réel
  // s'écrit dans profiles.contact_email, que la base range aussitôt à part
  // (table contacts, lue par le joueur et l'admin seuls).
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
    .update({ contact_email: f.email, pseudo_change_le: new Date().toISOString(), ...(entre ? { valide: true } : {}) })
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

  if (lien) {
    await sb.from("equipe_liens").update({ utilisations: lien.utilisations + 1 }).eq("jeton", lien.jeton);
    // L'équipe l'attend ; si l'invitation échoue, le compte reste valable.
    await sb
      .from("equipe_membres")
      .insert({ equipe_id: lien.equipe_id, joueur: id, statut: "invite", invite_par: lien.cree_par })
      .then(() => {}, () => {});
    if (lien.cree_par) {
      const capitaine = { id: lien.cree_par, code: null, sfl: await joueurSfl(sb, lien.cree_par) };
      await noterFilleul(sb, id, capitaine, "equipe", lien.equipe_id);
    }
  } else if (parrain) {
    await noterFilleul(sb, id, parrain, corps.canal === "code" ? "code" : "lien");
  }

  return NextResponse.json({ ok: true, pseudo: f.pseudo, name, entre });
}
