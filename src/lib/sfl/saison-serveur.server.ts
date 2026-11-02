// La saison telle que les téléphones la lisent, côté SERVEUR — pour les routes
// qui rangent des joueurs (divisions, équipes du vendredi, outsider, missions,
// annonces de la ligue, félicitations).
//
// Pourquoi (27/10) : le document de saison en base n'a jamais les élus des
// votes (Impact, Défensive : votes.ts les pose à la lecture), et le serveur ne
// connaissait pas les arbitres (hidden.ts ne les apprenait que sur un
// téléphone). Les routes coupaient donc les divisions, composaient les
// équipes et choisissaient l'outsider sur d'autres points et une autre
// population que l'app : un 30e à l'écran pouvait jouer en D2.
//
// Ici, une seule lecture :
//   · les arbitres de profiles (arbitre = true) posés dans hidden.ts ;
//   · les votes de la saison, page par page (la base en rend 1 000 au plus) ;
//   · appliquerVotes et titresFaibles, comme le SeasonProvider.
// `saison` est la saison à lire (votes appliqués, titres faibles portés) ;
// `brute` la même sans les votes ; `document` le document tel qu'il est
// stocké — le serveur ne l'écrit jamais.
//
// Depuis le 02/11/2026, `saison` et `brute` sont FIGÉES jusqu'à la
// révélation (revelation.ts, figer), comme la vue du SeasonProvider, pour
// le même instant : une journée jouée en direct n'y compte qu'à 19 h.
// `direct` est la saison publiée sans figer (la feuille, les retards, les
// cartons), `divisions` le découpage de `saison`, `comptees` les journées
// qui comptent.
//
// Les journées en brouillon (30/10/2026, saisie/brouillon.ts) : `saison` et
// `brute` ne les ont pas. Aucune annonce, aucune mission, aucun calcul ne
// part d'une feuille que la ligue ne voit pas. C'est la SEULE lecture de la
// saison côté serveur (tools/lecteurs-check.ts le vérifie) ; ce qui n'a
// besoin que de l'effectif passe par lireEffectifServeur.

import type { SupabaseClient } from "@supabase/supabase-js";
import { definirArbitres, definirNonJoueurs } from "./hidden";
import { deriveSeason } from "./saisie/engine";
import { numeroSaison, type RosterEntry, type Saison } from "./saisie/types";
import { sansBrouillons } from "./saisie/brouillon";
import { appliquerVotes, titresFaibles, type VoteFigure } from "./votes";
import { figer, journeesComptees, prochaineTransition } from "./revelation";
import { etatDivisions, type EtatDivisions } from "./divisions";

/** Toutes les lignes d'une requête, page par page (la base en rend 1 000 au plus d'un coup). */
export async function toutesLesLignes<T>(
  sb: SupabaseClient,
  table: string,
  colonnes: string,
  ordre: string[],
  filtre?: { colonne: string; valeur: string | number | boolean }
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    let q = sb.from(table).select(colonnes);
    if (filtre) q = q.eq(filtre.colonne, filtre.valeur);
    for (const o of ordre) q = q.order(o);
    const { data, error } = await q.range(de, de + 999);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

/** Les votes d'une saison, tous. */
export function votesDeLaSaison(sb: SupabaseClient, numero: number): Promise<VoteFigure[]> {
  return toutesLesLignes<VoteFigure>(sb, "votes_figures", "saison, j, categorie, votant, candidat, match_id, jour", ["j", "categorie", "votant"], {
    colonne: "saison",
    valeur: numero,
  });
}

/** Pose dans hidden.ts les arbitres de la base. Une base sans la colonne (aperçus) n'en a aucun. */
export async function chargerArbitresServeur(sb: SupabaseClient): Promise<string[]> {
  const { data, error } = await sb.from("profiles").select("name").eq("arbitre", true);
  const noms = error ? [] : ((data ?? []) as { name: string | null }[]).flatMap((p) => (p.name ? [p.name] : []));
  definirArbitres(noms);
  await chargerNonJoueursServeur(sb);
  return noms;
}

/** Pose dans hidden.ts les membres qui ne jouent pas (profiles.joue = false). Sans la colonne : la liste de départ. */
export async function chargerNonJoueursServeur(sb: SupabaseClient): Promise<string[] | null> {
  const { data, error } = await sb.from("profiles").select("name").eq("joue", false);
  if (error) return null;
  const noms = ((data ?? []) as { name: string | null }[]).flatMap((p) => (p.name ? [p.name] : []));
  definirNonJoueurs(noms);
  return noms;
}

/** La saison à lire : votes de la base appliqués, titres faibles portés. */
export function saisonAvecVotes(brute: Saison, votes: VoteFigure[], maintenant: Date): Saison {
  const journees = deriveSeason(brute).journees;
  const vote = appliquerVotes(brute, journees, votes, maintenant);
  const faibles = [...titresFaibles(brute, journees, votes, maintenant)].sort();
  return faibles.length ? { ...vote, titresFaibles: faibles } : vote;
}

export interface SaisonServeur {
  /** La saison à lire : publiée (sans brouillons), votes appliqués, figée jusqu'à la révélation. */
  saison: Saison;
  /** La saison publiée, sans les votes, figée de même. */
  brute: Saison;
  /** La saison publiée telle qu'elle se joue (sans brouillons, sans figer) : le direct. */
  direct: Saison;
  /** Les divisions de `saison` : le même découpage que les téléphones. */
  divisions: EtatDivisions | null;
  /** Les journées qui comptent à cet instant, et la prochaine heure où la vue peut changer. */
  comptees: Set<number>;
  prochaine: Date | null;
  /** Le document stocké, brouillons compris : à ne lire qu'en connaissance de cause. */
  document: Saison;
  votes: VoteFigure[];
  updatedAt: string | null;
}

/**
 * Lit le document, les arbitres et les votes. null sans document ; lève une
 * erreur si les votes sont illisibles (les points seraient faux : l'appelant
 * répond « pas fini », le prochain appel réessaie).
 */
export async function lireSaisonServeur(sb: SupabaseClient, maintenant = new Date()): Promise<SaisonServeur | null> {
  const { data: doc, error } = await sb.from("saison").select("data, updated_at").eq("id", 1).maybeSingle();
  if (error) throw error;
  const ligne = doc as { data?: Saison; updated_at?: string | null } | null;
  const document = ligne?.data;
  if (!document) return null;
  const direct = sansBrouillons(document);
  const [votes] = await Promise.all([votesDeLaSaison(sb, numeroSaison(direct)), chargerArbitresServeur(sb)]);
  const saison = figer(saisonAvecVotes(direct, votes, maintenant), maintenant);
  return {
    saison,
    brute: figer(direct, maintenant),
    direct,
    divisions: etatDivisions(saison),
    comptees: journeesComptees(direct, maintenant),
    prochaine: prochaineTransition(direct, maintenant),
    document,
    votes,
    updatedAt: ligne?.updated_at ?? null,
  };
}

/**
 * L'effectif seul (comptes, identité, parrainage) : un brouillon n'y change
 * rien. null si la saison n'a pas pu être lue.
 */
export async function lireEffectifServeur(sb: SupabaseClient): Promise<RosterEntry[] | null> {
  const { data, error } = await sb.from("saison").select("data").eq("id", 1).maybeSingle();
  if (error) return null;
  const roster = (data as { data?: { roster?: RosterEntry[] } } | null)?.data?.roster;
  return Array.isArray(roster) ? roster : null;
}
