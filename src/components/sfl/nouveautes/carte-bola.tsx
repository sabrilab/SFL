"use client";

// Nouveauté du 28/10, pour les joueurs Bola : la carte qui bouge à chaque
// match validé, la carte MVP, les missions perso (lib/sfl/carte-bola.ts,
// lib/sfl/missions-perso.ts ; Sabri : « leur carte s'actualise à chaque
// match », « des missions personnelles marqué 3 buts »).
//
//   1. « Ta carte bouge à chaque match. » : ma carte, de 75 à 77, la jauge
//      de tir qui se remplit cran par cran ;
//   2. « MVP : ta carte en or. » : ma carte MVP, dorée ;
//   3. « Tes missions. » : les cinq fiches en rang, leurs primes.
//
// Boucle douce ; « Réduire les animations » : chaque visuel montre son état
// final, immobile. Une vibration sur la dernière diapo.

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PlayerCard } from "@/components/sfl/player-card";
import { Insigne } from "@/components/sfl/actus/missions";
import { ANTON } from "@/components/sfl/actus/ecran";
import { BASE_BOLA } from "@/lib/sfl/carte-bola";
import { type Player, type Stats } from "@/lib/sfl/engine";
import { tic } from "@/lib/sfl/haptique";
import { MISSIONS_PERSO, rangPerso } from "@/lib/sfl/missions-perso";
import { statsCarteTitre } from "@/lib/sfl/saisie/engine";
import { cn } from "@/lib/utils";
import { useCourt, type Diapo } from "./diaporama";
import "@/components/sfl/actus/missions.css";

export function diaposCarteBola(player: Player): Diapo[] {
  return [
    {
      visuel: <TaCarteBouge player={player} />,
      titre: "Ta carte bouge à chaque match.",
      ligne: "Un but, une passe, un match validé : tes stats montent.",
    },
    {
      visuel: <CarteMvp player={player} />,
      titre: "MVP : ta carte en or.",
      ligne: "Le meilleur du match reçoit sa carte MVP.",
    },
    {
      visuel: <TesMissions />,
      titre: "Tes missions.",
      ligne: "Cinq missions chaque semaine, de l'XP à la clé.",
    },
  ];
}

/** Les étapes de la carte : 75 partout, puis un but, deux buts… jusqu'à 77 de tir et 76 de passe. */
const ETAPES: { stats: Stats; crans: number }[] = [
  { stats: BASE_BOLA, crans: 0 },
  { stats: BASE_BOLA, crans: 1 },
  { stats: { ...BASE_BOLA, TIR: 76 }, crans: 0 },
  { stats: { ...BASE_BOLA, TIR: 76 }, crans: 1 },
  { stats: { ...BASE_BOLA, TIR: 77, PAS: 76, VIT: 76 }, crans: 0 },
];

function TaCarteBouge({ player }: { player: Player }) {
  const reduit = useReducedMotion();
  const court = useCourt();
  const [boucle, setI] = useState(0);
  const i = reduit ? ETAPES.length - 1 : boucle;
  useEffect(() => {
    if (reduit) return;
    const t = setTimeout(() => setI((x) => (x + 1) % ETAPES.length), i === ETAPES.length - 1 ? 2600 : 900);
    return () => clearTimeout(t);
  }, [i, reduit]);
  const e = ETAPES[i];
  const p = useMemo(() => ({ ...player, stats: e.stats }), [player, e]);
  return (
    <div className="flex flex-col items-center gap-[21px]" aria-hidden>
      <PlayerCard player={p} size={court ? 0.62 : 0.74} highlightStats={i > 0 ? ["TIR"] : undefined} />
      <div className="flex w-[220px] items-center gap-3">
        <span className="mono-label w-[30px] text-[10px] text-white/55">TIR</span>
        <span className="flex flex-1 gap-[4px]">
          {[0, 1].map((k) => (
            <motion.span
              key={k}
              className="h-[6px] flex-1 rounded-full"
              animate={{ backgroundColor: k < e.crans ? "rgb(255 255 255)" : "rgb(255 255 255 / 0.15)" }}
              transition={{ duration: reduit ? 0 : 0.25 }}
            />
          ))}
        </span>
        <span style={{ fontFamily: ANTON, fontSize: 26, lineHeight: 0.9 }} className="w-[40px] text-right tabular-nums">
          {e.stats.TIR}
        </span>
      </div>
    </div>
  );
}

function CarteMvp({ player }: { player: Player }) {
  const reduit = useReducedMotion();
  const court = useCourt();
  const stats = useMemo(() => statsCarteTitre({ ...BASE_BOLA, TIR: 77, PAS: 76, VIT: 76 }, "mvp", 2, 1), []);
  return (
    <motion.div
      aria-hidden
      initial={reduit ? false : { rotateY: 90, scale: 0.9, opacity: 0 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 20, delay: 0.15 }}
      style={{ filter: "drop-shadow(0 0 28px rgba(244,197,66,.45))" }}
    >
      <PlayerCard player={{ ...player, stats }} size={court ? 0.62 : 0.74} distinction="mvp" />
    </motion.div>
  );
}

function TesMissions() {
  const reduit = useReducedMotion();
  useEffect(() => tic(8), []);
  return (
    <div className="flex w-full max-w-[330px] flex-col gap-[8px]" aria-hidden>
      {MISSIONS_PERSO.map((m, i) => {
        const rang = rangPerso(m);
        return (
          <motion.div
            key={m.genre}
            initial={reduit ? false : { x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 28, delay: reduit ? 0 : 0.08 * i }}
            className={cn("fiche dark flex items-center gap-3 px-3 py-2.5", `fiche--${rang}`)}
          >
            <span className="origin-left scale-[0.62]">
              <Insigne rang={rang} />
            </span>
            <span className="-ml-4 flex min-w-0 flex-1 flex-col">
              <span className="titre-lettrage truncate pt-[2px] text-[18px] leading-[1.15]">{m.code}</span>
              <span className="line-clamp-2 font-mono text-[10.5px] leading-snug text-white/50">{m.phrase}</span>
            </span>
            <span className="fiche__ton shrink-0 text-[19px] leading-none" style={{ fontFamily: ANTON }}>
              +{m.xp}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
