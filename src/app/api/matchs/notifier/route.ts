// Les notifications d'un match ouvert par un joueur — appelée par l'app juste
// après le geste de l'organisateur (lib/sfl/matchs.ts) :
//   · invitation : chaque invité pas encore prévenu reçoit « X t'invite »,
//     une seule fois (match_joueurs.notifie_le) ; rejouer l'appel ne
//     renvoie rien ;
//   · modifie : le jour, l'heure ou le lieu ont changé, tous ceux qui en
//     sont reçoivent le nouveau rendez-vous ; la notification remplace la
//     précédente du même match sur l'écran (même étiquette) ;
//   · annule : le serveur prévient tout le monde, puis efface le match (il
//     faut lire les joueurs avant qu'ils disparaissent avec lui).
// Toucher la notification ouvre la fiche du match sur la Map (/?match=id).
//
// La route agit avec la clé secrète : elle vérifie que l'appelant est bien
// l'organisateur du match.

import { NextRequest, NextResponse } from "next/server";
import { cleVapid } from "@/lib/server/web-push";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { jourLong } from "@/lib/sfl/jour-long";
import type { Notif } from "@/lib/sfl/push";

export const maxDuration = 30;

type Type = "invitation" | "modifie" | "annule";

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const corps = (await req.json().catch(() => ({}))) as { id?: unknown; type?: unknown };
  const id = Number(corps.id);
  const type = corps.type as Type;
  if (!Number.isInteger(id) || !["invitation", "modifie", "annule"].includes(type))
    return NextResponse.json({ error: "Demande inconnue." }, { status: 400 });

  const { data: match } = await sb
    .from("matchs")
    .select("id, organisateur, jour, heure, lieu")
    .eq("id", id)
    .maybeSingle();
  if (!match) return NextResponse.json({ error: "Match inconnu." }, { status: 404 });
  if (match.organisateur !== moi.id) return NextResponse.json({ error: "Ce match n'est pas le tien." }, { status: 403 });

  const { data: lignes } = await sb.from("match_joueurs").select("*").eq("match_id", id);
  const joueurs = ((lignes ?? []) as { player_id: string; statut: string; notifie_le?: string | null }[]).filter(
    (j) => j.player_id !== moi.id
  );

  const { data: orga } = await sb.from("profiles").select("name, nom_affiche").eq("id", moi.id).maybeSingle();
  const qui = ((orga as { nom_affiche?: string | null; name?: string } | null)?.nom_affiche ?? orga?.name ?? "Quelqu'un").split(" ")[0];
  const rdv = couper(`${jourLong(match.jour)} · ${match.heure} · ${match.lieu}`, 180);
  const url = `/?match=${id}`;
  const tag = `match-${id}`;

  let cibles: string[] = [];
  let notif: Notif;
  if (type === "invitation") {
    // Avant la migration (aperçus), notifie_le n'existe pas : seuls les
    // invités des cinq dernières minutes, pour ne pas reprévenir tout le monde.
    const avecColonne = (lignes ?? []).length === 0 || "notifie_le" in ((lignes ?? [])[0] as object);
    const recent = Date.now() - 5 * 60_000;
    cibles = joueurs
      .filter((j) => j.statut === "invite")
      .filter((j) =>
        avecColonne ? !j.notifie_le : new Date((j as { created_at?: string }).created_at ?? 0).getTime() > recent
      )
      .map((j) => j.player_id);
    if (cibles.length > 0 && avecColonne)
      await sb.from("match_joueurs").update({ notifie_le: new Date().toISOString() }).eq("match_id", id).in("player_id", cibles);
    notif = { titre: `${qui} t'invite · Match`, texte: rdv, url, tag };
  } else if (type === "modifie") {
    cibles = joueurs.map((j) => j.player_id);
    notif = { titre: `Match de ${qui} : nouveau rendez-vous`, texte: rdv, url, tag };
  } else {
    cibles = joueurs.map((j) => j.player_id);
    notif = { titre: `Match de ${qui} annulé`, texte: rdv, url: "/", tag };
    const { error } = await sb.from("matchs").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cle = cleVapid();
  let envoyes = 0;
  if (cle && cibles.length > 0) {
    // Le motif, pour la page Activité : match-invitation, match-modifie ou match-annule.
    const motif = type === "invitation" ? "match-invitation" : type === "modifie" ? "match-modifie" : "match-annule";
    const envois = new Map(cibles.map((uid): [string, Envoi] => [uid, { notif, motif, ref: `match:${id}` }]));
    envoyes = (await prevenir(sb, cle, envois, { de: moi.id })).recus.size;
  }

  return NextResponse.json({ envoyes, prevenus: cibles.length, annule: type === "annule" });
}
