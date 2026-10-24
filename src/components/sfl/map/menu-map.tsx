"use client";

// Le menu de la Map (Sabri, 24/10 : « tous les onglets qui sont sur la
// droite, ça commence à faire beaucoup. Donc, t'en sélectionnes quelques-uns,
// pas tous, ou alors tu mets un bouton qui puisse filtrer avec tous les
// autres en menu déroulant ») : la colonne de droite ne garde que la loupe et
// ce bouton (app/map/page.tsx). Il déplie sous lui une feuille de nacre :
//   · ce que la Map montre, en interrupteurs : les joueurs, les terrains
//     libres et leur format (map/format-terrains.tsx), les contrats en jeu
//     le dimanche, la vue satellite ;
//   · les raccourcis : les joueurs ville par ville, mes dispos ;
//   · pour l'admin : l'activité, les matchs et terrains, la journée.
// Un interrupteur laisse le menu ouvert (on en bascule plusieurs) ; un
// raccourci le referme, comme un toucher à côté (qui ne touche rien d'autre
// sur le plan) ou Échap. Un point sur le bouton dit qu'un filtre est posé :
// des joueurs ou des terrains masqués, un format, les contrats, le satellite.
// La Map reste claire dans les deux modes : la feuille aussi, ses couleurs
// sont écrites en dur. Le mouvement est dans app/map/animations.css.

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BasculeMenu {
  id: string;
  libelle: string;
  icone: ReactNode;
  actif: boolean;
  onChange: (actif: boolean) => void;
  /** Ce qui se règle dessous quand il est allumé (le format des terrains). */
  dessous?: ReactNode;
}

export interface RaccourciMenu {
  id: string;
  libelle: string;
  icone: ReactNode;
  /** La couleur de l'icône : le ton de sa famille de gestes (boutons.css), en sombre sur la nacre. */
  ton?: string;
  href?: string;
  onClick?: () => void;
}

const ENCRE = "#121316";

function Titre({ children }: { children: ReactNode }) {
  return <p className="px-3 pt-2.5 pb-1 font-mono text-[9.5px] font-bold tracking-[1.2px] text-[#121316]/45 uppercase">{children}</p>;
}

/** L'interrupteur : l'encre allumé, un gris de papier éteint (le noir et blanc du plan). */
function Interrupteur({ actif }: { actif: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("relative h-[23px] w-[38px] shrink-0 rounded-full transition-colors duration-200", actif ? "bg-[#0a0b0d]" : "bg-[#0a0b0d]/[0.14]")}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] size-[19px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200",
          actif && "translate-x-[15px]"
        )}
      />
    </span>
  );
}

export function MenuMap({
  bascules,
  raccourcis,
  admin = [],
  filtre,
  className,
}: {
  bascules: BasculeMenu[];
  raccourcis: RaccourciMenu[];
  admin?: RaccourciMenu[];
  /** Un filtre est posé : un point sur le bouton. */
  filtre: boolean;
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  // Ouvert : un toucher hors du bouton et de la feuille la replie, Échap aussi.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (e.target instanceof Node && boite.current?.contains(e.target)) return;
      setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false);
    document.addEventListener("pointerdown", dehors, true);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("pointerdown", dehors, true);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert]);

  const ligne = "flex h-12 w-full items-center gap-3 rounded-[16px] px-3 text-left text-[15px] font-semibold tracking-[-0.2px] active:bg-[#0a0b0d]/[0.06]";
  const raccourci = (r: RaccourciMenu) => {
    const dedans = (
      <>
        <span className="grid size-[22px] shrink-0 place-items-center" style={{ color: r.ton ?? ENCRE }}>
          {r.icone}
        </span>
        <span className="min-w-0 flex-1 truncate">{r.libelle}</span>
        <ChevronRight className="size-4 shrink-0 text-[#121316]/30" strokeWidth={2.4} />
      </>
    );
    const fermer = () => setOuvert(false);
    return r.href ? (
      <Link key={r.id} href={r.href} onClick={fermer} className={ligne}>
        {dedans}
      </Link>
    ) : (
      <button
        key={r.id}
        type="button"
        onClick={() => {
          fermer();
          r.onClick?.();
        }}
        className={ligne}
      >
        {dedans}
      </button>
    );
  };

  return (
    <div ref={boite} className={cn("relative", className)}>
      {/* Le voile : un toucher sur le plan replie le menu sans rien ouvrir dessous. */}
      {ouvert && <div className="fixed inset-0" onClick={() => setOuvert(false)} aria-hidden />}
      <button
        type="button"
        onClick={() => {
          navigator.vibrate?.(5);
          setOuvert((o) => !o);
        }}
        aria-expanded={ouvert}
        aria-label={filtre ? "Filtres et raccourcis, un filtre est posé" : "Filtres et raccourcis"}
        className={cn("map-bord map-touche relative grid size-10 place-items-center", ouvert ? "bouton-encre" : "bouton-givre")}
      >
        <SlidersHorizontal className="size-[18px]" strokeWidth={2.2} />
        {filtre && !ouvert && <span aria-hidden className="absolute top-[7px] right-[7px] size-[9px] rounded-full border-2 border-[#f4f1ed] bg-[#0a0b0d]" />}
      </button>
      <div
        data-ouvert={ouvert}
        inert={!ouvert}
        className="menu-map absolute top-[calc(100%+8px)] right-0 max-h-[calc(100dvh-14rem)] w-[272px] overflow-y-auto overscroll-contain rounded-[22px] p-1.5 text-[#121316]"
      >
        <Titre>Sur la Map</Titre>
        {bascules.map((b) => (
          <div key={b.id}>
            <button
              type="button"
              role="switch"
              aria-checked={b.actif}
              onClick={() => {
                navigator.vibrate?.(5);
                b.onChange(!b.actif);
              }}
              className={ligne}
            >
              <span className="grid size-[22px] shrink-0 place-items-center text-[#121316]/80">{b.icone}</span>
              <span className="min-w-0 flex-1 truncate">{b.libelle}</span>
              <Interrupteur actif={b.actif} />
            </button>
            {b.actif && b.dessous && <div className="px-2 pt-0.5 pb-2">{b.dessous}</div>}
          </div>
        ))}
        {raccourcis.length > 0 && (
          <>
            <div className="mx-3 my-1 h-px bg-[#0a0b0d]/[0.08]" />
            {raccourcis.map(raccourci)}
          </>
        )}
        {admin.length > 0 && (
          <>
            <div className="mx-3 my-1 h-px bg-[#0a0b0d]/[0.08]" />
            <Titre>Admin</Titre>
            {admin.map(raccourci)}
          </>
        )}
      </div>
    </div>
  );
}
