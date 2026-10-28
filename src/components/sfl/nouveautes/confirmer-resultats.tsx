"use client";

// Nouveauté du 28/10 : les joueurs confirment le résultat d'un match Bola
// (lib/sfl/confirmation-resultat.ts ; Sabri : « Par un écran qui s'affiche
// confirmer ou infirmer les résultats »).
//
//   1. « Le score arrive chez toi. » : la notification descend (« Match de
//      … · 6 – 4 », « Toi : 2 buts, 1 passe · MVP … »), puis l'écran
//      « Résultat du match » se pose dessous : le score, ma ligne, le MVP.
//   2. « Confirme. Ou infirme. » : le bouton rond glisse jusqu'à
//      « Confirmer », la grille de pixels s'allume, le sceau se pose ; puis
//      le compteur passe de « En attente · 3/4 » à « Validé » (4 sur 7 :
//      la moitié confirme). La piste et sa
//      grille sont celles de la réponse scellée (GrilleGlisse, scelle.css),
//      menées par une horloge, comme nouveautes-27-10.tsx.
//
// Boucle douce ; « Réduire les animations » : chaque visuel montre son état
// final, immobile. La scène est noire en clair comme en sombre : encre et
// papier, l'or reste aux cartes MVP (la pastille MVP est blanche).

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronsLeftRight, Lock } from "lucide-react";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { course, GrilleGlisse } from "@/components/sfl/reponse-scellee";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { rankPlayers, type Player } from "@/lib/sfl/engine";
import { isHidden } from "@/lib/sfl/hidden";
import { matchDe } from "@/lib/sfl/confirmation-resultat";
import { cn } from "@/lib/utils";
import { useCourt, type Diapo } from "./diaporama";

export function diaposConfirmerResultats(player: Player): Diapo[] {
  return [
    {
      visuel: <LeScoreArrive moi={player.name} />,
      titre: "Le score arrive chez toi.",
      ligne: "Après chaque match Bola : le score, ta ligne, le MVP.",
    },
    {
      visuel: <ConfirmeOuInfirme />,
      titre: "Confirme. Ou infirme.",
      ligne: "Le match est validé quand la moitié des joueurs confirme.",
    },
  ];
}

const ressort = { type: "spring", stiffness: 260, damping: 24 } as const;

/** Deux autres joueurs de la ligue, pour l'organisateur et le MVP. */
function useDeux(moi: string): [string, string] {
  const { players } = useSeason();
  return useMemo(() => {
    const t = rankPlayers(
      players.filter(
        (p) => p.matchs > 0 && !isHidden(p.name) && p.name !== moi,
      ),
    ).map((p) => p.name);
    return [t[1] ?? "Karim", t[0] ?? "Clara"];
  }, [players, moi]);
}

/* ------------------------------ 1. Le score arrive ------------------------------ */

function LeScoreArrive({ moi }: { moi: string }) {
  const reduit = useReducedMotion();
  const court = useCourt();
  const id = useIdentites();
  const [orga, mvp] = useDeux(moi);
  const prenom = (n: string) => id.nom(n).split(" ")[0];
  const [boucle, setT] = useState(0);
  // 0 : rien ; 1 : la notification ; 2 : l'écran. Mouvement réduit : tout est là.
  const t = reduit ? 2 : boucle;
  useEffect(() => {
    if (reduit) return;
    const m = setTimeout(() => setT((x) => (x + 1) % 3), [700, 1300, 3600][t]);
    return () => clearTimeout(m);
  }, [t, reduit]);

  return (
    <div className="flex w-full max-w-[320px] flex-col items-center gap-[13px]">
      <div className="h-[70px] w-full">
        <AnimatePresence>
          {t >= 1 && (
            <motion.div
              key="notif"
              initial={reduit ? false : { y: -40, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              aria-hidden
              className="flex items-center gap-3 rounded-[20px] bg-white/[0.11] px-3.5 py-3 backdrop-blur-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-192.png"
                alt=""
                className="size-[38px] shrink-0 rounded-[9px]"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-semibold">
                  {matchDe(prenom(orga))} · 6 – 4
                </span>
                <span className="truncate text-[13px] text-white/70">
                  Toi : 2 buts, 1 passe · MVP {prenom(mvp)}
                </span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {t >= 2 && (
          <motion.div
            key="ecran"
            initial={reduit ? false : { y: 26, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={ressort}
            aria-hidden
            className="flex w-full flex-col gap-[13px] rounded-[26px] bg-white/[0.06] p-[18px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]"
          >
            <span className="mono-label text-center text-[10px] text-white/50">
              Résultat du match
            </span>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end text-center">
              <span className="flex flex-col items-center gap-1">
                <span className="mono-label text-[10px] text-white/60">
                  Clairs
                </span>
                <span
                  className={cn(
                    "leading-[0.9] font-extrabold tracking-tight tabular-nums",
                    court ? "text-[40px]" : "text-[48px]",
                  )}
                >
                  6
                </span>
              </span>
              <span className="px-3 pb-1 text-[24px] font-bold text-white/25">
                –
              </span>
              <span className="flex flex-col items-center gap-1 opacity-40">
                <span className="mono-label text-[10px] text-white/60">
                  Foncés
                </span>
                <span
                  className={cn(
                    "leading-[0.9] font-extrabold tracking-tight tabular-nums",
                    court ? "text-[40px]" : "text-[48px]",
                  )}
                >
                  4
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-[18px] bg-white/[0.06] p-2.5">
              <CarteDe name={moi} size={FORMAT_CARTE.petite} inerte />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-bold">
                  {id.nom(moi)}
                </span>
                <span className="text-[13px] font-semibold text-white/70">
                  2 buts · 1 passe
                </span>
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[13px] font-semibold">
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[9.5px] leading-none font-bold tracking-wide text-black">
                MVP
              </span>
              {id.nom(mvp)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------- 2. Confirme ou infirme --------------------------- */

// La piste « md » de la réponse scellée, à la largeur du plus petit iPhone.
const PISTE = { largeur: 276, hauteur: 50, seul: false };
const GLISSER = 900;
// Le vert « y aller » des boutons (boutons.css, bouton--vert).
const VERT = "132 214 140";
const TRAME =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Crect width='6' height='6'/%3E%3Crect x='14' y='14' width='6' height='6'/%3E%3C/svg%3E\")";

type Temps = "repos" | "glisse" | "scelle" | "compte";

function ConfirmeOuInfirme() {
  const reduit = useReducedMotion();
  const [boucle, setT] = useState<Temps>("repos");
  const t: Temps = reduit ? "compte" : boucle;
  useEffect(() => {
    if (reduit) return;
    const suite: Record<Temps, [Temps, number]> = {
      repos: ["glisse", 1100],
      glisse: ["scelle", GLISSER + 120],
      scelle: ["compte", 1100],
      compte: ["repos", 2400],
    };
    const [apres, ms] = suite[t];
    const m = setTimeout(() => setT(apres), ms);
    return () => clearTimeout(m);
  }, [t, reduit]);
  const scelle = t === "scelle" || t === "compte";

  return (
    <div className="flex flex-col items-center gap-[21px]">
      <div className="flex h-6 items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={t === "compte" ? "compte" : "attente"}
            initial={reduit ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className={cn(
              "mono-label text-[12px]",
              t === "compte" ? "text-white" : "text-white/50",
            )}
          >
            {t === "compte" ? "Validé" : "En attente · 3/4"}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="relative h-[50px] w-[276px]">
        <AnimatePresence initial={false} mode="wait">
          {!scelle ? (
            <motion.div
              key="piste"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              aria-hidden
              className="absolute inset-0"
            >
              <div
                className="glisse-piste glisse-piste--md pointer-events-none h-[50px] text-[15px]"
                style={
                  {
                    "--glisse-p": t === "glisse" ? 1 : 0,
                    "--course": `${course(PISTE)}px`,
                    transition: `--glisse-p ${GLISSER}ms cubic-bezier(0.55, 0, 0.3, 1)`,
                  } as CSSProperties
                }
              >
                <GrilleGlisse mesures={PISTE} />
                <span className="glisse-libelle glisse-libelle--g">
                  Infirmer
                </span>
                <span className="glisse-libelle glisse-libelle--d">
                  Confirmer
                </span>
                <span className="glisse-bouton">
                  <ChevronsLeftRight
                    className="size-[17px]"
                    strokeWidth={2.2}
                  />
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
              aria-label="Confirmé, réponse scellée"
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
              <span>Confirmé</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
