"use client";

// Une image à partager, faite par le code : un nœud dessiné hors écran,
// photographié par html-to-image, puis donné à la feuille de partage du
// téléphone. Sorti de la feuille de match (components/sfl/matchs/
// feuille-de-match.tsx, 24/10/2026) pour servir aussi au trash talk
// (components/sfl/actus/trash-talk.tsx) ; ce qu'on y a appris sur iPhone :
//   · Safari peut dessiner l'image avant d'y avoir posé les photos : on les
//     repeint d'abord en data URL (poserLesPhotos pour une photo recadrée à
//     sa boîte, incrusterLesImages pour une image gardée entière), et on
//     reprend la prise sur un navigateur d'Apple ;
//   · le partage part avec les fichiers seuls : avec un titre, Safari met
//     dans la feuille un texte à part, avant les images, et Snap (comme
//     Instagram ou WhatsApp) prend ce texte et laisse les images ;
//   · Safari refuse de partager si le geste a attendu : l'image se prépare
//     avant, le geste ne fait que l'envoyer.
// Sans feuille de partage (ordinateur), les fichiers se téléchargent.

import { toBlob } from "html-to-image";

/** Un gif transparent d'un pixel : ce que devient une image qui ne se charge pas. */
export const IMAGE_VIDE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * Chaque photo de l'image (img[data-photo]), repeinte à la taille de sa
 * carte (deux fois, pour l'export) en JPEG, et posée telle quelle dans la
 * balise : une image légère, au bon type, que Safari dessine sans aller la
 * chercher. Une photo qui ne se repeint pas (pas encore là, refusée) reste
 * à son adresse.
 */
export async function poserLesPhotos(noeud: HTMLElement) {
  const imgs = Array.from(noeud.querySelectorAll<HTMLImageElement>("img[data-photo]"));
  await Promise.all(
    imgs.map(async (img) => {
      const adresse = img.dataset.photo!;
      if (img.dataset.posee === adresse) return;
      try {
        const source = new Image();
        if (!adresse.startsWith("data:") && !adresse.startsWith("blob:")) source.crossOrigin = "anonymous";
        source.src = adresse;
        await source.decode();
        const boite = img.getBoundingClientRect();
        const echelle = 2 * Math.max(1, boite.width / img.offsetWidth || 1);
        const l = Math.max(1, Math.round(img.offsetWidth * echelle));
        const h = Math.max(1, Math.round(img.offsetHeight * echelle));
        // object-cover : la photo couvre la carte, centrée.
        const k = Math.max(l / source.naturalWidth, h / source.naturalHeight);
        const sl = l / k;
        const sh = h / k;
        const toile = document.createElement("canvas");
        toile.width = l;
        toile.height = h;
        toile
          .getContext("2d")!
          .drawImage(source, (source.naturalWidth - sl) / 2, (source.naturalHeight - sh) / 2, sl, sh, 0, 0, l, h);
        const data = toile.toDataURL("image/jpeg", 0.9);
        if (img.dataset.photo !== adresse) return;
        img.src = data;
        await img.decode();
        img.dataset.posee = adresse;
      } catch {
        // Elle reste à son adresse : html-to-image ira la chercher.
      }
    }),
  );
}

/**
 * Les autres images du nœud (une vraie carte de joueur, qui cadre sa photo
 * elle-même), gardées entières et posées en data URL, à `cote` pixels au
 * plus : leur cadrage (object-fit, object-position, zoom) ne change pas.
 * Les dessins vectoriels et les images déjà posées restent comme ils sont.
 */
export async function incrusterLesImages(noeud: HTMLElement, cote = 512) {
  const imgs = Array.from(noeud.querySelectorAll<HTMLImageElement>("img:not([data-photo])"));
  await Promise.all(
    imgs.map(async (img) => {
      const adresse = img.currentSrc || img.src;
      if (!adresse || adresse.startsWith("data:") || /\.svg(\?|$)/i.test(adresse) || img.dataset.incrustee === adresse) return;
      try {
        const source = new Image();
        if (!adresse.startsWith("blob:")) source.crossOrigin = "anonymous";
        source.src = adresse;
        await source.decode();
        const k = Math.min(1, cote / Math.max(source.naturalWidth, source.naturalHeight));
        const toile = document.createElement("canvas");
        toile.width = Math.max(1, Math.round(source.naturalWidth * k));
        toile.height = Math.max(1, Math.round(source.naturalHeight * k));
        toile.getContext("2d")!.drawImage(source, 0, 0, toile.width, toile.height);
        const data = toile.toDataURL("image/jpeg", 0.9);
        if ((img.currentSrc || img.src) !== adresse) return;
        img.src = data;
        await img.decode();
        img.dataset.incrustee = data;
      } catch {
        // Elle reste à son adresse.
      }
    }),
  );
}

/**
 * La photographie d'un nœud, en PNG : `largeur` × `hauteur` points, chacun
 * rendu sur `ratio` pixels. `bonne` regarde chaque prise ; tant qu'elle la
 * refuse, on la reprend (`essais` au plus), et la dernière est gardée.
 */
export async function prendreImage(
  noeud: HTMLElement,
  {
    largeur,
    hauteur,
    ratio = 2,
    essais = 1,
    bonne,
    annule,
  }: {
    largeur: number;
    hauteur: number;
    ratio?: number;
    essais?: number;
    bonne?: (blob: Blob) => Promise<boolean>;
    annule?: () => boolean;
  },
): Promise<Blob | null> {
  let blob: Blob | null = null;
  for (let essai = 0; essai < essais && !annule?.(); essai++) {
    blob = await toBlob(noeud, {
      pixelRatio: ratio,
      // Les photos changent d'adresse avec elles (?v=…) ; une photo
      // repeinte (blob:) ne se relit pas si on lui ajoute un paramètre.
      includeQueryParams: true,
      // Un logo qui ne se charge pas laisse un vide, pas l'image entière.
      imagePlaceholder: IMAGE_VIDE,
      width: largeur,
      height: hauteur,
    });
    if (!blob || !bonne || (await bonne(blob))) break;
  }
  return blob;
}

/** Safari et tout navigateur d'iPhone : une seconde prise a ce que la première a pu manquer. */
export function prisesADoubler(): boolean {
  return typeof navigator !== "undefined" && navigator.vendor.startsWith("Apple");
}

export type IssuePartage = "partagee" | "annulee" | "telechargee" | "impossible";

/**
 * Les fichiers seuls, par la feuille de partage du téléphone ; sans elle,
 * ils se téléchargent.
 */
export async function partagerFichiers(fichiers: File[]): Promise<IssuePartage> {
  const donnees = { files: fichiers };
  if (typeof navigator.canShare === "function" && navigator.canShare(donnees)) {
    try {
      await navigator.share(donnees);
      return "partagee";
    } catch (e) {
      return (e as Error)?.name === "AbortError" ? "annulee" : "impossible";
    }
  }
  for (const fichier of fichiers) {
    const url = URL.createObjectURL(fichier);
    const a = document.createElement("a");
    a.href = url;
    a.download = fichier.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return "telechargee";
}
