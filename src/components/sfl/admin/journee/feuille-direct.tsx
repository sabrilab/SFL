"use client";

// Le Direct, d'une main : au bord du terrain. Chaque match avec son tableau
// d'affichage (déduit des buts) et « Fin du match · 3 – 2 », qui pose le
// résultat sur toutes les lignes des deux camps. Dessous, la feuille en
// direct de toujours (feuille-directe.tsx) : le camp, les compteurs au
// pouce, les honneurs, remplacer ou échanger un joueur.
//
// Un match dont la feuille est tenue par un joueur (01/11/2026,
// components/sfl/direct) : sa ligne dit qui la tient et son score en
// direct ; la toucher ouvre sa feuille (Reprendre, Libérer, puis Rouvrir une
// fois scellée). Ses compteurs ne se touchent plus ici : la base refuserait
// de toute façon d'écraser la feuille du joueur (publier_saison).
//
// 22/11/2026 (J7, Sabri : « à chaque fois que je faisais fin du match, il ne
// mettait pas fin, il mettait feuille ») : le bouton d'un match reste « Fin
// du match », feuille ou pas, et devient « ✓ Fin » une fois le match fini.
// Sur une feuille ouverte il la scelle (ses chiffres entrent dans la
// saison) ; sinon il pose le résultat comme toujours. La feuille s'ouvre par
// sa ligne, dessous.

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { FeuilleDirecte } from "@/components/sfl/admin/feuille-directe";
import { PastilleMaillot } from "@/components/sfl/point-maillot";
import { FeuilleDuMatch } from "@/components/sfl/direct/feuille-du-match";
import type { FeuillesDirect } from "@/hooks/use-feuilles-direct";
import { MOTS_DU_REFUS, scoreDeLaFeuille } from "@/lib/sfl/feuille-direct";
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
  direct,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saison: Saison;
  j: number;
  matchs: MatchVu[];
  commit: (next: Saison, label: string) => boolean;
  faire: (f: (s: Saison) => Saison, label: string) => boolean;
  /** Les feuilles tenues par les joueurs (use-feuilles-direct). */
  direct: FeuillesDirect;
}) {
  const [ouverte, setOuverte] = useState<MatchVu | null>(null);
  const [envoi, setEnvoi] = useState<number | null>(null);
  async function sceller(m: MatchVu) {
    setEnvoi(m.n);
    const r = await direct.sceller(m.m.equipes);
    setEnvoi(null);
    if (r.ok) haptique.sceau();
    else {
      haptique.refus();
      toast.error(MOTS_DU_REFUS[r.refus]);
    }
  }
  // Les camps dont la feuille est tenue en ce moment : la saisie d'ici n'y touche plus.
  const verrous = new Map<string, string>();
  for (const m of matchs) {
    const f = direct.feuilleDe(m.m.equipes);
    if (f && !f.fin) for (const e of m.m.equipes) verrous.set(e, f.preneur_nom ?? "libre");
  }
  return (
    <Feuille open={open} onOpenChange={onOpenChange} titre={`Direct · J${j}`} etat={<PastilleEtat etat="en-direct" />} haute>
      <div className="flex flex-col gap-2">
        {matchs
          .filter((m) => m.noirs.length && m.blancs.length)
          .map((m) => {
            const f = direct.feuilleDe(m.m.equipes);
            const score = f && !f.fin ? scoreDeLaFeuille(saison, j, m.m.equipes, f.compteurs) : m.score;
            const fini = f ? !!f.fin : saison.entries.some((e) => e.j === j && e.team === m.m.equipes[0] && e.result);
            return (
              <div key={m.n} className="glass flex flex-col gap-2 rounded-[22px] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="mono-label w-8 text-encre-3">M{m.n}</span>
                  <PastilleMaillot camp="Noirs" className="hidden min-[400px]:inline-flex" />
                  <span className="font-display flex-1 text-center text-titre-l leading-none tabular-nums">
                    {score[0]} – {score[1]}
                  </span>
                  <PastilleMaillot camp="Blancs" className="hidden min-[400px]:inline-flex" />
                  <button
                    type="button"
                    disabled={envoi === m.n}
                    onClick={() => {
                      // Une feuille ouverte : c'est elle qui porte les chiffres du match, « Fin du match » la scelle.
                      if (f && !f.fin) void sceller(m);
                      else if (faire((s) => finDuMatch(s, j, m.m.equipes), `Fin du match ${m.n} · ${m.score[0]} – ${m.score[1]}`)) haptique.sceau();
                    }}
                    className={fini ? "bouton-secondaire h-11 px-4 text-corps font-semibold" : "bouton-principal h-11 px-4 text-corps font-semibold"}
                  >
                    {fini ? "✓ Fin" : "Fin du match"}
                  </button>
                </div>
                {f && (
                  <button
                    type="button"
                    onClick={() => {
                      haptique.choix();
                      setOuverte(m);
                    }}
                    className="bouton-discret mono-label -mx-2 -mb-1 flex h-11 items-center justify-between gap-2 px-2 text-encre-3"
                  >
                    <span className="min-w-0 truncate">
                      {f.fin ? "✓" : "◉"} Feuille · {f.preneur_nom ?? "libre"}
                    </span>
                    <ChevronRight className="size-4 shrink-0" />
                  </button>
                )}
              </div>
            );
          })}
      </div>
      <FeuilleDirecte key={j} saison={saison} jInitial={j} embarque verrous={verrous} commit={(next, label) => void commit(next, label)} />
      {ouverte && (
        <FeuilleDuMatch
          open={!!ouverte}
          onOpenChange={(o) => !o && setOuverte(null)}
          saison={saison}
          j={j}
          equipes={ouverte.m.equipes}
          label={`Match ${ouverte.n}`}
          direct={direct}
          mode="admin"
        />
      )}
    </Feuille>
  );
}
