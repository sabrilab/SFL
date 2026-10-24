// Les messages privés : qui prévenir — appelée par l'app juste après un
// message ou une réaction dans une conversation à deux (lib/sfl/vestiaire.ts,
// notifier ; lib/sfl/messages-prives.ts).
//
//   · un MESSAGE : son destinataire, et lui seul ;
//   · une RÉACTION : l'auteur du message, si c'est l'autre qui réagit.
// Personne d'autre n'est jamais prévenu d'une conversation privée. Rien à
// qui l'a sous les yeux (devant_le, redit toutes les 20 s par l'app), pas
// deux notifications à moins de RAFALE d'écart pour une même conversation
// (elles se remplacent sur le téléphone, même tag), et chacun peut la mettre
// en silence (prive_suivi.notifs = 'rien'). Toucher la notification ouvre la
// conversation (/messages/<lui>).
//
// La route agit avec la clé secrète, donc elle ne croit pas l'appelant sur
// parole : le message ou la réaction doit exister, être à lui et récent.

import { NextRequest, NextResponse } from "next/server";
import { cleVapid } from "@/lib/server/web-push";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { nonLus } from "@/lib/sfl/non-lus.server";
import { resumeMessage as resume } from "@/lib/sfl/resume-message";

export const maxDuration = 30;

/** La conversation est « ouverte » chez qui l'a redit depuis moins que ça. */
const DEVANT = 45_000;
/** Le plus court écart entre deux messages notifiés pour une même conversation. */
const RAFALE = 15_000;
/** Un appel ne vaut que pour un message ou une réaction de moins de cinq minutes. */
const FRAIS = 5 * 60_000;

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function POST(req: NextRequest) {
  const sb = serveur();
  const cle = cleVapid();
  if (!sb || !cle) return NextResponse.json({ envoyes: 0, raison: "pas branché" });

  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const corps = (await req.json().catch(() => ({}))) as { type?: string; id?: unknown; emoji?: unknown };
  const id = Number(corps.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Message inconnu." }, { status: 400 });

  const { data: msg } = await sb.from("messages").select("*").eq("id", id).maybeSingle();
  if (!msg || msg.canal !== "dm" || !msg.destinataire) return NextResponse.json({ error: "Message inconnu." }, { status: 404 });
  if (msg.auteur !== moi.id && msg.destinataire !== moi.id)
    return NextResponse.json({ error: "Cette conversation n'est pas la tienne." }, { status: 403 });

  const maintenant = Date.now();
  let cible: string;
  let envoi: (prenom: string) => Envoi;

  if (corps.type === "reaction") {
    // L'autre a réagi à mon message : seul l'auteur du message est prévenu.
    const emoji = String(corps.emoji ?? "");
    if (msg.auteur === moi.id) return NextResponse.json({ envoyes: 0 });
    const { data: reaction } = await sb
      .from("message_reactions")
      .select("created_at")
      .eq("message_id", id)
      .eq("user_id", moi.id)
      .eq("emoji", emoji)
      .maybeSingle();
    if (!reaction || maintenant - new Date(reaction.created_at).getTime() > FRAIS) return NextResponse.json({ envoyes: 0 });
    cible = msg.auteur;
    envoi = (prenom) => ({
      motif: "prive-reaction",
      ref: `prive:${moi.id}`,
      notif: {
        titre: couper(prenom, 60),
        texte: couper(`a réagi ${emoji} à « ${resume(msg.texte, msg.piece)} »`, 180),
        url: `/messages/${moi.id}`,
        tag: `prive-${moi.id}-reaction`,
      },
    });
  } else {
    if (msg.auteur !== moi.id || maintenant - new Date(msg.created_at).getTime() > FRAIS)
      return NextResponse.json({ error: "Ce message n'est pas le tien." }, { status: 403 });
    cible = msg.destinataire;
    envoi = (prenom) => ({
      motif: "prive-message",
      ref: `prive:${moi.id}`,
      notif: {
        titre: couper(prenom, 60),
        texte: couper(resume(msg.texte, msg.piece), 180),
        url: `/messages/${moi.id}`,
        tag: `prive-${moi.id}`,
      },
    });
  }

  const [{ data: profils }, { data: suivi }, { data: bloque }] = await Promise.all([
    sb.from("profiles").select("id, name, nom_affiche, valide").in("id", [moi.id, cible]),
    sb.from("prive_suivi").select("notifs, devant_le, notifie_le").eq("user_id", cible).eq("autre", moi.id).maybeSingle(),
    sb.from("prive_blocages").select("bloque").eq("user_id", cible).eq("bloque", moi.id).maybeSingle(),
  ]);
  const tous = (profils ?? []) as { id: string; name: string; nom_affiche: string | null; valide: boolean }[];
  const lui = tous.find((p) => p.id === cible);
  const s = suivi as { notifs: string; devant_le: string | null; notifie_le: string | null } | null;
  const devant = !!s?.devant_le && maintenant - new Date(s.devant_le).getTime() < DEVANT;
  const rafale = corps.type !== "reaction" && !!s?.notifie_le && maintenant - new Date(s.notifie_le).getTime() < RAFALE;
  if (!lui?.valide || bloque || s?.notifs === "rien" || devant || rafale) return NextResponse.json({ envoyes: 0 });

  const p = tous.find((x) => x.id === moi.id);
  const prenom = (p?.nom_affiche ?? p?.name ?? "Quelqu'un").split(" ")[0];
  const e = envoi(prenom);

  // Le nombre de non lus du destinataire, pour la pastille de l'icône
  // (lib/sfl/non-lus.server.ts).
  const n = (await nonLus(sb, [cible], maintenant)).get(cible) ?? 0;
  const envois = new Map<string, Envoi>([[cible, n > 0 ? { ...e, notif: { ...e.notif, pastille: n } } : e]]);
  const { recus, morts } = await prevenir(sb, cle, envois, { de: moi.id });

  if (recus.has(cible) && corps.type !== "reaction") {
    const quand = new Date(maintenant).toISOString();
    // Une ligne neuve n'a encore rien lu : toute la conversation reste à lire.
    if (s) await sb.from("prive_suivi").update({ notifie_le: quand }).eq("user_id", cible).eq("autre", moi.id);
    else
      await sb
        .from("prive_suivi")
        .upsert(
          { user_id: cible, autre: moi.id, notifie_le: quand, lu_jusqua: new Date(0).toISOString() },
          { onConflict: "user_id,autre", ignoreDuplicates: true }
        );
  }

  return NextResponse.json({ envoyes: recus.size, morts });
}
