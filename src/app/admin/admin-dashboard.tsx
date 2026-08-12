"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Redo2,
  Table2,
  Undo2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
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
  NewPlayerSheet,
  PlayerSheet,
} from "@/components/sfl/admin/entry-sheet";
import { NewJourneeSheet } from "@/components/sfl/admin/new-journee-sheet";
import { GrilleSaisie } from "@/components/sfl/admin/grille";
import { FeuilleDirecte } from "@/components/sfl/admin/feuille-directe";
import { ConvocationSheet } from "@/components/sfl/admin/convocation-sheet";
import { EquipesDimanche } from "@/components/sfl/admin/equipes-dimanche";
import { deriveSeason } from "@/lib/sfl/saisie/engine";
import {
  activeConvocation,
  addEntry,
  addJourneeWithTeams,
  addRoster,
  closeConvocation,
  createConvocation,
  deleteEntryAt,
  deleteJournee,
  deleteRosterAt,
  newEntry,
  newRosterPlayer,
  respondConvocation,
  rosterHasName,
  updateEntryAt,
  updateJournee,
  updateRosterAt,
} from "@/lib/sfl/saisie/mutations";
import { saisieStore, seedSaison } from "@/lib/sfl/saisie/store";
import { pushSaison } from "@/lib/sfl/saisie/sync";
import { useSession } from "@/hooks/use-session";
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
  const session = useSession();
  const partage = !!session?.server && !!session.admin;
  const [draft, setDraft] = useState<Saison | null>(null);
  const loaded = useMemo(() => (isClient ? saisieStore.load() : seedSaison()), [isClient]);
  const saison = draft ?? loaded;

  const derived = useMemo(() => deriveSeason(saison), [saison]);

  // Sheets ouvertes
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [addToJ, setAddToJ] = useState<number | null>(null);
  const [metaJ, setMetaJ] = useState<number | null>(null);
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);
  const [newPlayerOpen, setNewPlayerOpen] = useState(false);
  const [newJourneeOpen, setNewJourneeOpen] = useState(false);
  const [convocOpen, setConvocOpen] = useState(false);
  const [feuilleMode, setFeuilleMode] = useState<"direct" | "revue">("direct");
  // Pré-cochés à l'ouverture de l'assistant journée (confirmés de la convocation).
  const [journeePrefill, setJourneePrefill] = useState<string[]>([]);
  // Historique : deux piles. `history` porte les états PRÉCÉDENTS (annuler),
  // `future` les états repris d'une annulation (rétablir). Toute nouvelle
  // action vide `future` — c'est le comportement attendu partout ailleurs.
  type Step = { saison: Saison; label: string; at: number };
  const [history, setHistory] = useState<Step[]>([]);
  const [future, setFuture] = useState<Step[]>([]);

  const persist = useCallback((next: Saison) => {
    setDraft(next);
    saisieStore.save(next);
    // Prévient l'app joueur (SeasonProvider) de re-dériver en direct.
    window.dispatchEvent(new Event(SAISIE_EVENT));
  }, []);

  const commit = useCallback(
    (next: Saison, label = "Modification") => {
      setHistory((h) => [...h, { saison, label, at: Date.now() }].slice(-200));
      // Toute nouvelle action referme la branche « rétablir ».
      setFuture([]);
      persist(next);
    },
    [saison, persist]
  );

  // Les deux piles bougent ensemble, mais JAMAIS depuis la fonction de mise à
  // jour d'un autre setState : celle-ci s'exécute pendant le rendu, et y
  // déclencher un second setState est précisément ce que React reproche.
  const undo = useCallback(() => {
    if (history.length === 0) return;
    const step = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setFuture([...future, { saison, label: step.label, at: Date.now() }].slice(-200));
    persist(step.saison);
  }, [history, future, saison, persist]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const step = future[future.length - 1];
    setFuture(future.slice(0, -1));
    setHistory([...history, { saison, label: step.label, at: Date.now() }].slice(-200));
    persist(step.saison);
  }, [history, future, saison, persist]);

  // ⌘Z / ⌘⇧Z partout dans l'espace admin — y compris depuis une cellule de la
  // grille. On laisse la main aux champs de texte en cours d'édition seulement
  // si l'utilisateur est en train de composer (sinon annuler la saisie du
  // navigateur prendrait le pas sur l'annulation de la journée).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

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

  // Sélection « nouvelle journée » : nom + OVR carte + dispo (profil actif).
  const journeeRoster = useMemo(
    () =>
      [...saison.roster]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((r) => ({
          name: r.name,
          ovr: Math.ceil((r.base ?? [75, 75, 75, 75, 75, 75]).reduce((a, b) => a + b, 0) / 6),
          actif: r.profil !== "En attente" && r.profil !== "Blessure",
        })),
    [saison]
  );

  // Effectif : chaque fiche + ses totaux dérivés, triée (joués d'abord).
  const rosterViews = useMemo(() => {
    const byName = new Map(derived.players.map((p) => [p.name, p]));
    return saison.roster
      .map((r, i) => ({
        r,
        i,
        d: byName.get(r.name),
        ovr: Math.ceil((r.base ?? [75, 75, 75, 75, 75, 75]).reduce((a, b) => a + b, 0) / 6),
      }))
      .sort((a, b) => (b.d?.pp ?? -1) - (a.d?.pp ?? -1) || a.r.name.localeCompare(b.r.name));
  }, [saison, derived]);

  const editEntry = editIndex != null ? saison.entries[editIndex] ?? null : null;
  const metaEntry = metaJ != null ? saison.journees.find((m) => m.j === metaJ) ?? null : null;
  const playerEntry = playerIndex != null ? saison.roster[playerIndex] ?? null : null;

  // Convocation ouverte + réponses groupées.
  const convoc = activeConvocation(saison);
  const convocGroups = useMemo(() => {
    if (!convoc) return null;
    const present: string[] = [];
    const absent: string[] = [];
    const sans: string[] = [];
    for (const name of rosterNames) {
      const r = convoc.reponses[name];
      if (r === "present") present.push(name);
      else if (r === "absent") absent.push(name);
      else sans.push(name);
    }
    return { present, absent, sans };
  }, [convoc, rosterNames]);

  // L'admin peut corriger une réponse : présent → absent → sans réponse.
  function cycleReponse(name: string) {
    if (!convoc) return;
    const cur = convoc.reponses[name];
    const next = cur === "present" ? "absent" : cur === "absent" ? null : "present";
    commit(respondConvocation(saison, convoc.id, name, next), `Réponse — ${name}`);
  }

  if (!isClient) return null;
  if (!isAdmin(me)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-5 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-card">
          <Lock className="size-6 text-muted-foreground" />
        </span>
        <h1 className="text-xl font-bold tracking-tight">Espace réservé</h1>
        <p className="text-sm text-muted-foreground">
          L&apos;espace administrateur est réservé aux administrateurs de la ligue.
          Connecte-toi avec un compte admin pour y accéder.
        </p>
      </div>
    );
  }

  return (
    <div className="shell flex flex-col gap-5 py-4 sm:py-8">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-muted-foreground">Espace administrateur</p>
            <h1 className="text-[30px] font-bold tracking-tight">Admin</h1>
          </div>
          <Badge
            variant="secondary"
            className={cn("rounded-full", partage && "bg-emerald-500/15 text-emerald-400")}
          >
            {partage ? "Partagé" : "Local"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {partage
            ? "Saisie directement dans l'app — chaque modification part en base et corrige pour toute la ligue, en direct."
            : "Saisie directement dans l'app. ATTENTION : sans session serveur, tes corrections restent sur cet appareil — reconnecte-toi pour corriger pour tout le monde."}
        </p>
        {partage && (
          <button
            onClick={async () => {
              const ok = await pushSaison(saison);
              if (ok)
                toast.success("Saison envoyée en base", {
                  description: "Toute la ligue est maintenant sur cette version.",
                });
              else toast.error("Envoi impossible — vérifie l'installation (base).");
            }}
            className="glass-soft mono-label mt-2 rounded-full px-3 py-1.5 text-foreground/60"
          >
            Envoyer la saison en base maintenant
          </button>
        )}
      </div>

      <Tabs defaultValue="overview">
        {/* Quatre onglets ne tiennent pas sur un téléphone : les libellés
            s'abrègent, et la barre défile en dernier recours. */}
        <TabsList className="w-full overflow-x-auto rounded-full bg-card p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="overview" className="flex-1 shrink-0 rounded-full text-[13px] whitespace-nowrap">
            <LayoutDashboard className="mr-1.5 size-4" /> Vue
            <span className="hidden sm:inline">&nbsp;d&apos;ensemble</span>
          </TabsTrigger>
          <TabsTrigger value="grille" className="flex-1 shrink-0 rounded-full text-[13px] whitespace-nowrap">
            <Table2 className="mr-1.5 size-4" /> Saisie
          </TabsTrigger>
          <TabsTrigger value="feuille" className="flex-1 shrink-0 rounded-full text-[13px] whitespace-nowrap">
            <ClipboardList className="mr-1.5 size-4" /> Feuille
            <span className="hidden sm:inline">&nbsp;de match</span>
          </TabsTrigger>
          <TabsTrigger value="joueurs" className="flex-1 shrink-0 rounded-full text-[13px] whitespace-nowrap">
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

          {/* Convocation du prochain match */}
          <div className="rounded-3xl bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Send className="size-4 text-primary" /> Convocation
                </div>
                {convoc ? (
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {convoc.jour} {convoc.date} · {convoc.heure}
                    </span>
                    <span className="mx-1">·</span>
                    <MapPin className="mr-0.5 inline size-3.5" />
                    {convoc.lieu}
                  </p>
                ) : (
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Aucune convocation ouverte.
                  </p>
                )}
              </div>
              <Button size="sm" onClick={() => setConvocOpen(true)} className="shrink-0 rounded-full">
                Nouvelle
              </Button>
            </div>

            {convoc && convocGroups && (
              <>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {(
                    [
                      ["present", convocGroups.present, "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"],
                      ["absent", convocGroups.absent, "bg-destructive/10 text-destructive"],
                      ["sans", convocGroups.sans, "bg-secondary text-muted-foreground"],
                    ] as const
                  ).map(([key, list, cls]) =>
                    list.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => cycleReponse(name)}
                        title="Toucher pour basculer présent / absent / sans réponse"
                        className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors", cls)}
                      >
                        {key === "present" ? "✓ " : key === "absent" ? "✗ " : ""}
                        {name}
                      </button>
                    ))
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] text-muted-foreground tabular-nums">
                    {convocGroups.present.length} confirmés · {convocGroups.absent.length} absents ·{" "}
                    {convocGroups.sans.length} sans réponse
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => commit(closeConvocation(saison, convoc.id), "Clôture convocation")}
                      className="rounded-full"
                    >
                      Clôturer
                    </Button>
                    <Button
                      size="sm"
                      disabled={convocGroups.present.length < 2}
                      onClick={() => {
                        setJourneePrefill(convocGroups.present);
                        setNewJourneeOpen(true);
                      }}
                      className="rounded-full"
                    >
                      <CalendarPlus className="mr-1 size-3.5" /> Préparer la journée
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Les équipes de dimanche — générées depuis les « oui » */}
          <EquipesDimanche />

          {/* Historique / annulation */}
          <div className="rounded-3xl bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Undo2 className="size-4 text-primary" /> Historique
              </span>
              <span className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={history.length === 0}
                  onClick={undo}
                  title="⌘Z"
                  className="rounded-full"
                >
                  <Undo2 className="mr-1.5 size-4" /> Annuler
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={future.length === 0}
                  onClick={redo}
                  title="⌘⇧Z"
                  className="rounded-full"
                >
                  <Redo2 className="mr-1.5 size-4" /> Rétablir
                </Button>
              </span>
            </div>
            {history.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Aucune modification cette session. Chaque changement est annulable — ⌘Z pour
                revenir en arrière, ⌘⇧Z pour rétablir, autant de fois qu&apos;il faut.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {[...history]
                  .slice(-6)
                  .reverse()
                  .map((h, i) => (
                    <div key={h.at + "-" + i} className="flex items-center justify-between text-[13px]">
                      <span className={cn(i === 0 && "font-semibold")}>{h.label}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {new Date(h.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-card/60 p-3.5 opacity-70">
            <Sparkles className="mt-0.5 size-5 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold">EvoDay</span>
                <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[9px]">Bientôt</Badge>
              </div>
              <p className="text-[12px] text-muted-foreground">Évolution mensuelle des cartes.</p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={() => { persist(saisieStore.reset()); setHistory([]); setFuture([]); }} className="self-start text-muted-foreground">
            <RotateCcw className="mr-1.5 size-4" /> Réinitialiser les données de démo
          </Button>
        </TabsContent>

        {/* ===================== SAISIE (la grille) ===================== */}
        <TabsContent value="grille" className="mt-4 flex flex-col gap-3">
          <GrilleSaisie saison={saison} commit={commit} />
        </TabsContent>

        {/* ===================== FEUILLE DE MATCH (éditable) ===================== */}
        <TabsContent value="feuille" className="mt-4 flex flex-col gap-3">
          {/* Deux usages, deux écrans : le direct au bord du terrain, la
              consultation après coup. */}
          <div className="glass flex w-full rounded-full p-1">
            {(
              [
                ["direct", "En direct"],
                ["revue", "Consulter"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setFeuilleMode(mode)}
                className={cn(
                  "flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors",
                  feuilleMode === mode ? "bg-foreground text-background" : "text-foreground/45"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {feuilleMode === "direct" ? (
            <FeuilleDirecte saison={saison} commit={commit} />
          ) : (
          <>
          <Button onClick={() => setNewJourneeOpen(true)} className="rounded-full">
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
          </>
          )}
        </TabsContent>

        {/* ===================== JOUEURS (effectif) ===================== */}
        <TabsContent value="joueurs" className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-[13px] text-muted-foreground">
              {rosterViews.length} joueurs — touche une fiche pour éditer poste, statut et stats.
            </p>
            <Button size="sm" onClick={() => setNewPlayerOpen(true)} className="rounded-full">
              <UserPlus className="mr-1.5 size-4" /> Ajouter
            </Button>
          </div>
          <div className="overflow-hidden rounded-3xl bg-card">
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <span className="flex-1">Joueur</span>
              <span className="w-10 text-center">OVR</span>
              <span className="w-10 text-center">PP</span>
              <span className="w-8 text-center">MJ</span>
              <span className="w-8 text-center">B</span>
            </div>
            {rosterViews.map(({ r, i, d, ovr }) => (
              <button
                key={r.name}
                type="button"
                onClick={() => setPlayerIndex(i)}
                className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-2 text-left last:border-0 active:bg-secondary"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-[14px] font-semibold">{r.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{r.poste ?? "—"}</span>
                  {r.profil !== "Actif" && (
                    <span className="shrink-0 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-bold text-sky-600 uppercase dark:text-sky-400">{r.profil}</span>
                  )}
                </span>
                <span className="w-10 text-center text-sm font-bold tabular-nums">{ovr}</span>
                <span className="w-10 text-center text-sm font-semibold tabular-nums">{d?.pp ?? "—"}</span>
                <span className="w-8 text-center text-xs text-muted-foreground tabular-nums">{d?.matchs ?? 0}</span>
                <span className="w-8 text-center text-xs text-muted-foreground tabular-nums">{d?.buts ?? 0}</span>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===================== SHEETS ===================== */}
      <EntrySheet
        entry={editEntry}
        onOpenChange={(o) => !o && setEditIndex(null)}
        onPatch={(patch) => editIndex != null && commit(updateEntryAt(saison, editIndex, patch), "Édition ligne")}
        onDelete={() => {
          if (editIndex != null) commit(deleteEntryAt(saison, editIndex), "Retrait joueur (journée)");
          setEditIndex(null);
        }}
      />
      <AddPlayerSheet
        open={addToJ != null}
        onOpenChange={(o) => !o && setAddToJ(null)}
        roster={rosterNames}
        existing={addToJ != null ? journeeViews.find((v) => v.meta.j === addToJ)?.players ?? new Set() : new Set()}
        onAdd={(player, team) => {
          if (addToJ != null) commit(addEntry(saison, newEntry(addToJ, player, team)), `Ajout — ${player}`);
          setAddToJ(null);
        }}
      />
      <JourneeMetaSheet
        meta={metaEntry}
        onOpenChange={(o) => !o && setMetaJ(null)}
        onPatch={(patch) => metaJ != null && commit(updateJournee(saison, metaJ, patch), "Édition journée")}
        onDelete={() => {
          if (metaJ != null) commit(deleteJournee(saison, metaJ), `Suppression journée ${metaJ}`);
          setMetaJ(null);
        }}
      />
      <PlayerSheet
        entry={playerEntry}
        onOpenChange={(o) => !o && setPlayerIndex(null)}
        onPatch={(patch) => playerIndex != null && commit(updateRosterAt(saison, playerIndex, patch), "Édition fiche")}
        onDelete={() => {
          if (playerIndex != null) commit(deleteRosterAt(saison, playerIndex), "Suppression joueur");
          setPlayerIndex(null);
        }}
      />
      <NewPlayerSheet
        open={newPlayerOpen}
        onOpenChange={setNewPlayerOpen}
        exists={(name) => rosterHasName(saison, name)}
        onCreate={(name) => {
          const idx = saison.roster.length;
          commit(addRoster(saison, newRosterPlayer(name)), `Nouveau joueur — ${name}`);
          setNewPlayerOpen(false);
          setPlayerIndex(idx); // ouvre directement la fiche pour compléter
        }}
      />
      <NewJourneeSheet
        key={`${newJourneeOpen}-${journeePrefill.join(",")}`}
        open={newJourneeOpen}
        onOpenChange={(o) => {
          setNewJourneeOpen(o);
          if (!o) setJourneePrefill([]);
        }}
        roster={journeeRoster}
        initialChecked={journeePrefill}
        onCreate={(teams) => {
          const { saison: s, j } = addJourneeWithTeams(saison, teams);
          commit(s, `Nouvelle journée ${j}`);
          setNewJourneeOpen(false);
          setJourneePrefill([]);
        }}
      />
      <ConvocationSheet
        open={convocOpen}
        onOpenChange={setConvocOpen}
        onCreate={(info) => {
          commit(createConvocation(saison, info), "Nouvelle convocation");
          setConvocOpen(false);
        }}
      />
    </div>
  );
}
