// Le camp d'une équipe dans un récap : « Noirs » sur fond noir, « Blancs »
// sur fond blanc, un rond cerclé devant — la même pastille que la fiche du
// joueur sur la feuille de match (fiche-joueur.tsx). Le liseré gris la garde
// visible sur un fond sombre comme sur un fond clair. Les couleurs viennent
// de lib/sfl/maillots.ts.

import type { CSSProperties } from "react";
import type { Maillot } from "@/lib/sfl/maillots";
import { cn } from "@/lib/utils";

/** Le liseré des pastilles et des ronds de camp. */
export const LISERE_CAMP = "inset 0 0 0 1px rgba(128,128,128,0.45)";

export function PastilleCamp({
  maillot,
  suffixe,
  className,
  style,
}: {
  maillot: Maillot;
  /** Après le nom : « Terrain 2 », un score… */
  suffixe?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 text-[12px] leading-none font-bold whitespace-nowrap",
        className
      )}
      style={{ background: maillot.fond, color: maillot.encre, boxShadow: LISERE_CAMP, ...style }}
    >
      <span aria-hidden className="size-2.5 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_currentColor]" />
      <span className="min-w-0 truncate">
        {maillot.nom}
        {suffixe && <span className="font-semibold opacity-60"> · {suffixe}</span>}
      </span>
    </span>
  );
}

/** Un rond à la couleur du maillot, cerclé de gris. */
export function PointCamp({ maillot, className }: { maillot: Maillot; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ background: maillot.fond, boxShadow: LISERE_CAMP }}
    />
  );
}
