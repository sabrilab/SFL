"use client";

// Photos de profil des joueurs — partagées par toute la ligue.
//
// Une photo posée par un joueur part dans le bucket Storage public « photos »
// de Supabase (voir supabase/schema.sql) : chacun la voit ensuite sur sa
// carte, sur tous les téléphones. Un fichier par joueur, nommé d'après son
// nom en hexadécimal (les clés Storage refusent accents et espaces).
//
// Depuis le 22/10/2026, cette photo ne vient que du studio IA
// (photo-studio.tsx, puis recadrer-photo.tsx) : l'app n'offre plus aucun
// choix dans la pellicule (Sabri : « Les utilisateurs ne doivent pas pouvoir
// mettre de cartes de leurs pellicules »).
//
// Ce module tient trois couches, de la plus proche à la plus lointaine :
//   · la photo LOCALE (localStorage, data URL) — posée sur cet appareil et
//     pas encore envoyée (session non vérifiée, réseau absent). La clé a
//     changé le 22/10 : une photo restée en attente sous l'ancienne clé
//     pouvait venir de la pellicule, elle est effacée sans partir ;
//   · la liste DISTANTE — nom → URL publique versionnée, relue au lancement
//     et au retour sur l'app, gardée en cache pour un affichage immédiat ;
//   · le portrait livré dans public/players, en dernier recours (aucun n'y
//     est plus livré : une carte sans photo du studio n'en montre pas).
//
// Là où la carte est minuscule (les piles et les tournesols de la Map, 22 à
// 36 px de large), on montre la photo en vignette (photoMiniature) : la Map
// en charge une quarantaine d'un coup, en entier c'était plusieurs Mo.

import { SUPABASE_URL, supabase } from "@/lib/supabase";

const KEY_PREFIX = "sfl-studio-photo-";
/** L'ancienne clé des photos en attente, du temps de la pellicule. */
const ANCIEN_PREFIXE = "sfl-photo-";
const CACHE_KEY = "sfl-photos-distantes";
const BUCKET = "photos";

/** Émis à chaque ajout ou suppression de photo, pour rafraîchir les cartes. */
export const PHOTO_EVENT = "sfl-photo";

function key(name: string) {
  return `${KEY_PREFIX}${name}`;
}

function hasWindow() {
  return typeof window !== "undefined" && !!window.localStorage;
}

/** Efface les photos en attente sous l'ancienne clé : elles ne partiront jamais. */
function oublierAnciennes() {
  try {
    const ls = window.localStorage;
    for (let i = ls.length - 1; i >= 0; i--) {
      const k = ls.key(i);
      if (k?.startsWith(ANCIEN_PREFIXE)) ls.removeItem(k);
    }
  } catch {}
}

/** La clé Storage d'un joueur : son nom en hexadécimal UTF-8. */
function cleStorage(name: string): string {
  return Array.from(new TextEncoder().encode(name), (b) => b.toString(16).padStart(2, "0")).join("") + ".jpg";
}

function nomDeCle(cle: string): string | null {
  const hex = cle.replace(/\.[a-z]+$/i, "");
  if (!/^([0-9a-f]{2})+$/i.test(hex)) return null;
  try {
    const octets = new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));
    return new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    return null;
  }
}

function urlPublique(cle: string, version: string | number): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${cle}?v=${version}`;
}

/**
 * La photo d'un joueur par son adresse publique, sans la liste de la ligue
 * (réservée aux membres) : la page d'un lien de parrainage, ouverte sans
 * compte, la montre quand le joueur a accepté que sa carte sorte de l'app.
 */
export function photoParNom(name: string, version: string | number): string {
  return urlPublique(cleStorage(name), version);
}

// ─────────────────────────── La liste distante ───────────────────────────

let distantes: Record<string, string> | null = null;
/** Change à chaque modification des photos : la 3D s'en sert pour recapturer. */
let revision = 0;

function lireDistantes(): Record<string, string> {
  if (distantes) return distantes;
  distantes = {};
  if (hasWindow()) {
    try {
      const brut = window.localStorage.getItem(CACHE_KEY);
      if (brut) distantes = JSON.parse(brut) as Record<string, string>;
    } catch {}
  }
  return distantes;
}

function ecrireDistantes(next: Record<string, string>) {
  distantes = next;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {}
  signaler();
}

function signaler() {
  revision++;
  window.dispatchEvent(new Event(PHOTO_EVENT));
}

export function photoRevision(): number {
  return revision;
}

let enCours: Promise<void> | null = null;

/**
 * Relit la liste des photos de la ligue. Depuis le 22/10/2026, seuls les
 * membres la lisent (un joueur en attente n'y voit que la sienne ; sans
 * compte, rien) : les fichiers, eux, restent publics par leur adresse. Sans
 * session, ou si la liste revient vide (jeton refusé, la base ne montre
 * rien), le cache reste tel quel : aucune carte ne perd sa photo.
 */
export function rafraichirPhotos(): Promise<void> {
  if (!hasWindow()) return Promise.resolve();
  oublierAnciennes();
  enCours ??= (async () => {
    try {
      const { data: auth } = await supabase().auth.getSession();
      if (!auth.session) return;
      const { data, error } = await supabase().storage.from(BUCKET).list("", { limit: 1000 });
      if (error || !data?.length) return;
      const next: Record<string, string> = {};
      for (const f of data) {
        const nom = nomDeCle(f.name);
        if (!nom) continue;
        const v = Date.parse(f.updated_at ?? f.created_at ?? "") || 0;
        next[nom] = urlPublique(f.name, v);
      }
      const avant = lireDistantes();
      const pareil =
        Object.keys(next).length === Object.keys(avant).length && Object.entries(next).every(([n, u]) => avant[n] === u);
      if (!pareil) ecrireDistantes(next);
    } catch {
      // Hors ligne : le cache suffit.
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}

// ───────────────────────────── Lecture ─────────────────────────────

/** La photo posée sur cet appareil et pas encore partagée, ou null. */
export function getPhoto(name: string): string | null {
  if (!hasWindow()) return null;
  try {
    return window.localStorage.getItem(key(name));
  } catch {
    return null;
  }
}

/** La photo d'un joueur — locale en attente, sinon partagée — ou null s'il n'en a pas posé. */
export function photoPerso(name: string): string | null {
  if (!hasWindow()) return null;
  return getPhoto(name) ?? lireDistantes()[name] ?? null;
}

/**
 * Source d'image à afficher pour un joueur : sa photo s'il en a posé une,
 * sinon le fichier livré dans public/players. C'est le point d'entrée
 * unique — aucun composant ne doit construire ce chemin lui-même.
 */
export function photoSrc(name: string): string {
  return photoPerso(name) ?? `/players/${name}.png`;
}

/** Toutes les photos partagées connues de cet appareil (la liste en cache). */
export function photosPartagees(): string[] {
  if (!hasWindow()) return [];
  return Object.values(lireDistantes());
}

/** La largeur des vignettes de la Map : une carte de 36 px, grossie 1,22 fois, sur un écran 3×. */
export const LARGEUR_VIGNETTE = 128;

/**
 * La même photo en petit, par l'optimiseur d'images de Vercel (WebP, mise
 * en cache sur son CDN puis dans le téléphone) : quelques Ko au lieu des
 * 90 à 200 Ko du fichier de 896 px. Seules les photos du bucket passent par
 * là (next.config.ts, `images.remotePatterns`) ; une photo encore locale
 * (data URL) est rendue telle quelle. `largeur` est l'une des tailles
 * permises par Next (32, 48, 64, 96, 128, 256, 384, 640…).
 */
export function photoMiniature(url: string, largeur = LARGEUR_VIGNETTE): string {
  if (!url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`)) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${largeur}&q=75`;
}

// ───────────────────────────── Écriture ─────────────────────────────

export class PhotoQuotaError extends Error {
  constructor() {
    super("Espace de stockage insuffisant pour enregistrer la photo.");
    this.name = "PhotoQuotaError";
  }
}

function garderLocale(name: string, dataUrl: string) {
  try {
    window.localStorage.setItem(key(name), dataUrl);
  } catch {
    // Quota dépassé : on ne laisse pas un stockage à moitié écrit.
    window.localStorage.removeItem(key(name));
    throw new PhotoQuotaError();
  }
}

/** Ce que l'envoi a donné : partagée avec la ligue, ou gardée sur cet appareil. */
export type PhotoResultat = { partagee: true } | { partagee: false; raison: string };

async function envoyer(name: string, dataUrl: string): Promise<PhotoResultat> {
  const { data: auth } = await supabase().auth.getSession();
  if (!auth.session) {
    return { partagee: false, raison: "Connexion non vérifiée : reconnecte-toi pour la partager avec la ligue." };
  }
  const blob = await (await fetch(dataUrl)).blob();
  const cle = cleStorage(name);
  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(cle, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) {
    return { partagee: false, raison: "Le serveur de la ligue a refusé l'envoi — réessaie dans un instant." };
  }
  window.localStorage.removeItem(key(name));
  ecrireDistantes({ ...lireDistantes(), [name]: urlPublique(cle, Date.now()) });
  // La version exacte du serveur, pour que tout le monde pointe la même URL.
  void rafraichirPhotos();
  return { partagee: true };
}

/**
 * Pose la photo d'un joueur : affichée tout de suite sur cet appareil, puis
 * envoyée à la ligue. Si l'envoi échoue, elle reste ici et repartira au
 * prochain lancement (voir envoyerPhotosEnAttente).
 */
export async function setPhoto(name: string, dataUrl: string): Promise<PhotoResultat> {
  if (!hasWindow()) return { partagee: false, raison: "Indisponible." };
  garderLocale(name, dataUrl);
  signaler();
  try {
    return await envoyer(name, dataUrl);
  } catch {
    return { partagee: false, raison: "Pas de réseau : elle partira à la prochaine ouverture de l'app." };
  }
}

export async function removePhoto(name: string): Promise<void> {
  if (!hasWindow()) return;
  window.localStorage.removeItem(key(name));
  const avant = lireDistantes();
  if (avant[name]) {
    const { error } = await supabase().storage.from(BUCKET).remove([cleStorage(name)]);
    if (!error) {
      const next = { ...avant };
      delete next[name];
      ecrireDistantes(next);
      return;
    }
  }
  signaler();
}

/**
 * Au lancement : une photo restée sur cet appareil (posée avant le partage,
 * ou hors ligne) part à la ligue — seulement celle du joueur connecté.
 */
export async function envoyerPhotosEnAttente(name: string): Promise<void> {
  const locale = getPhoto(name);
  if (!locale) return;
  try {
    await envoyer(name, locale);
  } catch {}
}
