"use client";

// La fiche du joueur connecté, côté téléphone : ce que l'accueil lui demande
// (components/sfl/accueil) en plus de son identité, homme ou femme, sa date
// de naissance, son gabarit, son pied fort et son poste.
//
// La table fiches (supabase/schema.sql) est privée : le joueur et l'admin
// seuls la lisent, et le joueur pose et corrige la sienne lui-même (RLS),
// sans passer par le serveur. L'inscription la remplit d'un coup ; un joueur
// créé par l'admin n'y a, au mieux, que son prénom et son nom, posés par
// « C'est bien toi ? ».

import { supabase } from "@/lib/supabase";
import type { Maillot, Pied, Poste, Sexe } from "./inscription";

export interface FicheJoueur {
  /** AAAA-MM-JJ. */
  naissance: string | null;
  /** undefined : la base ne le garde pas encore (aperçus Vercel, avant la migration). */
  sexe?: Sexe | null;
  taille_cm: number | null;
  poids_kg: number | null;
  pointure: number | null;
  maillot: Maillot | null;
  pied: Pied | null;
  poste: Poste | null;
}

const COLONNES = "naissance, sexe, taille_cm, poids_kg, pointure, maillot, pied, poste";
const SANS_SEXE = COLONNES.replace("sexe, ", "");

const nombre = (v: unknown) => (v == null || v === "" ? null : Number(v));

/** La fiche du joueur connecté : vide s'il n'en a pas encore, null si on ne peut pas la lire. */
export async function lireMaFiche(): Promise<FicheJoueur | null> {
  try {
    const sb = supabase();
    const { data: auth } = await sb.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return null;
    let { data, error } = await sb.from("fiches").select(COLONNES).eq("player_id", uid).maybeSingle();
    // Base pas encore migrée (aperçus Vercel) : le reste de la fiche, sans le sexe.
    const sansSexe = !!error && /sexe/.test(error.message ?? "");
    if (sansSexe) ({ data, error } = await sb.from("fiches").select(SANS_SEXE).eq("player_id", uid).maybeSingle());
    if (error) return null;
    const d = (data ?? {}) as Record<string, unknown>;
    return {
      naissance: (d.naissance as string | null | undefined) ?? null,
      sexe: sansSexe ? undefined : ((d.sexe as Sexe | null | undefined) ?? null),
      taille_cm: nombre(d.taille_cm),
      poids_kg: nombre(d.poids_kg),
      pointure: nombre(d.pointure),
      maillot: (d.maillot as Maillot | null | undefined) ?? null,
      pied: (d.pied as Pied | null | undefined) ?? null,
      poste: (d.poste as Poste | null | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Pose des champs de la fiche du joueur connecté. S'il n'en a pas encore,
 * elle naît avec le prénom et le nom qu'on lui connaît (`identite`), que la
 * table exige. Renvoie un message d'erreur, ou null.
 */
export async function poserMaFiche(
  champs: Partial<FicheJoueur>,
  identite: { prenom: string; nom: string }
): Promise<string | null> {
  try {
    const sb = supabase();
    const { data: auth } = await sb.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return "Reconnecte-toi d'abord.";
    const { data, error } = await sb.from("fiches").update(champs).eq("player_id", uid).select("player_id");
    if (error) return "Pas enregistré. Réessaie.";
    if (data && data.length > 0) return null;
    const { error: e2 } = await sb.from("fiches").insert({
      player_id: uid,
      prenom: identite.prenom.slice(0, 40) || "—",
      nom: identite.nom.slice(0, 60) || "—",
      ...champs,
    });
    return e2 ? "Pas enregistré. Réessaie." : null;
  } catch {
    return "Pas de réseau. Réessaie.";
  }
}
