// L'album du studio : les photos que le joueur a faites (ses visages, et les
// filtres tirés de chacun), gardées sur son téléphone pour qu'il choisisse
// entre elles, même après avoir fermé le studio ou en le rouvrant le
// lendemain (Sabri, 23/10/2026 : « qu'il puisse choisir entre ces trois
// visages générés, que ce ne soit pas perdu »). Avant, une photo qu'on ne
// posait pas sur sa carte disparaissait à la fermeture du studio.
//
// Elles ne quittent pas le téléphone : Bola ne garde chez lui que la photo
// posée sur la carte (politique de confidentialité). IndexedDB plutôt que
// localStorage : une photo pèse un demi-mégaoctet, localStorage n'en tient
// que quelques-uns. Sans IndexedDB (navigation privée, stockage plein),
// l'album ne vit que le temps du studio.
//
// Au plus ALBUM_MAX photos par joueur : les plus anciennes partent, et les
// filtres d'un visage partent avec lui.

import type { Filtre, Pays } from "@/lib/sfl/photo-studio";

export interface PhotoGardee {
  id: string;
  /** Le joueur (nom de saison) : un téléphone peut servir à deux comptes. */
  joueur: string;
  filtre: Filtre;
  /** Le pays d'un drapeau, sinon null. */
  pays: Pays | null;
  /** Le visage (la photo de studio) d'où vient un filtre ; null pour un visage. */
  source: string | null;
  /** L'image, en data URL. */
  image: string;
  /** Quand elle a été faite (ms). */
  faite: number;
}

/** Quatre jours de photos au plus, à trois par jour. */
export const ALBUM_MAX = 12;

const BASE = "bola-studio";
const MAGASIN = "photos";

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(MAGASIN, { keyPath: "id" }).createIndex("joueur", "joueur");
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

/** Les plus récentes d'abord, ALBUM_MAX au plus, sans filtre dont le visage est parti. */
export function tailler(photos: PhotoGardee[]): PhotoGardee[] {
  const recentes = [...photos].sort((a, b) => b.faite - a.faite).slice(0, ALBUM_MAX);
  const visages = new Set(recentes.filter((p) => p.source === null).map((p) => p.id));
  return recentes.filter((p) => p.source === null || visages.has(p.source));
}

/** L'album du joueur sur ce téléphone, le plus récent d'abord ; vide s'il est inaccessible. */
export async function lireAlbum(joueur: string): Promise<PhotoGardee[]> {
  try {
    const db = await ouvrir();
    const photos = await new Promise<PhotoGardee[]>((ok, ko) => {
      const r = db.transaction(MAGASIN).objectStore(MAGASIN).index("joueur").getAll(joueur);
      r.onsuccess = () => ok(r.result as PhotoGardee[]);
      r.onerror = () => ko(r.error);
    });
    db.close();
    return tailler(photos);
  } catch {
    return [];
  }
}

/** Range une photo dans l'album et retire ce qui dépasse (même règle que tailler). */
export async function garderPhoto(photo: PhotoGardee): Promise<void> {
  try {
    const db = await ouvrir();
    await new Promise<void>((ok, ko) => {
      const t = db.transaction(MAGASIN, "readwrite");
      const magasin = t.objectStore(MAGASIN);
      magasin.put(photo);
      const r = magasin.index("joueur").getAll(photo.joueur);
      r.onsuccess = () => {
        const toutes = r.result as PhotoGardee[];
        const gardees = new Set(tailler(toutes).map((p) => p.id));
        for (const p of toutes) if (!gardees.has(p.id)) magasin.delete(p.id);
      };
      t.oncomplete = () => ok();
      t.onerror = () => ko(t.error);
      t.onabort = () => ko(t.error);
    });
    db.close();
  } catch {
    // Pas d'album sur ce téléphone : la photo reste le temps du studio.
  }
}
