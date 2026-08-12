"use client";

// L'ouverture automatique de la semaine, côté client.
//
// Le cron Vercel (api/convocation/cron) ouvre la convocation chaque lundi
// matin. Mais un cron peut rater — projet en pause, plan qui ne l'exécute
// pas — et personne ne s'en aperçoit avant le dimanche. Ce module est la
// ceinture de sécurité : quand un ADMIN ouvre l'app, elle vérifie que la
// convocation du prochain dimanche existe et l'ouvre sinon. Miroir exact de
// la logique du cron (mêmes fonctions de calendrier, même reprise de
// l'heure, du lieu et de l'effectif précédents), donc les deux chemins ne
// peuvent pas se contredire — et tous deux sont idempotents.
//
// Les joueurs, eux, ne déclenchent rien : seul un admin écrit (c'est aussi
// ce que les règles RLS exigent).

import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/sfl/auth/session";
import { labelDateFr, prochainDimanche } from "@/lib/sfl/convocation-temps";

// Une vérification par chargement de page suffit — le hook de présence est
// monté à plusieurs endroits, tous appellent, un seul travaille.
let dejaVerifie = false;

/** Renvoie true si une convocation vient d'être ouverte. */
export async function assurerConvocationOuverte(): Promise<boolean> {
  if (dejaVerifie) return false;
  dejaVerifie = true;

  const session = getSession();
  if (!session?.server || !session.admin) return false;

  try {
    const sb = supabase();
    const label = labelDateFr(prochainDimanche(new Date()));

    const { data, error } = await sb
      .from("convocations")
      .select("id, journee, heure, lieu, effectif, date_label, statut")
      .order("id", { ascending: false })
      .limit(1);
    if (error) return false;
    const derniere = data?.[0] as
      | {
          id: number;
          journee: number;
          heure: string;
          lieu: string;
          effectif: number;
          date_label: string;
          statut: string;
        }
      | undefined;

    // Le bon dimanche est déjà ouvert (cron passé, ou autre admin) : rien.
    if (derniere && derniere.statut === "ouverte" && derniere.date_label === label) return false;

    await sb.from("convocations").update({ statut: "cloturee" }).eq("statut", "ouverte");
    const { error: insertError } = await sb.from("convocations").insert({
      journee: (derniere?.journee ?? 8) + 1,
      jour: "Dimanche",
      date_label: label,
      heure: derniere?.heure ?? "13h00",
      lieu: derniere?.lieu ?? "Terrain extérieur — 5 vs 5",
      effectif: derniere?.effectif ?? 10,
    });
    return !insertError;
  } catch {
    return false;
  }
}
