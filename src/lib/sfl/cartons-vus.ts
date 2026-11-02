"use client";

// Les cartons déjà vus (lib/sfl/cartons.ts, 01/11/2026) : l'animation du
// carton ne se joue qu'une fois par carton et par joueur, sur n'importe quel
// téléphone. « Vu » se note dans la base (profiles.cartons_vus, la liste des
// ids, posée par le joueur seul) et sur cet appareil : sans la base (hors
// ligne, base pas encore migrée), l'appareil s'en souvient.

import { supabase } from "@/lib/supabase";
import type { Carton } from "./cartons";

const cleIci = (id: string, nom: string) => `bola-carton-${id}-${nom}`;

function vuIci(id: string, nom: string): boolean {
  try {
    return window.localStorage.getItem(cleIci(id, nom)) !== null;
  } catch {
    return false;
  }
}

function noterIci(id: string, nom: string, quand: string) {
  try {
    window.localStorage.setItem(cleIci(id, nom), quand);
  } catch {
    /* stockage indisponible */
  }
}

/** Ce que la base sait du joueur connecté : ses cartons vus. null : rien de lisible. */
async function lireBase(): Promise<{ uid: string; vus: string[] } | null> {
  try {
    const { data: auth } = await supabase().auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return null;
    const { data, error } = await supabase().from("profiles").select("cartons_vus").eq("id", uid).maybeSingle();
    if (error || !data) return null;
    return { uid, vus: (data as { cartons_vus?: string[] | null }).cartons_vus ?? [] };
  } catch {
    return null;
  }
}

/** Les cartons de ce joueur qu'il n'a encore vus nulle part, dans l'ordre. */
export async function cartonsAMontrerA(nom: string, cartons: readonly Carton[]): Promise<Carton[]> {
  const ici = cartons.filter((c) => !vuIci(c.id, nom));
  if (!ici.length) return [];
  const base = await lireBase();
  if (!base) return ici;
  const vus = new Set(base.vus);
  // Vu sur un autre téléphone : celui-ci s'en souvient aussi.
  for (const c of ici) if (vus.has(c.id)) noterIci(c.id, nom, "base");
  return ici.filter((c) => !vus.has(c.id));
}

/** Le carton est vu : sur cet appareil, et dans la base. */
export async function noterCartonVu(id: string, nom: string): Promise<void> {
  noterIci(id, nom, new Date().toISOString());
  const base = await lireBase();
  if (!base || base.vus.includes(id)) return;
  try {
    await supabase()
      .from("profiles")
      .update({ cartons_vus: [...base.vus, id] })
      .eq("id", base.uid);
  } catch {
    // Hors ligne : l'appareil s'en souvient.
  }
}
