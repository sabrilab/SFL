// Prévenir l'app d'une nouvelle vidéo (lib/sfl/videos.ts) : une notification
// par joueur de Bola qui a un téléphone abonné, que l'admin lance lui-même
// depuis Admin → Activité → Vidéos, après avoir lu le texte exact :
//   « L'Entrée · J3 » · « Dimanche, à l'Hippodrome de Marcq. »
// (la légende de la vidéo, ou « Nouvelle vidéo dans les Actus. »). La
// toucher ouvre le lecteur (/ligue?video=<id>).
//
// Une fois par joueur et par vidéo : chacun est « réservé » dans
// annonces_envois avant l'envoi ; relancer ne prévient que ceux qui ne
// l'ont pas encore reçue (un envoi raté libère la réservation). Motif
// « video » (lib/sfl/motifs-notif.ts) : Admin → Activité → Notifs compte qui
// l'a touchée, et qui l'a regardée dans la semaine (push_effet_video).
//
// Les vidéos vivent dans les Actus de la SFL : un joueur Bola (venu par un
// parrain, hors de l'effectif, pas admin : hors_sfl en base) ne peut pas les
// voir, il n'en est pas prévenu (28/10/2026), comme pour le Vestiaire.
//
// Réservée à l'admin (lu dans profiles, jamais dans le jeton).

import { NextRequest, NextResponse } from "next/server";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { cleVapid } from "@/lib/server/web-push";
import { appelant, estAdmin, serveur } from "@/lib/sfl/serveur-ligue.server";
import { idsSfl } from "@/lib/sfl/parrainage.server";
import type { Notif } from "@/lib/sfl/push";
import { texteAnnonceVideo } from "@/lib/sfl/videos-annonce";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "Pas encore branché." }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (!(await estAdmin(sb, moi.id))) return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });

  const corps = (await req.json().catch(() => ({}))) as { video?: unknown };
  const id = typeof corps.video === "string" ? corps.video : "";
  const { data: v } = await sb.from("videos").select("id, titre, legende, publiee_le").eq("id", id).maybeSingle();
  const video = v as { id: string; titre: string; legende: string | null; publiee_le: string | null } | null;
  if (!video?.publiee_le || Date.parse(video.publiee_le) > Date.now())
    return NextResponse.json({ error: "Publie la vidéo d'abord." }, { status: 400 });

  const cle = cleVapid();
  if (!cle) return NextResponse.json({ error: "Notifications pas configurées." }, { status: 503 });

  // Tous les comptes acceptés qui ont un téléphone abonné, sauf les joueurs
  // Bola : filleuls (parrainages) hors de l'effectif et pas admins. La saison
  // illisible, on ne filtre pas (comme le Vestiaire).
  const [{ data: profils }, { data: filleuls }, sfl] = await Promise.all([
    sb.from("profiles").select("id, name").eq("valide", true),
    sb.from("parrainages").select("filleul"),
    idsSfl(sb),
  ]);
  const bola = new Set(((filleuls ?? []) as { filleul: string }[]).map((f) => f.filleul));
  const joueurs = ((profils ?? []) as { id: string; name: string }[]).filter(
    (p) => !sfl || !bola.has(p.id) || sfl.has(p.id)
  );
  const { data: abonnements } = await sb
    .from("push_abonnements")
    .select("user_id")
    .in(
      "user_id",
      joueurs.map((p) => p.id)
    );
  const abonnes = new Set(((abonnements ?? []) as { user_id: string }[]).map((a) => a.user_id));
  const idDe = new Map(joueurs.filter((p) => abonnes.has(p.id)).map((p) => [p.name, p.id]));
  if (!idDe.size) return NextResponse.json({ envoyes: 0, deja: 0 });

  const annonce = `video-${video.id}`;
  const { data: reserves, error: refus } = await sb
    .from("annonces_envois")
    .upsert(
      [...idDe.keys()].map((joueur) => ({ annonce, joueur })),
      { onConflict: "annonce,joueur", ignoreDuplicates: true }
    )
    .select("joueur");
  if (refus) return NextResponse.json({ error: "Réservation impossible." }, { status: 503 });

  const { titre, texte } = texteAnnonceVideo(video);
  const notif: Notif = { titre, texte, url: `/ligue?video=${encodeURIComponent(video.id)}`, tag: annonce };
  const envois = new Map<string, Envoi>();
  for (const { joueur } of (reserves ?? []) as { joueur: string }[]) {
    const uid = idDe.get(joueur);
    if (uid) envois.set(uid, { notif, motif: "video", ref: `video:${video.id}` });
  }
  const { recus } = await prevenir(sb, cle, envois);
  const rates = [...idDe].filter(([, uid]) => envois.has(uid) && !recus.has(uid)).map(([joueur]) => joueur);
  if (rates.length > 0) await sb.from("annonces_envois").delete().eq("annonce", annonce).in("joueur", rates);

  return NextResponse.json({ envoyes: recus.size, deja: idDe.size - envois.size, rates: rates.length });
}
