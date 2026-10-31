"use client";

// L'affiche du match en grand, dans la page du lieu (app/map/page.tsx) :
// l'image des deux meilleures notes (lib/sfl/affiche.ts), leurs noms et leurs
// notes posés dessus, à la manière d'une affiche de combat. Rien d'autre.

import type { Affiche } from "@/lib/sfl/affiche";

const ANTON = "var(--font-anton), Anton, sans-serif";

export function AfficheDuMatch({ affiche }: { affiche: Affiche }) {
  const [a, b] = affiche.joueurs;
  return (
    <figure className="relative aspect-[4/3] overflow-hidden rounded-[26px] bg-[#0a0a0b] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={affiche.image} alt={`${a.nom} et ${b.nom}`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-[rgba(3,4,6,0.85)]" />
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-5 pb-4">
        {[a, b].map((j, i) => (
          <span key={j.nom} className={i ? "text-right" : ""}>
            <span className="block tabular-nums" style={{ font: `40px/0.9 ${ANTON}` }}>
              {j.note}
            </span>
            <span className="mt-1 block max-w-[9rem] truncate text-[15px] font-black tracking-[-0.3px] uppercase">{j.nom}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
