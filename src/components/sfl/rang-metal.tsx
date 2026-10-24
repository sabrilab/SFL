// Le rang d'une ligne de classement : le 1er en or, le 2e en argent, le 3e
// en bronze (les métaux de la vitrine, vitrine.tsx, recopiés ici), les
// autres en chiffre simple. Sabri, 24/10 : « le premier, le deuxième, le
// troisième, qui sont surlignés d'une autre couleur. Je veux comprendre
// que c'est un classement ».

import { cn } from "@/lib/utils";

const METAUX: Record<1 | 2 | 3, { fond: string; encre: string }> = {
  1: { fond: "linear-gradient(150deg, #fff2b8 0%, #e2b13c 50%, #94640f 100%)", encre: "#2b1d02" },
  2: { fond: "linear-gradient(150deg, #ffffff 0%, #c3c6ca 50%, #868a90 100%)", encre: "#15171a" },
  3: { fond: "linear-gradient(150deg, #f0b98a 0%, #b06a35 50%, #6b3815 100%)", encre: "#2a1608" },
};

/** Le fond d'une ligne du podium : une touche du métal, à peine (clair comme sombre). */
export const LIGNE_PODIUM: Record<1 | 2 | 3, string> = {
  1: "bg-[#e2b13c]/14 dark:bg-[#e2b13c]/12",
  2: "bg-[#9da1a7]/16 dark:bg-[#c3c6ca]/10",
  3: "bg-[#b06a35]/12 dark:bg-[#b06a35]/14",
};

export function RangMetal({ rang, className, taille = 26 }: { rang: number; className?: string; taille?: number }) {
  const metal = rang >= 1 && rang <= 3 ? METAUX[rang as 1 | 2 | 3] : null;
  if (!metal)
    return (
      <span className={cn("text-center text-[15px] font-bold text-foreground/40 tabular-nums", className)} style={{ width: taille }}>
        {rang}
      </span>
    );
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full text-[13px] font-extrabold tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.25)]", className)}
      style={{ width: taille, height: taille, background: metal.fond, color: metal.encre }}
    >
      {rang}
    </span>
  );
}
