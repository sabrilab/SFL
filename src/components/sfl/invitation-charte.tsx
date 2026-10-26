"use client";

// La charte à l'ouverture (Sabri, 26/10 : « montre-leur clairement que le
// fait qu'ils ne soient pas dans les visuels ni les vidéos, c'est parce
// qu'ils n'ont pas signé la charte […] on a beaucoup de gens qui n'ont pas
// signé, mais parce qu'ils n'ont pas vu »).
//
// Pour qui a accepté la politique sans la case « hors de l'app » : les
// visuels de la dernière journée en éventail, sa carte devant, en gris.
// « Signer la charte », c'est le même geste que l'interrupteur des Réglages
// et que la ligne sous les vidéos des Actus (changerHorsApp) : sa carte
// reprend ses couleurs et l'écran se ferme. Jamais une porte : « Plus tard »
// la fait taire une semaine sur cet appareil (invitation-carte.tsx). Elle ne
// se montre plus une fois signée, et jamais à qui a déjà signé.

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Check, Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { Card3D } from "@/components/sfl/card-3d";
import { PlayerCard } from "@/components/sfl/player-card";
import type { Player } from "@/lib/sfl/engine";
import { changerHorsApp, monAccord } from "@/lib/sfl/consentement";
import { accordValable } from "@/lib/sfl/confidentialite";
import { cn } from "@/lib/utils";

/** Les visuels publiés derrière sa carte : de vrais posts de la J3 (lib/sfl/carrousels.ts). */
const VISUELS = ["/actus/j3/01-souley.webp", "/actus/j3/06-ilyes.webp", "/actus/j3/09-gail.webp"];

/** À proposer : un accord valable, enregistré, sans sa carte hors de l'app. */
export function charteAProposer(nom: string): boolean {
  const a = monAccord(nom);
  return !!a && !a.enAttente && accordValable(a.version) && !a.horsApp;
}

export function InvitationCharte({
  player,
  nom,
  onFini,
  onPlusTard,
}: {
  player: Player;
  nom: string;
  onFini: () => void;
  onPlusTard: () => void;
}) {
  const reduit = useReducedMotion();
  const [envoi, setEnvoi] = useState(false);
  const [signe, setSigne] = useState(false);
  const entre = (delai: number) => ({
    initial: reduit ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: reduit ? 0 : delai },
  });

  async function signer() {
    if (envoi || signe) return;
    setEnvoi(true);
    navigator.vibrate?.([8, 40, 8]);
    const ok = await changerHorsApp(nom, true);
    setEnvoi(false);
    setSigne(true);
    toast.success("C'est signé. Tu peux être dans les prochaines vidéos.", {
      description: ok ? "Tu changes d'avis quand tu veux dans Réglages." : "Enregistré sur ce téléphone, envoyé dès que possible.",
    });
    setTimeout(onFini, reduit ? 300 : 1100);
  }

  return (
    <motion.div
      key="charte"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Tu n'es pas dans les visuels"
      className="dark fixed inset-0 z-[55] flex flex-col items-center justify-center gap-6 bg-black/92 px-6 text-foreground backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative grid place-items-center">
        {VISUELS.map((src, i) => {
          const cote = i - 1;
          return (
            <motion.img
              key={src}
              src={src}
              alt=""
              draggable={false}
              initial={reduit ? false : { opacity: 0, x: 0, rotate: 0 }}
              animate={{ opacity: cote === 0 ? 0.28 : 0.42, x: cote * 92, y: cote === 0 ? -26 : 8, rotate: cote * 9 }}
              transition={{ type: "spring", stiffness: 200, damping: 24, delay: reduit ? 0 : 0.15 }}
              className="pointer-events-none absolute w-[150px] rounded-[6px] object-cover shadow-2xl ring-1 ring-white/10"
              style={{ aspectRatio: "4 / 5" }}
            />
          );
        })}
        <motion.div
          initial={reduit ? false : { scale: 0.7, y: 50, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
          className={cn("relative transition-[filter,opacity] duration-700", !signe && "opacity-70 grayscale")}
        >
          <Card3D
            cacheKey={`charte-${nom}`}
            mode="simple"
            size={0.74}
            interactive={false}
            render={(s) => <PlayerCard player={player} size={s} />}
          />
        </motion.div>
        <span
          className={cn(
            "mono-label absolute -bottom-3 flex items-center whitespace-nowrap gap-1.5 rounded-full px-3 py-1 text-[10px] ring-1 transition-colors duration-500",
            signe ? "bg-white text-black ring-white" : "bg-black text-white/75 ring-white/20"
          )}
        >
          {signe ? <Check className="size-3" strokeWidth={3} /> : <Clapperboard className="size-3" strokeWidth={2} />}
          {signe ? "Dans les prochains visuels" : "Absent des visuels"}
        </span>
      </div>

      <motion.div {...entre(0.3)} className="flex flex-col items-center gap-1.5 text-center">
        <h2 className="text-[24px] leading-tight font-extrabold tracking-tight text-white">
          {signe ? "C'est signé" : "Tu n'es pas dans les vidéos"}
        </h2>
        <p className="max-w-[300px] text-[14px] leading-snug text-white/60">
          Ni dans les visuels de la ligue : tu n&apos;as pas signé la charte. Sans ta signature, Bola ne montre pas ta
          carte hors de l&apos;app.
        </p>
      </motion.div>

      <motion.div {...entre(0.45)} className="flex w-full max-w-[340px] flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => void signer()}
          disabled={envoi || signe}
          className="bouton-principal bouton--vert flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold disabled:opacity-60"
        >
          {signe ? <Check className="size-4" strokeWidth={3} /> : null}
          {signe ? "Signé" : "Signer la charte"}
        </button>
        <div className="flex items-center">
          <Link href="/confidentialite" onClick={onFini} className="bouton-discret px-4 py-3 text-[14px] font-semibold">
            Lire la charte
          </Link>
          <span aria-hidden className="text-white/25">
            ·
          </span>
          <button type="button" onClick={onPlusTard} disabled={signe} className="bouton-discret px-4 py-3 text-[14px] font-semibold">
            Plus tard
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
