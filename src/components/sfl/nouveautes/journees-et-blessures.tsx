"use client";

// Nouveauté du 27/10 : les journées jouées dans les classements et « Je suis
// blessé » (SFL#206 ; Sabri, 26/10 : « on affiche vos journées et on affiche
// si vous êtes blessé, et tu expliques la mécanique, pourquoi on fait ça »).
//
// Trois diapos, chacune sur du vrai : le haut du Pépite d'Or avec sa colonne J
// (et le joueur lui-même s'il n'y est pas), sa carte qui reçoit le sigle
// « Blessé », puis la frise d'une saison où deux journées manquées restent
// marquées. Encre et papier seulement : ni or, ni bleu, ni rouge (cartes MVP,
// Défensive, Impact).

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Bandage, Check } from "lucide-react";
import { SigleBlesse } from "@/components/sfl/blessure";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { useJourneesDuClassement } from "@/hooks/use-blessures";
import { rankPlayers, type Player } from "@/lib/sfl/engine";
import { isHidden } from "@/lib/sfl/hidden";
import { cn } from "@/lib/utils";
import { useCourt, type Diapo } from "./diaporama";

export function diaposJourneesEtBlessures(player: Player): Diapo[] {
  return [
    {
      visuel: <TableauJournees moi={player.name} />,
      titre: "Tes journées, à côté de tes points.",
      ligne:
        "Comme la colonne J en Ligue 1 : chaque classement dit combien de journées chacun a jouées. Les mêmes points en 3 journées ou en 5, ça ne se lit plus pareil.",
    },
    {
      visuel: <CarteBlessee player={player} />,
      titre: "Blessé ? Dis-le.",
      ligne:
        "Dans Ma carte, « Je suis blessé ». Le sigle se pose sur ta carte partout où elle apparaît, et « Blessé » s'affiche sous ton nom dans les classements.",
    },
    {
      visuel: <FrisePause />,
      titre: "Tes stats en pause, pas en chute.",
      ligne:
        "Tes journées manquées restent marquées sur ton profil : tout le monde voit pourquoi tes stats se sont arrêtées. Tes points ne bougent pas. De retour ? « Je suis remis ».",
    },
  ];
}

const ressort = { type: "spring", stiffness: 260, damping: 24 } as const;

/** Le haut du Pépite d'Or, en tableau : la colonne J arrive, soulignée, à côté des points. */
function TableauJournees({ moi }: { moi: string }) {
  const reduit = useReducedMotion();
  const { players } = useSeason();
  const { journees } = useJourneesDuClassement();
  const lignes = useMemo(() => {
    const classes = rankPlayers(players.filter((p) => p.matchs > 0 && !isHidden(p.name)));
    const haut = classes.slice(0, 3);
    const lui = classes.find((p) => p.name === moi);
    return lui && !haut.includes(lui) ? [...haut, lui] : classes.slice(0, 4);
  }, [players, moi]);

  return (
    <div className="flex w-full flex-col gap-1.5">
      {lignes.map((p, k) => (
        <motion.div
          key={p.name}
          initial={reduit ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...ressort, delay: reduit ? 0 : 0.05 * k }}
          className={cn(
            "glass-soft flex items-center gap-3 rounded-[18px] px-3.5 py-2",
            p.name === moi && "ring-1 ring-white/35",
            // Écran bas : le podium à deux, puis lui.
            k === 2 && lignes.length === 4 && "[@media(max-height:739px)]:hidden"
          )}
        >
          <span className="w-6 text-lecture font-bold text-encre-3 tabular-nums">{p.rank}</span>
          <CarteDe name={p.name} size={FORMAT_CARTE.petite} inerte />
          <span className="min-w-0 flex-1 truncate text-lecture font-semibold">
            <Nom n={p.name} />
          </span>
          <span className="flex shrink-0 items-stretch">
            {/* La colonne nouvelle : elle arrive après les lignes, sur un fond à peine plus clair. */}
            <motion.span
              initial={reduit ? false : { opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...ressort, delay: reduit ? 0 : 0.55 + 0.07 * k }}
              className="flex w-12 flex-col items-center gap-1 rounded-[10px] bg-white/[0.09] py-1"
            >
              <span className="mono-label text-etiquette text-white/55 uppercase">J</span>
              <span className="text-titre leading-none font-bold tracking-tight text-white tabular-nums">{journees.get(p.name) ?? 0}</span>
            </motion.span>
            <span className="flex w-12 flex-col items-center gap-1 py-1">
              <span className="mono-label text-etiquette text-encre-3 uppercase">pts</span>
              <span className="text-titre-fort leading-none font-bold tracking-tight tabular-nums">{p.pp}</span>
            </span>
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/** Sa carte : « Je suis blessé » se touche, et le sigle se pose dans le coin. */
function CarteBlessee({ player }: { player: Player }) {
  const reduit = useReducedMotion();
  const taille = useCourt() ? 0.44 : 0.56;
  return (
    <div className="flex flex-col items-center gap-[21px]">
      <div className="relative">
        <PlayerCard player={player} size={taille} />
        <motion.span
          className="absolute inset-0"
          initial={reduit ? false : { opacity: 0, scale: 1.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 18, delay: reduit ? 0 : 0.95 }}
          style={{ transformOrigin: "0 0" }}
        >
          <SigleBlesse cote={254 * taille} />
        </motion.span>
      </div>
      {/* Le bouton de Ma carte, tel quel, qui s'enfonce une fois : une image, pas un geste. */}
      <motion.span
        aria-hidden
        initial={reduit ? false : { scale: 1 }}
        animate={reduit ? undefined : { scale: [1, 0.95, 1] }}
        transition={{ duration: 0.32, delay: 0.6, times: [0, 0.4, 1] }}
        className="bouton-secondaire pointer-events-none flex w-[240px] items-center justify-center gap-2 py-3 text-ligne font-semibold"
      >
        <Bandage className="size-4" />
        Je suis blessé
      </motion.span>
    </div>
  );
}

/** Une saison : trois journées jouées, deux manquées sur blessure, marquées comme telles. */
function FrisePause() {
  const reduit = useReducedMotion();
  const frise = [
    { j: 1, joue: true },
    { j: 2, joue: true },
    { j: 3, joue: true },
    { j: 4, joue: false },
    { j: 5, joue: false },
  ];
  return (
    <div className="flex w-full flex-col items-center gap-[21px]">
      <ol className="flex items-end gap-2">
        {frise.map(({ j, joue }, k) => (
          <motion.li
            key={j}
            initial={reduit ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ressort, delay: reduit ? 0 : (joue ? 0.08 : 0.5) + 0.08 * k }}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "grid size-[52px] place-items-center rounded-[14px]",
                joue ? "bg-white text-black" : "border-[1.5px] border-dashed border-white/45 text-white"
              )}
            >
              {joue ? <Check className="size-5" strokeWidth={3} /> : <Bandage className="size-5" strokeWidth={2.2} />}
            </span>
            <span className={cn("mono-label text-legende", joue ? "text-white/70" : "text-white")}>J{j}</span>
          </motion.li>
        ))}
      </ol>
      {/* La ligne du profil (blessure.tsx, LigneBlessure), recopiée. */}
      <motion.div
        initial={reduit ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...ressort, delay: reduit ? 0 : 1.05 }}
        className="glass-soft flex w-full max-w-[340px] items-center gap-3 rounded-[18px] px-4 py-3"
      >
        <Bandage className="size-4 shrink-0 text-encre-2" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-ligne font-semibold">Blessé depuis la J4</span>
          <span className="font-mono text-legende text-encre-3">3 sur 5 journées jouées · J4 et J5 manquées sur blessure</span>
        </span>
      </motion.div>
    </div>
  );
}
