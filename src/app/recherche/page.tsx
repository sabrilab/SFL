"use client";

// Recherche — un seul champ pour deux mondes.
//
//   · un nom, un pseudo, un poste  → la fiche du joueur : sa carte, ses notes,
//     ses chiffres de saison, sa forme, son dimanche par dimanche
//   · « J6 », « journée 6 », « 6 »  → la fiche de la journée : les matchs, les
//     buteurs, les passeurs, et le lien vers son récap dans le Feed
//
// Tout est dérivé de la saison déjà en mémoire : la recherche ne charge rien,
// elle filtre. Les résultats s'ouvrent sur place, sans changer de page.

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, CalendarDays, Search, X } from "lucide-react";
import { Card3D } from "@/components/sfl/card-3d";
import { PlayerCard } from "@/components/sfl/player-card";
import { Locked } from "@/components/sfl/locked";
import { useSeason } from "@/components/sfl/season-provider";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import { logActivity } from "@/lib/sfl/activity";
import { username } from "@/lib/sfl/usernames";
import {
  journeeScoreSummary,
  ovr,
  rankPlayers,
  rareStats,
  STAT_KEYS,
  type Journee,
  type Player,
} from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

/* ------------------------------- outillage ------------------------------- */

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** « j6 », « journée 6 », « journee 6 », « 6 » → 6. Sinon null. */
function parseJournee(q: string): number | null {
  const s = fold(q).replace(/\s+/g, " ");
  const m = s.match(/^(?:j|journee|journée)\s*(\d{1,2})$/) ?? s.match(/^(\d{1,2})$/);
  return m ? Number(m[1]) : null;
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const src = usePlayerPhoto(name);
  const [broken, setBroken] = useState(false);
  return (
    <span
      className="glass-soft flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {broken ? (
        name[0]
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          ref={(el) => {
            if (el && el.complete && el.naturalWidth === 0) setBroken(true);
          }}
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );
}

/* ------------------------------ fiche joueur ------------------------------ */

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="mono-label w-8 shrink-0 text-foreground/40">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
        <span
          className="block h-full rounded-full bg-foreground/80"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </span>
      <span className="w-7 shrink-0 text-right text-[13px] font-bold tabular-nums">{value}</span>
    </div>
  );
}

function FicheJoueur({ player, rank }: { player: Player; rank: number }) {
  const { saison, journees } = useSeason();
  const cardStats = rareStats(player.stats);

  const mine = useMemo(
    () =>
      saison.entries
        .filter((e) => e.player === player.name && !e.extraTime && e.statut === "Présent")
        .sort((a, b) => a.j - b.j),
    [saison.entries, player.name]
  );

  const forme = mine
    .filter((e) => e.result)
    .slice(-5)
    .map((e) => (e.result === "Victoire" ? "V" : e.result === "Nul" ? "N" : "D"));

  const dates = new Map(journees.map((j) => [j.j, j.date]));

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-[18px]"
    >
      {/* La carte en grand */}
      <section className="flex flex-col items-center gap-3">
        <Card3D
          cacheKey={`recherche-${player.name}`}
          mode="rare"
          size={0.8}
          render={(s) => <PlayerCard player={player} mode="rare" size={s} />}
        />
        <p className="mono-label text-center text-[9px] tracking-[0.12em] text-foreground/30">
          Glisse pour tourner · double-clic pour retourner
        </p>
      </section>

      {/* Identité */}
      <div className="flex items-center gap-3">
        <Avatar name={player.name} size={46} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[19px] font-extrabold tracking-tight">{player.name}</div>
          <div className="mt-0.5 truncate text-[12.5px] text-foreground/42">
            {username(player.name)} · {player.poste} · {rank}e au Pépite d&apos;Or
          </div>
        </div>
        <div className="text-right">
          <div className="text-[26px] leading-none font-extrabold tracking-tight tabular-nums">
            {ovr(cardStats)}
          </div>
          <p className="mono-label mt-1 text-foreground/40">Général</p>
        </div>
      </div>

      {/* Les six critères */}
      <section className="glass flex flex-col gap-2.5 rounded-[26px] px-[18px] py-[17px]">
        <p className="mono-label text-foreground/40">Profil de jeu</p>
        {STAT_KEYS.map((k) => (
          <StatBar key={k} label={k} value={cardStats[k]} />
        ))}
      </section>

      {/* Chiffres de saison */}
      <div className="grid grid-cols-4 gap-2.5">
        {(
          [
            [player.pp, "Pépite"],
            [player.buts, "Buts"],
            [player.passes, "Passes"],
            [player.matchs, "Matchs"],
          ] as const
        ).map(([value, label]) => (
          <div key={label} className="glass rounded-[20px] px-3 py-3.5 text-center">
            <div className="text-[22px] leading-none font-extrabold tracking-tight tabular-nums">
              {value}
            </div>
            <p className="mono-label mt-2 text-foreground/40">{label}</p>
          </div>
        ))}
      </div>

      {/* Forme */}
      {forme.length > 0 && (
        <div className="glass-soft flex items-center justify-between rounded-[20px] px-4 py-3">
          <span className="mono-label text-foreground/40">Forme · 5 derniers</span>
          <span className="flex gap-1.5">
            {forme.map((r, i) => (
              <span
                key={i}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                  r === "V"
                    ? "bg-primary text-primary-foreground"
                    : r === "N"
                      ? "bg-white/12 text-foreground/70"
                      : "bg-white/6 text-foreground/35"
                )}
              >
                {r}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Dimanche par dimanche */}
      {mine.length > 0 && (
        <section>
          <h2 className="mb-2.5 px-1 text-[16px] font-bold tracking-tight">
            Dimanche par dimanche
          </h2>
          <div className="glass overflow-hidden rounded-[22px]">
            {mine.map((e, i) => (
              <div
                key={e.j}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-[13px]",
                  i < mine.length - 1 && "border-b border-white/8"
                )}
              >
                <span className="mono-label w-7 shrink-0 text-foreground/40">J{e.j}</span>
                <span className="min-w-0 flex-1 truncate text-foreground/45">
                  {dates.get(e.j) ?? ""}
                </span>
                <span className="shrink-0 tabular-nums text-foreground/70">
                  {e.buts}⚽ {e.passes}🅰
                </span>
                <span
                  className={cn(
                    "w-5 shrink-0 text-right font-bold",
                    e.result === "Victoire"
                      ? "text-primary"
                      : e.result === "Nul"
                        ? "text-foreground/50"
                        : "text-foreground/30"
                  )}
                >
                  {e.result ? e.result[0] : "–"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Les vidéos arrivent avec les uploads */}
      <Locked label="Bientôt" note="Les vidéos taguées de ce joueur apparaîtront ici.">
        <div className="glass rounded-[22px] px-4 py-5">
          <p className="text-[15px] font-semibold">Vidéos</p>
          <p className="mt-1 text-[12.5px] text-foreground/45">
            Les actions filmées où ce joueur est identifié.
          </p>
        </div>
      </Locked>
    </motion.div>
  );
}

/* ----------------------------- fiche journée ----------------------------- */

function FicheJournee({ journee }: { journee: Journee }) {
  const score = journeeScoreSummary(journee);
  const matches = journee.matches ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-[18px]"
    >
      <section className="glass rounded-[28px] px-[18px] py-[17px]">
        <p className="mono-label text-primary">Journée {journee.j}</p>
        <h2 className="mt-1.5 text-[28px] leading-[1.1] font-extrabold tracking-tight">
          {journee.date}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {score && (
            <span className="glass-soft mono-label rounded-full px-3 py-1.5 text-foreground/60">
              {score.label}
            </span>
          )}
          {journee.sflTime && (
            <span className="mono-label rounded-full bg-primary/14 px-3 py-1.5 text-primary">
              SFL Time
            </span>
          )}
          {journee.faits.buteur && (
            <span className="glass-soft mono-label rounded-full px-3 py-1.5 text-foreground/60">
              Buteur · {journee.faits.buteur}
            </span>
          )}
          {journee.faits.passeur && (
            <span className="glass-soft mono-label rounded-full px-3 py-1.5 text-foreground/60">
              Passeur · {journee.faits.passeur}
            </span>
          )}
        </div>
      </section>

      {matches.length === 0 ? (
        <div className="glass rounded-[26px] px-6 py-10 text-center text-[13px] text-foreground/45">
          Cette journée n&apos;a pas encore de feuille de match.
        </div>
      ) : (
        matches.map((m) => (
          <section key={m.id} className="glass overflow-hidden rounded-[26px]">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <span className="mono-label text-foreground/40">{m.label}</span>
              <span className="text-[19px] font-extrabold tracking-tight tabular-nums">
                {m.teamA.score} – {m.teamB.score}
              </span>
            </div>
            <div className="grid grid-cols-2">
              {[m.teamA, m.teamB].map((team, ti) => (
                <div
                  key={team.id}
                  className={cn("px-4 py-3.5", ti === 0 && "border-r border-white/8")}
                >
                  <p className="mono-label mb-2 text-foreground/45">{team.name}</p>
                  <div className="flex flex-col gap-1.5">
                    {team.players.map((p) => (
                      <div key={p.name} className="flex items-baseline gap-1.5 text-[12.5px]">
                        <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                        {(p.buts > 0 || p.passes > 0) && (
                          <span className="shrink-0 text-[11px] tabular-nums text-primary">
                            {p.buts > 0 && `${p.buts}⚽`}
                            {p.buts > 0 && p.passes > 0 && " "}
                            {p.passes > 0 && `${p.passes}🅰`}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <Link
        href="/"
        className="block rounded-full bg-foreground py-4 text-center text-[15px] font-bold text-background transition-transform active:scale-[0.98]"
      >
        Ouvrir le récap dans le Feed
      </Link>
    </motion.div>
  );
}

/* --------------------------------- page ---------------------------------- */

export default function RecherchePage() {
  const { players, journees } = useSeason();
  const [q, setQ] = useState("");
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);
  const [openJournee, setOpenJournee] = useState<number | null>(null);

  const ranked = useMemo(() => rankPlayers(players), [players]);
  const rankOf = useMemo(
    () => new Map(ranked.map((p) => [p.name, p.rank])),
    [ranked]
  );

  const needle = fold(q);
  const asJournee = parseJournee(q);

  const joueurs = useMemo(() => {
    if (!needle) return [];
    return ranked
      .filter(
        (p) =>
          fold(p.name).includes(needle) ||
          fold(username(p.name)).includes(needle) ||
          fold(p.poste).includes(needle)
      )
      .slice(0, 20);
  }, [ranked, needle]);

  const journeesTrouvees = useMemo(() => {
    if (!needle) return [];
    if (asJournee !== null) return journees.filter((j) => j.j === asJournee);
    return journees.filter((j) => fold(j.date).includes(needle)).slice(0, 6);
  }, [journees, needle, asJournee]);

  const selectedPlayer = openPlayer ? players.find((p) => p.name === openPlayer) : undefined;
  const selectedJournee =
    openJournee !== null ? journees.find((j) => j.j === openJournee) : undefined;
  const fiche = selectedPlayer || selectedJournee;

  function close() {
    setOpenPlayer(null);
    setOpenJournee(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-4 sm:py-8">
      {fiche ? (
        <button
          onClick={close}
          className="glass-soft flex w-fit items-center gap-2 rounded-full py-2 pr-4 pl-3 text-[13px] font-semibold text-foreground/60"
        >
          <ArrowLeft className="size-4" /> Recherche
        </button>
      ) : (
        <h1 className="text-[30px] font-bold tracking-tight">Recherche</h1>
      )}

      {!fiche && (
        <>
          {/* Le champ */}
          <div className="glass flex items-center gap-2.5 rounded-full px-4 py-3.5">
            <Search className="size-[18px] shrink-0 text-foreground/35" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder="Un joueur, un pseudo, ou « J6 »…"
              className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-foreground/30"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                aria-label="Effacer"
                className="shrink-0 text-foreground/35"
              >
                <X className="size-[18px]" />
              </button>
            )}
          </div>

          {!q && (
            <>
              <p className="px-1 text-[12.5px] leading-snug text-foreground/40">
                Cherche n&apos;importe quel joueur inscrit — sa carte, ses notes, ses chiffres —
                ou tape le numéro d&apos;une journée pour retrouver ses matchs.
              </p>
              <section>
                <h2 className="mb-2.5 px-1 text-[14px] font-bold tracking-tight text-foreground/60">
                  Les journées
                </h2>
                <div className="flex flex-wrap gap-2">
                  {journees.map((j) => (
                    <button
                      key={j.j}
                      onClick={() => setOpenJournee(j.j)}
                      className="glass-soft flex items-center gap-2 rounded-full py-2 pr-4 pl-3 text-[13px] font-semibold transition-transform active:scale-95"
                    >
                      <CalendarDays className="size-3.5 text-foreground/35" />J{j.j}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Résultats */}
          <AnimatePresence mode="popLayout">
            {journeesTrouvees.length > 0 && (
              <motion.section
                key="journees"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <h2 className="mb-2.5 px-1 text-[14px] font-bold tracking-tight text-foreground/60">
                  Journées
                </h2>
                <div className="flex flex-col gap-2">
                  {journeesTrouvees.map((j) => {
                    const score = journeeScoreSummary(j);
                    return (
                      <button
                        key={j.j}
                        onClick={() => {
                          logActivity("recherche", { meta: { journee: j.j } });
                          setOpenJournee(j.j);
                        }}
                        className="glass flex items-center gap-3.5 rounded-[22px] px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
                      >
                        <span className="glass-soft flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold">
                          J{j.j}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">
                            Journée {j.j}
                          </span>
                          <span className="block truncate text-[12.5px] text-foreground/42">
                            {j.date}
                            {score ? ` · ${score.label}` : " · pas encore jouée"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {joueurs.length > 0 && (
              <motion.section
                key="joueurs"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-1"
              >
                <h2 className="mb-2.5 px-1 text-[14px] font-bold tracking-tight text-foreground/60">
                  Joueurs · {joueurs.length}
                </h2>
                <div className="flex flex-col gap-2">
                  {joueurs.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => {
                        logActivity("recherche", { meta: { joueur: p.name } });
                        setOpenPlayer(p.name);
                      }}
                      className="glass flex items-center gap-3.5 rounded-[22px] px-4 py-3 text-left transition-transform active:scale-[0.99]"
                    >
                      <Avatar name={p.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                        <span className="block truncate text-[12.5px] text-foreground/42">
                          {username(p.name)} · {p.poste} · {rankOf.get(p.name)}e
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[17px] leading-none font-extrabold tabular-nums">
                          {ovr(rareStats(p.stats))}
                        </span>
                        <span className="mono-label mt-1 block text-foreground/35">Gén</span>
                      </span>
                    </button>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {q && joueurs.length === 0 && journeesTrouvees.length === 0 && (
            <div className="glass rounded-[26px] px-6 py-10 text-center text-[13px] text-foreground/45">
              Rien trouvé pour « {q} ».
            </div>
          )}
        </>
      )}

      {selectedPlayer && (
        <FicheJoueur
          player={selectedPlayer}
          rank={rankOf.get(selectedPlayer.name) ?? players.length}
        />
      )}
      {!selectedPlayer && selectedJournee && <FicheJournee journee={selectedJournee} />}
    </div>
  );
}
