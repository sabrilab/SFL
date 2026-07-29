"use client";

// Photos de profil des joueurs.
//
// Même principe que saisie/store.ts : le stockage est isolé derrière une petite
// interface pour que le passage à Supabase Storage ne touche ni aux cartes ni
// à l'interface. Aujourd'hui les photos vivent en localStorage sous forme de
// data URL ; demain elles seront des URL distantes et seul ce fichier changera.
//
// Les images sont recadrées en carré et recompressées avant stockage : une
// photo brute d'iPhone pèse plusieurs mégaoctets, très au-delà du quota
// localStorage (~5 Mo pour TOUT le domaine, saison de la ligue comprise).

const KEY_PREFIX = "sfl-photo-";

/** Émis à chaque ajout ou suppression de photo, pour rafraîchir les cartes. */
export const PHOTO_EVENT = "sfl-photo";

/** Côté carré de l'image stockée, en pixels. */
const OUTPUT_SIZE = 512;
const JPEG_QUALITY = 0.82;

function key(name: string) {
  return `${KEY_PREFIX}${name}`;
}

function hasWindow() {
  return typeof window !== "undefined" && !!window.localStorage;
}

/** Photo personnalisée d'un joueur, ou null s'il n'en a pas. */
export function getPhoto(name: string): string | null {
  if (!hasWindow()) return null;
  return window.localStorage.getItem(key(name));
}

/**
 * Source d'image à afficher pour un joueur : sa photo personnalisée si elle
 * existe, sinon le fichier livré dans public/players. C'est le point d'entrée
 * unique — aucun composant ne doit construire ce chemin lui-même.
 */
export function photoSrc(name: string): string {
  return getPhoto(name) ?? `/players/${name}.png`;
}

export class PhotoQuotaError extends Error {
  constructor() {
    super("Espace de stockage insuffisant pour enregistrer la photo.");
    this.name = "PhotoQuotaError";
  }
}

export function setPhoto(name: string, dataUrl: string) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key(name), dataUrl);
  } catch {
    // Quota dépassé : on ne laisse pas un stockage à moitié écrit.
    window.localStorage.removeItem(key(name));
    throw new PhotoQuotaError();
  }
  window.dispatchEvent(new Event(PHOTO_EVENT));
}

export function removePhoto(name: string) {
  if (!hasWindow()) return;
  window.localStorage.removeItem(key(name));
  window.dispatchEvent(new Event(PHOTO_EVENT));
}

/**
 * Recadre un fichier image en carré centré, le réduit à OUTPUT_SIZE et le
 * recompresse en JPEG. Renvoie une data URL prête à être stockée.
 */
export function preparePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      // Recadrage centré sur le plus petit côté.
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas indisponible."));
        return;
      }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible."));
    };

    img.src = url;
  });
}
