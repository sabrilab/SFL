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
  gold?: boolean; // valeur affichée en doré (OVR)
}

const RANKINGS: RankingDef[] = [
  { id: "pp", label: "Pépite d'Or", unit: "PTS", desc: "Points Pépite de la saison", value: (p) => p.pp, showAll: true },
  { id: "ovr", label: "OVR", unit: "OVR", desc: "Note générale de la carte", value: (p) => ovr(p.stats), showAll: true, gold: true },
  { id: "buts", label: "Buteurs", unit: "BUTS", desc: "Meilleurs buteurs de la saison", value: (p) => p.buts },
  { id: "passes", label: "Passeurs", unit: "PD", desc: "Meilleurs passeurs décisifs", value: (p) => p.passes },
  { id: "mvp", label: "MVP", unit: "MVP", desc: "Titres de MVP du match", value: (p) => p.mvp },
  { id: "impact", label: "Impact", unit: "IMP", desc: "Titres de Joueur Impact", value: (p) => p.impact },
  { id: "def", label: "Défenseurs", unit: "DÉF", desc: "Titres de meilleur défenseur", value: (p) => p.def },
  { id: "presences", label: "Présences", unit: "M", desc: "Matchs joués cette saison", value: (p) => p.matchs, showAll: true },
  { id: "discipline", label: "Discipline", unit: "ABS", desc: "Absences injustifiées et suspensions", value: (p) => p.absInj ?? 0 },
];

function RankingList({ def, me }: { def: RankingDef; me: string }) {
  const ranked = rankByMetric(PLAYERS, def.value).filter(
    (p) => def.showAll || p.value > 0
  );

  if (ranked.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-8 text-center text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Personne dans ce classement — tout le monde est clean ✓
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">{def.desc}</p>
      <div className="flex px-3 pb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
        <span className="w-8">#</span>
        <span className="flex-1">Joueur</span>
        <span className="w-12">Poste</span>
        <span className="w-16 text-right">{def.unit}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {ranked.map((p) => {
          const isMe = p.name === me;
          return (
            <div
              key={p.name}
              className={cn(
                "flex items-center rounded-lg border px-3 py-2.5",
                isMe ? "border-primary/50 bg-primary/5" : "bg-card"
              )}
            >
              <span
                className={cn(
                  "font-display w-8 text-sm",
                  p.rank <= 3 ? "text-primary" : "text-muted-foreground"
                )}
              >
                {p.rank}
              </span>
              <span className="mr-2.5 flex size-7 items-center justify-center rounded-full border border-[#8A744A]/60 bg-[#241A10] font-display text-xs text-[#E8C87A]">
                {p.name[0]}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-semibold">{p.name}</span>
                {p.statut !== "Actif" && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "px-1.5 text-[9px] tracking-wide uppercase",
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
              <span
                className={cn(
                  "font-display w-16 text-right text-sm",
                  def.gold ? "text-[#c9962e] dark:text-[#E8C87A]" : "text-primary"
                )}
              >
                {p.value}
                <span className="ml-0.5 text-[9px]">{def.unit}</span>
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
    <div className="mt-4 rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="mb-1 flex items-center gap-2 font-display text-sm text-primary">
        <Vote className="size-4" /> VOTE DES FIGURES
        {complete && (
          <Badge className="ml-auto bg-emerald-600 text-white hover:bg-emerald-600">
            Voté ✓
          </Badge>
        )}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Tu votes en tant que <strong className="text-foreground">{me}</strong>. Vote
        enregistré sur cet appareil — la centralisation arrivera avec l&apos;interface
        admin.
      </p>
      <div className="flex flex-col gap-3">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{c.label}</div>
              <div className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {c.rule}
              </div>
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
                <SelectTrigger size="sm" aria-label={`Voter — ${c.label}`}>
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
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:py-10">
      <div>
        <h1 className="font-display text-3xl italic">
          STATIS<span className="text-primary">TIQUES</span>
        </h1>
        <p className="mt-1 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Saison 1 · Après la journée {JOURNEES.length}
        </p>
      </div>

      <Tabs defaultValue="classement">
        <TabsList className="w-full">
          <TabsTrigger value="classement" className="flex-1">
            Classement
          </TabsTrigger>
          <TabsTrigger value="matchs" className="flex-1">
            Matchs
          </TabsTrigger>
        </TabsList>

        {/* ===== CLASSEMENTS ===== */}
        <TabsContent value="classement" className="mt-4">
          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {RANKINGS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRanking(r.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                  ranking === r.id
                    ? "border-primary bg-primary text-primary-foreground"
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
                <div key={j.j} className="overflow-hidden rounded-xl border bg-card">
                  <button
                    onClick={() => setOpenJ(open ? 0 : j.j)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg">JOURNÉE {j.j}</span>
                        {j.sflTime && <Badge>SFL Time</Badge>}
                      </div>
                      <div className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                        {j.date}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {j.score ? (
                        <span className="font-display text-xl">
                          {j.score[0]} <span className="text-primary">–</span> {j.score[1]}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] uppercase">
                          Saisie incomplète
                        </Badge>
                      )}
                      <ChevronRight
                        className={cn(
                          "size-4 text-primary transition-transform",
                          open && "rotate-90"
                        )}
                      />
                    </div>
                  </button>

                  {open && (
                    <div className="border-t px-4 py-4">
                      {faits.length > 0 && (
                        <div className="mb-4">
                          <div className="mb-2 flex items-center gap-1.5 font-display text-sm text-[#c9962e] dark:text-[#E8C87A]">
                            <Star className="size-3.5" /> FAITS MARQUANTS
                          </div>
                          <div className="flex flex-col">
                            {faits.map(([label, value]) => (
                              <div key={label} className="border-b py-1.5 last:border-0">
                                <div className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                                  {label}
                                </div>
                                <div className="text-sm font-semibold">{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mb-2 font-display text-sm text-primary">FEUILLE DE MATCH</div>
                      <div className="flex flex-col">
                        {j.lignes.map(([name, res, buts, passes]) => (
                          <div
                            key={name}
                            className="flex items-center gap-2 border-b py-1.5 text-sm last:border-0"
                          >
                            <span
                              className={cn(
                                "w-5 font-black",
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
