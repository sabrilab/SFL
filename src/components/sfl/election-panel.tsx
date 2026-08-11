"use client";

// Élection des figures de match en 2 phases, adverse uniquement :
// Phase 1 — chaque équipe nomine un adversaire (par match).
// Phase 2 — finale du jour, tous les participants votent parmi les nominés.

import { useState } from "react";
import { Trophy, Vote } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/sfl/activity";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/hooks/use-is-client";
import { findPlayerMatch, type Journee, type JourneeMatch } from "@/lib/sfl/engine";
import {
  CATEGORY_LABELS,
  castPhase1Vote,
  castPhase2Vote,
  getPhase1Vote,
  getPhase2Vote,
  tallyMatch,
  tallyPhase2,
  type BoostCategory,
} from "@/lib/sfl/votes";
import { claimVoteReward } from "@/lib/sfl/ballons";

// +1 Ballon au premier vote du jour, avec un toast dédié.
function rewardVote(me: string) {
  if (claimVoteReward(me) > 0) {
    toast.success("+1 Ballon ⚽", { description: "Vote du jour validé" });
  }
}

const CATEGORIES: BoostCategory[] = ["mvp", "impact", "def"];

function TeamNominationRow({
  j,
  match,
  category,
  me,
  voterTeamKey,
  onVoteCast,
}: {
  j: number;
  match: JourneeMatch;
  category: BoostCategory;
  me: string;
  voterTeamKey: "fromA" | "fromB";
  onVoteCast: () => void;
}) {
  const tally = tallyMatch(j, match, category)[voterTeamKey];
  const voters = tally.voters;
  const candidates = tally.candidates;
  const iAmVoter = voters.players.some((p) => p.name === me);
  const myVote = iAmVoter ? getPhase1Vote(j, match.id, category, me) : null;

  function vote(candidate: string) {
    castPhase1Vote(j, match.id, category, me, candidate);
    onVoteCast();
    toast.success(`Nomination enregistrée : ${candidate}`, {
      description: `${voters.name} → ${CATEGORY_LABELS[category]}`,
    });
    rewardVote(me);
    logActivity("vote", { meta: { categorie: category } });
  }

  const sorted = [...candidates.players].sort(
    (a, b) => (tally.votes[b.name] ?? 0) - (tally.votes[a.name] ?? 0)
  );

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-secondary/50 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">
          {voters.name} <span className="text-muted-foreground">vote pour un adversaire</span>
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          {tally.votedCount}/{tally.totalVoters} votes
        </span>
      </div>

      {iAmVoter && (
        <Select value={myVote ?? null} onValueChange={(v) => vote(v as string)}>
          <SelectTrigger
            size="sm"
            aria-label={`Nomination ${voters.name}`}
            className="rounded-full bg-background dark:bg-background"
          >
            <SelectValue placeholder={`Choisir dans ${candidates.name}…`} />
          </SelectTrigger>
          <SelectContent>
            {candidates.players.map((p) => (
              <SelectItem key={p.name} value={p.name}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex flex-wrap gap-1.5">
        {sorted
          .filter((p) => (tally.votes[p.name] ?? 0) > 0)
          .map((p) => (
            <span
              key={p.name}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                tally.leader === p.name
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              )}
            >
              {p.name} · {tally.votes[p.name]}
            </span>
          ))}
        {tally.votedCount === 0 && (
          <span className="text-[11px] text-muted-foreground italic">Aucun vote pour l&apos;instant</span>
        )}
      </div>
    </div>
  );
}

function Phase2Panel({
  journee,
  category,
  me,
  onVoteCast,
}: {
  journee: Journee;
  category: BoostCategory;
  me: string;
  onVoteCast: () => void;
}) {
  const tally = tallyPhase2(journee, category);

  if (tally.nominees.length === 0) {
    return (
      <p className="rounded-2xl bg-secondary/50 p-3.5 text-[13px] text-muted-foreground">
        En attente des nominations de chaque équipe pour lancer la finale.
      </p>
    );
  }

  if (!tally.allNominationsReady) {
    return (
      <p className="rounded-2xl bg-secondary/50 p-3.5 text-[13px] text-muted-foreground">
        En attente des nominations de chaque équipe ({tally.nominees.length}/
        {(journee.matches?.length ?? 0) * 2}) avant d&apos;ouvrir la finale.
      </p>
    );
  }

  const uniqueNames = [...new Set(tally.nominees.map((n) => n.name))];
  const isParticipant = !!findPlayerMatch(journee, me);
  const myVote = isParticipant ? getPhase2Vote(journee.j, category, me) : null;
  const options = uniqueNames.filter((n) => n !== me);

  function vote(candidate: string) {
    castPhase2Vote(journee.j, category, me, candidate);
    onVoteCast();
    toast.success(`Vote final enregistré : ${candidate}`, {
      description: CATEGORY_LABELS[category],
    });
    rewardVote(me);
    logActivity("vote", { meta: { categorie: category } });
  }

  const sorted = [...uniqueNames].sort((a, b) => (tally.votes[b] ?? 0) - (tally.votes[a] ?? 0));

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-primary/25 bg-primary/[0.05] p-3.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Vote className="size-3.5 text-primary" /> Finale du jour
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">
          {tally.votedCount}/{tally.totalVoters} votes
        </span>
      </div>

      {tally.decided ? (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
          <Trophy className="size-4" /> Carte attribuée à {tally.leader}
        </div>
      ) : (
        options.length > 0 &&
        isParticipant && (
          <Select value={myVote ?? null} onValueChange={(v) => vote(v as string)}>
            <SelectTrigger
              size="sm"
              aria-label="Vote final"
              className="rounded-full bg-background dark:bg-background"
            >
              <SelectValue placeholder="Élire le vainqueur…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      )}

      {!tally.decided && (
        <p className="text-[11px] text-muted-foreground">
          {tally.tie
            ? "Égalité pour l'instant — le vote continue."
            : tally.leader
              ? `En tête : ${tally.leader}`
              : "En attente des premiers votes."}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {sorted.map((name) => (
          <span
            key={name}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              tally.leader === name
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground"
            )}
          >
            {name} · {tally.votes[name] ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ElectionPanel({ journee, me }: { journee: Journee; me: string }) {
  const isClient = useIsClient();
  const [category, setCategory] = useState<BoostCategory>("mvp");
  // Un seul "tick" partagé : toute nomination ou vote final force le
  // recalcul de TOUS les panneaux (nominations + finale), qui lisent tous
  // localStorage directement au rendu — sinon la finale ne verrait pas
  // une nomination qui vient d'être posée par un panneau frère.
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);

  if (!journee.matches || journee.matches.length === 0) {
    return (
      <p className="rounded-2xl bg-secondary/50 p-4 text-sm text-muted-foreground">
        Feuille de match pas encore renseignée par l&apos;admin — composition des
        équipes inconnue, vote indisponible pour cette journée.
      </p>
    );
  }

  if (!isClient) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors",
              category === c
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {journee.matches.map((match) => (
        <div key={match.id} className="flex flex-col gap-2">
          <p className="px-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            {match.label} · {match.teamA.name} {match.teamA.score}–{match.teamB.score}{" "}
            {match.teamB.name}
          </p>
          <TeamNominationRow
            j={journee.j}
            match={match}
            category={category}
            me={me}
            voterTeamKey="fromA"
            onVoteCast={refresh}
          />
          <TeamNominationRow
            j={journee.j}
            match={match}
            category={category}
            me={me}
            voterTeamKey="fromB"
            onVoteCast={refresh}
          />
        </div>
      ))}

      <Phase2Panel journee={journee} category={category} me={me} onVoteCast={refresh} />
    </div>
  );
}
