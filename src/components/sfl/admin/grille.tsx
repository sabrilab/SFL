"use client";

// La grille de saisie — l'onglet SAISIE MATCH du classeur, en mieux.
//
// Une ligne = un joueur pour une journée, exactement comme dans le fichier.
// Les mêmes colonnes, dans le même ordre, plus celles qui manquaient :
// Xtratime, arrêts et interceptions. La colonne PP se recalcule à chaque
// frappe — c'est la formule du classeur, mais vivante.
//
// Ce qu'un tableur ne fait pas et qu'on fait ici :
//   · les booléens sont des cases qu'on coche à la barre d'espace, pas des
//     « Oui » à retaper ;
//   · un chiffre s'incrémente au « + » et se décrémente au « − », sans
//     sélectionner la cellule ni retaper la valeur ;
//   · Entrée et les flèches descendent d'une ligne dans la MÊME colonne,
//     Tab passe à la colonne suivante — on saisit une colonne entière sans
//     jamais lâcher le clavier ;
//   · dupliquer une ligne (⌘D) reprend l'équipe, le statut et le résultat :
//     composer une équipe de six, c'est une ligne saisie puis cinq copies ;
//   · tout est annulable (⌘Z / ⌘⇧Z), y compris une suppression.
//
// Le composant ne stocke rien : il reçoit la saison et remonte chaque
// modification par `commit`, qui empile l'historique côté tableau de bord.

import { useMemo, useRef, useState } from "react";
import { Copy, Plus, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { entryPP } from "@/lib/sfl/saisie/engine";
import {
  addEntry,
  deleteEntryAt,
  duplicateEntryAt,
  newEntry,
  updateEntryAt,
  TEAM_PRESETS,
} from "@/lib/sfl/saisie/mutations";
import type { MatchEntry, Saison } from "@/lib/sfl/saisie/types";

/* ------------------------------- colonnes -------------------------------- */

type ColType = "player" | "enum" | "num" | "bool" | "calc";

interface Col {
  id: string;
  label: string;
  /** Libellé long, en info-bulle. */
  title?: string;
  type: ColType;
  width: number;
  /** Options pour les colonnes à choix. */
  options?: { value: string; label: string }[];
}

const STATUTS = [
  "Présent",
  "Absent justifié",
  "Absence injustifiée",
  "Blessure",
  "Suspendu",
] as const;

const COLS: Col[] = [
  { id: "player", label: "Joueur", type: "player", width: 132 },
  {
    id: "team",
    label: "Équipe",
    type: "enum",
    width: 84,
    options: [
      { value: "", label: "—" },
      ...TEAM_PRESETS.map((t) => ({ value: t, label: t })),
    ],
  },
  {
    id: "statut",
    label: "Statut",
    type: "enum",
    width: 104,
    options: STATUTS.map((s) => ({ value: s, label: s })),
  },
  {
    id: "result",
    label: "Résultat",
    type: "enum",
    width: 88,
    options: [
      { value: "", label: "—" },
      { value: "Victoire", label: "Victoire" },
      { value: "Nul", label: "Nul" },
      { value: "Défaite", label: "Défaite" },
    ],
  },
  { id: "sflTime", label: "SFL", title: "SFL Time", type: "bool", width: 42 },
  { id: "buts", label: "Buts", type: "num", width: 50 },
  { id: "passes", label: "Pas.", title: "Passes décisives", type: "num", width: 50 },
  { id: "cleanSheet", label: "CS", title: "Clean sheet", type: "bool", width: 40 },
  { id: "mvp", label: "MVP", type: "bool", width: 44 },
  { id: "impact", label: "IMP", title: "Joueur Impact", type: "bool", width: 42 },
  { id: "def", label: "DÉF", title: "Figure défensive", type: "bool", width: 42 },
  { id: "retard", label: "RET", title: "Retard non prévenu", type: "bool", width: 42 },
  { id: "arrets", label: "Arr.", title: "Arrêts — 2 arrêts = 1 point Pépite", type: "num", width: 48 },
  {
    id: "interceptions",
    label: "Int.",
    title: "Interceptions — 2 interceptions = 1 point Pépite",
    type: "num",
    width: 48,
  },
  {
    id: "extraTime",
    label: "XT",
    title: "Xtratime — n'ouvre ni présence ni match, seuls la mention et le bonus comptent",
    type: "bool",
    width: 40,
  },
  { id: "pepiteBonus", label: "Bon.", title: "Points Pépite manuels", type: "num", width: 48 },
  { id: "note", label: "Mention", type: "enum", width: 96, options: [
    { value: "", label: "—" },
    { value: "Extra time", label: "Extra time" },
    { value: "Coach", label: "Coach" },
    { value: "Gardien", label: "Gardien" },
  ] },
  { id: "pp", label: "PP", title: "Points Pépite de la ligne (calculé)", type: "calc", width: 46 },
];

const TOTAL_WIDTH = COLS.reduce((a, c) => a + c.width, 0) + 46;

// Volets figés : le joueur reste visible à gauche, les PP à droite, pendant
// qu'on fait défiler les colonnes du milieu. C'est le « figer les volets » du
// tableur, sans avoir à le demander.
const FIGE = "sticky z-10 bg-[#131313]";
const GAUCHE_NUM = { left: 0 } as const;
const GAUCHE_JOUEUR = { left: 30 } as const;
// Les PP se figent juste à gauche de la colonne d'actions, elle-même figée :
// les deux restent lisibles quel que soit le défilement.
const DROITE_PP = { right: 22 } as const;
const DROITE_ACTIONS = { right: 0 } as const;

/* -------------------------------- cellules ------------------------------- */

const cellBase =
  "h-[30px] w-full rounded-[7px] border border-transparent bg-transparent px-1.5 text-[12px] " +
  "outline-none transition-colors focus:border-primary/60 focus:bg-primary/8";

function Bool({
  on,
  onToggle,
  ...nav
}: { on: boolean; onToggle: () => void } & Record<string, unknown>) {
  return (
    <button
      {...nav}
      onClick={onToggle}
      onKeyDown={(e) => {
        // Espace coche, comme dans une liste — Entrée reste la descente de ligne.
        if (e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        cellBase,
        "flex items-center justify-center font-bold",
        on ? "text-primary" : "text-foreground/18"
      )}
    >
      {on ? "✓" : "·"}
    </button>
  );
}

function Num({
  value,
  onSet,
  ...nav
}: { value: number; onSet: (n: number) => void } & Record<string, unknown>) {
  return (
    <input
      {...nav}
      inputMode="numeric"
      value={value === 0 ? "" : String(value)}
      placeholder="0"
      onChange={(e) => {
        const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
        onSet(Number.isFinite(n) ? Math.min(99, n) : 0);
      }}
      onKeyDown={(e) => {
        // « + » et « − » sans jamais quitter la cellule ni retaper la valeur.
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          onSet(Math.min(99, value + 1));
        } else if (e.key === "-") {
          e.preventDefault();
          onSet(Math.max(0, value - 1));
        }
      }}
      className={cn(cellBase, "text-center font-semibold tabular-nums")}
    />
  );
}

function Enum({
  value,
  options,
  onSet,
  ...nav
}: {
  value: string;
  options: { value: string; label: string }[];
  onSet: (v: string) => void;
} & Record<string, unknown>) {
  return (
    <select
      {...nav}
      value={value}
      onChange={(e) => onSet(e.target.value)}
      className={cn(cellBase, "cursor-pointer appearance-none font-medium")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#141414] text-white">
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* --------------------------------- grille -------------------------------- */

interface Props {
  saison: Saison;
  commit: (next: Saison, label: string) => void;
}

export function GrilleSaisie({ saison, commit }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const journees = useMemo(() => [...saison.journees].sort((a, b) => b.j - a.j), [saison.journees]);
  const [j, setJ] = useState<number>(() => journees[0]?.j ?? 1);
  const [q, setQ] = useState("");

  const rosterNames = useMemo(
    () => [...saison.roster.map((r) => r.name)].sort((a, b) => a.localeCompare(b, "fr")),
    [saison.roster]
  );

  // On garde l'INDEX réel dans saison.entries : c'est lui que les mutations
  // attendent. Filtrer ne doit jamais faire perdre la trace de la ligne.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return saison.entries
      .map((e, index) => ({ e, index }))
      .filter((x) => x.e.j === j)
      .filter((x) => !needle || x.e.player.toLowerCase().includes(needle));
  }, [saison.entries, j, q]);

  // Les totaux d'équipe du bas de feuille, comme les lignes TOTAL du classeur.
  const equipes = useMemo(() => {
    const map = new Map<string, { buts: number; passes: number; joueurs: number }>();
    for (const { e } of rows) {
      if (!e.team) continue;
      const cur = map.get(e.team) ?? { buts: 0, passes: 0, joueurs: 0 };
      cur.buts += e.buts + (e.teamScoreBonus ?? 0);
      cur.passes += e.passes;
      cur.joueurs += e.extraTime ? 0 : 1;
      map.set(e.team, cur);
    }
    return [...map.entries()];
  }, [rows]);

  const ppTotal = rows.reduce((s, x) => s + entryPP(x.e), 0);

  function patch(index: number, p: Partial<MatchEntry>, label: string) {
    commit(updateEntryAt(saison, index, p), label);
  }

  /** Déplace le curseur d'une ligne, dans la même colonne. */
  function move(r: number, c: number, dr: number) {
    const target = grid.current?.querySelector<HTMLElement>(
      `[data-r="${r + dr}"][data-c="${c}"]`
    );
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    const el = e.target as HTMLElement;
    const r = Number(el.dataset?.r);
    const c = Number(el.dataset?.c);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return;

    if (e.key === "ArrowDown" || (e.key === "Enter" && !e.shiftKey)) {
      e.preventDefault();
      move(r, c, 1);
    } else if (e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey)) {
      e.preventDefault();
      move(r, c, -1);
    } else if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
      // ⌘D : la ligne d'à côté, déjà remplie — l'équipe se saisit en six frappes.
      e.preventDefault();
      const row = rows[r];
      if (row) commit(duplicateEntryAt(saison, row.index), `Ligne dupliquée — ${row.e.player}`);
    }
  }

  function ajouterLigne(team: string | null = null) {
    const libre = rosterNames.find((n) => !rows.some((x) => x.e.player === n)) ?? rosterNames[0];
    if (!libre) return;
    commit(addEntry(saison, { ...newEntry(j, libre, team), sflTime: false }), "Ligne ajoutée");
  }

  /** Le geste du dimanche : poser une équipe entière d'un coup. */
  function ajouterEquipe(team: string) {
    let next = saison;
    const deja = new Set(rows.map((x) => x.e.player));
    const libres = rosterNames.filter((n) => !deja.has(n)).slice(0, 6);
    for (const name of libres) next = addEntry(next, newEntry(j, name, team));
    commit(next, `Équipe ${team} ajoutée`);
  }

  const meta = saison.journees.find((m) => m.j === j);

  return (
    <div className="flex flex-col gap-3">
      {/* Barre d'outils */}
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

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer un joueur…"
          className="glass-soft h-9 min-w-0 flex-1 rounded-full px-4 text-[13px] outline-none placeholder:text-foreground/30"
        />

        <button
          onClick={() => ajouterLigne()}
          className="flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-[13px] font-bold text-background"
        >
          <Plus className="size-3.5" /> Ligne
        </button>
      </div>

      {/* Poser une équipe entière */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mono-label text-foreground/30">Ajouter une équipe</span>
        {TEAM_PRESETS.map((t) => (
          <button
            key={t}
            onClick={() => ajouterEquipe(t)}
            className="glass-soft flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-foreground/65"
          >
            <Users className="size-3" />
            {t}
          </button>
        ))}
      </div>

      {/* La feuille */}
      <div className="glass overflow-hidden rounded-[18px]">
        <div className="overflow-x-auto overscroll-x-contain">
          <div style={{ minWidth: TOTAL_WIDTH }} ref={grid} onKeyDown={onGridKeyDown}>
            {/* En-tête */}
            <div className="flex items-center border-b border-white/10 bg-[#141414] py-2 pr-1.5">
              <span
                className={cn(FIGE, "mono-label w-[30px] shrink-0 text-center text-foreground/25")}
                style={GAUCHE_NUM}
              >
                #
              </span>
              {COLS.map((c) => {
                const fige = c.id === "player" || c.id === "pp";
                return (
                  <span
                    key={c.id}
                    title={c.title ?? c.label}
                    className={cn(
                      "mono-label shrink-0 px-1.5 text-foreground/35",
                      fige && FIGE,
                      c.id === "player" && "border-r border-white/8",
                      c.id === "pp" && "border-l border-white/8 text-center text-primary"
                    )}
                    style={{
                      width: c.width,
                      ...(c.id === "player" ? GAUCHE_JOUEUR : c.id === "pp" ? DROITE_PP : {}),
                    }}
                  >
                    {c.label}
                  </span>
                );
              })}
              <span className={cn(FIGE, "w-[22px] shrink-0")} style={DROITE_ACTIONS} />
            </div>

            {/* Lignes */}
            {rows.map((row, r) => {
              const e = row.e;
              const pp = entryPP(e);
              return (
                <div
                  key={row.index}
                  className={cn(
                    "flex items-center border-b border-white/5 py-[3px] pr-1.5 last:border-0",
                    e.extraTime && "bg-white/[0.02]",
                    e.statut !== "Présent" && !e.extraTime && "opacity-55"
                  )}
                >
                  <span
                    className={cn(
                      FIGE,
                      "mono-label w-[30px] shrink-0 text-center text-foreground/25 tabular-nums"
                    )}
                    style={GAUCHE_NUM}
                  >
                    {r + 1}
                  </span>

                  {COLS.map((c, ci) => {
                    const nav = { "data-r": r, "data-c": ci };
                    const w = { width: c.width };

                    if (c.id === "pp") {
                      return (
                        <span
                          key={c.id}
                          style={{ ...w, ...DROITE_PP }}
                          className={cn(
                            FIGE,
                            "shrink-0 border-l border-white/8 px-1.5 text-center text-[12px] font-extrabold tabular-nums"
                          )}
                        >
                          {pp}
                        </span>
                      );
                    }

                    if (c.type === "player") {
                      return (
                        <span
                          key={c.id}
                          style={{ ...w, ...GAUCHE_JOUEUR }}
                          className={cn(FIGE, "shrink-0 border-r border-white/8 px-0.5")}
                        >
                          <Enum
                            {...nav}
                            value={e.player}
                            options={rosterNames.map((n) => ({ value: n, label: n }))}
                            onSet={(v) => patch(row.index, { player: v }, `Joueur — ${v}`)}
                          />
                        </span>
                      );
                    }

                    if (c.type === "enum") {
                      const raw =
                        c.id === "team"
                          ? (e.team ?? "")
                          : c.id === "result"
                            ? (e.result ?? "")
                            : c.id === "note"
                              ? (e.note ?? "")
                              : e.statut;
                      return (
                        <span key={c.id} style={w} className="shrink-0 px-0.5">
                          <Enum
                            {...nav}
                            value={raw}
                            options={c.options!}
                            onSet={(v) => {
                              const p =
                                c.id === "team"
                                  ? { team: v || null }
                                  : c.id === "result"
                                    ? { result: (v || null) as MatchEntry["result"] }
                                    : c.id === "note"
                                      ? { note: v || undefined }
                                      : { statut: v as MatchEntry["statut"] };
                              patch(row.index, p, `${c.label} — ${e.player}`);
                            }}
                          />
                        </span>
                      );
                    }

                    if (c.type === "num") {
                      const value = (e[c.id as keyof MatchEntry] as number | undefined) ?? 0;
                      return (
                        <span key={c.id} style={w} className="shrink-0 px-0.5">
                          <Num
                            {...nav}
                            value={value}
                            onSet={(n) =>
                              patch(row.index, { [c.id]: n } as Partial<MatchEntry>, `${c.label} — ${e.player}`)
                            }
                          />
                        </span>
                      );
                    }

                    const on = !!e[c.id as keyof MatchEntry];
                    return (
                      <span key={c.id} style={w} className="shrink-0 px-0.5">
                        <Bool
                          {...nav}
                          on={on}
                          onToggle={() =>
                            patch(
                              row.index,
                              { [c.id]: !on } as Partial<MatchEntry>,
                              `${c.label} — ${e.player}`
                            )
                          }
                        />
                      </span>
                    );
                  })}

                  {/* Actions de ligne */}
                  <span
                    className={cn(FIGE, "flex w-[22px] shrink-0 flex-col items-center")}
                    style={DROITE_ACTIONS}
                  >
                    <button
                      onClick={() =>
                        commit(duplicateEntryAt(saison, row.index), `Ligne dupliquée — ${e.player}`)
                      }
                      title="Dupliquer (⌘D)"
                      className="text-foreground/20 transition-colors hover:text-foreground/60"
                    >
                      <Copy className="size-3" />
                    </button>
                    <button
                      onClick={() => commit(deleteEntryAt(saison, row.index), `Ligne supprimée — ${e.player}`)}
                      title="Supprimer"
                      className="text-foreground/20 transition-colors hover:text-[#FF6B5E]"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                </div>
              );
            })}

            {rows.length === 0 && (
              <p className="px-4 py-10 text-center text-[13px] text-foreground/40">
                Aucune ligne pour la journée {j}
                {q && ` avec « ${q} »`}. Pose une équipe entière ci-dessus, puis corrige.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Les totaux — les lignes TOTAL du classeur, mais toujours justes */}
      <div className="flex flex-wrap items-center gap-2">
        {equipes.map(([name, t]) => (
          <span
            key={name}
            className="glass-soft flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-[12px]"
          >
            <strong className="font-bold">{name}</strong>
            <span className="tabular-nums text-foreground/45">
              {t.buts} but{t.buts > 1 ? "s" : ""} · {t.passes} passe{t.passes > 1 ? "s" : ""} ·{" "}
              {t.joueurs} joueur{t.joueurs > 1 ? "s" : ""}
            </span>
          </span>
        ))}
        <span className="glass-soft ml-auto rounded-full px-3 py-1.5 text-[12px] font-bold tabular-nums">
          {rows.length} ligne{rows.length > 1 ? "s" : ""} · {ppTotal} PP
        </span>
      </div>

      {/* L'aide-mémoire des raccourcis */}
      <div className="glass-soft rounded-[18px] px-4 py-3">
        <p className="mono-label text-foreground/35">Raccourcis</p>
        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] text-foreground/50 sm:grid-cols-2">
          {(
            [
              ["Entrée · ↓ · ↑", "descendre / remonter d'une ligne, même colonne"],
              ["Tab · ⇧Tab", "colonne suivante / précédente"],
              ["Espace", "cocher une case (SFL, CS, MVP, XT…)"],
              ["+ · −", "incrémenter un chiffre sans le retaper"],
              ["⌘D", "dupliquer la ligne (équipe, statut, résultat compris)"],
              ["⌘Z · ⌘⇧Z", "annuler / rétablir"],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2">
              <kbd className="shrink-0 rounded-md border border-white/12 bg-white/6 px-1.5 py-0.5 font-mono text-[10.5px] text-foreground/70">
                {k}
              </kbd>
              <span className="min-w-0">{v}</span>
            </div>
          ))}
        </div>
        {meta && (
          <p className="mt-2.5 border-t border-white/8 pt-2.5 text-[12px] text-foreground/40">
            Journée {meta.j} du {meta.date}. Une ligne <strong>Xtratime</strong> n&apos;ouvre ni
            présence ni match : seuls sa mention et son bonus comptent. Chaque paire
            d&apos;arrêts et chaque paire d&apos;interceptions vaut 1 point Pépite.
          </p>
        )}
      </div>
    </div>
  );
}
