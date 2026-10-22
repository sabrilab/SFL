// « Stats à venir » — ce qu'on montre à la place d'un module quand la journée
// n'est pas jouée.
//
// Un récap, un classement, une forme sur cinq matchs : sans donnée, ces
// modules affichent des zéros qui ne disent rien, ou pire, qui disent faux
// (« 1er · 0 pt »). Tant que les actions de la journée ne sont pas saisies,
// on le dit en une carte, et on renvoie vers la saison passée pour relire.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { SaisonArchivee } from "@/lib/sfl/saisie/types";

const QUOI = {
  recap: "Le récap s'écrit au soir de la journée, une fois toutes ses actions saisies.",
  classement: "Le classement se calcule après la première journée. Pour l'instant, tout le monde part de zéro.",
  accueil: "Tes chiffres, le classement et le récap arrivent avec la première journée.",
} as const;

export function StatsAVenir({
  numero,
  quoi,
  archive,
  compact = false,
}: {
  numero: number;
  quoi: keyof typeof QUOI;
  /** La saison précédente, s'il y en a une : ce qu'on peut relire en attendant. */
  archive?: SaisonArchivee | null;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "glass-soft rounded-[22px] px-4 py-4" : "glass rounded-[26px] px-5 py-7 text-center"}>
      <p className="mono-label text-foreground/40">Saison {numero}</p>
      <h2 className={compact ? "mt-0.5 text-[16px] font-bold tracking-tight" : "mt-1 text-[20px] font-bold tracking-tight"}>
        Stats à venir
      </h2>
      <p className={compact ? "mt-1 text-[12.5px] text-muted-foreground" : "mx-auto mt-2 max-w-[36ch] text-[13px] text-muted-foreground"}>
        {QUOI[quoi]}
      </p>
      {archive && (
        <Link
          href={`/saisons/${archive.numero}`}
          className={
            compact
              ? "mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-foreground/80"
              : "bouton-secondaire mt-4 inline-flex items-center gap-1 px-4 py-2 text-[13px] font-semibold"
          }
        >
          Relire {archive.nom} <ChevronRight className="size-3.5" />
        </Link>
      )}
    </section>
  );
}
