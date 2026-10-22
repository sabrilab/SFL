"use client";

// Le mode Team (Sabri, 22/10 ; règles officielles : BOLA docs/gameplay/04 et
// 11, le Règlement Team). Une équipe de 5 à 7 joueurs, un capitaine, un
// écusson noir et blanc à ses initiales :
//   · le capitaine (ou son vice) invite des joueurs de Bola, ou partage un
//     lien : un nouveau y crée vite son compte et arrive invité ;
//   · entrer, c'est signer le Règlement Team ; qui part ne revient jamais ;
//   · une équipe à 5 défie les autres (le call-out) ; l'équipe défiée
//     accepte ou refuse. La feuille et les points d'équipe viendront ensuite.
// Les délais (invitation 72 h, carence 14 jours, préavis d'exclusion 48 h,
// créneau d'un défi entre +48 h et +21 jours, réponse sous 48 h, forfait à
// moins de 48 h) sont gardés par la base ; l'app les montre.
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
  /** Invité : quand ; son invitation tombe 72 h après. */
  depuis?: string;
  /** Exclu par le capitaine : son départ, 48 h après. */
  departLe?: string | null;
}

export interface Equipe {
  id: number;
  nom: string;
  initiales: string;
  fond: Fond;
  ville: string | null;
  capitaine: string | null;
  membres: Membre[];
}

export interface Defi {
  id: number;
  de: number;
  a: number;
  jour: string;
  heure: string;
  lieu: string;
  statut: "propose" | "accepte" | "refuse" | "annule" | "expire" | "forfait";
  forfaitDe?: number | null;
  /** Envoyé quand : sans réponse sous 48 h, il expire. */
  le?: string;
}

/** Le coup d'envoi d'un défi (heure de Paris, à la minute près l'hiver comme l'été). */
export function coupDEnvoi(d: Pick<Defi, "jour" | "heure">): Date {
  const [a, m, j] = d.jour.split("-").map(Number);
  const [h, mi] = d.heure.split(":").map(Number);
  const utc = Date.UTC(a, m - 1, j, h, mi);
  const paris = new Date(new Date(utc).toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime();
  const local = new Date(new Date(utc).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(utc - (paris - local));
}

/** Un défi encore en jeu : en attente de réponse, ou match à venir. */
export function enCours(d: Defi): boolean {
  if (d.statut === "propose") return true;
  return d.statut === "accepte" && coupDEnvoi(d).getTime() > Date.now();
}

/** À moins de 48 h du coup d'envoi, annuler un match programmé, c'est un forfait. */
export function annulerSeraitForfait(d: Defi): boolean {
  return coupDEnvoi(d).getTime() - Date.now() < 48 * 3600_000;
}

export const VERSION_REGLEMENT = "v1";

/** Les signataires, capitaine d'abord, puis le vice. */
export function signataires(e: Equipe): Membre[] {
  const rang = { capitaine: 0, vice: 1, membre: 2 } as const;
  return e.membres.filter((m) => m.statut === "membre").sort((a, b) => rang[a.role] - rang[b.role]);
}

export function invites(e: Equipe): Membre[] {
  const limite = Date.now() - 72 * 3600_000;
  return e.membres.filter((m) => m.statut === "invite" && (!m.depuis || new Date(m.depuis).getTime() > limite));
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
  capitaine: string | null;
  equipe_membres: {
    joueur: string;
    statut: Membre["statut"];
    role: Role;
    created_at: string;
    depart_le?: string | null;
    p: Un<{ name: string }>;
  }[];
}

const MEMBRES = "joueur, statut, role, created_at, depart_le, p:profiles!equipe_membres_joueur_fkey(name)";

/** Les équipes vivantes (une équipe dissoute garde son historique, mais ne s'affiche plus). */
export async function listerEquipes(): Promise<Equipe[]> {
  const { data, error } = await supabase()
    .from("equipes")
    .select(`id, nom, initiales, fond, ville, capitaine, equipe_membres(${MEMBRES})`)
    .is("dissoute_le", null)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as unknown as LigneEquipe[]).map((r) => ({
    id: r.id,
    nom: r.nom,
    initiales: r.initiales,
    fond: r.fond,
    ville: r.ville,
    capitaine: r.capitaine,
    membres: r.equipe_membres.map((m) => ({
      id: m.joueur,
      name: un(m.p)?.name ?? "?",
      statut: m.statut,
      role: m.role,
      depuis: m.created_at,
      departLe: m.depart_le ?? null,
    })),
  }));
}

/** Les défis en jeu (un défi sans réponse depuis 48 h, ou à moins de 36 h du match, a expiré). */
export async function listerDefis(): Promise<Defi[]> {
  const { data, error } = await supabase()
    .from("equipe_defis")
    .select("id, de, a, jour, heure, lieu, statut, created_at")
    .in("statut", ["propose", "accepte"])
    .order("jour");
  if (error) throw error;
  const maintenant = Date.now();
  return ((data ?? []) as (Defi & { created_at: string })[])
    .map(({ created_at, ...d }) => ({ ...d, le: created_at }))
    .filter((d) => {
      if (d.statut === "accepte") return true;
      const coup = coupDEnvoi(d).getTime();
      return new Date(d.le).getTime() > maintenant - 48 * 3600_000 && coup > maintenant + 36 * 3600_000;
    });
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
/** Exclure avec 48 h de préavis ; refaire annule l'exclusion. */
export const exclureMembre = (e: number, joueur: string) => rpc("equipe_exclure", { e, joueur });
export const dissoudreEquipe = (e: number) => rpc("equipe_dissoudre", { e });
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

/** « L'essentiel en 8 points » du Règlement Team v1 (docs/gameplay/11), au-dessus de la case à cocher. */
export const REGLEMENT = [
  "Vous ne jouez qu'avec les membres de votre équipe. Aucun joueur extérieur, même en match amical.",
  "Une équipe compte 5 à 7 membres, tous signataires de ce règlement. À 7, plus personne ne peut entrer.",
  "Une victoire rapporte 3 points à l'équipe, un nul 1, une défaite 0. Ces points vont à l'équipe, pas au joueur.",
  "Vous gagnez des Points Perso par votre présence, vos buts, vos passes décisives et les distinctions votées après le match : Meilleur Joueur +1, Meilleur Défenseur +1, MVP +2.",
  "Faites votre check-in à chaque match. À 5 présents ou plus : aucune pénalité. À 4 face à une équipe de 5 ou plus : votre équipe perd 1 but au score final et chaque absent perd 2 Points Perso. Si les deux équipes sont à 4 : le match est compté comme un amical.",
  "Si 6 joueurs ou plus signalent un match, il est annulé avec ses statistiques.",
  "Au-delà de 2 rencontres contre la même équipe dans la saison, le match est amical : ni points ni stats comptabilisés.",
  "Si vous quittez l'équipe, vous ne pourrez plus jamais y revenir.",
];

/** La case à cocher (Formule d'acceptation, docs/gameplay/11). */
export const ACCEPTATION =
  "J'ai lu et j'accepte le Règlement Team (version 1). Je m'engage à ne jouer qu'avec les membres de mon équipe, matchs amicaux compris, à faire mon check-in à chaque match où je suis inscrit, à saisir et à voter honnêtement, et à respecter mes adversaires. Je sais que si je quitte cette équipe, je ne pourrai plus jamais la réintégrer.";

/** « Règlement Team v1 signé le 04/02/2027 à 21:17 (heure de Paris). Bienvenue chez … ! » */
export function confirmationSignature(nom: string): string {
  const d = new Date();
  const jour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  const heure = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d);
  return `Règlement Team ${VERSION_REGLEMENT} signé le ${jour} à ${heure} (heure de Paris). Bienvenue chez ${nom} !`;
}

/** Un message d'erreur de la base, dit simplement. */
export function direErreurEquipe(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  if (/equipes_nom_unique|déjà pris/i.test(msg)) return "Ce nom est déjà pris.";
  if (/equipe_membres_une_equipe/i.test(msg)) return "Tu as déjà une équipe.";
  if (/duplicate|23505/i.test(msg)) return "Déjà dans l'équipe.";
  if (/does not exist|42P01|PGRST20/i.test(msg)) return "Le mode Team arrive avec la mise en ligne.";
  return msg || "Impossible pour l'instant. Réessaie dans un instant.";
}
