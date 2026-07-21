"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  ClipboardList,
  LayoutDashboard,
  Lock,
  MapPin,
  Pencil,
  RotateCcw,
  Send,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/hooks/use-is-client";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { isAdmin } from "@/lib/sfl/admin";
import { SAISIE_EVENT } from "@/components/sfl/season-provider";
import {
  AddPlayerSheet,
  EntrySheet,
  JourneeMetaSheet,
} from "@/components/sfl/admin/entry-sheet";
import { deriveSeason } from "@/lib/sfl/saisie/engine";
import {
  addEntry,
  addJournee,
  deleteEntryAt,
  deleteJournee,
  newEntry,
  updateEntryAt,
  updateJournee,
} from "@/lib/sfl/saisie/mutations";
import { saisieStore, seedSaison } from "@/lib/sfl/saisie/store";
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

const HONORS: [key: "mvp" | "impact" | "def", label: string, cls: string][] = [
  ["mvp", "M", "bg-gradient-to-b from-[#FFF3C6] via-[#F4C542] to-[#8A5A12] text-[#3a2703]"],
  ["impact", "I", "bg-gradient-to-b from-[#FFB88A] via-[#FF5A1F] to-[#7A1E05] text-[#2b0a01]"],
  ["def", "D", "bg-gradient-to-b from-[#D8F1FF] via-[#7FD4FF] to-[#1C4E77] text-[#06202f]"],
];

function HonorBadges({ e }: { e: MatchEntry }) {
  const badges = HONORS.filter(([k]) => e[k]);
  if (!badges.length) return null;
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {badges.map(([k, label, cls]) => (
        <span key={k} className={cn("flex h-4 w-3 items-center justify-center rounded-[2px] text-[7px] font-black ring-1 ring-black/20", cls)}>
          {label}
        </span>
      ))}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl bg-card px-3.5 py-3">
      <div className={cn("text-2xl font-bold tracking-tight tabular-nums", tone)}>{value}</div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

export function AdminDashboard() {
  const isClient = useIsClient();
  const { me } = useMyPlayer();
  const [draft, setDraft] = useState<Saison | null>(null);
  const loaded = useMemo(() => (isClient ? saisieStore.load() : seedSaison()), [isClient]);
  const saison = draft ?? loaded;

  const derived = useMemo(() => deriveSeason(saison), [saison]);

  // Sheets ouvertes
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [addToJ, setAddToJ] = useState<number | null>(null);
  const [metaJ, setMetaJ] = useState<number | null>(null);

  function commit(next: Saison) {
    setDraft(next);
    saisieStore.save(next);
    // Prévient l'app joueur (SeasonProvider) de re-dériver en direct.
    window.dispatchEvent(new Event(SAISIE_EVENT));
  }

  const totals = useMemo(() => {
    const p = derived.players;
    return {
      journees: saison.journees.length,
      joueurs: p.filter((x) => x.matchs > 0).length,
      buts: p.reduce((s, x) => s + x.buts, 0),
      passes: p.reduce((s, x) => s + x.passes, 0),
      pp: p.reduce((s, x) => s + x.pp, 0),
      alertes: derived.alerts.length,
    };
  }, [derived, saison]);

  // Journées (desc) avec leurs lignes groupées par équipe, index conservé.
  const journeeViews = useMemo(() => {
    const withIndex = saison.entries.map((e, i) => ({ e, i }));
    return [...saison.journees]
      .sort((a, b) => b.j - a.j)
      .map((meta) => {
        const rows = withIndex.filter((x) => x.e.j === meta.j);
        const order: (string | null)[] = [];
        const groups = new Map<string | null, { e: MatchEntry; i: number }[]>();
        for (const x of rows) {
          const t = x.e.team;
          if (!groups.has(t)) {
            groups.set(t, []);
            order.push(t);
          }
          groups.get(t)!.push(x);
        }
        const teams = order.map((name) => {
          const items = groups.get(name)!;
          const score = items.reduce((s, x) => s + x.e.buts + (x.e.teamScoreBonus ?? 0), 0);
          return { name, items, score };
        });
        return { meta, teams, players: new Set(rows.map((x) => x.e.player)) };
      });
  }, [saison]);

  const rosterNames = useMemo(
    () => [...saison.roster.map((r) => r.name)].sort((a, b) => a.localeCompare(b)),
    [saison]
  );

  const editEntry = editIndex != null ? saison.entries[editIndex] ?? null : null;
  const metaEntry = metaJ != null ? saison.journees.find((m) => m.j === metaJ) ?? null : null;

  if (!isClient) return null;
  if (!isAdmin(me)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-5 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-card">
          <Lock className="size-6 text-muted-foreground" />
        </span>
        <h1 className="text-xl font-bold tracking-tight">Espace réservé</h1>
        <p className="text-sm text-muted-foreground">
          L&apos;espace administrateur est réservé au profil admin. Connecte-toi avec le
          profil admin (Ilyes) pour y accéder.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-4 sm:py-8 lg:max-w-5xl">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-muted-foreground">Espace administrateur</p>
            <h1 className="text-[34px] font-bold tracking-tight">Admin</h1>
          </div>
          <Badge variant="secondary" className="rounded-full">Maquette</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Saisie des matchs directement dans l&apos;app — plus besoin d&apos;Excel. Les
          classements et cartes se recalculent en direct. Stockage local pour l&apos;instant.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full rounded-full bg-card p-1">
          <TabsTrigger value="overview" className="flex-1 rounded-full text-[13px]">
            <LayoutDashboard className="mr-1.5 size-4" /> Vue d&apos;ensemble
          </TabsTrigger>
          <TabsTrigger value="feuille" className="flex-1 rounded-full text-[13px]">
            <ClipboardList className="mr-1.5 size-4" /> Feuille de match
          </TabsTrigger>
          <TabsTrigger value="joueurs" className="flex-1 rounded-full text-[13px]">
            <Users className="mr-1.5 size-4" /> Joueurs
          </TabsTrigger>
        </TabsList>

        {/* ===================== VUE D'ENSEMBLE ===================== */}
        <TabsContent value="overview" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Journées" value={totals.journees} />
            <Stat label="Joueurs" value={totals.joueurs} />
            <Stat label="Buts" value={totals.buts} />
            <Stat label="Passes D." value={totals.passes} />
            <Stat label="PP distribués" value={totals.pp} />
            <Stat label="Alertes" value={totals.alertes} tone={totals.alertes ? "text-amber-500" : "text-emerald-500"} />
          </div>

          <div className="rounded-3xl bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-amber-500" /> Contrôles de cohérence
            </div>
            {derived.alerts.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Aucune anomalie détectée — saisie propre ✓</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {derived.alerts.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px]">
                    <span className={cn("size-1.5 shrink-0 rounded-full", a.level === "error" ? "bg-destructive" : "bg-amber-500")} />
                    <span className="font-medium">J{a.j}</span>
                    <span className="text-muted-foreground">· {a.player} —</span>
                    <span>{a.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Send, title: "Convocations", desc: "Programmer, inviter, suivre les confirmations." },
              { icon: MapPin, title: "Localisation", desc: "Terrain du match et partage de position." },
              { icon: Sparkles, title: "EvoDay", desc: "Évolution mensuelle des cartes." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 rounded-2xl bg-card/60 p-3.5 opacity-70">
                <Icon className="mt-0.5 size-5 text-primary" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{title}</span>
                    <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[9px]">Bientôt</Badge>
                  </div>
                  <p className="text-[12px] text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Button variant="ghost" size="sm" onClick={() => commit(saisieStore.reset())} className="self-start text-muted-foreground">
            <RotateCcw className="mr-1.5 size-4" /> Réinitialiser les données de démo
          </Button>
        </TabsContent>

        {/* ===================== FEUILLE DE MATCH (éditable) ===================== */}
        <TabsContent value="feuille" className="mt-4 flex flex-col gap-3">
          <Button
            onClick={() => {
              const { saison: s, j } = addJournee(saison);
              commit(s);
              setAddToJ(j);
            }}
            className="rounded-full"
          >
            <CalendarPlus className="mr-1.5 size-4" /> Nouvelle journée
          </Button>

          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
          {journeeViews.map(({ meta, teams }) => (
            <div key={meta.j} className="overflow-hidden rounded-3xl bg-card">
              <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold tracking-tight">Journée {meta.j}</span>
                  {meta.sflTime && (
                    <Badge className="rounded-full bg-primary/12 px-2 py-0 text-[10px] text-primary">SFL Time</Badge>
                  )}
                  <span className="text-[13px] text-muted-foreground">{meta.date}</span>
                </div>
                <button
                  type="button"
                  aria-label="Réglages de la journée"
                  onClick={() => setMetaJ(meta.j)}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
                >
                  <Pencil className="size-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-4">
                {teams.map((team) => (
                  <div key={team.name ?? "flat"} className="rounded-2xl bg-secondary/40 p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        {team.name && (
                          <span className="size-2.5 rounded-full ring-1 ring-black/10" style={{ background: TEAM_COLORS[team.name] ?? "#ddd" }} />
                        )}
                        {team.name ?? "Sans équipe"}
                      </span>
                      {team.name && <span className="text-base font-bold tabular-nums">{team.score}</span>}
                    </div>
                    <div className="flex flex-col">
                      {team.items.map(({ e, i }) => {
                        const absent = e.statut !== "Présent";
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setEditIndex(i)}
                            className="flex items-center gap-2 rounded-lg px-1 py-2 text-left active:bg-secondary"
                          >
                            <span className={cn("flex min-w-0 flex-1 items-center gap-1.5", absent && "opacity-50")}>
                              <span className="truncate text-[14px] font-medium">{e.player}</span>
                              {e.note && (
                                <span className="shrink-0 rounded-full bg-primary/12 px-1.5 py-0.5 text-[8px] font-bold text-primary uppercase">{e.note}</span>
                              )}
                              <HonorBadges e={e} />
                              {absent && (
                                <span className="shrink-0 text-[10px] text-muted-foreground">{e.statut}</span>
                              )}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{e.buts}b · {e.passes}pd</span>
                            <Pencil className="size-3.5 shrink-0 text-muted-foreground/50" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <Button variant="ghost" size="sm" onClick={() => setAddToJ(meta.j)} className="self-start text-muted-foreground">
                  <UserPlus className="mr-1.5 size-4" /> Ajouter un joueur
                </Button>
              </div>
            </div>
          ))}
          </div>
          <p className="px-1 text-[12px] text-muted-foreground">
            Touche un joueur pour éditer sa ligne (statut, buts, passes, honneurs…). Tout est
            sauvegardé et recalculé en direct.
          </p>
        </TabsContent>

        {/* ===================== JOUEURS ===================== */}
        <TabsContent value="joueurs" className="mt-4">
          <div className="overflow-hidden rounded-3xl bg-card">
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <span className="w-6">#</span>
              <span className="flex-1">Joueur</span>
              <span className="w-10 text-center">PP</span>
              <span className="w-8 text-center">MJ</span>
              <span className="w-8 text-center">B</span>
              <span className="w-8 text-center">PD</span>
            </div>
            {derived.players.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 border-b border-border/40 px-4 py-2 last:border-0">
                <span className={cn("w-6 text-sm font-semibold tabular-nums", i < 3 ? "text-primary" : "text-muted-foreground")}>{i + 1}</span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-[14px] font-semibold">{p.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{p.poste}</span>
                  {p.statut !== "Actif" && (
                    <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase", p.statut === "Suspendu" ? "bg-destructive/10 text-destructive" : "bg-sky-500/10 text-sky-600 dark:text-sky-400")}>{p.statut}</span>
                  )}
                </span>
                <span className="w-10 text-center text-sm font-bold tabular-nums">{p.pp}</span>
                <span className="w-8 text-center text-xs text-muted-foreground tabular-nums">{p.matchs}</span>
                <span className="w-8 text-center text-xs text-muted-foreground tabular-nums">{p.buts}</span>
                <span className="w-8 text-center text-xs text-muted-foreground tabular-nums">{p.passes}</span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===================== SHEETS ===================== */}
      <EntrySheet
        entry={editEntry}
        onOpenChange={(o) => !o && setEditIndex(null)}
        onPatch={(patch) => editIndex != null && commit(updateEntryAt(saison, editIndex, patch))}
        onDelete={() => {
          if (editIndex != null) commit(deleteEntryAt(saison, editIndex));
          setEditIndex(null);
        }}
      />
      <AddPlayerSheet
        open={addToJ != null}
        onOpenChange={(o) => !o && setAddToJ(null)}
        roster={rosterNames}
        existing={addToJ != null ? journeeViews.find((v) => v.meta.j === addToJ)?.players ?? new Set() : new Set()}
        onAdd={(player, team) => {
          if (addToJ != null) commit(addEntry(saison, newEntry(addToJ, player, team)));
          setAddToJ(null);
        }}
      />
      <JourneeMetaSheet
        meta={metaEntry}
        onOpenChange={(o) => !o && setMetaJ(null)}
        onPatch={(patch) => metaJ != null && commit(updateJournee(saison, metaJ, patch))}
        onDelete={() => {
          if (metaJ != null) commit(deleteJournee(saison, metaJ));
          setMetaJ(null);
        }}
      />
    </div>
  );
}
