"use client";

// Atelier de design des cartes — page de travail, non reliée à la navigation.
// Montre la carte éditoriale (design de référence retenu) sous ses variantes :
// Standard / Rare, sombre / clair, et le layout « legend » des cartes à titre.

import { useState } from "react";
import { EditorialCard, type CardVariant } from "@/components/sfl/editorial-card";
import { BoostCard } from "@/components/sfl/boost-card";
import { useSeason } from "@/components/sfl/season-provider";
import { ovr, rankPlayers, rareStats } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

export default function DesignCartes() {
  const { players, boostCards } = useSeason();
  const classes = rankPlayers(players);
  const [idx, setIdx] = useState(0);
  const [variant, setVariant] = useState<CardVariant>("sombre");

  const player = classes[idx] ?? classes[0];
  if (!player) return null;
  const lastBoost = [...boostCards].reverse().find((c) => c.player === player.name) ?? boostCards[boostCards.length - 1];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-bold">Atelier — design des cartes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          La carte éditoriale du design de référence, sur un vrai joueur, dans ses
          variantes. Page de travail, non reliée à la navigation.
        </p>
      </header>

      <div className="glass mb-6 rounded-2xl p-3">
        <div className="mb-3 flex gap-2">
          {(["sombre", "clair"] as CardVariant[]).map((v) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-sm font-semibold capitalize transition-colors",
                variant === v ? "bg-foreground text-background" : "bg-foreground/10"
              )}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {classes.slice(0, 12).map((p, i) => (
            <button
              key={p.name}
              onClick={() => setIdx(i)}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                i === idx ? "bg-foreground text-background" : "bg-foreground/10"
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <section className="glass rounded-2xl p-4">
          <h2 className="font-heading mb-3 text-base font-semibold">Standard · éditorial</h2>
          <div className="flex justify-center">
            <EditorialCard
              variant={variant}
              tint="standard"
              name={player.name}
              position={player.poste}
              overall={ovr(player.stats)}
              stats={player.stats}
              size={1}
            />
          </div>
        </section>

        <section className="glass rounded-2xl p-4">
          <h2 className="font-heading mb-3 text-base font-semibold">Rare · éditorial or</h2>
          <div className="flex justify-center">
            <EditorialCard
              variant={variant}
              tint="or"
              badge="RARE"
              name={player.name}
              position={player.poste}
              overall={ovr(rareStats(player.stats))}
              stats={rareStats(player.stats)}
              size={1}
            />
          </div>
        </section>

        <section className="glass rounded-2xl p-4">
          <h2 className="font-heading mb-3 text-base font-semibold">Carte à titre · legend</h2>
          <div className="flex justify-center">
            {lastBoost ? (
              <BoostCard card={lastBoost} size={1} />
            ) : (
              <p className="text-sm text-muted-foreground">Aucune carte boost.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
