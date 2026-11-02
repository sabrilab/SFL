// Le bilan d'XP calculé par le serveur : la source qui fait foi (lib/sfl/
// xp-serveur.server.ts). L'app l'appelle à l'ouverture et au retour sur elle,
// au plus une fois toutes les 10 minutes par appareil (hooks/
// use-bilan-serveur.ts), et après « Publier la journée ».
//
// Le serveur calcule le journal de toute la ligue, garde le palier atteint
// par chacun (passe_acquis, par poser_paliers_acquis : il ne redescend
// jamais), puis rend le bilan de l'appelant, ses XP S gagnées comprises
// (xpS, lib/sfl/xp-s.ts). La route agit avec la clé secrète : elle exige une
// session de membre validé. Le même joueur qui rappelle dans les secondes
// qui suivent reprend le calcul en cours ou le précédent (xpServeurRecent) :
// un appel répété ne recalcule pas toute la ligue.

import { NextRequest, NextResponse } from "next/server";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { bilanServeurDe, paliersAGarder, xpServeurRecent, type XpServeur } from "@/lib/sfl/xp-serveur.server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const { data: profil } = await sb.from("profiles").select("name, valide").eq("id", moi.id).maybeSingle();
  const p = profil as { name: string; valide: boolean } | null;
  if (!p?.valide || !p.name) return NextResponse.json({ error: "Réservé aux joueurs de la ligue." }, { status: 403 });
  const jeton = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const maintenant = new Date();
  let x: XpServeur;
  try {
    x = await xpServeurRecent(sb, { id: moi.id, nom: p.name, jeton }, maintenant);
  } catch {
    return NextResponse.json({ error: "Réessaie." }, { status: 503 });
  }
  // Garder les paliers de toute la ligue : un palier atteint ne redescend jamais.
  const lignes = paliersAGarder(x, p.name, maintenant);
  if (lignes.length) await sb.rpc("poser_paliers_acquis", { p_lignes: lignes });
  const { data: gardes } = await sb.from("passe_acquis").select("saison_passe, palier").eq("joueur", moi.id);
  const parSaison = Object.fromEntries(((gardes ?? []) as { saison_passe: string; palier: number }[]).map((g) => [g.saison_passe, g.palier]));
  return NextResponse.json(bilanServeurDe(x, p.name, maintenant, parSaison));
}
