"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { TEAM_PRESETS } from "@/lib/sfl/saisie/mutations";
import type {
  MatchEntry,
  MatchResult,
  PlayerStatutSaisie,
} from "@/lib/sfl/saisie/types";

const STATUTS: PlayerStatutSaisie[] = [
  "Présent",
  "Absent justifié",
  "Absence injustifiée",
  "Blessure",
  "Suspendu",
];
const RESULTS: MatchResult[] = ["Victoire", "Défaite", "Nul"];
const NONE = "—";

export function Stepper({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Diminuer"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground active:opacity-70"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-7 text-center text-base font-bold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Augmenter"
        onClick={() => onChange(value + 1)}
        className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground active:opacity-70"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[15px] font-medium">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label}>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Row>
  );
}

/** Édition complète d'une ligne de match (une bottom-sheet). */
export function EntrySheet({
  entry,
  onOpenChange,
  onPatch,
  onDelete,
}: {
  entry: MatchEntry | null;
  onOpenChange: (open: boolean) => void;
  onPatch: (patch: Partial<MatchEntry>) => void;
  onDelete: () => void;
}) {
  const present = entry?.statut === "Présent";
  return (
    <Sheet open={!!entry} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl">
        {entry && (
          <>
            <SheetHeader className="px-1">
              <SheetTitle className="text-xl">{entry.player}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col divide-y divide-border/60 px-1 pb-6">
              <Row label="Équipe">
                <Select
                  value={entry.team ?? NONE}
                  onValueChange={(v) => onPatch({ team: v === NONE ? null : v })}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Aucune (à plat)</SelectItem>
                    {TEAM_PRESETS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>

              <Row label="Statut">
                <Select
                  value={entry.statut}
                  onValueChange={(v) => onPatch({ statut: v as PlayerStatutSaisie })}
                >
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>

              <Row label="Résultat">
                <Select
                  value={entry.result ?? NONE}
                  onValueChange={(v) => onPatch({ result: v === NONE ? null : (v as MatchResult) })}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {RESULTS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>

              <div className={cn(!present && "pointer-events-none opacity-40")}>
                <Toggle label="SFL Time" checked={entry.sflTime} onChange={(v) => onPatch({ sflTime: v })} />
                <Row label="Buts">
                  <Stepper value={entry.buts} onChange={(v) => onPatch({ buts: v })} />
                </Row>
                <Row label="Passes décisives">
                  <Stepper value={entry.passes} onChange={(v) => onPatch({ passes: v })} />
                </Row>
                <Toggle label="Clean sheet" checked={entry.cleanSheet} onChange={(v) => onPatch({ cleanSheet: v })} />
                <Toggle label="MVP du match" checked={entry.mvp} onChange={(v) => onPatch({ mvp: v })} />
                <Toggle label="Joueur Impact" checked={entry.impact} onChange={(v) => onPatch({ impact: v })} />
                <Toggle label="Défensive" checked={entry.def} onChange={(v) => onPatch({ def: v })} />
                <Toggle label="Retard non prévenu" checked={entry.retard} onChange={(v) => onPatch({ retard: v })} />
              </div>

              <Row label="Mention">
                <Input
                  value={entry.note ?? ""}
                  placeholder="ex. Extra time"
                  onChange={(e) => onPatch({ note: e.target.value || undefined })}
                  className="w-40"
                />
              </Row>

              <div className="pt-3">
                <Button
                  variant="ghost"
                  onClick={onDelete}
                  className="w-full text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 size-4" /> Retirer de la journée
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Réglages d'une journée : date, SFL Time, suppression. */
export function JourneeMetaSheet({
  meta,
  onOpenChange,
  onPatch,
  onDelete,
}: {
  meta: { j: number; date: string; sflTime: boolean } | null;
  onOpenChange: (open: boolean) => void;
  onPatch: (patch: { date?: string; sflTime?: boolean }) => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open={!!meta} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        {meta && (
          <>
            <SheetHeader className="px-1">
              <SheetTitle className="text-xl">Journée {meta.j}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col divide-y divide-border/60 px-1 pb-6">
              <Row label="Date">
                <Input
                  value={meta.date}
                  onChange={(e) => onPatch({ date: e.target.value })}
                  className="w-40"
                />
              </Row>
              <Toggle label="SFL Time" checked={meta.sflTime} onChange={(v) => onPatch({ sflTime: v })} />
              <div className="pt-3">
                <Button
                  variant="ghost"
                  onClick={onDelete}
                  className="w-full text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 size-4" /> Supprimer la journée
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Ajout d'un joueur à une journée (choix roster + équipe). */
export function AddPlayerSheet({
  open,
  onOpenChange,
  roster,
  existing,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roster: string[];
  existing: Set<string>;
  onAdd: (player: string, team: string | null) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="px-1">
          <SheetTitle className="text-xl">Ajouter un joueur</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-1 px-1 pb-8">
          {roster.map((name) => {
            const already = existing.has(name);
            return (
              <button
                key={name}
                type="button"
                disabled={already}
                onClick={() => onAdd(name, null)}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] font-medium active:bg-secondary",
                  already ? "opacity-40" : "hover:bg-secondary"
                )}
              >
                <span>{name}</span>
                {already && <span className="text-xs text-muted-foreground">déjà saisi</span>}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
