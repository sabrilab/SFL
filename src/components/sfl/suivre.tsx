"use client";

// Suivre un joueur (Sabri, 22/10 : « voir le nombre de followers de chaque
// utilisateur quand on clique sur sa carte […] qu'on puisse les suivre »).
// Le bouton et le nombre de ses abonnés se posent partout où l'on ouvre sa
// carte : son profil (profil-joueur.tsx), sa fiche de match
// (fiche-joueur.tsx), sa carte en grand (card-viewer.tsx). Toucher le nombre
// ouvre ses abonnés et ses abonnements, chacun en petite carte, qu'on suit
// d'ici.
//
// Le bouton est mauve (« les autres », boutons.css) tant qu'on ne suit pas ;
// suivi, il s'éteint en verre fumé. « Suivre en retour » quand c'est lui qui
// nous suit. Rien sur sa propre carte, ni pour un joueur sans compte.
// Les suivis vivent dans lib/sfl/suivis.ts.

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIdentites } from "@/hooks/use-identites";
import { useSuivis } from "@/hooks/use-suivis";
import { nePlusSuivre, suivre } from "@/lib/sfl/suivis";
import { cn } from "@/lib/utils";

export const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

/** Le bouton Suivre d'un joueur. */
export function BoutonSuivre({ nom, petit = false, className }: { nom: string; petit?: boolean; className?: string }) {
  const { me } = useMyPlayer();
  const s = useSuivis();
  if (!me || nom === me || !s.suivable(nom)) return null;
  const suivi = s.suit(me, nom);
  const retour = !suivi && s.suit(nom, me);

  async function basculer() {
    navigator.vibrate?.(8);
    const erreur = suivi ? await nePlusSuivre(me, nom) : await suivre(me, [nom]);
    if (erreur) toast.error(erreur);
  }

  return (
    <button
      type="button"
      aria-pressed={suivi}
      onClick={(e) => {
        e.stopPropagation();
        void basculer();
      }}
      className={cn(
        suivi ? "bouton-secondaire" : "bouton-principal bouton--mauve",
        "flex shrink-0 items-center justify-center gap-1.5 font-semibold whitespace-nowrap",
        petit ? "h-8 px-3.5 text-[13px]" : "h-10 px-6 text-[14px]",
        className
      )}
    >
      {suivi && <Check className={petit ? "size-3.5" : "size-4"} strokeWidth={2.4} />}
      {suivi ? "Suivi" : retour ? "Suivre en retour" : "Suivre"}
    </button>
  );
}

/** Le nombre d'abonnés d'un joueur, à toucher pour voir la liste. `children` : sa forme (un chiffre de tête, une ligne). */
export function Abonnes({ nom, children, className }: { nom: string; children: (n: number) => ReactNode; className?: string }) {
  const s = useSuivis();
  const [ouvert, setOuvert] = useState(false);
  if (!s.suivable(nom) && s.abonnes(nom).length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOuvert(true);
        }}
        className={cn("transition-transform active:scale-95 motion-reduce:transition-none", className)}
      >
        {children(s.abonnes(nom).length)}
      </button>
      <ListeSuivis nom={nom} ouvert={ouvert} onFermer={() => setOuvert(false)} />
    </>
  );
}

/** Ses abonnés, ses abonnements : chacun en petite carte, avec de quoi le suivre. */
function ListeSuivis({ nom, ouvert, onFermer }: { nom: string; ouvert: boolean; onFermer: () => void }) {
  const s = useSuivis();
  const id = useIdentites();
  const [onglet, setOnglet] = useState<"abonnes" | "abonnements">("abonnes");
  const listes = { abonnes: s.abonnes(nom), abonnements: s.abonnements(nom) };
  const noms = [...listes[onglet]].sort((a, b) => id.nom(a).localeCompare(id.nom(b), "fr"));

  return (
    <Sheet open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <SheetContent side="bottom" className="data-[side=bottom]:h-[80dvh] rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <div className="flex flex-col gap-1 px-5 pt-5">
          <SheetTitle className="titre-lettrage text-[24px] leading-[0.95] font-black">{id.nom(nom)}</SheetTitle>
          <SheetDescription className="font-mono text-[12px] text-muted-foreground">{id.pseudo(nom)}</SheetDescription>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
            {(
              [
                ["abonnes", pluriel(listes.abonnes.length, "abonné", "abonnés")],
                ["abonnements", pluriel(listes.abonnements.length, "abonnement", "abonnements")],
              ] as const
            ).map(([o, libelle]) => (
              <button
                key={o}
                type="button"
                onClick={() => setOnglet(o)}
                className={cn("py-2 text-[13.5px] font-semibold", onglet === o ? "bouton-principal" : "bouton-discret text-muted-foreground")}
              >
                <span className="tabular-nums">{listes[o].length}</span> {libelle}
              </button>
            ))}
          </div>
          <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-2">
            {noms.map((n) => (
              <div key={n} className="flex items-center gap-3 rounded-[18px] bg-card px-3 py-2.5">
                <CarteDe name={n} size={FORMAT_CARTE.petite} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">
                    <Nom n={n} />
                  </span>
                  <span className="truncate font-mono text-[12px] text-muted-foreground">{id.pseudo(n)}</span>
                </span>
                <BoutonSuivre nom={n} petit />
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
