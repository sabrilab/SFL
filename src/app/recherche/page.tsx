"use client";

// Recherche — un seul champ pour deux mondes.
//
//   · un nom, un pseudo, un poste  → le profil du joueur (profil-joueur.tsx) :
//     sa carte en grand, ses trophées, sa saison, son parcours, son jeu
//   · « J6 », « journée 6 », « 6 »  → la fiche de la journée : les matchs, les
//     buteurs, les passeurs, et le lien vers son dimanche dans les Actus
//
// Tout est dérivé de la saison déjà en mémoire : la recherche ne charge rien,
// elle filtre. Les résultats s'ouvrent sur place, sans changer de page.
// ?joueur=Nom ouvre directement un profil (la carte en grand, la
// notification « … te suit »).
//
// Un joueur Bola (hors de la SFL, hooks/use-hors-sfl.ts) n'y trouve ni les
// journées ni l'effectif de la SFL : il cherche parmi les comptes de Bola
// (listerProfils), et le joueur trouvé s'ouvre en carte, sans le profil de
// sa saison SFL (28/10/2026).

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { carteNeutre } from "@/components/sfl/qui-vient";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { useCardViewer } from "@/components/sfl/card-viewer";
import { prechaufferCarte } from "@/components/sfl/card-3d";
import { isHidden } from "@/lib/sfl/hidden";
import { useHorsSflEtat } from "@/hooks/use-hors-sfl";
import { chercherProfils, listerProfils, type Profil } from "@/lib/sfl/matchs";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { CalendarDays, Search, X } from "lucide-react";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { ProfilJoueur } from "@/components/sfl/profil-joueur";
import { useSeason } from "@/components/sfl/season-provider";
import { useProfilsOuverts } from "@/hooks/use-suivis";
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
import { PastilleMaillot } from "@/components/sfl/point-maillot";

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
        <h2 className="mt-1.5 text-titre-l leading-[1.1] font-extrabold tracking-tight">
          {journee.date}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {score && (
            <span className="glass-soft mono-label rounded-full px-3 py-1.5 text-encre-2">
              {score.label}
            </span>
          )}
          {journee.sflTime && (
            <span className="mono-label rounded-full bg-primary/14 px-3 py-1.5 text-primary">
              SFL Time
            </span>
          )}
          {journee.faits.buteur && (
            <span className="glass-soft mono-label rounded-full px-3 py-1.5 text-encre-2">
              Buteur · {journee.faits.buteur}
            </span>
          )}
          {journee.faits.passeur && (
            <span className="glass-soft mono-label rounded-full px-3 py-1.5 text-encre-2">
              Passeur · {journee.faits.passeur}
            </span>
          )}
        </div>
      </section>

      {matches.length === 0 ? (
        <div className="glass rounded-[26px] px-6 py-10 text-center text-corps text-encre-3">
          Cette journée n&apos;a pas encore de feuille de match.
        </div>
      ) : (
        matches.map((m) => (
          <section key={m.id} className="glass overflow-hidden rounded-[26px]">
            <div className="flex items-center justify-between border-b border-contraste/8 px-4 py-3">
              <span className="mono-label text-encre-3">{m.label}</span>
              <span className="text-titre-fort font-extrabold tracking-tight tabular-nums">
                {m.teamA.score} – {m.teamB.score}
              </span>
            </div>
            <div className="grid grid-cols-2">
              {[m.teamA, m.teamB].map((team, ti) => (
                <div
                  key={team.id}
                  className={cn("px-4 py-3.5", ti === 0 && "border-r border-contraste/8")}
                >
                  <PastilleMaillot camp={ti === 0 ? "Noirs" : "Blancs"} className="mb-2.5" />
                  <div className="flex flex-col gap-1.5">
                    {team.players.map((p) => (
                      <div key={p.name} className="flex items-baseline gap-1.5 text-corps">
                        <span className="min-w-0 flex-1 truncate font-medium"><Nom n={p.name} /></span>
                        {(p.buts > 0 || p.passes > 0) && (
                          <span className="shrink-0 text-legende tabular-nums text-primary">
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

      {/* Son dimanche dans les Actus. */}
      <Link
        href={`/ligue#j${journee.j}`}
        className="bouton-principal block py-4 text-center text-lecture font-bold"
      >
        Ouvrir le récap dans les Actus
      </Link>
    </motion.div>
  );
}

/* --------------------------------- page ---------------------------------- */

export default function RecherchePage() {
  const horsSfl = useHorsSflEtat();
  // Tant qu'on ne sait pas (la toute première ouverture), rien de la SFL.
  if (horsSfl === null) return null;
  // useSearchParams impose une frontière Suspense côté App Router.
  return <Suspense fallback={null}>{horsSfl ? <RechercheBola /> : <Recherche />}</Suspense>;
}

/**
 * La Recherche d'un joueur Bola : les comptes de Bola, chacun en carte. Toucher
 * un résultat ouvre sa carte (la visionneuse, card-viewer.tsx), comme dans le
 * classement de Bola ; ?joueur=Nom (la notification « … te suit ») l'ouvre
 * d'emblée. Les joueurs masqués (lib/sfl/hidden.ts) n'y sont pas, comme dans
 * ce classement.
 */
function RechercheBola() {
  const { allPlayers } = useSeason();
  const { open } = useCardViewer();
  const demande = useSearchParams().get("joueur");
  const [q, setQ] = useState("");
  const [profils, setProfils] = useState<Profil[]>([]);
  useEffect(() => {
    let fini = false;
    listerProfils()
      .then((p) => !fini && setProfils(p.filter((x) => !isHidden(x.name))))
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, []);
  const trouves = useMemo(() => chercherProfils(profils, q), [profils, q]);
  // Sa carte, comme dans les classements de Bola (ligue-vierge) : celle qu'il a, sinon une carte neutre.
  const carte = useCallback(
    (name: string) => allPlayers.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? carteNeutre(name),
    [allPlayers]
  );
  const ouvrir = useCallback(
    (name: string) => {
      const player = carte(name);
      open({
        cacheKey: `recherche-${name}`,
        mode: "simple",
        title: name,
        joueur: name,
        render: (s) => <PlayerCard player={player} size={s} />,
      });
    },
    [carte, open]
  );
  // Le joueur demandé par le lien, une fois les comptes lus (un nom inconnu ou masqué n'ouvre rien).
  const ouvert = useRef<string | null>(null);
  useEffect(() => {
    if (!demande || demande === ouvert.current) return;
    const p = profils.find((x) => x.name === demande);
    if (!p) return;
    ouvert.current = demande;
    ouvrir(p.name);
  }, [demande, profils, ouvrir]);

  return (
    <div className="shell flex flex-col gap-4 py-4 sm:py-8">
      <div className="flex items-center gap-3">
        <BoutonRetour />
        <h1 className="text-titre-l font-bold tracking-tight">Recherche</h1>
      </div>
      <div className="glass flex items-center gap-2.5 rounded-full px-4 py-3.5">
        <Search className="size-[18px] shrink-0 text-encre-4" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={!demande}
          placeholder="Un joueur, un pseudo…"
          className="min-w-0 flex-1 bg-transparent text-lecture font-medium outline-none placeholder:text-encre-4"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Effacer" className="shrink-0 text-encre-4">
            <X className="size-[18px]" />
          </button>
        )}
      </div>
      {trouves.length > 0 && (
        <section>
          <h2 className="mb-2.5 px-1 text-ligne font-bold tracking-tight text-encre-2">Joueurs · {trouves.length}</h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {trouves.map((p) => (
              <button
                key={p.id}
                type="button"
                onPointerDown={(e) => prechaufferCarte(e.currentTarget)}
                onClick={() => ouvrir(p.name)}
                aria-label={`Voir la carte de ${p.name}`}
                className="glass flex items-center gap-3.5 rounded-[22px] px-4 py-3 text-left transition-transform active:scale-[0.98]"
              >
                <span className="shrink-0">
                  <PlayerCard player={carte(p.name)} size={FORMAT_CARTE.petite} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lecture font-semibold"><Nom n={p.name} /></span>
                  <span className="block truncate text-corps text-encre-3">{p.username}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      {q.trim() && trouves.length === 0 && (
        <div className="glass rounded-[26px] px-6 py-10 text-center text-corps text-encre-3">Rien trouvé pour « {q} ».</div>
      )}
    </div>
  );
}

function Recherche() {
  const { players, journees } = useSeason();
  const demande = useSearchParams().get("joueur");
  const [q, setQ] = useState("");
  const [openPlayer, setOpenPlayer] = useState<string | null>(demande);
  const [openJournee, setOpenJournee] = useState<number | null>(null);
  // Un autre profil demandé alors que la page est déjà ouverte.
  const [vu, setVu] = useState(demande);
  if (demande !== vu) {
    setVu(demande);
    if (demande) {
      setOpenPlayer(demande);
      setOpenJournee(null);
    }
  }
  useEffect(() => {
    if (demande) document.getElementById("app-scroll")?.scrollTo({ top: 0 });
  }, [demande]);

  // Un joueur masqué ne se trouve que pour ceux qu'il suit et qui le suivent
  // (useProfilsOuverts), à la place qu'il aurait, sans déplacer les autres.
  const { relies } = useProfilsOuverts();
  const ranked = useMemo(() => {
    const publics = rankPlayers(players);
    const masques = relies.flatMap((r) => rankPlayers([...players, r]).filter((p) => p.name === r.name));
    return [...publics, ...masques].sort((a, b) => a.rank - b.rank);
  }, [players, relies]);
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

  const selectedPlayer = openPlayer ? ranked.find((p) => p.name === openPlayer) : undefined;
  const selectedJournee =
    openJournee !== null ? journees.find((j) => j.j === openJournee) : undefined;
  const fiche = selectedPlayer || selectedJournee;

  function close() {
    setOpenPlayer(null);
    setOpenJournee(null);
  }

  return (
    <div className="shell flex flex-col gap-4 py-4 sm:py-8">
      {/* Le retour de la page, et celui d'une fiche ouverte, qui revient à la Recherche. */}
      {fiche ? (
        <BoutonRetour onRetour={close} titre="Recherche" />
      ) : (
        <div className="flex items-center gap-3">
          <BoutonRetour />
          <h1 className="text-titre-l font-bold tracking-tight">Recherche</h1>
        </div>
      )}

      {!fiche && (
        <>
          {/* Le champ */}
          <div className="glass flex items-center gap-2.5 rounded-full px-4 py-3.5">
            <Search className="size-[18px] shrink-0 text-encre-4" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder="Un joueur, un pseudo, ou « J6 »…"
              className="min-w-0 flex-1 bg-transparent text-lecture font-medium outline-none placeholder:text-encre-4"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                aria-label="Effacer"
                className="shrink-0 text-encre-4"
              >
                <X className="size-[18px]" />
              </button>
            )}
          </div>

          {!q && (
            <>
              <p className="px-1 text-corps leading-snug text-encre-3">
                Cherche n&apos;importe quel joueur inscrit — sa carte, ses notes, ses chiffres —
                ou tape le numéro d&apos;une journée pour retrouver ses matchs.
              </p>
              <section>
                <h2 className="mb-2.5 px-1 text-ligne font-bold tracking-tight text-encre-2">
                  Les journées
                </h2>
                <div className="flex flex-wrap gap-2">
                  {journees.map((j) => (
                    <button
                      key={j.j}
                      onClick={() => setOpenJournee(j.j)}
                      className="bouton-secondaire flex items-center gap-2 py-2 pr-4 pl-3 text-corps font-semibold"
                    >
                      <CalendarDays className="size-3.5 text-encre-4" />J{j.j}
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
                <h2 className="mb-2.5 px-1 text-ligne font-bold tracking-tight text-encre-2">
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
                        <span className="glass-soft flex size-10 shrink-0 items-center justify-center rounded-full text-corps font-extrabold">
                          J{j.j}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-lecture font-semibold">
                            Journée {j.j}
                          </span>
                          <span className="block truncate text-corps text-encre-3">
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
                <h2 className="mb-2.5 px-1 text-ligne font-bold tracking-tight text-encre-2">
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
                        <span className="block truncate text-lecture font-semibold"><Nom n={p.name} /></span>
                        <span className="block truncate text-corps text-encre-3">
                          {pseudoAffiche(p.name)} · {p.poste} · {rankOf.get(p.name)}e
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-titre leading-none font-extrabold tabular-nums">
                          {ovr(p.stats)}
                        </span>
                        <span className="mono-label mt-1 block text-encre-4">Gén</span>
                      </span>
                    </button>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {q && joueurs.length === 0 && journeesTrouvees.length === 0 && (
            <div className="glass rounded-[26px] px-6 py-10 text-center text-corps text-encre-3">
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
