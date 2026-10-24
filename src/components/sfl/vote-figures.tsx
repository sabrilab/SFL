"use client";

// Le vote du jour : Joueur Impact et meilleur défenseur, pour un adversaire
// de son match. On touche la carte de celui qu'on choisit ; on peut changer
// d'avis jusqu'à minuit. Les voix restent cachées tant que le vote est
// ouvert — seul le nombre de votants s'affiche — pour ne pas suivre la foule.
// Tant que la feuille de son match n'est pas remplie, le vote est là mais
// grisé, sans rien de touchable (feuilleRemplie, lib/sfl/votes.ts).
// Règles et décompte : lib/sfl/votes.ts.

import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { useVotes } from "@/hooks/use-votes";
import { useSession } from "@/hooks/use-session";
import { claimVoteReward } from "@/lib/sfl/ballons";
import { logActivity } from "@/lib/sfl/activity";
import { REGLE_VOTE } from "@/lib/sfl/convocation-temps";
import { findPlayerMatch, type Journee } from "@/lib/sfl/engine";
import {
  CATEGORIES_VOTE,
  LIBELLES_VOTE,
  decompterMatch,
  feuilleRemplie,
  monVote,
  voter,
  type CategorieVote,
} from "@/lib/sfl/votes";
import { cn } from "@/lib/utils";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";

export function VoteFigures({ journee, me }: { journee: Journee; me: string }) {
  const { saison, allPlayers } = useSeason();
  const session = useSession();
  const votes = useVotes();
  const [envoi, setEnvoi] = useState<CategorieVote | null>(null);
  const numero = saison.numero ?? 0;
  const place = findPlayerMatch(journee, me);
  const carte = (nom: string) => allPlayers.find((p) => p.name === nom);
  // Le vote attend la feuille de son match : avant, grisé.
  const ouvert = !!place && feuilleRemplie(saison, journee.j, place.match);

  async function choisir(cat: CategorieVote, candidat: string) {
    if (!place || !ouvert || envoi) return;
    setEnvoi(cat);
    try {
      await voter({ saison: numero, j: journee.j, categorie: cat, votant: me, candidat, match_id: place.match.id });
      toast.success(`${LIBELLES_VOTE[cat]} : ${candidat}`);
      if (claimVoteReward(me) > 0) toast.success("+1 Ballon ⚽", { description: "Vote du jour validé" });
      logActivity("vote", { meta: { categorie: cat } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vote impossible pour l'instant.");
    } finally {
      setEnvoi(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {place && !ouvert ? (
        <p className="rounded-2xl bg-foreground/[0.06] px-3.5 py-2.5 text-[12.5px] font-medium text-foreground/55">
          <span className="font-bold">Vote fermé</span>
          {` · Il s'ouvre quand la feuille du ${place.match.label} est remplie, jusqu'à minuit.`}
        </p>
      ) : (
        <p className="rounded-2xl bg-primary/10 px-3.5 py-2.5 text-[12.5px] font-medium text-primary">
          <span className="font-bold">Vote ouvert jusqu&apos;à minuit</span> · {REGLE_VOTE}
        </p>
      )}

      {!place ? (
        <p className="px-1 text-[13px] text-muted-foreground">Le vote est réservé aux joueurs de la journée.</p>
      ) : !session?.server ? (
        <p className="px-1 text-[13px] text-muted-foreground">Reconnecte-toi pour voter : ton vote doit être vu par toute la ligue.</p>
      ) : (
        CATEGORIES_VOTE.map((cat) => {
          const mien = monVote(votes, numero, journee.j, cat, me);
          const d = decompterMatch(votes, numero, journee.j, place.match, cat);
          return (
            <section
              key={cat}
              className={cn("flex flex-col gap-2.5", !ouvert && "pointer-events-none select-none opacity-40 grayscale")}
            >
              <div className="flex items-baseline justify-between px-1">
                <h3 className="text-[15px] font-bold tracking-tight">{LIBELLES_VOTE[cat]}</h3>
                <span className="mono-label text-foreground/40 tabular-nums">
                  {ouvert ? `${d.votants}/${d.inscrits} ont voté` : "Pas encore ouvert"}
                </span>
              </div>
              <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {place.opponents.players.map((p) => {
                  const joueur = carte(p.name);
                  const choisi = mien === p.name;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      disabled={!ouvert || envoi !== null}
                      onClick={() => choisir(cat, p.name)}
                      aria-pressed={choisi}
                      aria-label={`${LIBELLES_VOTE[cat]} : ${p.name}`}
                      className={cn(
                        "relative flex shrink-0 flex-col items-center gap-1.5 rounded-2xl p-1.5 transition-transform active:scale-95",
                        choisi ? "bg-primary/15 ring-2 ring-primary" : mien ? "opacity-55" : ""
                      )}
                    >
                      {joueur ? (
                        <PlayerCard player={joueur} mode="simple" size={FORMAT_CARTE.moyenne} />
                      ) : (
                        <span className="flex h-[114px] w-[77px] items-center justify-center rounded-xl bg-secondary text-2xl font-bold">
                          {p.name[0]}
                        </span>
                      )}
                      <span className="max-w-[80px] truncate text-[12px] font-semibold"><Nom n={p.name} /></span>
                      {choisi && (
                        <span className="absolute top-0 right-0 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
