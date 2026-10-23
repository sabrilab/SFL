"use client";

// Chaque joueur dans le maillot de son camp, sur les cartes d'un match (Sabri,
// 23/10/2026 : « tu prends un maillot noir et un maillot blanc, et tu arrives
// à bien le mettre en espèce d'overlay sur chaque joueur », sans génération).
//
// La photo du studio porte le maillot blanc ou le noir. Sur le terrain des
// Actus et de la Ligue, la feuille de match et les duels de la Map, une carte
// de joueur du camp d'en face se montre avec la photo repeinte par le code
// (lib/sfl/calque-maillot.ts), dans un worker (calque-maillot.worker.ts) :
// l'interface ne fige pas. Tant que la photo repeinte n'est pas prête, la
// carte montre la photo d'origine ; une photo que le calque laisse telle
// quelle (déjà dans la bonne couleur, maillot introuvable) reste l'originale.
//
// Chaque photo repeinte est gardée sur le téléphone (Cache Storage, au nom
// versionné : le changer refait tout après une retouche du calcul), sous
// l'adresse de la photo, qui change avec chaque nouvelle photo (`?v=`). Rien
// ne part sur le réseau : la photo est lue à son adresse publique, repeinte
// ici, gardée ici. La liste des photos gardées est notée à part (localStorage,
// lue tout de suite) : une carte qui en a une l'attend, le temps de la relire,
// au lieu de montrer un instant l'autre maillot.

import type { Teinte } from "@/lib/sfl/calque-maillot";
import type { DemandeCalque, ReponseCalque } from "@/lib/sfl/calque-maillot.worker";
import type { Camp } from "@/lib/sfl/maillots";

const TEINTE: Record<Camp, Teinte> = { Noirs: "noir", Blancs: "blanc" };
/** Le cache des photos repeintes : changer son nom avec le calcul (calque-maillot.ts). */
const CACHE = "bola-maillots-v1";
/** Une photo que le calque laisse telle quelle est gardée vide, avec cet en-tête. */
const TEL_QUEL = "x-bola-calque";
/** La liste des clés dont la photo repeinte est gardée (localStorage), au même nom. */
const INDEX = CACHE;
/** Au-delà, les plus anciennes sortent de la liste (une photo changée laisse sa vieille clé). */
const INDEX_MAX = 400;
/** Ce que montre une carte qui attend sa photo repeinte gardée : un pixel transparent. */
const ATTENTE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** clé « camp adresse » → l'adresse à montrer : la photo repeinte (blob:), ou la photo elle-même. */
const pretes = new Map<string, string>();
const enCours = new Set<string>();
/** Les échecs de la session (photo illisible, réseau) : on ne les relance pas en boucle. */
const ratees = new Set<string>();
const abonnes = new Set<() => void>();
let version = 0;

function signaler() {
  version++;
  for (const f of abonnes) f();
}

export function abonnerMaillots(f: () => void): () => void {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

export function versionMaillots(): number {
  return version;
}

const cleDe = (url: string, camp: Camp) => `${camp} ${url}`;

let index: Set<string> | null = null;

function lireIndex(): Set<string> {
  if (index) return index;
  index = new Set();
  try {
    const brut = localStorage.getItem(INDEX);
    if (brut) index = new Set(JSON.parse(brut) as string[]);
  } catch {}
  return index;
}

/** Note qu'une photo repeinte est gardée, ou ne l'est plus ; vrai si la liste a changé. */
function noter(cle: string, gardee: boolean): boolean {
  const ix = lireIndex();
  if (gardee === ix.has(cle)) return false;
  if (gardee) ix.add(cle);
  else ix.delete(cle);
  const liste = [...ix].slice(-INDEX_MAX);
  index = new Set(liste);
  try {
    localStorage.setItem(INDEX, JSON.stringify(liste));
  } catch {}
  return true;
}

/**
 * La photo à montrer pour ce camp : la repeinte si elle est prête, un pixel
 * vide le temps de relire celle qui est gardée, sinon undefined (montrer
 * l'originale pendant le calcul).
 */
export function photoAuMaillot(url: string, camp: Camp): string | undefined {
  const cle = cleDe(url, camp);
  return pretes.get(cle) ?? (lireIndex().has(cle) ? ATTENTE : undefined);
}

// ─────────────────────────── Le cache du téléphone ───────────────────────────

const avecCache = () => typeof caches !== "undefined";
/** Une adresse de rangement, jamais demandée au réseau. */
const requete = (cle: string) => new Request(`/__bola-maillot/${encodeURIComponent(cle)}`);

/** La photo gardée : son adresse blob:, null si elle reste telle quelle, undefined si rien n'est gardé. */
async function relire(cle: string): Promise<string | null | undefined> {
  if (!avecCache()) return undefined;
  const cache = await caches.open(CACHE);
  const r = await cache.match(requete(cle));
  if (!r) return undefined;
  if (r.headers.get(TEL_QUEL)) return null;
  return URL.createObjectURL(await r.blob());
}

async function garder(cle: string, photo: Blob | null) {
  if (!avecCache()) return;
  const cache = await caches.open(CACHE);
  await cache.put(
    requete(cle),
    photo
      ? new Response(photo, { headers: { "content-type": "image/jpeg" } })
      : new Response("", { headers: { [TEL_QUEL]: "1" } }),
  );
}

// ──────────────────────────────── Les workers ────────────────────────────────

interface Tache {
  cle: string;
  url: string;
  vers: Teinte;
}

let ouvriers: Worker[] | null = null;
const libres: Worker[] = [];
const file: Tache[] = [];
const envoyees = new Map<number, { tache: Tache; ouvrier: Worker }>();
let prochain = 1;

/** Un ou deux workers (deux sur un téléphone à quatre cœurs ou plus) ; aucun sans OffscreenCanvas. */
function ouvriersPrets(): boolean {
  if (ouvriers) return ouvriers.length > 0;
  ouvriers = [];
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return false;
  const n = (navigator.hardwareConcurrency ?? 2) >= 4 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    try {
      const w = new Worker(new URL("./calque-maillot.worker.ts", import.meta.url));
      w.onmessage = (e: MessageEvent<ReponseCalque>) => recu(e.data);
      ouvriers.push(w);
      libres.push(w);
    } catch {
      break;
    }
  }
  return ouvriers.length > 0;
}

function lancer() {
  while (libres.length && file.length) {
    const tache = file.shift()!;
    const ouvrier = libres.pop()!;
    const id = prochain++;
    envoyees.set(id, { tache, ouvrier });
    const demande: DemandeCalque = { id, url: tache.url, vers: tache.vers };
    ouvrier.postMessage(demande);
  }
}

function recu(r: ReponseCalque) {
  const envoi = envoyees.get(r.id);
  if (!envoi) return;
  envoyees.delete(r.id);
  libres.push(envoi.ouvrier);
  const { cle, url } = envoi.tache;
  enCours.delete(cle);
  if (r.echec) {
    ratees.add(cle);
    signaler();
  } else {
    pretes.set(cle, r.photo ? URL.createObjectURL(r.photo) : url);
    // Une photo encore locale (data:) n'a pas d'adresse stable : elle n'est pas gardée.
    if (!url.startsWith("data:"))
      void garder(cle, r.photo)
        .then(() => noter(cle, !!r.photo))
        .catch(() => {});
    signaler();
  }
  lancer();
}

/** Demande la photo dans le maillot du camp ; les cartes se mettent à jour quand elle est prête. */
export function demanderMaillot(url: string, camp: Camp): void {
  const cle = cleDe(url, camp);
  if (pretes.has(cle) || enCours.has(cle) || ratees.has(cle)) return;
  enCours.add(cle);
  void (async () => {
    const gardee = url.startsWith("data:") ? undefined : await relire(cle).catch(() => undefined);
    // Effacée du téléphone (un nettoyage de l'app) : la liste l'oublie, la
    // carte remontre l'originale, et on la refait.
    if (gardee === undefined && noter(cle, false)) signaler();
    if (gardee !== undefined || !ouvriersPrets()) {
      pretes.set(cle, gardee ?? url);
      enCours.delete(cle);
      signaler();
      return;
    }
    file.push({ cle, url, vers: TEINTE[camp] });
    lancer();
  })();
}
