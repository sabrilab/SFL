// La discussion d'un match ouvert par un joueur : qui prévenir, et comment —
// appelée par l'app juste après un message, une réaction, ou l'arrivée d'un
// joueur dans le match (lib/sfl/vestiaire.ts, notifier ;
// lib/sfl/discussion-match.ts, annoncerArrivee).
//
//   · une ARRIVÉE (« Kader a rejoint le match », la ligne que l'app pose
//     quand il prend une place ou accepte l'invitation) : l'organisateur et
//     les inscrits, avec le rendez-vous et ce qu'il manque encore. Une fois
//     par joueur et par match en six heures : qui sort et revient ne
//     réveille pas tout le monde deux fois ;
//   · un MESSAGE : l'organisateur et les inscrits, chaque message, comme au
//     Vestiaire. Un invité lit la discussion sans être encore du match : il
//     n'est prévenu que si on lui répond ou qu'on le cite (@pseudo) ;
//   · une RÉACTION : l'auteur du message, tout de suite.
// Rien à qui a la discussion sous les yeux (devant_le, redit toutes les 20 s
// par l'app), pas deux messages au même joueur à moins de RAFALE d'écart
// (sauf s'il est cité ou qu'on lui répond), et chacun règle les siennes
// (match_suivi.notifs : 'tout', 'cite' ou 'rien'). Toucher la notification
// ouvre la discussion sur la Map (/?match=id&discussion).
//
// La route agit avec la clé secrète, donc elle ne croit pas l'appelant sur
// parole : le message ou la réaction doit exister, être à lui, être récent,
// et il doit être du match.

import { NextRequest, NextResponse } from "next/server";
import { cleVapid } from "@/lib/server/web-push";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { nonLus } from "@/lib/sfl/non-lus.server";
import { pseudosCites } from "@/lib/sfl/pseudos-cites";
import { resumeMessage as resume } from "@/lib/sfl/resume-message";
import { jourLong } from "@/lib/sfl/jour-long";

export const maxDuration = 30;

/** La discussion est « ouverte » chez qui l'a redit depuis moins que ça. */
const DEVANT = 45_000;
/** Le plus court écart entre deux messages notifiés au même joueur, pour un même match. */
const RAFALE = 15_000;
/** Une arrivée ne réveille les autres qu'une fois par joueur et par match sur ce délai. */
const ARRIVEE = 6 * 3600_000;
/** Un appel ne vaut que pour un message ou une réaction de moins de cinq minutes. */
const FRAIS = 5 * 60_000;

interface Suivi {
  user_id: string;
  notifs: "tout" | "cite" | "rien";
  devant_le: string | null;
  notifie_le: string | null;
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

  const { data: msg } = await sb.from("messages").select("*").eq("id", id).maybeSingle();
  if (!msg || msg.canal !== "match" || msg.match_id == null)
    return NextResponse.json({ error: "Message inconnu." }, { status: 404 });

  const { data: match } = await sb
    .from("matchs")
    .select("id, organisateur, jour, heure, lieu, places")
    .eq("id", msg.match_id)
    .maybeSingle();
  if (!match) return NextResponse.json({ error: "Match inconnu." }, { status: 404 });
  const { data: lignes } = await sb.from("match_joueurs").select("player_id, statut").eq("match_id", match.id);
  const joueurs = (lignes ?? []) as { player_id: string; statut: "invite" | "inscrit" }[];

  // Ceux qui jouent (l'organisateur, les inscrits) sont prévenus de tout ;
  // ceux du match, invités compris, quand on leur répond ou qu'on les cite.
  const jouent = new Set<string>([match.organisateur, ...joueurs.filter((j) => j.statut === "inscrit").map((j) => j.player_id)]);
  const membres = new Set<string>([...jouent, ...joueurs.map((j) => j.player_id)]);
  if (!membres.has(moi.id)) return NextResponse.json({ error: "Ce match n'est pas le tien." }, { status: 403 });

  const { data: profils } = await sb
    .from("profiles")
    .select("id, name, username, nom_affiche, valide")
    .in("id", [...membres]);
  const tous = (profils ?? []) as { id: string; name: string; username: string; nom_affiche: string | null; valide: boolean }[];
  const prenom = (uid: string) => {
    const p = tous.find((x) => x.id === uid);
    return (p?.nom_affiche ?? p?.name ?? "Quelqu'un").split(" ")[0];
  };

  const { data: suivisBruts } = await sb
    .from("match_suivi")
    .select("user_id, notifs, devant_le, notifie_le")
    .eq("match_id", match.id);
  const suivis = new Map(((suivisBruts ?? []) as Suivi[]).map((s) => [s.user_id, s]));
  const modeDe = (uid: string) => suivis.get(uid)?.notifs ?? "tout";
  const maintenant = Date.now();
  const devant = (uid: string) => {
    const d = suivis.get(uid)?.devant_le;
    return !!d && maintenant - new Date(d).getTime() < DEVANT;
  };
  /** Un compte validé du match, ni l'appelant, ni qui refuse tout ou regarde déjà. */
  const joignable = (uid: string) =>
    uid !== moi.id && tous.some((p) => p.id === uid && p.valide) && modeDe(uid) !== "rien" && !devant(uid);

  const nomDuMatch = `Match à ${match.lieu}`;
  const url = `/?match=${match.id}&discussion`;
  const tag = `match-${match.id}`;
  const ref = `match:${match.id}`;

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
    const recente = reaction && maintenant - new Date(reaction.created_at).getTime() < FRAIS;
    if (recente && joignable(msg.auteur))
      envois.set(msg.auteur, {
        motif: "match-reaction",
        ref,
        notif: {
          titre: couper(nomDuMatch, 60),
          texte: couper(`${prenom(moi.id)} a réagi ${emoji} à « ${resume(msg.texte, msg.piece)} »`, 180),
          url,
          tag: `${tag}-reaction`,
        },
      });
  } else {
    if (msg.auteur !== moi.id || maintenant - new Date(msg.created_at).getTime() > FRAIS)
      return NextResponse.json({ error: "Ce message n'est pas le tien." }, { status: 403 });
    const auteur = prenom(moi.id);

    if ((msg.piece as { type?: string } | null)?.type === "rejoint") {
      // Déjà annoncé il y a peu (il est sorti puis revenu) : personne n'est réveillé.
      const { data: avant } = await sb
        .from("messages")
        .select("id")
        .eq("canal", "match")
        .eq("match_id", match.id)
        .eq("auteur", moi.id)
        .eq("piece->>type", "rejoint")
        .lt("id", msg.id)
        .gt("created_at", new Date(maintenant - ARRIVEE).toISOString())
        .limit(1);
      if ((avant ?? []).length === 0) {
        const manque = Math.max(0, match.places - joueurs.length);
        const rdv = `${jourLong(match.jour)} · ${match.heure} · ${match.lieu} · ${manque > 0 ? `Il manque ${manque}` : "Complet"}`;
        for (const uid of jouent) {
          if (!joignable(uid)) continue;
          envois.set(uid, {
            motif: "match-arrivee",
            ref,
            notif: {
              titre: couper(`${auteur} a rejoint ${uid === match.organisateur ? "ton" : "le"} match`, 60),
              texte: couper(rdv, 180),
              url,
              tag: `${tag}-arrivee`,
            },
          });
        }
      }
    } else {
      const phrase = couper(resume(msg.texte, msg.piece), 180);

      // Celui à qui l'on répond.
      const repondu = typeof msg.reponse_a === "number" ? msg.reponse_a : null;
      if (repondu) {
        const { data: original } = await sb.from("messages").select("auteur").eq("id", repondu).maybeSingle();
        const cible = (original as { auteur: string } | null)?.auteur;
        if (cible && membres.has(cible) && joignable(cible))
          envois.set(cible, {
            motif: "match-reponse",
            ref,
            notif: { titre: couper(`${auteur} t'a répondu · ${nomDuMatch}`, 60), texte: phrase, url, tag: `${tag}-reponse-${msg.id}` },
          });
      }

      // Les cités, parmi ceux du match.
      const cites = new Set(pseudosCites(msg.texte));
      for (const p of tous) {
        if (envois.has(p.id) || !cites.has(p.username.replace(/^@/, "").toLowerCase()) || !joignable(p.id)) continue;
        envois.set(p.id, {
          motif: "match-cite",
          ref,
          notif: { titre: couper(`${auteur} t'a cité · ${nomDuMatch}`, 60), texte: phrase, url, tag: `${tag}-cite-${msg.id}` },
        });
      }

      // Ceux qui jouent : ce message, sauf à qui vient d'en recevoir un.
      courants = [...jouent].filter((uid) => {
        if (envois.has(uid) || !joignable(uid) || modeDe(uid) !== "tout") return false;
        const dernier = suivis.get(uid)?.notifie_le;
        return !dernier || maintenant - new Date(dernier).getTime() >= RAFALE;
      });
      for (const uid of courants)
        envois.set(uid, {
          motif: "match-message",
          ref,
          notif: { titre: couper(`${auteur} · ${nomDuMatch}`, 60), texte: phrase, url, tag: `${tag}-discussion` },
        });
    }
  }

  if (envois.size === 0) return NextResponse.json({ envoyes: 0 });

  // Le nombre de non lus de chacun, pour la pastille de l'icône : le
  // Vestiaire et les discussions de ses matchs (lib/sfl/non-lus.server.ts).
  const comptes = await nonLus(sb, [...envois.keys()], maintenant);
  for (const [uid, e] of envois) {
    const n = comptes.get(uid) ?? 0;
    if (n > 0) envois.set(uid, { ...e, notif: { ...e.notif, pastille: n } });
  }

  const { recus, morts } = await prevenir(sb, cle, envois);

  // L'heure du dernier message notifié, pour ceux qui l'ont vraiment reçu.
  courants = courants.filter((uid) => recus.has(uid));
  if (courants.length > 0) {
    const quand = new Date(maintenant).toISOString();
    const connus = courants.filter((uid) => suivis.has(uid));
    const neufs = courants.filter((uid) => !suivis.has(uid));
    if (connus.length > 0)
      await sb.from("match_suivi").update({ notifie_le: quand }).eq("match_id", match.id).in("user_id", connus);
    // Une ligne neuve n'a encore rien lu : tout le fil reste à lire. Si
    // l'app l'a créée entre-temps (il vient d'ouvrir la discussion), on n'y
    // touche pas.
    if (neufs.length > 0)
      await sb.from("match_suivi").upsert(
        neufs.map((uid) => ({ user_id: uid, match_id: match.id, notifie_le: quand, lu_jusqua: new Date(0).toISOString() })),
        { onConflict: "user_id,match_id", ignoreDuplicates: true }
      );
  }

  return NextResponse.json({ envoyes: recus.size, morts });
}
