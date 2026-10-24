"use client";

// Une feuille qui monte du bas et reste dans son cadre (Sabri, 22/10 : en
// ouvrant un match, « on sort du cadrage quand on scrolle »). Trois étages :
// le titre et la croix restent en haut, seul le milieu défile (sans
// entraîner la page derrière), et le geste principal reste en bas, sous le
// pouce. Sur iPhone, en PWA, le clavier recouvre la page sans la
// redimensionner, et iOS fait glisser la page pour montrer le champ touché :
// la feuille suit la partie visible (useVueVisible) et se pose juste
// au-dessus du clavier, au lieu de partir avec la page.

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useVueVisible } from "@/hooks/use-vue-visible";

export function FeuilleCadree({
  open,
  onOpenChange,
  titre,
  surtitre,
  pied,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titre: ReactNode;
  surtitre?: ReactNode;
  /** Le geste principal, toujours visible en bas. */
  pied?: ReactNode;
  children: ReactNode;
}) {
  const vue = useVueVisible();
  // Le bas de la partie visible, mesuré depuis le bas de la page : 0 sans
  // clavier, la hauteur du clavier quand il est ouvert.
  const dessous = vue.hauteur > 0 && typeof window !== "undefined" ? Math.max(0, window.innerHeight - vue.haut - vue.hauteur) : 0;
  const clavier = dessous > 80;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} titre={typeof titre === "string" ? titre : undefined}>
      <SheetContent
        side="bottom"
        className="flex flex-col gap-0 overflow-hidden rounded-t-[28px] p-0"
        style={{
          bottom: dessous,
          maxHeight: vue.hauteur > 0 ? Math.round(vue.hauteur * (clavier ? 0.98 : 0.92)) : "92dvh",
        }}
      >
        {/* Le titre sous la poignée, sans la toucher : la croix du coin remonte
            la feuille de 16 px (sheet.tsx). Sabri, 23/10. */}
        <SheetHeader className="shrink-0 px-5 pt-8 pb-3">
          {surtitre && <p className="mono-label pr-10 text-muted-foreground">{surtitre}</p>}
          <SheetTitle className="pr-10 text-[26px] leading-[1.15] font-bold tracking-tight">{titre}</SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 [contain:paint]">{children}</div>
        {pied && (
          <div
            className="shrink-0 border-t border-border/40 bg-popover px-4 pt-3"
            style={{ paddingBottom: clavier ? 12 : "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
          >
            {pied}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
