"use client";

// L'arbitre de chaque match de la journée, dans son récap (Sabri, 24/10 :
// « chaque joueur du match puisse mettre une note de satisfaction à
// l'arbitre, et ça apparaît sur sa carte au lieu de son score de joueur »).
//
// Un rang par match arbitré : sa carte d'arbitre (carte-arbitre.tsx), son
// nom, le match, et la satisfaction de ce match (la moyenne des notes sur 5,
// ×20, comme sur sa carte). Le joueur de ce match, une fois le résultat
// saisi, le note de 1 à 5 d'un toucher, et peut changer d'avis ; la base
// vérifie qu'il a bien joué ce match (noter_arbitre). Personne ne voit qui a
// mis quoi. Rien sans arbitre, ni dans une saison close.

import { useState } from "react";
import { CarteArbitre } from "@/components/sfl/carte-arbitre";
import { Reveal } from "@/components/sfl/feed/reveal";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSaisonClose, useSeason } from "@/components/sfl/season-provider";
import { useArbitres } from "@/hooks/use-arbitres";
import { useIdentites } from "@/hooks/use-identites";
import { noterArbitre, satisfactionDe } from "@/lib/sfl/arbitres";
import { cn } from "@/lib/utils";

const NOTES = [1, 2, 3, 4, 5] as const;

export function ArbitresDuMatch({ j }: { j: number }) {
  const relue = useSaisonClose();
  const { saison } = useSeason();
  const { me } = useMyPlayer();
  const arbitres = useArbitres();
  const identite = useIdentites();
  const [erreur, setErreur] = useState<string | null>(null);
  const numero = saison.numero ?? 0;
  const liste = arbitres.arbitrages.filter((a) => a.saison === numero && a.j === j).sort((a, b) => a.n - b.n);
  if (relue || liste.length === 0) return null;
  // Ma ligne de la journée : je note l'arbitre de mon match, une fois le résultat saisi.
  const moi = saison.entries.find((e) => e.j === j && e.player === me && e.statut === "Présent" && !!e.result && !e.extraTime);

  return (
    <Reveal>
      <section className="glass rounded-3xl p-5">
        <p className="mono-label text-foreground/55">{liste.length > 1 ? "Les arbitres" : "L'arbitre"}</p>
        <div className="mt-3 flex flex-col gap-4">
          {liste.map((a) => {
            const sat = satisfactionDe(arbitres.avis[a.id]);
            const avis = arbitres.avis[a.id]?.avis ?? 0;
            const peutNoter = !!moi && a.arbitre !== me && (a.equipes.length === 0 || a.equipes.includes(moi.team ?? ""));
            const maNote = arbitres.mesNotes[a.id];
            return (
              <div key={a.id} className="flex items-center gap-4">
                <div className="shrink-0">
                  <CarteArbitre nom={a.arbitre} size={0.42} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate text-[17px] font-bold tracking-tight">{identite.nom(a.arbitre)}</span>
                    <span className="truncate font-mono text-[11px] text-foreground/45">
                      Match {a.n + 1}
                      {a.equipes.length === 2 ? ` · ${a.equipes[0]} – ${a.equipes[1]}` : ""}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[28px] leading-none font-black tracking-tight tabular-nums italic">{sat ?? "–"}</span>
                    <span className="font-mono text-[11px] whitespace-nowrap text-foreground/45">
                      {avis > 0 ? `sur ce match · ${avis} note${avis > 1 ? "s" : ""}` : "sur ce match"}
                    </span>
                  </div>
                  {peutNoter && (
                    <div className="flex flex-col gap-1.5">
                      <span className="font-mono text-[11px] text-foreground/55">{maNote ? "ta note" : "note l'arbitre"}</span>
                      <div
                        className="flex gap-1.5"
                        role="radiogroup"
                        aria-label={`Ta note pour ${identite.nom(a.arbitre)}, de 1 à 5`}
                      >
                        {NOTES.map((n) => (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={maNote === n}
                            onClick={async () => {
                              setErreur(null);
                              const e = await noterArbitre(a.id, n);
                              if (e) setErreur(e);
                              else if (typeof navigator !== "undefined") navigator.vibrate?.(8);
                            }}
                            className={cn(
                              "flex size-10 items-center justify-center text-[16px] font-bold tabular-nums",
                              maNote === n ? "rounded-full bg-foreground text-background" : "bouton-secondaire text-foreground/70"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {erreur && <p className="mt-3 text-[13px] text-foreground/60">{erreur}</p>}
      </section>
    </Reveal>
  );
}
