"use client";

// Qui joue contre qui, d'un coup d'œil (Sabri, 31/10 : « on fait les quatre
// joueurs en petites vignettes sur deux lignes, et à droite, en grand,
// l'image du plus fort joueur : cinq cases, une plus grande qui fait la
// hauteur de toutes »). Une équipe = six cases sur trois colonnes et deux
// lignes, son meilleur joueur dans la colonne du bord, sur toute la hauteur.
//
// Sur la carte d'un match, les deux équipes côte à côte, leurs meilleurs
// face à face au milieu ; dans la page du lieu, l'une sous l'autre, en grand,
// avec les noms et les notes.

import { photoMiniature, photoSrc } from "@/lib/sfl/photos";
import { cn } from "@/lib/utils";

const ANTON = "var(--font-anton), Anton, sans-serif";

export interface JoueurNote {
  nom: string;
  note: number;
}

export interface Mosaique {
  /** Les Noirs, puis les Blancs : chacun trié de la meilleure note à la moins bonne. */
  a: JoueurNote[];
  b: JoueurNote[];
}

function Case({ j, grand, legende, className }: { j: JoueurNote | undefined; grand: boolean; legende: boolean; className?: string }) {
  if (!j) return <span aria-hidden className={cn("bg-white/[0.06]", className)} />;
  return (
    <span className={cn("relative overflow-hidden bg-[#141517]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoMiniature(photoSrc(j.nom), grand ? 384 : 128)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[50%_22%]"
        draggable={false}
        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
      />
      {legende && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-black/80 px-1.5 pt-4 pb-1 text-white">
          <span className="block tabular-nums" style={{ font: `${grand ? 26 : 15}px/0.9 ${ANTON}` }}>
            {j.note}
          </span>
          <span className={cn("block truncate font-black uppercase", grand ? "text-[12px]" : "text-[8.5px]")}>{j.nom}</span>
        </span>
      )}
    </span>
  );
}

/** Une équipe : quatre vignettes sur deux lignes, le meilleur en grand du côté `cote`. */
function Equipe({ joueurs, cote, legende, gap }: { joueurs: JoueurNote[]; cote: "gauche" | "droite"; legende: boolean; gap: string }) {
  const [meilleur, ...autres] = joueurs;
  const petites = [0, 1, 2, 3].map((i) => <Case key={i} j={autres[i]} grand={false} legende={legende} />);
  const grande = <Case j={meilleur} grand legende={legende} className="row-span-2" />;
  return (
    <div className={cn("grid h-full w-full grid-cols-3 grid-rows-2", gap)}>
      {cote === "gauche" ? (
        <>
          {grande}
          {petites}
        </>
      ) : (
        <>
          {petites.slice(0, 2)}
          <Case j={meilleur} grand legende={legende} className="col-start-3 row-span-2 row-start-1" />
          {petites.slice(2)}
        </>
      )}
    </div>
  );
}

/** Sur la carte d'un match : les deux équipes côte à côte, leurs meilleurs au milieu. */
export function MosaiqueCarte({ m, className }: { m: Mosaique; className?: string }) {
  return (
    <div className={cn("flex gap-[3px] bg-black", className)}>
      <div className="h-full flex-1">
        <Equipe joueurs={m.a} cote="droite" legende={false} gap="gap-px" />
      </div>
      <div className="h-full flex-1">
        <Equipe joueurs={m.b} cote="gauche" legende={false} gap="gap-px" />
      </div>
    </div>
  );
}

/** Dans la page du lieu : une équipe par ligne, en grand, avec noms et notes. */
export function MosaiqueGrande({ m }: { m: Mosaique }) {
  return (
    <section className="flex flex-col gap-2">
      {([
        ["Noirs", m.a, "droite"],
        ["Blancs", m.b, "gauche"],
      ] as const).map(([camp, joueurs, cote]) => (
        <div key={camp} className="overflow-hidden rounded-[22px]">
          <p className={cn("mono-label px-4 py-2", camp === "Noirs" ? "bg-[#0A0B0D] text-white" : "bg-[#F4F3EF] text-[#0A0B0D]")}>
            {camp} · {Math.round(joueurs.reduce((s, j) => s + j.note, 0) / joueurs.length)}
          </p>
          <div className="aspect-[3/2]">
            <Equipe joueurs={joueurs} cote={cote} legende gap="gap-[2px]" />
          </div>
        </div>
      ))}
    </section>
  );
}
