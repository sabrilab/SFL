"use client";

// Viewer global de carte : n'importe quelle carte affichée dans l'app
// peut s'ouvrir en grand dans une pop-up et se manipuler en 3D, comme
// dans la Collection. Fournit un contexte `useCardViewer()` + un wrapper
// pratique `<ViewableCard>` qui rend une Card3D cliquable.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cardToPng, downloadPng, safeFileName } from "@/lib/sfl/card-export";
import { Card3D } from "./card-3d";

interface ViewedCard {
  cacheKey: string;
  mode: "simple" | "rare";
  title: string;
  subtitle?: string;
  render: (size: number) => ReactNode;
}

const CardViewerContext = createContext<{ open: (card: ViewedCard) => void }>({
  open: () => {},
});

export function useCardViewer() {
  return useContext(CardViewerContext);
}

export function CardViewerProvider({ children }: { children: ReactNode }) {
  const [viewed, setViewed] = useState<ViewedCard | null>(null);
  const [exporting, setExporting] = useState(false);
  const open = useCallback((card: ViewedCard) => setViewed(card), []);

  async function downloadViewed() {
    if (!viewed || exporting) return;
    setExporting(true);
    try {
      const name = [viewed.title, viewed.subtitle].filter(Boolean).join(" ");
      const dataUrl = await cardToPng(viewed.render(1));
      downloadPng(dataUrl, `SFL_${safeFileName(name)}`);
      toast.success("Carte exportée en PNG");
    } catch {
      toast.error("Export impossible");
    } finally {
      setExporting(false);
    }
  }

  return (
    <CardViewerContext.Provider value={{ open }}>
      {children}
      <Dialog open={viewed !== null} onOpenChange={(o) => !o && setViewed(null)}>
        <DialogContent className="flex max-w-xs flex-col items-center gap-4 bg-transparent p-0 shadow-none ring-0">
          <DialogTitle className="sr-only">{viewed?.title ?? "Carte"}</DialogTitle>
          {viewed && (
            <>
              <Card3D
                cacheKey={`viewer-${viewed.cacheKey}`}
                mode={viewed.mode}
                size={1.15}
                render={viewed.render}
              />
              <div className="flex flex-col items-center gap-0.5 rounded-3xl bg-card px-5 py-3 text-center">
                <span className="text-base font-bold">{viewed.title}</span>
                {viewed.subtitle && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {viewed.subtitle}
                  </span>
                )}
              </div>
              <button
                onClick={downloadViewed}
                disabled={exporting}
                className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity active:opacity-70 disabled:opacity-60"
              >
                {exporting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {exporting ? "Export…" : "Télécharger PNG"}
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </CardViewerContext.Provider>
  );
}

// Carte 3D cliquable : le tap (sans glissement) ouvre le viewer.
// On distingue tap et drag pour ne pas ouvrir la pop-up quand on
// manipule simplement la carte en place.
export function ViewableCard({
  cacheKey,
  mode,
  size,
  title,
  subtitle,
  render,
}: {
  cacheKey: string;
  mode: "simple" | "rare";
  size: number;
  title: string;
  subtitle?: string;
  render: (size: number) => ReactNode;
}) {
  const { open } = useCardViewer();
  const [downAt, setDownAt] = useState<{ x: number; y: number } | null>(null);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Voir la carte ${title} en grand`}
      onPointerDown={(e) => setDownAt({ x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 8) {
          open({ cacheKey, mode, title, subtitle, render });
        }
        setDownAt(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open({ cacheKey, mode, title, subtitle, render });
        }
      }}
      className="cursor-pointer"
    >
      <Card3D cacheKey={cacheKey} mode={mode} size={size} render={render} />
    </div>
  );
}
