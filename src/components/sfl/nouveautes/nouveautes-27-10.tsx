"use client";

// Nouveauté du 27/10 au soir : trois choses d'un coup (Sabri, 27/10 : « à
// chaque fois qu'on met de nouvelles fonctionnalités en place, on veut un
// petit slideshow au début pour que les gens puissent voir quelles sont les
// nouveautés »).
//
//   1. « Invite. Monte. » : les paliers des recrues (skins-recrues.ts) sur la
//      vraie carte du joueur en Fondateur, numérotée, et la rangée des
//      quatre paliers (+100 XP, Recruteur, Filigrane, Fondateur).
//   2. « Une réponse, une seule. » : « Je viens » se tient, une grille de
//      pixels le remplit, la réponse se scelle au cadenas. Recréé ici, sans
//      rien importer de la réponse scellée elle-même : la même grille de
//      Bayer, le même pas, le même vert « y aller » ; « Pas dispo » reste
//      dans le neutre (ni rouge ni bleu dans une annonce).
//   3. « Les missions sont dans Ma carte. » : les onglets du Niveau XP
//      (Passe, Missions, Les autres), recréés ; l'onglet passe des miennes à
//      celles de toute la ligue, sur les vraies cartes des joueurs.
//
// Tout tourne en boucle douce. « Réduire les animations » : chaque visuel
// montre son état final, immobile. La scène du diaporama est noire en clair
// comme en sombre (diaporama.tsx) : encre et papier seulement, l'or, le bleu
// et le rouge restent aux cartes MVP, Défensive et Impact.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Lock } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { Mini } from "@/components/sfl/passe-bola";
import { useSeason } from "@/components/sfl/season-provider";
import {
  PALIERS_RECRUES,
  numeroFondateur,
} from "@/components/sfl/skins-recrues";
import { useHabillage } from "@/hooks/use-habillage";
import { NOM_DE_CODE, PRIME, rangDe, type Genre } from "@/lib/sfl/missions";
import { rankPlayers, type Player } from "@/lib/sfl/engine";
import { isHidden } from "@/lib/sfl/hidden";
import { cn } from "@/lib/utils";
import { useCourt, type Diapo } from "./diaporama";

export function diaposNouveautes2710(player: Player): Diapo[] {
  return [
    {
      visuel: <PaliersRecrues player={player} />,
      titre: "Invite. Monte.",
      ligne:
        "+100 XP par recrue qui joue. Recruteur à 3, Filigrane à 5, et à 10 la carte Fondateur, numérotée sur 500.",
    },
    {
      visuel: <ReponseQuiSeScelle />,
      titre: "Une réponse, une seule.",
      ligne:
        "Tiens « Je viens » ou « Pas dispo » : ta réponse se scelle et ne change plus.",
    },
    {
      visuel: <OngletsNiveau moi={player.name} />,
      titre: "Les missions sont dans Ma carte.",
      ligne:
        "Niveau XP → Missions pour les tiennes, Les autres pour celles de toute la ligue.",
    },
  ];
}

const ressort = { type: "spring", stiffness: 260, damping: 24 } as const;

/** Le numéro d'exemple : celui de skins-recrues.ts (« N° 097 / 500 »). */
const NUMERO_EXEMPLE = 97;

/* ------------------------------ 1. Les paliers ------------------------------ */

/** Sa carte en Fondateur, numérotée, puis les quatre paliers qui s'allument un à un. */
function PaliersRecrues({ player }: { player: Player }) {
  const reduit = useReducedMotion();
  const court = useCourt();
  const porte = useHabillage(player.name);
  const base = { cran: porte.cran, rang: porte.rang };
  // La carte entière (Mini la dessine en grand puis la réduit) : la ligne de série se lit.
  const l = court ? 112 : 146;
  const h = Math.round((l * 1656) / 1024);
  // Les miniatures des paliers : assez grandes pour que les trois papiers se distinguent.
  const mini = court ? { l: 36, h: 58 } : { l: 44, h: 71 };
  return (
    <div className="flex w-full flex-col items-center gap-[21px] [@media(max-height:739px)]:gap-[13px]">
      <motion.div
        initial={reduit ? false : { opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...ressort, delay: reduit ? 0 : 0.85 }}
        className="flex flex-col items-center gap-2"
      >
        <span
          className="relative block overflow-hidden rounded-[10px]"
          style={{ width: l, height: h }}
        >
          <Mini
            player={player}
            habillage={{
              ...base,
              finition: "fondateur",
              fondateur: NUMERO_EXEMPLE,
            }}
            l={l}
            h={h}
          />
        </span>
        <span className="mono-label text-[10px] text-white/70">
          {numeroFondateur(NUMERO_EXEMPLE)}
        </span>
      </motion.div>
      <ol className="flex w-full max-w-[320px] items-end justify-between gap-2">
        {PALIERS_RECRUES.map((p, k) => (
          <motion.li
            key={p.n}
            initial={reduit ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...ressort, delay: reduit ? 0 : 0.08 + 0.14 * k }}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span
              className="relative block overflow-hidden rounded-[6px]"
              style={{ width: mini.l, height: mini.h }}
            >
              {p.finition ? (
                <Mini
                  player={player}
                  habillage={{
                    ...base,
                    finition: p.finition,
                    fondateur:
                      p.finition === "fondateur" ? NUMERO_EXEMPLE : undefined,
                  }}
                  l={mini.l}
                  h={mini.h}
                />
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-0.5 bg-white/[0.08] font-mono font-bold leading-none">
                  <span className="text-[11px]">+100</span>
                  <span className="text-[9px] text-white/60">XP</span>
                </span>
              )}
            </span>
            <span
              className="text-[19px] leading-none tracking-tight tabular-nums"
              style={{ fontFamily: ANTON }}
            >
              {p.n}
            </span>
            <span className="mono-label text-[9.5px] text-white/50">
              {p.finition ? p.titre : "Par recrue"}
            </span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/* --------------------------- 2. La réponse scellée --------------------------- */

// La grille de la réponse scellée : la matrice de Bayer 4×4, des pixels de 7 px.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const TENIR = 700;
const COLS = 21;
const ROWS = 7;
// Le vert « y aller » des boutons (boutons.css, bouton--vert).
const VERT = "132 214 140";
// La trame qui reste dans la pilule : deux pixels sur seize.
const TRAME =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Crect width='6' height='6'/%3E%3Crect x='14' y='14' width='6' height='6'/%3E%3C/svg%3E\")";

type Temps = "repos" | "tient" | "scelle";

/** Le doigt se pose sur « Je viens », la grille le remplit, la pilule se scelle ; puis on recommence. */
function ReponseQuiSeScelle() {
  const reduit = useReducedMotion();
  const [boucle, setT] = useState<Temps>("repos");
  // Mouvement réduit : la réponse est déjà scellée, rien ne tourne.
  const t: Temps = reduit ? "scelle" : boucle;

  useEffect(() => {
    if (reduit) return;
    const suite: Record<Temps, [Temps, number]> = {
      repos: ["tient", 900],
      tient: ["scelle", TENIR + 60],
      scelle: ["repos", 2600],
    };
    const [apres, ms] = suite[t];
    const m = setTimeout(() => setT(apres), ms);
    return () => clearTimeout(m);
  }, [t, reduit]);

  const pixels = useMemo(() => {
    const out: { cle: number; d: number }[] = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const b = BAYER[y % 4][x % 4] / 16;
        out.push({
          cle: y * COLS + x,
          d: Math.round(((x + b * 3) / (COLS + 3)) * TENIR * 0.94),
        });
      }
    return out;
  }, []);

  return (
    <div className="relative h-[50px] w-full max-w-[320px]">
      {/* Les boutons s'effacent d'abord, la pilule arrive ensuite (jamais deux « Je viens »). */}
      <AnimatePresence initial={false} mode="wait">
        {t !== "scelle" ? (
          <motion.div
            key="boutons"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="absolute inset-0 flex gap-2"
          >
            <span className="bouton-principal bouton--vert pointer-events-none relative flex h-[50px] flex-1 items-center justify-center overflow-hidden text-[15px] font-bold">
              <span
                aria-hidden
                className="absolute inset-0 grid gap-px overflow-hidden rounded-[inherit]"
                style={{
                  gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                  gridTemplateRows: `repeat(${ROWS}, 1fr)`,
                }}
              >
                {pixels.map((p) => (
                  <i
                    key={p.cle}
                    className="block"
                    style={{
                      background: `rgb(${VERT} / 0.78)`,
                      opacity: t === "tient" ? 1 : 0,
                      transition:
                        t === "tient" ? `opacity 90ms linear ${p.d}ms` : "none",
                    }}
                  />
                ))}
              </span>
              <span className="relative">Je viens</span>
              {/* Le doigt qui tient. */}
              <span
                aria-hidden
                className="absolute top-1/2 left-[38%] size-[34px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25 ring-1 ring-white/40 transition-opacity duration-150"
                style={{ opacity: t === "tient" ? 1 : 0 }}
              />
            </span>
            <span className="bouton-secondaire pointer-events-none flex h-[50px] flex-1 items-center justify-center text-[15px] font-semibold">
              Pas dispo
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="pilule"
            initial={reduit ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.9, 0.3, 1] }}
            role="img"
            aria-label="Je viens, réponse scellée"
            className="absolute inset-0 isolate flex items-center justify-center gap-2 overflow-hidden rounded-full text-[15px] font-semibold"
            style={{
              color: "#bfe2bf",
              backgroundColor: `rgb(${VERT} / 0.1)`,
              boxShadow: `inset 0 0 0 1px rgb(${VERT} / 0.34)`,
            }}
          >
            <span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-[inherit]"
              style={
                {
                  background: `rgb(${VERT} / 0.17)`,
                  WebkitMaskImage: TRAME,
                  maskImage: TRAME,
                  WebkitMaskSize: "28px 28px",
                  maskSize: "28px 28px",
                } as CSSProperties
              }
            />
            <motion.span
              initial={reduit ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 16,
                delay: reduit ? 0 : 0.16,
              }}
              className="flex"
            >
              <Lock className="size-[14px]" strokeWidth={2.4} aria-hidden />
            </motion.span>
            <span>Je viens</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------- 3. Les onglets du Niveau XP ---------------------------- */

type Vue = "missions" | "autres";

const ONGLETS: { v: Vue | "passe"; nom: string }[] = [
  { v: "passe", nom: "Passe" },
  { v: "missions", nom: "Missions" },
  { v: "autres", nom: "Les autres" },
];

// Des missions du catalogue (lib/sfl/missions.ts) : nom de code, prime, rang.
const MIENNES: Genre[] = ["finis-devant", "deux-passes"];
const DES_AUTRES: Genre[] = ["passe-devant", "tiens-le", "gagnez"];

/** Les onglets du mode Passe ; l'onglet glisse des Missions aux Autres, la liste suit. */
function OngletsNiveau({ moi }: { moi: string }) {
  const reduit = useReducedMotion();
  const { players } = useSeason();
  const [boucle, setVue] = useState<Vue>("missions");
  // Mouvement réduit : directement Les autres, immobile.
  const vue: Vue = reduit ? "autres" : boucle;

  useEffect(() => {
    if (reduit) return;
    const m = setTimeout(
      () => setVue((v) => (v === "missions" ? "autres" : "missions")),
      vue === "missions" ? 1500 : 3200,
    );
    return () => clearTimeout(m);
  }, [vue, reduit]);

  const autres = useMemo(
    () =>
      rankPlayers(
        players.filter(
          (p) => p.matchs > 0 && !isHidden(p.name) && p.name !== moi,
        ),
      )
        .slice(0, 3)
        .map((p) => p.name),
    [players, moi],
  );

  const lignes =
    vue === "missions"
      ? MIENNES.map((g) => ({ cle: `m-${g}`, nom: moi, g }))
      : DES_AUTRES.slice(0, Math.max(1, autres.length)).map((g, k) => ({
          cle: `a-${g}`,
          nom: autres[k] ?? moi,
          g,
        }));

  return (
    <div className="flex w-full flex-col items-center gap-[13px]">
      <nav
        aria-hidden
        className="flex gap-1 rounded-full bg-white/[0.06] p-1 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
      >
        {ONGLETS.map((o) => (
          <span
            key={o.v}
            className={cn(
              "relative flex h-8 items-center px-[14px] font-mono text-[11px] font-bold tracking-[0.08em] uppercase transition-colors duration-200",
              vue === o.v ? "text-[#0b0a14]" : "text-white/60",
            )}
          >
            {vue === o.v && (
              <motion.span
                layoutId="nouveautes-27-10-onglet"
                transition={
                  reduit
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 32 }
                }
                className="absolute inset-0 rounded-full bg-[#f4f5f2]"
              />
            )}
            <span className="relative">{o.nom}</span>
          </span>
        ))}
      </nav>
      <div className="flex min-h-[204px] w-full flex-col gap-1.5 [@media(max-height:739px)]:min-h-[150px]">
        <AnimatePresence mode="popLayout" initial={false}>
          {lignes.map((l, k) => (
            <motion.div
              key={l.cle}
              initial={reduit ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={
                reduit
                  ? { opacity: 0, transition: { duration: 0 } }
                  : { opacity: 0, y: -6, transition: { duration: 0.14 } }
              }
              transition={{ ...ressort, delay: reduit ? 0 : 0.05 * k }}
              className={cn(
                "glass-soft flex items-center gap-3 rounded-[18px] px-3.5 py-2",
                k === 2 && "[@media(max-height:739px)]:hidden",
              )}
            >
              <CarteDe name={l.nom} size={FORMAT_CARTE.petite} inerte />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">
                  <Nom n={l.nom} />
                </span>
                <span className="mono-label truncate text-[10.5px] text-white/50">
                  Mission {NOM_DE_CODE[l.g]}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span
                  className="text-[19px] leading-none text-white"
                  style={{ fontFamily: ANTON }}
                >
                  {rangDe({ xp: PRIME[l.g] })}
                </span>
                <span className="font-mono text-[10.5px] text-white/55 tabular-nums">
                  +{PRIME[l.g]} XP
                </span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
