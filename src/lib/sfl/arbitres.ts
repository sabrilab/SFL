"use client";

// Les arbitres de la ligue (Sabri, 24/10 : « un nouveau type d'utilisateur
// qui ne serait pas des joueurs, mais des arbitres, avec une carte
// d'arbitre […] et des stats associées : le nombre de matchs arbitrés. […]
// chaque joueur du match puisse mettre une note de satisfaction à
// l'arbitre, et ça apparaît sur sa carte au lieu de son score de joueur »).
//
// En base (supabase/schema.sql) : profiles.arbitre, la table des arbitrages
// (qui arbitre quel match d'une journée) et les notes des joueurs, que l'on
// n'écrit que par noter_arbitre() ; la base y vérifie que l'on a joué le
// match. Chacun ne relit que sa note, la ligue les totaux
// (avis_des_arbitrages) : jamais qui a mis quoi. Rien n'est dans le document
// de la saison, qu'une publication remplace en entier.
//
// La liste des arbitres part dans hidden.ts : un arbitre ne remonte dans
// aucune liste de joueurs. Comme les suivis, tout est relu au lancement et au
// retour sur l'app, et gardé en cache.
//
// Aperçus Vercel et développement : la base n'a pas les tables. Fabio y est
// l'arbitre de démonstration, du premier match de chaque journée,
// avec des notes tirées de son nom (toujours les mêmes) ; ma note reste sur
// l'appareil. Jamais en production.

import { supabase } from "@/lib/supabase";
import { definirArbitres } from "./hidden";
import { idDe, nomDeId, rafraichirComptes } from "./comptes";
import type { Journee } from "./engine";
import { satisfactionDe, type CreneauArbitre, type ReponseArbitre } from "./missions-arbitre";

export const ARBITRES_EVENT = "sfl-arbitres";
export const APERCU_ARBITRES = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";
const CACHE_KEY = "sfl-arbitres";
const CLE_APERCU = "sfl-arbitres-apercu";
/** L'arbitre de démonstration des aperçus. */
const ARBITRE_DEMO = "Fabio";

export interface Arbitrage {
  id: number;
  saison: number;
  j: number;
  /** La place du match dans la journée : 0 pour le Match 1. */
  n: number;
  /** Le nom de saison de l'arbitre. */
  arbitre: string;
  /** Les deux équipes du match, recopiées au moment du choix. */
  equipes: string[];
}

/** Les totaux des notes d'un arbitrage : jamais qui a mis quoi. */
export interface Avis {
  avis: number;
  total: number;
  cinq: number;
}

export interface EtatArbitres {
  arbitres: string[];
  arbitrages: Arbitrage[];
  avis: Record<number, Avis>;
  /** Mes notes, par arbitrage. */
  mesNotes: Record<number, number>;
  /** Ce que chaque arbitre porte sur sa carte (profiles.habillage_arbitre, passe-arbitre.ts). */
  habillages: Record<string, string>;
  /** Mes réponses à mes missions d'arbitre (missions-arbitre.ts). */
  reponses: ReponseArbitre[];
  /** La démonstration des aperçus. */
  demo: boolean;
}

const VIDE: EtatArbitres = { arbitres: [], arbitrages: [], avis: {}, mesNotes: {}, habillages: {}, reponses: [], demo: false };
const CLE_APERCU_MISSIONS = "sfl-arbitres-apercu-missions";
const CLE_APERCU_HABILLAGE = "sfl-arbitres-apercu-habillage";

const hasWindow = () => typeof window !== "undefined" && !!window.localStorage;

let etat: EtatArbitres | null = null;
let revision = 0;

function lire(): EtatArbitres {
  if (etat) return etat;
  etat = VIDE;
  if (hasWindow() && !APERCU_ARBITRES) {
    try {
      const brut = window.localStorage.getItem(CACHE_KEY);
      if (brut) etat = { ...VIDE, ...(JSON.parse(brut) as EtatArbitres) };
    } catch {}
  }
  if (APERCU_ARBITRES)
    etat = {
      ...VIDE,
      arbitres: [ARBITRE_DEMO],
      mesNotes: lireApercu(),
      habillages: lireJsonLocal<Record<string, string>>(CLE_APERCU_HABILLAGE, {}),
      reponses: lireJsonLocal<ReponseArbitre[]>(CLE_APERCU_MISSIONS, []),
      demo: true,
    };
  definirArbitres(etat.arbitres);
  return etat;
}

function ecrire(next: EtatArbitres) {
  etat = next;
  definirArbitres(next.arbitres);
  if (!next.demo) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {}
  }
  revision++;
  window.dispatchEvent(new Event(ARBITRES_EVENT));
}

/** Change à chaque mise à jour. */
export function arbitresRevision(): number {
  lire();
  return revision;
}

/** L'état connu (le cache, tant que la base n'a pas répondu). */
export function etatArbitres(): EtatArbitres {
  return lire();
}

/* ─────────────────────────── La démonstration ─────────────────────────── */

function lireJsonLocal<T>(cle: string, defaut: T): T {
  if (!hasWindow()) return defaut;
  try {
    const brut = window.localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

function ecrireJsonLocal(cle: string, v: unknown) {
  try {
    window.localStorage.setItem(cle, JSON.stringify(v));
  } catch {}
}

const lireApercu = () => lireJsonLocal<Record<number, number>>(CLE_APERCU, {});

function hache(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ (c.codePointAt(0) ?? 0), 16777619) >>> 0;
  return h;
}

/** L'id de démonstration d'un match : la saison, la journée, sa place. */
const idDemo = (saison: number, j: number, n: number) => saison * 100000 + j * 100 + n;

/**
 * Les arbitrages de démonstration : Fabio sur le premier match de chaque
 * journée qui a ses équipes, ses notes et ses réponses aux missions des
 * journées jouées, tirées de son nom.
 */
export function demoArbitrages(
  saison: number,
  journees: Pick<Journee, "j" | "matches">[],
  jouees: ReadonlySet<number> = new Set()
): Pick<EtatArbitres, "arbitrages" | "avis" | "reponses"> {
  const arbitrages: Arbitrage[] = [];
  const avis: Record<number, Avis> = {};
  const reponses: ReponseArbitre[] = [];
  for (const jr of journees) {
    // Ses réponses des journées passées, tirées de son nom (la base garde l'heure : bien avant le match).
    for (const mission of ["sang-froid", "tribune", "unanime"] as CreneauArbitre[]) {
      if (jouees.has(jr.j) && hache(`${ARBITRE_DEMO}:${saison}:${jr.j}:${mission}`) % 4 !== 0)
        reponses.push({ saison, j: jr.j, mission, reponse: "acceptee", le: REPONSE_TIREE });
    }
    (jr.matches ?? []).slice(0, 1).forEach((m, n) => {
      const id = idDemo(saison, jr.j, n);
      arbitrages.push({ id, saison, j: jr.j, n, arbitre: ARBITRE_DEMO, equipes: [m.teamA.name, m.teamB.name] });
      const h = hache(`${ARBITRE_DEMO}:${id}`);
      const nb = 6 + (h % 5);
      const cinq = 2 + ((h >> 4) % 4);
      const quatre = Math.max(0, nb - cinq - 1 - ((h >> 8) % 2));
      const reste = nb - cinq - quatre;
      avis[id] = { avis: nb, total: cinq * 5 + quatre * 4 + reste * 3, cinq };
    });
  }
  return { arbitrages, avis, reponses };
}

/** La saison sur laquelle la démonstration a été posée : une autre saison chargée la repose. */
let amorcee = "";
/** L'heure des réponses de démonstration tirées du nom : bien avant tout coup d'envoi. */
const REPONSE_TIREE = "2000-01-01T00:00:00Z";

/**
 * Pose la démonstration (aperçus) une fois les journées connues, avec mes
 * notes de l'appareil comptées dans les totaux.
 */
export function amorcerDemo(saison: number, journees: Pick<Journee, "j" | "matches">[], jouees: ReadonlySet<number>): void {
  const e = lire();
  const cle = `${saison}:${journees.map((jr) => `${jr.j}.${jr.matches?.length ?? 0}`).join(",")}:${[...jouees].join(",")}`;
  if (!e.demo || amorcee === cle || journees.length === 0) return;
  amorcee = cle;
  const { arbitrages, avis, reponses } = demoArbitrages(saison, journees, jouees);
  for (const [id, note] of Object.entries(e.mesNotes)) {
    const t = avis[Number(id)];
    if (t) avis[Number(id)] = { avis: t.avis + 1, total: t.total + note, cinq: t.cinq + (note === 5 ? 1 : 0) };
  }
  // Mes réponses de l'appareil l'emportent sur celles tirées du nom.
  const miennes = e.reponses.filter((r) => r.le !== REPONSE_TIREE);
  const tirees = reponses.filter((r) => !miennes.some((m) => m.saison === r.saison && m.j === r.j && m.mission === r.mission));
  ecrire({ ...e, arbitrages, avis, reponses: [...tirees, ...miennes] });
}

/* ─────────────────────────────── Lecture ─────────────────────────────── */

let enCours: Promise<void> | null = null;

/** Relit les arbitres, leurs matchs, les totaux et mes notes. */
export function rafraichirArbitres(): Promise<void> {
  if (!hasWindow() || APERCU_ARBITRES) {
    lire();
    return Promise.resolve();
  }
  enCours ??= (async () => {
    try {
      const sb = supabase();
      const [, profils, arbitrages, totaux, miens] = await Promise.all([
        rafraichirComptes(),
        sb.from("profiles").select("id, name, habillage_arbitre").eq("arbitre", true),
        sb.from("arbitrages").select("id, saison, j, n, arbitre_id, equipes"),
        sb.rpc("avis_des_arbitrages"),
        sb.from("avis_arbitre").select("arbitrage_id, note"),
      ]);
      const reponses = await sb.from("missions_arbitre").select("saison, j, mission, reponse, le");
      // Base pas encore migrée, pas encore membre, hors ligne : on garde le cache.
      if (profils.error || arbitrages.error) return;
      const lignes = profils.data as { id: string; name: string; habillage_arbitre: string | null }[];
      const parId = new Map(lignes.map((p) => [p.id, p.name]));
      const next: EtatArbitres = {
        arbitres: [...parId.values()],
        arbitrages: (arbitrages.data as { id: number; saison: number; j: number; n: number; arbitre_id: string; equipes: string[] }[])
          .map((a) => ({
            id: a.id,
            saison: a.saison,
            j: a.j,
            n: a.n,
            arbitre: parId.get(a.arbitre_id) ?? nomDeId(a.arbitre_id) ?? "",
            equipes: a.equipes ?? [],
          }))
          .filter((a) => a.arbitre),
        avis: Object.fromEntries(
          ((totaux.data ?? []) as { arbitrage_id: number; avis: number; total: number; cinq: number }[]).map((t) => [
            t.arbitrage_id,
            { avis: t.avis, total: t.total, cinq: t.cinq },
          ])
        ),
        mesNotes: Object.fromEntries(((miens.data ?? []) as { arbitrage_id: number; note: number }[]).map((m) => [m.arbitrage_id, m.note])),
        habillages: Object.fromEntries(lignes.filter((p) => p.habillage_arbitre).map((p) => [p.name, p.habillage_arbitre!])),
        reponses: (reponses.data ?? []) as ReponseArbitre[],
        demo: false,
      };
      if (JSON.stringify(next) !== JSON.stringify(lire())) ecrire(next);
    } catch {
      // Hors ligne : le cache suffit.
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}

/* ────────────────────────────── Écriture ────────────────────────────── */

/**
 * Je note l'arbitre de mon match, de 1 à 5 : affiché tout de suite, écrit
 * derrière ; la base refuse, on revient en arrière. Renvoie un message
 * d'erreur, ou null.
 */
export async function noterArbitre(arbitrage: number, note: number): Promise<string | null> {
  const avant = lire();
  const mesNotes = { ...avant.mesNotes, [arbitrage]: note };
  const ancienne = avant.mesNotes[arbitrage];
  const t = avant.avis[arbitrage] ?? { avis: 0, total: 0, cinq: 0 };
  const avis = {
    ...avant.avis,
    [arbitrage]: {
      avis: t.avis + (ancienne ? 0 : 1),
      total: t.total - (ancienne ?? 0) + note,
      cinq: t.cinq - (ancienne === 5 ? 1 : 0) + (note === 5 ? 1 : 0),
    },
  };
  ecrire({ ...avant, avis, mesNotes });
  if (avant.demo) {
    try {
      window.localStorage.setItem(CLE_APERCU, JSON.stringify(mesNotes));
    } catch {}
    return null;
  }
  try {
    const { error } = await supabase().rpc("noter_arbitre", { p_arbitrage: arbitrage, p_note: note });
    if (error) throw error;
    return null;
  } catch (e) {
    ecrire(avant);
    const message = (e as { message?: string })?.message ?? "";
    return message.startsWith("Seuls") ? message : "Pas enregistré. Réessaie.";
  }
}

/** L'admin fait d'un compte un arbitre, ou le rend joueur. Renvoie un message d'erreur, ou null. */
export async function poserArbitre(nom: string, arbitre: boolean): Promise<string | null> {
  const avant = lire();
  const arbitres = arbitre ? [...new Set([...avant.arbitres, nom])] : avant.arbitres.filter((n) => n !== nom);
  const next = {
    ...avant,
    arbitres,
    arbitrages: arbitre ? avant.arbitrages : avant.arbitrages.filter((a) => a.arbitre !== nom),
  };
  if (avant.demo) {
    ecrire(next);
    return null;
  }
  const id = idDe(nom);
  if (!id) return "Ce joueur n'a pas encore de compte accepté.";
  ecrire(next);
  try {
    const { error } = await supabase().rpc("poser_arbitre", { p_profil: id, p_arbitre: arbitre });
    if (error) throw error;
    return null;
  } catch {
    ecrire(avant);
    return "Pas enregistré. Réessaie.";
  }
}

/**
 * L'admin désigne l'arbitre d'un match (null : plus d'arbitre). Les équipes
 * du match sont recopiées : la base vérifie avec elles qui peut noter.
 */
export async function designerArbitre(
  saison: number,
  j: number,
  n: number,
  equipes: string[],
  arbitre: string | null,
  /** Le mardi minuit qui suit le match : les notes ferment (missions-arbitre.ts). */
  fermeLe: Date | null = null
): Promise<string | null> {
  const avant = lire();
  const existant = avant.arbitrages.find((a) => a.saison === saison && a.j === j && a.n === n);
  const reste = avant.arbitrages.filter((a) => a !== existant);
  if (avant.demo) {
    ecrire({
      ...avant,
      arbitrages: arbitre ? [...reste, { id: idDemo(saison, j, n), saison, j, n, arbitre, equipes }] : reste,
    });
    return null;
  }
  try {
    const sb = supabase();
    if (!arbitre) {
      if (existant) {
        const { error } = await sb.from("arbitrages").delete().eq("id", existant.id);
        if (error) throw error;
      }
      ecrire({ ...avant, arbitrages: reste });
      return null;
    }
    const id = idDe(arbitre);
    if (!id) return "Cet arbitre n'a pas de compte accepté.";
    const { data, error } = await sb
      .from("arbitrages")
      .upsert({ saison, j, n, arbitre_id: id, equipes, ferme_le: fermeLe?.toISOString() ?? null }, { onConflict: "saison,j,n" })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("arbitrage");
    ecrire({ ...avant, arbitrages: [...reste, { id: (data as { id: number }).id, saison, j, n, arbitre, equipes }] });
    return null;
  } catch {
    return "Pas enregistré. Réessaie.";
  }
}

/**
 * L'arbitre accepte ou passe une de ses missions : affiché tout de suite,
 * écrit derrière ; la base garde l'heure (repondre_mission_arbitre).
 */
export async function repondreMissionArbitre(
  saison: number,
  j: number,
  mission: CreneauArbitre,
  reponse: ReponseArbitre["reponse"]
): Promise<string | null> {
  const avant = lire();
  const r: ReponseArbitre = { saison, j, mission, reponse, le: new Date().toISOString() };
  const reponses = [...avant.reponses.filter((x) => !(x.saison === saison && x.j === j && x.mission === mission)), r];
  ecrire({ ...avant, reponses });
  if (avant.demo) {
    ecrireJsonLocal(CLE_APERCU_MISSIONS, reponses.filter((x) => x.le !== REPONSE_TIREE));
    return null;
  }
  try {
    const { data, error } = await supabase().rpc("repondre_mission_arbitre", {
      p_saison: saison,
      p_j: j,
      p_mission: mission,
      p_reponse: reponse,
    });
    if (error) throw error;
    // L'heure de la base, pas celle du téléphone.
    if (typeof data === "string") ecrire({ ...lire(), reponses: reponses.map((x) => (x === r ? { ...r, le: data } : x)) });
    return null;
  } catch (e) {
    ecrire(avant);
    const message = (e as { message?: string })?.message ?? "";
    return /^(Trop tard|Réservé)/.test(message) ? message : "Pas enregistré. Réessaie.";
  }
}

/** L'arbitre choisit ce qu'il porte sur sa carte (passe-arbitre.ts, « finition/signes/grade »). */
export async function choisirHabillageArbitre(nom: string, brut: string): Promise<string | null> {
  const avant = lire();
  ecrire({ ...avant, habillages: { ...avant.habillages, [nom]: brut } });
  if (avant.demo) {
    ecrireJsonLocal(CLE_APERCU_HABILLAGE, { ...avant.habillages, [nom]: brut });
    return null;
  }
  const id = idDe(nom);
  try {
    if (!id) throw new Error("compte");
    const { error } = await supabase().from("profiles").update({ habillage_arbitre: brut }).eq("id", id);
    if (error) throw error;
    return null;
  } catch {
    ecrire(avant);
    return "Pas enregistré. Réessaie.";
  }
}

/* ─────────────────────────────── La carte ─────────────────────────────── */

export interface StatsArbitre {
  /** Les matchs arbitrés : ceux des journées déjà jouées. */
  matchs: number;
  /** Les notes reçues. */
  avis: number;
  /** La satisfaction, de 0 à 99 (la moyenne des notes sur 5, ×20) ; null sans note. */
  satisfaction: number | null;
  /** La part de 5 sur 5, en %. */
  top: number | null;
  /** La satisfaction de son dernier match noté. */
  dernier: number | null;
  /** Ses matchs, du plus récent au plus ancien. */
  liste: (Arbitrage & { joue: boolean; totaux: Avis | null })[];
}

/** La satisfaction d'une moyenne sur 5 (missions-arbitre.ts). */
export { satisfactionDe };

/**
 * Les chiffres de la carte d'un arbitre. `jouee(saison, j)` : la journée
 * a-t-elle été jouée (ses résultats saisis) ?
 */
export function statsArbitre(
  nom: string,
  e: Pick<EtatArbitres, "arbitrages" | "avis">,
  jouee: (saison: number, j: number) => boolean
): StatsArbitre {
  const liste = e.arbitrages
    .filter((a) => a.arbitre === nom)
    .map((a) => ({ ...a, joue: jouee(a.saison, a.j), totaux: e.avis[a.id] ?? null }))
    .sort((a, b) => b.saison - a.saison || b.j - a.j || b.n - a.n);
  const joues = liste.filter((a) => a.joue);
  const somme = joues.reduce<Avis>(
    (s, a) => ({ avis: s.avis + (a.totaux?.avis ?? 0), total: s.total + (a.totaux?.total ?? 0), cinq: s.cinq + (a.totaux?.cinq ?? 0) }),
    { avis: 0, total: 0, cinq: 0 }
  );
  const dernierNote = joues.find((a) => (a.totaux?.avis ?? 0) > 0);
  return {
    matchs: joues.length,
    avis: somme.avis,
    satisfaction: satisfactionDe(somme),
    top: somme.avis > 0 ? Math.round((somme.cinq / somme.avis) * 100) : null,
    dernier: satisfactionDe(dernierNote?.totaux),
    liste,
  };
}
