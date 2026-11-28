// Le rappel d'une heure avant le match, le dimanche (Bola, 28/11/2026 : « il
// faudrait que les joueurs reçoivent une notification 1 heure avant leur
// match »). Le qui et le quand sont dans lib/sfl/rappel-avant-match.ts.
//
// Qui l'appelle : la base elle-même, toutes les 5 minutes le dimanche de 7 h
// à 21 h (UTC), par pg_cron et pg_net (job « rappel-avant-match », posé dans
// supabase/schema.sql). Le cron de Vercel ne sait pas sonner toutes les
// 5 minutes sur ce compte, et l'heure d'un match change d'une journée à
// l'autre.
//
// Rejouer l'appel ne renvoie rien : chaque joueur est « réservé » dans
// journee_rappels (saison, journée, match, joueur) avant l'envoi, si bien que
// deux appels simultanés ne préviennent personne deux fois. Un envoi qui
// échoue partout libère la réservation : le passage suivant réessaie, tant
// que la fenêtre est ouverte (jusqu'au rendez-vous, 15 minutes avant le coup d'envoi).
//
// Sans secret : la base ne connaît pas CRON_SECRET (une valeur sensible de
// Vercel, illisible ensuite). Appelée par n'importe qui, la route ne fait
// rien de plus que ce que le cron ferait : elle ne prévient que dans la
// fenêtre d'avant match, une seule fois par joueur et par match.
//
// Une erreur de la base ne sort pas telle quelle (audit de sécurité du
// 03/11/2026, T13) : un message générique à l'appelant, le détail au journal.

import { NextResponse } from "next/server";
import { cleVapid } from "@/lib/server/web-push";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { serveur } from "@/lib/sfl/serveur-ligue.server";
import { lireSaisonServeur } from "@/lib/sfl/saison-serveur.server";
import { rappelsDus } from "@/lib/sfl/rappel-avant-match";
import { numeroSaison } from "@/lib/sfl/saisie/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function rappeler() {
  const sb = serveur();
  const cle = cleVapid();
  if (!sb || !cle) return NextResponse.json({ status: "pas branché" });

  const maintenant = new Date();
  let lue;
  try {
    lue = await lireSaisonServeur(sb, maintenant);
  } catch (e) {
    console.error("[rappel-match] saison :", (e as Error).message);
    return NextResponse.json({ status: "error", message: "Le rappel n'a pas pu partir." }, { status: 500 });
  }
  if (!lue) return NextResponse.json({ status: "ok", envoyes: 0 });
  const saison = lue.direct;
  const dus = rappelsDus(saison, numeroSaison(saison), maintenant);
  if (!dus.length) return NextResponse.json({ status: "ok", envoyes: 0 });

  const noms = [...new Set(dus.flatMap((d) => d.joueurs.map((x) => x.nom)))];
  const { data: profils, error } = await sb.from("profiles").select("id, name, valide").in("name", noms);
  if (error) {
    console.error("[rappel-match] profils :", error.code, error.message);
    return NextResponse.json({ status: "error", message: "Le rappel n'a pas pu partir." }, { status: 500 });
  }
  const idDe = new Map(
    ((profils ?? []) as { id: string; name: string; valide: boolean }[]).filter((p) => p.valide).map((p) => [p.name, p.id])
  );
  const { data: abonnements } = await sb.from("push_abonnements").select("user_id").in("user_id", [...idDe.values()]);
  const joignables = new Set(((abonnements ?? []) as { user_id: string }[]).map((a) => a.user_id));

  let envoyes = 0;
  const bilan: { j: number; match: number; prevenus: number }[] = [];
  for (const d of dus) {
    const texteDe = new Map(d.joueurs.map((x) => [x.nom, x.texte]));
    const abonnes = d.joueurs.map((x) => x.nom).filter((n) => joignables.has(idDe.get(n) ?? ""));
    if (!abonnes.length) continue;
    // La réservation : seuls ceux qu'on vient d'inscrire sont prévenus par cet appel.
    const { data: reserves, error: refus } = await sb
      .from("journee_rappels")
      .upsert(
        abonnes.map((joueur) => ({ saison: d.saison, j: d.j, n: d.n, joueur })),
        { onConflict: "saison,j,n,joueur", ignoreDuplicates: true }
      )
      .select("joueur");
    // Table absente (avant la migration) : on n'envoie rien plutôt que d'envoyer deux fois.
    if (refus) {
      console.error("[rappel-match] réservation :", refus.code, refus.message);
      continue;
    }
    const inscrits = ((reserves ?? []) as { joueur: string }[]).map((x) => x.joueur);
    if (!inscrits.length) continue;
    const envois = new Map<string, Envoi>();
    for (const joueur of inscrits) {
      envois.set(idDe.get(joueur)!, {
        motif: "rappel-match",
        ref: `journee:${d.saison}:${d.j}:${d.n}`,
        notif: { titre: d.titre, texte: texteDe.get(joueur)!, url: "/", tag: `rappel-s${d.saison}-j${d.j}-m${d.n}` },
      });
    }
    const { recus } = await prevenir(sb, cle, envois);
    const rates = inscrits.filter((joueur) => !recus.has(idDe.get(joueur)!));
    if (rates.length > 0)
      await sb.from("journee_rappels").delete().eq("saison", d.saison).eq("j", d.j).eq("n", d.n).in("joueur", rates);
    envoyes += recus.size;
    bilan.push({ j: d.j, match: d.n + 1, prevenus: recus.size });
  }

  return NextResponse.json({ status: "ok", envoyes, matchs: bilan });
}

export const GET = rappeler;
export const POST = rappeler;
