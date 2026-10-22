"use client";

// Le mode Team (Sabri, 22/10 ; règles officielles : BOLA docs/gameplay/04 et
// 11, le Règlement Team). Une équipe de 5 à 7 joueurs, un capitaine, un
// écusson noir et blanc à ses initiales :
//   · le capitaine (ou son vice) invite des joueurs de Bola, ou partage un
//     lien : un nouveau y crée vite son compte et arrive invité ;
//   · entrer, c'est signer le Règlement Team ; qui part ne revient jamais ;
//   · une équipe à 5 défie les autres (le call-out) ; l'équipe défiée
//     accepte ou refuse. La feuille et les points d'équipe viendront ensuite.
//
// Tout vit en base (supabase/schema.sql, « Mode Team ») ; chaque écriture
// passe par une fonction de la base qui en vérifie les règles.

import { supabase } from "@/lib/supabase";

export type Fond = "noir" | "blanc";
export type Role = "capitaine" | "vice" | "membre";

export const MIN_EQUIPE = 5;
export const MAX_EQUIPE = 7;

export interface Membre {
  id: string;
  name: string;
  statut: "invite" | "membre";
  role: Role;
}

export interface Equipe {
  id: number;
  nom: string;
  initiales: string;
  fond: Fond;
  ville: string | null;
  capitaine: string;
  membres: Membre[];
}

export interface Defi {
  id: number;
  de: number;
  a: number;
  jour: string;
  heure: string;
  lieu: string;
  statut: "propose" | "accepte" | "refuse" | "annule";
}

/** Les signataires, capitaine d'abord, puis le vice. */
export function signataires(e: Equipe): Membre[] {
  const rang = { capitaine: 0, vice: 1, membre: 2 } as const;
  return e.membres.filter((m) => m.statut === "membre").sort((a, b) => rang[a.role] - rang[b.role]);
}

export function invites(e: Equipe): Membre[] {
  return e.membres.filter((m) => m.statut === "invite");
}

/** Une équipe joue (et se défie) à 5 signataires. */
export function active(e: Equipe): boolean {
  return signataires(e).length >= MIN_EQUIPE;
}

/** « Sunday Five » → « SF » ; « Racing » → « RAC ». */
export function initialesDe(nom: string): string {
  const mots = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((m) => m && !["FC", "AS", "DE", "DU", "LA", "LE", "LES"].includes(m));
  if (mots.length === 0) return "";
  if (mots.length === 1) return mots[0].slice(0, 3);
  return mots
    .slice(0, 3)
    .map((m) => m[0])
    .join("");
}

type Un<T> = T | T[] | null;
const un = <T,>(v: Un<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

interface LigneEquipe {
  id: number;
  nom: string;
  initiales: string;
  fond: Fond;
  ville: string | null;
  capitaine: string;
  equipe_membres: { joueur: string; statut: Membre["statut"]; role: Role; p: Un<{ name: string }> }[];
}

export async function listerEquipes(): Promise<Equipe[]> {
  const { data, error } = await supabase()
    .from("equipes")
    .select("id, nom, initiales, fond, ville, capitaine, equipe_membres(joueur, statut, role, p:profiles!equipe_membres_joueur_fkey(name))")
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as unknown as LigneEquipe[]).map((r) => ({
    id: r.id,
    nom: r.nom,
    initiales: r.initiales,
    fond: r.fond,
    ville: r.ville,
    capitaine: r.capitaine,
    membres: r.equipe_membres.map((m) => ({ id: m.joueur, name: un(m.p)?.name ?? "?", statut: m.statut, role: m.role })),
  }));
}

export async function listerDefis(): Promise<Defi[]> {
  const { data, error } = await supabase()
    .from("equipe_defis")
    .select("id, de, a, jour, heure, lieu, statut")
    .in("statut", ["propose", "accepte"])
    .order("jour");
  if (error) throw error;
  return (data ?? []) as Defi[];
}

async function rpc<T = void>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const creerEquipe = (nom: string, initiales: string, fond: Fond) => rpc<number>("equipe_creer", { nom: nom.trim(), initiales, fond });
export const inviterEquipe = (e: number, joueur: string) => rpc("equipe_inviter", { e, joueur });
export const retirerInvitation = (e: number, joueur: string) => rpc("equipe_retirer_invitation", { e, joueur });
export const signerReglement = (e: number) => rpc("equipe_signer", { e });
export const quitterEquipe = (e: number) => rpc("equipe_quitter", { e });
export const nommerVice = (e: number, joueur: string | null) => rpc("equipe_vice", { e, joueur });
export const lienEquipe = (e: number) => rpc<string>("equipe_lien", { e });
export const rejoindreParLien = (j: string) => rpc<number>("equipe_par_lien", { j });
export const defier = (de: number, a: number, jour: string, heure: string, lieu: string) => rpc<number>("equipe_defier", { de, a, jour, heure, lieu });
export const repondreDefi = (d: number, statut: "accepte" | "refuse" | "annule") => rpc("equipe_defi_statut", { d, statut });

export interface InfoLien {
  id: number;
  nom: string;
  initiales: string;
  fond: Fond;
  ville: string | null;
  membres: number;
  capitaine: string | null;
}

/** Ce que montre la page du lien, même sans compte. */
export async function lireLien(j: string): Promise<InfoLien | null> {
  const { data, error } = await supabase().rpc("equipe_lien_info", { j });
  if (error) throw error;
  return (data as InfoLien | null) ?? null;
}

export function urlDuLien(j: string): string {
  return `${window.location.origin}/equipe/${j}`;
}

/** Les 11 engagements du Règlement Team (docs/gameplay/11), ce qu'on signe. */
export const REGLEMENT = [
  "On ne joue qu'avec les membres de son équipe : aucun joueur extérieur, matchs amicaux compris.",
  "L'effectif compte de 5 à 7 joueurs. À 7, personne ne s'ajoute.",
  "Victoire 3 points, nul 1, défaite 0. Les points vont à l'équipe.",
  "Après chaque match, on vote le Meilleur Joueur, le Meilleur Défenseur et le MVP.",
  "Check-in obligatoire. À 4 contre 5, l'équipe incomplète perd un but ; à 4 contre 4, le match est amical.",
  "À partir de 6 signalements, le match est annulé.",
  "Annulation libre jusqu'à 48 h avant. Après, c'est un forfait : défaite 0-3.",
  "Fair-play : on respecte l'adversaire et on s'arbitre soi-même ; les capitaines tranchent.",
  "Les fautes sont sanctionnées : avertissement, suspension, exclusion du championnat.",
  "Au-delà de 2 rencontres contre la même équipe dans la saison, le match est amical.",
  "Qui quitte l'équipe n'y revient jamais.",
];

/** Un message d'erreur de la base, dit simplement. */
export function direErreurEquipe(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  if (/equipes_nom_unique|déjà pris/i.test(msg)) return "Ce nom est déjà pris.";
  if (/equipe_membres_une_equipe/i.test(msg)) return "Tu as déjà une équipe.";
  if (/duplicate|23505/i.test(msg)) return "Déjà dans l'équipe.";
  if (/does not exist|42P01|PGRST20/i.test(msg)) return "Le mode Team arrive avec la mise en ligne.";
  return msg || "Impossible pour l'instant. Réessaie dans un instant.";
}
