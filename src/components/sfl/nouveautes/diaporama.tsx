"use client";

// Le diaporama d'une nouveauté, à l'ouverture de l'app (lib/sfl/nouveautes.ts,
// Sabri, 26/10 : « une espèce de slideshow en intro assez élégante qui montre
// la fonctionnalité, comme on vient de le faire pour ceux qui n'ont pas signé
// la charte »).
//
// La même scène que l'accueil et la charte : le noir, les segments en haut
// comme les stories, « Passer » à droite. Chaque diapo montre la chose
// elle-même (la vraie carte du joueur, les vrais classements), un titre et
// une ligne qui disent pourquoi. On glisse du doigt ou au bouton ; la
// dernière ferme, ou mène où la nouveauté se trouve. Fermer d'une façon ou
// d'une autre, c'est l'avoir vue : elle ne revient pas.

import { useEffect, useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { useRouter } from "next/navigation";
import { BoutonDiscret, BoutonPrincipal, Entete, Ligne, Titre } from "@/components/sfl/accueil/cadre";

/** Un écran bas (iPhone SE, mini) : les diapos se resserrent pour tout tenir sans défiler. */
export const COURT = "(max-height: 739px)";

export function useCourt(): boolean {
  const [court, setCourt] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(COURT);
    const voir = () => setCourt(m.matches);
    voir();
    m.addEventListener("change", voir);
    return () => m.removeEventListener("change", voir);
  }, []);
  return court;
}

export interface Diapo {
  visuel: ReactNode;
  titre: string;
  ligne: string;
}

export function Diaporama({
  diapos,
  aller,
  onFini,
}: {
  diapos: Diapo[];
  /** Le second geste de la dernière diapo : là où la nouveauté se trouve. */
  aller?: { label: string; href: string };
  onFini: () => void;
}) {
  const reduit = useReducedMotion();
  const router = useRouter();
  const titre = useId();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const derniere = i === diapos.length - 1;

  function vers(n: number) {
    if (n < 0 || n >= diapos.length) return;
    navigator.vibrate?.(6);
    setDir(n > i ? 1 : -1);
    setI(n);
  }

  function glisse(_: unknown, info: PanInfo) {
    if (info.offset.x < -50 || info.velocity.x < -400) vers(i + 1);
    else if (info.offset.x > 50 || info.velocity.x > 400) vers(i - 1);
  }

  const decale = reduit ? 0 : 70;

  return (
    <motion.div
      key="nouveaute"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titre}
      className="dark fixed inset-0 z-[55] flex flex-col overflow-hidden bg-background text-foreground"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Entete
        onRetour={i > 0 ? () => vers(i - 1) : undefined}
        segments={{ i, n: diapos.length }}
        droite={
          !derniere && (
            <button type="button" onClick={onFini} className="bouton-discret px-[13px] py-[8px] text-[14px] font-semibold">
              Passer
            </button>
          )
        }
      />
      <motion.div
        className="relative min-h-0 flex-1 touch-pan-y"
        drag={reduit ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        onDragEnd={glisse}
      >
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={i}
            custom={dir}
            initial={{ x: dir * decale, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -dir * decale, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="absolute inset-0 overflow-y-auto overscroll-contain"
          >
            <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col items-center justify-center px-[21px] py-[13px]">
              <div className="grid min-h-[300px] w-full place-items-center [@media(max-height:739px)]:min-h-0">{diapos[i].visuel}</div>
              <div className="mt-[21px] flex flex-col items-center [@media(max-height:739px)]:mt-[13px]">
                <span className="mono-label mb-[8px] text-[10px] tracking-[0.18em] text-white/45 uppercase">Nouveau</span>
                <Titre id={titre}>{diapos[i].titre}</Titre>
                <Ligne>{diapos[i].ligne}</Ligne>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div
        className="mx-auto flex w-full max-w-[420px] shrink-0 flex-col items-center gap-[5px] px-[21px] pt-[8px]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 21px)" }}
      >
        <BoutonPrincipal onClick={derniere ? onFini : () => vers(i + 1)}>{derniere ? "C'est compris" : "Suivant"}</BoutonPrincipal>
        {/* La même hauteur à chaque diapo : le bouton ne saute pas. */}
        <div className={derniere && aller ? undefined : "invisible"} aria-hidden={!(derniere && aller)}>
          <BoutonDiscret
            onClick={() => {
              onFini();
              if (aller) router.push(aller.href);
            }}
          >
            {aller?.label ?? " "}
          </BoutonDiscret>
        </div>
      </div>
    </motion.div>
  );
}
