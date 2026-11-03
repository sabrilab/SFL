"use client";

// Les pièces communes des parties d'Analytics (./vue.tsx et chaque étape du
// funnel) : la carte d'une partie, le titre d'une étape AARRR, et la barre
// d'entonnoir (une ligne par étape : combien, la part du haut, la perte
// depuis la ligne d'avant).

import { pct } from "@/lib/sfl/retention";
import { cn } from "@/lib/utils";

export function Section({
  id,
  titre,
  sous,
  children,
}: {
  id?: string;
  titre: string;
  sous?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id ? `activite-${id}` : undefined} className="glass scroll-mt-16 rounded-3xl p-5">
      <h2 className="text-titre font-bold tracking-tight">{titre}</h2>
      {sous && <p className="mt-0.5 text-petit leading-snug text-encre-3">{sous}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Le titre d'une étape du funnel : son rang, son nom, la question qu'elle pose. */
export function Chapitre({ id, rang, titre, question }: { id: string; rang: number; titre: string; question: string }) {
  return (
    <div id={`activite-${id}`} className="scroll-mt-16 px-1 pt-6">
      <p className="mono-label text-micro text-encre-3">
        {rang} / 5
      </p>
      <h2 className="mt-1 text-titre-l leading-none font-extrabold tracking-tight">{titre}</h2>
      <p className="mt-1.5 text-corps text-encre-3">{question}</p>
    </div>
  );
}

export interface MarcheEntonnoir {
  label: string;
  n: number;
  /** Une précision sous le nombre (ex. « dont 4 venus du site »). */
  note?: string;
}

/**
 * Un entonnoir : chaque marche en barre, à l'échelle de la première ; à
 * droite, la part de la première, et sous la barre ce qui s'est perdu depuis
 * la marche d'avant. La plus grosse perte est marquée.
 */
export function Entonnoir({
  marches,
  pertes = true,
}: {
  marches: MarcheEntonnoir[];
  /** false : des étapes indépendantes (on peut en sauter une), sans perte d'une ligne à l'autre. */
  pertes?: boolean;
}) {
  const haut = Math.max(1, marches[0]?.n ?? 0);
  // La plus grosse perte (en part de la marche d'avant), s'il y en a une.
  let pire = -1;
  let pirePart = 0;
  marches.forEach((m, i) => {
    if (i === 0 || !pertes) return;
    const avant = marches[i - 1].n;
    if (avant <= 0) return;
    const perte = (avant - m.n) / avant;
    if (perte > pirePart) {
      pirePart = perte;
      pire = i;
    }
  });
  return (
    <div className="flex flex-col gap-3">
      {marches.map((m, i) => {
        const avant = i > 0 && pertes ? marches[i - 1].n : null;
        const perdus = avant !== null ? Math.max(0, avant - m.n) : 0;
        return (
          <div key={m.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-corps font-medium">{m.label}</span>
              <span className="shrink-0 text-lecture font-extrabold tabular-nums">
                {m.n}
                {i > 0 && <span className="ml-1.5 text-legende font-semibold text-encre-3">{pct(m.n / haut)}</span>}
              </span>
            </div>
            <span className="mt-1 block h-2 overflow-hidden rounded-full bg-foreground/8">
              <span
                className="block h-full rounded-full bg-foreground/80"
                style={{ width: `${Math.max(m.n > 0 ? 2 : 0, (m.n / haut) * 100)}%` }}
              />
            </span>
            {(m.note || (avant !== null && perdus > 0)) && (
              <p className={cn("mt-1 text-legende leading-snug", i === pire ? "font-semibold text-foreground" : "text-encre-3")}>
                {[
                  avant !== null && perdus > 0
                    ? `${perdus} perdus depuis l'étape d'avant (${pct(perdus / Math.max(1, avant))})${i === pire ? " · la plus grosse perte" : ""}`
                    : null,
                  m.note,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
