"use client";

// Recherche — un seul champ pour deux mondes.
//
//   · un nom, un pseudo, un poste  → le profil du joueur (profil-joueur.tsx) :
//     sa carte en grand, ses trophées, sa saison, son parcours, son jeu
//   · « J6 », « journée 6 », « 6 »  → la fiche de la journée : les matchs, les
//     buteurs, les passeurs, et le lien vers son récap dans le Feed
//
// Tout est dérivé de la saison déjà en mémoire : la recherche ne charge rien,
// elle filtre. Les résultats s'ouvrent sur place, sans changer de page.

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, CalendarDays, Search, X } from "lucide-react";
import { ProfilJoueur } from "@/components/sfl/profil-joueur";
import { useSeason } from "@/components/sfl/season-provider";
import { CarteDe } from "@/components/sfl/mini-carte";
import { logActivity } from "@/lib/sfl/activity";
import { nomAffiche, pseudoAffiche } from "@/lib/sfl/identites";
import {
  journeeScoreSummary,
  ovr,
  rankPlayers,
  type Journee,
} from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { Nom } from "@/components/sfl/nom";

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

/** Le joueur, en petite carte (la pastille de la hiérarchie des cartes). */
function Avatar({ name }: { name: string; size?: number }) {
  return <CarteDe name={name} inerte />;
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
                        <span className="min-w-0 flex-1 truncate font-medium"><Nom n={p.name} /></span>
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
        href="/ligue"
        className="bouton-principal block py-4 text-center text-[15px] font-bold"
      >
        Ouvrir le récap dans la Ligue
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
          fold(pseudoAffiche(p.name)).includes(needle) ||
          fold(nomAffiche(p.name)).includes(needle) ||
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
    <div className="shell flex flex-col gap-4 py-4 sm:py-8">
      {fiche ? (
        <button
          onClick={close}
          className="bouton-secondaire flex w-fit items-center gap-2 py-2 pr-4 pl-3 text-[13px] font-semibold"
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
                      className="bouton-secondaire flex items-center gap-2 py-2 pr-4 pl-3 text-[13px] font-semibold"
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
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
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
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
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
                        <span className="block truncate text-[15px] font-semibold"><Nom n={p.name} /></span>
                        <span className="block truncate text-[12.5px] text-foreground/42">
                          {pseudoAffiche(p.name)} · {p.poste} · {rankOf.get(p.name)}e
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[17px] leading-none font-extrabold tabular-nums">
                          {ovr(p.stats)}
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
        <ProfilJoueur
          player={selectedPlayer}
          rank={rankOf.get(selectedPlayer.name) ?? players.length}
        />
      )}
      {!selectedPlayer && selectedJournee && <FicheJournee journee={selectedJournee} />}
    </div>
  );
}
