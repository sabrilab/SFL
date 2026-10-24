"use client";

// Les pièces communes des écrans de l'accueil (accueil.tsx) : la barre du
// haut (le retour, les segments du profil, ce qu'on peut passer), le corps
// d'un écran (son contenu au centre, son geste sous le pouce) et ses textes.
//
// La partie obligatoire se reconnaît sans un mot : des segments en haut,
// comme les stories, et rien pour passer. La découverte, elle, a « Passer ».

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronLeft } from "lucide-react";
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
 * Le corps d'un écran : le contenu au centre, et sous le pouce son geste
 * principal. Posé dans le cadre de l'écran (absolute), pour que deux écrans
 * glissent l'un sur l'autre.
 *
 * Tout doit tenir sans défiler. Un écran qui sait se resserrer donne ses
 * `niveaux` et se dessine selon le niveau (children(niveau), du plus ample,
 * 0, au plus serré) : le corps garde le plus ample qui tient dans sa place,
 * mesuré avant d'être peint, et de nouveau quand la place ou le contenu
 * changent (rotation, polices). S'il déborde quand même (très petit écran,
 * téléphone en largeur), le bas s'estompe et un chevron dit qu'il reste
 * quelque chose en dessous ; le toucher y descend.
 */
export function Corps({
  children,
  pied,
  haut = false,
  niveaux = 1,
  className,
}: {
  children: ReactNode | ((niveau: number) => ReactNode);
  pied?: ReactNode;
  /** Le contenu part du haut au lieu d'être centré (listes, recherche). */
  haut?: boolean;
  /** Le nombre de façons de se dessiner, de la plus ample à la plus serrée. */
  niveaux?: number;
  className?: string;
}) {
  const { clavier } = useContexteAccueil();
  const reduit = useReducedMotion();
  const defile = useRef<HTMLDivElement>(null);
  const contenu = useRef<HTMLDivElement>(null);
  const [essai, setEssai] = useState({ niveau: 0, tour: 0 });
  // Ce qu'on a mesuré au dernier essai : ce qui change ensuite relance l'essai.
  const mesure = useRef({ place: 0, contenu: 0 });
  const [suite, setSuite] = useState(false);

  const voir = useCallback(() => {
    const el = defile.current;
    // Le bas du contenu (sa marge) peut dépasser sans rien cacher.
    if (el) setSuite(el.scrollHeight - el.clientHeight - el.scrollTop > 21);
  }, []);

  // Le plus ample qui tient : les essais se suivent avant que l'écran soit peint.
  useLayoutEffect(() => {
    const el = defile.current;
    if (!el || !contenu.current) return;
    if (essai.niveau < niveaux - 1 && el.scrollHeight > el.clientHeight + 1) {
      setEssai((e) => ({ ...e, niveau: e.niveau + 1 }));
      return;
    }
    mesure.current = { place: el.clientHeight, contenu: contenu.current.offsetHeight };
    voir();
  }, [essai, niveaux, voir]);

  useEffect(() => {
    const el = defile.current;
    const dedans = contenu.current;
    if (!el || !dedans) return;
    const obs = new ResizeObserver(() => {
      const m = mesure.current;
      if (Math.abs(el.clientHeight - m.place) < 1 && Math.abs(dedans.offsetHeight - m.contenu) < 1) return;
      mesure.current = { place: el.clientHeight, contenu: dedans.offsetHeight };
      if (niveaux > 1) setEssai((e) => ({ niveau: 0, tour: e.tour + 1 }));
      else voir();
    });
    obs.observe(el);
    obs.observe(dedans);
    return () => obs.disconnect();
  }, [niveaux, voir]);

  function descendre() {
    const el = defile.current;
    el?.scrollBy({ top: el.clientHeight * 0.8, behavior: reduit ? "auto" : "smooth" });
  }

  // Le bas qui s'estompe : le contenu lui-même, quel que soit le fond.
  const estompe = suite ? "linear-gradient(to bottom, #000 calc(100% - 89px), transparent calc(100% - 8px))" : undefined;

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative min-h-0 flex-1">
        <div
          ref={defile}
          onScroll={voir}
          className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain"
          style={{ maskImage: estompe, WebkitMaskImage: estompe }}
        >
          <div
            ref={contenu}
            className={cn(
              "mx-auto flex min-h-full w-full max-w-[420px] flex-col items-center px-[21px] py-[13px]",
              haut ? "justify-start" : "justify-center",
              className
            )}
          >
            {typeof children === "function" ? children(essai.niveau) : children}
          </div>
        </div>
        <AnimatePresence>
          {suite && (
            <motion.div
              key="suite"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-none absolute inset-x-0 bottom-[5px] flex justify-center"
            >
              <button
                type="button"
                onClick={descendre}
                aria-label="Voir la suite"
                className="glass-soft pointer-events-auto grid size-[34px] place-items-center rounded-full bg-background/80 text-foreground/80 active:scale-95"
              >
                <motion.span
                  className="grid place-items-center"
                  animate={reduit ? undefined : { y: [0, 3, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ChevronDown className="size-[18px]" />
                </motion.span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
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
  eteint = false,
  ton = "vert",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** Il manque un choix : le bouton paraît éteint, mais le toucher montre ce qui manque. */
  eteint?: boolean;
  ton?: "vert" | "or" | "mauve";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={eteint || undefined}
      className={cn(
        "bouton-principal flex w-full items-center justify-center gap-2 py-[16px] text-[15px] font-bold disabled:opacity-40",
        eteint && "opacity-40",
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
