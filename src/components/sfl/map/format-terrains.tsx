"use client";

// Le format des terrains (Sabri, 24/10 : « nous, on fait actuellement du foot
// à 5, mais des fois, t'as mis des terrains qui sont pour du foot à plus que
// ça. Donc, qu'on puisse filtrer facilement pour voir les terrains qui nous
// plaisent ») : à 3, à 5, à 7, à 8, à 11, d'après le nom ou les dimensions de
// chaque terrain au recensement (tools/terrains-france.ts et tools/terrains-osm.ts, format()).
//
// PucesFormat, la rangée de pastilles : en toucher une ne garde que les
// complexes qui ont un terrain à ce format ; la retoucher les rend tous. Une
// pastille sans aucun terrain s'éteint. Elle sert dans la feuille « Terrains »
// (sur="feuille", les pilules de la page, claire ou sombre) et sur
// la Map (sur="plan", la nacre posée sur le plan clair), dans son menu, sous
// « Les terrains libres » (map/menu-map.tsx, 24/10 : la colonne de droite
// n'a plus que la loupe et ce menu). Le choix est le même partout et le
// téléphone le garde (hooks/use-format-terrain.ts). Les terrains grisés
// suivent (app/map/page.tsx). IconeTerrain, un petit terrain vu de dessus,
// est l'icône de leur ligne dans le menu.

import { choisirFormatTerrain, useFormatTerrain } from "@/hooks/use-format-terrain";
import { FORMATS } from "@/lib/sfl/terrains";
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
