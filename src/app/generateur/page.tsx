"use client";

// Générateur de cartes SFL : on saisit les 6 stats simples (+ poste), et la
// Rare et les 3 Boost se calculent en direct par les formules de la ligue.
// La carte simple est l'unique source de vérité — tout le reste est dérivé.

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Loader2, Minus, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PlayerCard } from "@/components/sfl/player-card";
import { BoostCard, BOOST_LABELS } from "@/components/sfl/boost-card";
import { PLAYERS } from "@/lib/sfl/data";
import {
  STAT_KEYS,
  generateCards,
  ovr,
  playerProfile,
  type BoostCardData,
  type BoostType,
  type Player,
  type StatKey,
  type Stats,
} from "@/lib/sfl/engine";
import { cardToPng, downloadPng, exportCardsZip, safeFileName } from "@/lib/sfl/card-export";

const DEFAULT_STATS: Stats = { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 };
const STAT_LABELS: Record<StatKey, string> = {
  VIT: "Vitesse",
  TIR: "Tir",
  PAS: "Passe",
  DRI: "Dribble",
  DEF: "Défense",
  PHY: "Physique",
};

export default function GenerateurPage() {
  const [name, setName] = useState("Nouveau joueur");
  const [poste, setPoste] = useState("MC");
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);

  const gen = useMemo(
    () => generateCards(stats, poste, { goals, assists }),
    [stats, poste, goals, assists]
  );
  const profile = playerProfile(poste);

  const basePlayer: Player = {
    name,
    poste,
    pp: 0,
    matchs: 0,
    buts: 0,
    passes: 0,
    statut: "Actif",
    stats,
    mvp: 0,
    impact: 0,
    def: 0,
  };
  const boost = (type: BoostType): BoostCardData => ({
    player: name,
    type,
    ovr: ovr(gen[type]),
    poste,
    date: "",
    stats: gen[type],
  });

  const cards: { key: string; label: string; node: ReactNode }[] = [
    { key: "simple", label: "Standard", node: <PlayerCard player={basePlayer} mode="simple" size={1} /> },
    { key: "rare", label: "Rare", node: <PlayerCard player={basePlayer} mode="rare" size={1} /> },
    { key: "impact", label: BOOST_LABELS.impact, node: <BoostCard card={boost("impact")} size={1} /> },
    { key: "def", label: BOOST_LABELS.def, node: <BoostCard card={boost("def")} size={1} /> },
    { key: "mvp", label: BOOST_LABELS.mvp, node: <BoostCard card={boost("mvp")} size={1} /> },
  ];

  const setStat = (k: StatKey, v: number) =>
    setStats((s) => ({ ...s, [k]: Math.max(1, Math.min(99, Math.round(v || 0))) }));

  async function downloadOne(key: string, label: string, node: ReactNode) {
    if (busy || batch) return;
    setBusy(key);
    try {
      downloadPng(await cardToPng(node), `SFL_${safeFileName(name)}_${label}`);
      toast.success("Carte exportée");
    } catch {
      toast.error("Export impossible");
    } finally {
      setBusy(null);
    }
  }

  async function downloadAll() {
    if (busy || batch) return;
    setBatch({ done: 0, total: cards.length });
    try {
      await exportCardsZip(
        cards.map((c) => ({ node: c.node, name: `${name}_${c.label}` })),
        `SFL_${safeFileName(name)}_cartes`,
        (done, total) => setBatch({ done, total })
      );
      toast.success("Les 5 cartes exportées (ZIP)");
    } catch {
      toast.error("Export impossible");
    } finally {
      setBatch(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-4 sm:py-8">
      <div>
        <Link
          href="/admin"
          className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-opacity active:opacity-70"
        >
          <ChevronLeft className="size-4" /> Admin
        </Link>
        <h1 className="text-[34px] font-bold tracking-tight">Générateur de cartes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saisis les 6 stats de base et le poste : la Rare et les 3 Boost se calculent
          automatiquement. La carte simple est l&apos;unique source.
        </p>
      </div>

      {/* Identité */}
      <section className="flex flex-col gap-4 rounded-3xl bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gen-name">Prénom</Label>
            <Input id="gen-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gen-poste">Poste</Label>
            <Input
              id="gen-poste"
              value={poste}
              onChange={(e) => setPoste(e.target.value)}
              placeholder="ex. MC/AT, DC, MDC…"
            />
            <span className="text-xs text-muted-foreground">
              Profil détecté :{" "}
              <strong className="font-semibold text-foreground">
                {profile === "off" ? "Offensif" : "Défensif"}
              </strong>{" "}
              (départage des égalités)
            </span>
          </div>
        </div>

        {/* Charger un joueur existant */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gen-load">Charger un joueur existant</Label>
          <select
            id="gen-load"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value=""
            onChange={(e) => {
              const p = PLAYERS.find((pl) => pl.name === e.target.value);
              if (p) {
                setName(p.name);
                setPoste(p.poste);
                setStats(p.stats);
              }
            }}
          >
            <option value="">— Pré-remplir depuis l&apos;effectif —</option>
            {PLAYERS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} ({p.poste})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Stats de base */}
      <section className="flex flex-col gap-3 rounded-3xl bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Stats de base</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STAT_KEYS.map((k) => (
            <div key={k} className="flex flex-col gap-1.5">
              <Label className="text-xs">
                <span className="font-bold">{k}</span>{" "}
                <span className="text-muted-foreground">· {STAT_LABELS[k]}</span>
              </Label>
              <div className="flex items-center gap-1.5">
                <button
                  aria-label={`-1 ${k}`}
                  onClick={() => setStat(k, stats[k] - 1)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/10 active:opacity-70"
                >
                  <Minus className="size-4" />
                </button>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  value={stats[k]}
                  onChange={(e) => setStat(k, Number(e.target.value))}
                  className="text-center"
                />
                <button
                  aria-label={`+1 ${k}`}
                  onClick={() => setStat(k, stats[k] + 1)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/10 active:opacity-70"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Perf du match (pour les Boost) */}
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gen-goals" className="text-xs">
              Buts du match <span className="text-muted-foreground">→ TIR</span>
            </Label>
            <Input
              id="gen-goals"
              type="number"
              inputMode="numeric"
              min={0}
              value={goals}
              onChange={(e) => setGoals(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gen-assists" className="text-xs">
              Passes D. <span className="text-muted-foreground">→ PAS</span>
            </Label>
            <Input
              id="gen-assists"
              type="number"
              inputMode="numeric"
              min={0}
              value={assists}
              onChange={(e) => setAssists(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Les buts/passes s&apos;ajoutent uniquement sur les cartes Boost (figures de match).
        </p>
      </section>

      {/* Aperçu des cartes */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-lg font-semibold tracking-tight">Les 5 cartes</h2>
          <button
            onClick={downloadAll}
            disabled={busy !== null || batch !== null}
            className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity active:opacity-70 disabled:opacity-60"
          >
            {batch ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
            {batch ? `${batch.done}/${batch.total}…` : "Exporter tout (ZIP)"}
          </button>
        </div>
        <div className="-mx-5 flex gap-5 overflow-x-auto overscroll-x-contain px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cards.map((c) => (
            <div key={c.key} className="flex shrink-0 flex-col items-center gap-2">
              <div className="pointer-events-none">{c.node}</div>
              <button
                onClick={() => downloadOne(c.key, c.label, c.node)}
                disabled={busy !== null || batch !== null}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-opacity active:opacity-70 disabled:opacity-60",
                  "bg-card"
                )}
              >
                {busy === c.key ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                {c.label}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
