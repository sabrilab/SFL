"use client";

// La feuille d'un match Bola Team (Règlement Team art. 8 ; Sabri, 24/10 :
// « les buts et les passes D peuvent être comptabilisés, mais ça donne mieux
// juste un classement des buteurs et des passeurs de ce championnat »).
//
// Le capitaine (ou son vice) y met le score final, son équipe d'abord, puis
// les buts et les passes de chacun de ses joueurs (un + et un − sous chaque
// carte). La feuille garde la règle à l'écran : pas plus de buts attribués
// que de buts marqués, pas plus de passes que de buts attribués. L'autre
// capitaine fait de même ; quand leurs deux scores collent, le match est
// validé et la feuille se ferme ; seule, une saisie vaut au bout de 24 h
// (lib/sfl/championnat-team.ts, etatMatch). Si l'autre a déjà saisi, sa
// feuille est posée sous le score, entre les deux écussons : on voit tout de
// suite si elle colle.

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { coupDEnvoiTeam, etatMatch, type MatchTeam } from "@/lib/sfl/championnat-team";
import { direErreurEquipe, saisirResultat, signataires, type Equipe, type EquipeTeam } from "@/lib/sfl/equipes";
import { quandTombe } from "@/lib/sfl/equipes-temps";
import { libelleJour } from "@/lib/sfl/matchs";
import { cn } from "@/lib/utils";

function Pas({ valeur, onMoins, onPlus, plusOff, grand }: { valeur: number; onMoins: () => void; onPlus: () => void; plusOff?: boolean; grand?: boolean }) {
  return (
    <div className={cn("flex items-center", grand ? "gap-3" : "gap-1")}>
      <button
        type="button"
        aria-label="Moins"
        onClick={onMoins}
        disabled={valeur <= 0}
        className={cn("bouton-secondaire grid place-items-center disabled:opacity-30", grand ? "size-11" : "size-8")}
      >
        <Minus className={grand ? "size-5" : "size-3.5"} strokeWidth={2.6} />
      </button>
      <span className={cn("text-center font-display tabular-nums", grand ? "w-12 text-[44px] leading-none" : "w-5 text-[17px]")}>
        {valeur}
      </span>
      <button
        type="button"
        aria-label="Plus"
        onClick={onPlus}
        disabled={plusOff}
        className={cn("bouton-secondaire grid place-items-center disabled:opacity-30", grand ? "size-11" : "size-8")}
      >
        <Plus className={grand ? "size-5" : "size-3.5"} strokeWidth={2.6} />
      </button>
    </div>
  );
}

export function FeuilleTeam({
  match,
  mienne,
  adverse,
  onOpenChange,
  apercu,
  onSaisie,
  maintenant,
}: {
  match: MatchTeam | null;
  mienne: Equipe | null;
  adverse: EquipeTeam | Equipe | null;
  onOpenChange: (o: boolean) => void;
  apercu?: boolean;
  onSaisie: () => void;
  maintenant?: Date;
}) {
  const ouverte = !!match && !!mienne && !!adverse;
  return (
    <Sheet open={ouverte} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        {ouverte && (
          <Contenu
            key={match.id}
            match={match}
            mienne={mienne}
            adverse={adverse}
            apercu={apercu}
            maintenant={maintenant}
            onFait={() => {
              onOpenChange(false);
              onSaisie();
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Contenu({
  match,
  mienne,
  adverse,
  apercu,
  maintenant,
  onFait,
}: {
  match: MatchTeam;
  mienne: Equipe;
  adverse: EquipeTeam | Equipe;
  apercu?: boolean;
  maintenant?: Date;
  onFait: () => void;
}) {
  const ma = match.saisies.find((s) => s.equipe === mienne.id) ?? null;
  const leur = match.saisies.find((s) => s.equipe !== mienne.id) ?? null;
  const etat = etatMatch(match, maintenant);
  const ferme = etat.etat === "valide" || etat.etat === "non-classe";
  const joueurs = signataires(mienne);
  const [pour, setPour] = useState(ma?.pour ?? leur?.contre ?? 0);
  const [contre, setContre] = useState(ma?.contre ?? leur?.pour ?? 0);
  const [lignes, setLignes] = useState<Record<string, { buts: number; passes: number }>>(() =>
    Object.fromEntries(match.buteurs.filter((b) => b.equipe === mienne.id).map((b) => [b.joueur, { buts: b.buts, passes: b.passes }]))
  );
  const [envoi, setEnvoi] = useState(false);
  const butsAttribues = useMemo(() => Object.values(lignes).reduce((n, l) => n + l.buts, 0), [lignes]);
  const passes = useMemo(() => Object.values(lignes).reduce((n, l) => n + l.passes, 0), [lignes]);
  const colle = !!leur && leur.pour === contre && leur.contre === pour;

  const changer = (id: string, cle: "buts" | "passes", d: number) =>
    setLignes((x) => {
      const l = x[id] ?? { buts: 0, passes: 0 };
      return { ...x, [id]: { ...l, [cle]: Math.max(0, l[cle] + d) } };
    });
  const changerPour = (v: number) => {
    setPour(v);
    // Moins de buts marqués que de buts attribués : on retire les derniers.
    if (v < butsAttribues) setLignes({});
  };

  async function valider() {
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    setEnvoi(true);
    try {
      await saisirResultat(
        match.id,
        pour,
        contre,
        Object.entries(lignes)
          .filter(([, l]) => l.buts + l.passes > 0)
          .map(([joueur, l]) => ({ joueur, ...l }))
      );
      navigator.vibrate?.([10, 40, 18]);
      toast.success(colle ? "Match validé." : `Feuille envoyée à ${adverse.nom}.`);
      onFait();
    } catch (e) {
      toast.error(direErreurEquipe(e));
    } finally {
      setEnvoi(false);
    }
  }

  const coup = coupDEnvoiTeam(match);
  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-0">
        <SheetTitle className="pr-10 text-[22px] font-bold tracking-tight">Feuille de match</SheetTitle>
        <span className="mono-label text-muted-foreground">
          {libelleJour(match.jour)} · {match.heure} · {match.lieu}
        </span>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4">
        <div className="grid grid-cols-2 gap-3 rounded-[24px] bg-card p-4">
          {[
            { e: mienne, v: pour, set: changerPour },
            { e: adverse, v: contre, set: setContre },
          ].map(({ e, v, set }) => (
            <div key={e.id} className="flex min-w-0 flex-col items-center gap-2.5">
              <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={52} />
              <span className="w-full truncate text-center text-[14px] font-semibold">{e.nom}</span>
              {ferme ? (
                <span className="font-display text-[44px] leading-none tabular-nums">{v}</span>
              ) : (
                <Pas grand valeur={v} onMoins={() => set(Math.max(0, v - 1))} onPlus={() => set(Math.min(99, v + 1))} />
              )}
            </div>
          ))}
        </div>

        {leur && !ferme && (
          <div
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-[16px] px-4 py-3",
              colle ? "bg-[#16924A]/12 text-[#0f6b35] dark:text-[#5fd08f]" : "bg-card"
            )}
          >
            <span className="mono-label opacity-75">Feuille de {adverse.nom}</span>
            <span className="flex items-center gap-3">
              <Ecusson initiales={mienne.initiales} fond={mienne.fond} blason={mienne.blason} taille={24} />
              <span className="font-display text-[22px] leading-none tabular-nums">
                {leur.contre} – {leur.pour}
              </span>
              <Ecusson initiales={adverse.initiales} fond={adverse.fond} blason={adverse.blason} taille={24} />
            </span>
          </div>
        )}
        {etat.etat === "a-confirmer" && etat.par === mienne.id && (
          <p className="mono-label text-center text-muted-foreground">Validé {quandTombe(etat.vaut)} sans réponse</p>
        )}

        {!ferme && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between px-1">
              <span className="mono-label text-muted-foreground">Buteurs et passeurs</span>
              <span className="mono-label text-muted-foreground tabular-nums">
                {butsAttribues} / {pour} B · {passes} P
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {joueurs.map((j) => {
                const l = lignes[j.id] ?? { buts: 0, passes: 0 };
                return (
                  <div key={j.id} className="flex items-center gap-3 rounded-[18px] bg-card px-3 py-2">
                    <CarteDe name={j.name} size={FORMAT_CARTE.petite} />
                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{j.name.split(" ")[0]}</span>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="mono-label text-foreground/40">B</span>
                      <Pas valeur={l.buts} onMoins={() => changer(j.id, "buts", -1)} onPlus={() => changer(j.id, "buts", 1)} plusOff={butsAttribues >= pour} />
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="mono-label text-foreground/40">P</span>
                      <Pas
                        valeur={l.passes}
                        onMoins={() => changer(j.id, "passes", -1)}
                        onPlus={() => changer(j.id, "passes", 1)}
                        plusOff={passes >= butsAttribues}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {ferme ? (
          <p className="mono-label text-center text-muted-foreground">
            {etat.etat === "valide" ? "Validé" : "Non classé"} · {libelleJour(match.jour)}
          </p>
        ) : (
          <Button
            variant="vert"
            disabled={envoi || coup.getTime() > (maintenant ?? new Date()).getTime() || butsAttribues > pour || passes > butsAttribues}
            onClick={valider}
            className="h-12 rounded-full text-[15px] font-semibold"
          >
            {colle ? "Valider le match" : ma ? "Corriger la feuille" : "Envoyer la feuille"}
          </Button>
        )}
      </div>
    </>
  );
}
