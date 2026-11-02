// Les annonces de la ligue par notification (lib/sfl/annonces-ligue.ts) :
//   · la convocation du dimanche, le lundi matin, à toute la ligue —
//     « J4 · Dimanche 1er novembre » · « 12h30 à l'Hippodrome de Marcq. Tu
//     viens ? » (motif « convocation ») ;
//   · les résultats d'une journée, une fois sa feuille remplie, chacun le
//     sien — « J3 · Tu es le MVP », « J3 · Victoire 4 – 2 »… (motif
//     « resultats ») ; dès la J5, à la révélation (revelation.ts), avec sa
//     division (« Tu montes en D2. »). Avant, la route répond fini: false et
//     `apres` : l'heure de la révélation, où le téléphone rappelle.
//
// Qui l'appelle : n'importe quel joueur de la ligue, sans le savoir — l'app
// la sonne à l'ouverture (lib/sfl/ligue-annonce.ts), comme les divisions et
// l'outsider : la ligue ouvre l'app bien plus souvent qu'un cron ne passe.
// Rejouer l'appel ne renvoie rien : chaque joueur est « réservé » dans
// annonces_envois avant l'envoi (insert … on conflict do nothing), si bien
// que deux appels simultanés ne préviennent personne deux fois. Un envoi qui
// échoue partout libère la réservation : le prochain appel réessaie. Elles
// partent par prevenir (lib/server/push-envoi.ts) : Admin → Activité compte
// qui les a reçues, touchées, et qui a répondu à la convocation
// (push_effet_presence, supabase/schema.sql).
//
// La route agit avec la clé secrète : elle exige une session de membre.

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { cleVapid, type CleVapid } from "@/lib/server/web-push";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { lireSaisonServeur } from "@/lib/sfl/saison-serveur.server";
import { neJouePas } from "@/lib/sfl/hidden";
import {
  convocationAAnnoncer,
  resultatsAAnnoncer,
  texteResultats,
  type ConvocationOuverte,
} from "@/lib/sfl/annonces-ligue";
import type { MotifNotif } from "@/lib/sfl/motifs-notif";
import type { Notif } from "@/lib/sfl/push";
import { suspenduPour } from "@/lib/sfl/cartons";
import { revelation, revelationAttendue } from "@/lib/sfl/revelation";
import { numeroSaison } from "@/lib/sfl/saisie/types";

export const maxDuration = 30;

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Réserve chaque joueur pour cette annonce, prévient ceux qu'on vient
 * d'inscrire, puis libère ceux qu'on n'a pas pu joindre. Renvoie combien
 * l'ont reçue, et si tout le monde est prévenu.
 */
async function annoncer(
  sb: SupabaseClient,
  cle: CleVapid,
  annonce: string,
  idDe: Map<string, string>,
  motif: MotifNotif,
  ref: string,
  notifDe: (joueur: string) => Notif
): Promise<{ envoyes: number; fini: boolean }> {
  const { data: reserves, error: refus } = await sb
    .from("annonces_envois")
    .upsert(
      [...idDe.keys()].map((joueur) => ({ annonce, joueur })),
      { onConflict: "annonce,joueur", ignoreDuplicates: true }
    )
    .select("joueur");
  // Table absente (avant la migration) : rien plutôt que deux fois.
  if (refus) return { envoyes: 0, fini: true };
  const envois = new Map<string, Envoi>();
  for (const { joueur } of (reserves ?? []) as { joueur: string }[]) {
    const uid = idDe.get(joueur);
    if (uid) envois.set(uid, { notif: notifDe(joueur), motif, ref });
  }
  const { recus } = await prevenir(sb, cle, envois);
  const rates = [...idDe].filter(([, uid]) => envois.has(uid) && !recus.has(uid)).map(([joueur]) => joueur);
  if (rates.length > 0) await sb.from("annonces_envois").delete().eq("annonce", annonce).in("joueur", rates);
  return { envoyes: recus.size, fini: rates.length === 0 };
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const { data: profil } = await sb.from("profiles").select("valide").eq("id", moi.id).maybeSingle();
  if (!profil?.valide) return NextResponse.json({ error: "Réservé aux joueurs de la ligue." }, { status: 403 });

  // La saison publiée (sans les journées en brouillon : aucun « J4 · Tu es
  // le MVP » ne part d'une feuille cachée), les arbitres et les membres qui
  // ne jouent pas masqués, comme sur les téléphones.
  let lue: Awaited<ReturnType<typeof lireSaisonServeur>>;
  try {
    lue = await lireSaisonServeur(sb);
  } catch {
    return NextResponse.json({ envoyes: 0, fini: false });
  }
  const saison = lue?.brute;
  if (!saison) return NextResponse.json({ envoyes: 0, fini: true });
  const ligne = { updated_at: lue?.updatedAt ?? undefined };
  const { data: convocations } = await sb
    .from("convocations")
    .select("id, date_label, created_at")
    .eq("statut", "ouverte")
    .order("id", { ascending: false })
    .limit(1);
  const maintenant = new Date();
  const convocation = convocationAAnnoncer(saison, (convocations?.[0] as ConvocationOuverte | undefined) ?? null, maintenant);
  const publieLe = ligne?.updated_at ? new Date(ligne.updated_at).getTime() : maintenant.getTime();
  const resultats = resultatsAAnnoncer(saison, publieLe, maintenant);
  // Une révélation attendue aujourd'hui (revelation.ts) : rien n'est fini, rappeler à l'heure dite.
  const attendue = lue ? revelationAttendue(lue.direct, maintenant) : null;
  const metaAttendue = attendue != null ? lue!.direct.journees.find((m) => m.j === attendue) : undefined;
  const rev = metaAttendue ? revelation(metaAttendue, numeroSaison(lue!.direct), maintenant) : null;
  const enAttente = rev && rev.getTime() > maintenant.getTime() ? { fini: false, apres: rev.toISOString() } : attendue != null ? { fini: false } : null;
  if (!convocation && !resultats) return NextResponse.json({ envoyes: 0, ...(enAttente ?? { fini: true }) });

  const cle = cleVapid();
  if (!cle) return NextResponse.json({ envoyes: 0, fini: true });

  // Les joueurs de la ligue qui ont un téléphone abonné : ceux de la saison
  // (et les admins), pas les joueurs Bola venus par un parrain.
  const { data: profils } = await sb.from("profiles").select("id, name, is_admin").eq("valide", true);
  const roster = new Set((saison.roster ?? []).map((r) => r.name));
  // Jamais un membre qui ne joue pas (profiles.joue = false) : un admin qui
  // organise ne reçoit ni convocation ni résultats de joueur (30/10).
  const joueurs = ((profils ?? []) as { id: string; name: string; is_admin: boolean | null }[]).filter(
    (p) => (p.is_admin || roster.has(p.name)) && !neJouePas(p.name)
  );
  const { data: abonnements } = await sb
    .from("push_abonnements")
    .select("user_id")
    .in(
      "user_id",
      joueurs.map((p) => p.id)
    );
  const abonnes = new Set(((abonnements ?? []) as { user_id: string }[]).map((ab) => ab.user_id));
  const idDe = new Map(joueurs.filter((p) => abonnes.has(p.id)).map((p) => [p.name, p.id]));
  if (!idDe.size) return NextResponse.json({ envoyes: 0, fini: true });

  let envoyes = 0;
  let fini = true;
  if (convocation) {
    // Un suspendu (carton rouge, lib/sfl/cartons.ts) n'est pas convoqué : « Tu viens ? » ne lui part pas.
    const convoques = new Map([...idDe].filter(([nom]) => !suspenduPour(saison, nom, convocation.j)));
    const r = await annoncer(sb, cle, convocation.cle, convoques, "convocation", `convocation:${convocations![0].id}`, () => ({
      titre: couper(convocation.titre, 60),
      texte: couper(convocation.texte, 180),
      url: "/",
      tag: convocation.cle,
    }));
    envoyes += r.envoyes;
    fini &&= r.fini;
  }
  if (resultats) {
    const r = await annoncer(sb, cle, resultats.cle, idDe, "resultats", resultats.cle, (joueur) => {
      // Les titres votés et la division : la vue figée votes posés (lue.saison), révélée.
      const { titre, texte } = texteResultats(lue?.saison ?? saison, resultats.j, joueur, lue?.divisions);
      return { titre: couper(titre, 60), texte: couper(texte, 180), url: "/ligue", tag: resultats.cle };
    });
    envoyes += r.envoyes;
    fini &&= r.fini;
  }
  return NextResponse.json({ envoyes, ...(enAttente && fini ? enAttente : { fini }) });
}
