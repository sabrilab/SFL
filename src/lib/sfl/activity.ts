"use client";

// Journal d'activité — ce qui alimente le tableau de bord admin : qui vient,
// quand, combien de temps, et pour y faire quoi.
//
// Quatre principes :
//   · jamais bloquant — une écriture ratée n'a aucun effet sur l'app ;
//   · rien hors session serveur — sans compte Supabase, on n'écrit pas ;
//   · rien avant l'accord à la politique de confidentialité, qui le promet
//     (lib/sfl/consentement.ts) — sur un nouveau téléphone, on attend que
//     l'accord soit relu ;
//   · une session d'usage = un identifiant tiré à l'ouverture de l'onglet.
//     La durée d'une session se déduit de l'écart entre son premier et son
//     dernier événement, d'où les battements réguliers (« heartbeat »).

import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/sfl/auth/session";
import { accordConnu, accordDonne } from "@/lib/sfl/consentement";

export type ActivityKind =
  | "login"
  | "open"
  | "heartbeat"
  | "close"
  | "view"
  | "presence"
  | "vote"
  | "duel"
  | "match"
  | "pack"
  | "achat"
  | "recherche"
  | "compo"
  | "notifs"
  | "map";

const SESSION_KEY = "sfl-activity-session";

/** Identifiant de la session d'usage courante (un onglet = une session). */
export function activitySessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `s${Math.random().toString(36).slice(2)}${Date.now()}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

interface LogOptions {
  /** Page concernée (par défaut : celle affichée). */
  path?: string;
  /** Détail libre — reste court, c'est du jsonb. */
  meta?: Record<string, string | number | boolean>;
}

/** Trace un événement, sans jamais bloquer ni faire échouer l'appelant. */
export function logActivity(kind: ActivityKind, options: LogOptions = {}) {
  try {
    const session = getSession();
    if (!session?.server) return;
    const nom = session.name;
    if (accordDonne(nom) === false) return;

    const row = {
      kind,
      path: options.path ?? window.location.pathname,
      session_id: activitySessionId(),
      meta: options.meta ?? null,
    };

    const sb = supabase();
    accordConnu(nom)
      .then((ok) => {
        if (!ok) return;
        // « open » : une seule fois par jour et par appareil.
        if (kind === "open") {
          const key = `sfl-activity-open-${new Date().toISOString().slice(0, 10)}`;
          if (localStorage.getItem(key)) return;
          localStorage.setItem(key, "1");
        }
        return sb.auth.getUser().then(({ data }) => {
          const uid = data.user?.id;
          if (!uid) return;
          return sb.from("activity").insert({ player_id: uid, ...row });
        });
      })
      .catch(() => {});
  } catch {
    // jamais bloquant
  }
}
