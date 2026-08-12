"use client";

// Arène — tout le gameplay numérique de la ligue au même endroit :
//   · Duel      : deux cartes, une statistique, ton classement personnel
//   · Match     : ton deck de 5 cartes contre celui d'un autre joueur
//   · Collection: packs, catalogue, achat de cartes à l'unité
//
// La Collection avait sa propre page ; /collection redirige maintenant ici.

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import gsap from "gsap";
import { toast } from "sonner";
import { RotateCcw, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerCard } from "@/components/sfl/player-card";
import { Card3D } from "@/components/sfl/card-3d";
import { CollectionPanel } from "@/components/sfl/collection-panel";
import { CompoArena } from "@/components/sfl/compo-arena";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useIsClient } from "@/hooks/use-is-client";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { getRatings, pickPair, recordDuel, resetRatings } from "@/lib/sfl/duel";
import { DUEL_CATEGORIES, pickCategory, type DuelCategory } from "@/lib/sfl/duel-categories";
import { DAILY_DUEL_CAP, getDailyDuelCount, recordDailyDuel } from "@/lib/sfl/ballons";
import { logActivity } from "@/lib/sfl/activity";
import { MatchArena } from "@/components/sfl/match-arena";

const cardVariants = {
  idle: { scale: 1, y: 0, opacity: 1, filter: "grayscale(0)" },
  winner: { scale: 1.08, y: -10, opacity: 1, filter: "grayscale(0)" },
  loser: { scale: 0.88, y: 8, opacity: 0.4, filter: "grayscale(0.75)" },
};

const MODES = [
  ["duel", "Duel"],
  ["match", "Match"],
  ["compo", "Compo"],
  ["collection", "Collection"],
] as const;

type ArenaMode = (typeof MODES)[number][0];

const BASELINE: Record<ArenaMode, string> = {
  duel: "Choisis le meilleur des deux joueurs, statistique par statistique. Chaque duel nourrit ton classement personnel.",
  match:
    "Compose un deck de 5 cartes issues de tes packs et affronte les decks préparés par les autres joueurs.",
  compo:
    "Compose ton cinq idéal pour dimanche et dépose-le. Les compositions de la ligue créeront les matchs populaires.",
  collection:
    "Tes packs, ton catalogue et tes achats. Seules les cartes que tu possèdes peuvent entrer dans un match.",
};

function isMode(v: string | null): v is ArenaMode {
  return v === "duel" || v === "match" || v === "compo" || v === "collection";
}

function Arene() {
  const { me } = useMyPlayer();
  const { players } = useSeason();
  const isClient = useIsClient();
  const router = useRouter();
  const params = useSearchParams();

  const [arenaMode, setArenaMode] = useState<ArenaMode>(() => {
    const m = params.get("mode");
    return isMode(m) ? m : "duel";
  });
  const [round, setRound] = useState(0);
  const [pair, setPair] = useState<[Player, Player]>(() => pickPair(players));
  const [category, setCategory] = useState<DuelCategory>(() => pickCategory());
  const [resolvedWinner, setResolvedWinner] = useState<string | null>(null);
  const [lastDelta, setLastDelta] = useState(0);

  const burstRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const busy = resolvedWinner !== null;

  // Lu directement au rendu (comme les tallies de vote) : toujours à jour
  // après un duel ou un changement de profil, sans état dupliqué.
  const ratings = isClient ? getRatings(me) : {};

  // Compteur de duels du jour — relu à chaque round (round change → re-render).
  const dailyCount = isClient ? getDailyDuelCount(me) : 0;
  const capped = dailyCount >= DAILY_DUEL_CAP;

  function changeMode(mode: ArenaMode) {
    setArenaMode(mode);
    // L'URL suit, pour qu'un onglet ouvert reste partageable et que le retour
    // arrière depuis /collection retombe sur le bon onglet.
    router.replace(mode === "duel" ? "/duel" : `/duel?mode=${mode}`, { scroll: false });
  }

  function choose(index: 0 | 1) {
    if (busy || capped) return;
    const daily = recordDailyDuel(me);
    if (!daily.allowed) return;

    const winner = pair[index];
    const loser = pair[1 - index];
    setResolvedWinner(winner.name);

    const burst = burstRefs.current[index];
    if (burst) {
      gsap.fromTo(
        burst,
        { opacity: 0.9, scale: 0.3 },
        { opacity: 0, scale: 2.2, duration: 0.6, ease: "power3.out" }
      );
    }

    const { delta } = recordDuel(me, winner.name, loser.name, category.id);
    setLastDelta(delta);
    logActivity("duel", { meta: { categorie: category.id } });
    if (daily.rewarded > 0) {
      toast.success(`+${daily.rewarded} Ballons ⚽`, {
        description: `${DAILY_DUEL_CAP} duels du jour terminés — bien joué !`,
      });
    } else {
      toast.success(`${winner.name} l'emporte`, {
        description: `${category.label} · face à ${loser.name}`,
      });
    }

    setTimeout(() => {
      setPair((prev) => pickPair(players, [prev[0].name, prev[1].name]));
      setCategory((prev) => pickCategory(prev.id));
      setResolvedWinner(null);
      setRound((r) => r + 1);
    }, 700);
  }

  const ranked = Object.entries(ratings)
    .filter(([, r]) => r.duels > 0)
    .sort((a, b) => b[1].elo - a[1].elo);

  function reset() {
    resetRatings(me);
    setPair((prev) => pickPair(players, [prev[0].name, prev[1].name]));
    setCategory((prev) => pickCategory(prev.id));
    toast.success("Classement personnel réinitialisé");
  }

  return (
    <div className="shell flex flex-col gap-6 py-4 sm:py-8">
      <div>
        <h1 className="text-[30px] font-bold tracking-tight">Arène</h1>
        <p className="mt-1 text-[13px] leading-snug text-foreground/42">{BASELINE[arenaMode]}</p>
      </div>

      {/* Sélecteur Duel / Match / Collection */}
      <div className="glass flex w-full rounded-full p-1">
        {MODES.map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => changeMode(mode)}
            className={cn(
              "flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors",
              arenaMode === mode
                ? "bg-foreground text-background"
                : "text-foreground/45 hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {arenaMode === "collection" ? (
        <CollectionPanel me={me} />
      ) : arenaMode === "compo" ? (
        <CompoArena me={me} />
      ) : arenaMode === "match" ? (
        <MatchArena me={me} />
      ) : (
        <>
          {isClient && (
            <div className="glass-soft flex items-center justify-between rounded-[18px] px-4 py-2.5">
              <span className="text-[13px] font-semibold">
                Duels du jour&nbsp;
                <span className="text-foreground/45 tabular-nums">
                  {dailyCount}/{DAILY_DUEL_CAP}
                </span>
              </span>
              <span className="text-[12px] font-semibold text-foreground/45">
                {capped ? "Quota atteint · reviens demain" : "+5 ⚽ en terminant les 10"}
              </span>
            </div>
          )}

          {isClient && capped ? (
            <div className="glass rounded-[26px] px-6 py-10 text-center text-sm text-foreground/45">
              Tes 10 duels du jour sont faits — les 5 Ballons sont à toi. Reviens demain !
            </div>
          ) : isClient ? (
            <section className="flex flex-col items-center gap-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={round}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14, transition: { duration: 0.16 } }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center gap-5"
                >
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="rounded-full bg-primary/12 px-3 py-1 text-[11px] font-bold tracking-widest text-primary uppercase">
                      {category.label}
                    </span>
                    <span className="text-lg font-bold tracking-tight">{category.question}</span>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    {pair.map((p, i) => {
                      const variant =
                        resolvedWinner === null
                          ? "idle"
                          : p.name === resolvedWinner
                            ? "winner"
                            : "loser";
                      return (
                        <motion.button
                          key={p.name}
                          onClick={() => choose(i as 0 | 1)}
                          disabled={busy}
                          whileTap={!busy ? { scale: 0.94 } : undefined}
                          animate={variant}
                          variants={cardVariants}
                          transition={{ type: "spring", stiffness: 320, damping: 22 }}
                          className="relative flex flex-col items-center gap-2 rounded-3xl p-1"
                          aria-label={`Choisir ${p.name}`}
                        >
                          <div
                            ref={(el) => {
                              burstRefs.current[i] = el;
                            }}
                            className="pointer-events-none absolute inset-0 rounded-full opacity-0"
                            style={{
                              background:
                                "radial-gradient(circle, rgba(255,90,31,.55) 0%, rgba(255,90,31,0) 70%)",
                            }}
                          />
                          <Card3D
                            cacheKey={`simple-${p.name}-${category.id}`}
                            mode="simple"
                            size={0.62}
                            render={(s) => (
                              <PlayerCard
                                player={p}
                                mode="simple"
                                size={s}
                                highlightStats={category.statKeys}
                              />
                            )}
                          />
                          <span className="text-sm font-semibold">{p.name}</span>
                          <AnimatePresence>
                            {resolvedWinner === p.name && (
                              <motion.span
                                initial={{ opacity: 0, y: 0 }}
                                animate={{ opacity: 1, y: -14 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4 }}
                                className="absolute -top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white"
                              >
                                +{lastDelta}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            </section>
          ) : (
            <div className="flex justify-center py-10">
              <Swords className="size-8 animate-pulse text-foreground/45" />
            </div>
          )}

          <section>
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 className="text-lg font-semibold tracking-tight">Ton classement personnel</h2>
              {ranked.length > 0 && (
                <Button variant="ghost" size="sm" onClick={reset} className="text-foreground/45">
                  <RotateCcw /> Réinitialiser
                </Button>
              )}
            </div>

            {ranked.length === 0 ? (
              <div className="glass rounded-[26px] px-6 py-10 text-center text-sm text-foreground/45">
                Choisis un vainqueur ci-dessus pour démarrer ton classement.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {ranked.map(([name, r], i) => {
                  const isMe = name === me;
                  return (
                    <div
                      key={name}
                      className={cn(
                        "glass-soft flex items-center gap-3 rounded-[18px] px-3 py-2.5",
                        isMe && "ring-1 ring-primary/50"
                      )}
                    >
                      <span
                        className={cn(
                          "w-7 text-base font-semibold tabular-nums",
                          i < 3 ? "text-primary" : "text-foreground/45"
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="mr-0.5 flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                        {name[0]}
                      </span>
                      <span className="flex-1 truncate text-[15px] font-semibold">{name}</span>
                      <span className="text-xs text-foreground/45">
                        {r.duels} duel{r.duels > 1 ? "s" : ""}
                      </span>
                      <span className="w-16 text-right text-lg font-bold tracking-tight tabular-nums">
                        {r.elo}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="-mx-5 flex gap-2 overflow-x-auto overscroll-x-contain px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {DUEL_CATEGORIES.map((c) => (
              <span
                key={c.id}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap",
                  c.id === category.id
                    ? "bg-foreground text-background"
                    : "glass-soft text-foreground/45"
                )}
              >
                {c.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ArenePage() {
  // useSearchParams impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={null}>
      <Arene />
    </Suspense>
  );
}
