"use client";

// Nouveauté du 27/10 au soir : deux choses d'un coup (Sabri, 27/10 : « à
// chaque fois qu'on met de nouvelles fonctionnalités en place, on veut un
// petit slideshow au début pour que les gens puissent voir quelles sont les
// nouveautés »). Elles étaient trois : la première diapo, « Invite. Monte. »
// (les paliers des recrues), est partie le 12/11, quand le parrainage a eu
// son annonce à lui (parrainage.tsx) : personne ne le voit annoncé deux fois.
//
//   1. « Une réponse, une seule. » : le bouton rond glisse de la piste
//      jusqu'à « Je viens », la grille de pixels s'allume derrière lui, la
//      réponse se scelle au cadenas. La piste et sa grille sont celles de la
//      réponse scellée (GrilleGlisse, les classes de scelle.css), menées ici
//      par une horloge ; « Pas dispo » reste dans le neutre (ni rouge ni
//      bleu dans une annonce).
//   2. « Les missions sont dans Ma carte. » : les onglets du Niveau XP
//      (Passe, Missions, Les autres), recréés ; l'onglet passe des miennes à
//      celles de toute la ligue, sur les vraies cartes des joueurs.
//
// Tout tourne en boucle douce. « Réduire les animations » : chaque visuel
// montre son état final, immobile. La scène du diaporama est noire en clair
// comme en sombre (diaporama.tsx) : encre et papier seulement, l'or, le bleu
// et le rouge restent aux cartes MVP, Défensive et Impact.

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronsLeftRight, Lock } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { course, GrilleGlisse } from "@/components/sfl/reponse-scellee";
import { useSeason } from "@/components/sfl/season-provider";
import { NOM_DE_CODE, PRIME, rangDe, type Genre } from "@/lib/sfl/missions";
import { rankPlayers, type Player } from "@/lib/sfl/engine";
import { isHidden } from "@/lib/sfl/hidden";
import { cn } from "@/lib/utils";
import type { Diapo } from "./diaporama";

export function diaposNouveautes2710(player: Player): Diapo[] {
  return [
    {
      visuel: <ReponseQuiSeScelle />,
      titre: "Une réponse, une seule.",
      ligne:
        "Glisse jusqu'au bout : ta réponse se scelle et ne change plus.",
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

/* --------------------------- 1. La réponse scellée --------------------------- */

// La piste du diaporama : la taille « md » de la réponse scellée, à la largeur
// que laisse le plus petit iPhone (320 px moins les marges du diaporama) : la
// course du bouton est calculée pour elle, la piste ne doit donc pas rétrécir.
const PISTE = { largeur: 276, hauteur: 50, seul: false };
const GLISSER = 900;
// Le vert « y aller » des boutons (boutons.css, bouton--vert).
const VERT = "132 214 140";
// La trame qui reste dans la pilule : deux pixels sur seize.
const TRAME =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Crect width='6' height='6'/%3E%3Crect x='14' y='14' width='6' height='6'/%3E%3C/svg%3E\")";

type Temps = "repos" | "glisse" | "scelle";

/** Le doigt pousse le bouton jusqu'à « Je viens », la grille s'allume derrière, la pilule se scelle ; puis on recommence. */
function ReponseQuiSeScelle() {
  const reduit = useReducedMotion();
  const [boucle, setT] = useState<Temps>("repos");
  // Mouvement réduit : la réponse est déjà scellée, rien ne tourne.
  const t: Temps = reduit ? "scelle" : boucle;

  useEffect(() => {
    if (reduit) return;
    const suite: Record<Temps, [Temps, number]> = {
      repos: ["glisse", 1100],
      glisse: ["scelle", GLISSER + 120],
      scelle: ["repos", 2600],
    };
    const [apres, ms] = suite[t];
    const m = setTimeout(() => setT(apres), ms);
    return () => clearTimeout(m);
  }, [t, reduit]);

  return (
    <div className="relative h-[50px] w-[276px]">
      {/* La piste s'efface d'abord, la pilule arrive ensuite (jamais deux « Je viens »). */}
      <AnimatePresence initial={false} mode="wait">
        {t !== "scelle" ? (
          <motion.div
            key="piste"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            aria-hidden
            className="absolute inset-0"
          >
            <div
              className="glisse-piste glisse-piste--md pointer-events-none h-[50px] text-lecture"
              style={
                {
                  "--glisse-p": t === "glisse" ? 1 : 0,
                  "--course": `${course(PISTE)}px`,
                  transition: `--glisse-p ${GLISSER}ms cubic-bezier(0.55, 0, 0.3, 1)`,
                } as CSSProperties
              }
            >
              <GrilleGlisse mesures={PISTE} />
              <span className="glisse-libelle glisse-libelle--g">Pas dispo</span>
              <span className="glisse-libelle glisse-libelle--d">Je viens</span>
              <span className="glisse-bouton">
                <ChevronsLeftRight className="size-[17px]" strokeWidth={2.2} />
                {/* Le doigt qui pousse. */}
                <span
                  className="absolute -inset-1 rounded-full bg-white/20 ring-1 ring-white/40 transition-opacity duration-150"
                  style={{ opacity: t === "glisse" ? 1 : 0 }}
                />
              </span>
            </div>
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
            className="absolute inset-0 isolate flex items-center justify-center gap-2 overflow-hidden rounded-full text-lecture font-semibold"
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

/* ---------------------------- 2. Les onglets du Niveau XP ---------------------------- */

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
              "relative flex h-8 items-center px-[14px] font-mono text-legende font-bold tracking-[0.08em] uppercase transition-colors duration-200",
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
                <span className="truncate text-lecture font-semibold">
                  <Nom n={l.nom} />
                </span>
                <span className="mono-label truncate text-legende text-white/50">
                  Mission {NOM_DE_CODE[l.g]}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span
                  className="text-titre-fort leading-none text-white"
                  style={{ fontFamily: ANTON }}
                >
                  {rangDe({ xp: PRIME[l.g] })}
                </span>
                <span className="font-mono text-legende text-white/55 tabular-nums">
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
