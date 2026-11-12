"use client";

// Les petits contrôles de Bola Club, ceux de l'app : les puces d'un filtre
// (les pilules de la Ligue vierge : la choisie en bouton principal, les
// autres cerclées), le segment de verre (les onglets des Actus), le compteur
// − / + d'une saisie rapide, et le gabarit d'une page enfant (le retour et
// son titre, comme une rubrique de Ma carte) et celui d'une feuille (ui/
// sheet.tsx : son titre, son contenu). Noir et blanc, en currentColor.

import { Minus, Plus } from "lucide-react";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const NOMBRE = { fontFamily: ANTON, lineHeight: 0.9 } as const;

/** Un filtre en puces, qu'on fait défiler quand elles ne tiennent pas. */
export function Puces<T extends string>({
  nom,
  choix,
  actif,
  onChange,
  className,
}: {
  nom: string;
  choix: readonly { id: T; label: string }[];
  actif: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={nom}
      className={cn("flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
    >
      {choix.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={actif === c.id}
          onClick={() => onChange(c.id)}
          className={cn("shrink-0 px-4 py-2 text-corps font-semibold whitespace-nowrap", actif === c.id ? "bouton-principal" : "bouton-secondaire text-encre-2")}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** Un choix parmi deux à quatre, dans une barre de verre. */
export function Segment<T extends string>({
  nom,
  choix,
  actif,
  onChange,
  className,
}: {
  nom: string;
  choix: readonly { id: T; label: string }[];
  actif: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={nom} className={cn("glass flex gap-1 rounded-full p-1", className)}>
      {choix.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={actif === c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "min-w-0 flex-1 py-2 font-semibold whitespace-nowrap",
            // À quatre, les libellés se serrent pour tenir sur un petit téléphone.
            choix.length > 3 ? "px-0.5 text-petit tracking-tight" : "px-2 text-corps",
            actif === c.id ? "bouton-principal" : "bouton-discret text-muted-foreground",
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** Un compteur − / + : les buts, les passes, le score. */
export function Compteur({ nom, valeur, onChange, max = 20, grand = false }: { nom: string; valeur: number; onChange: (n: number) => void; max?: number; grand?: boolean }) {
  const rond = cn("bouton-secondaire grid shrink-0 place-items-center", grand ? "size-11" : "size-9");
  return (
    <span role="group" aria-label={nom} className="flex items-center gap-1.5">
      <button type="button" aria-label={`${nom} : un de moins`} disabled={valeur <= 0} onClick={() => onChange(valeur - 1)} className={rond}>
        <Minus className="size-4" strokeWidth={2.4} />
      </button>
      <span aria-live="polite" style={{ ...NOMBRE, fontSize: grand ? 44 : 24 }} className={cn("text-center tabular-nums", grand ? "w-12" : "w-7", valeur === 0 && !grand && "text-foreground/30")}>
        {valeur}
      </span>
      <button type="button" aria-label={`${nom} : un de plus`} disabled={valeur >= max} onClick={() => onChange(valeur + 1)} className={rond}>
        <Plus className="size-4" strokeWidth={2.4} />
      </button>
    </span>
  );
}

/** Une page enfant du club : le retour, son titre, son contenu (le gabarit d'une rubrique de Ma carte). */
export function PageEnfant({ titre, sous, children }: { titre: string; sous?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-[var(--fib-21)] px-5 py-4 sm:py-8 lg:max-w-2xl">
      <div className="flex items-center gap-3">
        <BoutonRetour />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[30px] leading-[1.05] font-bold tracking-tight text-balance">{titre}</h1>
          {sous && <span className="mono-label text-encre-3">{sous}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Le titre d'une section d'une page enfant. */
export function TitreSection({ children, droite }: { children: React.ReactNode; droite?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-titre-fort leading-none font-bold tracking-tight">{children}</h2>
      {droite}
    </div>
  );
}

/** Le dessin d'une fiche : un bloc sur le fond de la page. */
export const FICHE = "rounded-[22px] bg-card";
/** Une ligne de liste. */
export const LIGNE = "flex items-center gap-3 rounded-[18px] bg-card px-3 py-2";

/** Le champ d'une feuille : une ligne, ou un texte. Sans libellé visible : `nom` le dit au lecteur d'écran. */
export const CHAMP =
  "w-full rounded-[18px] border border-foreground/10 bg-foreground/[0.04] px-4 py-3 text-[16px] leading-snug outline-none placeholder:text-foreground/30 focus-visible:border-foreground/40";

/** Une feuille du bas : son titre, son contenu (le dessin des feuilles de l'app). */
export function Feuille({ titre, open, onOpenChange, children }: { titre: string; open: boolean; onOpenChange: (o: boolean) => void; children: React.ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} titre={titre}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:max-w-md">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="pr-10 text-[24px] font-bold tracking-tight">{titre}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
