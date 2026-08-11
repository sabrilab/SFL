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

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { entryPP } from "@/lib/sfl/saisie/engine";
import { updateEntryAt } from "@/lib/sfl/saisie/mutations";
import type { MatchEntry, Saison } from "@/lib/sfl/saisie/types";

const TEAM_COLORS: Record<string, string> = {
  Orange: "#F9CB9C",
  Bleu: "#C9DAF8",
  Vert: "#D9EAD3",
  Jaune: "#FFF2CC",
  Rouge: "#F4CCCC",
  Gris: "#CCCCCC",
  "Équipe A": "#F9CB9C",
  "Équipe B": "#C9DAF8",
};

/** Les quatre compteurs du direct. */
const COMPTEURS = [
  { key: "buts", label: "Buts", icone: "⚽" },
  { key: "passes", label: "Passes", icone: "🅰" },
  { key: "arrets", label: "Arrêts", icone: "🧤" },
  { key: "interceptions", label: "Interc.", icone: "🛡" },
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
        {icone} {label}
      </span>
      <div className="glass-soft flex w-full items-center justify-between rounded-full p-1">
        <button
          onClick={() => onSet(Math.max(0, value - 1))}
          aria-label={`${label} moins`}
          disabled={value === 0}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-foreground/45 transition-colors active:bg-white/10 disabled:opacity-25"
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
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-90"
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

export function FeuilleDirecte({ saison, commit }: Props) {
  const journees = useMemo(() => [...saison.journees].sort((a, b) => b.j - a.j), [saison.journees]);
  const [j, setJ] = useState<number>(() => journees[0]?.j ?? 1);

  const rows = useMemo(
    () =>
      saison.entries
        .map((e, index) => ({ e, index }))
        .filter((x) => x.e.j === j && !x.e.extraTime),
    [saison.entries, j]
  );

  // Les équipes de la journée, dans leur ordre d'apparition.
  const equipes = useMemo(() => {
    const order: string[] = [];
    for (const { e } of rows) if (e.team && !order.includes(e.team)) order.push(e.team);
    return order;
  }, [rows]);

  const [team, setTeam] = useState<string | null>(null);
  const teamActive = team && equipes.includes(team) ? team : (equipes[0] ?? null);

  const visibles = rows.filter((x) => (teamActive ? x.e.team === teamActive : !x.e.team));

  const scores = useMemo(
    () =>
      equipes.map((t) => ({
        name: t,
        buts: rows
          .filter((x) => x.e.team === t)
          .reduce((s, x) => s + x.e.buts + (x.e.teamScoreBonus ?? 0), 0),
      })),
    [equipes, rows]
  );

  function set(index: number, patch: Partial<MatchEntry>, label: string) {
    commit(updateEntryAt(saison, index, patch), label);
  }

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
            <option key={m.j} value={m.j} className="bg-[#141414] text-white">
              Journée {m.j} · {m.date}
            </option>
          ))}
        </select>
        <div className="glass flex min-w-0 flex-1 items-center justify-center gap-3 rounded-full px-4 py-2">
          {scores.length === 0 ? (
            <span className="text-[12.5px] text-foreground/40">Pas encore d&apos;équipes</span>
          ) : (
            scores.map((s, i) => (
              <span key={s.name} className="flex items-center gap-2">
                {i > 0 && <span className="text-foreground/25">—</span>}
                <span
                  className="size-2 rounded-full"
                  style={{ background: TEAM_COLORS[s.name] ?? "#ddd" }}
                />
                <span className="text-[17px] font-extrabold tabular-nums">{s.buts}</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* L'équipe qu'on suit */}
      {equipes.length > 1 && (
        <div className="glass flex w-full rounded-full p-1">
          {equipes.map((t) => (
            <button
              key={t}
              onClick={() => setTeam(t)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-semibold transition-colors",
                teamActive === t ? "bg-foreground text-background" : "text-foreground/45"
              )}
            >
              <span
                className="size-2 rounded-full"
                style={{ background: TEAM_COLORS[t] ?? "#ddd" }}
              />
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Les joueurs */}
      {visibles.length === 0 ? (
        <div className="glass rounded-[22px] px-6 py-10 text-center text-[13px] text-foreground/45">
          Aucun joueur sur cette feuille. Compose la journée dans l&apos;onglet Saisie, puis
          reviens ici pour le direct.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visibles.map(({ e, index }) => {
            const bonusDefensif =
              Math.floor((e.arrets ?? 0) / 2) + Math.floor((e.interceptions ?? 0) / 2);
            return (
              <div key={index} className="glass rounded-[22px] px-3.5 pt-3 pb-3.5">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight">
                    {e.player}
                  </span>
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
                          "rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-colors",
                          on
                            ? "bg-primary text-primary-foreground"
                            : "glass-soft text-foreground/40"
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

      <p className="px-1 text-[12px] leading-relaxed text-foreground/35">
        Chaque geste est enregistré tout de suite et annulable (⌘Z). Deux arrêts ou deux
        interceptions valent 1 point Pépite — le compteur « défensif » à droite du nom le montre
        dès qu&apos;il tombe.
      </p>
    </div>
  );
}
