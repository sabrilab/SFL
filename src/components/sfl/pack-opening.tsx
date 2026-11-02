"use client";

// Cérémonie d'ouverture de pack — plein écran, séquencée pour donner de
// l'émotion : le pack pulse, on le touche pour le déchirer (flash), puis
// chaque carte se révèle une à une avec un halo à la couleur de sa
// rareté ; les hors-série arrivent avec un temps de suspense et un halo
// démesuré. On termine sur le tirage complet.
// Depuis le 01/11/2026, la cérémonie est générique (CeremoniePack) : la
// collection en Ballons garde son comportement (PackOpening), et le PACK
// AFRIQUE 2027, payé en XP (mode-passe-packs.tsx), y passe son étui et la
// carte du joueur dans la nation tirée.

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card3D } from "./card-3d";
import { PlayerCard } from "./player-card";
import { CollectionCardVisual } from "./collection-card-visual";
import { PLAYERS } from "@/lib/sfl/data";
import { KIND_LABELS, PACK_COST, type CollectionCard } from "@/lib/sfl/collection";
import { sonDechirure, sonRevelation } from "@/lib/sfl/son";

const GLOW: Record<string, string> = {
  simple: "rgba(226,207,166,.42)",
  def: "rgba(127,212,255,.75)",
  impact: "rgba(255,90,31,.75)",
  mvp: "rgba(244,197,66,.85)",
};

const RARITY_RANK: Record<string, number> = { simple: 0, def: 1, impact: 2, mvp: 3 };

function isSpecial(card: CollectionCard) {
  return card.kind !== "simple";
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
            mode="simple"
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

/** Une carte à révéler, quelle qu'elle soit (la collection, ou le PACK AFRIQUE 2027). */
export interface Revelation {
  cle: string;
  /** La carte (sa 3D, ou sa cérémonie à elle). */
  rendu: ReactNode;
  /** Le halo derrière elle. */
  halo: string;
  /** Sous la carte : « MVP · n°12/40 », « Sénégal · Manjak · n° 0042 ». */
  legende: ReactNode;
  /** Une hors-série : le suspense avant, le halo qui bat plus fort, sa puce. */
  speciale?: boolean;
  puce?: string;
  /** Le son de l'apparition (son.ts). */
  son?: string;
}

/**
 * La cérémonie, générique : l'étui pulse, on le touche, il se déchire, puis
 * chaque carte se révèle une à une ; `fin` termine (le tirage complet de la
 * collection, ou la carte posée et « Porter » du Pack Afrique). « Réduire les
 * animations » : la première carte arrive posée.
 */
export function CeremoniePack({
  etui,
  revelations,
  fin,
  appel = "Touche pour déchirer le pack",
  suite = (i, n) => `${i + 1}/${n} — touche pour continuer`,
  reduit = false,
}: {
  etui: ReactNode;
  revelations: Revelation[];
  /** Ce qui suit la dernière carte ; sans lui, la dernière carte reste. */
  fin?: ReactNode;
  /** Sous l'étui, avant le geste ; null : rien. */
  appel?: string | null;
  /** Sous chaque carte : où l'on en est ; null : rien. */
  suite?: ((i: number, n: number) => string) | null;
  reduit?: boolean;
}) {
  // phase "pack" → tap → "reveal" carte par carte → "summary"
  const [phase, setPhase] = useState<"pack" | "reveal" | "summary">(reduit ? "reveal" : "pack");
  const [index, setIndex] = useState(0);
  const [torn, setTorn] = useState(false);
  const current = revelations[index];

  function tearPack() {
    if (torn) return;
    // Premier geste de la cérémonie : il déverrouille l'audio au passage.
    sonDechirure();
    navigator.vibrate?.([12, 40, 18]);
    setTorn(true);
    setTimeout(() => setPhase("reveal"), 550);
  }

  function next() {
    if (index < revelations.length - 1) setIndex((i) => i + 1);
    else if (fin) setPhase("summary");
  }

  // Chaque carte sonne à son apparition — la couleur suit la rareté. L'audio
  // a été déverrouillé par le geste de la déchirure.
  useEffect(() => {
    if (phase === "reveal" && current) {
      sonRevelation(current.son ?? "simple");
      navigator.vibrate?.(current.speciale ? [10, 60, 24] : 14);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="dark fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-black/92 px-6 text-foreground backdrop-blur-sm"
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
            {etui}
            {appel && <span className="animate-pulse text-sm font-semibold text-white/85">{appel}</span>}
          </motion.button>
        )}

        {phase === "reveal" && current && (
          <motion.div
            key={`card-${index}`}
            role={revelations.length > 1 || fin ? "button" : undefined}
            tabIndex={revelations.length > 1 || fin ? 0 : undefined}
            onClick={next}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && next()}
            initial={reduit ? false : { rotateY: 100, scale: 0.6, opacity: 0 }}
            animate={{ rotateY: 0, scale: 1, opacity: 1 }}
            exit={{ x: -140, opacity: 0, transition: { duration: 0.18 } }}
            transition={{
              // Suspense supplémentaire avant une hors-série.
              delay: current.speciale ? 0.5 : 0.05,
              duration: current.speciale ? 0.7 : 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative flex flex-col items-center gap-4"
            aria-label={revelations.length > 1 || fin ? "Carte suivante" : undefined}
          >
            {/* Halo de rareté */}
            <motion.div
              className="absolute top-1/2 left-1/2 -z-10 size-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full"
              animate={reduit ? undefined : { scale: current.speciale ? [1, 1.25, 1] : [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: current.speciale ? 1.4 : 2.4 }}
              style={{ background: `radial-gradient(circle, ${current.halo} 0%, transparent 65%)` }}
            />
            {current.puce && (
              <motion.span
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="rounded-full bg-white/10 px-4 py-1 text-[11px] font-black tracking-[0.3em] text-white uppercase"
              >
                {current.puce}
              </motion.span>
            )}
            {current.rendu}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm font-bold text-white">{current.legende}</span>
              {suite && <span className="text-xs text-white/60">{suite(index, revelations.length)}</span>}
            </div>
          </motion.div>
        )}

        {phase === "summary" && fin && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full max-w-md flex-col items-center gap-5"
          >
            {fin}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** La collection (packs en Ballons) : la cérémonie telle qu'elle était, ses cartes de la moins rare à la plus rare. */
export function PackOpening({
  cards,
  onDone,
}: {
  cards: CollectionCard[];
  onDone: () => void;
}) {
  // Les cartes sont révélées de la moins rare à la plus rare : le
  // meilleur pour la fin, c'est là que l'émotion se joue.
  const ordered = [...cards].sort((a, b) => RARITY_RANK[a.kind] - RARITY_RANK[b.kind]);
  return (
    <CeremoniePack
      etui={<PackVisual />}
      revelations={ordered.map((card) => ({
        cle: card.id,
        halo: GLOW[card.kind],
        speciale: isSpecial(card),
        puce: isSpecial(card) ? "✦ Hors-série ✦" : undefined,
        son: card.kind,
        rendu: (
          <Card3D
            cacheKey={`pack-reveal-${card.id}`}
            mode={"simple"}
            size={0.95}
            render={(s) => <CollectionCardVisual card={card} size={s} />}
          />
        ),
        legende: `${KIND_LABELS[card.kind]} · n°${card.serial}/${card.total}`,
      }))}
      fin={
        <>
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
                  mode={"simple"}
                  size={0.42}
                  render={(s) => <CollectionCardVisual card={card} size={s} />}
                />
                <span className="text-[10px] font-bold text-white/75 uppercase">{KIND_LABELS[card.kind]}</span>
              </motion.div>
            ))}
          </div>
          <Button size="lg" variant="or" onClick={onDone} className="w-full max-w-xs font-semibold">
            Ajouter à ma collection
          </Button>
          <span className="text-xs text-white/50">Pack ouvert · −{PACK_COST} ⚽</span>
        </>
      }
    />
  );
}
