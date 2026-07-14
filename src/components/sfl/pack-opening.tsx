"use client";

// Cérémonie d'ouverture de pack — plein écran, séquencée pour donner de
// l'émotion : le pack pulse, on le touche pour le déchirer (flash), puis
// chaque carte se révèle une à une avec un halo à la couleur de sa
// rareté ; les hors-série arrivent avec un temps de suspense et un halo
// démesuré. On termine sur le tirage complet.

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CollectionCardVisual } from "./collection-card-visual";
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
            <motion.div
              animate={torn ? {} : { scale: [1, 1.03, 1], rotate: [0, -1.2, 1.2, 0] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
              className="flex h-64 w-44 flex-col items-center justify-center gap-3 rounded-3xl"
              style={{
                background:
                  "radial-gradient(120% 130% at 30% 20%, #241A06 0%, #120C03 60%, #060402 100%)",
                boxShadow:
                  "0 0 60px rgba(240,190,90,.45), 0 0 140px rgba(240,190,90,.2), inset 0 0 0 2.5px #F2CE7B66",
              }}
            >
              <Sparkles className="size-8 text-[#F2CE7B]" />
              <span className="font-display text-3xl text-[#F2CE7B] italic">SFL</span>
              <span className="text-[11px] font-bold tracking-[0.3em] text-[#C9964A] uppercase">
                Booster
              </span>
            </motion.div>
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
            <CollectionCardVisual card={current} size={0.95} />
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
                  <CollectionCardVisual card={card} size={0.42} />
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
