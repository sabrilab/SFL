"use client";

// La cérémonie des nouvelles cartes — à l'ouverture de l'app.
//
// Quand l'admin met une journée à jour et qu'une carte t'est attribuée (MVP,
// Impact, Défensive), tu la découvres à ta prochaine ouverture : l'app se
// voile, ta carte arrive dos tourné, tu touches — son + retournement + halo à
// la couleur du titre. Plusieurs cartes ? Elles s'égrènent une à une.
//
// Le déjà-vu est mémorisé PAR JOUEUR (localStorage) : à la toute première
// visite, l'historique est marqué comme vu en silence — la cérémonie est
// réservée aux cartes qui arrivent APRÈS, jamais à la reprise d'historique.
// Fermer l'app au milieu ne perd rien : les cartes non révélées reviennent.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BoostCard, BOOST_LABELS } from "@/components/sfl/boost-card";
import { Card3D } from "@/components/sfl/card-3d";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useSession } from "@/hooks/use-session";
import { sonRevelation } from "@/lib/sfl/son";
import type { BoostCardData } from "@/lib/sfl/engine";

const GLOW: Record<string, string> = {
  def: "rgba(127,212,255,.75)",
  impact: "rgba(255,90,31,.75)",
  mvp: "rgba(244,197,66,.85)",
};

/** Identité stable d'une carte reçue — le joueur est déjà fixé par la clé. */
const carteKey = (c: BoostCardData) => `${c.type}|${c.date}|${c.ovr}`;

const vuKey = (me: string) => `sfl-cartes-vues-${me}`;

export function NouvellesCartes() {
  const { me } = useMyPlayer();
  const { boostCards } = useSeason();
  const session = useSession();

  const [queue, setQueue] = useState<BoostCardData[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Pas de session : on est sur l'écran de connexion, pas de cérémonie.
    if (!session) return;
    const mine = boostCards.filter((c) => c.player === me);
    const keys = mine.map(carteKey);
    const raw = localStorage.getItem(vuKey(me));

    // Première visite de ce joueur : tout l'historique est « vu », en silence.
    if (raw === null) {
      localStorage.setItem(vuKey(me), JSON.stringify(keys));
      return;
    }

    let seen: string[];
    try {
      const parsed: unknown = JSON.parse(raw);
      // Un stockage abîmé ne doit pas faire tomber l'écran : sans tableau,
      // on repart d'une liste vide plutôt que de laisser `new Set` échouer.
      seen = Array.isArray(parsed) ? parsed : [];
    } catch {
      seen = [];
    }
    const seenSet = new Set(seen);
    const fresh = mine.filter((c) => !seenSet.has(carteKey(c)));
    if (fresh.length === 0) return;

    // Un temps de respiration après le splash d'ouverture, puis la cérémonie.
    const timer = setTimeout(() => {
      setQueue(fresh);
      setIndex(0);
      setRevealed(false);
    }, 1400);
    return () => clearTimeout(timer);
  }, [session, me, boostCards]);

  if (!queue || queue.length === 0) return null;
  const current = queue[index];
  if (!current) return null;

  function reveler() {
    // Le geste débloque l'audio — c'est la règle des navigateurs.
    sonRevelation(current.type);
    setRevealed(true);
  }

  function suivant() {
    if (index < queue!.length - 1) {
      setIndex((i) => i + 1);
      setRevealed(false);
    } else {
      terminer();
    }
  }

  function terminer() {
    // On ne marque « vu » QUE ce qui a été réellement révélé : fermer avec
    // « Plus tard » au milieu laisse les cartes suivantes revenir à la
    // prochaine ouverture.
    const montrees = queue!.slice(0, index + (revealed ? 1 : 0)).map(carteKey);
    let seen: string[];
    try {
      seen = JSON.parse(localStorage.getItem(vuKey(me)) ?? "[]");
    } catch {
      seen = [];
    }
    localStorage.setItem(vuKey(me), JSON.stringify([...new Set([...seen, ...montrees])]));
    setQueue(null);
  }

  return (
    <AnimatePresence>
      <motion.div
        key="nouvelles-cartes"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-black/92 px-6 backdrop-blur-sm"
      >
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.button
              key={`dos-${index}`}
              onClick={reveler}
              initial={{ scale: 0.6, y: 60, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 240, damping: 20 }}
              className="flex flex-col items-center gap-6"
              aria-label="Révéler la carte"
            >
              <motion.span
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-black tracking-[0.3em] text-white uppercase"
              >
                {queue.length > 1 ? `${queue.length} nouvelles cartes` : "Nouvelle carte"}
              </motion.span>
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
              >
                <Card3D
                  cacheKey={`nouvelle-dos-${me}-${index}`}
                  mode="rare"
                  size={0.9}
                  startFace="back"
                  interactive={false}
                  render={(s) => <BoostCard card={current} size={s} />}
                />
              </motion.div>
              <span className="animate-pulse text-sm font-semibold text-white/85">
                Touche pour révéler
              </span>
            </motion.button>
          ) : (
            <motion.button
              key={`face-${index}`}
              onClick={suivant}
              initial={{ rotateY: 100, scale: 0.65, opacity: 0 }}
              animate={{ rotateY: 0, scale: 1, opacity: 1 }}
              exit={{ x: -140, opacity: 0, transition: { duration: 0.18 } }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex flex-col items-center gap-5"
              aria-label="Continuer"
            >
              {/* Halo à la couleur du titre */}
              <motion.div
                className="absolute top-1/2 left-1/2 -z-10 size-[135%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                style={{
                  background: `radial-gradient(circle, ${GLOW[current.type] ?? GLOW.mvp} 0%, transparent 65%)`,
                }}
              />
              <motion.span
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="rounded-full bg-white/10 px-4 py-1 text-[11px] font-black tracking-[0.3em] text-white uppercase"
              >
                ✦ {BOOST_LABELS[current.type]} · {current.date} ✦
              </motion.span>
              <Card3D
                cacheKey={`nouvelle-face-${me}-${index}`}
                mode="rare"
                size={0.95}
                render={(s) => <BoostCard card={current} size={s} />}
              />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm font-bold text-white">
                  Elle est à toi, {me} — bien joué dimanche.
                </span>
                <span className="text-xs text-white/60">
                  {index + 1}/{queue.length} — touche pour continuer
                </span>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <button
          onClick={terminer}
          className="absolute top-5 right-5 rounded-full bg-white/8 px-3.5 py-2 text-[12px] font-semibold text-white/55"
          style={{ marginTop: "env(safe-area-inset-top)" }}
        >
          Plus tard
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
