"use client";

// Assistant « Nouvelle journée » : sélection rapide des présents (coches,
// tout sélectionner/désélectionner), choix du nombre d'équipes, génération
// d'équipes équilibrées selon l'OVR des cartes, relance, puis création de la
// journée complète (une ligne par joueur, équipes pré-remplies).

import { useMemo, useState } from "react";
import { Dices, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  generateBalancedTeams,
  TEAM_PRESETS,
  type BalancedPlayer,
  type BalancedTeam,
} from "@/lib/sfl/saisie/mutations";

const TEAM_COLORS: Record<string, string> = {
  Orange: "#F9CB9C",
  Bleu: "#C9DAF8",
  Vert: "#D9EAD3",
  Jaune: "#FFF2CC",
  Rouge: "#F4CCCC",
  Gris: "#CCCCCC",
};

export function NewJourneeSheet({
  open,
  onOpenChange,
  roster,
  initialChecked = [],
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Joueurs sélectionnables (nom + OVR de la carte + dispo). */
  roster: { name: string; ovr: number; actif: boolean }[];
  /** Pré-cochés à l'ouverture (ex. confirmés de la convocation). */
  initialChecked?: string[];
  onCreate: (teams: BalancedTeam[]) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initialChecked));
  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<BalancedTeam[] | null>(null);

  const selectable = useMemo(() => roster.filter((r) => r.actif), [roster]);
  const allSelected = checked.size === selectable.length && selectable.length > 0;

  function toggle(name: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setTeams(null);
  }

  function toggleAll() {
    setChecked(allSelected ? new Set() : new Set(selectable.map((r) => r.name)));
    setTeams(null);
  }

  function generate() {
    const players: BalancedPlayer[] = roster
      .filter((r) => checked.has(r.name))
      .map((r) => ({ name: r.name, ovr: r.ovr }));
    setTeams(generateBalancedTeams(players, teamCount, TEAM_PRESETS));
  }

  function reset() {
    setChecked(new Set(initialChecked));
    setTeams(null);
    setTeamCount(2);
  }

  const perTeam = checked.size > 0 ? Math.floor(checked.size / teamCount) : 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="px-1">
          <SheetTitle className="text-xl">Nouvelle journée</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-1 pb-8">
          {/* Étape 1 — présents */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Users className="size-4" /> Présents
                <span className="text-muted-foreground tabular-nums">({checked.size})</span>
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[13px] font-semibold text-primary"
              >
                {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {roster.map((r) => {
                const on = checked.has(r.name);
                return (
                  <button
                    key={r.name}
                    type="button"
                    disabled={!r.actif}
                    onClick={() => toggle(r.name)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-left text-[13px] font-medium transition-colors",
                      !r.actif && "opacity-35",
                      on
                        ? "border-primary bg-primary/10"
                        : "border-border/60 bg-card hover:bg-secondary"
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-[5px] border text-[9px] font-black",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        )}
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{r.ovr}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Étape 2 — nombre d'équipes */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Équipes</span>
            <div className="flex gap-1">
              {[2, 4, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setTeamCount(n);
                    setTeams(null);
                  }}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                    teamCount === n
                      ? "bg-foreground text-background"
                      : "bg-card text-muted-foreground"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Étape 3 — génération équilibrée */}
          <Button
            variant="secondary"
            disabled={checked.size < teamCount}
            onClick={generate}
            className="font-semibold"
          >
            <Dices className="mr-1.5 size-4" />
            {teams ? "Regénérer les équipes" : "Générer des équipes équilibrées"}
          </Button>
          {checked.size > 0 && checked.size < teamCount && (
            <p className="-mt-2 text-center text-xs text-destructive">
              Il faut au moins {teamCount} joueurs pour {teamCount} équipes.
            </p>
          )}
          {checked.size >= teamCount && !teams && (
            <p className="-mt-2 text-center text-xs text-muted-foreground">
              ~{perTeam} joueurs par équipe, équilibrés selon l&apos;OVR des cartes.
            </p>
          )}

          {teams && (
            <div className="grid grid-cols-2 gap-2">
              {teams.map((t) => (
                <div key={t.name} className="rounded-2xl bg-secondary/40 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-bold">
                      <span
                        className="size-2.5 rounded-full ring-1 ring-black/10"
                        style={{ background: TEAM_COLORS[t.name] ?? "#ddd" }}
                      />
                      {t.name}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                      Ø {t.players.length ? Math.round(t.totalOvr / t.players.length) : 0} OVR
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {t.players.map((p) => (
                      <div key={p.name} className="flex items-center justify-between text-[13px]">
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{p.ovr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Étape 4 — création */}
          <Button
            disabled={!teams}
            onClick={() => teams && onCreate(teams)}
            className="font-semibold"
          >
            Créer la journée ({checked.size} joueurs)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
