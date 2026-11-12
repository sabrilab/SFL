"use client";

// La journée en suspens, côté joueurs (Ilyes, 12/11/2026 : « dans le
// classement ou dans les classements et même dans les récaps, que les
// joueurs puissent voir que cette journée-là sera rattrapée »).
//
// Deux briques, noir et blanc, sans phrase : la marque d'état en mono
// (« ‖ J5 · À RATTRAPER »), posée en tête des classements, et la carte de la
// journée (« J5 · 8 nov. », la pastille noire de l'état, son
// motif, puis ses matchs sans score) qui prend la place du récap. Le libellé
// vient d'un seul endroit : libelleSuspens (saisie/suspens.ts). Les chiffres,
// eux, n'incluent jamais la journée : la vue figée l'ignore (revelation.ts).

import { useSeason } from "@/components/sfl/season-provider";
import { matchsDeJournee } from "@/lib/sfl/matchs-du-jour";
import { A_RATTRAPER, EN_SUSPENS, journeesEnSuspens, libelleSuspens, SIGNE_SUSPENS } from "@/lib/sfl/saisie/suspens";
import type { JourneeMeta } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

/** « ‖ J5 · À RATTRAPER », une par journée en suspens de la saison lue ; rien s'il n'y en a pas. */
export function MarqueSuspens({ className }: { className?: string }) {
  const { saison } = useSeason();
  const js = journeesEnSuspens(saison);
  if (!js.length) return null;
  return (
    <p className={cn("mono-label flex flex-wrap gap-x-3 gap-y-1 text-encre-2", className)}>
      {js.map((j) => (
        <span key={j}>
          <span aria-hidden>{SIGNE_SUSPENS} </span>J{j} · {A_RATTRAPER}
        </span>
      ))}
    </p>
  );
}

/** La pastille noire de l'état, « ‖ » et le libellé de libelleSuspens. */
export function PastilleSuspens({ className }: { className?: string }) {
  return (
    <span className={cn("mono-label inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 text-background", className)}>
      <span aria-hidden>{SIGNE_SUSPENS}</span>
      {EN_SUSPENS}
    </span>
  );
}

/** La journée en suspens à la place de son récap : sa date, la pastille, le motif, ses matchs sans score. */
export function CarteSuspens({ meta }: { meta: JourneeMeta }) {
  const { journees, saison } = useSeason();
  const l = libelleSuspens(meta);
  const journee = journees.find((x) => x.j === meta.j);
  const matchs = matchsDeJournee(journee, saison.terrains ?? [], { heure: meta.heure ?? "", lieu: null });
  if (!l) return null;
  return (
    <section className="glass flex flex-col gap-4 rounded-[26px] p-[18px]">
      <div className="flex flex-col gap-2.5">
        <p className="mono-label text-encre-3">
          J{meta.j} · {meta.date}
        </p>
        <PastilleSuspens className="self-start" />
        {l.motif && <p className="text-titre font-bold tracking-tight">{l.motif}</p>}
      </div>
      {matchs.length > 0 && (
        <ul className="flex flex-col">
          {matchs.map((m) => (
            <li key={m.n} className="flex items-center justify-between gap-3 border-t border-border/60 py-3">
              <span className="min-w-0">
                <span className="mono-label block text-encre-3">{m.label}</span>
                <span className="block truncate text-lecture font-semibold">
                  {(meta.matchsDuJour?.[m.n]?.equipes ?? ["Noirs", "Blancs"]).join(" – ")}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                {m.heure && <span className="mono-label text-encre-2">{m.heure}</span>}
                <span className="mono-label text-encre-3">
                  {m.noirs.length} · {m.blancs.length}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
