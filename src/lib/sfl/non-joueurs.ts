"use client";

// Les membres qui ne jouent pas (profiles.joue = false), lus dans la base et
// posés dans hidden.ts. Un cache local évite qu'un téléphone hors ligne
// retombe sur la seule liste de départ. Une base sans la colonne (avant la
// migration du 30/10) garde la liste de départ : HIDDEN_PLAYERS.

import { supabase } from "@/lib/supabase";
import { definirNonJoueurs, nonJoueursRevision } from "./hidden";

const CLE = "sfl-non-joueurs";

/** La liste gardée de la dernière lecture ; null si la base n'a jamais répondu (la liste de départ reste). */
function cache(): string[] | null {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut === null) return null;
    const v = JSON.parse(brut);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  const lu = cache();
  if (lu) definirNonJoueurs(lu);
}

let enCours: Promise<void> | null = null;

export function rafraichirNonJoueurs(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  enCours ??= (async () => {
    try {
      const { data, error } = await supabase().from("profiles").select("name").eq("joue", false);
      if (error) return;
      const noms = ((data ?? []) as { name: string | null }[]).flatMap((p) => (p.name ? [p.name] : []));
      const avant = nonJoueursRevision();
      definirNonJoueurs(noms);
      // La saison se relit (SeasonProvider) : les compositions et les listes changent.
      if (nonJoueursRevision() !== avant) window.dispatchEvent(new Event("sfl-saisie"));
      try {
        localStorage.setItem(CLE, JSON.stringify(noms));
      } catch {
        /* stockage indisponible */
      }
    } catch {
      /* hors ligne : la liste en cache reste */
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}

/** L'admin règle « Joue / Ne joue pas » d'un compte (RPC poser_joue). */
export async function poserJoue(profil: string, joue: boolean): Promise<{ ok: boolean; raison?: string }> {
  const { error } = await supabase().rpc("poser_joue", { p_profil: profil, p_joue: joue });
  if (error) return { ok: false, raison: error.message };
  await rafraichirNonJoueurs();
  return { ok: true };
}
