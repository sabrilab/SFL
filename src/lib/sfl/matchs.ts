"use client";

// Les matchs ouverts par les joueurs, et leurs disponibilités.
//
// N'importe quel joueur ouvre un match, sans être admin :
//   · privé  : il ajoute les joueurs par leur identifiant, personne d'autre
//     ne le voit ni n'y entre ;
//   · public : il invite qui il veut, et les places restantes s'affichent
//     sur la Map, où n'importe qui de la ligue peut en prendre une.
// Chacun dit aussi quand il peut jouer (un jour, un moment) : c'est ce qui
// permet de composer des matchs et d'inviter ceux qui sont libres.
//
// Tout vit en base (supabase/schema.sql : matchs, match_joueurs,
// disponibilites) ; les règles RLS y gardent le privé privé et la capacité
// d'un match. Ce sont des matchs Bola : ils ne touchent pas à la saison de
// la SFL, mais leur feuille (saisie par l'organisateur après le coup
// d'envoi) compte dans la Ligue vierge (lib/sfl/ligue-vierge.ts).
// Chaque match a sa discussion, entre ceux qui en sont
// (lib/sfl/discussion-match.ts) : y entrer l'y annonce.

import { supabase } from "@/lib/supabase";
import type { MatchBola } from "@/lib/sfl/ligue-vierge";
import {
  MOTIF_MAX,
  type BilanFeuille,
  type EtatResultat,
  type ReponseDuJoueur,
  type ReponseResultat,
  type ResultatAConfirmer,
} from "@/lib/sfl/confirmation-resultat";

export type Visibilite = "public" | "prive";
export type Moment = "matin" | "apres-midi" | "soir";

export const MOMENTS: { id: Moment; libelle: string }[] = [
  { id: "matin", libelle: "Matin" },
  { id: "apres-midi", libelle: "Après-midi" },
  { id: "soir", libelle: "Soir" },
];

export type EquipeFeuille = "clairs" | "fonces" | "absent";

export interface JoueurDuMatch {
  id: string;
  name: string;
  statut: "invite" | "inscrit";
  /** Sur la feuille : null tant qu'elle n'est pas saisie. */
  equipe: EquipeFeuille | null;
  buts: number;
  passes: number;
}

export interface Partie {
  id: number;
  organisateurId: string;
  organisateur: string;
  visibilite: Visibilite;
  /** ISO, « 2026-10-20 ». */
  jour: string;
  heure: string;
  lieu: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  places: number;
  joueurs: JoueurDuMatch[];
  scoreClairs: number | null;
  scoreFonces: number | null;
  /** La première saisie de la feuille ; corrigeable 24 h. */
  saisiLe: string | null;
}

export interface Profil {
  id: string;
  name: string;
  username: string;
}

/** Les inscrits (ceux qui viennent), les invités en attente à part. */
export function inscrits(p: Partie): JoueurDuMatch[] {
  return p.joueurs.filter((j) => j.statut === "inscrit");
}

/** Places encore libres : un invité tient sa place tant qu'il n'a pas répondu. */
export function placesLibres(p: Partie): number {
  return Math.max(0, p.places - p.joueurs.length);
}

/** Aujourd'hui à Paris, en ISO. */
export function aujourdhuiIso(): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

/** « 2026-10-20 » → « 20 oct. », le libellé des journées sur la Map. */
const MOIS = ["jan", "fev", "mar", "avr", "mai", "juin", "juil", "aou", "sep", "oct", "nov", "dec"];
export function libelleJour(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MOIS[m - 1]}.`;
}

export async function monId(): Promise<string | null> {
  try {
    const { data } = await supabase().auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

type Un<T> = T | T[] | null;
const un = <T,>(v: Un<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

interface LigneMatch {
  id: number;
  organisateur: string;
  visibilite: Visibilite;
  jour: string;
  heure: string;
  lieu: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  places: number;
  score_clairs: number | null;
  score_fonces: number | null;
  saisi_le: string | null;
  orga: Un<{ name: string }>;
  match_joueurs: {
    player_id: string;
    statut: "invite" | "inscrit";
    equipe: EquipeFeuille | null;
    buts: number;
    passes: number;
    profiles: Un<{ name: string }>;
  }[];
}

const COLONNES =
  "id, organisateur, visibilite, jour, heure, lieu, adresse, lat, lng, places, score_clairs, score_fonces, saisi_le, orga:profiles!matchs_organisateur_fkey ( name ), match_joueurs ( player_id, statut, equipe, buts, passes, profiles ( name ) )";

function versPartie(m: LigneMatch): Partie {
  return {
    id: m.id,
    organisateurId: m.organisateur,
    organisateur: un(m.orga)?.name ?? "—",
    visibilite: m.visibilite,
    jour: m.jour,
    heure: m.heure,
    lieu: m.lieu,
    adresse: m.adresse,
    lat: m.lat,
    lng: m.lng,
    places: m.places,
    joueurs: m.match_joueurs.map((j) => ({
      id: j.player_id,
      name: un(j.profiles)?.name ?? "—",
      statut: j.statut,
      equipe: j.equipe,
      buts: j.buts ?? 0,
      passes: j.passes ?? 0,
    })),
    scoreClairs: m.score_clairs,
    scoreFonces: m.score_fonces,
    saisiLe: m.saisi_le,
  };
}

/** Les matchs à venir que je peux voir (les privés seulement si j'en suis). */
export async function listerParties(): Promise<Partie[]> {
  const { data, error } = await supabase()
    .from("matchs")
    .select(COLONNES)
    .gte("jour", aujourdhuiIso())
    .order("jour")
    .order("heure");
  if (error) throw error;
  return ((data ?? []) as unknown as LigneMatch[]).map(versPartie);
}

/** Mes matchs Bola des 7 derniers jours (organisés ou joués) : les feuilles à saisir, à corriger. */
export async function listerMesDerniers(): Promise<Partie[]> {
  const moi = await monId();
  if (!moi) return [];
  const [a, m, d] = aujourdhuiIso().split("-").map(Number);
  const depuis = new Date(Date.UTC(a, m - 1, d - 7)).toISOString().slice(0, 10);
  const { data, error } = await supabase()
    .from("matchs")
    .select(COLONNES)
    .eq("mode", "bola")
    .gte("jour", depuis)
    .lte("jour", aujourdhuiIso())
    .order("jour", { ascending: false })
    .order("heure", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as LigneMatch[])
    .map(versPartie)
    .filter((p) => p.organisateurId === moi || p.joueurs.some((j) => j.id === moi && j.statut === "inscrit"));
}

/** La feuille d'un match Bola : l'équipe, les buts et les passes de chacun, puis le score. */
export interface Feuille {
  scoreClairs: number;
  scoreFonces: number;
  lignes: { playerId: string; equipe: EquipeFeuille; buts: number; passes: number }[];
}

/** La fonction n'existe pas encore en base (une préversion sur une base pas migrée). */
const sansFonction = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST202" || /could not find the function/i.test(e.message ?? ""));

/**
 * L'organisateur enregistre la feuille, d'un coup (enregistrer_feuille_bola,
 * 28/10/2026) : les lignes, le score, puis une nouvelle version si elle a
 * changé. Les joueurs de la feuille reçoivent alors le résultat à confirmer
 * (/api/matchs/resultat). Renvoie la version courante. Sur une base pas
 * encore migrée, l'écriture d'avant, ligne par ligne.
 */
export async function saisirFeuille(id: number, f: Feuille): Promise<number> {
  const sb = supabase();
  const { data, error } = await sb.rpc("enregistrer_feuille_bola", {
    m: id,
    clairs: f.scoreClairs,
    fonces: f.scoreFonces,
    lignes: f.lignes.map((l) => ({ ...l, buts: l.equipe === "absent" ? 0 : l.buts, passes: l.equipe === "absent" ? 0 : l.passes })),
  });
  if (!error) {
    notifierResultat(id, "feuille");
    return Number(data ?? 0);
  }
  if (!sansFonction(error)) throw error;
  // Les lignes d'abord : la règle de la base ferme la feuille 24 h après la
  // première saisie du score, qui date tout le reste.
  for (const l of f.lignes) {
    const absent = l.equipe === "absent";
    const { error: e } = await sb
      .from("match_joueurs")
      .update({ equipe: l.equipe, buts: absent ? 0 : l.buts, passes: absent ? 0 : l.passes })
      .eq("match_id", id)
      .eq("player_id", l.playerId);
    if (e) throw e;
  }
  const { error: e } = await sb.from("matchs").update({ score_clairs: f.scoreClairs, score_fonces: f.scoreFonces }).eq("id", id);
  if (e) throw e;
  return 0;
}

// ─────────────── La confirmation des résultats (28/10/2026) ───────────────
// lib/sfl/confirmation-resultat.ts pour les règles ; la base décide.

/** Les résultats qui attendent ma réponse, du plus ancien au plus récent ; rien sur une base pas migrée. */
export async function mesResultatsAConfirmer(): Promise<ResultatAConfirmer[]> {
  const { data, error } = await supabase().rpc("mes_resultats_a_confirmer");
  if (error) {
    if (sansFonction(error)) return [];
    throw error;
  }
  return (data ?? []) as ResultatAConfirmer[];
}

/** Confirmer ou infirmer la version vue ; l'organisateur est prévenu d'un « infirme ». Renvoie le nouvel état. */
export async function repondreResultat(id: number, version: number, reponse: ReponseResultat, motif?: string): Promise<EtatResultat> {
  const { data, error } = await supabase().rpc("repondre_resultat", {
    m: id,
    v: version,
    r: reponse,
    motif: reponse === "infirme" ? motif?.trim().slice(0, MOTIF_MAX) || null : null,
  });
  if (error) throw error;
  if (reponse === "infirme") notifierResultat(id, "conteste");
  return data as EtatResultat;
}

/** L'état de ces matchs et ma réponse, par id ; rien si la base ne le sait pas encore. */
export async function bilansFeuilles(ids: number[]): Promise<Map<number, BilanFeuille>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase().rpc("bilans_feuilles", { ids });
  if (error) return new Map();
  return new Map(Object.entries((data ?? {}) as Record<string, BilanFeuille>).map(([k, v]) => [Number(k), v]));
}

/** Les réponses à la feuille courante, pour l'organisateur. */
export async function reponsesDuMatch(id: number): Promise<(BilanFeuille & { reponses: ReponseDuJoueur[] | null }) | null> {
  const { data, error } = await supabase().rpc("reponses_du_match", { m: id });
  if (error) return null;
  return (data ?? null) as (BilanFeuille & { reponses: ReponseDuJoueur[] | null }) | null;
}

/**
 * Le résultat envoyé aux joueurs (feuille), ou l'organisateur prévenu d'un
 * « infirme » (conteste) : /api/matchs/resultat. Une notification perdue ne
 * bloque rien : l'écran arrive à l'ouverture, et les 24 h décident.
 */
export function notifierResultat(id: number, type: "feuille" | "conteste"): void {
  void (async () => {
    try {
      const { data } = await supabase().auth.getSession();
      const jeton = data.session?.access_token;
      if (!jeton) return;
      await fetch("/api/matchs/resultat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ id, type }),
        keepalive: true,
      });
    } catch {}
  })();
}

/** Tous les matchs Bola joués, pour la Ligue vierge (fonction ligue_vierge en base). */
export async function lireLigueVierge(): Promise<MatchBola[]> {
  const { data, error } = await supabase().rpc("ligue_vierge");
  if (error) throw error;
  return (data ?? []) as MatchBola[];
}

export interface NouvellePartie {
  visibilite: Visibilite;
  jour: string;
  heure: string;
  lieu: string;
  adresse?: string | null;
  lat?: number | null;
  lng?: number | null;
  places: number;
  /** Les joueurs ajoutés par identifiant (hors l'organisateur). */
  invites: string[];
}

/** Ouvre un match : l'organisateur y est inscrit d'office, les autres invités. */
export async function ouvrirPartie(n: NouvellePartie): Promise<number> {
  const sb = supabase();
  const moi = await monId();
  if (!moi) throw new Error("Connecte-toi pour ouvrir un match.");
  const { data, error } = await sb
    .from("matchs")
    .insert({
      visibilite: n.visibilite,
      jour: n.jour,
      heure: n.heure,
      lieu: n.lieu.trim(),
      adresse: n.adresse ?? null,
      lat: n.lat ?? null,
      lng: n.lng ?? null,
      places: n.places,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: number }).id;
  const lignes = [
    { match_id: id, player_id: moi, statut: "inscrit" },
    ...n.invites.filter((p) => p !== moi).map((p) => ({ match_id: id, player_id: p, statut: "invite" })),
  ];
  // Une ligne à la fois : le trigger de capacité compte les précédentes.
  for (const l of lignes) {
    const { error: e } = await sb.from("match_joueurs").insert(l);
    if (e) throw e;
  }
  if (n.invites.length > 0) notifierMatch(id, "invitation");
  return id;
}

/** Ce que l'organisateur change après coup : quand, où, combien, pour qui. */
export interface ReglagesPartie {
  visibilite: Visibilite;
  jour: string;
  heure: string;
  lieu: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  places: number;
}

/** L'organisateur modifie son match ; les joueurs qui en sont sont prévenus si le rendez-vous change. */
export async function modifierPartie(p: Partie, r: ReglagesPartie): Promise<void> {
  if (r.places < p.joueurs.length) throw new Error("Moins de places que de joueurs déjà dans le match.");
  const { error } = await supabase()
    .from("matchs")
    .update({ ...r, lieu: r.lieu.trim() })
    .eq("id", p.id);
  if (error) throw error;
  const rendezVous = p.jour !== r.jour || p.heure !== r.heure || p.lieu !== r.lieu.trim();
  if (rendezVous && p.joueurs.length > 1) notifierMatch(p.id, "modifie");
}

/** L'organisateur retire un joueur (ou une invitation) de son match. */
export async function retirerJoueur(id: number, playerId: string): Promise<void> {
  const { error } = await supabase().from("match_joueurs").delete().eq("match_id", id).eq("player_id", playerId);
  if (error) throw error;
}

/**
 * Prévenir les joueurs d'un match (/api/matchs/notifier) : les invités pas
 * encore prévenus, ou tout le monde quand le rendez-vous change. Une
 * notification perdue ne bloque jamais le geste.
 */
async function appelNotifier(corps: { id: number; type: "invitation" | "modifie" | "annule" }): Promise<Response | null> {
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return null;
    return await fetch("/api/matchs/notifier", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify(corps),
      keepalive: true,
    });
  } catch {
    return null;
  }
}

export function notifierMatch(id: number, type: "invitation" | "modifie"): void {
  void appelNotifier({ id, type });
}


/**
 * Mon arrivée dans la discussion du match (« … a rejoint le match ») : les
 * autres en sont prévenus. Chargée à la demande, sans attendre ni échouer.
 */
function annoncer(id: number): void {
  void import("@/lib/sfl/discussion-match").then((d) => d.annoncerArrivee(id)).catch(() => {});
}

/** Prendre une place libre d'un match public. */
export async function rejoindre(id: number): Promise<void> {
  const moi = await monId();
  if (!moi) throw new Error("Connecte-toi pour rejoindre un match.");
  const { error } = await supabase().from("match_joueurs").insert({ match_id: id, player_id: moi, statut: "inscrit" });
  if (error) throw error;
  annoncer(id);
}

/** Accepter une invitation. */
export async function accepter(id: number): Promise<void> {
  const moi = await monId();
  if (!moi) return;
  const { error } = await supabase().from("match_joueurs").update({ statut: "inscrit" }).eq("match_id", id).eq("player_id", moi);
  if (error) throw error;
  annoncer(id);
}

/**
 * Refuser l'invitation (« Pas dispo ») : la ligne de l'invité part, et la
 * base garde son refus (match_refus). Sa réponse est figée (Sabri, 27/10) :
 * qui a dit « Je viens » ne se retire plus de lui-même, qui a dit « Pas
 * dispo » ne reprend pas de place ; la base le refuse (« réponse figée »).
 * L'organisateur, lui, retire toujours un joueur (retirerJoueur).
 */
export async function refuser(id: number): Promise<void> {
  const moi = await monId();
  if (!moi) return;
  const { error } = await supabase().from("match_joueurs").delete().eq("match_id", id).eq("player_id", moi);
  if (error) throw error;
}

/** Ai-je déjà dit « Pas dispo » à ce match ? Sans la table (base pas encore migrée) : non. */
export async function aiRefuse(id: number): Promise<boolean> {
  const moi = await monId();
  if (!moi) return false;
  const { data, error } = await supabase().from("match_refus").select("match_id").eq("match_id", id).eq("player_id", moi).maybeSingle();
  return !error && !!data;
}

/** L'organisateur invite un joueur de plus. */
export async function inviter(id: number, playerId: string): Promise<void> {
  const { error } = await supabase().from("match_joueurs").insert({ match_id: id, player_id: playerId, statut: "invite" });
  if (error) throw error;
  notifierMatch(id, "invitation");
}

/**
 * L'organisateur annule son match : le serveur prévient les joueurs puis l'efface ; sans lui, on l'efface d'ici.
 * Un match à la feuille faite ne s'annule plus (409 ; la base le refuse aussi, 28/10/2026).
 */
export async function annuler(id: number): Promise<void> {
  const r = await appelNotifier({ id, type: "annule" });
  if (r?.status === 409) throw new Error("match déjà joué");
  if (r?.ok && ((await r.json().catch(() => ({}))) as { annule?: boolean }).annule) return;
  // La base refuse sans erreur (rien d'effacé) un match déjà joué : le dire.
  const { data, error } = await supabase().from("matchs").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("match déjà joué");
}

/**
 * Les joueurs de la ligue, pour les ajouter par leur identifiant ou leur nom :
 * les comptes acceptés et finis seulement (28/10/2026). Un compte en attente,
 * ou revenu de Google sans avoir choisi son pseudo (un nom provisoire), ne se
 * proposait pas moins qu'un autre.
 */
export async function listerProfils({ tous = false }: { tous?: boolean } = {}): Promise<Profil[]> {
  let requete = supabase().from("profiles").select("id, name, username");
  // `tous` : un annuaire (le nom d'une conversation déjà ouverte), pas une invitation.
  if (!tous) requete = requete.eq("valide", true).eq("pseudo_a_choisir", false);
  const { data, error } = await requete.order("name");
  if (error) throw error;
  return (data ?? []) as Profil[];
}

export function chercherProfils(profils: Profil[], q: string): Profil[] {
  const t = q.trim().toLowerCase().replace(/^@/, "");
  if (!t) return [];
  return profils
    .filter((p) => p.name.toLowerCase().includes(t) || p.username.toLowerCase().replace(/^@/, "").includes(t))
    .slice(0, 8);
}

/** « Libre à quel moment » : une fourchette de jours, toute la ligue. */
export interface Dispo {
  playerId: string;
  name: string;
  jour: string;
  moment: Moment;
}

/**
 * Les disponibilités sont cachées (Sabri, 24/10) : ni « Mes dispos » dans le
 * menu de la Map, ni l'onglet « Libres » quand on invite, ni le moment que la
 * Map propose d'après elles. Rien n'est effacé : la table et le code restent,
 * et repasser ce drapeau à true ramène tout.
 */
export const DISPOS_AFFICHEES = false;

export async function listerDispos(du: string, au: string): Promise<Dispo[]> {
  if (!DISPOS_AFFICHEES) return [];
  const { data, error } = await supabase()
    .from("disponibilites")
    .select("player_id, jour, moment, profiles ( name )")
    .gte("jour", du)
    .lte("jour", au);
  if (error) throw error;
  type L = { player_id: string; jour: string; moment: Moment; profiles: Un<{ name: string }> };
  return ((data ?? []) as unknown as L[]).map((d) => ({
    playerId: d.player_id,
    name: un(d.profiles)?.name ?? "—",
    jour: d.jour,
    moment: d.moment,
  }));
}

export async function poserDispo(jour: string, moment: Moment, libre: boolean): Promise<void> {
  const moi = await monId();
  if (!moi) throw new Error("Connecte-toi pour donner tes disponibilités.");
  const sb = supabase();
  const { error } = libre
    ? await sb.from("disponibilites").upsert({ player_id: moi, jour, moment }, { onConflict: "player_id,jour,moment" })
    : await sb.from("disponibilites").delete().eq("player_id", moi).eq("jour", jour).eq("moment", moment);
  if (error) throw error;
}

/** Le moment d'une heure de coup d'envoi (« 19h30 » → soir). */
export function momentDeLHeure(heure: string): Moment {
  const h = Number(heure.match(/^(\d{1,2})/)?.[1] ?? 12);
  return h < 12 ? "matin" : h < 18 ? "apres-midi" : "soir";
}

/** Les N prochains jours, aujourd'hui compris, en ISO (Paris). */
export function prochainsJours(n: number): string[] {
  const [a, m, d] = aujourdhuiIso().split("-").map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(a, m - 1, d + i)).toISOString().slice(0, 10));
}

/** Un message d'erreur de la base, dit simplement. */
export function direErreur(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  if (/réponse figée/i.test(msg)) return "Ta réponse est déjà donnée.";
  if (/feuille corrigée/i.test(msg)) return "La feuille vient d'être corrigée.";
  if (/résultat décidé/i.test(msg)) return "Le résultat est déjà décidé.";
  if (/feuille par l'app/i.test(msg)) return "Mets l'app à jour pour tenir la feuille.";
  if (/feuille incohérente/i.test(msg)) return "Plus de buts ou de passes que le score.";
  if (/pas sur la feuille/i.test(msg)) return "Tu n'es pas sur cette feuille.";
  if (/complet/i.test(msg)) return "Le match est complet.";
  if (/duplicate|already exists|23505/i.test(msg)) return "Ce joueur est déjà dans le match.";
  if (/feuille close/i.test(msg)) return "La feuille est close : 24 h sont passées.";
  if (/déjà joué/i.test(msg)) return "Ce match est déjà joué : sa feuille est faite.";
  if (/pas commencé/i.test(msg)) return "La feuille s'ouvre au coup d'envoi.";
  if (/feuille réservée/i.test(msg)) return "Seul l'organisateur tient la feuille.";
  if (/row-level security|42501/i.test(msg)) return "Ce match ne t'est pas ouvert.";
  if (/places_check|check constraint/i.test(msg)) return "Entre 2 et 22 places.";
  return msg || "Impossible pour l'instant. Réessaie dans un instant.";
}
