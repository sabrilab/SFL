"use client";

// Photos de référence — les quatre prises en pied de l'inscription (face,
// droite, gauche, dos), d'où naîtra le personnage de référence du joueur
// pour les skins et les filtres : même pose, même cadrage, pour tout le monde.
//
// Bucket Storage PRIVÉ « references » (voir supabase/schema.sql) :
// <uuid du joueur>/<angle>.jpg. Le joueur pose les siennes ; l'admin les lit
// toutes, par des liens signés de courte durée.

import { supabase } from "@/lib/supabase";
import { ANGLES, type Angle } from "@/lib/sfl/inscription";

const BUCKET = "references";

/** Format de sortie : portrait 3:4, assez fin pour un modèle d'image. */
export const REFERENCE = { l: 1080, h: 1440, qualite: 0.86 } as const;

/**
 * Découpe une source (vidéo en direct ou image) au centre en 3:4 et la
 * recompresse. `miroir` remet à l'endroit une prise de la caméra avant —
 * l'aperçu est en miroir, la photo de référence ne doit jamais l'être.
 */
export function cadrerReference(
  source: CanvasImageSource,
  largeur: number,
  hauteur: number,
  miroir = false
): string {
  const ratio = REFERENCE.l / REFERENCE.h;
  let sw = largeur;
  let sh = largeur / ratio;
  if (sh > hauteur) {
    sh = hauteur;
    sw = hauteur * ratio;
  }
  const sx = (largeur - sw) / 2;
  const sy = (hauteur - sh) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = REFERENCE.l;
  canvas.height = REFERENCE.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  if (miroir) {
    ctx.translate(REFERENCE.l, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, REFERENCE.l, REFERENCE.h);
  return canvas.toDataURL("image/jpeg", REFERENCE.qualite);
}

/** Même découpe depuis un fichier (repli quand la caméra en direct manque). */
export function referenceDepuisFichier(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        resolve(cadrerReference(img, img.naturalWidth, img.naturalHeight));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible."));
    };
    img.src = url;
  });
}

/** Envoie les quatre prises du joueur connecté. Renvoie les angles refusés. */
export async function envoyerReferences(photos: Partial<Record<Angle, string>>): Promise<Angle[]> {
  const sb = supabase();
  const { data } = await sb.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return ANGLES.map((a) => a.id);
  const rates: Angle[] = [];
  for (const { id } of ANGLES) {
    const dataUrl = photos[id];
    if (!dataUrl) {
      rates.push(id);
      continue;
    }
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const { error } = await sb.storage
        .from(BUCKET)
        .upload(`${uid}/${id}.jpg`, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) rates.push(id);
    } catch {
      rates.push(id);
    }
  }
  return rates;
}

/** Liens signés (une heure) vers les prises d'un joueur — admin, ou soi-même. */
export async function liensReferences(uid: string): Promise<Partial<Record<Angle, string>>> {
  const chemins = ANGLES.map((a) => `${uid}/${a.id}.jpg`);
  const { data } = await supabase().storage.from(BUCKET).createSignedUrls(chemins, 3600);
  const out: Partial<Record<Angle, string>> = {};
  for (const l of data ?? []) {
    if (!l.signedUrl || l.error) continue;
    const angle = l.path?.split("/")[1]?.replace(/\.jpg$/, "") as Angle | undefined;
    if (angle) out[angle] = l.signedUrl;
  }
  return out;
}
