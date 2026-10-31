"use client";

// La feuille de la journée, à consulter (Sabri, 31/10/2026 : « je pouvais
// faire une feuille de match à consulter […] m'assurer que tout le monde ait
// bien ses points »). Ce que montrait l'onglet Feuille → Consulter de
// l'ancien tableau, pour la seule journée ouverte : match par match, les
// Noirs puis les Blancs, chaque ligne avec ses chiffres, ses honneurs et ses
// points de la journée décomposés (detail-points.tsx) ; puis les lignes hors
// des camps et les alertes de cohérence du moteur. Toucher une ligne ouvre
// sa fiche (FeuilleLigne), où se mettent le bonus et tout le reste.

import { useMemo } from "react";
import { PastilleMaillot } from "@/components/sfl/point-maillot";
import { decomposer } from "@/components/sfl/admin/detail-points";
import { computeAlerts, entryPP } from "@/lib/sfl/saisie/engine";
import { lireEquipe } from "@/lib/sfl/saisie/equipes";
import type { MatchEntry, Saison } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";
import type { MatchVu } from "./bloc-matchs";
import { Etiquette, Feuille } from "./ui";

type Ligne = { e: MatchEntry; i: number };

function Honneurs({ e }: { e: MatchEntry }) {
  const h = [e.mvp && "MVP", e.impact && "IMP", e.def && "DÉF", e.cleanSheet && "CS"].filter(Boolean) as string[];
  if (!h.length) return null;
  return (
    <span className="flex shrink-0 gap-1">
      {h.map((x) => (
        <span key={x} className="mono-label rounded-full bg-foreground px-1.5 py-0.5 text-micro text-background">
          {x}
        </span>
      ))}
    </span>
  );
}

function Lignes({ lignes, onLigne }: { lignes: Ligne[]; onLigne: (i: number) => void }) {
  return (
    <div className="flex flex-col">
      {lignes.map(({ e, i }) => (
        <button
          key={i}
          type="button"
          onClick={() => onLigne(i)}
          className={cn("flex flex-col gap-0.5 rounded-xl px-2 py-2 text-left active:bg-secondary", e.statut !== "Présent" && "opacity-60")}
        >
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-ligne font-semibold">{e.player}</span>
            <Honneurs e={e} />
            <span className="mono-label shrink-0 text-encre-3 tabular-nums">
              {e.buts}B · {e.passes}PD
            </span>
            <span className="w-9 shrink-0 text-right text-lecture font-bold tabular-nums">{entryPP(e)}</span>
          </span>
          <span className="text-corps leading-snug text-encre-3">{decomposer(e)}</span>
        </button>
      ))}
    </div>
  );
}

export function FeuilleConsulter({
  open,
  onOpenChange,
  saison,
  j,
  matchs,
  onLigne,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saison: Saison;
  j: number;
  matchs: MatchVu[];
  onLigne: (i: number) => void;
}) {
  const lignes = useMemo(() => saison.entries.map((e, i) => ({ e, i })).filter((x) => x.e.j === j), [saison.entries, j]);
  const alertes = useMemo(() => computeAlerts(saison).filter((a) => a.j === j), [saison, j]);
  const camps = new Set(matchs.flatMap((m) => m.m.equipes));
  const horsCamps = lignes.filter((x) => !x.e.team || !camps.has(x.e.team));
  const total = lignes.reduce((s, x) => s + entryPP(x.e), 0);

  return (
    <Feuille open={open} onOpenChange={onOpenChange} titre={`Feuille · J${j}`} etat={<span className="mono-label text-encre-3">{lignes.length} lignes · {total} PP</span>} haute>
      {alertes.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <Etiquette>Alertes · {alertes.length}</Etiquette>
          <div className="flex flex-wrap gap-1.5">
            {alertes.map((a, k) => {
              const i = lignes.find((x) => x.e.player === a.player)?.i;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => i != null && onLigne(i)}
                  className={cn("mono-label inline-flex items-center gap-1.5 rounded-full px-3 py-1.5", a.level === "error" ? "bg-foreground text-background" : "bg-secondary text-encre-2")}
                >
                  ! {a.player} · {a.message}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {matchs.map((m) => {
        const deCamp = (nom: string) => lignes.filter((x) => x.e.team === nom);
        return (
          <section key={m.n} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Etiquette>Match {m.n}</Etiquette>
              <span className="font-display text-titre-m leading-none tabular-nums">
                {m.score[0]} – {m.score[1]}
              </span>
            </div>
            {m.m.equipes.map((nom) => {
              const camp = lireEquipe(nom)?.camp;
              const siennes = deCamp(nom);
              return (
                <div key={nom} className="glass rounded-[20px] p-2">
                  <p className="flex items-center gap-1.5 px-2 pt-1 pb-1.5 text-corps font-bold">
                    {camp && <PastilleMaillot camp={camp} />}
                    {nom}
                    <span className="mono-label ml-auto text-encre-3">{siennes.length}</span>
                  </p>
                  {siennes.length ? <Lignes lignes={siennes} onLigne={onLigne} /> : <p className="mono-label px-2 pb-2 text-encre-4">0</p>}
                </div>
              );
            })}
          </section>
        );
      })}

      {horsCamps.length > 0 && (
        <section className="flex flex-col gap-2">
          <Etiquette>Hors des camps · {horsCamps.length}</Etiquette>
          <div className="glass rounded-[20px] p-2">
            <Lignes lignes={horsCamps} onLigne={onLigne} />
          </div>
        </section>
      )}
    </Feuille>
  );
}
