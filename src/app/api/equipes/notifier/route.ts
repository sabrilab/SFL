// Les notifications du mode Team sur le téléphone — appelée par l'app juste
// après le geste (lib/sfl/equipes.ts, notifierEquipe) :
//   · invitation : chaque invité pas encore prévenu reçoit « Ilyes t'invite
//     · Sunday Five », une seule fois (equipe_membres.notifie_le). Le doc 13
//     §1.4 (I1) le veut : une invitation, c'est une notification. Jusqu'au
//     23/10, l'invité n'apprenait rien et l'équipe restait bloquée ;
//   · relance : le capitaine (ou le vice) relance un invité, une fois par
//     tranche de 12 h ;
//   · signature : je viens de signer le Règlement ; le capitaine et le vice
//     l'apprennent (« Adil a signé · 3 / 5 »), et toute l'équipe quand la
//     cinquième signature la rend active. Une seule fois par signature.
// Toucher une invitation ouvre la signature (/bola-team?invitation=id),
// le reste la page Team. Chaque notification part avec son motif
// (equipe-invitation, equipe-relance, equipe-signature, equipe-active ;
// lib/sfl/motifs-notif.ts), rattachée à l'équipe : la base reconnaît seule
// la réponse à une invitation (push_effet_equipe, supabase/schema.sql).
//
// La route agit avec la clé secrète, donc elle ne croit pas l'appelant sur
// parole : son rôle dans l'équipe et l'état de chaque ligne sont relus ici.

import { NextRequest, NextResponse } from "next/server";
import { cleVapid } from "@/lib/server/web-push";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { finInvitation, quandTombe } from "@/lib/sfl/equipes-temps";

export const maxDuration = 30;

type Type = "invitation" | "relance" | "signature";

/** Une relance au plus par tranche de 12 h, pour un même invité. */
const RELANCE = 12 * 3600_000;
/** Une signature ne s'annonce que dans les dix minutes. */
const FRAIS = 10 * 60_000;
/** L'équipe joue à partir de 5 signataires (doc 04 §3). */
const ACTIVE = 5;

interface Ligne {
  joueur: string;
  statut: "invite" | "membre";
  role: "capitaine" | "vice" | "membre";
  invite_par: string | null;
  created_at: string;
  signe_le: string | null;
  notifie_le?: string | null;
}

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ envoyes: 0, raison: "pas branché" });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const corps = (await req.json().catch(() => ({}))) as { equipe?: unknown; type?: unknown; joueur?: unknown };
  const id = Number(corps.equipe);
  const type = corps.type as Type;
  if (!Number.isInteger(id) || !["invitation", "relance", "signature"].includes(type))
    return NextResponse.json({ error: "Demande inconnue." }, { status: 400 });

  const { data: equipe } = await sb.from("equipes").select("id, nom").eq("id", id).is("dissoute_le", null).maybeSingle();
  if (!equipe) return NextResponse.json({ error: "Équipe inconnue." }, { status: 404 });
  const { data: brutes } = await sb.from("equipe_membres").select("*").eq("equipe_id", id);
  const lignes = (brutes ?? []) as Ligne[];
  // Avant la migration, notifie_le n'existe pas : rien ne se marque.
  const avecColonne = lignes.length === 0 || "notifie_le" in lignes[0];
  const maintenant = Date.now();
  const ici = lignes.find((l) => l.joueur === moi.id);
  const membres = lignes.filter((l) => l.statut === "membre");

  const { data: profils } = await sb
    .from("profiles")
    .select("id, name, nom_affiche")
    .in("id", [...new Set([moi.id, ...lignes.map((l) => l.joueur), ...lignes.map((l) => l.invite_par).filter((x): x is string => !!x)])]);
  const prenom = (uid: string | null) => {
    const p = ((profils ?? []) as { id: string; name: string; nom_affiche: string | null }[]).find((x) => x.id === uid);
    return (p?.nom_affiche ?? p?.name ?? "Ton capitaine").split(" ")[0];
  };

  const ref = `equipe:${id}`;
  const envois = new Map<string, Envoi>();
  /** Les lignes dont l'avertissement part : notifie_le, pour ne pas le redire. */
  let marquer: string[] = [];

  if (type === "invitation" || type === "relance") {
    if (!ici || ici.statut !== "membre" || ici.role === "membre")
      return NextResponse.json({ error: "Réservé au capitaine." }, { status: 403 });
    const vivantes = lignes.filter((l) => l.statut === "invite" && finInvitation(l.created_at).getTime() > maintenant);
    let cibles: Ligne[];
    if (type === "invitation") {
      cibles = vivantes.filter((l) =>
        avecColonne ? !l.notifie_le : maintenant - new Date(l.created_at).getTime() < 5 * 60_000
      );
    } else {
      const l = vivantes.find((x) => x.joueur === corps.joueur);
      if (!l) return NextResponse.json({ error: "Invitation introuvable ou expirée." }, { status: 404 });
      if (l.notifie_le && maintenant - new Date(l.notifie_le).getTime() < RELANCE)
        return NextResponse.json({ envoyes: 0, tropTot: true });
      cibles = [l];
    }
    const effectif = `${membres.length} joueur${membres.length > 1 ? "s" : ""}`;
    for (const l of cibles) {
      const qui = prenom(l.invite_par ?? moi.id);
      envois.set(l.joueur, {
        notif: {
          titre: couper(`${qui} ${type === "relance" ? "t'attend" : "t'invite"} · ${equipe.nom}`, 60),
          texte: couper(`Bola Team · ${effectif} · jusqu'à ${quandTombe(finInvitation(l.created_at), new Date(maintenant))}`, 180),
          url: `/bola-team?invitation=${id}`,
          tag: `equipe-invitation-${id}`,
        },
        motif: type === "relance" ? "equipe-relance" : "equipe-invitation",
        ref,
        // Celui que la notification nomme, qui n'est pas toujours le capitaine qui l'envoie.
        de: l.invite_par ?? moi.id,
      });
    }
    marquer = cibles.map((l) => l.joueur);
  } else {
    if (!ici || ici.statut !== "membre" || !ici.signe_le || maintenant - new Date(ici.signe_le).getTime() > FRAIS)
      return NextResponse.json({ error: "Aucune signature récente." }, { status: 403 });
    if (ici.notifie_le && new Date(ici.notifie_le).getTime() >= new Date(ici.signe_le).getTime())
      return NextResponse.json({ envoyes: 0 });
    const qui = prenom(moi.id);
    // Mon rang parmi les signataires : le cinquième rend l'équipe active.
    const rang = membres.filter((l) => l.signe_le && l.signe_le <= ici.signe_le!).length;
    const tag = `equipe-${id}-effectif`;
    if (rang === ACTIVE) {
      for (const l of membres)
        if (l.joueur !== moi.id)
          envois.set(l.joueur, {
            notif: {
              titre: couper(`${equipe.nom} est active`, 60),
              texte: `${qui} a signé le Règlement Team. ${ACTIVE} joueurs.`,
              url: "/bola-team",
              tag,
            },
            motif: "equipe-active",
            ref,
          });
    } else {
      const n = membres.length;
      for (const l of membres)
        if (l.joueur !== moi.id && l.role !== "membre")
          envois.set(l.joueur, {
            notif: {
              titre: couper(`${qui} a signé · ${equipe.nom}`, 60),
              texte: n < ACTIVE ? `${n} / ${ACTIVE} · Il manque ${ACTIVE - n}` : `${n} / 7`,
              url: "/bola-team",
              tag,
            },
            motif: "equipe-signature",
            ref,
          });
    }
    marquer = [moi.id];
  }

  // Marqué avant l'envoi : un deuxième appel ne prévient personne deux fois.
  if (marquer.length > 0 && avecColonne)
    await sb
      .from("equipe_membres")
      .update({ notifie_le: new Date(maintenant).toISOString() })
      .eq("equipe_id", id)
      .in("joueur", marquer);

  const cle = cleVapid();
  if (!cle || envois.size === 0) return NextResponse.json({ envoyes: 0, prevenus: envois.size });

  const { recus } = await prevenir(sb, cle, envois, { de: moi.id });
  return NextResponse.json({ envoyes: recus.size, prevenus: envois.size });
}
