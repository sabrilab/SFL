"use client";

// L'annonce des divisions à l'ouverture de l'app (Sabri, 23/10 : « Il
// faudrait faire l'annonce des divisions qui vont arriver. Il y aura trois
// divisions, et du coup, il faut que les joueurs donnent le mieux qu'ils
// peuvent pour intégrer les divisions les plus hautes »).
//
// La première des invitations de l'ouverture (invitation-carte.tsx), une fois
// dans la semaine et une fois le dimanche de la J3, sur chaque appareil
// (lib/sfl/divisions-annonce.ts). Ta carte, et à côté d'elle les trois
// divisions, la tienne allumée : celle où tu tomberais si on coupait ce soir
// (lib/sfl/divisions.ts). « Voir les divisions » ouvre l'annonce dans les
// Actus (actus/divisions.tsx).

import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { decouper, DIVISIONS, enteteAnnonce, J_DECOUPAGE, nomDivision, phraseAnnonce, type EditionAnnonce } from "@/lib/sfl/divisions";
import type { Player } from "@/lib/sfl/engine";
import { isHidden } from "@/lib/sfl/hidden";
import { cn } from "@/lib/utils";

const ANTON = "var(--font-anton), Anton, sans-serif";

export function AnnonceDivisions({ player, edition, onFermer }: { player: Player; edition: EditionAnnonce; onFermer: () => void }) {
  const { saison } = useSeason();
  const router = useRouter();
  const reduit = useReducedMotion();
  const titre = useId();
  const d = useMemo(() => decouper(saison), [saison]);
  const mienne = isHidden(player.name) ? undefined : d.parNom.get(player.name)?.division;
  const phrase = phraseAnnonce(saison, d, player.name, edition);
  const j3 = saison.journees.find((m) => m.j === J_DECOUPAGE);
  const entre = (delai: number) => ({
    initial: reduit ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: reduit ? 0 : delai },
  });

  return (
    <motion.div
      key="annonce-divisions"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titre}
      className="fixed inset-0 z-[55] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-black/92 px-6 backdrop-blur-sm"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center gap-5">
        <motion.div
          initial={reduit ? false : { scale: 0.7, y: 40, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
        >
          <PlayerCard player={player} size={0.62} />
        </motion.div>
        {/* Les trois divisions, la D1 en haut ; la tienne s'allume. */}
        <div className="flex flex-col gap-2">
          {DIVISIONS.map((x, i) => (
            <motion.span
              key={x}
              initial={reduit ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduit ? 0 : 0.25 + i * 0.08 }}
              className={cn(
                "grid h-[52px] w-[72px] place-items-center rounded-2xl text-titre-l leading-none",
                x === mienne ? "bg-white text-black shadow-[0_0_32px_rgba(255,255,255,0.35)]" : "bg-white/[0.07] text-white/35",
              )}
              style={{ fontFamily: ANTON }}
            >
              {nomDivision(x)}
            </motion.span>
          ))}
        </div>
      </div>

      <motion.div {...entre(0.45)} className="flex flex-col items-center gap-2 text-center">
        <span className="mono-label text-etiquette text-white/50">
          J{J_DECOUPAGE} · {edition === "jour" ? "aujourd'hui" : `dimanche ${j3?.date ?? ""}`.trim()}
        </span>
        <h2 id={titre} className="titre-lettrage max-w-[320px] text-titre-g leading-[0.95] text-white">
          Dernier dimanche sans divisions
        </h2>
        <p className="max-w-[300px] pt-1 text-ligne leading-snug text-white/60">
          {enteteAnnonce(edition)}.{phrase ? ` ${phrase}.` : ""}
        </p>
      </motion.div>

      <motion.div {...entre(0.6)} className="flex w-full max-w-[340px] flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => {
            onFermer();
            router.push("/ligue#divisions");
          }}
          className="bouton-principal flex w-full items-center justify-center py-[15px] text-lecture font-bold"
        >
          Voir les divisions
        </button>
        <button type="button" onClick={onFermer} className="bouton-discret px-6 py-3 text-ligne font-semibold">
          Fermer
        </button>
      </motion.div>
    </motion.div>
  );
}
