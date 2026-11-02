"use client";

// Mes cartons, sur Ma carte, discrètement (Sabri, 01/11/2026) : la série en
// cours en trois petits cartons (1/3, 2/3), les rouges de la saison, et
// « Suspendu · J5 » tant que la journée suspendue n'est pas jouée. Rien sans
// carton. Les règles : lib/sfl/cartons.ts.

import { useSeason } from "@/components/sfl/season-provider";
import { cartonsDe, REGLES_CARTONS } from "@/lib/sfl/cartons";
import { journeeJouee } from "@/lib/sfl/saisie/engine";
import { PetitCarton, SerieDeCartons } from "./carton-recu";

export function MesCartons({ nom }: { nom: string }) {
  const { saisonLue } = useSeason();
  const c = cartonsDe(saisonLue, nom);
  if (!c.cartons.length) return null;
  const rouges = c.cartons.filter((x) => x.couleur === "rouge").length;
  const suspension = c.suspensions.find((s) => !s.levee && !journeeJouee(saisonLue, s.j));
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-encre-2" aria-label="Mes cartons">
      <span className="flex items-center gap-2">
        <SerieDeCartons rang={c.serie} />
        <span className="mono-label tabular-nums">
          {c.serie}/{REGLES_CARTONS.jaunesPourUnRouge}
        </span>
      </span>
      {rouges > 0 && (
        <span className="flex items-center gap-1.5">
          <PetitCarton couleur="rouge" />
          <span className="mono-label">{suspension ? `Suspendu · J${suspension.j}` : `${rouges} rouge${rouges > 1 ? "s" : ""}`}</span>
        </span>
      )}
    </div>
  );
}

/** À la place de « Je viens », pour un suspendu : « Suspendu · J5 », carton rouge. */
export function Suspendu({ j, taille = "md", className }: { j: number; taille?: "md" | "sm"; className?: string }) {
  return (
    <div className={["flex items-center gap-3.5 rounded-[18px] bg-contraste/5", taille === "sm" ? "px-3.5 py-2.5" : "px-4 py-3.5", className].filter(Boolean).join(" ")}>
      <PetitCarton couleur="rouge" taille={taille === "sm" ? 1.25 : 1.6} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className={taille === "sm" ? "text-ligne font-bold" : "text-lecture font-bold"}>Suspendu · J{j}</span>
        <span className="mono-label text-encre-3">Carton rouge</span>
      </div>
    </div>
  );
}
