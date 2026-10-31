"use client";

import { abrege, estGardien } from "@/lib/sfl/gardien";
import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RechercheJoueur } from "@/components/sfl/admin/recherche-joueur";
import { chercherJoueurs } from "@/lib/sfl/recherche-joueur";
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
import type { EquipeDuJour } from "@/lib/sfl/saisie/equipes";
import type {
  MatchEntry,
  MatchResult,
  PlayerStatutSaisie,
  RosterEntry,
} from "@/lib/sfl/saisie/types";

const STAT_LABELS = ["VIT", "TIR", "PAS", "DRI", "DEF", "PHY"] as const;
const PROFILS = ["Actif", "Blessure", "En attente"];

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
        className="bouton-secondaire flex size-9 items-center justify-center"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-7 text-center text-base font-bold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Augmenter"
        onClick={() => onChange(value + 1)}
        className="bouton-principal flex size-9 items-center justify-center"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-lecture font-medium">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Row label={label}>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </Row>
  );
}

/** Édition complète d'une ligne de match (une bottom-sheet). */
export function EntrySheet({
  entry,
  equipes = [],
  mvpAuto = false,
  onOpenChange,
  onPatch,
  onDelete,
}: {
  entry: MatchEntry | null;
  /** Les équipes de sa journée, match par match, et celles d'un match de plus (saisie/equipes.ts). */
  equipes?: EquipeDuJour[];
  /** Journée Bola : le MVP se calcule sur les stats, il ne se coche pas. */
  mvpAuto?: boolean;
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
                    {equipes.map((t) => (
                      <SelectItem key={t.nom} value={t.nom}>{t.libelle}</SelectItem>
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
                <Toggle
                  label={mvpAuto ? "MVP du match · auto" : "MVP du match"}
                  checked={entry.mvp}
                  disabled={mvpAuto}
                  onChange={(v) => onPatch({ mvp: v })}
                />
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
                  className="bouton--rouge w-full"
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

/**
 * Réglages d'une journée : date, heure, lieu (la Map), SFL Time,
 * suppression ; et, match par match, le terrain qu'il occupe sur place, son
 * heure et son lieu quand ils ne sont pas ceux de la journée.
 */
export function JourneeMetaSheet({
  meta,
  onOpenChange,
  onPatch,
  onDelete,
  terrains = [],
  duJour = [],
  onMatch,
}: {
  meta: { j: number; date: string; sflTime: boolean; heure?: string; terrainId?: number } | null;
  onOpenChange: (open: boolean) => void;
  onPatch: (patch: { date?: string; sflTime?: boolean; heure?: string; terrainId?: number | undefined }) => void;
  onDelete: () => void;
  terrains?: { id: number; nom: string; defaut?: boolean }[];
  /** Les matchs de la journée, Match 1 d'abord ; `joueurs` : « 5 contre 5 ». */
  duJour?: { label: string; joueurs: string; heure?: string; lieuId?: number; terrain?: string }[];
  /** Règle le match n (0 pour le Match 1) ; vide, il reprend ceux de la journée. */
  onMatch?: (n: number, reglage: { heure?: string; lieuId?: number; terrain?: string }) => void;
}) {
  const lieuDuJour = meta
    ? terrains.find((t) => t.id === meta.terrainId) ?? terrains.find((t) => t.defaut)
    : undefined;
  const plusieurs = duJour.length > 1 && !!onMatch;
  return (
    <Sheet open={!!meta} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl">
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
              <Row label="Heure">
                <Input
                  value={meta.heure ?? ""}
                  placeholder="13h00"
                  onChange={(e) => onPatch({ heure: e.target.value })}
                  className="w-40"
                />
              </Row>
              {terrains.length > 0 && (
                <Row label="Lieu">
                  <select
                    value={meta.terrainId ?? ""}
                    onChange={(e) => onPatch({ terrainId: e.target.value ? Number(e.target.value) : undefined })}
                    className="h-9 w-40 rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    <option value="">Par défaut</option>
                    {terrains.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nom}
                      </option>
                    ))}
                  </select>
                </Row>
              )}
              {duJour.length === 1 && onMatch && (
                <Row label="Terrain">
                  <Input
                    value={duJour[0].terrain ?? ""}
                    placeholder="Terrain 1"
                    onChange={(e) => onMatch(0, { terrain: e.target.value })}
                    className="w-40"
                  />
                </Row>
              )}
              {plusieurs && (
                <div className="flex flex-col gap-3 py-3">
                  <span className="mono-label text-muted-foreground">Chaque match</span>
                  {duJour.map((t, n) => (
                    <div key={t.label} className="flex flex-col gap-1.5">
                      <p className="flex items-baseline justify-between gap-3">
                        <span className="text-lecture font-medium">{t.label}</span>
                        <span className="truncate text-xs text-muted-foreground">{t.joueurs}</span>
                      </p>
                      <div className="grid grid-cols-[4.75rem_5.5rem_minmax(0,1fr)] gap-2">
                        <Input
                          value={t.heure ?? ""}
                          placeholder={meta.heure || "13h00"}
                          aria-label={`Heure du ${t.label}`}
                          onChange={(e) => onMatch!(n, { heure: e.target.value })}
                        />
                        <Input
                          value={t.terrain ?? ""}
                          placeholder="Terrain"
                          aria-label={`Terrain du ${t.label}`}
                          onChange={(e) => onMatch!(n, { terrain: e.target.value })}
                        />
                        {terrains.length > 0 && (
                          <select
                            value={t.lieuId ?? ""}
                            aria-label={`Lieu du ${t.label}`}
                            onChange={(e) => onMatch!(n, { lieuId: e.target.value ? Number(e.target.value) : undefined })}
                            className="h-9 min-w-0 rounded-md border border-input bg-transparent px-2 text-sm"
                          >
                            <option value="">{lieuDuJour?.nom ?? "Lieu de la journée"}</option>
                            {terrains
                              .filter((x) => x.id !== lieuDuJour?.id)
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.nom}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Toggle label="SFL Time" checked={meta.sflTime} onChange={(v) => onPatch({ sflTime: v })} />
              <div className="pt-3">
                <Button
                  variant="ghost"
                  onClick={onDelete}
                  className="bouton--rouge w-full"
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
  const [recherche, setRecherche] = useState("");
  const trouves = chercherJoueurs(roster, (n) => n, recherche);
  const premierLibre = trouves.find((n) => !existing.has(n));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="px-1">
          <SheetTitle className="text-xl">Ajouter un joueur</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-1 px-1 pb-8">
          <RechercheJoueur
            valeur={recherche}
            onChange={setRecherche}
            resultats={trouves.length}
            autoFocus
            onEntree={() => {
              if (premierLibre) {
                onAdd(premierLibre, null);
                setRecherche("");
              }
            }}
            className="mb-2"
          />
          {trouves.map((name) => {
            const already = existing.has(name);
            return (
              <button
                key={name}
                type="button"
                disabled={already}
                onClick={() => onAdd(name, null)}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-left text-lecture font-medium active:bg-secondary",
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

/** Édition de la fiche joueur (roster) : poste, profil, stats de base. */
export function PlayerSheet({
  entry,
  onOpenChange,
  onPatch,
  onDelete,
}: {
  entry: RosterEntry | null;
  onOpenChange: (open: boolean) => void;
  onPatch: (patch: Partial<RosterEntry>) => void;
  onDelete: () => void;
}) {
  const base = entry?.base ?? [75, 75, 75, 75, 75, 75];
  const ovr = Math.ceil(base.reduce((a, b) => a + b, 0) / 6);
  const setStat = (i: number, v: number) =>
    onPatch({ base: base.map((x, idx) => (idx === i ? Math.max(0, Math.min(99, v)) : x)) });

  return (
    <Sheet open={!!entry} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl">
        {entry && (
          <>
            <SheetHeader className="px-1">
              <SheetTitle className="flex items-center gap-2 text-xl">
                {entry.name}
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold tabular-nums">
                  OVR {ovr}
                </span>
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-col divide-y divide-border/60 px-1 pb-6">
              <Row label="Poste">
                <Input
                  value={entry.poste ?? ""}
                  placeholder="ex. MC/AT"
                  onChange={(e) => onPatch({ poste: e.target.value || null })}
                  className="w-40"
                />
              </Row>
              <Row label="Profil">
                <Select value={entry.profil} onValueChange={(v) => onPatch({ profil: (v as string) ?? "Actif" })}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROFILS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 pt-2">
                {STAT_LABELS.map((label, i) => (
                  <div key={label} className="flex items-center justify-between py-1.5">
                    {/* Un gardien (poste G) est évalué sur ses stats de gardien (lib/sfl/gardien.ts). */}
                    <span className="text-corps font-semibold text-muted-foreground">{abrege(label, estGardien(entry.poste))}</span>
                    <Stepper value={base[i]} min={0} onChange={(v) => setStat(i, v)} />
                  </div>
                ))}
              </div>
              <div className="pt-3">
                <Button
                  variant="ghost"
                  onClick={onDelete}
                  className="bouton--rouge w-full"
                >
                  <Trash2 className="mr-1.5 size-4" /> Supprimer le joueur
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Création d'un joueur : saisie du nom (unicité vérifiée : l'effectif, et les joueurs Bola depuis le 28/10). */
export function NewPlayerSheet({
  open,
  onOpenChange,
  exists,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exists: (name: string) => boolean;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const taken = trimmed !== "" && exists(trimmed);
  const valid = trimmed !== "" && !taken;

  function submit() {
    if (!valid) return;
    onCreate(trimmed);
    setName("");
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setName("");
      }}
    >
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="px-1">
          <SheetTitle className="text-xl">Nouveau joueur</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-1 pb-8">
          <Input
            autoFocus
            value={name}
            placeholder="Nom du joueur"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          {taken && <p className="text-xs text-destructive">Ce joueur existe déjà.</p>}
          <Button variant="vert" disabled={!valid} onClick={submit} className="font-semibold">
            Créer la fiche
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
