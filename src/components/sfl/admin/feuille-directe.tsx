"use client";

// Feuille de match en direct — celle qu'on tient au bord du terrain.
//
// Pas de cellule, pas de clavier : un joueur par carte, et quatre compteurs
// à gros boutons. On marque, on touche « + », le score d'équipe et les points
// Pépite bougent devant soi. Tout est déjà enregistré : c'est la même saison
// que la grille, les classements et les cartes suivent en direct.
//
// Les arrêts et les interceptions entrent ici pour la première fois. Barème
// posé par l'admin : chaque PAIRE d'arrêts vaut 1 point Pépite, chaque paire
// d'interceptions aussi — le gardien et le défenseur ne repartent plus les
// mains vides d'un match sans but.
//
// Chaque match se joue les Noirs contre les Blancs (saisie/equipes.ts) : un
// jour à plusieurs matchs, on choisit le match, puis le camp qu'on suit.

import { useMemo, useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeJournees, entryPP } from "@/lib/sfl/saisie/engine";
import { ChangerJoueurSheet } from "@/components/sfl/admin/changer-joueur-sheet";
import { PointMaillot } from "@/components/sfl/point-maillot";
import { changerEquipeAt, echangerCampsAt, remplacerJoueurAt, updateEntryAt } from "@/lib/sfl/saisie/mutations";
import { equipesDuJour } from "@/lib/sfl/saisie/equipes";
import { prochaineJournee } from "@/lib/sfl/saisie/etat-journee";
import type { MatchEntry, Saison } from "@/lib/sfl/saisie/types";

/** Les quatre compteurs du direct. */
const COMPTEURS = [
  { key: "buts", label: "Buts", icone: "" },
  { key: "passes", label: "Passes", icone: "" },
  { key: "arrets", label: "Arrêts", icone: "" },
  { key: "interceptions", label: "Interc.", icone: "" },
] as const;

const HONNEURS = [
  { key: "mvp", label: "MVP" },
  { key: "impact", label: "Impact" },
  { key: "def", label: "Défensive" },
  { key: "cleanSheet", label: "Clean sheet" },
] as const;

function Stepper({
  value,
  onSet,
  label,
  icone,
}: {
  value: number;
  onSet: (n: number) => void;
  label: string;
  icone: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="mono-label text-[8px] text-foreground/35">
        {icone ? `${icone} ` : ""}{label}
      </span>
      <div className="glass-soft flex w-full items-center justify-between rounded-full p-1">
        <button
          onClick={() => onSet(Math.max(0, value - 1))}
          aria-label={`${label} moins`}
          disabled={value === 0}
          className="bouton-discret flex size-7 shrink-0 items-center justify-center disabled:opacity-25"
        >
          <Minus className="size-3.5" />
        </button>
        <span
          className={cn(
            "min-w-[18px] text-center text-[15px] font-extrabold tabular-nums",
            value === 0 && "text-foreground/25"
          )}
        >
          {value}
        </span>
        <button
          onClick={() => onSet(Math.min(99, value + 1))}
          aria-label={`${label} plus`}
          className="bouton-principal flex size-7 shrink-0 items-center justify-center"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

interface Props {
  saison: Saison;
  commit: (next: Saison, label: string) => void;
}

export function FeuilleDirecte({ saison, commit, jInitial }: Props & { jInitial?: number }) {
  const journees = useMemo(() => [...saison.journees].sort((a, b) => b.j - a.j), [saison.journees]);
  // La journée du jour ou la prochaine ; jamais d'office la dernière jouée.
  const [j, setJ] = useState<number>(() => jInitial ?? prochaineJournee(saison, new Date()) ?? journees[0]?.j ?? 1);

  const rows = useMemo(
    () =>
      saison.entries
        .map((e, index) => ({ e, index }))
        .filter((x) => x.e.j === j && !x.e.extraTime),
    [saison.entries, j]
  );

  // Les équipes de la journée, match par match : les Noirs, puis les Blancs
  // (le moteur les apparie) ; puis celles qui n'ont personne en face.
  const journee = useMemo(() => computeJournees(saison).find((x) => x.j === j), [saison, j]);
  const equipes = useMemo(() => {
    const noms: string[] = [];
    for (const { e } of rows) if (e.team && !noms.includes(e.team)) noms.push(e.team);
    return equipesDuJour(journee, noms);
  }, [journee, rows]);
  const nbMatchs = journee?.matches?.length ?? 0;

  const [team, setTeam] = useState<string | null>(null);
  const active = equipes.find((x) => x.nom === team) ?? equipes[0] ?? null;
  const teamActive = active?.nom ?? null;
  // Les onglets : les deux camps du match choisi ; un jour à un seul match, toutes les équipes.
  const onglets = nbMatchs > 1 && active?.match != null ? equipes.filter((x) => x.match === active.match) : equipes;

  const visibles = rows.filter((x) => (teamActive ? x.e.team === teamActive : !x.e.team));

  const butsDe = (t: string) =>
    rows.filter((x) => x.e.team === t).reduce((s, x) => s + x.e.buts + (x.e.teamScoreBonus ?? 0), 0);
  // Le tableau d'affichage du match choisi.
  const scores = (active?.match != null ? equipes.filter((x) => x.match === active.match) : active ? [active] : []).map(
    (x) => ({ ...x, buts: butsDe(x.nom) })
  );

  function set(index: number, patch: Partial<MatchEntry>, label: string) {
    commit(updateEntryAt(saison, index, patch), label);
  }

  // La ligne dont on a touché le nom : remplacer le joueur, ou le changer d'équipe.
  const [choix, setChoix] = useState<number | null>(null);
  const ligneChoisie = choix != null ? (saison.entries[choix] ?? null) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Journée + tableau d'affichage */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={j}
          onChange={(e) => setJ(Number(e.target.value))}
          className="glass-soft h-9 cursor-pointer rounded-full px-3.5 text-[13px] font-bold outline-none"
        >
          {journees.map((m) => (
            <option key={m.j} value={m.j} className="bg-white text-[#08090b] dark:bg-[#141414] dark:text-white">
              Journée {m.j} · {m.date}
            </option>
          ))}
        </select>
        <div className="glass flex min-w-0 flex-1 items-center justify-center gap-3 rounded-full px-4 py-2">
          {scores.length === 0 ? (
            <span className="text-[12.5px] text-foreground/40">Pas encore d&apos;équipes</span>
          ) : (
            <>
              {nbMatchs > 1 && active?.match != null && (
                <span className="mono-label text-foreground/40">Match {active.match}</span>
              )}
              {scores.map((x, i) => (
                <span key={x.nom} className="flex items-center gap-2">
                  {i > 0 && <span className="text-foreground/25">—</span>}
                  {x.camp && <PointMaillot camp={x.camp} />}
                  <span className="text-[17px] font-extrabold tabular-nums">{x.buts}</span>
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Le match qu'on suit, un jour à plusieurs matchs */}
      {nbMatchs > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: nbMatchs }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setTeam(equipes.find((x) => x.match === n)?.nom ?? null)}
              className={cn(
                "px-3.5 py-1.5 text-[13px] font-semibold",
                active?.match === n ? "bouton-principal" : "bouton-secondaire text-foreground/45"
              )}
            >
              Match {n}
            </button>
          ))}
          {equipes
            .filter((x) => x.match == null)
            .map((x) => (
              <button
                key={x.nom}
                onClick={() => setTeam(x.nom)}
                className={cn(
                  "px-3.5 py-1.5 text-[13px] font-semibold",
                  teamActive === x.nom ? "bouton-principal" : "bouton-secondaire text-foreground/45"
                )}
              >
                {x.libelle}
              </button>
            ))}
        </div>
      )}

      {/* Le camp qu'on suit */}
      {onglets.length > 1 && (
        <div className="glass flex w-full rounded-full p-1">
          {onglets.map((x) => (
            <button
              key={x.nom}
              onClick={() => setTeam(x.nom)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-2 text-[13px] font-semibold",
                teamActive === x.nom ? "bouton-principal" : "bouton-discret text-foreground/45"
              )}
            >
              {x.camp && <PointMaillot camp={x.camp} />}
              {nbMatchs > 1 ? (x.camp ?? x.libelle) : x.libelle}
            </button>
          ))}
        </div>
      )}

      {/* Les joueurs */}
      {visibles.length === 0 ? (
        <div className="glass rounded-[22px] px-6 py-10 text-center text-[13px] text-foreground/45">
          <span className="mono-label">0 joueur</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visibles.map(({ e, index }) => {
            const bonusDefensif =
              Math.floor((e.arrets ?? 0) / 2) + Math.floor((e.interceptions ?? 0) / 2);
            return (
              <div key={index} className="glass rounded-[22px] px-3.5 pt-3 pb-3.5">
                <div className="mb-2.5 flex items-center gap-2">
                  <button
                    onClick={() => setChoix(index)}
                    aria-label={`Changer ${e.player}`}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left transition-opacity active:opacity-60"
                  >
                    <span className="min-w-0 truncate text-[15px] font-bold tracking-tight">
                      {e.player}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 text-foreground/35" />
                  </button>
                  {bonusDefensif > 0 && (
                    <span className="mono-label shrink-0 rounded-full bg-primary/14 px-2 py-1 text-primary">
                      +{bonusDefensif} défensif
                    </span>
                  )}
                  <span className="shrink-0 text-[15px] font-extrabold tabular-nums">
                    {entryPP(e)}
                    <span className="mono-label ml-1 text-foreground/35">PP</span>
                  </span>
                </div>

                <div className="flex gap-2">
                  {COMPTEURS.map((c) => (
                    <Stepper
                      key={c.key}
                      label={c.label}
                      icone={c.icone}
                      value={(e[c.key] as number | undefined) ?? 0}
                      onSet={(n) =>
                        set(index, { [c.key]: n } as Partial<MatchEntry>, `${c.label} — ${e.player}`)
                      }
                    />
                  ))}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {HONNEURS.map((h) => {
                    const on = !!e[h.key];
                    return (
                      <button
                        key={h.key}
                        onClick={() =>
                          set(
                            index,
                            { [h.key]: !on } as Partial<MatchEntry>,
                            `${h.label} — ${e.player}`
                          )
                        }
                        className={cn(
                          "px-2.5 py-1 text-[11.5px] font-bold",
                          on
                            ? "bouton-principal"
                            : "bouton-secondaire text-foreground/45"
                        )}
                      >
                        {h.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ChangerJoueurSheet
        saison={saison}
        ligne={ligneChoisie}
        equipes={equipes}
        onOpenChange={(o) => !o && setChoix(null)}
        onRemplacer={(nom) => {
          if (choix == null || !ligneChoisie) return;
          commit(remplacerJoueurAt(saison, choix, nom), `${ligneChoisie.player} → ${nom}`);
          setChoix(null);
        }}
        onEchanger={(autre) => {
          if (choix == null || !ligneChoisie) return;
          const i = saison.entries.findIndex((e) => e === autre);
          if (i < 0) return;
          commit(echangerCampsAt(saison, choix, i), `${ligneChoisie.player} ⇄ ${autre.player}`);
          setChoix(null);
        }}
        onChangerEquipe={(t) => {
          if (choix == null || !ligneChoisie) return;
          commit(
            changerEquipeAt(saison, choix, t),
            `${ligneChoisie.player} → ${equipes.find((x) => x.nom === t)?.libelle ?? t}`
          );
          setChoix(null);
        }}
      />

    </div>
  );
}
