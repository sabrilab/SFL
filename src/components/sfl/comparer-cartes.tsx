"use client";

// Comparer sa carte avec celle d'un autre joueur (Sabri, 19/10 : « pouvoir
// comparer sa carte avec celle d'un autre joueur »). Ouvert depuis le profil
// d'un joueur, toi à gauche, lui à droite :
//   1. les deux cartes, au même format, et les deux notes en Anton ;
//   2. les deux profils de jeu sur le même radar (profil-radar.tsx), le tien
//      en pointillés (Sabri, 22/10 : « le radar du joueur dans la fonction de
//      comparaison ») ;
//   3. la saison de chacun : Pépite d'Or, buts, passes, MVP, dimanches ;
//   4. le face-à-face, toutes saisons : ensemble, et l'un contre l'autre.
// Noir et blanc, rien d'autre. Calcul du face-à-face dans lib/sfl/carriere.ts.

import { useMemo } from "react";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { RadarDuel } from "@/components/sfl/profil-radar";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { faceAFace } from "@/lib/sfl/carriere";
import { ovr, type Player } from "@/lib/sfl/engine";
import { ordinal } from "@/lib/sfl/fin-de-saison";
import { cn } from "@/lib/utils";

const ANTON = "var(--font-anton), Anton, sans-serif";

/** Une ligne « toi | quoi | lui » : la valeur la plus haute en plein. */
function Ligne({ a, b, quoi, format = String, basGagne = false }: { a: number; b: number; quoi: string; format?: (v: number) => string; basGagne?: boolean }) {
  const aMene = basGagne ? a < b : a > b;
  const bMene = basGagne ? b < a : b > a;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-3 py-2">
      <span className={cn("text-left text-[17px] font-bold tabular-nums", !aMene && "text-foreground/40")}>{format(a)}</span>
      <span className="mono-label text-center text-foreground/45">{quoi}</span>
      <span className={cn("text-right text-[17px] font-bold tabular-nums", !bMene && "text-foreground/40")}>{format(b)}</span>
    </div>
  );
}

export function ComparerCartes({ moi, lui, rangs }: { moi: Player; lui: Player; rangs: Map<string, number> }) {
  const { saison } = useSeason();
  const identite = useIdentites();
  const face = useMemo(() => faceAFace(saison, moi.name, lui.name), [saison, moi.name, lui.name]);
  const noteA = ovr(moi.stats);
  const noteB = ovr(lui.stats);
  const ensemble = face.ensemble.victoires + face.ensemble.nuls + face.ensemble.defaites;
  const contre = face.contre.victoires + face.contre.nuls + face.contre.defaites;

  return (
    <div className="flex flex-col gap-[var(--fib-21)]">
      {/* 1. Les deux cartes */}
      <div className="grid grid-cols-2 gap-[var(--fib-13)]">
        {[
          { p: moi, note: noteA, mene: noteA > noteB, qui: "Toi" },
          { p: lui, note: noteB, mene: noteB > noteA, qui: identite.nom(lui.name) },
        ].map(({ p, note, mene, qui }) => (
          <div key={p.name} className="flex min-w-0 flex-col items-center gap-[var(--fib-8)]">
            <MiniCarte player={p} size={FORMAT_CARTE.grande * 1.1} detail={qui} />
            <span className="w-full truncate text-center text-[15px] font-bold">{qui}</span>
            <span style={{ fontFamily: ANTON, fontSize: 44, lineHeight: 0.9 }} className={cn("tabular-nums", !mene && noteA !== noteB && "text-foreground/40")}>
              {note}
            </span>
          </div>
        ))}
      </div>

      {/* 2. Les deux profils de jeu, superposés */}
      <RadarDuel toi={moi.stats} lui={lui.stats} nomLui={identite.nom(lui.name)} />

      {/* 3. La saison de chacun */}
      <section className="glass flex flex-col divide-y divide-white/8 rounded-[22px] px-4">
        <Ligne a={rangs.get(moi.name) ?? 0} b={rangs.get(lui.name) ?? 0} quoi="Pépite d'Or" format={(v) => (v ? ordinal(v) : "–")} basGagne />
        <Ligne a={moi.pp} b={lui.pp} quoi="Points" />
        <Ligne a={moi.buts} b={lui.buts} quoi="Buts" />
        <Ligne a={moi.passes} b={lui.passes} quoi="Passes" />
        <Ligne a={moi.mvp} b={lui.mvp} quoi="MVP" />
        <Ligne a={moi.matchs} b={lui.matchs} quoi="Dimanches" />
      </section>

      {/* 4. Le face-à-face, toutes saisons */}
      {(ensemble > 0 || contre > 0) && (
        <section className="grid grid-cols-2 gap-2">
          {contre > 0 && (
            <div className="flex flex-col gap-1.5 rounded-2xl bg-secondary px-3 pt-3 pb-2.5">
              <span className="mono-label text-foreground/45">L&apos;un contre l&apos;autre</span>
              <span style={{ fontFamily: ANTON, fontSize: 30, lineHeight: 0.9 }} className="tabular-nums">
                {face.contre.victoires}–{face.contre.defaites}
              </span>
              <span className="font-mono text-[11px] text-foreground/55">
                toi – lui
                {face.contre.nuls > 0 && ` · ${face.contre.nuls} nul${face.contre.nuls > 1 ? "s" : ""}`}
              </span>
            </div>
          )}
          {ensemble > 0 && (
            <div className="flex flex-col gap-1.5 rounded-2xl bg-secondary px-3 pt-3 pb-2.5">
              <span className="mono-label text-foreground/45">Ensemble</span>
              <span style={{ fontFamily: ANTON, fontSize: 30, lineHeight: 0.9 }} className="tabular-nums">
                {face.ensemble.victoires}/{ensemble}
              </span>
              <span className="font-mono text-[11px] text-foreground/55">
                victoire{face.ensemble.victoires > 1 ? "s" : ""}
                {face.ensemble.nuls > 0 && ` · ${face.ensemble.nuls} nul${face.ensemble.nuls > 1 ? "s" : ""}`}
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
