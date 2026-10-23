// Le calque du maillot, hors du fil de l'interface (lib/sfl/calque-maillot.ts
// fait le calcul : un tiers de seconde par photo sur un téléphone récent, de
// quoi figer un défilement). On lui envoie l'adresse d'une photo du studio et
// la couleur du camp ; il rend la photo repeinte en JPEG, ou rien quand elle
// reste telle quelle (déjà dans la bonne couleur, ou maillot introuvable).
// La photo ne quitte pas le téléphone : tout se fait ici.

import { calquerMaillot, type Teinte } from "./calque-maillot";

export interface DemandeCalque {
  id: number;
  url: string;
  vers: Teinte;
}

export interface ReponseCalque {
  id: number;
  /** La photo repeinte, ou null si elle reste telle quelle. */
  photo: Blob | null;
  /** Le calcul a échoué (photo illisible, réseau) : à retenter plus tard, pas à retenir. */
  echec?: boolean;
}

const moi = self as unknown as {
  onmessage: ((e: MessageEvent<DemandeCalque>) => void) | null;
  postMessage: (r: ReponseCalque) => void;
};

moi.onmessage = async (e) => {
  const { id, url, vers } = e.data;
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(String(reponse.status));
    const image = await createImageBitmap(await reponse.blob());
    const { width: w, height: h } = image;
    const toile = new OffscreenCanvas(w, h);
    const ctx = toile.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2d");
    ctx.drawImage(image, 0, 0);
    image.close();
    const pixels = ctx.getImageData(0, 0, w, h);
    const repeinte = calquerMaillot(pixels.data, w, h, vers);
    if (!repeinte) {
      moi.postMessage({ id, photo: null });
      return;
    }
    pixels.data.set(repeinte);
    ctx.putImageData(pixels, 0, 0);
    moi.postMessage({ id, photo: await toile.convertToBlob({ type: "image/jpeg", quality: 0.88 }) });
  } catch {
    moi.postMessage({ id, photo: null, echec: true });
  }
};
