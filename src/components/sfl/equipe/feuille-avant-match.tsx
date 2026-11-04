"use client";

// La feuille d'avant-match d'une équipe de Bola Team (Ilyes, 02/11/2026 :
// « une équipe = 7 joueurs + 1 entraîneur » ; règles officielles, docs 04
// §7 et 11 art. 6.5). C'est le geste de l'entraîneur : pour un match
// programmé, il met de 5 à 7 de ses joueurs sur la feuille, jusqu'au coup
// d'envoi, qui la fige. Le capitaine ou le vice la déposent quand l'équipe
// n'a pas d'entraîneur, ou à partir de 2 h avant le match si l'entraîneur
// ne l'a pas fait (peutDeposer, la même règle que la base).
//
// Les cartes des joueurs de l'équipe, au format moyen : on les touche pour
// les mettre sur la feuille ou les en retirer (celles qui n'y sont pas
// s'effacent) ; le compte « n / 7 » ; « Déposer la feuille », de 5 à 7.
// Déposée, l'en-tête dit qui l'a déposée et quand. À qui ne peut pas la
// déposer maintenant (le capitaine, quand l'entraîneur l'a déposée), la
// feuille telle qu'elle est, sans bouton. L'entraîneur n'y est jamais : il
// ne joue pas. Rien ne l'explique à l'écran ; les chiffres suffisent.

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import type { FeuilleTeam } from "@/lib/sfl/championnat-team";
import {
  FEUILLE_AVANT_MATCH,
  coupDEnvoi,
  deposerFeuille,
  direErreurEquipe,
  peutDeposer,
  signataires,
  type Defi,
  type Equipe,
  type Membre,
} from "@/lib/sfl/equipes";
import { libelleJour } from "@/lib/sfl/matchs";
import { cn } from "@/lib/utils";

const prenom = (nom: string) => nom.split(" ")[0];

/** « Feuille de Lucien · lun. 14:02 » : qui l'a déposée, et quand (heure de Paris). */
export function auteurFeuille(equipe: Equipe, f: FeuilleTeam): string {
  const par = equipe.membres.find((m) => m.id === f.par);
  const quand = new Intl.DateTimeFormat("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(f.le));
  return [par ? `Feuille de ${prenom(par.name)}` : "Feuille", quand].join(" · ");
}

export function FeuilleAvantMatch({
  defi,
  mienne,
  adverse,
  moi,
  apercu,
  maintenant,
  onOpenChange,
  onDepose,
}: {
  defi: Defi | null;
  mienne: Equipe | null;
  adverse: Pick<Equipe, "nom"> | null;
  /** Ma ligne dans l'équipe : mes droits. */
  moi: Membre | null;
  apercu?: boolean;
  maintenant?: Date;
  onOpenChange: (o: boolean) => void;
  onDepose: () => void;
}) {
  const ouverte = !!defi && !!mienne && !!adverse;
  return (
    <Sheet open={ouverte} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        {ouverte && (
          <Contenu
            key={`${defi.id}-${defi.feuilles?.find((f) => f.equipe === mienne.id)?.le ?? ""}`}
            defi={defi}
            mienne={mienne}
            adverse={adverse}
            moi={moi}
            apercu={apercu}
            maintenant={maintenant}
            onFait={() => {
              onOpenChange(false);
              onDepose();
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Contenu({
  defi,
  mienne,
  adverse,
  moi,
  apercu,
  maintenant,
  onFait,
}: {
  defi: Defi;
  mienne: Equipe;
  adverse: Pick<Equipe, "nom">;
  moi: Membre | null;
  apercu?: boolean;
  maintenant?: Date;
  onFait: () => void;
}) {
  const feuille = defi.feuilles?.find((f) => f.equipe === mienne.id) ?? null;
  const joueurs = useMemo(() => signataires(mienne), [mienne]);
  const ouverte = peutDeposer(moi, mienne.membres, feuille?.par, coupDEnvoi(defi), maintenant);
  // Ceux de la feuille qui sont encore dans l'équipe (un joueur parti n'y revient pas).
  const deja = useMemo(() => (feuille ? joueurs.filter((j) => feuille.joueurs.includes(j.id)).map((j) => j.id) : []), [feuille, joueurs]);
  const [choix, setChoix] = useState<string[]>(deja);
  const [envoi, setEnvoi] = useState(false);
  const n = choix.length;
  const change = !feuille || n !== deja.length || choix.some((id) => !deja.includes(id));
  const valide = n >= FEUILLE_AVANT_MATCH.min && n <= FEUILLE_AVANT_MATCH.max;
  const montres = ouverte ? joueurs : joueurs.filter((j) => deja.includes(j.id));

  const basculer = (id: string) => {
    if (!ouverte) return;
    setChoix((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= FEUILLE_AVANT_MATCH.max ? c : [...c, id]));
  };

  async function deposer() {
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    setEnvoi(true);
    try {
      // Dans l'ordre de l'équipe : capitaine, vice, puis les autres.
      await deposerFeuille(
        defi.id,
        joueurs.filter((j) => choix.includes(j.id)).map((j) => j.id)
      );
      navigator.vibrate?.([10, 40, 18]);
      toast.success("Feuille déposée.");
      onFait();
    } catch (e) {
      toast.error(direErreurEquipe(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-0">
        <SheetTitle className="pr-10 text-titre-m font-bold tracking-tight">Feuille de match</SheetTitle>
        <span className="mono-label text-muted-foreground">
          {adverse.nom} · {libelleJour(defi.jour)} · {defi.heure.slice(0, 5)}
        </span>
        {feuille && <span className="mono-label text-foreground">{auteurFeuille(mienne, feuille)}</span>}
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex items-baseline justify-between px-1">
          <span className="mono-label text-muted-foreground">Joueurs</span>
          <span className={cn("mono-label tabular-nums", valide ? "text-foreground" : "text-muted-foreground")}>
            {ouverte ? n : deja.length} / {FEUILLE_AVANT_MATCH.max}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-x-2 gap-y-3">
          {montres.map((j) => {
            const dessus = ouverte ? choix.includes(j.id) : true;
            const toi = j.id === moi?.id;
            return (
              <button
                key={j.id}
                type="button"
                onClick={() => basculer(j.id)}
                disabled={!ouverte}
                aria-pressed={ouverte ? dessus : undefined}
                aria-label={j.name}
                className="flex min-w-0 flex-col items-center gap-1.5 transition-transform active:scale-95 disabled:active:scale-100"
              >
                <span className={cn("relative flex transition-opacity", !dessus && "opacity-35")}>
                  <CarteDe name={j.name} size={FORMAT_CARTE.moyenne} inerte />
                  {ouverte && dessus && (
                    <span
                      aria-hidden
                      className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-foreground text-background ring-[3px] ring-background"
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className={cn("w-full truncate text-center text-ligne", toi ? "font-extrabold" : "font-semibold", !dessus && "text-muted-foreground")}>
                  {toi ? "Toi" : prenom(j.name)}
                </span>
              </button>
            );
          })}
        </div>
        {ouverte && (
          <Button variant="vert" disabled={envoi || !valide || !change} onClick={deposer} className="h-12 rounded-full text-lecture font-semibold">
            Déposer la feuille
          </Button>
        )}
      </div>
    </>
  );
}
