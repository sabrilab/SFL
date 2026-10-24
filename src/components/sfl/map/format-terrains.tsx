"use client";

// Le format des terrains (Sabri, 24/10 : « nous, on fait actuellement du foot
// à 5, mais des fois, t'as mis des terrains qui sont pour du foot à plus que
// ça. Donc, qu'on puisse filtrer facilement pour voir les terrains qui nous
// plaisent ») : à 3, à 5, à 7, à 8, à 11, d'après le nom ou les dimensions de
// chaque terrain au recensement (tools/terrains-nord.ts, format()).
//
// PucesFormat, la rangée de pastilles : en toucher une ne garde que les
// complexes qui ont un terrain à ce format ; la retoucher les rend tous. Une
// pastille sans aucun terrain s'éteint. Elle sert dans la feuille « Terrains
// du Nord » (sur="feuille", les pilules de la page, claire ou sombre) et sur
// la Map (sur="plan", la nacre posée sur le plan clair). Le choix est le même
// partout et le téléphone le garde (hooks/use-format-terrain.ts).
//
// BoutonFormat, sur la Map : un bouton rond de la colonne de droite. Au
// repos, un petit terrain vu de dessus ; un format choisi, il passe à
// l'encre et l'écrit (« à 5 »). Le toucher déplie les pastilles de nacre à
// sa gauche (map/animations.css) ; un choix les replie, comme un toucher à
// côté, qui ne touche rien d'autre sur le plan. Les terrains grisés suivent
// (app/map/page.tsx).

import { useEffect, useRef, useState } from "react";
import { choisirFormatTerrain, useFormatTerrain } from "@/hooks/use-format-terrain";
import { FORMATS } from "@/lib/sfl/terrains-nord";
import { cn } from "@/lib/utils";

/** Un petit terrain vu de dessus : la ligne médiane, le rond central, les surfaces. */
export function IconeTerrain({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M2.5 9.5H5v5H2.5M21.5 9.5H19v5h2.5" />
    </svg>
  );
}

export function PucesFormat({
  sur,
  comptes,
  onChoix,
  className,
}: {
  /** La feuille (les pilules de la page) ou le plan (la nacre, sur le clair). */
  sur: "feuille" | "plan";
  /** Les complexes de chaque format : à 0, la pastille s'éteint. */
  comptes?: ReadonlyMap<number, number>;
  /** Après chaque toucher : le format gardé, ou null pour tous. */
  onChoix?: (format: number | null) => void;
  className?: string;
}) {
  const format = useFormatTerrain();
  return (
    <div role="group" aria-label="Le format des terrains" className={cn("grid grid-cols-5 gap-1.5", className)}>
      {FORMATS.map((f) => {
        const choisi = f === format;
        return (
          <button
            key={f}
            type="button"
            aria-pressed={choisi}
            disabled={!choisi && comptes?.get(f) === 0}
            onClick={() => {
              navigator.vibrate?.(6);
              const garde = choisi ? null : f;
              choisirFormatTerrain(garde);
              onChoix?.(garde);
            }}
            className={cn(
              "h-9 min-w-[2.75rem] px-2.5 text-[14px] font-semibold whitespace-nowrap tabular-nums",
              sur === "feuille" ? (choisi ? "bouton-principal" : "bouton-secondaire") : choisi ? "bouton-encre" : "bouton-givre"
            )}
          >
            à {f}
          </button>
        );
      })}
    </div>
  );
}

export function BoutonFormat({ comptes, className }: { comptes?: ReadonlyMap<number, number>; className?: string }) {
  const format = useFormatTerrain();
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  const replier = useRef<number | null>(null);

  // Ouvert : un toucher hors du bouton et des pastilles les replie (sur le
  // plan, le voile le prend ; ailleurs, le toucher garde son effet), Échap aussi.
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
  useEffect(() => () => void (replier.current != null && window.clearTimeout(replier.current)), []);

  return (
    <div ref={boite} className={cn("relative z-10", className)}>
      {/* Le voile : un toucher sur le plan replie les pastilles sans rien ouvrir dessous. */}
      {ouvert && <div className="fixed inset-0" onClick={() => setOuvert(false)} aria-hidden />}
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-label={format ? `Terrains à ${format} seulement` : "Les terrains par format"}
        className={cn("map-bord map-touche relative grid size-10 place-items-center", format ? "bouton-encre" : "bouton-givre")}
      >
        {format ? (
          <span key={format} className="format-entre font-mono text-[11px] font-bold tracking-tight">
            à {format}
          </span>
        ) : (
          <IconeTerrain className="size-[19px]" />
        )}
      </button>
      <div data-ouvert={ouvert} inert={!ouvert} className="format-deplie absolute top-1/2 right-[calc(100%+8px)] w-max">
        <PucesFormat
          sur="plan"
          comptes={comptes}
          onChoix={() => {
            // Le temps de voir la pastille changer, puis tout se replie.
            if (replier.current != null) window.clearTimeout(replier.current);
            replier.current = window.setTimeout(() => setOuvert(false), 260);
          }}
          className="flex"
        />
      </div>
    </div>
  );
}
