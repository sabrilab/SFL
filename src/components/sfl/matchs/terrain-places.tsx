"use client";

// Le terrain d'un match ouvert par un joueur (Sabri, 22/10) : le terrain en
// perspective de la feuille de match (feuille-de-match.tsx), avec les places
// du match. Chaque joueur sur sa place, en pastille ; chaque place libre est
// un « + » posé sur le terrain. Toucher un + ajoute un joueur
// (choisir-joueur.tsx) ; toucher une carte la retire, quand c'est permis (une
// petite croix le dit, `retirable`).
//
// Les places se partagent en deux moitiés (Clairs devant, Foncés au fond),
// remplies l'une après l'autre : l'organisateur en premier, devant. Où poser
// chaque carte pour qu'aucune n'en touche une autre, ni le logo du rond
// central, quel que soit le nombre de places : lib/sfl/places-terrain.ts
// (Sabri, 23/10 : les + se chevauchaient). Le cadre épouse ce qu'il montre.
//
// Une équipe du mode Team (unCamp) occupe tout le terrain, en blanc, dans une
// formation fixe (FORMATION) : le capitaine dans les buts, l'attaque au fond.
// Un invité qui n'a pas encore répondu attend sur sa place, en pointillé, sa
// carte voilée ; le mode Team ajoute à son prénom le temps qui reste avant
// que l'invitation tombe (« Adil · 71 h »).

import { useMemo } from "react";
import { Plus, X } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { CADRE_H, Pastille } from "@/components/sfl/matchs/feuille-de-match";
import { SolTerrain } from "@/components/sfl/matchs/sol-terrain";
import { placerTerrain, VUE_PLACES } from "@/lib/sfl/places-terrain";
import { projeter, TERRAIN, vue as vueDe, type Vue } from "@/lib/sfl/terrain-vu";
import { cn } from "@/lib/utils";

export interface Occupant {
  cle: string;
  nom: string;
  /** Invité sans réponse : sa carte attend, voilée, en pointillé. */
  enAttente?: boolean;
  /** Le temps qui lui reste pour répondre (« 71 h »), à côté de son prénom. */
  reste?: string;
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

/** La vue de la feuille de match, pour le mode Team. */
const VUE_EQUIPE = vueDe();
/** L'air autour du terrain et des cartes, dans le cadre. */
const MARGE = 12;

export function TerrainPlaces({
  places,
  occupants,
  moi,
  onPlus,
  onOccupant,
  retirable = false,
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
  /** Toucher une carte (autre que la mienne) la retire : une petite croix le montre. */
  retirable?: boolean;
  /** La hauteur du cadre, pour le mode Team ; deux équipes : le cadre épouse ce qu'il montre. */
  hauteur?: number;
  /** Une seule équipe (mode Team) : toutes les places devant, côté blanc. */
  unCamp?: boolean;
}) {
  const { allPlayers } = useSeason();
  const parNom = useMemo(() => new Map(allPlayers.map((p) => [p.name, p])), [allPlayers]);

  const { cases, vu, cadre, decalage } = useMemo(() => {
    if (unCamp) {
      const { l, h } = TERRAIN;
      const cases = FORMATION.slice(0, places).map(([fx, fy], i) => {
        const u = fx * l;
        const v = fy * h;
        return { i, chezMoi: true, u, v, etiquette: 112, ...projeter(u, v, 0, VUE_EQUIPE) };
      });
      return { cases, vu: VUE_EQUIPE, cadre: hauteur, decalage: 0 };
    }
    const d = placerTerrain(places);
    return { cases: d.places, vu: VUE_PLACES as Vue, cadre: d.bas - d.haut + MARGE * 2, decalage: MARGE - d.haut };
  }, [places, unCamp, hauteur]);

  const { l, h } = vu;
  const centre = projeter(l / 2, h / 2, 0, vu);
  const logo = { l: 46 * centre.k, h: projeter(l / 2, h / 2 + 23, 0, vu).y - projeter(l / 2, h / 2 - 23, 0, vu).y };
  const posees = cases.map((c) => ({ ...c, occupant: occupants[c.i] ?? null })).sort((a, b) => a.v - b.v);

  return (
    <div
      className="relative w-full overflow-hidden rounded-[22px] bg-[radial-gradient(120%_80%_at_50%_0%,#22252a_0%,#111214_70%)]"
      style={{ height: cadre }}
    >
      <div className="absolute inset-x-0 top-0 bottom-0" style={{ transform: `translateY(${decalage}px)` }}>
        <SolTerrain ombres={posees.filter((c) => c.occupant)} vue={vu} />
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
        {posees.map(({ i, occupant, chezMoi, x, y, k, etiquette }) => {
          const onglet = chezMoi || unCamp ? BLANC : NOIR;
          const cestMoi = !!occupant && occupant.nom === moi;
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
                      aria-label={
                        onOccupant && retirable && !cestMoi ? `Retirer ${occupant.nom}` : `${occupant.nom}${occupant.enAttente ? ", invité" : ""}`
                      }
                      className={cn(
                        "relative flex rounded-[15px] transition-transform active:scale-95 disabled:active:scale-100",
                        cestMoi && "bg-white p-[3px]",
                        occupant.enAttente && "border-[1.5px] border-dashed border-white/70 p-[2px]"
                      )}
                    >
                      <span className={cn("flex rounded-[12px]", cestMoi && "bg-[#1b1d21] p-[2px]", occupant.enAttente && "opacity-45")}>
                        <Pastille player={parNom.get(occupant.nom)} nom={occupant.nom} cote={42} onglet={onglet} />
                      </span>
                      {retirable && onOccupant && !cestMoi && (
                        <span
                          aria-hidden
                          className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-[#0a0b0d] text-white shadow-[0_0_0_1.5px_rgba(255,255,255,0.3)]"
                        >
                          <X className="size-[10px]" strokeWidth={3.2} />
                        </span>
                      )}
                    </button>
                    <span
                      className={cn(
                        "truncate rounded-full py-[2px] leading-[15px] shadow-[inset_0_0_0_1px_rgba(128,128,128,0.45)]",
                        // Quatre ou cinq par rang : l'étiquette se resserre pour garder le prénom.
                        etiquette < 64 ? "px-[4px] text-[10px]" : "px-[7px] text-[11px]"
                      )}
                      style={{
                        // Voilée mais opaque : les lignes du terrain ne passent pas au travers.
                        background: occupant.enAttente ? `color-mix(in srgb, ${onglet.fond} 72%, #1b1d21)` : onglet.fond,
                        color: onglet.encre,
                        fontWeight: cestMoi ? 800 : 600,
                        maxWidth: etiquette,
                      }}
                    >
                      {cestMoi ? "Toi" : prenom(occupant.nom)}
                      {occupant.reste && <span className="font-medium tabular-nums opacity-60"> · {occupant.reste}</span>}
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
    </div>
  );
}
