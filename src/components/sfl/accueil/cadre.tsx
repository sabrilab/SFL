"use client";

// Les pièces communes des écrans de l'accueil (accueil.tsx) : la barre du
// haut (le retour, les segments du profil, ce qu'on peut passer), le corps
// d'un écran (son contenu au centre, son geste sous le pouce) et ses textes.
//
// La partie obligatoire se reconnaît sans un mot : des segments en haut,
// comme les stories, et rien pour passer. La découverte, elle, a « Passer ».

import { createContext, useContext, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ce que tous les écrans savent : `demo`, l'aperçu (rien n'est lu ni écrit,
 * voir accueil.tsx) ; `clavier`, le clavier de l'iPhone ouvert (la carte se
 * fait petite pour laisser voir les champs) ; `court`, un écran bas (iPhone
 * SE, mini) : les écrans se resserrent pour que tout tienne sans défiler.
 */
export const ContexteAccueil = createContext({ demo: false, clavier: false, court: false });
export const useContexteAccueil = () => useContext(ContexteAccueil);

/** La barre du haut : le retour à gauche, les segments au milieu, un geste à droite. */
export function Entete({
  onRetour,
  segments,
  droite,
}: {
  onRetour?: () => void;
  /** La partie obligatoire : n segments, dont i (de 0) est l'écran en cours. */
  segments?: { i: number; n: number } | null;
  droite?: ReactNode;
}) {
  return (
    <div className="relative z-10 mx-auto flex h-[55px] w-full max-w-[420px] shrink-0 items-center gap-[13px] px-[21px]">
      <div className="flex w-[34px] shrink-0 justify-start">
        {onRetour && (
          <button
            type="button"
            onClick={onRetour}
            aria-label="Retour"
            className="glass-soft grid size-[34px] place-items-center rounded-full text-foreground/80 active:scale-95"
          >
            <ChevronLeft className="size-[18px]" />
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 justify-center">{segments && segments.n > 1 && <Segments {...segments} />}</div>
      <div className="flex min-w-[34px] shrink-0 justify-end">{droite}</div>
    </div>
  );
}

/** Les segments du profil : faits et en cours pleins, à venir éteints. */
function Segments({ i, n }: { i: number; n: number }) {
  const reduit = useReducedMotion();
  return (
    <ol className="flex w-full max-w-[260px] gap-[5px]" aria-label={`Étape ${i + 1} sur ${n}`}>
      {Array.from({ length: n }, (_, k) => (
        <li key={k} className="h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/15">
          <motion.span
            className="block h-full origin-left rounded-full bg-foreground"
            initial={false}
            animate={{ scaleX: k <= i ? 1 : 0 }}
            transition={reduit ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30 }}
          />
        </li>
      ))}
    </ol>
  );
}

/**
 * Le corps d'un écran : le contenu au centre (il défile s'il déborde), et
 * sous le pouce son geste principal. Posé dans le cadre de l'écran
 * (absolute), pour que deux écrans glissent l'un sur l'autre.
 */
export function Corps({
  children,
  pied,
  haut = false,
  className,
}: {
  children: ReactNode;
  pied?: ReactNode;
  /** Le contenu part du haut au lieu d'être centré (listes, recherche). */
  haut?: boolean;
  className?: string;
}) {
  const { clavier } = useContexteAccueil();
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div
          className={cn(
            "mx-auto flex min-h-full w-full max-w-[420px] flex-col items-center px-[21px] py-[13px]",
            haut ? "justify-start" : "justify-center",
            className
          )}
        >
          {children}
        </div>
      </div>
      {pied && (
        <div
          className="relative z-10 mx-auto flex w-full max-w-[420px] shrink-0 flex-col items-center gap-[5px] px-[21px] pt-[8px]"
          // Clavier ouvert : il recouvre déjà le bas de l'écran.
          style={{ paddingBottom: clavier ? 13 : "max(env(safe-area-inset-bottom), 21px)" }}
        >
          {pied}
        </div>
      )}
    </div>
  );
}

export function Titre({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h1 id={id} className="text-center text-[30px] leading-[1.06] font-extrabold tracking-tight text-balance text-white">
      {children}
    </h1>
  );
}

export function Ligne({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mt-[8px] max-w-[310px] text-center text-[14.5px] leading-snug text-pretty text-white/60", className)}>
      {children}
    </p>
  );
}

/** Le geste principal d'un écran. */
export function BoutonPrincipal({
  children,
  onClick,
  disabled,
  ton = "vert",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  ton?: "vert" | "or" | "mauve";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "bouton-principal flex w-full items-center justify-center gap-2 py-[16px] text-[15px] font-bold disabled:opacity-40",
        ton === "vert" ? "bouton--vert" : ton === "or" ? "bouton--or" : "bouton--mauve"
      )}
    >
      {children}
    </button>
  );
}

/** Le geste d'à côté : « Plus tard », « Me déconnecter »… */
export function BoutonDiscret({
  children,
  onClick,
  rouge = false,
}: {
  children: ReactNode;
  onClick: () => void;
  rouge?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("bouton-discret px-6 py-[10px] text-[14px] font-semibold", rouge && "bouton--rouge text-[13px]")}
    >
      {children}
    </button>
  );
}
