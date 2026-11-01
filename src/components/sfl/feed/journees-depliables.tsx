"use client";

// Les journées de la SFL, en rubriques qu'on déplie.
//
// L'accueil montrait une vidéo, deux cartes et une annonce : on voyait
// « quelque chose », sans comprendre ce qu'on regardait ni où était le reste.
// Ici tout est nommé et rangé — une ligne par dimanche, dans l'ordre, du plus
// récent au plus ancien. On déplie pour voir ce qui s'est passé ; on ouvre
// pour entrer dans le récap complet.
//
// Rien de nouveau n'est calculé : les scores, le meilleur buteur et le
// meilleur passeur viennent déjà de la saison dérivée.

import { useState } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SigleLigue } from "@/components/sfl/choix-ligue";
import type { Journee } from "@/lib/sfl/engine";
import { Nom } from "@/components/sfl/nom";
import { PointMaillot } from "@/components/sfl/point-maillot";

/**
 * « Noirs 7 — 5 Blancs » (chaque match se joue les Noirs contre les Blancs,
 * lib/sfl/maillots.ts), ou le nombre de matchs si la journée en a plusieurs.
 */
function resume(j: Journee): string {
  const matches = j.matches ?? [];
  if (matches.length === 0) return `${(j.lignes ?? []).length} joueurs`;
  if (matches.length === 1) {
    const m = matches[0];
    return `Noirs ${m.teamA.score} — ${m.teamB.score} Blancs`;
  }
  return `${matches.length} matchs`;
}

function butsDe(j: Journee): number {
  return (j.matches ?? []).reduce((s, m) => s + m.teamA.score + m.teamB.score, 0);
}

function Rubrique({
  journee,
  ouverte,
  onBascule,
  onOuvrir,
}: {
  journee: Journee;
  ouverte: boolean;
  onBascule: () => void;
  onOuvrir: () => void;
}) {
  const matches = journee.matches ?? [];
  const buts = butsDe(journee);

  return (
    <div className={cn("glass overflow-hidden rounded-[20px]", ouverte && "bg-contraste/[0.055]")}>
      <button
        onClick={onBascule}
        aria-expanded={ouverte}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <span className="mono-label text-etiquette text-primary">J{journee.j}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lecture font-bold tracking-tight">
            {resume(journee)}
          </span>
          <span className="mono-label mt-0.5 block truncate text-encre-4">
            {journee.date}
            {journee.sflTime && " · SFL Time"}
            {buts > 0 && ` · ${buts} buts`}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-encre-4 transition-transform duration-200",
            ouverte && "rotate-180"
          )}
        />
      </button>

      {ouverte && (
        <div className="flex flex-col gap-2.5 border-t border-contraste/8 px-3.5 pt-3 pb-3.5">
          {/* Les matchs du jour, score en gros */}
          {matches.map((m) => {
            const aGagne = m.teamA.score > m.teamB.score;
            const bGagne = m.teamB.score > m.teamA.score;
            return (
              <div key={m.id} className="glass-soft rounded-2xl px-3.5 py-2.5">
                {matches.length > 1 && (
                  <p className="mono-label mb-1.5 text-encre-4">{m.label}</p>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-1.5 truncate text-ligne font-semibold",
                      aGagne ? "text-foreground" : "text-encre-3"
                    )}
                  >
                    <PointMaillot camp="Noirs" /> Noirs
                  </span>
                  <span className="shrink-0 text-titre font-extrabold tabular-nums">
                    {m.teamA.score} — {m.teamB.score}
                  </span>
                  <span
                    className={cn(
                      "flex min-w-0 flex-1 items-center justify-end gap-1.5 truncate text-right text-ligne font-semibold",
                      bGagne ? "text-foreground" : "text-encre-3"
                    )}
                  >
                    Blancs <PointMaillot camp="Blancs" />
                  </span>
                </div>
              </div>
            );
          })}

          {/* Journée « à plat » : pas d'équipes, on liste les lignes */}
          {matches.length === 0 && (journee.lignes ?? []).length > 0 && (
            <div className="glass-soft flex flex-col gap-1 rounded-2xl px-3.5 py-2.5">
              {(journee.lignes ?? []).slice(0, 6).map(([nom, res, b, p]) => (
                <div key={nom} className="flex items-baseline justify-between gap-3 text-corps">
                  <span className="min-w-0 truncate font-medium"><Nom n={nom} /></span>
                  <span className="mono-label shrink-0 text-encre-3">
                    {res} · {b}b {p}p
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Les faits du jour */}
          {(journee.faits?.buteur || journee.faits?.passeur) && (
            <div className="flex flex-col gap-1.5">
              {journee.faits?.buteur && (
                <p className="flex items-baseline gap-2 text-corps">
                  <span className="mono-label shrink-0 text-encre-4">Buteur</span>
                  <span className="min-w-0 truncate font-semibold">{journee.faits.buteur}</span>
                </p>
              )}
              {journee.faits?.passeur && (
                <p className="flex items-baseline gap-2 text-corps">
                  <span className="mono-label shrink-0 text-encre-4">Passeur</span>
                  <span className="min-w-0 truncate font-semibold">{journee.faits.passeur}</span>
                </p>
              )}
            </div>
          )}

          <button
            onClick={onOuvrir}
            className="bouton-principal mt-0.5 flex items-center justify-center gap-1.5 py-2.5 text-ligne font-bold"
          >
            Ouvrir la journée <ArrowRight className="size-3.5" strokeWidth={2.75} />
          </button>
        </div>
      )}
    </div>
  );
}

export function JourneesDepliables({
  journees,
  onOuvrir,
  rangDuJoueur,
}: {
  /** De la plus récente à la plus ancienne. */
  journees: Journee[];
  onOuvrir: (j: number) => void;
  rangDuJoueur?: string;
}) {
  // La plus récente est ouverte d'entrée : on arrive sur du contenu, pas sur
  // une liste fermée qui n'explique rien.
  const [ouverte, setOuverte] = useState<number | null>(journees[0]?.j ?? null);

  return (
    <section className="flex flex-col gap-2.5">
      {/* La pastille SFL — elle nomme ce qu'on regarde. */}
      <div className="flex items-center gap-3 px-1">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
          <SigleLigue ligue="sfl" hauteur={10} className="text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-titre font-bold tracking-tight">Sunday Five League</h2>
          <p className="mono-label truncate text-encre-4">
            {journees.length} journée{journees.length > 1 ? "s" : ""}
          </p>
          {rangDuJoueur && (
            <p className="mt-0.5 truncate text-corps text-encre-3">{rangDuJoueur}</p>
          )}
        </div>
      </div>

      {journees.map((j) => (
        <Rubrique
          key={j.j}
          journee={j}
          ouverte={ouverte === j.j}
          onBascule={() => setOuverte(ouverte === j.j ? null : j.j)}
          onOuvrir={() => onOuvrir(j.j)}
        />
      ))}
    </section>
  );
}
