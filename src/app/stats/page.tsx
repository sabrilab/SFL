"use client";

import { useState } from "react";
import { ChevronRight, Star, Vote } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { JOURNEES, PLAYERS } from "@/lib/sfl/data";
import { ovr, rankByMetric, type Journee, type Player } from "@/lib/sfl/engine";

/* ============================= CLASSEMENTS ============================= */

interface RankingDef {
  id: string;
  label: string;
  unit: string;
  desc: string;
  value: (p: Player) => number;
  showAll?: boolean; // afficher aussi les joueurs à 0
}

const RANKINGS: RankingDef[] = [
  { id: "pp", label: "Pépite d'Or", unit: "pts", desc: "Points Pépite de la saison", value: (p) => p.pp, showAll: true },
  { id: "ovr", label: "OVR", unit: "ovr", desc: "Note générale de la carte", value: (p) => ovr(p.stats), showAll: true },
  { id: "buts", label: "Buteurs", unit: "buts", desc: "Meilleurs buteurs de la saison", value: (p) => p.buts },
  { id: "passes", label: "Passeurs", unit: "pd", desc: "Meilleurs passeurs décisifs", value: (p) => p.passes },
  { id: "mvp", label: "MVP", unit: "mvp", desc: "Titres de MVP du match", value: (p) => p.mvp },
  { id: "impact", label: "Impact", unit: "imp", desc: "Titres de Joueur Impact", value: (p) => p.impact },
  { id: "def", label: "Défenseurs", unit: "déf", desc: "Titres de meilleur défenseur", value: (p) => p.def },
  { id: "presences", label: "Présences", unit: "m", desc: "Matchs joués cette saison", value: (p) => p.matchs, showAll: true },
  { id: "discipline", label: "Discipline", unit: "abs", desc: "Absences injustifiées et suspensions", value: (p) => p.absInj ?? 0 },
];

function RankingList({ def, me }: { def: RankingDef; me: string }) {
  const ranked = rankByMetric(PLAYERS, def.value).filter(
    (p) => def.showAll || p.value > 0
  );

  if (ranked.length === 0) {
    return (
      <div className="rounded-3xl bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        Personne dans ce classement — tout le monde est clean ✓
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 px-1 text-[13px] text-muted-foreground">{def.desc}</p>
      <div className="flex flex-col gap-1.5">
        {ranked.map((p) => {
          const isMe = p.name === me;
          return (
            <div
              key={p.name}
              className={cn(
                "flex items-center rounded-2xl bg-card px-4 py-3",
                isMe && "ring-1 ring-primary/50"
              )}
            >
              <span
                className={cn(
                  "w-8 text-base font-semibold tabular-nums",
                  p.rank <= 3 ? "text-primary" : "text-muted-foreground"
                )}
              >
                {p.rank}
              </span>
              <span className="mr-3 flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                {p.name[0]}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-[15px] font-semibold">{p.name}</span>
                {p.statut !== "Actif" && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "rounded-full px-2 text-[9px] tracking-wide uppercase",
                      p.statut === "Suspendu"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    )}
                  >
                    {p.statut}
                  </Badge>
                )}
              </span>
              <span className="w-12 text-xs font-medium text-muted-foreground">{p.poste}</span>
              <span className="w-16 text-right text-lg font-bold tracking-tight tabular-nums">
                {p.value}
                <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                  {def.unit}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ============================= VOTES FIGURES ============================= */

type VoteCategory = "mvp" | "impact" | "def";
type Votes = Partial<Record<VoteCategory, string>>;

const voteKey = (me: string, j: number) => `sfl-vote-${me}-j${j}`;

function readVotes(me: string, j: number): Votes {
  try {
    return JSON.parse(localStorage.getItem(voteKey(me, j)) ?? "{}");
  } catch {
    return {};
  }
}

function VotePanel({ journee, me }: { journee: Journee; me: string }) {
  const isClient = useIsClient();
  const [local, setLocal] = useState<Votes | null>(null);

  const votes = local ?? (isClient ? readVotes(me, journee.j) : {});

  const participants = journee.lignes.map(([name]) => name);
  const myLine = journee.lignes.find(([name]) => name === me);
  const teamsKnown = journee.lignes.some(([, r]) => r === "V" || r === "D");

  // Joueur Impact : on vote pour un joueur de l'équipe ADVERSE.
  const impactOptions =
    myLine && teamsKnown
      ? journee.lignes.filter(([, r]) => r !== myLine[1]).map(([name]) => name)
      : participants.filter((name) => name !== me);

  const categories: {
    id: VoteCategory;
    label: string;
    rule: string;
    options: string[];
    disabled?: string;
  }[] = [
    {
      id: "mvp",
      label: "MVP du match",
      rule: "Tout le monde vote",
      options: participants.filter((n) => n !== me),
    },
    {
      id: "def",
      label: "Meilleur défenseur",
      rule: "On vote pour le meilleur",
      options: participants.filter((n) => n !== me),
    },
    {
      id: "impact",
      label: "Joueur Impact",
      rule: "On vote pour l'adversaire",
      options: impactOptions,
      disabled: !myLine
        ? "Réservé aux joueurs ayant participé à cette journée"
        : undefined,
    },
  ];

  function castVote(category: VoteCategory, name: string) {
    const next = { ...votes, [category]: name };
    localStorage.setItem(voteKey(me, journee.j), JSON.stringify(next));
    setLocal(next);
    toast.success(`Vote enregistré : ${name}`, {
      description: categories.find((c) => c.id === category)?.label,
    });
  }

  const complete = categories.every((c) => c.disabled || votes[c.id]);

  return (
    <div className="mt-4 rounded-2xl bg-secondary/60 p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Vote className="size-4 text-primary" /> Vote des figures
        {complete && (
          <span className="ml-auto rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
            Voté ✓
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Tu votes en tant que <strong className="text-foreground">{me}</strong>. Vote
        enregistré sur cet appareil — la centralisation arrivera avec l&apos;interface
        admin.
      </p>
      <div className="flex flex-col gap-3.5">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{c.label}</div>
              <div className="text-[11px] text-muted-foreground">{c.rule}</div>
            </div>
            {c.disabled ? (
              <span className="max-w-[45%] text-right text-xs text-muted-foreground italic">
                {c.disabled}
              </span>
            ) : (
              <Select
                value={votes[c.id] ?? null}
                onValueChange={(v) => castVote(c.id, v as string)}
              >
                <SelectTrigger
                  size="sm"
                  aria-label={`Voter — ${c.label}`}
                  className="rounded-full bg-background dark:bg-background"
                >
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {c.options.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================= PAGE ============================= */

const FAIT_LABELS: [keyof Journee["faits"], string][] = [
  ["mvp", "MVP du match"],
  ["impactA", "Meilleur joueur — Équipe A"],
  ["impactB", "Meilleur joueur — Équipe B"],
  ["defs", "Meilleurs défenseurs"],
  ["buteur", "Meilleur buteur"],
  ["passeur", "Meilleur passeur"],
];

export default function StatsPage() {
  const { me } = useMyPlayer();
  const [openJ, setOpenJ] = useState<number>(JOURNEES[JOURNEES.length - 1].j);
  const [ranking, setRanking] = useState<string>("pp");

  const rankingDef = RANKINGS.find((r) => r.id === ranking) ?? RANKINGS[0];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-4 sm:py-8">
      <div className="mb-1">
        <p className="text-[13px] font-medium text-muted-foreground">
          Saison 1 · Après la journée {JOURNEES.length}
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Statistiques</h1>
      </div>

      <Tabs defaultValue="classement">
        <TabsList className="w-full rounded-full bg-card p-1 dark:bg-card">
          <TabsTrigger value="classement" className="flex-1 rounded-full">
            Classement
          </TabsTrigger>
          <TabsTrigger value="matchs" className="flex-1 rounded-full">
            Matchs
          </TabsTrigger>
        </TabsList>

        {/* ===== CLASSEMENTS ===== */}
        <TabsContent value="classement" className="mt-4">
          <div className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {RANKINGS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRanking(r.id)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors",
                  ranking === r.id
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <RankingList def={rankingDef} me={me} />
        </TabsContent>

        {/* ===== MATCHS ===== */}
        <TabsContent value="matchs" className="mt-4">
          <div className="flex flex-col gap-3">
            {[...JOURNEES].reverse().map((j) => {
              const open = openJ === j.j;
              const faits = FAIT_LABELS.map(([key, label]) =>
                j.faits[key] ? ([label, j.faits[key]] as const) : null
              ).filter(Boolean) as [string, string][];

              return (
                <div key={j.j} className="overflow-hidden rounded-3xl bg-card">
                  <button
                    onClick={() => setOpenJ(open ? 0 : j.j)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold tracking-tight">
                          Journée {j.j}
                        </span>
                        {j.sflTime && (
                          <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">
                            SFL Time
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] text-muted-foreground">{j.date}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {j.score ? (
                        <span className="text-2xl font-bold tracking-tight tabular-nums">
                          {j.score[0]}
                          <span className="mx-1.5 text-muted-foreground">–</span>
                          {j.score[1]}
                        </span>
                      ) : (
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                          Saisie incomplète
                        </span>
                      )}
                      <ChevronRight
                        className={cn(
                          "size-4.5 text-muted-foreground transition-transform",
                          open && "rotate-90"
                        )}
                      />
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-border/60 px-5 py-4">
                      {faits.length > 0 && (
                        <div className="mb-4">
                          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#c9962e] dark:text-[#E8C87A]">
                            <Star className="size-3.5" /> Faits marquants
                          </div>
                          <div className="flex flex-col">
                            {faits.map(([label, value]) => (
                              <div
                                key={label}
                                className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0"
                              >
                                <div className="text-[13px] text-muted-foreground">{label}</div>
                                <div className="text-right text-sm font-semibold">{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mb-1 text-sm font-semibold">Feuille de match</div>
                      <div className="flex flex-col">
                        {j.lignes.map(([name, res, buts, passes]) => (
                          <div
                            key={name}
                            className="flex items-center gap-2.5 border-b border-border/60 py-2 text-sm last:border-0"
                          >
                            <span
                              className={cn(
                                "w-5 font-bold",
                                res === "V"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : res === "D"
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                              )}
                            >
                              {res === "-" ? "·" : res}
                            </span>
                            <span className="flex-1 font-medium">{name}</span>
                            <span className="text-xs text-muted-foreground">
                              {buts} but{buts > 1 ? "s" : ""} · {passes} passe
                              {passes > 1 ? "s" : ""} D.
                            </span>
                          </div>
                        ))}
                      </div>

                      <VotePanel journee={j} me={me} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
