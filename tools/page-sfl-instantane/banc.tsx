// Le banc de rendu de tools/page-sfl-instantane.ts : les vraies cartes de
// l'app (BolaCard en grand, CartePhoto en dessous de 170 px, le choix que
// fait PlayerCard), dessinées dans Chromium pour devenir les images de la
// page /sfl. Jamais servi par l'app : l'outil le met en paquet avec esbuild
// (l'alias @ vers src), le sert à Chromium sans serveur, puis prend chaque
// carte en capture, fond transparent.
//
// Chaque carte reçoit ce que l'app lui donnerait pour ce joueur : son nom de
// saison (la graine du papier), son nom affiché, son poste, sa note et ses
// stats officielles (le moteur, rejoué par l'outil), sa photo du studio
// (relue à son adresse publique) et, pour une carte à titre, son édition.
// Dans une compo, la photo porte le maillot du camp : le calque de l'app
// (calquerMaillot, les mêmes étapes que calque-maillot.worker.ts), et la
// note est dans l'onglet aux couleurs du camp, comme sur une feuille de match.
// Ni badge, ni finition de la passe, ni cran, ni rang : la page n'a pas lu ce
// que le joueur porte (voir l'en-tête de l'outil).
//
// L'outil pose la liste des cartes dans window.__cartes avant le chargement ;
// le banc rend chacune dans #carte-<i>, puis pose data-pret sur <body>.

import { createRoot } from "react-dom/client";
import { BolaCard, palierCarte, type BolaEdition } from "@/components/sfl/bola-card";
import { CartePhoto } from "@/components/sfl/carte-photo";
import type { Stats } from "@/lib/sfl/engine";
import { calquerMaillot } from "@/lib/sfl/calque-maillot";
import { MAILLOTS, type Camp } from "@/lib/sfl/maillots";

/** Une carte à dessiner (écrite par l'outil). */
export interface CarteBanc {
  nom: string;
  affiche: string;
  poste: string;
  note: number;
  stats: Stats;
  edition: BolaEdition;
  /** La largeur dessinée, en px CSS (la capture se fait à 3 px par px). */
  largeur: number;
  /** L'adresse de la photo, servie par l'outil. */
  photo: string;
  /** Le camp, dans une compo : le maillot de la photo et l'onglet de la note. */
  camp?: Camp;
}

const TEINTE = { Noirs: "noir", Blancs: "blanc" } as const;

/** La photo repeinte au maillot du camp, en JPEG comme dans l'app ; l'originale si le calque n'y touche pas. */
async function auMaillot(url: string, camp: Camp): Promise<string> {
  const image = await createImageBitmap(await (await fetch(url)).blob());
  const toile = new OffscreenCanvas(image.width, image.height);
  const ctx = toile.getContext("2d", { willReadFrequently: true });
  if (!ctx) return url;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, image.width, image.height);
  const repeinte = calquerMaillot(pixels.data, image.width, image.height, TEINTE[camp]);
  if (!repeinte) return url;
  pixels.data.set(repeinte);
  ctx.putImageData(pixels, 0, 0);
  return URL.createObjectURL(await toile.convertToBlob({ type: "image/jpeg", quality: 0.88 }));
}

function Carte({ c, photo }: { c: CarteBanc; photo: string }) {
  const size = c.largeur / 254;
  const distinction = c.edition === "mvp" || c.edition === "impact" || c.edition === "def" ? c.edition : undefined;
  if (palierCarte(c.largeur) !== "complete")
    return (
      <CartePhoto
        name={c.nom}
        affiche={c.affiche}
        position={c.poste}
        overall={c.note}
        size={size}
        photo={photo}
        onglet={c.camp ? { fond: MAILLOTS[c.camp].fond, encre: MAILLOTS[c.camp].encre } : undefined}
        distinction={distinction}
      />
    );
  return (
    <BolaCard
      edition={c.edition}
      name={c.nom}
      affiche={c.affiche}
      position={c.poste}
      overall={c.note}
      stats={c.stats}
      size={size}
      photo={photo}
    />
  );
}

async function main() {
  const cartes = (window as unknown as { __cartes: CarteBanc[] }).__cartes;
  const racine = document.getElementById("cartes");
  if (!racine) return;
  const photos = await Promise.all(cartes.map((c) => (c.camp ? auMaillot(c.photo, c.camp) : Promise.resolve(c.photo))));
  // Les photos chargées avant le rendu : la capture ne prend pas un portrait vide.
  await Promise.all(
    photos.map(
      (src) =>
        new Promise<void>((ok) => {
          const i = new Image();
          i.onload = i.onerror = () => ok();
          i.src = src;
        })
    )
  );
  createRoot(racine).render(
    <>
      {cartes.map((c, i) => (
        <div key={i} id={`carte-${i}`} className="carte">
          <Carte c={c} photo={photos[i]} />
        </div>
      ))}
    </>
  );
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.setAttribute("data-pret", "")));
}

void main();
