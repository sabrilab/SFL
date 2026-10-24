"use client";

// Bravo : féliciter les joueurs d'une rubrique des Actus (Sabri, 22/10 : « que
// les joueurs puissent féliciter des joueurs pour leur achievement »). Un
// toucher félicite tous ceux de la rubrique (l'homme du dimanche, les deux
// du duo, ceux qui montent, l'équipe type…), sauf soi. Chacun en est prévenu
// sur son téléphone (« Kader t'a félicité · Pour ton titre d'homme du
// dimanche »), et la félicitation lui donne de l'XP : « +10 XP » monte du
// bouton tant qu'elle compte (lib/sfl/felicitations.ts). Le bouton allumé,
// un second toucher retire le bravo.
//
// Le nombre, à côté du mot, compte ceux qui ont félicité. Sur une rubrique
// qui ne parle que de soi, il reste seul, et le toucher montre qui.

import { useState } from "react";
import { toast } from "sonner";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useFelicitations } from "@/hooks/use-felicitations";
import { useIdentites } from "@/hooks/use-identites";
import type { Exploit } from "@/lib/sfl/exploits";
import { feliciter, RECUES_COMPTEES, retirerFelicitations, XP_RECUE } from "@/lib/sfl/felicitations";
import { isHidden } from "@/lib/sfl/hidden";
import { cn } from "@/lib/utils";

export function Bravo({ exploits }: { exploits: Exploit[] }) {
  const { me } = useMyPlayer();
  const f = useFelicitations();
  const id = useIdentites();
  const [liste, setListe] = useState(false);
  /** Change à chaque bravo donné : rejoue l'envol du « +10 XP ». */
  const [envol, setEnvol] = useState(0);
  const [xp, setXp] = useState(false);

  const visibles = exploits.filter((e) => !isHidden(e.nom));
  if (visibles.length === 0) return null;
  const cibles = visibles.filter((e) => e.nom !== me);
  const recues = visibles.flatMap((e) => f.pour(e.cle));
  const qui = [...new Set(recues.map((x) => x.de))];
  const mes = recues.filter((x) => x.de === me);
  const fait = cibles.length > 0 && cibles.every((e) => mes.some((x) => x.exploit === e.cle));

  // Ma rubrique : le nombre de ceux qui m'ont félicité, et leur liste.
  if (cibles.length === 0) {
    if (qui.length === 0) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => setListe(true)}
          aria-label={`${qui.length} ${qui.length > 1 ? "félicitations" : "félicitation"}`}
          className="bouton-secondaire bouton--mauve flex h-9 shrink-0 items-center gap-1.5 px-3.5 text-[13px] font-semibold tabular-nums"
        >
          <span aria-hidden>👏</span>
          {qui.length}
        </button>
        <Sheet open={liste} onOpenChange={setListe} titre="les félicitations">
          <SheetContent side="bottom" className="mx-auto max-h-[80dvh] w-full rounded-t-[28px] px-4 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:max-w-md">
            <div className="flex flex-col gap-1 px-1">
              <SheetTitle className="titre-lettrage text-[24px] leading-[0.95] font-black">
                {qui.length > 1 ? `${qui.length} joueurs t'ont félicité` : "Un joueur t'a félicité"}
              </SheetTitle>
              <SheetDescription className="font-mono text-[12px] text-muted-foreground">
                {visibles.length === 1 ? `J${visibles[0].j} · ${visibles[0].quoi}` : `J${visibles[0].j}`}
              </SheetDescription>
            </div>
            <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto pb-2">
              {[...recues]
                .sort((a, b) => b.le - a.le)
                .filter((x, i, l) => l.findIndex((y) => y.de === x.de) === i)
                .map((x) => (
                  <div key={x.de} className="flex items-center gap-3 rounded-[18px] bg-card px-3 py-2.5">
                    <CarteDe name={x.de} size={FORMAT_CARTE.petite} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">
                        <Nom n={x.de} />
                      </span>
                      <span className="truncate font-mono text-[12px] text-muted-foreground">{id.pseudo(x.de)}</span>
                    </span>
                  </div>
                ))}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  async function basculer() {
    navigator.vibrate?.(fait ? 6 : [8, 40, 8]);
    if (fait) {
      const erreur = await retirerFelicitations(
        me,
        cibles.map((e) => e.cle)
      );
      if (erreur) toast.error(erreur);
      return;
    }
    // Le « +10 XP » ne monte que si la félicitation compte encore pour l'un d'eux.
    const neufs = cibles.filter((e) => !mes.some((x) => x.exploit === e.cle));
    setXp(neufs.some((e) => f.pour(e.cle).filter((x) => x.de !== me).length < RECUES_COMPTEES));
    setEnvol((n) => n + 1);
    const erreur = await feliciter(me, neufs, recues);
    if (erreur) toast.error(erreur);
  }

  return (
    <span className="relative flex shrink-0">
      {envol > 0 && xp && (
        <span key={envol} aria-hidden className="bravo-xp pointer-events-none absolute bottom-full left-1/2 mb-1 font-mono text-[12px] font-bold whitespace-nowrap text-foreground">
          +{XP_RECUE} XP
        </span>
      )}
      <button
        type="button"
        aria-pressed={fait}
        onClick={() => void basculer()}
        className={cn(
          fait ? "bouton-principal" : "bouton-secondaire",
          "bouton--mauve flex h-9 items-center gap-1.5 px-3.5 text-[13px] font-semibold"
        )}
      >
        <span aria-hidden className={cn(envol > 0 && fait && "bravo-clap inline-block")} key={`clap-${envol}`}>
          👏
        </span>
        Bravo
        {qui.length > 0 && <span className="tabular-nums opacity-70">{qui.length}</span>}
      </button>
    </span>
  );
}
