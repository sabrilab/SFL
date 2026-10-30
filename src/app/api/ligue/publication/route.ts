// « J4 en ligne » (30/10/2026) : l'admin vient de publier une journée qu'il
// préparait en brouillon (saisie/brouillon.ts) et choisit qui prévenir
// (lib/sfl/annonce-publication.ts). La route relit la saison PUBLIÉE : une
// journée encore en brouillon n'est jamais annoncée. Une seule fois par
// journée et par joueur (annonces_envois, clé publication-s{n}-j{j}).
//
// GET ?j=4 : ce qui ne se reprend pas — combien de joueurs ont déjà été
// prévenus pour cette journée (sa publication, ses missions). La feuille
// « Remettre en brouillon » l'affiche comme un fait.
//
// Session d'admin exigée ; la route agit avec la clé secrète.

import { NextRequest, NextResponse } from "next/server";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { cleVapid } from "@/lib/server/web-push";
import { appelant, estAdmin, serveur } from "@/lib/sfl/serveur-ligue.server";
import { lireSaisonServeur } from "@/lib/sfl/saison-serveur.server";
import {
  clePublication,
  destinatairesPublication,
  publicationAnnoncable,
  textePublication,
  type QuiPrevenir,
} from "@/lib/sfl/annonce-publication";
import { numeroSaison } from "@/lib/sfl/saisie/types";

export const maxDuration = 30;

async function admin(req: NextRequest) {
  const sb = serveur();
  if (!sb) return { erreur: NextResponse.json({ error: "pas branché" }, { status: 503 }) } as const;
  const moi = await appelant(sb, req);
  if (!moi) return { erreur: NextResponse.json({ error: "Session requise." }, { status: 401 }) } as const;
  if (!(await estAdmin(sb, moi.id))) return { erreur: NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 }) } as const;
  return { sb } as const;
}

export async function GET(req: NextRequest) {
  const a = await admin(req);
  if ("erreur" in a) return a.erreur;
  const j = Number(req.nextUrl.searchParams.get("j"));
  if (!Number.isInteger(j) || j < 1) return NextResponse.json({ error: "Journée ?" }, { status: 400 });
  const lue = await lireSaisonServeur(a.sb).catch(() => null);
  const n = lue ? numeroSaison(lue.document) : 0;
  const [pub, missions] = await Promise.all([
    a.sb.from("annonces_envois").select("joueur", { count: "exact", head: true }).eq("annonce", clePublication({ numero: n }, j)),
    a.sb.from("missions_envois").select("joueur", { count: "exact", head: true }).eq("saison", n).eq("j", j),
  ]);
  return NextResponse.json({ publication: pub.count ?? 0, missions: missions.count ?? 0 });
}

export async function POST(req: NextRequest) {
  const a = await admin(req);
  if ("erreur" in a) return a.erreur;
  const sb = a.sb;
  const corps = (await req.json().catch(() => ({}))) as { j?: unknown; qui?: unknown };
  const j = Number(corps.j);
  const qui = (["personne", "viennent", "ligue"] as const).find((x) => x === corps.qui) ?? "personne";
  if (!Number.isInteger(j) || j < 1) return NextResponse.json({ error: "Journée ?" }, { status: 400 });
  if (qui === "personne") return NextResponse.json({ envoyes: 0 });

  const lue = await lireSaisonServeur(sb).catch(() => null);
  const saison = lue?.brute;
  // Seulement une journée que la ligue voit : jamais un brouillon.
  if (!saison || !publicationAnnoncable(saison, j)) return NextResponse.json({ error: "Journée pas publiée." }, { status: 409 });

  const cle = cleVapid();
  if (!cle) return NextResponse.json({ envoyes: 0 });
  const noms = destinatairesPublication(saison, j, qui as QuiPrevenir);
  const { data: profils } = await sb.from("profiles").select("id, name").eq("valide", true).in("name", noms.length ? noms : [""]);
  const idDe = new Map(((profils ?? []) as { id: string; name: string }[]).map((p) => [p.name, p.id]));
  if (!idDe.size) return NextResponse.json({ envoyes: 0 });

  const annonce = clePublication(saison, j);
  const { data: reserves, error: refus } = await sb
    .from("annonces_envois")
    .upsert([...idDe.keys()].map((joueur) => ({ annonce, joueur })), { onConflict: "annonce,joueur", ignoreDuplicates: true })
    .select("joueur");
  if (refus) return NextResponse.json({ envoyes: 0 });
  const { titre, texte } = textePublication(saison, j);
  const envois = new Map<string, Envoi>();
  for (const { joueur } of (reserves ?? []) as { joueur: string }[]) {
    const uid = idDe.get(joueur);
    if (uid) envois.set(uid, { notif: { titre, texte, url: "/ligue", tag: annonce }, motif: "publication", ref: annonce });
  }
  const { recus } = await prevenir(sb, cle, envois);
  const rates = [...idDe].filter(([, uid]) => envois.has(uid) && !recus.has(uid)).map(([joueur]) => joueur);
  if (rates.length > 0) await sb.from("annonces_envois").delete().eq("annonce", annonce).in("joueur", rates);
  return NextResponse.json({ envoyes: recus.size });
}
