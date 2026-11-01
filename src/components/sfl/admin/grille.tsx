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
//   · tout est annulable (⌘Z / ⌘⇧Z), y compris une suppression.
//
// Ce qu'elle ne fait plus (30/10/2026, après les matchs 5 et 6 de la J3) :
// « Ajouter une équipe » (6 noms par ordre alphabétique d'un toucher),
// Dupliquer et ⌘D (le même joueur deux fois), le « match de plus » offert
// dans chaque sélecteur d'équipe. Un match ne naît que par « + Match N »,
// vide ; « + Ligne » ouvre le choix d'un joueur qui n'est pas encore sur la
// feuille — de TOUTE la journée, jamais du filtre affiché ; le sélecteur
// Joueur d'une ligne ne propose que l'effectif qui joue, moins la feuille.
// Elle s'ouvre sur la prochaine journée à jouer, jamais la dernière jouée.
//
// Le composant ne stocke rien : il reçoit la saison et remonte chaque
// modification par `commit`, qui empile l'historique côté tableau de bord.

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeJournees, entryPP } from "@/lib/sfl/saisie/engine";
import {
  addEntry,
  ajouterMatch,
  deleteEntryAt,
  matchsDeclares,
  newEntry,
  updateEntryAt,
} from "@/lib/sfl/saisie/mutations";
import { choixDEquipe } from "@/lib/sfl/saisie/equipes";
import { effectifJouable, placementsDeLaJournee, surLaFeuille } from "@/lib/sfl/saisie/effectif";
import { estBrouillon } from "@/lib/sfl/saisie/brouillon";
import { prochaineJournee } from "@/lib/sfl/saisie/etat-journee";
import { TERRAINS_MAX } from "@/lib/sfl/equipes-division";
import { ChoisirJoueurs } from "@/components/sfl/admin/choisir-joueurs";
import { PointMaillot } from "@/components/sfl/point-maillot";
import type { MatchEntry, Saison } from "@/lib/sfl/saisie/types";
import { suspendusPour } from "@/lib/sfl/cartons";

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
  // Ses options dépendent de la journée : ses Noirs et ses Blancs, match par
  // match, et un match de plus (saisie/equipes.ts) ; posées par la grille.
  { id: "team", label: "Équipe", type: "enum", width: 84 },
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
    title: "Xtratime — un joueur qui a déjà joué complète cette équipe : ses buts comptent pour le score, pas pour lui ; +1 s'il marque ou fait une passe D, ni stats ni journée de plus",
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
const FIGE = "sticky z-10 bg-[#f1f2ef] dark:bg-[#131313]";
const GAUCHE_NUM = { left: 0 } as const;
const GAUCHE_JOUEUR = { left: 30 } as const;
// Les PP se figent juste à gauche de la colonne d'actions, elle-même figée :
// les deux restent lisibles quel que soit le défilement.
const DROITE_PP = { right: 22 } as const;
const DROITE_ACTIONS = { right: 0 } as const;

/* -------------------------------- cellules ------------------------------- */

const cellBase =
  "h-[30px] w-full rounded-[7px] border border-transparent bg-transparent px-1.5 text-petit " +
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
        <option key={o.value} value={o.value} className="bg-white text-[#08090b] dark:bg-[#141414] dark:text-white">
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
  /** Supprime une ligne en gardant de quoi l'annuler (bandeau « Annuler », corbeille). */
  supprimerLigne?: (index: number, ligne: MatchEntry) => void;
}

export function GrilleSaisie({ saison, commit, supprimerLigne }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const journees = useMemo(() => [...saison.journees].sort((a, b) => b.j - a.j), [saison.journees]);
  // La prochaine journée à jouer (ou celle du jour) ; à défaut, la dernière.
  const [j, setJ] = useState<number>(() => prochaineJournee(saison, new Date()) ?? journees[0]?.j ?? 1);
  const [q, setQ] = useState("");
  const [choisir, setChoisir] = useState(false);
  const [aide, setAide] = useState(false);

  // L'effectif qui joue (jamais un membre qui ne joue pas, ni un arbitre).
  const rosterNames = useMemo(() => effectifJouable(saison).map((r) => r.name), [saison]);
  // Déjà sur la feuille : toute la journée, jamais le seul filtre affiché.
  const deja = useMemo(() => surLaFeuille(saison, j), [saison, j]);
  const declares = useMemo(() => matchsDeclares(saison, j), [saison, j]);
  const places = useMemo(() => placementsDeLaJournee(saison, j, declares), [saison, j, declares]);

  // On garde l'INDEX réel dans saison.entries : c'est lui que les mutations
  // attendent. Filtrer ne doit jamais faire perdre la trace de la ligne.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return saison.entries
      .map((e, index) => ({ e, index }))
      .filter((x) => x.e.j === j)
      .filter((x) => !needle || x.e.player.toLowerCase().includes(needle));
  }, [saison.entries, j, q]);

  // Les équipes qu'une ligne peut prendre : celles des matchs qui existent
  // dans la journée, match par match (y compris un match encore vide).
  const choix = useMemo(() => {
    const noms = [...new Set(saison.entries.filter((e) => e.j === j && e.team).map((e) => e.team as string))];
    return choixDEquipe(computeJournees(saison).find((x) => x.j === j), noms, declares);
  }, [saison, j, declares]);
  const optionsEquipe = useMemo(
    () => [{ value: "", label: "—" }, ...choix.map((t) => ({ value: t.nom, label: t.court }))],
    [choix]
  );

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
    // Dans l'ordre des matchs : les Noirs, puis les Blancs.
    return choix
      .filter((t) => map.has(t.nom))
      .map((t) => ({ ...t, ...map.get(t.nom)! }));
  }, [rows, choix]);

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
    }
  }

  // L'aide-mémoire des raccourcis ne s'ouvre que sur « ? ».
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "?" || t?.closest("input, textarea, select")) return;
      setAide((a) => !a);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const libres = rosterNames.filter((n) => !deja.has(n.trim().toLowerCase()));

  function ajouterLigne(nom: string) {
    commit(addEntry(saison, { ...newEntry(j, nom, null), sflTime: false }), `Ligne ajoutée — ${nom}`);
  }

  function ajouterUnMatch() {
    const fait = ajouterMatch(saison, j, {}, TERRAINS_MAX);
    commit(fait.saison, `Match ${fait.n} ajouté`);
  }

  const meta = saison.journees.find((m) => m.j === j);

  return (
    <div className="flex flex-col gap-3">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={j}
          onChange={(e) => setJ(Number(e.target.value))}
          className="glass-soft h-9 cursor-pointer rounded-full px-3.5 text-corps font-bold outline-none"
        >
          {journees.map((m) => (
            <option key={m.j} value={m.j} className="bg-white text-[#08090b] dark:bg-[#141414] dark:text-white">
              {estBrouillon(m) ? "○ " : ""}Journée {m.j} · {m.date}
              {estBrouillon(m) ? " · brouillon" : ""}
            </option>
          ))}
        </select>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer un joueur…"
          className="glass-soft h-9 min-w-0 flex-1 rounded-full px-4 text-corps outline-none placeholder:text-encre-4"
        />

        <button
          onClick={() => setChoisir(true)}
          disabled={libres.length === 0}
          className="bouton-principal flex h-9 items-center gap-1.5 px-3.5 text-corps font-bold disabled:opacity-40"
        >
          <Plus className="size-3.5" /> Ligne
        </button>
        <button
          onClick={ajouterUnMatch}
          disabled={!meta}
          className="bouton-secondaire flex h-9 items-center gap-1.5 px-3.5 text-corps font-bold disabled:opacity-40"
        >
          <Plus className="size-3.5" /> Match {declares.length + 1}
        </button>
      </div>

      <ChoisirJoueurs
        open={choisir}
        onOpenChange={setChoisir}
        saison={saison}
        titre={`Ajouter à la J${j}`}
        places={places}
        suspendus={suspendusPour(saison, j)}
        onChoisir={ajouterLigne}
      />

      {/* La feuille */}
      <div className="glass overflow-hidden rounded-[18px]">
        <div className="overflow-x-auto overscroll-x-contain">
          <div style={{ minWidth: TOTAL_WIDTH }} ref={grid} onKeyDown={onGridKeyDown}>
            {/* En-tête */}
            <div className="flex items-center border-b border-contraste/10 bg-[#eceee9] py-2 pr-1.5 dark:bg-[#141414]">
              <span
                className={cn(FIGE, "mono-label w-[30px] shrink-0 text-center text-encre-4")}
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
                      "mono-label shrink-0 px-1.5 text-encre-4",
                      fige && FIGE,
                      c.id === "player" && "border-r border-contraste/8",
                      c.id === "pp" && "border-l border-contraste/8 text-center text-primary"
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
                    "flex items-center border-b border-contraste/5 py-[3px] pr-1.5 last:border-0",
                    e.extraTime && "bg-contraste/[0.02]",
                    e.statut !== "Présent" && !e.extraTime && "opacity-55"
                  )}
                >
                  <span
                    className={cn(
                      FIGE,
                      "mono-label w-[30px] shrink-0 text-center text-encre-4 tabular-nums"
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
                            "shrink-0 border-l border-contraste/8 px-1.5 text-center text-petit font-extrabold tabular-nums"
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
                          className={cn(FIGE, "shrink-0 border-r border-contraste/8 px-0.5")}
                        >
                          <Enum
                            {...nav}
                            value={e.player}
                            // L'effectif qui joue, moins la feuille, plus le joueur de la ligne.
                            options={[e.player, ...libres.filter((n) => n !== e.player)].map((n) => ({ value: n, label: n }))}
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
                            options={c.id === "team" ? optionsEquipe : c.options!}
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
                        supprimerLigne
                          ? supprimerLigne(row.index, e)
                          : commit(deleteEntryAt(saison, row.index), `Ligne supprimée — ${e.player}`)
                      }
                      title="Supprimer"
                      className="text-foreground/20 transition-colors hover:text-[#c8352b] dark:hover:text-[#FF6B5E]"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                </div>
              );
            })}

            {rows.length === 0 && (
              <p className="mono-label px-4 py-10 text-center text-encre-3">
                J{j} · 0 ligne{q && ` · « ${q} »`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Les totaux — les lignes TOTAL du classeur, mais toujours justes */}
      <div className="flex flex-wrap items-center gap-2">
        {equipes.map((t) => (
          <span
            key={t.nom}
            className="glass-soft flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-petit"
          >
            <strong className="flex items-center gap-1.5 self-center font-bold">
              {t.camp && <PointMaillot camp={t.camp} className="size-2" />}
              {t.libelle}
            </strong>
            <span className="tabular-nums text-encre-3">
              {t.buts} but{t.buts > 1 ? "s" : ""} · {t.passes} passe{t.passes > 1 ? "s" : ""} ·{" "}
              {t.joueurs} joueur{t.joueurs > 1 ? "s" : ""}
            </span>
          </span>
        ))}
        <span className="glass-soft ml-auto rounded-full px-3 py-1.5 text-petit font-bold tabular-nums">
          {rows.length} ligne{rows.length > 1 ? "s" : ""} · {ppTotal} PP
        </span>
      </div>

      {/* L'aide-mémoire des raccourcis : seulement sur « ? » */}
      {aide && (
        <div className="glass-soft rounded-[18px] px-4 py-3">
          <p className="mono-label text-encre-4">Raccourcis</p>
          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-petit text-encre-3 sm:grid-cols-2">
            {(
              [
                ["Entrée · ↓ · ↑", "ligne suivante / précédente"],
                ["Tab · ⇧Tab", "colonne suivante / précédente"],
                ["Espace", "cocher"],
                ["+ · −", "un de plus / un de moins"],
                ["⌘Z · ⌘⇧Z", "annuler / rétablir"],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2">
                <kbd className="shrink-0 rounded-md border border-contraste/12 bg-contraste/6 px-1.5 py-0.5 font-mono text-legende text-encre-2">
                  {k}
                </kbd>
                <span className="min-w-0">{v}</span>
              </div>
            ))}
          </div>
          {meta && <p className="mono-label mt-2.5 border-t border-contraste/8 pt-2.5 text-encre-3">J{meta.j} · {meta.date} · XT = Xtratime · 2 arrêts = 1 PP · 2 interc. = 1 PP</p>}
        </div>
      )}
    </div>
  );
}
