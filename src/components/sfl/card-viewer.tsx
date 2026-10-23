"use client";

// Viewer global de carte : n'importe quelle carte affichée dans l'app
// peut s'ouvrir en grand dans une pop-up et se manipuler en 3D, comme
// dans la Collection. Fournit un contexte `useCardViewer()` + un wrapper
// pratique `<ViewableCard>` qui rend une Card3D cliquable.
//
// La carte d'un joueur (`joueur`, son nom de saison) porte sous son nom ses
// abonnés, de quoi le suivre (suivre.tsx ; Sabri, 22/10 : « voir le nombre
// de followers de chaque utilisateur quand on clique sur sa carte »), et
// son profil.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { isHidden } from "@/lib/sfl/hidden";
import { Card3D, prechaufferCarte } from "./card-3d";
import { Abonnes, BoutonSuivre, pluriel } from "./suivre";

interface ViewedCard {
  cacheKey: string;
  mode: "simple" | "rare";
  title: string;
  subtitle?: string;
  /** La carte d'un joueur de la ligue : son nom de saison. */
  joueur?: string;
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
  const open = useCallback((card: ViewedCard) => setViewed(card), []);
  const router = useRouter();

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
                apercu
              />
              <div className="flex flex-col items-center gap-0.5 rounded-3xl bg-card px-5 py-3 text-center">
                <span className="text-base font-bold">{viewed.title}</span>
                {viewed.subtitle && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {viewed.subtitle}
                  </span>
                )}
                {viewed.joueur && (
                  <div className="mt-2 flex items-center gap-3">
                    <Abonnes nom={viewed.joueur}>
                      {(n) => (
                        <span className="font-mono text-[12px] text-muted-foreground">
                          <span className="font-bold text-foreground tabular-nums">{n}</span> {pluriel(n, "abonné", "abonnés")}
                        </span>
                      )}
                    </Abonnes>
                    <BoutonSuivre nom={viewed.joueur} petit />
                  </div>
                )}
                {viewed.joueur && !isHidden(viewed.joueur) && (
                  <button
                    type="button"
                    onClick={() => {
                      const nom = viewed.joueur!;
                      setViewed(null);
                      router.push(`/recherche?joueur=${encodeURIComponent(nom)}`);
                    }}
                    className="bouton-discret mt-1 px-3 py-1.5 text-[13px] font-semibold"
                  >
                    Voir son profil
                  </button>
                )}
              </div>
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
      onPointerDown={(e) => {
        setDownAt({ x: e.clientX, y: e.clientY });
        prechaufferCarte();
      }}
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
