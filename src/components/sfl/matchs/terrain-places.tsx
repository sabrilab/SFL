"use client";

// Le terrain d'un match ouvert par un joueur (Sabri, 22/10) : le même terrain
// que la feuille de match (feuille-de-match.tsx, en perspective), mais avec
// les places du match. Chaque joueur sur sa place, en pastille ; chaque place
// libre est un « + » posé sur le terrain. Toucher un + ajoute un joueur
// (choisir-joueur.tsx) ; toucher une carte la retire, quand c'est permis.
//
// Les places se partagent en deux moitiés (Clairs devant, Foncés au fond),
// remplies l'une après l'autre : l'organisateur en premier, devant. Une
// équipe du mode Team (unCamp) occupe tout le terrain, en blanc, dans une
// formation fixe (FORMATION) : le capitaine dans les buts, l'attaque au fond.

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { CADRE_H, Pastille, depuisMediane, ecart } from "@/components/sfl/matchs/feuille-de-match";
import { SolTerrain } from "@/components/sfl/matchs/sol-terrain";
import { placesSurDemiTerrain } from "@/lib/sfl/feuille";
import { projeter, TERRAIN } from "@/lib/sfl/terrain-vu";
import { cn } from "@/lib/utils";

export interface Occupant {
  cle: string;
  nom: string;
  /** Invité sans réponse : sa carte attend, un peu effacée. */
  enAttente?: boolean;
}

const BLANC = { fond: "#f4f3ef", encre: "#0a0b0d" };
const NOIR = { fond: "#0a0b0d", encre: "#f4f3ef" };
const prenom = (nom: string) => nom.split(" ")[0];

/** Une équipe seule (mode Team), sur tout le terrain : gardien, 2, 1, 2, 1 — en fractions (largeur, profondeur depuis le fond). */
const FORMATION: [number, number][] = [
  [0.5, 0.9],
  [0.27, 0.74],
  [0.73, 0.74],
  [0.5, 0.56],
  [0.22, 0.42],
  [0.78, 0.42],
  [0.5, 0.27],
];

export function TerrainPlaces({
  places,
  occupants,
  moi,
  onPlus,
  onOccupant,
  hauteur = CADRE_H,
  unCamp = false,
}: {
  places: number;
  /** Dans l'ordre d'arrivée : l'organisateur d'abord. */
  occupants: Occupant[];
  /** Mon nom : ma carte est cerclée et dite « Toi ». */
  moi?: string;
  /** Toucher une place libre ; sans, les + ne se touchent pas. */
  onPlus?: () => void;
  onOccupant?: (o: Occupant) => void;
  hauteur?: number;
  /** Une seule équipe (mode Team) : toutes les places devant, côté blanc. */
  unCamp?: boolean;
}) {
  const { allPlayers } = useSeason();
  const parNom = useMemo(() => new Map(allPlayers.map((p) => [p.name, p])), [allPlayers]);
  const { l, h } = TERRAIN;

  // Les places : la moitié devant (Clairs) pour les places impaires, le fond pour les paires.
  const devant = Math.ceil(places / 2);
  const fond = places - devant;
  const posesDevant = placesSurDemiTerrain(devant).map((p) => ({ ...p, chezMoi: true }));
  const posesFond = placesSurDemiTerrain(fond).map((p) => ({ ...p, chezMoi: false }));
  // L'ordre de remplissage alterne devant et fond, en commençant devant par le gardien.
  const ordre: typeof posesDevant = [];
  for (let i = 0; i < Math.max(devant, fond); i++) {
    if (posesDevant[i]) ordre.push(posesDevant[i]);
    if (posesFond[i]) ordre.push(posesFond[i]);
  }

  const cases = (
    unCamp
      ? FORMATION.slice(0, places).map(([fx, fy], i) => {
          const u = fx * l;
          const v = fy * h;
          return { i, occupant: occupants[i] ?? null, chezMoi: true, u, v, ...projeter(u, v) };
        })
      : ordre.map((pl, i) => {
          const x = 50 + (pl.largeur - 50) * ecart(pl.profondeur, pl.chezMoi);
          const y = (pl.chezMoi ? 1 : -1) * depuisMediane(pl.profondeur);
          const u = (x / 100) * l;
          const v = h / 2 + y;
          return { i, occupant: occupants[i] ?? null, chezMoi: pl.chezMoi, u, v, ...projeter(u, v) };
        })
  ).sort((a, b) => a.v - b.v);

  const centre = projeter(l / 2, h / 2);
  const logo = { l: 46 * centre.k, h: projeter(l / 2, h / 2 + 23).y - projeter(l / 2, h / 2 - 23).y };

  return (
    <div
      className="relative w-full overflow-hidden rounded-[22px] bg-[radial-gradient(120%_80%_at_50%_0%,#22252a_0%,#111214_70%)]"
      style={{ height: hauteur }}
    >
      <SolTerrain ombres={cases.filter((c) => c.occupant)} />
      {/* eslint-disable-next-line @next/next/no-img-element -- le même logo que la feuille */}
      <img
        src="/bola/symbole-blanc.svg"
        alt=""
        aria-hidden
        className="absolute"
        style={{
          left: `calc(50% - ${logo.l / 2}px)`,
          top: centre.y - logo.l / 2,
          width: logo.l,
          height: logo.l,
          transform: `scaleY(${logo.h / logo.l})`,
          opacity: 0.85,
        }}
      />
      {cases.map(({ i, occupant, chezMoi, x, y, k }) => {
        const onglet = chezMoi || unCamp ? BLANC : NOIR;
        return (
          <div key={i} className="absolute size-0" style={{ left: `calc(50% + ${x}px)`, top: y }}>
            <div
              className="absolute bottom-0 left-0 flex flex-col items-center gap-1"
              style={{ transformOrigin: "50% 100%", transform: `translateX(-50%) scale(${k})` }}
            >
              {occupant ? (
                <>
                  <button
                    type="button"
                    disabled={!onOccupant}
                    onClick={() => onOccupant?.(occupant)}
                    aria-label={onOccupant ? `Retirer ${occupant.nom}` : occupant.nom}
                    className={cn(
                      "flex rounded-[15px] transition-transform active:scale-95 disabled:active:scale-100",
                      occupant.nom === moi && "bg-white p-[3px]",
                      occupant.enAttente && "opacity-45"
                    )}
                  >
                    <span className={cn("flex rounded-[12px]", occupant.nom === moi && "bg-[#1b1d21] p-[2px]")}>
                      <Pastille player={parNom.get(occupant.nom)} nom={occupant.nom} cote={42} onglet={onglet} />
                    </span>
                  </button>
                  <span
                    className={cn(
                      "whitespace-nowrap rounded-full px-[7px] py-[2px] text-[11px] shadow-[inset_0_0_0_1px_rgba(128,128,128,0.45)]",
                      occupant.enAttente && "opacity-60"
                    )}
                    style={{ background: onglet.fond, color: onglet.encre, fontWeight: occupant.nom === moi ? 800 : 600 }}
                  >
                    {occupant.nom === moi ? "Toi" : prenom(occupant.nom)}
                  </span>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!onPlus}
                    onClick={onPlus}
                    aria-label="Ajouter un joueur"
                    className="grid size-[42px] place-items-center rounded-[10px] border-[1.5px] border-dashed border-white/45 bg-white/[0.06] text-white/80 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="size-5" strokeWidth={2.4} />
                  </button>
                  <span className="h-[19px]" aria-hidden />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
