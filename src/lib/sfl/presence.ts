"use client";

// Présence à la prochaine journée — le service, isolé du reste de l'app.
//
// C'EST LE POINT DE BASCULE VERS SUPABASE. Aujourd'hui les réponses vivent dans
// la saison locale (localStorage) : chacun ne voit donc que les siennes, et
// l'admin doit encore demander autour de lui. Demain, `listPresence` et
// `setPresence` taperont dans la table `presence` (voir supabase/schema.sql) et
// tout le monde verra la même liste en direct — aucun écran ne changera.
//
// L'interface est volontairement minuscule : deux lectures, une écriture.

import { activeConvocation, respondConvocation } from "@/lib/sfl/saisie/mutations";
import { saisieStore } from "@/lib/sfl/saisie/store";
import { SAISIE_EVENT } from "@/components/sfl/season-provider";
import type { Convocation, Saison } from "@/lib/sfl/saisie/types";

export type Reponse = "present" | "absent";

export interface PresenceRow {
  name: string;
  reponse: Reponse | null;
  /** Le joueur figure-t-il encore à l'effectif actif ? */
  actif: boolean;
}

export interface PresenceState {
  convocation: Convocation | null;
  rows: PresenceRow[];
  presents: string[];
  absents: string[];
  sansReponse: string[];
}

/** Toutes les réponses de la convocation ouverte, complétées par l'effectif. */
export function listPresence(saison: Saison, roster: { name: string; profil: string }[]): PresenceState {
  const convocation = activeConvocation(saison);
  const rows: PresenceRow[] = roster
    .map((r) => ({
      name: r.name,
      reponse: (convocation?.reponses[r.name] as Reponse | undefined) ?? null,
      actif: r.profil === "Actif",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return {
    convocation,
    rows,
    presents: rows.filter((r) => r.reponse === "present").map((r) => r.name),
    absents: rows.filter((r) => r.reponse === "absent").map((r) => r.name),
    sansReponse: rows.filter((r) => r.reponse === null && r.actif).map((r) => r.name),
  };
}

/**
 * Enregistre la réponse d'un joueur. `null` retire la réponse.
 * Renvoie false si aucune convocation n'est ouverte.
 */
export function setPresence(saison: Saison, player: string, reponse: Reponse | null): boolean {
  const convocation = activeConvocation(saison);
  if (!convocation) return false;
  saisieStore.save(respondConvocation(saison, convocation.id, player, reponse));
  window.dispatchEvent(new Event(SAISIE_EVENT));
  return true;
}

/** Vrai tant que les réponses sont partagées entre joueurs (Supabase branché). */
export const PRESENCE_IS_SHARED = false;
