// Les notifications du Vestiaire — appelée par l'app juste après un message
// ou une réaction (lib/sfl/vestiaire.ts, notifier).
//
// Qui est prévenu, et comment (sans spammer une ligue entière) :
//   · un joueur CITÉ (@pseudo) : tout de suite, avec la phrase ;
//   · l'auteur d'un message qui reçoit une RÉACTION : tout de suite, et la
//     suivante remplace la précédente sur son écran (même étiquette) ;
//   · tous les autres : UNE notification groupée (« 4 nouveaux messages au
//     Vestiaire ») au plus par heure, et rien s'il a le Vestiaire ouvert
//     (il l'a lu dans les deux dernières minutes).
// Chacun règle les siennes (vestiaire_suivi.notifs) : 'tout', 'cite'
// (cité et réactions seulement) ou 'rien'.
//
// La route agit avec la clé secrète (lire les abonnements de tout le monde),
// donc elle ne croit pas l'appelant sur parole : le message ou la réaction
// doit exister, être à lui, et être récent. Rejouer l'appel ne renvoie rien
// au groupé (notifie_le) et ne vise que les cités du message lui-même.

import { NextRequest, NextResponse } from "next/server";
import { cleVapid, envoyer, type Abonnement } from "@/lib/server/web-push";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { pseudosCites } from "@/lib/sfl/pseudos-cites";
import type { Notif } from "@/lib/sfl/push";

export const maxDuration = 30;

const URL_VESTIAIRE = "/ligue?vue=vestiaire";
const HEURE = 3600_000;
/** Le Vestiaire est « ouvert » chez qui l'a lu depuis moins que ça. */
const DEVANT = 2 * 60_000;

interface Suivi {
  user_id: string;
  lu_jusqua: string;
  notifs: "tout" | "cite" | "rien";
  notifie_le: string | null;
}

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Ce que la notification dit d'un message à pièce sans texte. */
function resume(texte: string, piece: unknown): string {
  if (texte.trim()) return texte.trim();
  const type = (piece as { type?: string } | null)?.type;
  return type === "carte" ? "a partagé une carte" : type === "feuille" ? "a partagé une feuille de match" : "a partagé un classement";
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  const cle = cleVapid();
  if (!sb || !cle) return NextResponse.json({ envoyes: 0, raison: "pas branché" });

  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const corps = (await req.json().catch(() => ({}))) as { type?: string; id?: unknown; emoji?: unknown };
  const id = Number(corps.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Message inconnu." }, { status: 400 });

  const { data: msg } = await sb
    .from("messages")
    .select("id, auteur, texte, piece, canal, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!msg || msg.canal !== "sfl") return NextResponse.json({ error: "Message inconnu." }, { status: 404 });

  const { data: profils } = await sb.from("profiles").select("id, name, username, nom_affiche");
  const tous = (profils ?? []) as { id: string; name: string; username: string; nom_affiche: string | null }[];
  const nomDe = (uid: string) => {
    const p = tous.find((x) => x.id === uid);
    return (p?.nom_affiche ?? p?.name ?? "Quelqu'un").split(" ")[0];
  };

  const { data: suivisBruts } = await sb.from("vestiaire_suivi").select("user_id, lu_jusqua, notifs, notifie_le");
  const suivis = new Map(((suivisBruts ?? []) as Suivi[]).map((s) => [s.user_id, s]));
  const modeDe = (uid: string) => suivis.get(uid)?.notifs ?? "tout";
  const maintenant = Date.now();
  const devant = (uid: string) => {
    const s = suivis.get(uid);
    return !!s && maintenant - new Date(s.lu_jusqua).getTime() < DEVANT;
  };

  // Qui reçoit quoi : un seul message par joueur, le plus précis gagne.
  const envois = new Map<string, Notif>();
  let groupes: string[] = [];

  if (corps.type === "reaction") {
    const emoji = String(corps.emoji ?? "");
    const { data: reaction } = await sb
      .from("message_reactions")
      .select("created_at")
      .eq("message_id", id)
      .eq("user_id", moi.id)
      .eq("emoji", emoji)
      .maybeSingle();
    const recente = reaction && maintenant - new Date(reaction.created_at).getTime() < 5 * 60_000;
    if (recente && msg.auteur !== moi.id && modeDe(msg.auteur) !== "rien" && !devant(msg.auteur)) {
      envois.set(msg.auteur, {
        titre: "Vestiaire",
        texte: couper(`${nomDe(moi.id)} a réagi ${emoji} à « ${resume(msg.texte, msg.piece)} »`, 180),
        url: URL_VESTIAIRE,
        tag: "vestiaire-reaction",
      });
    }
  } else {
    if (msg.auteur !== moi.id || maintenant - new Date(msg.created_at).getTime() > 5 * 60_000)
      return NextResponse.json({ error: "Ce message n'est pas le tien." }, { status: 403 });
    const auteur = nomDe(moi.id);
    const phrase = resume(msg.texte, msg.piece);

    // Les cités.
    const cites = new Set(pseudosCites(msg.texte));
    for (const p of tous) {
      const pseudo = p.username.replace(/^@/, "").toLowerCase();
      if (p.id === moi.id || !cites.has(pseudo) || modeDe(p.id) === "rien") continue;
      envois.set(p.id, {
        titre: `${auteur} t'a cité au Vestiaire`,
        texte: couper(phrase, 180),
        url: URL_VESTIAIRE,
        tag: `vestiaire-cite-${msg.id}`,
      });
    }

    // Les autres, groupés : une fois par heure au plus.
    const { data: abonnes } = await sb.from("push_abonnements").select("user_id");
    const candidats = [...new Set(((abonnes ?? []) as { user_id: string }[]).map((a) => a.user_id))].filter((uid) => {
      if (uid === moi.id || envois.has(uid) || modeDe(uid) !== "tout" || devant(uid)) return false;
      const dernier = suivis.get(uid)?.notifie_le;
      return !dernier || maintenant - new Date(dernier).getTime() >= HEURE;
    });
    if (candidats.length > 0) {
      // Combien de messages chacun n'a pas lus : on lit les récents une fois.
      const { data: recents } = await sb
        .from("messages")
        .select("auteur, created_at")
        .eq("canal", "sfl")
        .gt("created_at", new Date(maintenant - 7 * 24 * HEURE).toISOString());
      for (const uid of candidats) {
        const lu = suivis.has(uid) ? new Date(suivis.get(uid)!.lu_jusqua).getTime() : maintenant - 3 * 24 * HEURE;
        const n = ((recents ?? []) as { auteur: string; created_at: string }[]).filter(
          (m) => m.auteur !== uid && new Date(m.created_at).getTime() > lu
        ).length;
        if (n === 0) continue;
        envois.set(uid, {
          titre: n > 1 ? `${n} nouveaux messages au Vestiaire` : "Nouveau message au Vestiaire",
          texte: couper(`${auteur} : ${phrase}`, 180),
          url: URL_VESTIAIRE,
          tag: "vestiaire",
        });
        groupes.push(uid);
      }
    }
  }

  if (envois.size === 0) return NextResponse.json({ envoyes: 0 });

  const { data: abonnements } = await sb
    .from("push_abonnements")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", [...envois.keys()]);
  const resultats = await Promise.all(
    ((abonnements ?? []) as (Abonnement & { user_id: string })[]).map(async (ab) => ({
      ab,
      r: await envoyer(ab, envois.get(ab.user_id), cle),
    }))
  );

  const morts = resultats.filter((x) => x.r === "mort").map((x) => x.ab.endpoint);
  if (morts.length > 0) await sb.from("push_abonnements").delete().in("endpoint", morts);

  // L'heure du dernier groupé, pour ceux qui l'ont vraiment reçu.
  const recus = new Set(resultats.filter((x) => x.r === "envoye").map((x) => x.ab.user_id));
  groupes = groupes.filter((uid) => recus.has(uid));
  if (groupes.length > 0) {
    const quand = new Date(maintenant).toISOString();
    const connus = groupes.filter((uid) => suivis.has(uid));
    const neufs = groupes.filter((uid) => !suivis.has(uid));
    if (connus.length > 0)
      await sb.from("vestiaire_suivi").update({ notifie_le: quand }).in("user_id", connus);
    // Une ligne neuve garde « non lu » ce qui l'est : trois jours en arrière,
    // comme la pastille de qui n'a jamais ouvert le Vestiaire.
    if (neufs.length > 0)
      await sb.from("vestiaire_suivi").upsert(
        neufs.map((uid) => ({
          user_id: uid,
          notifie_le: quand,
          lu_jusqua: new Date(maintenant - 3 * 24 * HEURE).toISOString(),
        })),
        { onConflict: "user_id" }
      );
  }

  return NextResponse.json({ envoyes: recus.size, morts: morts.length });
}
