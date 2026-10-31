"use client";

// Les résultats des votes Impact / Défensive, pour l'admin (Feuille → Votes).
//
// Sabri, 25/10 : « Est-ce que tu peux montrer dans l'espace admin les
// résultats des votes ? » Côté joueurs, les voix restent cachées tant que le
// vote est ouvert (vote-figures.tsx) ; ici l'admin voit tout, à tout moment :
// journée par journée, match par match, les voix de chaque candidat, les élus
// (ex æquo compris), qui a voté et qui ne l'a pas fait. Les bulletins qui ne
// comptent nulle part (coéquipier, joueur changé de match après coup) sont
// listés à part, avec leur raison, pour qu'un écart se comprenne d'un coup
// d'œil. Calcul : bilanJournee (lib/sfl/votes.ts), le même décompte que
// appliquerVotes.

import { useMemo, useState } from "react";
import { Crown, Vote } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { useVotes } from "@/hooks/use-votes";
import { useSession } from "@/hooks/use-session";
import { voteOuvert } from "@/lib/sfl/convocation-temps";
import { CATEGORIES_VOTE, LIBELLES_VOTE, bilanJournee, journeeAvecVote, type Decompte } from "@/lib/sfl/votes";
import { Nom } from "@/components/sfl/nom";
import { cn } from "@/lib/utils";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Colonne({ titre, d }: { titre: string; d: Decompte }) {
  const max = d.voix[0]?.[1] ?? 0;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-corps font-bold">{titre}</span>
        <span className="text-legende text-muted-foreground tabular-nums">
          {d.votants}/{d.inscrits} ont voté
        </span>
      </div>
      {d.voix.length === 0 ? (
        <p className="text-petit text-muted-foreground">Aucune voix.</p>
      ) : (
        d.voix.map(([nom, n]) => {
          const elu = d.elus.includes(nom);
          return (
            <div key={nom} className="flex items-center gap-2">
              <span className={cn("flex min-w-0 flex-1 items-center gap-1 text-corps", elu ? "font-bold" : "text-encre-2")}>
                {elu && <Crown className="size-3.5 shrink-0" />}
                <span className="truncate"><Nom n={nom} /></span>
              </span>
              <span className="relative h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-foreground/10">
                <span
                  className={cn("absolute inset-y-0 left-0 rounded-full", elu ? "bg-foreground" : "bg-foreground/35")}
                  style={{ width: `${pct(n, max)}%` }}
                />
              </span>
              <span className="w-5 shrink-0 text-right text-corps font-semibold tabular-nums">{n}</span>
            </div>
          );
        })
      )}
      {d.elus.length > 1 && (
        <span className="text-legende font-semibold text-muted-foreground">Ex æquo · {d.elus.length} élus</span>
      )}
    </div>
  );
}

/** `j` : la journée ouverte d'abord (la page de la journée) ; sinon la dernière avec vote. */
export function ResultatsVotes({ j }: { j?: number } = {}) {
  const { saison, journees } = useSeason();
  const votes = useVotes();
  const session = useSession();
  const numero = saison.numero ?? 0;
  const avecVote = useMemo(() => journees.filter(journeeAvecVote).sort((a, b) => b.j - a.j), [journees]);
  const [choix, setChoix] = useState<number | null>(j ?? null);
  const jn = avecVote.find((x) => x.j === choix) ?? avecVote[0];
  const bilan = useMemo(() => (jn ? bilanJournee(votes, numero, jn) : null), [votes, numero, jn]);

  if (!session?.server) {
    return <p className="px-1 text-corps text-muted-foreground">Reconnecte-toi pour lire les votes.</p>;
  }
  if (!jn || !bilan) {
    return <p className="px-1 text-corps text-muted-foreground">Aucune journée avec vote pour l&apos;instant.</p>;
  }
  const ouvert = voteOuvert(jn.date, new Date());

  return (
    <div className="flex flex-col gap-3">
      {avecVote.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {avecVote.map((x) => (
            <button
              key={x.j}
              type="button"
              onClick={() => setChoix(x.j)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-corps font-semibold",
                x.j === jn.j ? "bouton-principal" : "bouton-discret text-encre-3"
              )}
            >
              J{x.j}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-3xl bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Vote className="size-4" />
            <span className="text-lg font-bold tracking-tight">Journée {jn.j}</span>
            <span className="text-corps text-muted-foreground">{jn.date}</span>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-legende font-bold",
              ouvert ? "bg-primary/12 text-primary" : "bg-foreground/[0.08] text-encre-2"
            )}
          >
            {ouvert ? "Ouvert jusqu'à minuit" : "Fermé"}
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{bilan.votants}</span>
          <span className="text-ligne text-muted-foreground">
            votants sur {bilan.inscrits} · {pct(bilan.votants, bilan.inscrits)} %
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start">
        {bilan.matchs.map(({ match, parCategorie, ontVote, nontPasVote }) => (
          <div key={match.id} className="overflow-hidden rounded-3xl bg-card">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <span className="text-base font-bold tracking-tight">{match.label}</span>
              <span className="truncate text-corps text-muted-foreground">
                {match.teamA.name} {match.teamA.score} – {match.teamB.score} {match.teamB.name}
              </span>
            </div>
            <div className="flex flex-col gap-4 border-t border-border/60 px-4 py-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {CATEGORIES_VOTE.map((cat) => (
                  <Colonne key={cat} titre={LIBELLES_VOTE[cat]} d={parCategorie[cat]} />
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-petit font-semibold text-muted-foreground tabular-nums">
                  Ont voté · {ontVote.length}/{ontVote.length + nontPasVote.length}
                </span>
                <div className="flex flex-wrap gap-1">
                  {ontVote.map((n) => (
                    <span key={n} className="rounded-full bg-foreground/[0.08] px-2 py-0.5 text-petit font-medium">
                      <Nom n={n} />
                    </span>
                  ))}
                  {nontPasVote.map((n) => (
                    <span key={n} className="rounded-full px-2 py-0.5 text-petit text-encre-4 ring-1 ring-foreground/10">
                      <Nom n={n} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {bilan.ecartees.length > 0 && (
        <div className="rounded-3xl bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Voix non comptées · {bilan.ecartees.length}</div>
          <div className="flex flex-col gap-1">
            {bilan.ecartees.map((v, i) => (
              <div key={i} className="text-corps">
                <span className="font-medium"><Nom n={v.votant} /></span>
                <span className="text-muted-foreground"> → </span>
                <span className="font-medium"><Nom n={v.candidat} /></span>
                <span className="text-muted-foreground"> · {LIBELLES_VOTE[v.categorie]} · {v.raison}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
