// Les terrains où l'on peut ouvrir un match : ceux du même genre que
// l'hippodrome de Marcq (foot en gazon synthétique, en plein air), dans tout
// le Nord (Sabri, 23/10). Le catalogue est un fichier statique,
// public/terrains/nord.json, tiré du Recensement des équipements sportifs
// par tools/terrains-nord.ts (le tri et ses raisons y sont) ; on le lit à la
// première ouverture de la liste, puis il reste en mémoire.
//
// Un complexe = une ligne : son nom, sa commune, son adresse, son point, et
// ses terrains par format (à 5, à 8, à 11). Les terrains de la ligue s'y
// ajoutent à leur nom (avecLaLigue) : le complexe recensé au même endroit
// s'efface derrière eux.

import type { Terrain } from "@/lib/sfl/saisie/types";

export interface TerrainNord {
  /** L'installation au recensement (« I593780006 »). */
  id: string;
  nom: string;
  commune: string;
  /** La rue, le code postal et la commune. */
  adresse: string;
  lat: number;
  lng: number;
  /** Ses terrains, du plus grand au plus petit : joueurs par équipe (5, 8, 11), 0 si on ne sait pas. */
  formats: number[];
  /** Au moins un terrain éclairé : on y joue le soir. */
  eclaire: boolean;
  /** Au moins un terrain en accès libre : on y va sans réserver. */
  libre: boolean;
}

export interface CatalogueTerrains {
  source: string;
  licence: string;
  /** Le jour du tirage, AAAA-MM-JJ. */
  date: string;
  terrains: TerrainNord[];
}

let catalogue: Promise<CatalogueTerrains> | null = null;
let lu: CatalogueTerrains | null = null;

/** Le catalogue, lu une fois. */
export function lireTerrainsNord(): Promise<CatalogueTerrains> {
  catalogue ??= fetch("/terrains/nord.json")
    .then((r) => {
      if (!r.ok) throw new Error(`terrains ${r.status}`);
      return r.json() as Promise<CatalogueTerrains>;
    })
    .then((c) => (lu = c))
    .catch((e) => {
      catalogue = null;
      throw e;
    });
  return catalogue;
}

/** Le catalogue s'il est déjà lu : la liste rouverte s'affiche d'un coup. */
export function terrainsNordLus(): CatalogueTerrains | null {
  return lu;
}

/** Un terrain proposé : du recensement, ou de la ligue. */
export interface TerrainPropose extends TerrainNord {
  /** Un terrain de la ligue (saison.terrains) : le choisir, c'est choisir celui-là. */
  ligue?: number;
}

/** Assez près pour être le même complexe. */
const MEME_COMPLEXE_KM = 0.25;

/**
 * Les terrains de la ligue, en tête, à leur nom (« Croix ») ; le complexe
 * recensé au même endroit s'efface derrière eux et leur laisse ses formats
 * et son éclairage.
 */
export function avecLaLigue(recenses: TerrainNord[], ligue: Terrain[]): TerrainPropose[] {
  const repris = new Set<string>();
  const siens: TerrainPropose[] = [];
  for (const t of ligue) {
    if (!Number.isFinite(t.lat) || !Number.isFinite(t.lng)) continue;
    const memes = recenses.filter((c) => km(c, t) < MEME_COMPLEXE_KM);
    for (const c of memes) repris.add(c.id);
    siens.push({
      id: `ligue-${t.id}`,
      nom: t.nom,
      commune: t.commune ?? communeDeLAdresse(t.adresse) ?? memes[0]?.commune ?? "",
      adresse: t.adresse,
      lat: t.lat,
      lng: t.lng,
      formats: memes.flatMap((c) => c.formats).sort((a, b) => b - a),
      eclaire: memes.some((c) => c.eclaire),
      libre: memes.some((c) => c.libre),
      ligue: t.id,
    });
  }
  return [...siens, ...recenses.filter((c) => !repris.has(c.id))];
}

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

/** Sans accents ni capitales, pour chercher (« marcq-en-barœul » → « marcq en baroeul »). */
export function sansAccents(s: string): string {
  return s
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Les complexes dont le nom, la commune ou l'adresse contiennent chaque mot cherché. */
export function chercherTerrains<T extends TerrainNord>(terrains: T[], q: string): T[] {
  const mots = sansAccents(q).split(" ").filter(Boolean);
  if (!mots.length) return terrains;
  return terrains.filter((t) => {
    const texte = sansAccents(`${t.nom} ${t.commune} ${t.adresse}`);
    return mots.every((m) => texte.includes(m));
  });
}

/** Les formats d'un complexe, du plus grand au plus petit : « à 11 », « à 5 ×4 ». */
export function formatsLisibles(formats: number[]): string[] {
  const n = new Map<number, number>();
  for (const f of formats) if (f > 0) n.set(f, (n.get(f) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[0] - a[0]).map(([f, k]) => (k > 1 ? `à ${f} ×${k}` : `à ${f}`));
}

/** Ce qu'il y a sur place : « à 8 · à 5 ×4 · éclairé · accès libre » (en capitales sous `.mono-label`). */
export function surPlace(t: Pick<TerrainNord, "formats" | "eclaire" | "libre">): string {
  return [...formatsLisibles(t.formats), t.eclaire && "éclairé", t.libre && "accès libre"].filter(Boolean).join(" · ");
}

/** Un nom qui ne dit pas où l'on est (« Complexe sportif », « Stade municipal »). */
const GENERIQUE = /^(complexe|stade|stades|terrain|espace|plaine|parc des sports)( (sportif|sportive|municipal|synthétique|de football|de proximité|multisports|des sports))*$/i;

/** Le lieu du match tel qu'il s'affiche partout : le nom, et la commune quand le nom ne la dit pas. */
export function lieuDuTerrain(t: Pick<TerrainNord, "nom" | "commune">): string {
  const nom = t.nom.trim();
  if (GENERIQUE.test(nom) || nom.length < 6) return `${nom}, ${t.commune}`.slice(0, 120);
  return nom.slice(0, 120);
}

/** La commune d'une adresse « …, 59700 Marcq-en-Barœul » (celles du catalogue et des terrains de la ligue). */
export function communeDeLAdresse(adresse: string | null | undefined): string | undefined {
  const m = adresse?.match(/\b\d{5}\s+([^,\d][^,]*)$/);
  return m ? m[1].trim() : undefined;
}
