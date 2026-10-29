"use client";

// Le Direct, d'une main : au bord du terrain. Chaque match avec son tableau
// d'affichage (déduit des buts) et « Fin du match · 3 – 2 », qui pose le
// résultat sur toutes les lignes des deux camps. Dessous, la feuille en
// direct de toujours (feuille-directe.tsx) : le camp, les compteurs au
// pouce, les honneurs, remplacer ou échanger un joueur.

import { FeuilleDirecte } from "@/components/sfl/admin/feuille-directe";
import { PastilleMaillot } from "@/components/sfl/point-maillot";
import { finDuMatch } from "@/lib/sfl/saisie/mutations";
import type { Saison } from "@/lib/sfl/saisie/types";
import { haptique } from "@/lib/sfl/haptique";
import type { MatchVu } from "./bloc-matchs";
import { Feuille, PastilleEtat } from "./ui";

export function FeuilleDirect({
  open,
  onOpenChange,
  saison,
  j,
  matchs,
  commit,
  faire,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saison: Saison;
  j: number;
  matchs: MatchVu[];
  commit: (next: Saison, label: string) => boolean;
  faire: (f: (s: Saison) => Saison, label: string) => boolean;
}) {
  return (
    <Feuille open={open} onOpenChange={onOpenChange} titre={`Direct · J${j}`} etat={<PastilleEtat etat="en-direct" />} haute>
      <div className="flex flex-col gap-2">
        {matchs
          .filter((m) => m.noirs.length && m.blancs.length)
          .map((m) => {
            const fini = saison.entries.some((e) => e.j === j && e.team === m.m.equipes[0] && e.result);
            return (
              <div key={m.n} className="glass flex items-center gap-3 rounded-[22px] px-4 py-3">
                <span className="mono-label w-8 text-foreground/45">M{m.n}</span>
                <PastilleMaillot camp="Noirs" className="hidden min-[400px]:inline-flex" />
                <span className="font-display flex-1 text-center text-[30px] leading-none tabular-nums">
                  {m.score[0]} – {m.score[1]}
                </span>
                <PastilleMaillot camp="Blancs" className="hidden min-[400px]:inline-flex" />
                <button
                  type="button"
                  onClick={() => {
                    if (faire((s) => finDuMatch(s, j, m.m.equipes), `Fin du match ${m.n} · ${m.score[0]} – ${m.score[1]}`)) haptique.sceau();
                  }}
                  className={fini ? "bouton-secondaire h-11 px-4 text-[13px] font-semibold" : "bouton-principal h-11 px-4 text-[13px] font-semibold"}
                >
                  {fini ? "✓ Fin" : "Fin du match"}
                </button>
              </div>
            );
          })}
      </div>
      <FeuilleDirecte key={j} saison={saison} jInitial={j} commit={(next, label) => void commit(next, label)} />
    </Feuille>
  );
}
