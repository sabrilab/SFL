"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerCard } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { PLAYERS } from "@/lib/sfl/data";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { getRatings, pickPair, recordDuel, resetRatings } from "@/lib/sfl/duel";

export default function DuelPage() {
  const { me } = useMyPlayer();
  const isClient = useIsClient();
  // Tirage au sort une seule fois par montage — le rendu reste masqué tant
  // que isClient est faux, donc aucun désaccord serveur/client possible.
  const [pair, setPair] = useState<[Player, Player]>(() => pickPair(PLAYERS));

  // Lu directement au rendu (comme les tallies de vote) : toujours à jour
  // après un duel ou un changement de profil, sans état dupliqué.
  const ratings = isClient ? getRatings(me) : {};

  function choose(winnerName: string, loserName: string) {
    recordDuel(me, winnerName, loserName);
    setPair((prev) => pickPair(PLAYERS, [prev[0].name, prev[1].name]));
    toast.success(`${winnerName} l'emporte`, { description: `Face à ${loserName}` });
  }

  function reset() {
    resetRatings(me);
    setPair((prev) => pickPair(PLAYERS, [prev[0].name, prev[1].name]));
    toast.success("Classement personnel réinitialisé");
  }

  const ranked = Object.entries(ratings)
    .filter(([, r]) => r.duels > 0)
    .sort((a, b) => b[1].elo - a[1].elo);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7 px-5 py-4 sm:py-8">
      <div>
        <p className="text-[13px] font-medium text-muted-foreground">Ton avis compte</p>
        <h1 className="text-[34px] font-bold tracking-tight">Duel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisis le meilleur des deux joueurs. Chaque duel nourrit ton classement
          personnel — l&apos;agrégation entre tous les joueurs arrivera avec le backend.
        </p>
      </div>

      {isClient ? (
        <section className="flex items-center justify-center gap-3">
          {pair.map((p, i) => {
            const other = pair[1 - i];
            return (
              <button
                key={p.name}
                onClick={() => choose(p.name, other.name)}
                className="flex flex-col items-center gap-2 rounded-3xl p-2 transition-transform active:scale-95"
                aria-label={`Choisir ${p.name}`}
              >
                <PlayerCard player={p} mode="simple" size={0.56} />
                <span className="text-sm font-semibold">{p.name}</span>
              </button>
            );
          })}
        </section>
      ) : (
        <div className="flex justify-center py-10">
          <Swords className="size-8 animate-pulse text-muted-foreground" />
        </div>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-lg font-semibold tracking-tight">Ton classement personnel</h2>
          {ranked.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
              <RotateCcw /> Réinitialiser
            </Button>
          )}
        </div>

        {ranked.length === 0 ? (
          <div className="rounded-3xl bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            Choisis un vainqueur ci-dessus pour démarrer ton classement.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {ranked.map(([name, r], i) => {
              const isMe = name === me;
              return (
                <div
                  key={name}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5",
                    isMe && "ring-1 ring-primary/50"
                  )}
                >
                  <span
                    className={cn(
                      "w-7 text-base font-semibold tabular-nums",
                      i < 3 ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="mr-0.5 flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                    {name[0]}
                  </span>
                  <span className="flex-1 truncate text-[15px] font-semibold">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.duels} duel{r.duels > 1 ? "s" : ""}
                  </span>
                  <span className="w-16 text-right text-lg font-bold tracking-tight tabular-nums">
                    {r.elo}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
