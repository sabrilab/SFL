"use client";

// Cérémonie d'ouverture de pack — plein écran, séquencée pour donner de
// l'émotion : le pack pulse, on le touche pour le déchirer (flash), puis
// chaque carte se révèle une à une avec un halo à la couleur de sa
// rareté ; les hors-série arrivent avec un temps de suspense et un halo
// démesuré. On termine sur le tirage complet.

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card3D } from "./card-3d";
import { PlayerCard } from "./player-card";
import { CollectionCardVisual } from "./collection-card-visual";
import { PLAYERS } from "@/lib/sfl/data";
import { KIND_LABELS, PACK_COST, type CollectionCard } from "@/lib/sfl/collection";

const GLOW: Record<string, string> = {
  simple: "rgba(226,207,166,.42)",
  rare: "rgba(242,206,123,.6)",
  def: "rgba(127,212,255,.75)",
  impact: "rgba(255,90,31,.75)",
  mvp: "rgba(244,197,66,.85)",
};

const RARITY_RANK: Record<string, number> = { simple: 0, rare: 1, def: 2, impact: 3, mvp: 4 };

function isSpecial(card: CollectionCard) {
  return card.kind !== "simple" && card.kind !== "rare";
}

// Éventail de vraies cartes 3D, dos scellé (gravure SFL) tourné vers
// nous — un vrai bundle de cartes plutôt qu'un rectangle 2D. Décoratives
// (interactive=false) : seule l'animation d'intro joue, elles ne captent
// pas le glissement. Le contenu recto ne sert qu'à alimenter la capture,
// jamais affiché puisqu'elles restent sur leur dos.
const FAN_POSITIONS = [
  { rot: -11, x: -28, z: 0 },
  { rot: 0, x: 0, z: 2 },
  { rot: 11, x: 28, z: 1 },
];
const FAN_SEED = PLAYERS.slice(0, FAN_POSITIONS.length);

export function PackVisual({ torn = false }: { torn?: boolean }) {
  return (
    <motion.div
      animate={torn ? {} : { y: [0, -7, 0] }}
      transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
      className="relative flex h-64 w-44 items-center justify-center"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(240,190,90,.4) 0%, transparent 68%)" }}
      />
      {FAN_POSITIONS.map((f, i) => (
        <div
          key={i}
          className="absolute"
          style={{ transform: `translateX(${f.x}px) rotate(${f.rot}deg)`, zIndex: f.z }}
        >
          <Card3D
            cacheKey={`pack-fan-${i}`}
            mode="rare"
            size={0.62}
            startFace="back"
            interactive={false}
            render={(s) => <PlayerCard player={FAN_SEED[i]} mode="simple" size={s} />}
          />
        </div>
      ))}
    </motion.div>
  );
}

export function PackOpening({
  cards,
  onDone,
}: {
  cards: CollectionCard[];
  onDone: () => void;
}) {
  // phase "pack" → tap → "reveal" carte par carte → "summary"
  const [phase, setPhase] = useState<"pack" | "reveal" | "summary">("pack");
  const [index, setIndex] = useState(0);
  const [torn, setTorn] = useState(false);

  // Les cartes sont révélées de la moins rare à la plus rare : le
  // meilleur pour la fin, c'est là que l'émotion se joue.
  const ordered = [...cards].sort((a, b) => RARITY_RANK[a.kind] - RARITY_RANK[b.kind]);
  const current = ordered[index];

  function tearPack() {
    if (torn) return;
    setTorn(true);
    setTimeout(() => setPhase("reveal"), 550);
  }

  function next() {
    if (index < ordered.length - 1) setIndex((i) => i + 1);
    else setPhase("summary");
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-black/92 px-6 backdrop-blur-sm"
    >
      <AnimatePresence mode="wait">
        {phase === "pack" && (
          <motion.button
            key="pack"
            onClick={tearPack}
            initial={{ scale: 0.6, y: 60, opacity: 0 }}
            animate={
              torn
                ? { scale: [1, 1.06, 1.7], opacity: [1, 1, 0], rotate: [0, -2, 3] }
                : { scale: 1, y: 0, opacity: 1 }
            }
            exit={{ opacity: 0 }}
            transition={torn ? { duration: 0.55, ease: "easeIn" } : { type: "spring", stiffness: 260, damping: 20 }}
            className="flex flex-col items-center gap-5"
            aria-label="Déchirer le pack"
          >
            <PackVisual torn={torn} />
            <span className="animate-pulse text-sm font-semibold text-white/85">
              Touche pour déchirer le pack
            </span>
          </motion.button>
        )}

        {phase === "reveal" && current && (
          <motion.button
            key={`card-${index}`}
            onClick={next}
            initial={{ rotateY: 100, scale: 0.6, opacity: 0 }}
            animate={{ rotateY: 0, scale: 1, opacity: 1 }}
            exit={{ x: -140, opacity: 0, transition: { duration: 0.18 } }}
            transition={{
              // Suspense supplémentaire avant une hors-série.
              delay: isSpecial(current) ? 0.5 : 0.05,
              duration: isSpecial(current) ? 0.7 : 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative flex flex-col items-center gap-4"
            aria-label="Carte suivante"
          >
            {/* Halo de rareté */}
            <motion.div
              className="absolute top-1/2 left-1/2 -z-10 size-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full"
              animate={{ scale: isSpecial(current) ? [1, 1.25, 1] : [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: isSpecial(current) ? 1.4 : 2.4 }}
              style={{ background: `radial-gradient(circle, ${GLOW[current.kind]} 0%, transparent 65%)` }}
            />
            {isSpecial(current) && (
              <motion.span
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="rounded-full bg-white/10 px-4 py-1 text-[11px] font-black tracking-[0.3em] text-white uppercase"
              >
                ✦ Hors-série ✦
              </motion.span>
            )}
            <Card3D
              cacheKey={`pack-reveal-${current.id}`}
              mode={current.kind === "simple" ? "simple" : "rare"}
              size={0.95}
              render={(s) => <CollectionCardVisual card={current} size={s} />}
            />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-bold text-white">
                {KIND_LABELS[current.kind]} · n°{current.serial}/{current.total}
              </span>
              <span className="text-xs text-white/60">
                {index + 1}/{ordered.length} — touche pour continuer
              </span>
            </div>
          </motion.button>
        )}

        {phase === "summary" && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full max-w-md flex-col items-center gap-5"
          >
            <span className="text-lg font-bold text-white">Ton tirage</span>
            <div className="flex flex-wrap items-end justify-center gap-3">
              {ordered.map((card, i) => (
                <motion.div
                  key={`${card.id}-${i}`}
                  initial={{ opacity: 0, scale: 0.7, y: 18 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn("flex flex-col items-center gap-1", isSpecial(card) && "drop-shadow-[0_0_18px_rgba(244,197,66,.6)]")}
                >
                  <Card3D
                    cacheKey={`pack-summary-${card.id}-${i}`}
                    mode={card.kind === "simple" ? "simple" : "rare"}
                    size={0.42}
                    render={(s) => <CollectionCardVisual card={card} size={s} />}
                  />
                  <span className="text-[10px] font-bold text-white/75 uppercase">
                    {KIND_LABELS[card.kind]}
                  </span>
                </motion.div>
              ))}
            </div>
            <Button size="lg" onClick={onDone} className="w-full max-w-xs font-semibold">
              Ajouter à ma collection
            </Button>
            <span className="text-xs text-white/50">Pack ouvert · −{PACK_COST} ⚽</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
