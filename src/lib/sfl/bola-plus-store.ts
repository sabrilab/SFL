"use client";

// Bola Plus (lib/sfl/bola-plus.ts) : lire mon intérêt, le noter (« Je suis
// intéressé »), l'annuler ; et, pour l'admin, lire tous les intéressés.
//
// En base (supabase/schema.sql, table bola_plus_interets) : on n'écrit que par
// bola_plus_interesse(), qui pose l'identité et l'heure du serveur. Chacun ne
// lit que sa ligne, l'admin les lit toutes.
//
// Dans un aperçu (NEXT_PUBLIC_BOLA_ENV ≠ production), comme pour les
// blessures et les pronos, le geste du joueur reste sur le téléphone : un
// essai ne doit jamais s'écrire dans la vraie ligue, et l'écran marche même
// si la table n'est pas encore en base. L'admin, lui, lit la base (lecture
// seule) et y ajoute l'essai de son téléphone, pour voir le compteur bouger.
//
// Aucun paiement : rien ici ne touche à de l'argent.

import { supabase } from "@/lib/supabase";
import { avecEssai, interetDe, lireEssais, type Formule, type Interet, type LigneInteret } from "./bola-plus";
import { erreurSansTable } from "./consentement";
import { toutesLesPages, PAGE } from "./pages";

export const BOLA_PLUS_EVENT = "bola-plus";
export const APERCU = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";
const CLE_APERCU = "bola-plus-apercu";
const REFUS = "Pas enregistré. Reconnecte-toi, puis réessaie.";

/** Ce que l'app sait de l'intérêt d'un joueur : pas encore lu (undefined), aucun (null), ou noté. */
const cache = new Map<string, Interet | null>();
const enCours = new Map<string, Promise<void>>();

const emit = () => window.dispatchEvent(new Event(BOLA_PLUS_EVENT));

function lireApercu(): Record<string, Interet> {
  try {
    return lireEssais(localStorage.getItem(CLE_APERCU));
  } catch {
    return {};
  }
}

function ecrireApercu(essais: Record<string, Interet>) {
  try {
    localStorage.setItem(CLE_APERCU, JSON.stringify(essais));
  } catch {
    /* stockage plein ou interdit : l'essai vit le temps de la page */
  }
}

/** Mon intérêt tel qu'il est en mémoire ; undefined tant qu'il n'est pas lu. */
export function interetEnMemoire(nom: string): Interet | null | undefined {
  return cache.get(nom);
}

/** Lit mon intérêt une fois (la base en production, le téléphone dans un aperçu). */
export function chargerInteret(nom: string): Promise<void> {
  if (cache.has(nom)) return Promise.resolve();
  const deja = enCours.get(nom);
  if (deja) return deja;
  const lecture = lire(nom)
    .then((interet) => {
      // Un toucher arrivé pendant la lecture fait foi.
      if (!cache.has(nom)) cache.set(nom, interet);
    })
    .catch(() => {
      /* base injoignable ou table absente : on relira à la prochaine ouverture */
    })
    .finally(() => {
      enCours.delete(nom);
      emit();
    });
  enCours.set(nom, lecture);
  return lecture;
}

async function lire(nom: string): Promise<Interet | null> {
  if (APERCU) return lireApercu()[nom] ?? null;
  const sb = supabase();
  const { data: auth } = await sb.auth.getSession();
  const moi = auth.session?.user.id;
  if (!moi) throw new Error("sans session");
  // L'admin lit toutes les lignes : on ne demande que la sienne.
  const { data, error } = await sb.from("bola_plus_interets").select("formule, le").eq("joueur", moi).maybeSingle();
  if (error) throw error;
  return interetDe(data);
}

/** « Je suis intéressé », ou changer de formule : la date du premier toucher reste. */
export async function noterInteret(nom: string, formule: Formule | null): Promise<void> {
  const avant = cache.get(nom) ?? null;
  if (APERCU) {
    const interet: Interet = { formule, le: avant?.le ?? new Date().toISOString() };
    ecrireApercu({ ...lireApercu(), [nom]: interet });
    cache.set(nom, interet);
    emit();
    return;
  }
  const { data, error } = await supabase().rpc("bola_plus_interesse", { p_interesse: true, p_formule: formule });
  if (error) throw new Error(REFUS);
  cache.set(nom, { formule, le: typeof data === "string" ? data : (avant?.le ?? new Date().toISOString()) });
  emit();
}

/** « Annuler » : l'intérêt s'efface. */
export async function annulerInteret(nom: string): Promise<void> {
  if (APERCU) {
    const essais = lireApercu();
    delete essais[nom];
    ecrireApercu(essais);
    cache.set(nom, null);
    emit();
    return;
  }
  const { error } = await supabase().rpc("bola_plus_interesse", { p_interesse: false, p_formule: null });
  if (error) throw new Error(REFUS);
  cache.set(nom, null);
  emit();
}

type Un<T> = T | T[] | null;

/** Pourquoi la liste n'a pas pu être lue : la table n'est pas encore en base, ou autre chose. */
export type EchecLecture = "sans-table" | "autre";

/**
 * Tous les intéressés, pour l'admin (la RLS ne rend tout qu'à lui), page par
 * page. Dans un aperçu, l'essai du téléphone (le compte ouvert, `nom`)
 * s'ajoute à ce que la base rend, même si la table n'y est pas encore.
 */
export async function lireInteresses(nom: string | null): Promise<{ lignes: LigneInteret[]; echec: EchecLecture | null }> {
  const sb = supabase();
  const { lu, error } = await toutesLesPages<{ formule: unknown; le: unknown; profiles: Un<{ name: string }> }>((debut) =>
    sb
      .from("bola_plus_interets")
      .select("joueur, formule, le, profiles(name)")
      .order("joueur")
      .range(debut, debut + PAGE - 1)
  );
  const lignes = error
    ? []
    : lu.flatMap((l): LigneInteret[] => {
        const interet = interetDe(l);
        const profil = Array.isArray(l.profiles) ? (l.profiles[0] ?? null) : l.profiles;
        return interet ? [{ ...interet, nom: profil?.name ?? "?" }] : [];
      });
  const essai = APERCU && nom ? (lireApercu()[nom] ?? null) : null;
  const echec: EchecLecture | null = !error ? null : erreurSansTable((error as { code?: string }).code) ? "sans-table" : "autre";
  // Un essai sur le téléphone se montre même sans la table : c'est lui qu'on est venu voir.
  if (echec === "autre" || (echec && !essai)) return { lignes: [], echec };
  return { lignes: avecEssai(lignes, essai && nom ? { ...essai, nom } : null), echec: null };
}
