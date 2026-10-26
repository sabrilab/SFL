"use client";

// Les divisions dans le classement Pépite d'Or lui-même. Sabri, 25/10 :
// « quand je vais dans le classement pépites d'or, il faut que les divisions
// soient visibles ». La rubrique des divisions (actus/divisions.tsx) les
// montrait dans le fil ; la rangée de cartes de l'onglet Pépite d'Or
// (actus/course.tsx) et le classement Pépite d'Or de l'onglet Classement
// (classements.tsx) les montrent aussi, avec les mêmes métaux et les mêmes
// places : chaque division compte depuis 1.
//
// Le découpage est celui de la rubrique, celui du moteur (etatDivisions) :
// la projection de ce soir avant la J3 jouée, puis les divisions du prochain
// dimanche. Une saison sans divisions (la saison 0) n'en montre pas.

import { useMemo } from "react";
import { useSeason } from "@/components/sfl/season-provider";
import { etatDivisions, nomDivision, type Decoupage, type Division } from "@/lib/sfl/divisions";
import { cn } from "@/lib/utils";

const ANTON = "var(--font-anton), Anton, sans-serif";

/**
 * Le métal de chaque division : son dégradé poli (badge-3d.tsx, POLI), son
 * encre, et le voile de sa bande, plus vif en haut, avec son liseré, en clair
 * comme en sombre.
 */
export const METAL: Record<Division, { poli: string; encre: string; voile: string }> = {
  1: {
    poli: "linear-gradient(140deg, #f7e3a6 0%, #b8862b 48%, #f3d48a 72%, #8a6416 100%)",
    encre: "#2b1d02",
    voile:
      "bg-[linear-gradient(180deg,rgba(217,165,49,0.24),rgba(217,165,49,0.07))] ring-[#d9a531]/30 dark:bg-[linear-gradient(180deg,rgba(255,200,80,0.17),rgba(255,200,80,0.04))] dark:ring-[#f4cd6a]/20",
  },
  2: {
    poli: "linear-gradient(140deg, #ffffff 0%, #8f959d 48%, #e9ebee 72%, #6d737b 100%)",
    encre: "#15171a",
    voile:
      "bg-[linear-gradient(180deg,rgba(130,140,155,0.22),rgba(130,140,155,0.06))] ring-[#8f959d]/30 dark:bg-[linear-gradient(180deg,rgba(214,224,240,0.13),rgba(214,224,240,0.03))] dark:ring-[#dfe3ea]/15",
  },
  3: {
    poli: "linear-gradient(140deg, #f0c09a 0%, #8f4f22 48%, #e2a77c 72%, #6a3815 100%)",
    encre: "#2a1608",
    voile:
      "bg-[linear-gradient(180deg,rgba(194,110,55,0.22),rgba(194,110,55,0.06))] ring-[#c27a43]/30 dark:bg-[linear-gradient(180deg,rgba(226,128,64,0.17),rgba(226,128,64,0.04))] dark:ring-[#d9773a]/20",
  },
};

/** « D1 » sur le métal de sa division. */
export function PastilleDivision({ x, className }: { x: Division; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-[28px] min-w-[42px] shrink-0 place-items-center rounded-[9px] px-2 text-[18px] leading-none shadow-[0_2px_8px_rgba(0,0,0,0.18)]",
        className,
      )}
      style={{ background: METAL[x].poli, color: METAL[x].encre, fontFamily: ANTON }}
    >
      {nomDivision(x)}
    </span>
  );
}

/** Une place du podium d'une division, sur son métal. */
export function PlaceMetal({ x, rang, className }: { x: Division; rang: number; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-[26px] place-items-center rounded-full pt-px text-[15px] leading-none shadow-[0_1px_5px_rgba(0,0,0,0.22)]",
        className,
      )}
      style={{ background: METAL[x].poli, color: METAL[x].encre, fontFamily: ANTON }}
    >
      {rang}
    </span>
  );
}

/** Le découpage en divisions du classement Pépite d'Or de la saison lue ; null sans divisions. */
export function useDecoupageClassement(): Decoupage | null {
  const { saison } = useSeason();
  return useMemo(() => {
    const d = etatDivisions(saison)?.decoupage;
    return d && d.classes > 0 ? d : null;
  }, [saison]);
}

/**
 * Un classement rangé par division : chaque joueur dans la sienne, l'ordre
 * du classement gardé. Sa place est comptée dans la division sur les points
 * affichés à côté (Sabri, 26/10 : « les points sont corrects, mais pas le
 * classement ») : 1 + ceux de sa division qui en ont plus, les ex æquo
 * partagent la place. Qui n'a pas encore joué n'est pas au découpage : il
 * est de la D3 (divisionDe), après ses classés, sans place.
 */
export function parDivision<T extends { name: string; value: number }>(
  d: Decoupage,
  classes: T[],
): { x: Division; joueurs: (T & { place: number | null })[] }[] {
  const groupes: Record<Division, T[]> = { 1: [], 2: [], 3: [] };
  const sans: T[] = [];
  for (const p of classes) {
    const place = d.parNom.get(p.name);
    if (place) groupes[place.division].push(p);
    else sans.push(p);
  }
  return ([1, 2, 3] as const)
    .map((x) => {
      const classe = [...groupes[x]].sort((a, b) => b.value - a.value);
      const joueurs: (T & { place: number | null })[] = classe.map((p) => ({
        ...p,
        place: 1 + classe.filter((q) => q.value > p.value).length,
      }));
      if (x === 3) joueurs.push(...sans.map((p) => ({ ...p, place: null })));
      return { x, joueurs };
    })
    .filter((g) => g.joueurs.length > 0);
}
