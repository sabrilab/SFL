"use client";

// Nouveauté du 12/11 : le parrainage, annoncé pour de bon (Sabri, 12/11 :
// « la fonction est déjà en ligne mais n'a jamais vraiment été annoncée »).
// Il est en ligne depuis le 24/10 (lib/sfl/parrainage.ts, la page Inviter) et
// ses paliers depuis le 27/10 (skins-recrues.ts) ; l'ancienne diapo « Invite.
// Monte. » de nouveautes-27-10.tsx lui a laissé la place. Trois diapos, et
// sur la dernière le bouton « Inviter » qui mène à la page (annonce-nouveaute.tsx).
//
//   1. « Ramène tes potes. » : ce que voit celui qui ouvre mon lien (la page
//      /p/<code>, lien.tsx) : ma vraie carte, « {moi} t'invite. », et pour un
//      joueur de la SFL « Bola Team offert un mois ».
//   2. « Une recrue, +100 XP. » : le grand chiffre d'Inviter (mes recrues
//      actives) monte de 0 à 3, et les lignes du journal d'XP s'empilent :
//      « Recrue · 1er match », +100 (lib/sfl/recrues.ts).
//   3. « À 10, la carte Fondateur. » : ma carte dans les trois skins des
//      recrues (PALIERS_RECRUES), petite, moyenne, grande au nombre d'or :
//      Recruteur à 3, Filigrane à 5, Fondateur à 10 ; sous chacune son
//      chiffre et son nom, et sous « Fondateur » son numéro, « N° 001 / 500 ».
//      Le numéro : le mien si j'en ai un, sinon le prochain à poser (le plus
//      haut numéro posé, plus un), et celui de l'exemple (097) tant que la
//      base n'a pas répondu.
//
// Les titres, les lignes, ce que dit la carte de la diapo 1 et le numéro de
// la diapo 3 sont composés dans lib/sfl/annonce-parrainage.ts, depuis la
// table des paliers : rien n'est écrit en dur ici, et le banc le vérifie.
//
// Aucune écriture : ni code de parrainage créé, ni partage noté (c'est la
// page Inviter qui le fait). Une seule lecture : la diapo 3 relit les recrues
// de la ligue (use-recrues.ts, comme Ma carte et Inviter) pour le numéro.
// Boucle douce ; « Réduire les animations » : chaque visuel montre son état
// final, immobile. La scène du diaporama est noire en clair comme en sombre
// (diaporama.tsx) : encre et papier seulement, l'or, le bleu et le rouge
// restent aux cartes MVP, Défensive et Impact.

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Mini } from "@/components/sfl/passe-bola";
import { PlayerCard } from "@/components/sfl/player-card";
import { useJoueurBola } from "@/components/sfl/player-provider";
import { XP_RECRUE, type FinitionRecrue } from "@/components/sfl/skins-recrues";
import { useHabillage } from "@/hooks/use-habillage";
import { useIdentites } from "@/hooks/use-identites";
import { useRecrues } from "@/hooks/use-recrues";
import { lignesInvitation, numeroAnnonce, numeroSeul, paliersSkins, textesParrainage } from "@/lib/sfl/annonce-parrainage";
import type { Player } from "@/lib/sfl/engine";
import { useCourt, type Diapo } from "./diaporama";

export function diaposParrainage(player: Player): Diapo[] {
  const [lien, recrue, cartes] = textesParrainage();
  return [
    { visuel: <TonLienOuvreTaCarte player={player} />, ...lien },
    { visuel: <RecruesQuiComptent />, ...recrue },
    { visuel: <TroisCartes player={player} />, ...cartes },
  ];
}

const ressort = { type: "spring", stiffness: 260, damping: 24 } as const;

/* --------------------------- 1. Ton lien ouvre ta carte --------------------------- */

/** La page de mon lien, telle que la voit celui qui l'ouvre : ma carte, et qui l'invite. */
function TonLienOuvreTaCarte({ player }: { player: Player }) {
  const reduit = useReducedMotion();
  const court = useCourt();
  const bola = useJoueurBola();
  const { invite, offert } = lignesInvitation(useIdentites().nom(player.name), bola);
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <motion.div
        initial={reduit ? false : { opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={ressort}
        // L'ombre portée de la page du lien (lien.tsx).
        style={{ filter: "drop-shadow(0 21px 34px rgba(0,0,0,.45))" }}
      >
        {/* Écran bas : 0,68 et pas moins, sous 170 px de large la carte devient la carte photo (bola-card.tsx, palierCarte). */}
        <PlayerCard player={player} size={court ? 0.68 : 0.74} />
      </motion.div>
      <motion.div
        initial={reduit ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...ressort, delay: reduit ? 0 : 0.35 }}
        className="mt-[21px] flex flex-col items-center gap-[8px] [@media(max-height:739px)]:mt-[13px] [@media(max-height:739px)]:gap-[5px]"
      >
        <span className="text-lecture font-semibold text-white/85">{invite}</span>
        {offert && <span className="mono-label text-etiquette text-white/50">{offert}</span>}
      </motion.div>
    </div>
  );
}

/* --------------------------- 2. Une recrue, +100 XP --------------------------- */

/** Les recrues de l'exemple : le chiffre monte jusque-là, une ligne du journal par recrue. */
const RECRUES_EXEMPLE = 3;

/** Le grand chiffre d'Inviter qui monte, et le journal d'XP qui s'empile dessous. */
function RecruesQuiComptent() {
  const reduit = useReducedMotion();
  const court = useCourt();
  const [boucle, setN] = useState(0);
  // Mouvement réduit : les trois recrues sont là, rien ne tourne.
  const n = reduit ? RECRUES_EXEMPLE : boucle;

  useEffect(() => {
    if (reduit) return;
    const m = setTimeout(() => setN((x) => (x + 1) % (RECRUES_EXEMPLE + 1)), n === RECRUES_EXEMPLE ? 2600 : n === 0 ? 700 : 900);
    return () => clearTimeout(m);
  }, [n, reduit]);

  return (
    <div className="flex w-full max-w-[300px] flex-col gap-[21px] [@media(max-height:739px)]:gap-[13px]" aria-hidden>
      {/* Le chiffre et son étiquette, comme en haut de la page Inviter. */}
      <div className="flex items-end gap-[13px] px-1">
        <span className="leading-[0.8] text-white tabular-nums" style={{ fontFamily: ANTON, fontSize: court ? 68 : 89 }}>
          {n}
        </span>
        <span className="mono-label pb-1 text-white/50">{n > 1 ? "recrues actives" : "recrue active"}</span>
      </div>
      {/* Le journal d'XP (mode-passe-missions.tsx) : la place des trois lignes est gardée, rien ne saute. */}
      <div className="flex flex-col">
        {Array.from({ length: RECRUES_EXEMPLE }, (_, k) => (
          <motion.div
            key={k}
            initial={false}
            animate={{ opacity: k < n ? 1 : 0, y: k < n ? 0 : 8 }}
            transition={reduit ? { duration: 0 } : k < n ? ressort : { duration: 0.2 }}
            className="flex items-center gap-3 border-t border-white/8 px-1 py-3 [@media(max-height:739px)]:py-[9px]"
          >
            <span className="min-w-0 flex-1 truncate text-lecture font-semibold text-white">Recrue · 1er match</span>
            <span className="font-mono text-corps font-bold text-white tabular-nums">+{XP_RECRUE}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- 3. Les trois cartes --------------------------- */

/** Les largeurs des trois cartes, petite, moyenne, grande : la suite du nombre d'or. */
const LARGEURS: Record<FinitionRecrue, { ample: number; court: number }> = {
  recruteur: { ample: 55, court: 42 },
  filigrane: { ample: 89, court: 68 },
  fondateur: { ample: 144, court: 110 },
};

/** Ma carte en Recruteur, en Filigrane et en Fondateur, côte à côte, de la petite à la grande. */
function TroisCartes({ player }: { player: Player }) {
  const reduit = useReducedMotion();
  const court = useCourt();
  const porte = useHabillage(player.name);
  const recrues = useRecrues();
  const base = { cran: porte.cran, rang: porte.rang };
  // Mon numéro si j'en ai un ; sinon le prochain à poser, quand la base a répondu.
  const mien = recrues.ligue.find((r) => r.nom === player.name)?.fondateur ?? null;
  const numero = numeroAnnonce(mien, recrues.charge, recrues.plusHaut);
  return (
    // La place du numéro, posé sous « Fondateur » : les trois cartes restent alignées par le bas.
    <ol className="flex items-end gap-[13px] pb-[21px] [@media(max-height:739px)]:gap-[8px]" aria-hidden>
      {paliersSkins().map((p, k) => {
        const l = court ? LARGEURS[p.finition].court : LARGEURS[p.finition].ample;
        const h = Math.round((l * 1656) / 1024);
        return (
          <motion.li
            key={p.n}
            initial={reduit ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ressort, delay: reduit ? 0 : 0.1 + 0.22 * k }}
            className="relative flex flex-col items-center gap-[8px]"
          >
            {/* Le rayon de la carte (92 sur 1024), à sa taille. */}
            <span className="relative block overflow-hidden" style={{ width: l, height: h, borderRadius: Math.round((l * 92) / 1024) }}>
              <Mini
                player={player}
                habillage={{ ...base, finition: p.finition, fondateur: p.finition === "fondateur" ? numero : undefined }}
                l={l}
                h={h}
              />
            </span>
            <span className="flex flex-col items-center gap-[5px]">
              <span className="text-titre-m leading-none text-white tabular-nums [@media(max-height:739px)]:text-titre-fort" style={{ fontFamily: ANTON }}>
                {p.n}
              </span>
              <span className="mono-label text-etiquette text-white/50">{p.titre}</span>
            </span>
            {/* Son numéro, seul, centré sous « Fondateur ». */}
            {p.finition === "fondateur" && (
              <span className="mono-label absolute top-full left-1/2 mt-[5px] -translate-x-1/2 text-etiquette whitespace-nowrap text-white/70">
                {numeroSeul(numero)}
              </span>
            )}
          </motion.li>
        );
      })}
    </ol>
  );
}
