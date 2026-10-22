// Supprimer des comptes — SERVEUR, ADMIN SEUL.
//
// Efface le compte de connexion (auth.users) ; le profil et ce qui s'y
// rattache partent avec, en cascade. Sert à nettoyer les membres que la
// saison n'a pas gardés (Admin → Inscriptions, « sans carte dans la
// saison »). Jamais soi-même, jamais un autre admin.

import { NextRequest, NextResponse } from "next/server";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "Fermé sur cet environnement." }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session serveur requise." }, { status: 401 });
  const { data: profil } = await sb.from("profiles").select("is_admin").eq("id", moi.id).maybeSingle();
  if (!(profil as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });
  }

  const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const liste = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string" && x !== moi.id) : [];
  if (!liste.length) return NextResponse.json({ error: "Aucun compte à supprimer." }, { status: 400 });

  const { data: admins } = await sb.from("profiles").select("id").in("id", liste).eq("is_admin", true);
  const proteges = new Set(((admins ?? []) as { id: string }[]).map((a) => a.id));

  const supprimes: string[] = [];
  for (const id of liste) {
    if (proteges.has(id)) continue;
    const { error } = await sb.auth.admin.deleteUser(id);
    if (!error) supprimes.push(id);
  }
  return NextResponse.json({ supprimes });
}
