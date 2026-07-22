"use client";

// Export des cartes en image. On rend n'importe quelle carte (PlayerCard,
// BoostCard…) dans un conteneur hors-écran, puis on la rasterise en PNG haute
// résolution via html-to-image. Deux usages : télécharger une carte, ou
// exporter tout l'effectif dans un seul fichier ZIP.

import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import JSZip from "jszip";

const nextFrame = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// Rasterise une carte React en PNG (data URL). pixelRatio 3 = rendu net pour
// impression/partage. Le conteneur est monté hors-écran le temps de la capture.
export async function cardToPng(node: ReactNode, pixelRatio = 3): Promise<string> {
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText =
    "position:fixed;left:-100000px;top:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(holder);
  const root = createRoot(holder);
  try {
    root.render(node as React.ReactElement);
    await nextFrame();
    if (document.fonts?.ready) await document.fonts.ready;
    const target = holder.firstElementChild as HTMLElement | null;
    if (!target) throw new Error("Rendu de carte vide");
    // Attendre le chargement des photos avant de capturer.
    await Promise.all(
      Array.from(target.querySelectorAll("img")).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            })
      )
    );
    await nextFrame();
    return await toPng(target, { pixelRatio, cacheBust: true });
  } finally {
    root.unmount();
    holder.remove();
  }
}

// Nom de fichier sûr à partir d'un libellé libre.
export function safeFileName(name: string): string {
  return name.trim().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Télécharge une carte déjà rasterisée (data URL) en PNG.
export function downloadPng(dataUrl: string, filename: string) {
  triggerDownload(dataUrl, filename.endsWith(".png") ? filename : `${filename}.png`);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(",")[1]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface ExportItem {
  node: ReactNode;
  name: string; // sans extension
}

// Rasterise une série de cartes et les regroupe dans un seul ZIP téléchargé.
export async function exportCardsZip(
  items: ExportItem[],
  zipName: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  for (let i = 0; i < items.length; i++) {
    const dataUrl = await cardToPng(items[i].node);
    zip.file(`${safeFileName(items[i].name)}.png`, dataUrlToBytes(dataUrl));
    onProgress?.(i + 1, items.length);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, zipName.endsWith(".zip") ? zipName : `${zipName}.zip`);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
