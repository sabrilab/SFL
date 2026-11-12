// Les images du sigle SFL hors de l'app : la photo de profil et la couverture
// du compte Instagram de la ligue, et l'aperçu du lien getbola.app/sfl
// (src/app/sfl/opengraph-image.png). Demande du 12/11/2026 : « une image du
// vrai logo SFL qu'on a ».
//
// Le sigle n'est jamais redessiné ici : son tracé vient de sigleSfl()
// (tools/sigle-sfl.ts), cadré au plus près des lettres. Chaque image est un
// SVG composé d'un fond et du sigle posé dans un <svg> imbriqué, qui le met à
// l'échelle sans toucher à son attribut d ; Chromium (Playwright, déjà
// installé) le rend en PNG, un pixel pour un pixel. Le sigle est centré sur
// la boîte de ses lettres, pas sur le cadre de 735 du logo.
//
// Teintes : l'encre #08090B et le papier #F4F5F2 de l'app et de son icône.
// Sobre d'abord : aucun fond imprimé sur les images officielles. Deux
// variantes en option, sur le noir seulement, portent la rosace guillochée du
// dos des cartes (RosaceBola) derrière le sigle, à 7 % : ni microtexte, ni
// rayons, ni or.
//
// La photo de profil est rognée en rond par Instagram : le sigle y fait 65 %
// du carré (702 px sur 1080), sa demi-diagonale tient à 67 % du rayon.
//
//   npx tsx tools/sigle-sfl-exports.ts <dossier>      écrit toutes les images
//   npx tsx tools/sigle-sfl-exports.ts --apercu-lien  réécrit l'aperçu du lien
//     du dépôt (1200 × 630), que relit tools/page-sfl-check.ts
//   CHROME=/opt/pw-browsers/chromium npx tsx …        avec un Chromium déjà là,
//     quand celui de Playwright n'est pas à sa version (rien n'est téléchargé)
//
// Contrôles joués à chaque écriture : les dimensions de chaque PNG, les marges
// gauche et droite du sigle égales à 1 px près, et sur les deux profils aucun
// pixel du sigle hors du cercle. La planche sfl-apercu-rond.png montre les
// deux profils rognés, de 320 à 40 px : à regarder avant de livrer.

import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Page } from "playwright";
import { RosaceBola } from "../src/components/sfl/motif-carte";
import { sigleSfl } from "./sigle-sfl";

export const ENCRE = "#08090B";
export const PAPIER = "#F4F5F2";
/** L'aperçu du lien, dans le dépôt. */
export const APERCU_LIEN = join(__dirname, "..", "src", "app", "sfl", "opengraph-image.png");

interface Image {
  nom: string;
  l: number;
  h: number;
  /** null : fond transparent. */
  fond: string | null;
  sigle: string;
  /** La largeur du sigle, en pixels ; sa hauteur suit. */
  largeur: number;
  /** La rosace des cartes derrière le sigle : ses deux rayons. */
  rosace?: [number, number];
  /** Rognée en rond par Instagram : aucun pixel du sigle hors du cercle. */
  rond?: boolean;
}

const IMAGES: Image[] = [
  { nom: "sfl-profil-noir-1080.png", l: 1080, h: 1080, fond: ENCRE, sigle: PAPIER, largeur: 702, rond: true },
  { nom: "sfl-profil-blanc-1080.png", l: 1080, h: 1080, fond: PAPIER, sigle: ENCRE, largeur: 702, rond: true },
  { nom: "sfl-couverture-noir-1500x500.png", l: 1500, h: 500, fond: ENCRE, sigle: PAPIER, largeur: 600 },
  { nom: "sfl-couverture-blanc-1500x500.png", l: 1500, h: 500, fond: PAPIER, sigle: ENCRE, largeur: 600 },
  { nom: "sfl-portrait-noir-1080x1350.png", l: 1080, h: 1350, fond: ENCRE, sigle: PAPIER, largeur: 702 },
  { nom: "sfl-portrait-blanc-1080x1350.png", l: 1080, h: 1350, fond: PAPIER, sigle: ENCRE, largeur: 702 },
  { nom: "sfl-sigle-blanc-transparent-2400.png", l: 2400, h: 656, fond: null, sigle: PAPIER, largeur: 2400 },
  { nom: "sfl-sigle-encre-transparent-2400.png", l: 2400, h: 656, fond: null, sigle: ENCRE, largeur: 2400 },
  // En option : la rosace des cartes, sur le noir seulement.
  { nom: "sfl-portrait-noir-print-1080x1350.png", l: 1080, h: 1350, fond: ENCRE, sigle: PAPIER, largeur: 702, rosace: [302, 497] },
  { nom: "sfl-couverture-noir-print-1500x500.png", l: 1500, h: 500, fond: ENCRE, sigle: PAPIER, largeur: 600, rosace: [260, 460] },
];

const LIEN: Image = { nom: "sfl-apercu-lien-1200x630.png", l: 1200, h: 630, fond: ENCRE, sigle: PAPIER, largeur: 600 };

/** Le sigle serré tel que le générateur l'écrit : son cadre et son tracé, recopiés sans y toucher. */
export function sigleSerre(): { cadre: string; l: number; h: number; d: string } {
  const svg = sigleSfl(ENCRE, true);
  const cadre = /viewBox="([^"]+)"/.exec(svg)?.[1];
  const d = / d="([^"]+)"/.exec(svg)?.[1];
  assert.ok(cadre && d, "le sigle généré n'a plus la forme attendue");
  const [, , l, h] = cadre.split(" ").map(Number);
  return { cadre, l, h, d };
}

/** L'image, en SVG : le fond, la rosace s'il y en a une, puis le sigle au centre. */
export function composer(image: Image): string {
  const s = sigleSerre();
  const hauteur = (image.largeur * s.h) / s.l;
  const x = (image.l - image.largeur) / 2;
  const y = (image.h - hauteur) / 2;
  const rosace = image.rosace
    ? `<g opacity="0.07">${renderToStaticMarkup(
        createElement(RosaceBola, { cx: image.l / 2, cy: image.h / 2, r1: image.rosace[0], r2: image.rosace[1], couleur: PAPIER, epaisseur: 1.2 })
      )}</g>`
    : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${image.l}" height="${image.h}" viewBox="0 0 ${image.l} ${image.h}">`,
    image.fond ? `<rect width="${image.l}" height="${image.h}" fill="${image.fond}"/>` : "",
    rosace,
    `<svg x="${x}" y="${y}" width="${image.largeur}" height="${hauteur}" viewBox="${s.cadre}"><path fill="${image.sigle}" d="${s.d}"/></svg>`,
    `</svg>`,
  ].join("");
}

async function rendre(page: Page, image: Image): Promise<Buffer> {
  await page.setViewportSize({ width: image.l, height: image.h });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">${composer(image).replace("<svg ", '<svg style="display:block" ')}</body></html>`
  );
  return page.screenshot({ type: "png", omitBackground: image.fond === null, clip: { x: 0, y: 0, width: image.l, height: image.h } });
}

interface Mesure {
  l: number;
  h: number;
  /** Les marges du sigle (les pixels à sa teinte), de chaque côté. */
  gauche: number;
  droite: number;
  haut: number;
  bas: number;
  /** Les pixels du sigle hors du cercle inscrit. */
  horsCercle: number;
}

/** Relit le PNG dans le navigateur : ses dimensions, la boîte du sigle, ce qui sort du cercle. */
async function mesurer(page: Page, png: Buffer, teinte: string): Promise<Mesure> {
  return page.evaluate(
    async ({ donnees, teinte }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${donnees}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      const cible = [1, 3, 5].map((i) => parseInt(teinte.slice(i, i + 2), 16));
      let x0 = c.width, x1 = -1, y0 = c.height, y1 = -1, hors = 0;
      const r = Math.min(c.width, c.height) / 2;
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          // Le cœur du sigle : sa teinte exacte, opaque (les bords lissés ne comptent pas).
          if (px[i + 3] < 250 || Math.abs(px[i] - cible[0]) + Math.abs(px[i + 1] - cible[1]) + Math.abs(px[i + 2] - cible[2]) > 6) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          if (Math.hypot(x + 0.5 - c.width / 2, y + 0.5 - c.height / 2) > r) hors++;
        }
      return { l: c.width, h: c.height, gauche: x0, droite: c.width - 1 - x1, haut: y0, bas: c.height - 1 - y1, horsCercle: hors };
    },
    { donnees: png.toString("base64"), teinte }
  );
}

async function controler(page: Page, image: Image, png: Buffer): Promise<void> {
  const m = await mesurer(page, png, image.sigle);
  assert.equal(m.l, image.l, `${image.nom} : largeur`);
  assert.equal(m.h, image.h, `${image.nom} : hauteur`);
  assert.ok(Math.abs(m.gauche - m.droite) <= 1, `${image.nom} : marges gauche ${m.gauche} et droite ${m.droite}`);
  assert.ok(Math.abs(m.haut - m.bas) <= 1, `${image.nom} : marges haut ${m.haut} et bas ${m.bas}`);
  if (image.rond) assert.equal(m.horsCercle, 0, `${image.nom} : ${m.horsCercle} pixels du sigle hors du cercle`);
  console.log(`  ${image.nom}  ${m.l} × ${m.h}  marges ${m.gauche} | ${m.droite}  ${m.haut} | ${m.bas}${image.rond ? "  rond : rien ne sort" : ""}`);
}

/** La planche de contrôle : les deux profils rognés en rond, aux tailles où Instagram les montre. */
async function planche(page: Page, profils: Buffer[]): Promise<Buffer> {
  const tailles = [320, 150, 110, 64, 40];
  const rangees = profils
    .map(
      (png) =>
        `<div style="display:flex;align-items:center;gap:40px">${tailles
          .map((t) => `<img src="data:image/png;base64,${png.toString("base64")}" style="width:${t}px;height:${t}px;border-radius:50%;display:block">`)
          .join("")}</div>`
    )
    .join("");
  await page.setViewportSize({ width: 960, height: 800 });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:#8f908b"><div id="p" style="display:inline-flex;flex-direction:column;gap:40px;padding:48px">${rangees}</div></body></html>`
  );
  return page.locator("#p").screenshot({ type: "png" });
}

async function main() {
  const args = process.argv.slice(2);
  const lien = args.includes("--apercu-lien");
  const dossier = args.find((a) => !a.startsWith("--"));
  if (!lien && !dossier) {
    console.error("usage : npx tsx tools/sigle-sfl-exports.ts <dossier> | --apercu-lien");
    process.exit(1);
  }
  // Chargé ici seulement : le banc relit ce fichier sans lancer de navigateur.
  const { chromium } = await import("playwright");
  const navigateur = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await (await navigateur.newContext({ deviceScaleFactor: 1 })).newPage();
  try {
    if (lien) {
      const png = await rendre(page, LIEN);
      await controler(page, LIEN, png);
      writeFileSync(APERCU_LIEN, png);
      console.log(`aperçu du lien écrit dans ${APERCU_LIEN}`);
    }
    if (dossier) {
      mkdirSync(dossier, { recursive: true });
      const profils: Buffer[] = [];
      for (const image of IMAGES) {
        const png = await rendre(page, image);
        await controler(page, image, png);
        writeFileSync(join(dossier, image.nom), png);
        if (image.rond) profils.push(png);
      }
      // L'aperçu du lien : la copie de l'image du dépôt, à l'octet près.
      copyFileSync(APERCU_LIEN, join(dossier, LIEN.nom));
      writeFileSync(join(dossier, "sfl-apercu-rond.png"), await planche(page, profils));
      writeFileSync(join(dossier, "sfl.svg"), readFileSync(join(__dirname, "..", "public", "bola", "sfl.svg")));
      console.log(`${IMAGES.length + 3} fichiers écrits dans ${dossier}`);
    }
  } finally {
    await navigateur.close();
  }
}

if (require.main === module) void main();
