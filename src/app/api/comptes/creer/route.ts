// Création du compte d'un joueur ajouté en cours de saison — SERVEUR, ADMIN.
//
// La table des comptes embarquée dans l'app est figée à la compilation : un
// joueur ajouté à l'effectif depuis l'espace admin n'y figure pas, et n'a donc
// aucun moyen de se connecter. Cette route lui fabrique ses accès et crée son
// compte Supabase, pour que l'admin n'ait rien à faire d'autre que l'ajouter.
//
// Le mot de passe est PROVISOIRE et tiré au hasard (derive.server.ts) : la
// route le rend une seule fois, à l'admin qui le transmet, et la base oblige
// le joueur à en choisir un à lui dès sa connexion (mot_de_passe_a_changer).
// Jusqu'au 22/10/2026 il se déduisait du nom, par l'algorithme que le dépôt
// public montrait à tout le monde.
//
// La création passe par la clé secrète (lib/sfl/serveur-ligue.server.ts),
// comme l'inscription autonome : « Allow new users to sign up » peut rester
// fermé dans Supabase. L'appelant prouve qu'il est admin par son jeton de
// session (« Authorization: Bearer … »).

import { NextRequest, NextResponse } from "next/server";
import { identifiantPour, motDePasseProvisoire } from "@/lib/sfl/auth/derive.server";
import { appelant, estAdmin, serveur } from "@/lib/sfl/serveur-ligue.server";

const email = (user: string) => `${user}@sfl.local`;

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "Fermé sur cet environnement." }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session serveur requise." }, { status: 401 });
  if (!(await estAdmin(sb, moi.id))) return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });

  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Nom manquant." }, { status: 400 });
  const joueur = name.trim();

  // 1 · Ce joueur a-t-il déjà un compte ? Son mot de passe ne se redonne
  //     plus (personne ne le connaît) : l'admin peut lui en donner un
  //     provisoire, depuis Les accès.
  const { data: existant } = await sb
    .from("profiles")
    .select("username")
    .eq("name", joueur)
    .maybeSingle();
  if (existant) {
    const user = (existant as { username: string }).username.replace(/^@/, "");
    return NextResponse.json({ user, deja: true });
  }

  // 2 · Un identifiant libre : deux joueurs ne peuvent pas partager le leur.
  const { data: tous } = await sb.from("profiles").select("username");
  const pris = new Set(
    ((tous ?? []) as { username: string }[]).map((p) => p.username.replace(/^@/, ""))
  );
  const user = identifiantPour(joueur, pris);
  const password = motDePasseProvisoire();

  // 3 · Création du compte. Le profil naît du trigger (handle_new_user), en
  //     attente comme tout compte neuf : c'est l'admin qui le crée, il est
  //     accepté d'office, et son mot de passe est à changer.
  const { data: cree, error } = await sb.auth.admin.createUser({
    email: email(user),
    password,
    email_confirm: true,
    user_metadata: { name: joueur, username: `@${user}` },
  });
  if (error || !cree.user) {
    return NextResponse.json({ error: error?.message ?? "Création impossible." }, { status: 400 });
  }
  const id = cree.user.id;
  const { error: errValide } = await sb.from("profiles").update({ valide: true }).eq("id", id);
  const { error: errAChanger } = await sb
    .from("mot_de_passe_a_changer")
    .upsert({ user_id: id, motif: "provisoire", depuis: new Date().toISOString() });
  if (errValide || errAChanger) {
    // Un compte à moitié posé ne doit pas rester : on l'efface, l'admin réessaie.
    await sb.auth.admin.deleteUser(id).catch(() => {});
    return NextResponse.json({ error: "Création interrompue. Réessaie." }, { status: 500 });
  }

  return NextResponse.json({ user, password });
}
