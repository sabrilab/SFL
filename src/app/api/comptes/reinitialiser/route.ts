// Mot de passe provisoire pour un joueur qui a perdu le sien — SERVEUR, ADMIN.
//
// Remplace « demande à Ilyes, il a la liste » : il n'y a plus de liste. La
// route tire un mot de passe au hasard, le pose sur le compte du joueur et
// le rend UNE fois à l'admin, qui le transmet. Le compte est aussitôt marqué
// « à changer » : le provisoire ne sert qu'à entrer, le joueur en choisit un
// à lui sur l'écran qui suit la connexion.
//
// Poser un mot de passe ferme toutes les sessions ouvertes du compte, sur
// tous les appareils : quelqu'un qui y serait entré à sa place en sort.
//
// Jamais pour soi-même (Réglages → Mon compte), jamais pour un autre admin.

import { NextRequest, NextResponse } from "next/server";
import { motDePasseProvisoire } from "@/lib/sfl/auth/derive.server";
import { appelant, estAdmin, serveur } from "@/lib/sfl/serveur-ligue.server";

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "Fermé sur cet environnement." }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session serveur requise." }, { status: 401 });
  if (!(await estAdmin(sb, moi.id))) return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });

  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Nom manquant." }, { status: 400 });

  const { data: profil } = await sb
    .from("profiles")
    .select("id, username, is_admin")
    .eq("name", name.trim())
    .maybeSingle();
  const p = profil as { id: string; username: string; is_admin: boolean } | null;
  if (!p) return NextResponse.json({ error: "Ce joueur n'a pas encore de compte." }, { status: 404 });
  if (p.id === moi.id) {
    return NextResponse.json({ error: "Le tien se change dans Réglages → Mon compte." }, { status: 400 });
  }
  if (p.is_admin) {
    return NextResponse.json({ error: "Un admin change le sien lui-même." }, { status: 403 });
  }

  const password = motDePasseProvisoire();
  const { error } = await sb.auth.admin.updateUserById(p.id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // Après le changement : le trigger de la base efface la ligne « à changer »
  // quand le mot de passe change, on la repose donc ensuite.
  const { error: errAChanger } = await sb
    .from("mot_de_passe_a_changer")
    .upsert({ user_id: p.id, motif: "provisoire", depuis: new Date().toISOString() });
  if (errAChanger) {
    return NextResponse.json({ error: "Mot de passe posé, mais pas marqué à changer. Réessaie." }, { status: 500 });
  }

  return NextResponse.json({ user: p.username.replace(/^@/, ""), password });
}
