"use client";

// L'arbitre d'un match : les arbitres de la ligue en cartes, un seul choisi.
// Journée en brouillon : il est gardé sur le match et écrit dans `arbitrages`
// à la publication. Journée en ligne : écrit tout de suite (designerArbitre),
// avec les équipes du moment.

import { toast } from "sonner";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useArbitres } from "@/hooks/use-arbitres";
import { designerArbitre } from "@/lib/sfl/arbitres";
import { poserArbitreDuMatch } from "@/lib/sfl/saisie/mutations";
import { numeroSaison, type MatchDuJour, type Saison } from "@/lib/sfl/saisie/types";
import { haptique } from "@/lib/sfl/haptique";
import { cn } from "@/lib/utils";
import { Feuille } from "./ui";

export function FeuilleArbitre({
  open,
  onOpenChange,
  saison,
  j,
  n,
  match,
  brouillon,
  faire,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saison: Saison;
  j: number;
  n: number;
  match: MatchDuJour | undefined;
  brouillon: boolean;
  faire: (f: (s: Saison) => Saison, label: string) => boolean;
}) {
  const arbitres = useArbitres();
  const actuel = brouillon ? (match?.arbitre ?? null) : (arbitres.duMatch(j, n - 1)?.arbitre ?? match?.arbitre ?? null);

  async function choisir(nom: string | null) {
    if (!match) return;
    haptique.choix();
    faire((s) => poserArbitreDuMatch(s, j, match.equipes, nom), `Arbitre du match ${n}`);
    if (!brouillon) {
      const err = await designerArbitre(numeroSaison(saison), j, n - 1, [...match.equipes], nom);
      if (err) toast(err);
    }
    onOpenChange(false);
  }

  return (
    <Feuille open={open} onOpenChange={onOpenChange} titre={`Arbitre du match ${n}`}>
      <div className="grid grid-cols-3 gap-3 min-[430px]:grid-cols-4">
        {arbitres.arbitres.map((nom) => (
          <button key={nom} type="button" onClick={() => void choisir(nom)} className="flex flex-col items-center gap-1 active:scale-95">
            <span className={cn("rounded-[14px] p-[3px]", actuel === nom && "bg-foreground")}>
              <CarteDe name={nom} size={FORMAT_CARTE.petite * 1.3} inerte />
            </span>
            <span className="max-w-full truncate text-[12px] font-semibold">
              <Nom n={nom} />
            </span>
          </button>
        ))}
      </div>
      {arbitres.arbitres.length === 0 && <p className="mono-label py-8 text-center text-foreground/40">0 arbitre</p>}
      {actuel && (
        <button type="button" onClick={() => void choisir(null)} className="bouton-discret h-11 text-[14px] font-semibold">
          Pas d&apos;arbitre
        </button>
      )}
    </Feuille>
  );
}
