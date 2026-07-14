"use client";

// Arène — Match : compose ton deck de 5 cartes issues de ta collection
// et lance une simulation contre le deck préparé par un autre joueur
// (asynchrone ; v1 locale : decks des autres profils de cet appareil,
// deck généré sinon).

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { PackageOpen, Play, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CollectionCardVisual } from "./collection-card-visual";
import { useIsClient } from "@/hooks/use-is-client";
import { CATALOG, CATALOG_BY_ID, getOwned, KIND_LABELS } from "@/lib/sfl/collection";
import {
  DECK_SIZE,
  deckPower,
  getDeck,
  pickOpponentDeck,
  saveDeck,
  simulateMatch,
  type MatchResult,
  type OpponentDeck,
} from "@/lib/sfl/match-sim";

export function MatchArena({ me }: { me: string }) {
  const isClient = useIsClient();
  const [tick, setTick] = useState(0);
  const [opponent, setOpponent] = useState<OpponentDeck | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [playing, setPlaying] = useState(false);

  if (!isClient) return null;

  void tick;
  const owned = getOwned(me);
  const myCards = CATALOG.filter((c) => (owned[c.id] ?? 0) > 0);
  const deckIds = getDeck(me).filter((id) => (owned[id] ?? 0) > 0);
  const deckCards = deckIds.map((id) => CATALOG_BY_ID.get(id)!);
  const ready = deckIds.length === DECK_SIZE;

  function toggle(id: string) {
    let next: string[];
    if (deckIds.includes(id)) {
      next = deckIds.filter((d) => d !== id);
    } else if (deckIds.length < DECK_SIZE) {
      next = [...deckIds, id];
    } else {
      toast.error(`Deck plein — retire une carte d'abord (${DECK_SIZE} max).`);
      return;
    }
    saveDeck(me, next);
    setTick((n) => n + 1);
  }

  function launch() {
    if (!ready) return;
    const opp = pickOpponentDeck(me);
    const res = simulateMatch(deckCards, opp.cards);
    setOpponent(opp);
    setResult(res);
    setPlaying(true);
    // Fin du "direct" une fois tous les événements déroulés.
    const total = 1200 + res.events.length * 900 + 600;
    setTimeout(() => setPlaying(false), total);
  }

  if (myCards.length < DECK_SIZE) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-card px-6 py-10 text-center">
        <PackageOpen className="size-7 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Il te faut au moins {DECK_SIZE} cartes en collection pour composer un deck.
          Tu en as {myCards.length}.
        </p>
        <Button size="sm" className="font-semibold" render={<Link href="/collection">Ouvrir des packs</Link>} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Deck actuel */}
      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-lg font-semibold tracking-tight">Ton deck</h2>
          <span className="text-sm font-medium text-muted-foreground">
            {deckIds.length}/{DECK_SIZE}
            {ready && <span className="ml-2 font-bold text-primary">{deckPower(deckCards)} PWR</span>}
          </span>
        </div>
        <div className="-mx-5 flex gap-3 overflow-x-auto overscroll-x-contain px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {deckCards.map((card) => (
            <button
              key={card.id}
              onClick={() => toggle(card.id)}
              className="shrink-0 rounded-2xl transition-transform active:scale-95"
              aria-label={`Retirer ${card.player.name} du deck`}
            >
              <CollectionCardVisual card={card} size={0.4} />
            </button>
          ))}
          {Array.from({ length: DECK_SIZE - deckCards.length }).map((_, i) => (
            <div
              key={i}
              className="flex h-[150px] w-[104px] shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-border/70 text-2xl text-muted-foreground/50"
            >
              +
            </div>
          ))}
        </div>
      </section>

      {/* Lancer le match */}
      <Button size="lg" disabled={!ready || playing} onClick={launch} className="w-full font-semibold">
        <Play /> {ready ? "Lancer le match" : `Choisis encore ${DECK_SIZE - deckIds.length} carte${DECK_SIZE - deckIds.length > 1 ? "s" : ""}`}
      </Button>

      {/* Résultat animé */}
      <AnimatePresence>
        {result && opponent && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-3xl bg-card"
          >
            <div className="flex items-center justify-between px-5 pt-4">
              <span className="text-sm font-bold">{me}</span>
              <span className="flex items-center gap-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                <Swords className="size-3.5" /> vs
              </span>
              <span className="text-sm font-bold">{opponent.owner}</span>
            </div>
            <div className="px-5 pb-1 text-center">
              <motion.div
                key={`${result.scoreMe}-${result.scoreOpp}-${result.events.length}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: playing ? 1.2 + result.events.length * 0.9 : 0, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="font-display text-5xl tracking-wide"
              >
                {result.scoreMe} – {result.scoreOpp}
              </motion.div>
              <p className="mt-1 text-xs text-muted-foreground">
                {result.powerMe} PWR vs {result.powerOpp} PWR
                {opponent.generated && " · deck par défaut"}
              </p>
            </div>
            <div className="flex flex-col gap-1 px-5 py-3">
              {result.events.length === 0 && (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  0–0 tendu — aucune occasion convertie.
                </p>
              )}
              {result.events.map((e, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: e.team === "me" ? -16 : 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: playing ? 1 + i * 0.9 : 0, duration: 0.35 }}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    e.team === "me" ? "justify-start" : "justify-end"
                  )}
                >
                  <span className="font-semibold tabular-nums">{e.minute}&apos;</span>
                  <span>⚽ {e.scorer}</span>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Collection — choisir les cartes */}
      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-lg font-semibold tracking-tight">Tes cartes</h2>
          <span className="text-sm font-medium text-muted-foreground">
            Touche pour ajouter/retirer
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {myCards.map((card) => {
            const inDeck = deckIds.includes(card.id);
            return (
              <button
                key={card.id}
                onClick={() => toggle(card.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl bg-card px-2 py-3 transition-transform active:scale-95",
                  inDeck && "ring-2 ring-primary"
                )}
              >
                <CollectionCardVisual card={card} size={0.32} />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  {KIND_LABELS[card.kind]}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
