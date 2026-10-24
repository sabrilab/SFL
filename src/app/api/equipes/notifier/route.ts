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
//   · resultat (24/10) : mon équipe vient de remplir la feuille d'un match ;
//     le capitaine et le vice de l'autre équipe l'apprennent, avec le score,
//     pour confirmer (sans réponse, il vaut 24 h plus tard). Une fois par
//     saisie (equipe_resultats.notifie_le).
// Toucher une invitation ouvre la signature (/bola-team?invitation=id) ;
// sur Android, elle porte aussi ses deux réponses, Oui et Non (Sabri,
// 24/10 : « qu'ils soient quand même contraints de répondre à cette notif :
// oui ou non »). Une feuille ouvre la feuille (/bola-team?feuille=id), le
// reste la page Team. Chaque notification part avec son motif
// (equipe-invitation, equipe-relance, equipe-signature, equipe-active,
// equipe-resultat ; lib/sfl/motifs-notif.ts), rattachée à l'équipe ou au
// match : la base reconnaît seule la réponse attendue (push_effet_equipe,
// push_effet_resultat, supabase/schema.sql).
//
// La route agit avec la clé secrète, donc elle ne croit pas l'appelant sur
// parole : son rôle dans l'équipe et l'état de chaque ligne sont relus ici.

import { NextRequest, NextResponse } from "next/server";
import { cleVapid } from "@/lib/server/web-push";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { finInvitation, quandTombe } from "@/lib/sfl/equipes-temps";

export const maxDuration = 30;

type Type = "invitation" | "relance" | "signature" | "resultat";

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

  const corps = (await req.json().catch(() => ({}))) as { equipe?: unknown; type?: unknown; joueur?: unknown; defi?: unknown };
  const type = corps.type as Type;
  if (type === "resultat") return resultat(sb, moi.id, Number(corps.defi));
  const id = Number(corps.equipe);
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
          actions: [
            { action: "oui", titre: "Oui", url: `/bola-team?invitation=${id}&reponse=oui` },
            { action: "non", titre: "Non", url: `/bola-team?invitation=${id}&reponse=non` },
          ],
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

/**
 * La feuille d'un match vient d'être remplie par mon équipe : le capitaine
 * et le vice de l'autre équipe confirment (ou corrigent). Relu ici : mon
 * rôle, ma saisie (fraîche, pas encore annoncée), l'autre équipe.
 */
async function resultat(sb: NonNullable<ReturnType<typeof serveur>>, moi: string, d: number) {
  if (!Number.isInteger(d)) return NextResponse.json({ error: "Demande inconnue." }, { status: 400 });
  const { data: defi } = await sb.from("equipe_defis").select("id, de, a, statut").eq("id", d).maybeSingle();
  if (!defi || defi.statut !== "accepte") return NextResponse.json({ error: "Match inconnu." }, { status: 404 });
  const { data: roles } = await sb
    .from("equipe_membres")
    .select("equipe_id, joueur, role")
    .in("equipe_id", [defi.de, defi.a])
    .eq("statut", "membre");
  const lignes = (roles ?? []) as { equipe_id: number; joueur: string; role: Ligne["role"] }[];
  const ici = lignes.find((l) => l.joueur === moi && l.role !== "membre");
  if (!ici) return NextResponse.json({ error: "Réservé aux capitaines." }, { status: 403 });
  const mienne = ici.equipe_id;
  const autre = mienne === defi.de ? defi.a : defi.de;
  const { data: saisie } = await sb
    .from("equipe_resultats")
    .select("pour, contre, saisi_le, notifie_le")
    .eq("defi_id", d)
    .eq("equipe_id", mienne)
    .maybeSingle();
  if (!saisie || Date.now() - new Date(saisie.saisi_le).getTime() > FRAIS)
    return NextResponse.json({ error: "Aucune saisie récente." }, { status: 403 });
  if (saisie.notifie_le) return NextResponse.json({ envoyes: 0 });
  // L'autre a déjà saisi le même score : le match est validé, rien à confirmer.
  const { data: leur } = await sb.from("equipe_resultats").select("pour, contre").eq("defi_id", d).eq("equipe_id", autre).maybeSingle();
  await sb.from("equipe_resultats").update({ notifie_le: new Date().toISOString() }).eq("defi_id", d).eq("equipe_id", mienne);
  if (leur && leur.pour === saisie.contre && leur.contre === saisie.pour) return NextResponse.json({ envoyes: 0 });

  const { data: noms } = await sb.from("equipes").select("id, nom").in("id", [mienne, autre]);
  const nom = (id: number) => ((noms ?? []) as { id: number; nom: string }[]).find((x) => x.id === id)?.nom ?? "";
  const envois = new Map<string, Envoi>();
  for (const l of lignes)
    if (l.equipe_id === autre && l.role !== "membre")
      envois.set(l.joueur, {
        notif: {
          titre: couper(`${nom(mienne)} ${saisie.pour} – ${saisie.contre} ${nom(autre)}`, 60),
          texte: leur ? "Ta feuille dit un autre score : corrige-la ou garde-la." : "Confirme le score et tes buteurs. Sans réponse, il vaut dans 24 h.",
          url: `/bola-team?feuille=${d}`,
          tag: `equipe-resultat-${d}`,
        },
        motif: "equipe-resultat",
        ref: `defi:${d}`,
      });
  const cle = cleVapid();
  if (!cle || envois.size === 0) return NextResponse.json({ envoyes: 0, prevenus: envois.size });
  const { recus } = await prevenir(sb, cle, envois);
  return NextResponse.json({ envoyes: recus.size, prevenus: envois.size });
}
