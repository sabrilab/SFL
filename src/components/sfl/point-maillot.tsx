// Le rond d'un camp, noir ou blanc, devant le nom d'une équipe. Le liseré
// gris le garde visible sur un fond sombre comme sur un fond clair. Les
// couleurs viennent de lib/sfl/saisie/equipes.ts.

import { MAILLOT, type Camp } from "@/lib/sfl/saisie/equipes";
import { cn } from "@/lib/utils";

export function PointMaillot({ camp, className }: { camp: Camp; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ background: MAILLOT[camp], boxShadow: "inset 0 0 0 1px rgba(128,128,128,0.45)" }}
    />
  );
}
