// Prévenir des joueurs sur leur téléphone, et garder la trace de chaque
// notification (push_envois) : toutes les routes qui préviennent passent par
// ici (le Vestiaire, les matchs, les équipes, le rappel de la veille, les
// missions du dimanche, les félicitations, les abonnés, les annonces de
// l'admin). La page Activité & rétention en tire, motif par motif, ce que
// les joueurs en font (Sabri, 23/10).
//
// Pour chaque joueur qui a au moins un téléphone abonné :
//   1. sa trace est posée AVANT l'envoi, avec un identifiant tiré au hasard
//      que la notification emporte (Notif.id) : le téléphone peut dire
//      « reçue » dans la seconde (public/sw.js → /api/push/suivi) ;
//   2. la notification part sur tous ses téléphones ;
//   3. la trace garde combien l'ont prise ; les abonnements que le service
//      de push dit morts sont effacés, comme avant.
// Rien de son texte n'est gardé : son motif (lib/sfl/motifs-notif.ts) et ce
// à quoi elle se rattache suffisent à l'analyse. Le geste qu'elle attendait,
// la base le reconnaît seule (triggers push_effet_*, supabase/schema.sql).
//
// Une trace impossible à poser (base pas encore migrée, aperçus) n'empêche
// jamais l'envoi : la notification part simplement sans identifiant.
//
// SERVEUR UNIQUEMENT.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { envoyer, type Abonnement, type CleVapid } from "@/lib/server/web-push";
import type { MotifNotif } from "@/lib/sfl/motifs-notif";
import type { Notif } from "@/lib/sfl/push";

export interface Envoi {
  notif: Notif;
  motif: MotifNotif;
  /** Ce à quoi elle se rattache (« match:12 », « equipe:3 ») : le geste attendu doit avoir lieu là. */
  ref?: string | null;
}

export interface Bilan {
  /** Les joueurs dont au moins un téléphone a pris la notification. */
  recus: Set<string>;
  /** Les téléphones qui l'ont prise, et ceux dont le service n'a pas répondu. */
  telephones: number;
  echecs: number;
  /** Les abonnements morts, effacés au passage. */
  morts: number;
}

/**
 * Une notification par joueur, sur tous ses téléphones, avec sa trace.
 * `sb` lit les abonnements et efface les morts ; `traces` écrit les traces
 * (par défaut `sb` ; null : aucune, quand seule la clé secrète le peut et
 * qu'elle manque).
 */
export async function prevenir(
  sb: SupabaseClient,
  cle: CleVapid,
  envois: Map<string, Envoi>,
  traces: SupabaseClient | null = sb
): Promise<Bilan> {
  const recus = new Set<string>();
  const rien: Bilan = { recus, telephones: 0, echecs: 0, morts: 0 };
  if (envois.size === 0) return rien;

  const { data } = await sb
    .from("push_abonnements")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", [...envois.keys()]);
  const parJoueur = new Map<string, Abonnement[]>();
  for (const ab of (data ?? []) as (Abonnement & { user_id: string })[]) {
    const liste = parJoueur.get(ab.user_id);
    if (liste) liste.push(ab);
    else parJoueur.set(ab.user_id, [ab]);
  }
  if (parJoueur.size === 0) return rien;

  // 1 · Les traces, avant l'envoi.
  const ids = new Map([...parJoueur.keys()].map((uid) => [uid, randomUUID()]));
  let suivi = false;
  if (traces) {
    const { error } = await traces.from("push_envois").insert(
      [...parJoueur].map(([uid, abonnements]) => ({
        id: ids.get(uid),
        user_id: uid,
        motif: envois.get(uid)!.motif,
        ref: envois.get(uid)!.ref ?? null,
        appareils: abonnements.length,
      }))
    );
    suivi = !error;
  }

  // 2 · L'envoi, téléphone par téléphone.
  const resultats = await Promise.all(
    [...parJoueur].flatMap(([uid, abonnements]) => {
      const { notif } = envois.get(uid)!;
      const message: Notif = suivi ? { ...notif, id: ids.get(uid) } : notif;
      return abonnements.map(async (ab) => ({ uid, ab, r: await envoyer(ab, message, cle) }));
    })
  );

  // 3 · Les morts effacés, et combien de téléphones ont pris chaque notification.
  const morts = resultats.filter((x) => x.r === "mort").map((x) => x.ab.endpoint);
  if (morts.length > 0) await sb.from("push_abonnements").delete().in("endpoint", morts);
  const acceptes = new Map<string, number>([...parJoueur.keys()].map((uid) => [uid, 0]));
  for (const x of resultats) {
    if (x.r !== "envoye") continue;
    recus.add(x.uid);
    acceptes.set(x.uid, acceptes.get(x.uid)! + 1);
  }
  if (suivi && traces) {
    // Une écriture par valeur : presque toujours une seule (un téléphone chacun).
    const parValeur = new Map<number, string[]>();
    for (const [uid, n] of acceptes) parValeur.set(n, [...(parValeur.get(n) ?? []), ids.get(uid)!]);
    await Promise.all(
      [...parValeur].map(([n, liste]) => traces.from("push_envois").update({ acceptes: n }).in("id", liste))
    );
  }

  return {
    recus,
    telephones: resultats.filter((x) => x.r === "envoye").length,
    echecs: resultats.filter((x) => x.r === "echec").length,
    morts: morts.length,
  };
}
