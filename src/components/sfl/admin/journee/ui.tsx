"use client";

// Les briques de l'admin redessiné (30/10/2026), dans le langage des écrans
// joueurs : les segmentés de CarteJournee, la pastille d'état en mono, le pas
// − valeur + de FeuilleBola (44 px au doigt), et la feuille du bas des
// joueurs (rounded-t-[28px], titre en 26 px, un seul bouton principal en
// bas). Noir et blanc seulement ; la braise ne sert qu'à « Il manque N ».

import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { EtatJournee } from "@/lib/sfl/saisie/etat-journee";
import { haptique } from "@/lib/sfl/haptique";
import { cn } from "@/lib/utils";

export const ETATS: Record<EtatJournee, { signe: string; libelle: string }> = {
  brouillon: { signe: "○", libelle: "Brouillon" },
  "en-ligne": { signe: "●", libelle: "En ligne" },
  "en-direct": { signe: "◉", libelle: "En direct" },
  terminee: { signe: "✓", libelle: "Terminée" },
};

/** `○ BROUILLON`, `● EN LIGNE · 18:42`, `◉ EN DIRECT`, `✓ TERMINÉE`. */
export function PastilleEtat({ etat, suffixe, className }: { etat: EtatJournee; suffixe?: string | null; className?: string }) {
  const e = ETATS[etat];
  return (
    <span
      className={cn(
        "mono-label inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3",
        etat === "brouillon" ? "border border-dashed border-foreground/55 text-foreground/85" : "bg-foreground text-background",
        className
      )}
    >
      <span aria-hidden>{e.signe}</span>
      {e.libelle}
      {suffixe && <span className="opacity-70">· {suffixe}</span>}
    </span>
  );
}

/** Le segmenté des joueurs (CarteJournee, FeuilleBola) : une pilule, la valeur choisie en nacre. */
export function Segmente<T extends string | number>({
  options,
  valeur,
  onChange,
  className,
  taille = "md",
  label,
}: {
  options: { id: T; libelle: ReactNode; pointille?: boolean; marque?: boolean }[];
  valeur: T;
  onChange: (v: T) => void;
  className?: string;
  taille?: "md" | "sm";
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 rounded-full bg-secondary p-1", className)}>
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          role="tab"
          aria-selected={valeur === o.id}
          onClick={() => {
            if (valeur !== o.id) haptique.choix();
            onChange(o.id);
          }}
          className={cn(
            "relative flex flex-1 items-center justify-center gap-1 rounded-full font-semibold whitespace-nowrap transition-colors",
            taille === "sm" ? "h-8 px-3 text-[12.5px]" : "h-10 px-3.5 text-[14px]",
            valeur === o.id ? "bouton-principal" : "text-foreground/55",
            o.pointille && valeur !== o.id && "border border-dashed border-foreground/35"
          )}
        >
          {o.libelle}
          {o.marque && <span aria-label="à corriger" className="mono-label absolute -top-1 -right-0.5 grid size-4 place-items-center rounded-full bg-foreground text-[9px] text-background">!</span>}
        </button>
      ))}
    </div>
  );
}

/** − valeur + : un compteur au pouce. */
export function Pas({
  valeur,
  onChange,
  label,
  min = 0,
  max = 99,
  grand = false,
}: {
  valeur: number;
  onChange: (n: number) => void;
  label: string;
  min?: number;
  max?: number;
  grand?: boolean;
}) {
  const k = grand ? "size-14" : "size-11";
  return (
    <div className="flex items-center gap-1.5" aria-label={label}>
      <button
        type="button"
        aria-label={`${label} : un de moins`}
        disabled={valeur <= min}
        onClick={() => {
          haptique.retrait();
          onChange(valeur - 1);
        }}
        className={cn("bouton-secondaire grid place-items-center disabled:opacity-30", k)}
      >
        <Minus className="size-4" />
      </button>
      <span className={cn("text-center font-bold tabular-nums", grand ? "w-9 text-[24px]" : "w-7 text-[18px]")}>{valeur}</span>
      <button
        type="button"
        aria-label={`${label} : un de plus`}
        disabled={valeur >= max}
        onClick={() => {
          haptique.ajout();
          onChange(valeur + 1);
        }}
        className={cn("bouton-secondaire grid place-items-center disabled:opacity-30", k)}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Une étiquette en mono, comme « QUAND », « BUTS ». */
export function Etiquette({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mono-label text-foreground/45", className)}>{children}</p>;
}

/** Une pastille qui se touche (date, heure, lieu, un choix parmi d'autres). */
export function Pastille({
  children,
  actif,
  onClick,
  pointille,
  className,
}: {
  children: ReactNode;
  actif?: boolean;
  onClick?: () => void;
  pointille?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptique.choix();
        onClick?.();
      }}
      aria-pressed={actif}
      className={cn(
        "mono-label inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 transition-colors",
        actif ? "bg-foreground text-background" : "bg-secondary text-foreground/75",
        pointille && !actif && "border border-dashed border-foreground/35 bg-transparent",
        className
      )}
    >
      {children}
    </button>
  );
}

/** La feuille du bas des écrans joueurs : titre en 26 px, l'état à droite, un bouton en bas. */
export function Feuille({
  open,
  onOpenChange,
  titre,
  etat,
  bas,
  children,
  haute = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  titre: string;
  etat?: ReactNode;
  bas?: ReactNode;
  children: ReactNode;
  haute?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} titre={titre}>
      <SheetContent
        side="bottom"
        className={cn(
          "max-h-[92dvh] gap-0 rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]",
          haute && "data-[side=bottom]:h-[92dvh]"
        )}
      >
        <SheetHeader className="items-start gap-2 px-5 pt-5 pr-14 pb-3">
          <SheetTitle className="text-[26px] leading-tight font-bold tracking-tight">{titre}</SheetTitle>
          {etat}
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">{children}</div>
        {bas && <div className="flex shrink-0 flex-col gap-2 px-4 pt-2">{bas}</div>}
      </SheetContent>
    </Sheet>
  );
}
