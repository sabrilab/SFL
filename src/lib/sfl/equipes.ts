"use client";

// Le mode Team (Sabri, 22/10 ; règles officielles : BOLA docs/gameplay/04 et
// 11, le Règlement Team). Une équipe de 5 à 7 joueurs, un capitaine, un
// écusson noir et blanc à ses initiales :
//   · le capitaine (ou son vice) invite des joueurs de Bola, ou partage un
//     lien : un nouveau y crée vite son compte et arrive invité ;
//   · entrer, c'est signer le Règlement Team ; qui part ne revient jamais ;
//   · une équipe à 5 défie les autres (le call-out) ; l'équipe défiée
//     accepte ou refuse ; après le match, chaque capitaine remplit la
//     feuille (le score, ses buteurs et ses passeurs), et le championnat se
//     calcule (lib/sfl/championnat-team.ts) ;
//   · depuis le 24/10, chaque équipe dessine son écusson et choisit ses
//     couleurs (lib/sfl/blason.ts), et le Règlement passe en version 2 :
//     2 points la victoire, et la Charte de déontologie à signer avec ;
//   · depuis le 03/11/2026 (Ilyes, 02/11 : « une équipe = 7 joueurs + 1
//     entraîneur »), une place d'entraîneur à part : un membre qui ne joue
//     jamais pour l'équipe et ne compte dans aucun seuil (signataires ne
//     rend que les joueurs, entraineurDe le rend lui), invité par le
//     capitaine seul (inviterEntraineur). Ses droits, geste par geste :
//     equipes-droits.ts (peut), la même table que la base. Le Règlement
//     passe en version 3, avec sa formule à lui (acceptationEntraineur) ;
//   · la feuille d'avant-match (même jour) : l'entraîneur dépose de 5 à 7
//     joueurs pour un match programmé (deposerFeuille ; le capitaine ou le
//     vice sans entraîneur, ou dès H-2 : peutDeposer), figée au coup
//     d'envoi ; on la lit avec le match (lireFeuilles : la base ne montre
//     que celle de son équipe avant le coup d'envoi, les deux ensuite).
// Les délais (invitation 72 h, carence 14 jours, préavis d'exclusion 48 h,
// créneau d'un défi entre +48 h et +21 jours, réponse sous 48 h, forfait à
// moins de 48 h) sont gardés par la base ; l'app les montre.
//
// Inviter (passe du 23/10, « c'est bloqué ») : le capitaine choisit
// plusieurs joueurs d'un coup, l'app dit d'avance qui ne peut pas venir
// (indisponibles), et chaque invité est prévenu sur son téléphone
// (notifierEquipe), sur la Map et par la pastille de l'onglet
// (mesInvitations). Comme le veut la règle, seuls les membres prennent une
// place : on peut inviter plus de joueurs qu'il ne reste de places.
//
// Tout vit en base (supabase/schema.sql, « Mode Team ») ; chaque écriture
// passe par une fonction de la base qui en vérifie les règles.

import { SUPABASE_URL, supabase } from "@/lib/supabase";
import { finInvitation } from "@/lib/sfl/equipes-temps";
import { lireBlason, type Blason } from "@/lib/sfl/blason";
import { joue, type Role } from "@/lib/sfl/equipes-droits";
import type { ButeurTeam, EquipeChampionnat, FeuilleTeam, MatchTeam, Presents, SaisieTeam } from "@/lib/sfl/championnat-team";

export { DROITS, FEUILLE_AVANT_MATCH, brassard, droitDe, joue, peut, peutDeposer, type Geste, type Role } from "@/lib/sfl/equipes-droits";

export type Fond = "noir" | "blanc";

export const MIN_EQUIPE = 5;
export const MAX_EQUIPE = 7;

export interface Membre {
  id: string;
  name: string;
  statut: "invite" | "membre";
  role: Role;
  /** Invité : quand ; son invitation tombe 72 h après. */
  depuis?: string;
  /** Invité : par qui (le capitaine ou le vice). */
  invitePar?: string | null;
  /** Membre : quand il a signé le Règlement. */
  signeLe?: string | null;
  /** Exclu par le capitaine : son départ, 48 h après. */
  departLe?: string | null;
  /** Membre : la version du Règlement qu'il a signée (« v1 », « v2 », « v3 »), null avant le règlement. */
  reglement?: string | null;
}

export interface Equipe {
  id: number;
  nom: string;
  initiales: string;
  fond: Fond;
  ville: string | null;
  capitaine: string | null;
  membres: Membre[];
  /** L'écusson dessiné ; null : le noir et blanc des débuts, d'après fond. */
  blason: Blason | null;
  /** Quand la couverture de sa page a été posée (sa version) ; null : la couverture dessinée. */
  couvertureLe: string | null;
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
  /** Un match programmé : les feuilles d'avant-match qu'on peut lire (celle de mon équipe, avant le coup d'envoi). */
  feuilles?: FeuilleTeam[];
  /** Les équipes qui ont déposé leur feuille, sans les noms (l'adversaire sait seulement qu'elle est déposée). */
  deposees?: number[];
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

export const VERSION_REGLEMENT = "v3";

/** Un membre qui n'a pas encore signé la version en cours (la Charte le 24/10, l'entraîneur le 03/11). */
export const aSignerLaCharte = (m: Membre) => m.statut === "membre" && m.reglement !== VERSION_REGLEMENT;

/** Les joueurs signataires, capitaine d'abord, puis le vice : jamais l'entraîneur, qui ne compte ni ne joue. */
export function signataires(e: Equipe): Membre[] {
  const rang: Record<Role, number> = { capitaine: 0, vice: 1, membre: 2, entraineur: 3 };
  return e.membres.filter((m) => m.statut === "membre" && joue(m.role)).sort((a, b) => rang[a.role] - rang[b.role]);
}

const valable = (m: Membre, maintenant = Date.now()) => !m.depuis || finInvitation(m.depuis).getTime() > maintenant;

/** L'entraîneur de l'équipe, en place ou invité (son invitation encore valable) ; null sans entraîneur. */
export function entraineurDe(e: Equipe): Membre | null {
  return e.membres.find((m) => m.role === "entraineur" && (m.statut === "membre" || valable(m))) ?? null;
}

/** Les invitations encore valables (72 h), de la plus ancienne à la plus récente : celles des joueurs et celle de l'entraîneur. */
export function invites(e: Equipe): Membre[] {
  const maintenant = Date.now();
  return e.membres
    .filter((m) => m.statut === "invite" && valable(m, maintenant))
    .sort((a, b) => (a.depuis ?? "").localeCompare(b.depuis ?? ""));
}

/** Les invitations de joueurs seules : elles attendent sur le terrain, six au plus. */
export const invitesJoueurs = (e: Equipe): Membre[] => invites(e).filter((m) => joue(m.role));

/** Six invitations de joueurs en attente au plus (la base le garde, equipe_inviter). */
export const INVITATIONS_MAX = 6;

/** Combien de joueurs on peut encore inviter (l'entraîneur ne prend aucune place). */
export function invitationsPossibles(e: Equipe): number {
  if (signataires(e).length >= MAX_EQUIPE) return 0;
  return Math.max(0, INVITATIONS_MAX - invitesJoueurs(e).length);
}

/** Qui a invité ce joueur : son prénom, sinon celui du capitaine. */
export function inviteur(e: Equipe, m: Membre): string {
  const par = e.membres.find((x) => x.id === m.invitePar) ?? e.membres.find((x) => x.role === "capitaine");
  return (par?.name ?? "").split(" ")[0];
}

/** « Ilyes t'invite », ou « Ilyes t'invite à entraîner » : ce que dit une invitation reçue. */
export const tInvite = (e: Equipe, m: Membre): string => `${inviteur(e, m)} t'invite${m.role === "entraineur" ? " à entraîner" : ""}`;

/** Une équipe joue (et se défie) à 5 signataires. */
export function active(e: Equipe): boolean {
  return signataires(e).length >= MIN_EQUIPE;
}

/** « Roubaix · En formation · 2 / 5 », puis « Roubaix · Active · 6 / 7 » : vers 5, puis vers 7. */
export function etatEquipe(e: Equipe): string {
  const n = signataires(e).length;
  return [e.ville, active(e) ? "Active" : "En formation", `${n} / ${active(e) ? MAX_EQUIPE : MIN_EQUIPE}`].filter(Boolean).join(" · ");
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
  blason?: unknown;
  couverture_le?: string | null;
  equipe_membres: {
    joueur: string;
    statut: Membre["statut"];
    role: Role;
    created_at: string;
    invite_par?: string | null;
    signe_le?: string | null;
    depart_le?: string | null;
    reglement_version?: string | null;
    p: Un<{ name: string }>;
  }[];
}

const MEMBRES =
  "joueur, statut, role, created_at, invite_par, signe_le, depart_le, reglement_version, p:profiles!equipe_membres_joueur_fkey(name)";
/** Ce qu'on lit d'une équipe (l'écusson dessiné et la couverture compris). */
const EQUIPE = `id, nom, initiales, fond, ville, capitaine, blason, couverture_le, equipe_membres(${MEMBRES})`;
/** Une préversion lit la base de la prod avant sa migration : pas encore de colonnes blason ni couverture_le (42703), on relit sans elles. */
const SANS_BLASON = EQUIPE.replace(" blason, couverture_le,", "");
const sansColonne = (e: { code?: string } | null) => e?.code === "42703";

const versEquipe = (r: LigneEquipe): Equipe => ({
  id: r.id,
  nom: r.nom,
  initiales: r.initiales,
  fond: r.fond,
  ville: r.ville,
  capitaine: r.capitaine,
  blason: lireBlason(r.blason),
  couvertureLe: r.couverture_le ?? null,
  membres: r.equipe_membres.map((m) => ({
    id: m.joueur,
    name: un(m.p)?.name ?? "?",
    statut: m.statut,
    role: m.role,
    depuis: m.created_at,
    invitePar: m.invite_par ?? null,
    signeLe: m.signe_le ?? null,
    departLe: m.depart_le ?? null,
    reglement: m.reglement_version ?? null,
  })),
});

/** Les équipes vivantes (une équipe dissoute garde son historique, mais ne s'affiche plus). */
export async function listerEquipes(): Promise<Equipe[]> {
  const lire = (colonnes: string) => supabase().from("equipes").select(colonnes).is("dissoute_le", null).order("created_at");
  let { data, error } = await lire(EQUIPE);
  if (sansColonne(error)) ({ data, error } = await lire(SANS_BLASON));
  if (error) throw error;
  return ((data ?? []) as unknown as LigneEquipe[]).map(versEquipe);
}

/** L'équipe dont je suis membre (une seule à la fois), ou null. */
export async function monEquipe(moi: string): Promise<Equipe | null> {
  const sb = supabase();
  const { data: place, error } = await sb
    .from("equipe_membres")
    .select("equipe_id")
    .eq("joueur", moi)
    .eq("statut", "membre")
    .maybeSingle();
  if (error) throw error;
  if (!place) return null;
  const lire = (colonnes: string) =>
    sb.from("equipes").select(colonnes).eq("id", (place as { equipe_id: number }).equipe_id).is("dissoute_le", null).maybeSingle();
  let { data, error: e2 } = await lire(EQUIPE);
  if (sansColonne(e2)) ({ data, error: e2 } = await lire(SANS_BLASON));
  if (e2) throw e2;
  return data ? versEquipe(data as unknown as LigneEquipe) : null;
}

/**
 * Les équipes qui m'invitent, invitation encore valable : la carte de la
 * Map, la pastille de l'onglet, la page Team. Une seule lecture quand il n'y
 * en a pas.
 */
export async function mesInvitations(moi: string): Promise<Equipe[]> {
  const sb = supabase();
  const { data: lignes, error } = await sb
    .from("equipe_membres")
    .select("equipe_id")
    .eq("joueur", moi)
    .eq("statut", "invite")
    .gt("created_at", new Date(Date.now() - 72 * 3600_000).toISOString());
  if (error) throw error;
  const ids = ((lignes ?? []) as { equipe_id: number }[]).map((l) => l.equipe_id);
  if (ids.length === 0) return [];
  const lire = (colonnes: string) => sb.from("equipes").select(colonnes).in("id", ids).is("dissoute_le", null).order("created_at");
  let { data, error: e2 } = await lire(EQUIPE);
  if (sansColonne(e2)) ({ data, error: e2 } = await lire(SANS_BLASON));
  if (e2) throw e2;
  return ((data ?? []) as unknown as LigneEquipe[]).map(versEquipe);
}

/** Les défis en jeu (un défi sans réponse depuis 48 h, ou à moins de 36 h du match, a expiré), et les feuilles des matchs programmés. */
export async function listerDefis(): Promise<Defi[]> {
  const { data, error } = await supabase()
    .from("equipe_defis")
    .select("id, de, a, jour, heure, lieu, statut, created_at")
    .in("statut", ["propose", "accepte"])
    .order("jour");
  if (error) throw error;
  const maintenant = Date.now();
  const defis = ((data ?? []) as (Defi & { created_at: string })[])
    .map(({ created_at, ...d }) => ({ ...d, le: created_at }))
    .filter((d) => {
      if (d.statut === "accepte") return true;
      const coup = coupDEnvoi(d).getTime();
      return new Date(d.le).getTime() > maintenant - 48 * 3600_000 && coup > maintenant + 36 * 3600_000;
    });
  const programmes = defis.filter((d) => d.statut === "accepte").map((d) => d.id);
  const [feuilles, deposees] = await Promise.all([lireFeuilles(programmes), feuillesDeposees(programmes)]);
  return defis.map((d) => ({
    ...d,
    ...(feuilles.has(d.id) ? { feuilles: feuilles.get(d.id) } : {}),
    ...(deposees.has(d.id) ? { deposees: deposees.get(d.id) } : {}),
  }));
}

/** Qui a déposé sa feuille, par match, sans les noms (equipe_feuilles_deposees) ; sans la migration, personne. */
export async function feuillesDeposees(defis: number[]): Promise<Map<number, number[]>> {
  const par = new Map<number, number[]>();
  if (defis.length === 0) return par;
  const { data, error } = await supabase().rpc("equipe_feuilles_deposees", { d: defis });
  if (error) return par;
  for (const r of (data ?? []) as { defi_id: number; equipe_id: number }[]) par.set(r.defi_id, [...(par.get(r.defi_id) ?? []), r.equipe_id]);
  return par;
}

interface LigneFeuille {
  defi_id: number;
  equipe_id: number;
  deposee_par: string | null;
  deposee_le: string;
  equipe_feuille_joueurs: { joueur: string; p: Un<{ name: string }> }[] | null;
}

/**
 * Les feuilles d'avant-match que je peux lire, par match : la base ne montre
 * que celle de mon équipe avant le coup d'envoi, les deux ensuite. Sans la
 * migration (une préversion), aucune.
 */
export async function lireFeuilles(defis?: number[]): Promise<Map<number, FeuilleTeam[]>> {
  const par = new Map<number, FeuilleTeam[]>();
  if (defis && defis.length === 0) return par;
  const lire = supabase()
    .from("equipe_feuilles")
    .select("defi_id, equipe_id, deposee_par, deposee_le, equipe_feuille_joueurs(joueur, p:profiles!equipe_feuille_joueurs_joueur_fkey(name))");
  const { data, error } = await (defis ? lire.in("defi_id", defis) : lire);
  if (error) return par;
  for (const r of (data ?? []) as unknown as LigneFeuille[]) {
    const lignes = r.equipe_feuille_joueurs ?? [];
    const f: FeuilleTeam = {
      equipe: r.equipe_id,
      joueurs: lignes.map((j) => j.joueur),
      noms: lignes.map((j) => un(j.p)?.name ?? "?"),
      par: r.deposee_par,
      le: r.deposee_le,
    };
    par.set(r.defi_id, [...(par.get(r.defi_id) ?? []), f]);
  }
  return par;
}

async function rpc<T = void>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const creerEquipe = (nom: string, initiales: string, fond: Fond) => rpc<number>("equipe_creer", { nom: nom.trim(), initiales, fond });
export const inviterEquipe = (e: number, joueur: string) => rpc("equipe_inviter", { e, joueur });

/** Le capitaine invite l'entraîneur (hors des six invitations de joueurs), puis il est prévenu. */
export async function inviterEntraineur(e: number, joueur: string): Promise<void> {
  await rpc("equipe_entraineur_inviter", { e, joueur });
  void notifierEquipe(e, "invitation");
}

/**
 * Inviter plusieurs joueurs d'un coup : chacun à son tour (la base garde les
 * règles de chacun), puis une notification à tous les nouveaux invités.
 */
export async function inviterJoueurs(
  e: number,
  joueurs: { id: string; name: string }[]
): Promise<{ invites: string[]; refus: { name: string; raison: string }[] }> {
  const invites: string[] = [];
  const refus: { name: string; raison: string }[] = [];
  for (const j of joueurs) {
    try {
      await inviterEquipe(e, j.id);
      invites.push(j.name);
    } catch (err) {
      refus.push({ name: j.name, raison: direErreurEquipe(err) });
    }
  }
  if (invites.length > 0) void notifierEquipe(e, "invitation");
  return { invites, refus };
}

/** Pourquoi un joueur ne peut pas être invité (equipe_indisponibles, dans la base). */
export type Indispo = "parti" | "equipe" | "carence" | "attente" | "team";

/** Ce que la liste des joueurs en dit, sur sa ligne. */
export const RAISON_INDISPO: Record<Indispo, string> = {
  parti: "A quitté l'équipe",
  equipe: "A déjà une équipe",
  carence: "Vient de quitter son équipe",
  attente: "Compte en attente",
  // Joueur Bola venu sans le lien d'un joueur SFL (parrainage, 24/10) :
  // seule une équipe dont un joueur SFL l'invite peut l'accueillir.
  team: "Pas de Bola Team",
};

/** Ceux que mon équipe ne peut pas inviter, et pourquoi (capitaine, vice et entraîneur). */
export async function indisponibles(e: number): Promise<Map<string, Indispo>> {
  const { data, error } = await supabase().rpc("equipe_indisponibles", { e });
  if (error) throw error;
  return new Map(((data ?? []) as { joueur: string; raison: Indispo }[]).map((r) => [r.joueur, r.raison]));
}

/**
 * Prévenir sur le téléphone (/api/equipes/notifier) : les joueurs tout juste
 * invités, un invité qu'on relance, ou le capitaine quand je viens de signer.
 * Une notification perdue ne bloque jamais le geste : null si l'appel échoue.
 */
export async function notifierEquipe(
  e: number,
  type: "invitation" | "relance" | "signature",
  joueur?: string
): Promise<{ envoyes?: number; tropTot?: boolean } | null> {
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return null;
    const r = await fetch("/api/equipes/notifier", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ equipe: e, type, joueur }),
      keepalive: true,
    });
    return r.ok ? ((await r.json()) as { envoyes?: number; tropTot?: boolean }) : null;
  } catch {
    return null;
  }
}
export const retirerInvitation = (e: number, joueur: string) => rpc("equipe_retirer_invitation", { e, joueur });
/** Signer, puis le dire au capitaine (et à l'équipe, à la cinquième signature). */
export async function signerReglement(e: number): Promise<void> {
  await rpc("equipe_signer", { e });
  void notifierEquipe(e, "signature");
}
export const quitterEquipe = (e: number) => rpc("equipe_quitter", { e });
export const nommerVice = (e: number, joueur: string | null) => rpc("equipe_vice", { e, joueur });
/** Exclure avec 48 h de préavis ; refaire annule l'exclusion. */
export const exclureMembre = (e: number, joueur: string) => rpc("equipe_exclure", { e, joueur });
export const dissoudreEquipe = (e: number) => rpc("equipe_dissoudre", { e });
export const lienEquipe = (e: number) => rpc<string>("equipe_lien", { e });
export const rejoindreParLien = (j: string) => rpc<number>("equipe_par_lien", { j });
export const defier = (de: number, a: number, jour: string, heure: string, lieu: string) => rpc<number>("equipe_defier", { de, a, jour, heure, lieu });
export const repondreDefi = (d: number, statut: "accepte" | "refuse" | "annule") => rpc("equipe_defi_statut", { d, statut });
/** Le capitaine (ou son vice) pose l'écusson dessiné. */
export const dessinerBlason = (e: number, b: Blason) => rpc("equipe_blason", { e, b });
/** Un membre signe la version en cours (le Règlement et la Charte). */
export const signerCharte = (e: number) => rpc("equipe_signer_charte", { e });

/**
 * Déposer (ou redéposer) la feuille d'avant-match de mon équipe : de 5 à 7
 * de ses joueurs, jusqu'au coup d'envoi (la base garde qui peut, et quand) ;
 * puis ceux qui viennent d'y entrer sont prévenus.
 */
export async function deposerFeuille(d: number, joueurs: string[]): Promise<void> {
  await rpc("equipe_feuille", { d, joueurs });
  void notifierFeuille(d);
}

/** Prévenir les joueurs mis sur la feuille (une notification perdue ne bloque rien). */
async function notifierFeuille(defi: number): Promise<void> {
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return;
    await fetch("/api/equipes/notifier", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ type: "feuille", defi }),
      keepalive: true,
    });
  } catch {}
}

/** Le bucket public des couvertures : une image par équipe, « <id>.jpg ». */
const COUVERTURES = "couvertures";

/** L'adresse de la couverture d'une équipe, versionnée par sa date de pose ; null sans couverture. */
export function urlCouverture(e: Pick<Equipe, "id" | "couvertureLe">): string | null {
  if (!e.couvertureLe) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${COUVERTURES}/${e.id}.jpg?v=${Date.parse(e.couvertureLe) || 0}`;
}

/** Ce que rend la création d'une couverture : l'image, ou pourquoi pas ; et le crédit du jour de l'équipe. */
export interface Couverture {
  image?: string;
  error?: string;
  restantes?: number;
  /** Quand le crédit repart (ISO). */
  fin?: string;
}

/**
 * Créer la couverture de la page de l'équipe (/api/equipes/couverture) :
 * les photos de carte de ses joueurs, son maillot et son écusson (deux PNG
 * en data URL). Le capitaine (ou le vice) la voit avant de la poser.
 */
export async function creerCouverture(e: number, maillot: string, ecusson: string): Promise<Couverture> {
  const { data } = await supabase().auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) return { error: "Session requise." };
  try {
    const r = await fetch("/api/equipes/couverture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: jeton, equipe: e, maillot, ecusson }),
    });
    return ((await r.json().catch(() => null)) as Couverture | null) ?? { error: "Couverture indisponible pour l'instant." };
  } catch {
    return { error: "Pas de réseau. Réessaie dans un instant." };
  }
}

/** Poser la couverture créée : l'image dans le bucket, puis sa date sur l'équipe (capitaine et vice). */
export async function poserCouverture(e: number, image: string): Promise<void> {
  const fichier = await (await fetch(image)).blob();
  const { error } = await supabase().storage.from(COUVERTURES).upload(`${e}.jpg`, fichier, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;
  await rpc("equipe_couverture", { e, posee: true });
}

/** Revenir à la couverture dessinée. */
export const retirerCouverture = (e: number) => rpc("equipe_couverture", { e, posee: false });

/**
 * La feuille d'un match : le score du terrain vu de mon équipe, ses buteurs
 * et ses passeurs, et les présents des deux équipes (5 : cinq ou plus ; 4 ;
 * 3 : trois ou moins, le forfait) ; puis l'autre capitaine est prévenu qu'il
 * confirme.
 */
export async function saisirResultat(
  d: number,
  pour: number,
  contre: number,
  lignes: { joueur: string; buts: number; passes: number }[],
  presents: Presents = 5,
  presentsAdverses: Presents = 5
): Promise<void> {
  await rpc("equipe_resultat", { d, pour, contre, lignes, presents, presents_adverses: presentsAdverses });
  void notifierResultat(d);
}

/** Les équipes du championnat (dissoutes comprises : leurs matchs restent) et tous les matchs joués ou à jouer. */
export async function lireChampionnat(): Promise<{ equipes: EquipeTeam[]; matchs: MatchTeam[] }> {
  const sb = supabase();
  const lireEquipes = (blason: boolean) =>
    sb.from("equipes").select(`id, nom, initiales, fond, ville, ${blason ? "blason, " : ""}created_at, dissoute_le, equipe_membres(statut, role)`);
  // Les présents (le 5 contre 4, 03/11/2026) : une préversion sur la base d'avant ne les a pas (42703), on relit sans.
  const lireSaisies = (presents: boolean) =>
    sb.from("equipe_resultats").select(`defi_id, equipe_id, pour, contre, saisi_le${presents ? ", presents, presents_adverses" : ""}`);
  const [avecBlason, df, avecPresents, bt, feuilles] = await Promise.all([
    lireEquipes(true),
    sb.from("equipe_defis").select("id, de, a, jour, heure, lieu, statut, forfait_de").in("statut", ["accepte", "forfait"]),
    lireSaisies(true),
    sb
      .from("equipe_resultat_joueurs")
      .select("defi_id, equipe_id, joueur, buts, passes, p:profiles!equipe_resultat_joueurs_joueur_fkey(name)"),
    lireFeuilles(),
  ]);
  const eq = sansColonne(avecBlason.error) ? await lireEquipes(false) : avecBlason;
  if (eq.error) throw eq.error;
  if (df.error) throw df.error;
  const rs = sansColonne(avecPresents.error) ? await lireSaisies(false) : avecPresents;
  // Sans la migration (une préversion), pas encore de feuilles : le championnat reste vide.
  const saisies = rs.error
    ? []
    : ((rs.data ?? []) as unknown as {
        defi_id: number;
        equipe_id: number;
        pour: number;
        contre: number;
        saisi_le: string;
        presents?: Presents | null;
        presents_adverses?: Presents | null;
      }[]);
  const buteurs = bt.error
    ? []
    : ((bt.data ?? []) as unknown as { defi_id: number; equipe_id: number; joueur: string; buts: number; passes: number; p: Un<{ name: string }> }[]);
  const equipes = ((eq.data ?? []) as unknown as {
    id: number;
    nom: string;
    initiales: string;
    fond: Fond;
    ville: string | null;
    blason?: unknown;
    created_at: string;
    dissoute_le: string | null;
    equipe_membres: { statut: Membre["statut"]; role: Role }[];
  }[]).map(
    (r): EquipeTeam => ({
      id: r.id,
      nom: r.nom,
      initiales: r.initiales,
      fond: r.fond,
      ville: r.ville,
      blason: lireBlason(r.blason),
      creeLe: r.created_at,
      dissoute: !!r.dissoute_le,
      // Les joueurs seuls : l'entraîneur ne fait pas une équipe active.
      active: !r.dissoute_le && r.equipe_membres.filter((m) => m.statut === "membre" && joue(m.role)).length >= MIN_EQUIPE,
    })
  );
  const matchs = ((df.data ?? []) as { id: number; de: number; a: number; jour: string; heure: string; lieu: string; statut: "accepte" | "forfait"; forfait_de: number | null }[]).map(
    (d): MatchTeam => ({
      id: d.id,
      de: d.de,
      a: d.a,
      jour: d.jour,
      heure: d.heure.slice(0, 5),
      lieu: d.lieu,
      statut: d.statut,
      forfaitDe: d.forfait_de,
      saisies: saisies
        .filter((s) => s.defi_id === d.id)
        .map(
          (s): SaisieTeam => ({
            equipe: s.equipe_id,
            pour: s.pour,
            contre: s.contre,
            le: s.saisi_le,
            ...(s.presents ? { presents: s.presents } : {}),
            ...(s.presents_adverses ? { presentsAdverses: s.presents_adverses } : {}),
          })
        ),
      buteurs: buteurs
        .filter((b) => b.defi_id === d.id)
        .map((b): ButeurTeam => ({ equipe: b.equipe_id, joueur: b.joueur, name: un(b.p)?.name ?? "?", buts: b.buts, passes: b.passes })),
      ...(feuilles.has(d.id) ? { feuilles: feuilles.get(d.id) } : {}),
    })
  );
  return { equipes, matchs };
}

/** Une équipe vue du championnat : de quoi la classer et la dessiner. */
export interface EquipeTeam extends EquipeChampionnat {
  initiales: string;
  fond: Fond;
  ville: string | null;
  blason: Blason | null;
  dissoute: boolean;
}

/** Prévenir l'autre capitaine qu'une feuille l'attend (une notification perdue ne bloque rien). */
async function notifierResultat(defi: number): Promise<void> {
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) return;
    await fetch("/api/equipes/notifier", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ type: "resultat", defi }),
      keepalive: true,
    });
  } catch {}
}

export interface InfoLien {
  id: number;
  nom: string;
  initiales: string;
  fond: Fond;
  blason?: Blason | null;
  ville: string | null;
  membres: number;
  capitaine: string | null;
}

/** Ce que montre la page du lien, même sans compte. */
export async function lireLien(j: string): Promise<InfoLien | null> {
  const { data, error } = await supabase().rpc("equipe_lien_info", { j });
  if (error) throw error;
  const info = (data as (InfoLien & { blason?: unknown }) | null) ?? null;
  return info ? { ...info, blason: lireBlason(info.blason) } : null;
}

export function urlDuLien(j: string): string {
  const base = (process.env.NEXT_PUBLIC_ADRESSE || window.location.origin).replace(/\/+$/, "");
  return `${base}/equipe/${j}`;
}

/**
 * « L'essentiel en 8 points » du Règlement Team (docs/gameplay/11), au-dessus
 * de la case à cocher. Version 2 (24/10) : la victoire passe à 2 points,
 * la saison à 4 mois, avec ses montées et ses descentes ; et un neuvième
 * point, la couverture de la page de l'équipe faite avec les photos de
 * carte (Sabri, 24/10 : « une couverture faite justement en IA, avec les
 * joueurs présents de cette équipe ») : signer, c'est l'accepter. Version 3
 * (03/11/2026, Ilyes : 7 joueurs + 1 entraîneur) : les points 1, 2 et 8 ne
 * parlent plus de « membres » mais de joueurs, et de l'entraîneur ; le
 * point 5 dit le 5 contre 4 tel que la feuille l'applique (championnat-team.ts,
 * scoreFinal), sans le check-in ni les Points Perso, qui n'existent pas encore.
 */
export const REGLEMENT = [
  "Vous ne jouez qu'avec les joueurs de votre équipe. Aucun joueur extérieur, même en match amical.",
  "Une équipe compte 5 à 7 joueurs, et un entraîneur si elle le veut, tous signataires de ce règlement. À 7 joueurs, plus aucun joueur ne peut entrer. L'entraîneur ne joue jamais pour l'équipe.",
  "Une victoire rapporte 2 points à l'équipe, un nul 1, une défaite 0. Ces points vont à l'équipe, pas au joueur. Le championnat dure 4 mois ; à la fin, les 3 premiers de chaque division montent, les 3 derniers descendent.",
  "Vous gagnez des Points Perso par votre présence, vos buts, vos passes décisives et les distinctions votées après le match : Meilleur Joueur +1, Meilleur Défenseur +1, MVP +2.",
  "Avec le score, chaque capitaine déclare les présents des deux équipes. À 4 face à 5 ou plus : votre équipe perd 1 but au score final, ou l'adversaire en gagne 1 si elle n'a pas marqué. Deux équipes à 4 : le match est un amical. À 3 ou moins : forfait, 0 – 3.",
  "Si 6 joueurs ou plus signalent un match, il est annulé avec ses statistiques.",
  "Au-delà de 2 rencontres contre la même équipe dans la saison, le match est amical : ni points ni stats comptabilisés.",
  "Si vous quittez l'équipe, joueur ou entraîneur, vous ne pourrez plus jamais y revenir.",
  "La photo de votre carte peut figurer sur la couverture de la page de l'équipe, que le capitaine ou son vice crée avec le studio de Bola. Si un joueur quitte l'équipe, la couverture est retirée.",
];

/**
 * La Charte de déontologie de Bola Team (Sabri, 24/10 : « faire un règlement
 * déontologique aussi, qu'ils doivent signer »), d'après les articles 14 et
 * 15 du Règlement Team : ce qu'on promet sur le terrain et autour. Elle se
 * signe avec le Règlement, par la même case (version 2). Version 3 : le point
 * 5 tient pour tous, l'entraîneur compris, qui ne saisit rien (« les scores
 * saisis pour mon équipe sont les vrais »).
 */
export const CHARTE = [
  "Je respecte mes coéquipiers, mes adversaires, le terrain et le personnel du complexe.",
  "Aucune insulte, aucune menace, aucun propos sur l'origine, la religion, le genre, l'orientation ou le handicap de quelqu'un.",
  "Aucune violence. Pas de tacle glissé. Un geste violent, c'est la suspension, et l'exclusion s'il se répète.",
  "Pas d'arbitre : les capitaines tranchent sur le terrain, de bonne foi. Je reconnais mes fautes.",
  "Les scores, les buteurs et les passeurs saisis pour mon équipe sont les vrais. Aucune entente sur un résultat, aucun match arrangé.",
  "J'arrive à l'heure. Si je ne peux pas venir, je préviens mon équipe le plus tôt possible.",
  "Dans la discussion, sur le nom et sur l'écusson de l'équipe : rien d'injurieux ni de déplacé.",
  "Un manquement peut valoir un avertissement, le gel des points du match, une suspension ou l'exclusion de Bola Team.",
];

/** La case à cocher (Formule d'acceptation, docs/gameplay/11). */
export const ACCEPTATION =
  "J'ai lu et j'accepte le Règlement Team et la Charte de déontologie (version 3). Je m'engage à ne jouer qu'avec les joueurs de mon équipe, matchs amicaux compris, à faire mon check-in à chaque match où je suis inscrit, à saisir et à voter honnêtement, et à respecter mes adversaires, mes coéquipiers et le terrain. J'accepte que la photo de ma carte figure sur la couverture de l'équipe. Je sais que si je quitte cette équipe, je ne pourrai plus jamais la réintégrer.";

/** La case de l'entraîneur, qui ne joue jamais pour l'équipe ni ne saisit son score. */
export const acceptationEntraineur = (equipe: string) =>
  `J'ai lu et j'accepte le Règlement Team et la Charte de déontologie (version 3). Entraîneur de ${equipe}, je ne joue jamais pour elle en match Team, matchs amicaux compris. Je ne saisis ni le score ni les buteurs, et je respecte les joueurs, les adversaires et le terrain. Je sais que si je quitte cette équipe, je ne pourrai plus jamais la réintégrer.`;

/** « Règlement Team v2 signé le 04/02/2027 à 21:17 (heure de Paris). Bienvenue chez … ! » */
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
  if (/equipe_membres_un_entraineur/i.test(msg)) return "L'équipe a déjà un entraîneur.";
  if (/duplicate|23505/i.test(msg)) return "Déjà dans l'équipe.";
  if (/does not exist|42P01|PGRST20/i.test(msg)) return "Le mode Team arrive avec la mise en ligne.";
  return msg || "Impossible pour l'instant. Réessaie dans un instant.";
}
