"use client";

// La visite de l'app, à la fin de l'accueil (accueil.tsx) : la partie qu'on
// peut passer (Sabri, 24/10 : « une explication de l'app dedans, qui peut
// être skip »). Quatre écrans, un par endroit de la barre d'onglets : la
// Map, Ma carte, les Actus, le Vestiaire (pas pour un joueur Bola, venu par
// un parrain : sa barre n'a pas la bulle). Chacun montre ce qu'on y trouve
// (sa carte à lui, le vrai podium du Pépite d'Or) et, en bas, à la place même
// de la vraie barre, une copie de la barre d'onglets où la lentille glisse
// d'un onglet à l'autre : quand l'accueil s'efface, la vraie est déjà là.
//
// On glisse d'un écran à l'autre du doigt, ou au bouton ; « Passer » finit
// tout de suite. Une seule fois par joueur (lib/sfl/accueil, accueil_le).

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { Sparkles } from "lucide-react";
import { ActusIcon, CarteIcon, MapIcon, VestiaireIcon } from "@/components/layout/nav-icons";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { useJoueurBola } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { rankPlayers, type Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { BoutonPrincipal, Entete, Ligne, Titre } from "./cadre";

const DIAPOS = [
  {
    titre: "La Map.",
    ligne: "Les matchs de la semaine, les terrains et les joueurs de ta ville. Touche un match pour le rejoindre, ou ouvre le tien.",
  },
  { titre: "Ma carte.", ligne: "Ta carte en grand, ta saison, ton évolution et tes badges." },
  { titre: "Les Actus.", ligne: "La course au Pépite d'Or, les récaps des dimanches et les classements." },
  { titre: "Le Vestiaire.", ligne: "La discussion de toute la ligue. Bola Agent, ton coach, est juste à côté." },
] as const;

const ONGLETS = [
  { Icon: MapIcon, label: "Map" },
  { Icon: CarteIcon, label: "Ma carte" },
  { Icon: ActusIcon, label: "Actus" },
] as const;

export function Visite({ player, onFini }: { player: Player; onFini: () => void }) {
  const reduit = useReducedMotion();
  const bola = useJoueurBola();
  const diapos = bola ? DIAPOS.slice(0, 3) : DIAPOS;
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const derniere = i === diapos.length - 1;

  function aller(n: number) {
    if (n < 0 || n >= diapos.length) return;
    navigator.vibrate?.(6);
    setDir(n > i ? 1 : -1);
    setI(n);
  }

  function glisse(_: unknown, info: PanInfo) {
    if (info.offset.x < -50 || info.velocity.x < -400) aller(i + 1);
    else if (info.offset.x > 50 || info.velocity.x > 400) aller(i - 1);
  }

  const decale = reduit ? 0 : 70;

  return (
    <div className="absolute inset-0 flex flex-col">
      <Entete
        onRetour={i > 0 ? () => aller(i - 1) : undefined}
        droite={
          <button type="button" onClick={onFini} className="bouton-discret px-[13px] py-[8px] text-[14px] font-semibold">
            Passer
          </button>
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
              <div className="grid h-[300px] w-full place-items-center">
                {i === 0 && <PlanMap />}
                {i === 1 && <PlayerCard player={player} size={0.7} />}
                {i === 2 && <Podium />}
                {i === 3 && <Bulles />}
              </div>
              <div className="mt-[21px] flex flex-col items-center">
                <Titre>{diapos[i].titre}</Titre>
                <Ligne>{diapos[i].ligne}</Ligne>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <div className="mx-auto w-full max-w-[420px] shrink-0 px-[21px] pt-[8px] pb-[13px]">
        <BoutonPrincipal onClick={derniere ? onFini : () => aller(i + 1)}>{derniere ? "C'est parti" : "Suivant"}</BoutonPrincipal>
      </div>
      <BarreOnglets onglet={i} onToucher={aller} bulle={!bola} />
    </div>
  );
}

/**
 * La barre d'onglets, recopiée (layout/bottom-nav.tsx, mêmes classes) et
 * posée à la même place : l'onglet de l'écran en cours a la lentille, le
 * Vestiaire la sienne, s'il a la bulle. Toucher un onglet y mène.
 */
function BarreOnglets({ onglet, onToucher, bulle }: { onglet: number; onToucher: (n: number) => void; bulle: boolean }) {
  return (
    <div
      className="mx-auto flex shrink-0 items-center gap-2"
      style={{
        marginBottom: "max(calc(env(safe-area-inset-bottom) - 4px), 14px)",
        width: "min(calc(100% - 32px), 430px)",
      }}
    >
      <div className="liquid-tabbar relative flex min-w-0 flex-1" style={{ ["--onglet" as string]: Math.min(onglet, 2) }}>
        <span aria-hidden className={cn("liquid-tabbar__lentille transition-opacity", onglet > 2 && "opacity-0")} />
        {ONGLETS.map(({ Icon, label }, n) => (
          <button
            key={label}
            type="button"
            onClick={() => onToucher(n)}
            aria-label={label}
            aria-current={n === onglet ? "step" : undefined}
            className="liquid-tabbar__onglet text-white"
          >
            <span className="relative flex">
              <Icon plein={n === onglet} />
            </span>
            <span className="liquid-tabbar__libelle" style={{ fontWeight: n === onglet ? 600 : 500 }}>
              {label}
            </span>
          </button>
        ))}
      </div>
      {bulle && (
        <button
          type="button"
          onClick={() => onToucher(3)}
          aria-label="Vestiaire"
          aria-current={onglet === 3 ? "step" : undefined}
          className="liquid-tabbar liquid-tabbar--rond text-white"
          data-choisi={onglet === 3 ? "" : undefined}
        >
          <VestiaireIcon plein={onglet === 3} />
        </button>
      )}
    </div>
  );
}

/** La Map en petit : un plan clair, trois matchs qui tombent, et toi au milieu. */
function PlanMap() {
  const reduit = useReducedMotion();
  const epingles: [number, number][] = [
    [72, 62],
    [176, 50],
    [146, 132],
  ];
  return (
    <svg viewBox="0 0 250 190" width={280} height={213} aria-hidden className="overflow-visible drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
      <defs>
        <clipPath id="accueil-plan">
          <rect width="250" height="190" rx="28" />
        </clipPath>
      </defs>
      <g clipPath="url(#accueil-plan)">
        <rect width="250" height="190" fill="#e9ebe6" />
        <path d="M168 120c18-8 44-4 58 10s10 40-8 52-52 10-64-6-4-48 14-56z" fill="#d9e3cf" />
        <path d="M-10 96C40 88 70 110 120 104s90-40 150-30" stroke="#fff" strokeWidth="11" fill="none" />
        <path d="M96 -10c-6 50 10 90 4 130s-16 60-12 80" stroke="#fff" strokeWidth="8" fill="none" />
        <path d="M150 -10c4 40-10 70 6 100s34 50 30 110" stroke="#fff" strokeWidth="6" fill="none" />
        <path d="M-10 160c50-10 90 0 140-14" stroke="#fff" strokeWidth="5" fill="none" />
      </g>
      {/* Toi, au milieu de ta ville. */}
      <circle cx="112" cy="100" r="7" fill="#0a0b0d" />
      <circle cx="112" cy="100" r="4" fill="#fff" />
      {!reduit && (
        <motion.circle
          cx="112"
          cy="100"
          r="7"
          fill="none"
          stroke="#0a0b0d"
          strokeWidth="1.5"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 2.6, opacity: 0 }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeOut" }}
          style={{ transformOrigin: "112px 100px" }}
        />
      )}
      {epingles.map(([x, y], k) => (
        <motion.g
          key={k}
          initial={reduit ? false : { y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 15, delay: 0.25 + k * 0.18 }}
        >
          <g transform={`translate(${x - 12} ${y - 30})`}>
            <path d="M12 30s-11-9.6-11-17.6a11 11 0 0 1 22 0C23 20.4 12 30 12 30z" fill="#0a0b0d" />
            <circle cx="12" cy="12.4" r="4" fill="#fff" />
          </g>
        </motion.g>
      ))}
    </svg>
  );
}

/** Le vrai podium du Pépite d'Or : le premier en grande carte, les deux suivants en moyennes. */
function Podium() {
  const reduit = useReducedMotion();
  const { players } = useSeason();
  const id = useIdentites();
  const trois = useMemo(() => rankPlayers(players.filter((p) => p.matchs > 0)).slice(0, 3), [players]);
  if (trois.length < 3) return <GrandeIcone><ActusIcon plein /></GrandeIcone>;
  // Le deuxième à gauche, le premier au centre, le troisième à droite.
  const places = [trois[1], trois[0], trois[2]];
  return (
    <div className="flex items-end justify-center gap-[13px]">
      {places.map((p, k) => {
        const premier = k === 1;
        return (
          <motion.div
            key={p.name}
            initial={reduit ? false : { y: 40, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: premier ? 0.35 : 0.15 + k * 0.05 }}
            className="flex flex-col items-center gap-[6px]"
          >
            <CarteDe name={p.name} size={premier ? FORMAT_CARTE.grande : FORMAT_CARTE.moyenne} inerte />
            <span className="font-display text-[21px] leading-none text-white">{p.rank}</span>
            <span className="max-w-[90px] truncate text-[12px] font-semibold text-white/70">{id.nom(p.name).split(" ")[0]}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Le Vestiaire et, à côté, Bola Agent. */
function Bulles() {
  const reduit = useReducedMotion();
  return (
    <div className="relative">
      <GrandeIcone>
        <VestiaireIcon plein />
      </GrandeIcone>
      <motion.span
        initial={reduit ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.4 }}
        className="glass-soft absolute -right-[21px] -bottom-[8px] grid size-[55px] place-items-center rounded-full text-white"
        aria-hidden
      >
        <Sparkles className="size-[22px]" />
      </motion.span>
    </div>
  );
}

/** Un symbole de la barre d'onglets, en grand, dans sa lentille de verre. */
function GrandeIcone({ children }: { children: React.ReactNode }) {
  const reduit = useReducedMotion();
  return (
    <motion.span
      initial={reduit ? false : { scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className="glass-soft grid size-[144px] place-items-center rounded-full text-white shadow-[0_0_60px_rgba(255,255,255,0.08)]"
      style={{ ["--tabbar-trou" as string]: "#24252a" }}
      aria-hidden
    >
      <span className="scale-[2.6]">{children}</span>
    </motion.span>
  );
}
