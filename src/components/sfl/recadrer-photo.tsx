"use client";

// Recadrer sa photo avant de la poser sur sa carte : la photo apparaît dans
// un cadre aux proportions exactes du cadre de la carte Bola ; on la fait
// glisser du doigt, on zoome (pincer, molette ou curseur), et l'aperçu de la
// carte suit en direct. Valider découpe exactement ce qu'on voit — le
// visage reste là où on l'a mis, chez tout le monde.

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BolaCard } from "@/components/sfl/bola-card";
import type { Stats } from "@/lib/sfl/engine";

/** Les proportions du portrait de la carte (bola-card.tsx : un carré). */
export const RATIO_CADRE = 1;
/** La taille de l'image découpée, en pixels. */
const SORTIE = { l: 896, h: 896 };
const ZOOM_MAX = 4;

interface Position {
  zoom: number;
  x: number;
  y: number;
}

export function RecadrerPhoto({
  src,
  carte,
  onValider,
  onFermer,
}: {
  /** L'image à recadrer (URL d'objet, data URL, ou URL publique avec CORS). */
  src: string | null;
  /** De quoi dessiner l'aperçu de la carte. */
  carte: { name: string; username?: string; position: string; overall: number; stats: Stats };
  onValider: (dataUrl: string) => void;
  onFermer: () => void;
}) {
  const cadre = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(320);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [pos, setPos] = useState<Position>({ zoom: 1, x: 0, y: 0 });
  const [apercu, setApercu] = useState<string | null>(null);
  const doigts = useRef(new Map<number, { x: number; y: number }>());
  const pince = useRef<{ dist: number; zoom: number } | null>(null);

  const hauteur = largeur * RATIO_CADRE;

  // L'image, chargée une fois par source.
  useEffect(() => {
    if (!src) return;
    let annule = false;
    const img = new window.Image();
    const distante = !src.startsWith("data:") && !src.startsWith("blob:");
    // Une photo de la ligue : relue avec CORS (et hors du cache de l'<img>
    // sans CORS), sinon le canevas refuserait de la découper.
    if (distante) img.crossOrigin = "anonymous";
    img.onload = () => {
      if (annule) return;
      setImage(img);
      setPos({ zoom: 1, x: 0, y: 0 });
    };
    img.src = distante ? `${src}${src.includes("?") ? "&" : "?"}recadrage=1` : src;
    return () => {
      annule = true;
    };
  }, [src]);

  // La largeur réelle du cadre.
  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setLargeur(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, [image]);

  const echelle = useCallback(
    (zoom: number) => (image ? Math.max(largeur / image.naturalWidth, hauteur / image.naturalHeight) * zoom : 1),
    [image, largeur, hauteur]
  );

  /** Garde l'image collée aux bords du cadre : jamais de vide. */
  const borner = useCallback(
    (p: Position): Position => {
      if (!image) return p;
      const zoom = Math.min(ZOOM_MAX, Math.max(1, p.zoom));
      const s = echelle(zoom);
      const mx = Math.max(0, (image.naturalWidth * s - largeur) / 2);
      const my = Math.max(0, (image.naturalHeight * s - hauteur) / 2);
      return { zoom, x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
    },
    [image, echelle, largeur, hauteur]
  );

  const zoomer = useCallback(
    (zoom: number) =>
      setPos((p) => {
        const z = Math.min(ZOOM_MAX, Math.max(1, zoom));
        const k = echelle(z) / echelle(p.zoom);
        return borner({ zoom: z, x: p.x * k, y: p.y * k });
      }),
    [echelle, borner]
  );

  /** Découpe ce que montre le cadre, à la taille de sortie. */
  const decouper = useCallback(
    (p: Position, sortie = SORTIE, qualite = 0.86): string | null => {
      if (!image) return null;
      const s = echelle(p.zoom);
      const dw = image.naturalWidth * s;
      const dh = image.naturalHeight * s;
      const sx = ((dw - largeur) / 2 - p.x) / s;
      const sy = ((dh - hauteur) / 2 - p.y) / s;
      const canvas = document.createElement("canvas");
      canvas.width = sortie.l;
      canvas.height = sortie.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, sx, sy, largeur / s, hauteur / s, 0, 0, sortie.l, sortie.h);
      try {
        return canvas.toDataURL("image/jpeg", qualite);
      } catch {
        return null;
      }
    },
    [image, echelle, largeur, hauteur]
  );

  // L'aperçu de la carte, un peu après chaque geste.
  useEffect(() => {
    if (!image) return;
    const t = setTimeout(() => setApercu(decouper(pos, { l: 448, h: 380 }, 0.8)), 90);
    return () => clearTimeout(t);
  }, [image, pos, decouper]);

  function appui(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (doigts.current.size === 2) {
      const [a, b] = [...doigts.current.values()];
      pince.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: pos.zoom };
    }
  }

  function bouge(e: React.PointerEvent) {
    const avant = doigts.current.get(e.pointerId);
    if (!avant) return;
    doigts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (doigts.current.size === 2 && pince.current) {
      const [a, b] = [...doigts.current.values()];
      zoomer(pince.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pince.current.dist));
      return;
    }
    const dx = e.clientX - avant.x;
    const dy = e.clientY - avant.y;
    setPos((p) => borner({ ...p, x: p.x + dx, y: p.y + dy }));
  }

  function leve(e: React.PointerEvent) {
    doigts.current.delete(e.pointerId);
    if (doigts.current.size < 2) pince.current = null;
  }

  const s = echelle(pos.zoom);
  const dw = image ? image.naturalWidth * s : 0;
  const dh = image ? image.naturalHeight * s : 0;

  return (
    <Sheet open={!!src} onOpenChange={(o) => !o && onFermer()}>
      <SheetContent side="bottom" className="max-h-[94dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-[22px] font-bold tracking-tight">Placer ma photo</SheetTitle>
          <p className="text-[13px] text-muted-foreground">Fais glisser pour centrer ton visage, pince ou utilise le curseur pour zoomer.</p>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-5">
          {/* Le cadre, aux proportions de celui de la carte */}
          <div
            ref={cadre}
            className="relative w-full touch-none overflow-hidden rounded-[22px] bg-black select-none"
            style={{ height: hauteur, cursor: "grab" }}
            onPointerDown={appui}
            onPointerMove={bouge}
            onPointerUp={leve}
            onPointerCancel={leve}
            onWheel={(e) => zoomer(pos.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
          >
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{ width: dw, height: dh, left: (largeur - dw) / 2 + pos.x, top: (hauteur - dh) / 2 + pos.y }}
              />
            )}
            {/* Repères : la ligne des yeux (0,382 du portrait, le nombre d'or de la carte) et l'ovale du visage */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute inset-x-0 top-[38.2%] h-px bg-white/35" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
              <div className="absolute top-[13%] left-1/2 h-[52%] w-[40%] -translate-x-1/2 rounded-[50%] border-2 border-dashed border-white/55" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => zoomer(pos.zoom / 1.2)} aria-label="Dézoomer" className="grid size-9 place-items-center rounded-full bg-secondary">
              <Minus className="size-4" />
            </button>
            <input
              type="range"
              min={1}
              max={ZOOM_MAX}
              step={0.01}
              value={pos.zoom}
              onChange={(e) => zoomer(Number(e.target.value))}
              aria-label="Zoom"
              className="flex-1 accent-foreground"
            />
            <button type="button" onClick={() => zoomer(pos.zoom * 1.2)} aria-label="Zoomer" className="grid size-9 place-items-center rounded-full bg-secondary">
              <Plus className="size-4" />
            </button>
          </div>

          {/* L'aperçu : la carte telle que la ligue la verra */}
          <div className="flex items-center gap-4 rounded-[22px] bg-secondary/60 p-3">
            <BolaCard {...carte} edition="rare" size={0.42} photo={apercu} />
            <p className="text-[13px] leading-snug text-muted-foreground">
              Ta carte, telle que toute la ligue la verra.
            </p>
          </div>

          <div className="flex gap-2.5">
            <Button variant="secondary" className="h-12 flex-1 rounded-full text-[15px]" onClick={onFermer}>
              Annuler
            </Button>
            <Button
              className="h-12 flex-1 rounded-full text-[15px] font-semibold"
              disabled={!image}
              onClick={() => {
                const d = decouper(pos);
                if (d) onValider(d);
              }}
            >
              Valider
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
