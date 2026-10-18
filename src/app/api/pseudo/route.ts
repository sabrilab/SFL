// Changer son pseudo — SERVEUR.
//
// Le pseudo est unique et ne change qu'une fois tous les 30 jours. La règle
// des 30 jours est dans la base (trigger garde_pseudo, supabase/schema.sql) :
// cette route ne fait qu'ajouter ce que la base ne sait pas, les pseudos
// réservés aux comptes prévus et à l'effectif (les mêmes que l'inscription).
//
// GET  ?pseudo=… : ce pseudo est-il libre pour l'appelant ?
// POST { pseudo } : le change. Jeton du joueur en Authorization: Bearer.
//
// La connexion par mot de passe suit d'elle-même : l'écran de connexion
// retrouve l'identifiant d'un nouveau pseudo (identifiant_de_connexion).

import { NextRequest, NextResponse } from "next/server";
import { appelant, dejaPris, serveur } from "@/lib/sfl/serveur-ligue.server";
import { erreurPseudo, normaliserPseudo } from "@/lib/sfl/inscription";

const FERME = NextResponse.json({ error: "Changement de pseudo indisponible pour l'instant." }, { status: 503 });

export async function GET(req: NextRequest) {
  const sb = serveur();
  if (!sb) return FERME;
  const user = await appelant(sb, req);
  if (!user) return NextResponse.json({ error: "Reconnecte-toi." }, { status: 401 });

  const { data } = await sb
    .from("profiles")
    .select("username, pseudo_change_le")
    .eq("id", user.id)
    .maybeSingle();
  const profil = data as { username: string; pseudo_change_le: string | null } | null;
  if (!profil) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  const prochain = profil.pseudo_change_le
    ? new Date(new Date(profil.pseudo_change_le).getTime() + 30 * 864e5).toISOString()
    : null;
  const etat = { pseudo: profil.username.replace(/^@/, ""), prochain };

  const brut = req.nextUrl.searchParams.get("pseudo");
  if (brut === null) return NextResponse.json(etat);
  const pseudo = normaliserPseudo(brut);
  const erreur = erreurPseudo(pseudo);
  if (erreur) return NextResponse.json({ ...etat, libre: false, raison: erreur });
  try {
    const { pseudos } = await dejaPris(sb, user.id);
    return NextResponse.json({ ...etat, libre: !pseudos.has(pseudo) });
  } catch {
    return NextResponse.json({ error: "Serveur de la ligue injoignable." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return FERME;
  const user = await appelant(sb, req);
  if (!user) return NextResponse.json({ error: "Reconnecte-toi." }, { status: 401 });

  const corps = (await req.json().catch(() => null)) as { pseudo?: string } | null;
  const pseudo = normaliserPseudo(String(corps?.pseudo ?? ""));
  const erreur = erreurPseudo(pseudo);
  if (erreur) return NextResponse.json({ error: `Pseudo : ${erreur}` }, { status: 400 });

  try {
    const { pseudos } = await dejaPris(sb, user.id);
    if (pseudos.has(pseudo)) return NextResponse.json({ error: "Ce pseudo est déjà pris." }, { status: 409 });
  } catch {
    return NextResponse.json({ error: "Serveur de la ligue injoignable." }, { status: 502 });
  }

  const { error } = await sb.from("profiles").update({ username: `@${pseudo}` }).eq("id", user.id);
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Ce pseudo est déjà pris." }, { status: 409 });
    // garde_pseudo : la date du prochain changement est dans son message.
    if (error.code === "P0001" || error.code === "22023") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Changement impossible pour l'instant." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, pseudo });
}
