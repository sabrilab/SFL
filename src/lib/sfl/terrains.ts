// Les terrains où l'on peut ouvrir un match : ceux du même genre que
// l'hippodrome de Marcq (foot en gazon synthétique, en plein air). D'abord
// dans le Nord (Sabri, 23/10), puis dans toute la France, en Belgique, aux
// Pays-Bas, au Luxembourg, en Allemagne, en Suisse, en Italie, en Espagne,
// au Royaume-Uni et au Maghreb (Sabri, 26/10 : « la France, la Belgique, la
// Hollande, l'Allemagne, l'Italie, l'Angleterre, l'Espagne, la Suisse […]
// même le Maghreb »).
//
// Le catalogue est fait de fichiers statiques, tirés par tools/terrains.ts
// (le tri et ses raisons y sont) : la France du Recensement des équipements
// sportifs (Licence Ouverte 2.0), le reste d'OpenStreetMap (ODbL). Il est
// coupé en cases d'un degré sur un degré (public/terrains/c/50_3.json :
// de 50° à 51° de latitude, de 3° à 4° de longitude) ; un index
// (public/terrains/index.json) dit combien chaque case en a, quelles
// communes elle couvre, et cite les sources. On ne lit que les cases dont
// on a besoin : autour de soi, ce que la Map montre, la ville qu'on cherche,
// le terrain qu'un lien désigne (son id commence par sa case). Les cases
// lues restent en mémoire ; useTerrainsRecenses() se redessine à chaque
// case qui arrive.
//
// Un complexe = une ligne : son nom, sa commune, son adresse, son point, et
// ses terrains par format (à 3, à 5, à 7, à 8, à 11). Les terrains de la
// ligue s'y ajoutent à leur nom (avecLaLigue) : le complexe recensé au même
// endroit s'efface derrière eux.
//
// Le format se filtre (Sabri, 24/10 : « nous, on fait actuellement du foot
// à 5, mais des fois, t'as mis des terrains qui sont pour du foot à plus que
// ça […] qu'on puisse filtrer facilement ») : sur la Map comme dans la
// feuille « Terrains », un format choisi ne garde que les complexes qui ont
// au moins un terrain à ce format (aFormat ; le choix est gardé par
// hooks/use-format-terrain.ts).

import { useSyncExternalStore } from "react";
import type { Terrain } from "@/lib/sfl/saisie/types";

export interface TerrainRecense {
  /** Sa case, puis son id à la source : « 50_3:I593780006 », « 52_4:w123456 ». */
  id: string;
  nom: string;
  commune: string;
  /** La rue, le code postal et la commune ; la commune seule quand la source n'en dit pas plus. */
  adresse: string;
  lat: number;
  lng: number;
  /** Ses terrains, du plus grand au plus petit : joueurs par équipe (3, 5, 7, 8, 11), 0 si on ne sait pas. */
  formats: number[];
  /** Au moins un terrain éclairé : on y joue le soir. */
  eclaire: boolean;
  /** Au moins un terrain en accès libre : on y va sans réserver. */
  libre: boolean;
  /** Le pays, en deux lettres (« FR », « BE », « MA ») : il dit la source. */
  pays: string;
}

/** Une source du catalogue, citée là où ses terrains se montrent. */
export interface SourceTerrains {
  /** Les pays qu'elle couvre. */
  pays: string[];
  nom: string;
  licence: string;
  /** Le jour du tirage, AAAA-MM-JJ. */
  date: string;
}

export interface IndexTerrains {
  sources: SourceTerrains[];
  /** Par case (« 50_3 ») : son nombre de complexes, puis les communes qu'elle couvre. */
  cases: Record<string, [number, ...string[]]>;
}

type Point = { lat: number; lng: number };

/* ─────────────────────────── Les cases, lues à la demande ─────────────────────────── */

/** La case d'un point : « 50_3 », « 40_-4 ». */
export function caseDe(p: Point): string {
  return `${Math.floor(p.lat)}_${Math.floor(p.lng)}`;
}

/** La case d'un terrain d'après son id (« 50_3:I593780006 » → « 50_3 »). */
export function caseDeId(id: string): string | null {
  const m = id.match(/^(-?\d+_-?\d+):/);
  return m ? m[1] : null;
}

let index: Promise<IndexTerrains> | null = null;
let indexLu: IndexTerrains | null = null;
const lues = new Map<string, TerrainRecense[]>();
const enCours = new Map<string, Promise<void>>();
let tous: TerrainRecense[] = [];
let erreur = false;
const abonnes = new Set<() => void>();

function prevenir() {
  tous = [...lues.values()].flat();
  etat = { index: indexLu, terrains: tous, erreur };
  abonnes.forEach((f) => f());
}

/** L'index, lu une fois. */
export function lireIndexTerrains(): Promise<IndexTerrains> {
  index ??= fetch("/terrains/index.json")
    .then((r) => {
      if (!r.ok) throw new Error(`terrains ${r.status}`);
      return r.json() as Promise<IndexTerrains>;
    })
    .then((i) => {
      indexLu = i;
      erreur = false;
      prevenir();
      return i;
    })
    .catch((e) => {
      index = null;
      erreur = true;
      prevenir();
      throw e;
    });
  return index;
}

/** Lire des cases (celles que l'index connaît) ; celles déjà lues ne repartent pas. */
export async function lireCases(cles: string[]): Promise<void> {
  const i = await lireIndexTerrains();
  await Promise.all(
    cles
      .filter((c) => i.cases[c] && !lues.has(c))
      .map((c) => {
        let p = enCours.get(c);
        if (!p) {
          p = fetch(`/terrains/c/${c}.json`)
            .then((r) => {
              if (!r.ok) throw new Error(`terrains ${c} ${r.status}`);
              return r.json() as Promise<TerrainRecense[]>;
            })
            .then((t) => {
              lues.set(c, t);
              prevenir();
            })
            .catch(() => {})
            .finally(() => enCours.delete(c));
          enCours.set(c, p);
        }
        return p;
      })
  );
}

/** Les cases d'un rectangle (ouest, sud, est, nord) ; au-delà de `max`, aucune (on voit trop large pour tout lire). */
export function casesDu(o: number, s: number, e: number, n: number, max = 16): string[] {
  const cles: string[] = [];
  for (let la = Math.floor(s); la <= Math.floor(n); la++) for (let lo = Math.floor(o); lo <= Math.floor(e); lo++) cles.push(`${la}_${lo}`);
  return cles.length > max ? [] : cles;
}

/** Lire les terrains à moins de `rayon` km d'un point. */
export function lireAutour(p: Point, rayon = 45): Promise<void> {
  const dLat = rayon / 111;
  const dLng = rayon / (111 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
  return lireCases(casesDu(p.lng - dLng, p.lat - dLat, p.lng + dLng, p.lat + dLat));
}

/** Lire ce qu'une vue montre (la Map, le plan de la feuille). */
export function lireVue(o: number, s: number, e: number, n: number): Promise<void> {
  return lireCases(casesDu(o, s, e, n));
}

/** Lire la case d'un terrain désigné par son id (un lien « Défier une équipe ici »). */
export function lireTerrain(id: string): Promise<void> {
  const c = caseDeId(id);
  return c ? lireCases([c]) : Promise.resolve();
}

/** Lire les cases des communes qui répondent à une recherche (« Bruxelles », « Casa »), douze au plus. */
export async function lireCommunes(q: string): Promise<void> {
  const mots = sansAccents(q).split(" ").filter((m) => m.length >= 3);
  if (!mots.length) return;
  const i = await lireIndexTerrains();
  const tout = mots.join(" ");
  // « Berlin » : Berlin d'abord, puis les communes dont un mot commence par lui ; jamais Oberlindach ni Überlingen.
  const rang = (communes: string[]) => {
    let r = 0;
    for (const c of communes) {
      const n = sansAccents(c);
      if (n === tout) return 2;
      if (mots.every((m) => debutDeMot(n, m))) r = 1;
    }
    return r;
  };
  const cles = Object.entries(i.cases)
    .map(([c, [, ...communes]]) => [c, rang(communes)] as const)
    .filter(([, r]) => r > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c)
    .slice(0, 12);
  await lireCases(cles);
}

let etat: { index: IndexTerrains | null; terrains: TerrainRecense[]; erreur: boolean } = { index: null, terrains: [], erreur: false };
const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => abonnes.delete(f);
};
const AUCUN = { index: null, terrains: [] as TerrainRecense[], erreur: false };

/** Les terrains lus jusqu'ici (toutes cases confondues), l'index s'il est lu, et s'il n'a pas pu l'être. */
export function useTerrainsRecenses() {
  return useSyncExternalStore(
    abonner,
    () => etat,
    () => AUCUN
  );
}

/** Les sources des pays présents, « source · licence · date », pour le pied d'une liste ou d'une fiche. */
export function sourcesCitees(i: IndexTerrains | null, terrains: Pick<TerrainRecense, "pays">[]): string[] {
  if (!i) return [];
  const pays = new Set(terrains.map((t) => t.pays));
  const dateCourte = (iso: string) => iso.split("-").reverse().join("/");
  return i.sources.filter((s) => s.pays.some((p) => pays.has(p))).map((s) => `${s.nom} · ${s.licence} · ${dateCourte(s.date)}`);
}

/* ──────────────────────────────── La ligue, les formats ──────────────────────────────── */

/** Un terrain proposé : du recensement, ou de la ligue. */
export interface TerrainPropose extends TerrainRecense {
  /** Un terrain de la ligue (saison.terrains) : le choisir, c'est choisir celui-là. */
  ligue?: number;
}

/** Assez près pour être le même complexe. */
const MEME_COMPLEXE_KM = 0.25;

/** Les formats qu'on choisit, en joueurs par équipe (Sabri, 24/10 : « 11 5 8 7 3 versus »). */
export const FORMATS = [3, 5, 7, 8, 11] as const;

/** La ligue joue à cinq contre cinq : ses terrains sont à 5, quoi que porte le complexe recensé à côté. */
const FORMAT_LIGUE = 5;

/**
 * Les terrains de la ligue, en tête, à leur nom (« Croix ») ; le complexe
 * recensé au même endroit s'efface derrière eux et leur laisse ses formats
 * et son éclairage. Ils sont à 5 dans tous les cas : l'hippodrome n'est pas
 * au recensement, et le filtre « à 5 » ne doit jamais le cacher.
 */
export function avecLaLigue(recenses: TerrainRecense[], ligue: Terrain[]): TerrainPropose[] {
  const repris = new Set<string>();
  const siens: TerrainPropose[] = [];
  for (const t of ligue) {
    if (!Number.isFinite(t.lat) || !Number.isFinite(t.lng)) continue;
    const memes = recenses.filter((c) => km(c, t) < MEME_COMPLEXE_KM);
    for (const c of memes) repris.add(c.id);
    const formats = memes.flatMap((c) => c.formats);
    if (!formats.includes(FORMAT_LIGUE)) formats.push(FORMAT_LIGUE);
    siens.push({
      id: `ligue-${t.id}`,
      nom: t.nom,
      commune: t.commune ?? communeDeLAdresse(t.adresse) ?? memes[0]?.commune ?? "",
      adresse: t.adresse,
      lat: t.lat,
      lng: t.lng,
      formats: formats.sort((a, b) => b - a),
      eclaire: memes.some((c) => c.eclaire),
      libre: memes.some((c) => c.libre),
      pays: "FR",
      ligue: t.id,
    });
  }
  return [...siens, ...recenses.filter((c) => !repris.has(c.id))];
}

/** Les complexes qui ont au moins un terrain à ce format ; sans format choisi, tous. */
export function aFormat<T extends Pick<TerrainRecense, "formats">>(terrains: T[], format: number | null): T[] {
  return format == null ? terrains : terrains.filter((t) => t.formats.includes(format));
}

/* ──────────────────────────────── Les mots ──────────────────────────────── */

/** Distance entre deux points, en km (haversine). */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const d = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(d));
}

/** « 1,2 km », « 800 m », « 34 km ». */
export function distanceLisible(d: number): string {
  if (d < 1) return `${Math.max(100, Math.round(d * 10) * 100)} m`;
  if (d < 10) return `${d.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(d)} km`;
}

/** Sans accents ni capitales, pour chercher (« marcq-en-barœul » → « marcq en baroeul », « Düsseldorf » → « dusseldorf »). */
export function sansAccents(s: string): string {
  return s
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Un mot du texte commence par `m` (les deux déjà passés par sansAccents) : « berlin » trouve Berlin, pas Oberlindach. */
function debutDeMot(texte: string, m: string): boolean {
  return ` ${texte}`.includes(` ${m}`);
}

/** Les complexes dont le nom, la commune ou l'adresse ont un mot qui commence par chaque mot cherché. */
export function chercherTerrains<T extends TerrainRecense>(terrains: T[], q: string): T[] {
  const mots = sansAccents(q).split(" ").filter(Boolean);
  if (!mots.length) return terrains;
  return terrains.filter((t) => {
    const texte = sansAccents(`${t.nom} ${t.commune} ${t.adresse}`);
    return mots.every((m) => debutDeMot(texte, m));
  });
}

/** Les formats d'un complexe, du plus grand au plus petit : « à 11 », « à 5 ×4 ». */
export function formatsLisibles(formats: number[]): string[] {
  const n = new Map<number, number>();
  for (const f of formats) if (f > 0) n.set(f, (n.get(f) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[0] - a[0]).map(([f, k]) => (k > 1 ? `à ${f} ×${k}` : `à ${f}`));
}

/** Ce qu'il y a sur place : « à 8 · à 5 ×4 · éclairé · accès libre » (en capitales sous `.mono-label`). */
export function surPlace(t: Pick<TerrainRecense, "formats" | "eclaire" | "libre">): string {
  return [...formatsLisibles(t.formats), t.eclaire && "éclairé", t.libre && "accès libre"].filter(Boolean).join(" · ");
}

/** Un nom qui ne dit pas où l'on est (« Complexe sportif », « Stade municipal », « Terrain synthétique »). */
const GENERIQUE =
  /^(complexe|stade|stades|terrain|terrains|espace|plaine|parc des sports)( (sportif|sportive|municipal|synthétique|synthétiques|de football|de foot|de proximité|multisports|des sports))*$/i;

/** Le lieu du match tel qu'il s'affiche partout : le nom, et la commune quand le nom ne la dit pas. */
export function lieuDuTerrain(t: Pick<TerrainRecense, "nom" | "commune">): string {
  const nom = t.nom.trim();
  if ((GENERIQUE.test(nom) || nom.length < 6) && t.commune) return `${nom}, ${t.commune}`.slice(0, 120);
  return nom.slice(0, 120);
}

/** La commune d'une adresse « …, 59700 Marcq-en-Barœul » (celles du catalogue et des terrains de la ligue). */
export function communeDeLAdresse(adresse: string | null | undefined): string | undefined {
  const m = adresse?.match(/\b\d{4,5}\s+([^,\d][^,]*)$/);
  return m ? m[1].trim() : undefined;
}
