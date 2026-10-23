"use client";

// D'où vient chaque joueur — la ville qu'il a choisie, partagée par la ligue.
//
// Les joueurs sur la Map (Sabri, 22/10, « en poursuivant l'idée de remplacer
// Snapchat ») : chacun apparaît dans SA ville, jamais à sa position. La ville
// est posée par le joueur lui-même (profiles.ville, avec le centre de la
// commune que donne le géocodeur, jamais un point à lui), et il peut se
// rendre invisible (profiles.ville_cachee), comme le mode fantôme de la
// Snap Map. Le joueur qui n'a rien donné reçoit d'office la ville que devine
// sa connexion (poserVilleDevinee, choix de Sabri du 22/10) ; il la corrige
// ou la masque dans le catalogue. Comme les identités (identites.ts), la liste est relue au
// lancement et au retour sur l'app, et gardée en cache.
//
// Une ville devinée n'est qu'une hypothèse : tant que le joueur n'a ni
// choisi ni confirmé la sienne (profiles.ville_le), l'ouverture de l'app la
// lui propose (maVilleAProposer, invitation-ville.tsx ; Sabri, 22/10 :
// « propose à chaque joueur, à sa prochaine connexion, de renseigner sa
// ville »).
//
// Aperçus Vercel et développement : la base n'a pas encore les colonnes, et
// personne n'a encore donné sa ville. Pour que Sabri voie la Map habitée
// avant de publier, les joueurs y reçoivent une ville de démonstration,
// tirée de leur nom (toujours la même), autour de Lille. Jamais en
// production.

import { supabase } from "@/lib/supabase";

const CACHE_KEY = "sfl-villes";
export const VILLES_EVENT = "sfl-villes";

export interface VilleJoueur {
  ville: string;
  lat: number;
  lng: number;
}

/** v : ville ; a, o : latitude, longitude du centre de la commune ; c : invisible. */
type Entree = { v: string; a: number; o: number; c?: boolean };

const hasWindow = () => typeof window !== "undefined" && !!window.localStorage;

let liste: Record<string, Entree> | null = null;
let revision = 0;
/** La liste a-t-elle été relue de la base depuis le lancement ? */
let lue = false;

function lire(): Record<string, Entree> {
  if (liste) return liste;
  liste = {};
  if (hasWindow()) {
    try {
      const brut = window.localStorage.getItem(CACHE_KEY);
      if (brut) liste = JSON.parse(brut) as Record<string, Entree>;
    } catch {}
  }
  return liste;
}

function ecrire(next: Record<string, Entree>) {
  liste = next;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {}
  revision++;
  window.dispatchEvent(new Event(VILLES_EVENT));
}

export function villesRevision(): number {
  lire();
  return revision;
}

/* ─────────────────────────── La démonstration ─────────────────────────── */

/** Les aperçus et le développement, jamais la production. */
export const DEMO_VILLES = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

/** Autour des terrains de la ligue, plus deux joueurs venus de loin. Le poids fait la foule. */
const COMMUNES_DEMO: [string, number, number, number][] = [
  ["Lille", 50.6329, 3.0586, 9],
  ["Roubaix", 50.6901, 3.1817, 6],
  ["Tourcoing", 50.7239, 3.1612, 5],
  ["Villeneuve-d'Ascq", 50.6233, 3.145, 5],
  ["Marcq-en-Barœul", 50.6711, 3.0972, 4],
  ["Croix", 50.6786, 3.155, 3],
  ["Lambersart", 50.65, 3.025, 3],
  ["La Madeleine", 50.655, 3.071, 2],
  ["Wasquehal", 50.67, 3.13, 2],
  ["Mons-en-Barœul", 50.6417, 3.1097, 2],
  ["Wattrelos", 50.701, 3.215, 2],
  ["Loos", 50.61, 3.017, 1],
  ["Valenciennes", 50.357, 3.523, 1],
  ["Paris", 48.8566, 2.3522, 1],
];

function hache(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ (c.codePointAt(0) ?? 0), 16777619) >>> 0;
  return h;
}

function tirer(nom: string, communes: [string, number, number, number][]): VilleJoueur {
  const total = communes.reduce((s, c) => s + c[3], 0);
  let r = hache(nom) % total;
  for (const [ville, lat, lng, poids] of communes) {
    if (r < poids) return { ville, lat, lng };
    r -= poids;
  }
  const [ville, lat, lng] = communes[0];
  return { ville, lat, lng };
}

function villeDemo(nom: string): VilleJoueur {
  return tirer(nom, COMMUNES_DEMO);
}

/** La métropole seule : les communes autour des terrains, sans les venus de loin. */
const COMMUNES_METROPOLE = COMMUNES_DEMO.filter(([v]) => v !== "Paris" && v !== "Valenciennes");

/* ─────────────────────────────── Lecture ─────────────────────────────── */

/** La base a-t-elle au moins une vraie ville ? Sinon, en aperçu, la démonstration. */
export function villesReelles(): boolean {
  return Object.keys(lire()).length > 0;
}

/** La ville d'un joueur sur la Map, ou null (pas donnée, ou invisible). */
export function villeDe(nom: string): VilleJoueur | null {
  const e = lire()[nom];
  if (e) return e.c ? null : { ville: e.v, lat: e.a, lng: e.o };
  return DEMO_VILLES && !villesReelles() ? villeDemo(nom) : null;
}

/**
 * La ville d'un joueur de la ligue sur la Map : la sienne s'il l'a donnée
 * (null s'il s'est rendu invisible), sinon une commune de la métropole
 * tirée de son nom, toujours la même (Sabri, 22/10 : « une localisation
 * différente pour chacun, pour déjà les éparpiller »). Elle s'efface dès
 * qu'il pose la sienne (la notification « Mets ta ville » l'y invite).
 */
export function villeOuLigue(nom: string): VilleJoueur | null {
  const e = lire()[nom];
  if (e) return e.c ? null : { ville: e.v, lat: e.a, lng: e.o };
  if (DEMO_VILLES && !villesReelles()) return villeDemo(nom);
  return tirer(nom, COMMUNES_METROPOLE);
}

/** La ville que le joueur s'est donnée, même invisible (pour sa propre fiche). */
export function maVille(nom: string): (VilleJoueur & { cachee: boolean }) | null {
  const e = lire()[nom];
  if (e) return { ville: e.v, lat: e.a, lng: e.o, cachee: !!e.c };
  if (DEMO_VILLES && !villesReelles()) return { ...villeDemo(nom), cachee: false };
  return null;
}

/**
 * Le joueur a-t-il déjà donné sa ville (même invisible) ? null tant que la
 * base n'a pas été relue : on ne propose rien sur la foi d'un cache vide.
 */
export function villeDonnee(nom: string): boolean | null {
  if (!lue) return null;
  return !!lire()[nom];
}

let enCours: Promise<void> | null = null;

/** Relit les villes de la ligue. */
export function rafraichirVilles(): Promise<void> {
  if (!hasWindow()) return Promise.resolve();
  enCours ??= (async () => {
    try {
      type Ligne = { name: string; ville: string | null; ville_lat: number | null; ville_lng: number | null; ville_cachee: boolean | null };
      const { data, error } = await supabase().from("profiles").select("name, ville, ville_lat, ville_lng, ville_cachee").not("ville", "is", null);
      // Base pas encore migrée (aperçus), ou rien de lisible : on garde le cache.
      if (error || !data) return;
      lue = true;
      const next: Record<string, Entree> = {};
      for (const p of data as Ligne[]) {
        if (!p.ville || p.ville_lat == null || p.ville_lng == null) continue;
        next[p.name] = { v: p.ville, a: p.ville_lat, o: p.ville_lng, ...(p.ville_cachee ? { c: true } : {}) };
      }
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

/** Choisie sur cet appareil, quand la base n'a pas encore ville_le (aperçus). */
const choisieIci = (nom: string) => `bola-ville-choisie-${nom}`;

/**
 * Écrit la ville du joueur connecté. `choisie` : c'est lui qui l'a choisie ou
 * confirmée (profiles.ville_le), et non sa connexion qui l'a devinée.
 */
async function enregistrer(nom: string, v: VilleJoueur | null, cachee: boolean, choisie: boolean): Promise<string | null> {
  try {
    const { data: u } = await supabase().auth.getUser();
    if (!u.user) return "Connecte-toi d'abord.";
    const ligne = { ville: v?.ville ?? null, ville_lat: v?.lat ?? null, ville_lng: v?.lng ?? null, ville_cachee: cachee };
    const maj = (champs: object) => supabase().from("profiles").update(champs).eq("id", u.user.id);
    let { error } = await maj(choisie ? { ...ligne, ville_le: new Date().toISOString() } : ligne);
    // Base pas encore migrée (aperçus) : la ville s'écrit sans sa date, qui
    // reste sur cet appareil.
    if (error && choisie && /ville_le/.test(error.message ?? "")) ({ error } = await maj(ligne));
    if (error) return DEMO_VILLES ? "La ville s'enregistrera une fois la Map des joueurs en ligne." : "La ville ne s'est pas enregistrée. Réessaie.";
    if (choisie) {
      try {
        window.localStorage.setItem(choisieIci(nom), "1");
      } catch {}
    }
    const l = { ...lire() };
    if (v) l[nom] = { v: v.ville, a: v.lat, o: v.lng, ...(cachee ? { c: true } : {}) };
    else delete l[nom];
    ecrire(l);
    return null;
  } catch {
    return "Pas de réseau. Réessaie.";
  }
}

/**
 * Le joueur connecté pose sa ville (ou se rend invisible) : il l'a choisie.
 * La ligne de la base ne s'écrit que pour soi (RLS). Renvoie un message
 * d'erreur, ou null.
 */
export function poserMaVille(nom: string, v: VilleJoueur | null, cachee: boolean): Promise<string | null> {
  return enregistrer(nom, v, cachee, true);
}

/**
 * Faut-il proposer sa ville au joueur connecté, à l'ouverture
 * (invitation-ville.tsx), et laquelle ? Oui tant qu'il ne l'a ni choisie ni
 * confirmée lui-même (profiles.ville_le) et qu'il ne s'est pas rendu
 * invisible. La ville proposée : celle qu'il a déjà sur la Map (devinée),
 * sinon celle que sa connexion laisse deviner maintenant (rien n'est écrit),
 * sinon aucune. null : on ne sait pas (pas de réseau, pas encore membre).
 */
export async function maVilleAProposer(nom: string): Promise<{ proposer: boolean; ville: VilleJoueur | null } | null> {
  if (!hasWindow()) return null;
  try {
    type Ligne = { ville: string | null; ville_lat: number | null; ville_lng: number | null; ville_cachee: boolean | null; ville_le?: string | null };
    let suivi = true;
    let { data, error } = await supabase().from("profiles").select("ville, ville_lat, ville_lng, ville_cachee, ville_le").eq("name", nom).maybeSingle();
    if (error) {
      // Base pas encore migrée (aperçus) : ce que cet appareil sait.
      suivi = false;
      ({ data, error } = await supabase().from("profiles").select("ville, ville_lat, ville_lng, ville_cachee").eq("name", nom).maybeSingle());
    }
    if (error || !data) return null;
    const p = data as Ligne;
    let choisie = !!p.ville_le;
    if (!suivi) {
      try {
        choisie = window.localStorage.getItem(choisieIci(nom)) !== null;
      } catch {}
    }
    if (choisie || p.ville_cachee) return { proposer: false, ville: null };
    if (p.ville && p.ville_lat != null && p.ville_lng != null) return { proposer: true, ville: { ville: p.ville, lat: p.ville_lat, lng: p.ville_lng } };
    try {
      const res = await fetch("/api/ville-devinee", { cache: "no-store" });
      const d = (await res.json()) as { ville: VilleJoueur | null };
      return { proposer: true, ville: d.ville };
    } catch {
      return { proposer: true, ville: null };
    }
  } catch {
    return null;
  }
}

/**
 * Le joueur connecté n'a pas encore de ville : on pose celle que devine sa
 * connexion (/api/ville-devinee), une seule tentative par jour et par
 * appareil quand rien n'est deviné. Elle n'est pas « choisie » : l'ouverture
 * la lui propose ensuite (maVilleAProposer), et il la corrige ou la masque
 * aussi dans le catalogue.
 */
export async function poserVilleDevinee(nom: string): Promise<void> {
  if (!hasWindow() || villeDonnee(nom) !== false) return;
  const cle = `bola-ville-devinee-${nom}`;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  try {
    if (window.localStorage.getItem(cle) === aujourdhui) return;
    window.localStorage.setItem(cle, aujourdhui);
  } catch {}
  try {
    const res = await fetch("/api/ville-devinee", { cache: "no-store" });
    const d = (await res.json()) as { ville: VilleJoueur | null };
    if (!d.ville || villeDonnee(nom) !== false) return;
    await enregistrer(nom, d.ville, false, false);
  } catch {}
}
