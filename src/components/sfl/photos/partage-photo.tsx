"use client";

// Partager une photo de journée (Bola, 28/11/2026 : « quand on la partage, ça
// nous fait un lien […] ma story Instagram, il faut que ça soit stylé. […] mon
// Snapchat […] soit dans les stories, soit carrément en publication »).
//
// La feuille s'ouvre sur les deux images déjà prêtes, la story (9:16) et la
// publication (4:5), dessinées par lib/sfl/photo-export.ts. Les toucher
// ouvre la feuille de partage du téléphone avec le fichier seul (Instagram,
// Snapchat, WhatsApp…) ; sans elle (un ordinateur), l'image se télécharge.
// Dessous, le lien de la photo (app/photo/[cle]), avec mon code de parrain.
//
// Une photo qui ne peut pas sortir de l'app (photo_peut_sortir : un joueur
// dessus n'a pas accepté l'usage hors de l'app, ou a mis ses photos en
// privé) n'a ni story ni publication : seulement son lien, qui n'en montre
// pas l'image hors de l'app.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Link2, Share, X } from "lucide-react";
import { toast } from "sonner";
import { useIdentites } from "@/hooks/use-identites";
import { cleDePhoto, lienDePhoto, noterPartage, peutSortir } from "@/lib/sfl/photos-echos";
import { dateLongue, dessinerImage, TAILLES, type FormatImage, type PolicesExport } from "@/lib/sfl/photo-export";
import type { PhotoJournee } from "@/lib/sfl/photos-journees";

function charger(src: string): Promise<HTMLImageElement | null> {
  return new Promise((fin) => {
    const img = new Image();
    img.onload = () => fin(img);
    img.onerror = () => fin(null);
    img.src = src;
  });
}

/** Un SVG de public/bola, en blanc et à sa taille (le canvas en a besoin). */
async function svgBlanc(chemin: string, hauteur: number): Promise<HTMLImageElement | null> {
  try {
    const brut = await (await fetch(chemin)).text();
    const vb = /viewBox="([\d.\s-]+)"/.exec(brut)?.[1].split(/\s+/).map(Number);
    if (!vb || vb.length !== 4) return null;
    const largeur = Math.round((vb[2] / vb[3]) * hauteur);
    const svg = brut
      .replace(/fill="#(?:08090B|000000|000)"/gi, 'fill="#FFFFFF"')
      .replace("<svg ", `<svg width="${largeur}" height="${hauteur}" `);
    return charger(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  } catch {
    return null;
  }
}

async function polices(): Promise<PolicesExport> {
  const style = getComputedStyle(document.documentElement);
  const fam = (v: string, repli: string) => `${style.getPropertyValue(v).trim() || repli}, ${repli}, sans-serif`;
  const p = { titre: fam("--font-archivo", "Archivo"), texte: fam("--font-inter", "Inter") };
  await Promise.all([document.fonts.load(`900 100px ${p.titre}`), document.fonts.load(`600 30px ${p.texte}`)]).catch(() => {});
  return p;
}

interface Image {
  blob: Blob;
  url: string;
}

async function partagerFichier(blob: Blob, nom: string): Promise<"partagee" | "telechargee" | "annulee"> {
  const fichier = new File([blob], nom, { type: blob.type });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier] });
      return "partagee";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "annulee";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "telechargee";
}

export function PartagePhoto({ p, onFermer }: { p: PhotoJournee; onFermer: () => void }) {
  const id = useIdentites();
  const cle = cleDePhoto(p);
  const [sortable, setSortable] = useState<boolean | null>(null);
  const [images, setImages] = useState<Partial<Record<FormatImage, Image>>>({});
  const joueurs = useMemo(() => p.joueurs.map((n) => id.nom(n)), [p.joueurs, id]);

  useEffect(() => {
    let fini = false;
    void peutSortir(p).then((ok) => !fini && setSortable(ok));
    return () => {
      fini = true;
    };
  }, [p]);

  useEffect(() => {
    if (!sortable) return;
    let fini = false;
    const faites: string[] = [];
    void (async () => {
      const [photo, logo, sigle, pol] = await Promise.all([
        charger(p.src),
        svgBlanc("/bola/logo-blanc.svg", 120),
        svgBlanc("/bola/sfl.svg", 120),
        polices(),
      ]);
      if (fini || !photo) return;
      for (const format of ["story", "publication"] as const) {
        const { l, h } = TAILLES[format];
        const toile = document.createElement("canvas");
        toile.width = l;
        toile.height = h;
        const ctx = toile.getContext("2d");
        if (!ctx) return;
        dessinerImage(ctx, format, {
          photo,
          logo,
          sigle,
          journee: p.journee,
          date: dateLongue(p.date),
          joueurs,
          adresse: new URL(window.location.href).host.replace(/^www\./, ""),
          polices: pol,
        });
        const blob = await new Promise<Blob | null>((ok) => toile.toBlob(ok, "image/jpeg", 0.92));
        if (fini || !blob) return;
        const url = URL.createObjectURL(blob);
        faites.push(url);
        setImages((x) => ({ ...x, [format]: { blob, url } }));
      }
    })();
    return () => {
      fini = true;
      faites.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [sortable, p, joueurs]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [onFermer]);

  const partagerImage = async (format: FormatImage) => {
    const img = images[format];
    if (!img) return;
    const issue = await partagerFichier(img.blob, `bola-j${p.journee}-${p.id}-${format}.jpg`);
    if (issue === "annulee") return;
    noterPartage(cle, format);
    if (issue === "telechargee") toast("Image enregistrée.");
  };

  const partagerLien = async () => {
    const url = await lienDePhoto(cle);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url });
        noterPartage(cle, "lien");
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      noterPartage(cle, "lien");
      toast("Lien copié.");
    } catch {
      toast.error("Le lien n'a pas pu être copié.");
    }
  };

  return createPortal(
    <div className="dark fixed inset-0 z-[70] flex flex-col justify-end bg-black/60 text-white backdrop-blur-sm" onClick={onFermer}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Partager la photo"
        className="mx-auto w-full max-w-[560px] rounded-t-[28px] bg-[#111214] ring-1 ring-white/10 lg:mb-8 lg:rounded-[28px]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <p className="mono-label text-white/45">Partager</p>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="-mr-2 grid size-10 place-items-center text-white/55">
            <X className="size-[18px]" />
          </button>
        </div>

        {sortable !== false && (
          <div className="flex items-end justify-center gap-4 px-5 pt-2 pb-5">
            {(["story", "publication"] as const).map((f) => {
              const img = images[f];
              return (
                <button
                  key={f}
                  type="button"
                  disabled={!img}
                  onClick={() => void partagerImage(f)}
                  className="group flex w-[40%] max-w-[180px] flex-col items-center gap-2.5"
                >
                  <span
                    className={`relative block w-full overflow-hidden rounded-[14px] bg-white/[0.06] ring-1 ring-white/12 transition-transform group-active:scale-95 ${f === "story" ? "aspect-[9/16]" : "aspect-[4/5]"}`}
                  >
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt="" className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <span className="absolute inset-0 animate-pulse bg-white/[0.05]" />
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold">
                    {typeof navigator !== "undefined" && "share" in navigator ? (
                      <Share className="size-[15px]" strokeWidth={2.2} />
                    ) : (
                      <Download className="size-[15px]" strokeWidth={2.2} />
                    )}
                    {f === "story" ? "Story" : "Publication"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="px-5">
          <button
            type="button"
            onClick={() => void partagerLien()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white/[0.08] py-3.5 text-[15px] font-semibold ring-1 ring-white/12 active:scale-[0.98]"
          >
            <Link2 className="size-[17px]" strokeWidth={2.2} />
            Envoyer le lien
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
