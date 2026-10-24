// Les notifications du Vestiaire — appelée par l'app juste après un message
// ou une réaction (lib/sfl/vestiaire.ts, notifier).
//
// Qui est prévenu, et comment :
//   · un joueur CITÉ (@pseudo), celui à qui l'on RÉPOND, ou celui que la
//     pièce partagée MET EN AVANT (sa carte, un podium, un élément de la
//     Ligue) : tout de suite, avec la phrase ;
//   · l'auteur d'un message qui reçoit une RÉACTION : tout de suite, et la
//     suivante remplace la précédente sur son écran (même étiquette) ;
//   · tous les autres : chaque message, comme Snap ou WhatsApp (Sabri,
//     19/10 : la notification groupée à l'heure ne se voyait pas). Deux
//     garde-fous seulement : rien à qui a le Vestiaire sous les yeux
//     (devant_le, redit toutes les 20 s par l'app), et pas deux
//     notifications au même joueur à moins de RAFALE d'écart.
// Chacun règle les siennes (vestiaire_suivi.notifs) : 'tout', 'cite'
// (cité, mis en avant, réponses et réactions seulement) ou 'rien'.
//
// Les membres acceptés seulement : un compte en attente ne lit pas le
// Vestiaire (la base le lui cache), il n'en reçoit donc rien non plus. Avant
// le 22/10/2026, il recevait chaque message, avec sa phrase.
//
// La route agit avec la clé secrète (lire les abonnements de tout le monde),
// donc elle ne croit pas l'appelant sur parole : le message ou la réaction
// doit exister, être à lui, et être récent. Rejouer l'appel ne renvoie le
// message à tous qu'une fois par RAFALE et ne vise que ses cités.

import { NextRequest, NextResponse } from "next/server";
import { cleVapid } from "@/lib/server/web-push";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { idsSfl } from "@/lib/sfl/parrainage.server";
import { pseudosCites } from "@/lib/sfl/pseudos-cites";
import { joueursDePiece } from "@/lib/sfl/pieces-joueurs";
import { resumeMessage as resume } from "@/lib/sfl/resume-message";
import { nonLus } from "@/lib/sfl/non-lus.server";

export const maxDuration = 30;

const URL_VESTIAIRE = "/vestiaire";
const HEURE = 3600_000;
/** Le Vestiaire est « ouvert » chez qui l'a redit depuis moins que ça. */
const DEVANT = 45_000;
/** Le plus court écart entre deux notifications au même joueur. */
const RAFALE = 15_000;

interface Suivi {
  user_id: string;
  lu_jusqua: string;
  notifs: "tout" | "cite" | "rien";
  notifie_le: string | null;
  devant_le?: string | null;
}

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

  const { data: msg } = await sb
    .from("messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!msg || msg.canal !== "sfl") return NextResponse.json({ error: "Message inconnu." }, { status: 404 });

  const { data: profils } = await sb.from("profiles").select("id, name, username, nom_affiche, valide");
  const tous = (profils ?? []) as {
    id: string;
    name: string;
    username: string;
    nom_affiche: string | null;
    valide: boolean;
  }[];
  // Le Vestiaire est le salon de la SFL : un joueur Bola (venu par un
  // parrain) ne le lit pas, il n'en est pas prévenu.
  const sfl = await idsSfl(sb);
  const membres = new Set(tous.filter((p) => p.valide && (!sfl || sfl.has(p.id))).map((p) => p.id));
  const nomDe = (uid: string) => {
    const p = tous.find((x) => x.id === uid);
    return (p?.nom_affiche ?? p?.name ?? "Quelqu'un").split(" ")[0];
  };

  // select("*") : avant la migration, devant_le n'existe pas encore.
  const { data: suivisBruts } = await sb.from("vestiaire_suivi").select("*");
  const suivis = new Map(((suivisBruts ?? []) as Suivi[]).map((s) => [s.user_id, s]));
  const modeDe = (uid: string) => suivis.get(uid)?.notifs ?? "tout";
  const maintenant = Date.now();
  const devant = (uid: string) => {
    const d = suivis.get(uid)?.devant_le;
    return !!d && maintenant - new Date(d).getTime() < DEVANT;
  };

  // Qui reçoit quoi : un seul message par joueur, le plus précis gagne, et
  // son motif pour la page Activité (lib/sfl/motifs-notif.ts).
  const envois = new Map<string, Envoi>();
  /** Ceux qui reçoivent la notification « un message de plus ». */
  let courants: string[] = [];

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
        motif: "vestiaire-reaction",
        notif: {
          titre: "Vestiaire",
          texte: couper(`${nomDe(moi.id)} a réagi ${emoji} à « ${resume(msg.texte, msg.piece)} »`, 180),
          url: URL_VESTIAIRE,
          tag: "vestiaire-reaction",
        },
      });
    }
  } else {
    if (msg.auteur !== moi.id || maintenant - new Date(msg.created_at).getTime() > 5 * 60_000)
      return NextResponse.json({ error: "Ce message n'est pas le tien." }, { status: 403 });
    const auteur = nomDe(moi.id);
    const phrase = resume(msg.texte, msg.piece);

    // Celui à qui l'on répond.
    const repondu = typeof msg.reponse_a === "number" ? msg.reponse_a : null;
    if (repondu) {
      const { data: original } = await sb.from("messages").select("auteur").eq("id", repondu).maybeSingle();
      const cible = (original as { auteur: string } | null)?.auteur;
      if (cible && cible !== moi.id && modeDe(cible) !== "rien" && !devant(cible))
        envois.set(cible, {
          motif: "vestiaire-reponse",
          notif: {
            titre: `${auteur} t'a répondu au Vestiaire`,
            texte: couper(phrase, 180),
            url: URL_VESTIAIRE,
            tag: `vestiaire-reponse-${msg.id}`,
          },
        });
    }

    // Les cités.
    const cites = new Set(pseudosCites(msg.texte));
    for (const p of tous) {
      const pseudo = p.username.replace(/^@/, "").toLowerCase();
      if (p.id === moi.id || envois.has(p.id) || !cites.has(pseudo) || modeDe(p.id) === "rien" || devant(p.id)) continue;
      envois.set(p.id, {
        motif: "vestiaire-cite",
        notif: {
          titre: `${auteur} t'a cité au Vestiaire`,
          texte: couper(phrase, 180),
          url: URL_VESTIAIRE,
          tag: `vestiaire-cite-${msg.id}`,
        },
      });
    }

    // Ceux que la pièce met en avant (un élément de la Ligue, un podium, une
    // carte) : prévenus comme des cités. Le nom de saison est la clé.
    const enAvant = new Set(joueursDePiece(msg.piece));
    if (enAvant.size > 0) {
      const quoi = resume("", msg.piece).replace(/^a partagé /, "");
      const texte = msg.texte.trim() ? `${quoi} : ${msg.texte.trim()}` : quoi;
      for (const p of tous) {
        if (p.id === moi.id || envois.has(p.id) || !enAvant.has(p.name) || modeDe(p.id) === "rien" || devant(p.id)) continue;
        envois.set(p.id, {
          motif: "vestiaire-en-avant",
          notif: {
            titre: `${auteur} t'a mis en avant au Vestiaire`,
            texte: couper(texte, 180),
            url: URL_VESTIAIRE,
            tag: `vestiaire-cite-${msg.id}`,
          },
        });
      }
    }

    // Tous les autres : ce message, sauf à qui le regarde ou vient d'en recevoir un.
    const { data: abonnes } = await sb.from("push_abonnements").select("user_id");
    courants = [...new Set(((abonnes ?? []) as { user_id: string }[]).map((a) => a.user_id))].filter((uid) => {
      if (uid === moi.id || envois.has(uid) || modeDe(uid) !== "tout" || devant(uid)) return false;
      const dernier = suivis.get(uid)?.notifie_le;
      return !dernier || maintenant - new Date(dernier).getTime() >= RAFALE;
    });
    for (const uid of courants)
      envois.set(uid, {
        motif: "vestiaire-message",
        notif: { titre: `${auteur} · Vestiaire`, texte: couper(phrase, 180), url: URL_VESTIAIRE, tag: "vestiaire" },
      });
  }

  for (const uid of envois.keys()) if (!membres.has(uid)) envois.delete(uid);
  courants = courants.filter((uid) => membres.has(uid));
  if (envois.size === 0) return NextResponse.json({ envoyes: 0 });

  // Le nombre de non lus de chacun, pour la pastille de l'icône : le
  // Vestiaire et les discussions de ses matchs, le compte de la barre
  // d'onglets (lib/sfl/non-lus.server.ts).
  const comptes = await nonLus(sb, [...envois.keys()], maintenant);
  for (const [uid, e] of envois) {
    const n = comptes.get(uid) ?? 0;
    if (n > 0) envois.set(uid, { ...e, notif: { ...e.notif, pastille: n } });
  }

  const { recus, morts } = await prevenir(sb, cle, envois);

  // L'heure de la dernière notification, pour ceux qui l'ont vraiment reçue.
  courants = courants.filter((uid) => recus.has(uid));
  if (courants.length > 0) {
    const quand = new Date(maintenant).toISOString();
    const connus = courants.filter((uid) => suivis.has(uid));
    const neufs = courants.filter((uid) => !suivis.has(uid));
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

  return NextResponse.json({ envoyes: recus.size, morts });
}
