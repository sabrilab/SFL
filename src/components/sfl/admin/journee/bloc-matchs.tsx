"use client";

// MATCHS : un terrain à la fois (le segmenté M1 M2 de CarteJournee), avec les
// vraies cartes à leur place — les Blancs devant, les Noirs au fond, comme le
// terrain d'un match ouvert par un joueur (terrain-places.tsx). Une place
// libre est un « + » : il ouvre le sélecteur de joueurs, pour ce camp. Le
// dernier segment, en pointillé, est « + Match N » : le seul chemin vers un
// match de plus (30/10/2026). Un segment porte « ! » quand son match a un
// défaut ; le défaut se lit au-dessus du terrain, en pastille inversée
// « ! ADIL ×2 » (barré, on le lisait comme déjà réglé).
// La feuille en direct d'un match tenue par un joueur (01/11/2026) se lit
// sur sa pastille, « ◉ Feuille · Ilyes » puis « ✓ Feuille · Ilyes » ; la
// toucher l'ouvre. Pendant qu'elle est tenue, le score est le sien.

import { useMemo } from "react";
import { TerrainPlaces, type Occupant } from "@/components/sfl/matchs/terrain-places";
import { PastilleMaillot } from "@/components/sfl/point-maillot";
import { placerTerrain } from "@/lib/sfl/places-terrain";
import { computeJournees } from "@/lib/sfl/saisie/engine";
import { libelleEcart, type Ecart } from "@/lib/sfl/saisie/integrite";
import type { MatchDuJour, Saison } from "@/lib/sfl/saisie/types";
import { Etiquette, Pastille, Segmente } from "./ui";

export interface MatchVu {
  n: number;
  m: MatchDuJour;
  noirs: { i: number; nom: string }[];
  blancs: { i: number; nom: string }[];
  score: [number, number];
}

/** Les matchs de la journée vus par l'admin, vides compris, avec leurs lignes (index réels). */
export function matchsVus(saison: Saison, j: number, declares: MatchDuJour[]): MatchVu[] {
  const lignes = saison.entries.map((e, i) => ({ e, i })).filter((x) => x.e.j === j && x.e.statut === "Présent");
  const scores = new Map<string, number>();
  for (const m of computeJournees(saison).find((x) => x.j === j)?.matches ?? []) {
    scores.set(m.teamA.name, m.teamA.score);
    scores.set(m.teamB.name, m.teamB.score);
  }
  return declares.map((m, k) => ({
    n: k + 1,
    m,
    noirs: lignes.filter((x) => x.e.team === m.equipes[0]).map((x) => ({ i: x.i, nom: x.e.player })),
    blancs: lignes.filter((x) => x.e.team === m.equipes[1]).map((x) => ({ i: x.i, nom: x.e.player })),
    score: [scores.get(m.equipes[0]) ?? 0, scores.get(m.equipes[1]) ?? 0],
  }));
}

/** Les cartes sur le terrain : les Blancs aux places de devant, les Noirs à celles du fond. */
function occupantsDe(mv: MatchVu): { places: number; occupants: Occupant[] } {
  const cote = Math.max(5, mv.noirs.length, mv.blancs.length);
  const places = cote * 2;
  const dispo = placerTerrain(places).places;
  const devant = dispo.filter((p) => p.chezMoi).map((p) => p.i);
  const fond = dispo.filter((p) => !p.chezMoi).map((p) => p.i);
  const occupants: Occupant[] = [];
  mv.blancs.forEach((x, k) => {
    if (devant[k] != null) occupants[devant[k]] = { cle: String(x.i), nom: x.nom };
  });
  mv.noirs.forEach((x, k) => {
    if (fond[k] != null) occupants[fond[k]] = { cle: String(x.i), nom: x.nom };
  });
  return { places, occupants };
}

export function BlocMatchs({
  saison,
  j,
  matchs,
  courant,
  onCourant,
  onPlus,
  onCarte,
  onAjouterMatch,
  onReglerMatch,
  onArbitre,
  arbitre,
  ecarts,
  direct,
  heureJournee,
  lieu,
  feuille,
  onFeuille,
}: {
  saison: Saison;
  j: number;
  matchs: MatchVu[];
  courant: number;
  onCourant: (n: number) => void;
  /** Toucher un « + » : le camp de ce match (le nom de l'équipe). */
  onPlus?: (equipe: string) => void;
  /** Toucher une carte : l'index de sa ligne. */
  onCarte?: (index: number) => void;
  onAjouterMatch?: () => void;
  onReglerMatch?: (n: number) => void;
  onArbitre?: (n: number) => void;
  arbitre?: (n: number) => string | null;
  ecarts: Ecart[];
  /** En direct : chaque terrain porte son tableau d'affichage. */
  direct?: boolean;
  heureJournee?: string;
  lieu?: (m: MatchDuJour) => string | null;
  /** La feuille en direct du match n (tenue par un joueur), et son score tant qu'elle est ouverte. */
  feuille?: (n: number) => { libelle: string; ouverte: boolean; score: [number, number] } | null;
  onFeuille?: (n: number) => void;
}) {
  const mv = matchs.find((x) => x.n === courant) ?? matchs[0];
  const { places, occupants } = useMemo(() => (mv ? occupantsDe(mv) : { places: 10, occupants: [] }), [mv]);
  const defautDe = (n: number) => ecarts.some((e) => ("match" in e && e.match === n) || ("equipe" in e && matchs[n - 1]?.m.equipes.includes(e.equipe)));
  const options = [
    ...matchs.map((x) => ({ id: x.n, libelle: `M${x.n}`, marque: defautDe(x.n) })),
    ...(onAjouterMatch ? [{ id: -1, libelle: `+ M${matchs.length + 1}`, pointille: true }] : []),
  ];
  const parLigne = new Map(saison.entries.map((e, i) => [i, e]));
  const barres = ecarts.filter((e) => e.r === "I1" || e.r === "I2" || e.r === "I3" || e.r === "I4" || e.r === "I5" || e.r === "I7" || e.r === "I9");
  const tenue = mv ? (feuille?.(mv.n) ?? null) : null;
  const score = tenue?.ouverte ? tenue.score : mv?.score;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Etiquette>Matchs</Etiquette>
        {options.length > 1 && (
          <Segmente
            taille="sm"
            label="Match"
            options={options}
            valeur={mv ? mv.n : -1}
            onChange={(n) => (n === -1 ? onAjouterMatch?.() : onCourant(n))}
            className="max-w-[70%] overflow-x-auto [scrollbar-width:none]"
          />
        )}
      </div>

      {barres.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {barres.map((e) => {
            const nom = "joueur" in e ? e.joueur : null;
            const i = nom ? [...parLigne].find(([, x]) => x.j === j && x.player.toLowerCase() === nom.toLowerCase())?.[0] : undefined;
            return (
              <button
                key={libelleEcart(e)}
                type="button"
                onClick={() => (i != null ? onCarte?.(i) : "match" in e ? onCourant(e.match) : undefined)}
                className="mono-label inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-background"
              >
                <span aria-hidden>!</span>
              {libelleEcart(e)}
              </button>
            );
          })}
        </div>
      )}

      {mv ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pastille onClick={() => onReglerMatch?.(mv.n)}>{mv.m.heure ?? heureJournee ?? "Heure"}</Pastille>
            {(mv.m.terrain || lieu?.(mv.m)) && (
              <Pastille onClick={() => onReglerMatch?.(mv.n)}>{[lieu?.(mv.m), mv.m.terrain ? `T${mv.m.terrain.replace(/^terrain\s*/i, "")}` : null].filter(Boolean).join(" · ")}</Pastille>
            )}
            {onArbitre && (
              <Pastille onClick={() => onArbitre(mv.n)} pointille={!arbitre?.(mv.n)}>
                {arbitre?.(mv.n) ? `Arbitre · ${arbitre(mv.n)}` : "+ Arbitre"}
              </Pastille>
            )}
            {tenue && (
              <Pastille onClick={() => onFeuille?.(mv.n)} actif>
                <span aria-hidden>{tenue.ouverte ? "◉" : "✓"}</span>
                {tenue.libelle}
              </Pastille>
            )}
          </div>
          {(direct || tenue?.ouverte) && score && (
            <div className="flex items-center justify-center gap-4">
              <PastilleMaillot camp="Noirs" />
              <span className="font-display text-affiche leading-none tabular-nums">
                {score[0]} – {score[1]}
              </span>
              <PastilleMaillot camp="Blancs" />
            </div>
          )}
          <p className="mono-label -mb-1 text-center text-encre-3">
            {mv.m.equipes[0]} · {mv.noirs.length}
          </p>
          <TerrainPlaces
            places={places}
            occupants={occupants}
            onPlus={onPlus ? (_i, devant) => onPlus(devant ? mv.m.equipes[1] : mv.m.equipes[0]) : undefined}
            onOccupant={onCarte ? (o) => onCarte(Number(o.cle)) : undefined}
          />
          <p className="mono-label -mt-1 text-center text-encre-3">
            {mv.m.equipes[1]} · {mv.blancs.length}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={onAjouterMatch}
          disabled={!onAjouterMatch}
          className="mono-label grid h-40 place-items-center rounded-[22px] border-[1.5px] border-dashed border-foreground/25 text-encre-2"
        >
          + Match 1
        </button>
      )}
    </section>
  );
}
