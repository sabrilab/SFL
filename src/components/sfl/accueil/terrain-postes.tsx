"use client";

// Le poste et le pied fort, à l'accueil (accueil.tsx).
//
// Le poste se touche sur un terrain : le terrain des feuilles de match
// (matchs/sol-terrain.tsx, vu en perspective par lib/sfl/terrain-vu), le
// jeu vers le haut, les neuf postes de l'effectif à leur place. Le pied fort
// se touche sur deux semelles à crampons : l'une, l'autre, ou les deux.

import { useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SolTerrain } from "@/components/sfl/matchs/sol-terrain";
import { POSTES, type Pied, type Poste } from "@/lib/sfl/inscription";
import { projeter, vue } from "@/lib/sfl/terrain-vu";
import { cn } from "@/lib/utils";

// La largeur du terrain des feuilles (270) : ses surfaces de réparation y
// sont centrées. Moins couché qu'une feuille, pour que la colonne du milieu
// (AT, MC, MDC, DC, G) respire.
const VUE = vue(270, 400, 46);

/** La place de chaque poste sur le terrain (u en travers, v de l'attaque vers le but). */
const PLACES: Record<Poste, [number, number]> = {
  AT: [135, 50],
  AG: [46, 104],
  AD: [224, 104],
  MC: [135, 150],
  MDC: [135, 232],
  DG: [40, 262],
  DC: [135, 304],
  DD: [230, 262],
  G: [135, 376],
};

/** Le diamètre d'un rond, à l'échelle 1 : deux ronds voisins gardent au moins 13 px entre eux. */
const ROND = 42;

/** Le haut du cadre que le terrain couché laisse vide. */
const VIDE_HAUT = 26;

export function TerrainPostes({ valeur, onChange }: { valeur: Poste | null; onChange: (p: Poste) => void }) {
  const reduit = useReducedMotion();
  const label = POSTES.find((p) => p.id === valeur)?.label;
  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative w-[300px]" style={{ height: 360 - VIDE_HAUT }}>
        <div className="absolute inset-x-0 bottom-0" style={{ top: -VIDE_HAUT }}>
          <SolTerrain ombres={[]} vue={VUE} gazon="vert" />
          {POSTES.map(({ id, label: nom }) => {
            const [u, v] = PLACES[id];
            const p = projeter(u, v, 0, VUE);
            const choisi = valeur === id;
            const cote = Math.round(ROND * p.k);
            return (
              <motion.button
                key={id}
                type="button"
                aria-pressed={choisi}
                aria-label={nom}
                onClick={() => {
                  navigator.vibrate?.(8);
                  onChange(id);
                }}
                initial={false}
                animate={{ scale: choisi ? 1.16 : 1 }}
                whileTap={{ scale: 0.9 }}
                transition={reduit ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 17 }}
                className={cn(
                  "absolute grid place-items-center rounded-full font-mono font-bold tracking-tight transition-colors duration-200",
                  choisi
                    ? "bg-white text-[#0a0b0d] shadow-[0_0_0_5px_rgba(255,255,255,0.16),0_8px_20px_rgba(0,0,0,0.5)]"
                    : "bg-black/45 text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)] ring-1 ring-white/40 backdrop-blur-[2px]"
                )}
                style={{
                  left: `calc(50% + ${p.x}px)`,
                  top: p.y,
                  width: cote,
                  height: cote,
                  marginLeft: -cote / 2,
                  marginTop: -cote / 2,
                  fontSize: Math.round(11 * p.k),
                }}
              >
                {id}
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="grid h-[34px] place-items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {label && (
            <motion.span
              key={label}
              initial={reduit ? false : { y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="text-[19px] font-extrabold tracking-tight text-white"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Une semelle à crampons, la droite (la gauche en est le miroir). */
const SEMELLE =
  "M30 4C45 4 56 15 58 34C60 52 55 66 52 80C49 94 52 108 51 124C50 142 42 154 31 154C20 154 12 144 12 128C12 112 17 100 16 86C15 72 6 60 6 38C6 16 16 4 30 4Z";
const CRAMPONS: [number, number][] = [
  [22, 30],
  [42, 27],
  [15, 58],
  [49, 57],
  [24, 127],
  [40, 127],
];

const PIEDS: Record<Pied, string> = { gauche: "Pied gauche", droit: "Pied droit", "les deux": "Les deux pieds" };

/** Le pied fort : toucher une semelle la prend ; toucher l'autre aussi, les deux. */
export function PiedFort({ valeur, onChange }: { valeur: Pied | null; onChange: (p: Pied) => void }) {
  const reduit = useReducedMotion();
  // Sans deux-points ni guillemets : l'identifiant sert dans url(#…).
  const id = useId().replace(/[^\w-]/g, "");
  const gauche = valeur === "gauche" || valeur === "les deux";
  const droit = valeur === "droit" || valeur === "les deux";

  function toucher(cote: "gauche" | "droit") {
    const g = cote === "gauche" ? !gauche : gauche;
    const d = cote === "droit" ? !droit : droit;
    // Il en faut un : toucher le seul pris ne l'enlève pas.
    if (!g && !d) return;
    navigator.vibrate?.(g && d ? [8, 40, 8] : 10);
    onChange(g && d ? "les deux" : g ? "gauche" : "droit");
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end gap-[34px]">
        {(["gauche", "droit"] as const).map((cote) => {
          const pris = cote === "gauche" ? gauche : droit;
          return (
            <motion.button
              key={cote}
              type="button"
              aria-pressed={pris}
              aria-label={cote === "gauche" ? "Pied gauche" : "Pied droit"}
              onClick={() => toucher(cote)}
              initial={false}
              animate={pris ? { scale: 1, y: 0, opacity: 1 } : { scale: 0.94, y: 6, opacity: 0.75 }}
              whileTap={{ scale: 0.9 }}
              transition={reduit ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 16 }}
              className="flex flex-col items-center gap-[8px] outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <svg viewBox="0 0 64 160" width={84} height={210} aria-hidden className="overflow-visible">
                <defs>
                  <linearGradient id={`${id}-${cote}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ffffff" />
                    <stop offset="1" stopColor="#c9ccd1" />
                  </linearGradient>
                </defs>
                <g transform={cote === "gauche" ? "translate(64 0) scale(-1 1)" : undefined}>
                  <path
                    d={SEMELLE}
                    fill={pris ? `url(#${id}-${cote})` : "rgba(255,255,255,0.05)"}
                    stroke={pris ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.32)"}
                    strokeWidth={1.4}
                    style={{ filter: pris ? "drop-shadow(0 10px 22px rgba(255,255,255,0.18))" : undefined }}
                  />
                  {CRAMPONS.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={5.5} fill={pris ? "#1b1c20" : "rgba(255,255,255,0.22)"} />
                  ))}
                </g>
              </svg>
              <span className={cn("mono-label transition-colors", pris ? "text-white" : "text-white/40")}>
                {cote === "gauche" ? "Gauche" : "Droit"}
              </span>
            </motion.button>
          );
        })}
      </div>
      <div className="grid h-[42px] place-items-center pt-[8px]">
        <AnimatePresence mode="popLayout" initial={false}>
          {valeur && (
            <motion.span
              key={valeur}
              initial={reduit ? false : { y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="text-[19px] font-extrabold tracking-tight text-white"
            >
              {PIEDS[valeur]}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
