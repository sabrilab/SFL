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
// suite si elle colle. Depuis le 03/11/2026, si l'équipe a déposé sa feuille
// d'avant-match, seuls ses joueurs marquent (la base le garde aussi) ; et
// sous chaque score, les présents de l'équipe (5+, 4, ≤ 3 : le 5 contre 4,
// Règlement Team art. 7.2 et 7.3), qui doivent coller eux aussi. À 4 face à
// 5 ou plus, le score final se lit sous la carte ; à 3 ou moins, c'est un
// forfait : plus de score du terrain ni de buteurs, le 0 – 3. Le score validé
// est le score final, « à 4 » sous l'équipe qui l'était. Après la fermeture
// (3 jours après le coup d'envoi), seule l'équipe qui répond à une saisie
// faite seule juste avant garde ses 24 h pour répondre (art. 8.7) ; pour
// l'autre, la feuille se lit sans bouton.

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { collent, coupDEnvoiTeam, etatMatch, fermeturePour, scoreFinal, type MatchTeam, type Presents } from "@/lib/sfl/championnat-team";
import { direErreurEquipe, saisirResultat, signataires, type Equipe, type EquipeTeam } from "@/lib/sfl/equipes";
import { quandTombe } from "@/lib/sfl/equipes-temps";
import { libelleJour } from "@/lib/sfl/matchs";
import { cn } from "@/lib/utils";

const PRESENTS: [Presents, string][] = [
  [5, "5+"],
  [4, "4"],
  [3, "≤ 3"],
];
const nomPresents = (p: Presents) => PRESENTS.find(([x]) => x === p)![1];

/** Les présents d'une équipe : cinq ou plus, quatre, trois ou moins. */
function ChoixPresents({ valeur, onChange, nom }: { valeur: Presents; onChange: (p: Presents) => void; nom: string }) {
  return (
    <div role="radiogroup" aria-label={`Présents · ${nom}`} className="flex w-full gap-1 rounded-full bg-secondary p-1">
      {PRESENTS.map(([p, t]) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={valeur === p}
          onClick={() => onChange(p)}
          className={cn(
            "h-10 min-w-0 flex-1 rounded-full text-ligne font-semibold tabular-nums transition-colors",
            valeur === p ? "bg-foreground text-background" : "text-muted-foreground"
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

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
      <span className={cn("text-center font-display tabular-nums", grand ? "w-12 text-affiche leading-none" : "w-5 text-titre")}>
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
  // Fermée pour moi : validée, non classée, ou passée sa fermeture (seule l'équipe qui répond à une saisie
  // faite seule juste avant la fermeture a encore ses 24 h : fermeturePour, la même règle que la base).
  const fermeePourMoi = etat.etat !== "a-venir" && (maintenant ?? new Date()).getTime() > fermeturePour(match, mienne.id).getTime();
  const ferme = etat.etat === "valide" || etat.etat === "non-classe" || fermeePourMoi;
  // Les buteurs et passeurs : les joueurs de la feuille d'avant-match, si elle a été déposée ; sinon ceux de l'équipe.
  const inscrits = match.feuilles?.find((f) => f.equipe === mienne.id)?.joueurs;
  const joueurs = signataires(mienne).filter((j) => !inscrits || inscrits.includes(j.id));
  const [pour, setPour] = useState(ma?.pour ?? leur?.contre ?? 0);
  const [contre, setContre] = useState(ma?.contre ?? leur?.pour ?? 0);
  // Les présents : ma saisie, sinon celle de l'autre vue de mon côté, sinon 5 et plus.
  const [presents, setPresents] = useState<Presents>(ma?.presents ?? leur?.presentsAdverses ?? 5);
  const [presentsAdv, setPresentsAdv] = useState<Presents>(ma?.presentsAdverses ?? leur?.presents ?? 5);
  const forfait = presents === 3 || presentsAdv === 3;
  // Mon côté d'abord : le score final, le forfait, le 5 contre 4.
  const sf = scoreFinal([pour, contre], [presents, presentsAdv]);
  const [lignes, setLignes] = useState<Record<string, { buts: number; passes: number }>>(() =>
    Object.fromEntries(match.buteurs.filter((b) => b.equipe === mienne.id).map((b) => [b.joueur, { buts: b.buts, passes: b.passes }]))
  );
  const [envoi, setEnvoi] = useState(false);
  const butsAttribues = useMemo(() => Object.values(lignes).reduce((n, l) => n + l.buts, 0), [lignes]);
  const passes = useMemo(() => Object.values(lignes).reduce((n, l) => n + l.passes, 0), [lignes]);
  const colle =
    !!leur &&
    collent(
      { equipe: mienne.id, pour: forfait ? 0 : pour, contre: forfait ? 0 : contre, le: "", presents, presentsAdverses: presentsAdv },
      leur
    );

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
      // À 3 ou moins d'un côté, le match ne s'est pas joué : ni score du terrain, ni buteurs.
      await saisirResultat(
        match.id,
        forfait ? 0 : pour,
        forfait ? 0 : contre,
        forfait
          ? []
          : Object.entries(lignes)
              .filter(([, l]) => l.buts + l.passes > 0)
              .map(([joueur, l]) => ({ joueur, ...l })),
        presents,
        presentsAdv
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
  // Fermée : le score validé (final), vu de mon côté, et qui était à 4.
  const valide = etat.etat === "valide" ? etat : null;
  const chezNous = match.de === mienne.id;
  const finalValide = valide ? (chezNous ? valide.final : ([valide.final[1], valide.final[0]] as [number, number])) : null;
  const leurPresents: [Presents, Presents] | null = leur ? [leur.presentsAdverses ?? 5, leur.presents ?? 5] : null;
  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-0">
        <SheetTitle className="pr-10 text-titre-m font-bold tracking-tight">Feuille de match</SheetTitle>
        <span className="mono-label text-muted-foreground">
          {libelleJour(match.jour)} · {match.heure} · {match.lieu}
        </span>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4">
        <div className="grid grid-cols-2 gap-3 rounded-[24px] bg-card p-4">
          {[
            { e: mienne, v: pour, set: changerPour, p: presents, setP: setPresents, i: 0 },
            { e: adverse, v: contre, set: setContre, p: presentsAdv, setP: setPresentsAdv, i: 1 },
          ].map(({ e, v, set, p, setP, i }) => (
            <div key={e.id} className="flex min-w-0 flex-col items-center gap-2.5">
              <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={52} />
              <span className="w-full truncate text-center text-ligne font-semibold">{e.nom}</span>
              {ferme ? (
                <>
                  <span className="font-display text-affiche leading-none tabular-nums">{finalValide ? finalValide[i] : v}</span>
                  {valide?.aQuatre === e.id && <span className="mono-label text-muted-foreground">à 4</span>}
                </>
              ) : (
                <>
                  {forfait ? (
                    <span className="flex h-11 items-center font-display text-affiche leading-none text-muted-foreground tabular-nums">
                      {sf.nonClasse ? "–" : sf.final[i]}
                    </span>
                  ) : (
                    <Pas grand valeur={v} onMoins={() => set(Math.max(0, v - 1))} onPlus={() => set(Math.min(99, v + 1))} />
                  )}
                  <span className="mono-label -mb-1 text-muted-foreground">Présents</span>
                  <ChoixPresents valeur={p} onChange={setP} nom={e.nom} />
                </>
              )}
            </div>
          ))}
        </div>
        {!ferme && (forfait || sf.aQuatre != null || sf.amical) && (
          <p className="mono-label -mt-2 text-center text-foreground tabular-nums">
            {sf.nonClasse
              ? "Non classé"
              : sf.forfait != null
                ? `Forfait · ${sf.forfait === 0 ? mienne.nom : adverse.nom}`
                : sf.amical
                  ? "Amical"
                  : `Final · ${sf.final[0]} – ${sf.final[1]}`}
          </p>
        )}

        {leur && !ferme && leurPresents && (
          <div
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-[16px] px-4 py-3",
              colle ? "bg-[#16924A]/12 text-[#0f6b35] dark:text-[#5fd08f]" : "bg-card"
            )}
          >
            <span className="mono-label opacity-75">Feuille de {adverse.nom}</span>
            <span className="flex items-center gap-3">
              <span className="flex flex-col items-center gap-1">
                <Ecusson initiales={mienne.initiales} fond={mienne.fond} blason={mienne.blason} taille={24} />
                {(leurPresents[0] !== 5 || leurPresents[1] !== 5) && <span className="mono-label tabular-nums">{nomPresents(leurPresents[0])}</span>}
              </span>
              <span className="font-display text-titre-m leading-none tabular-nums">
                {leurPresents[0] === 3 || leurPresents[1] === 3 ? "Forfait" : `${leur.contre} – ${leur.pour}`}
              </span>
              <span className="flex flex-col items-center gap-1">
                <Ecusson initiales={adverse.initiales} fond={adverse.fond} blason={adverse.blason} taille={24} />
                {(leurPresents[0] !== 5 || leurPresents[1] !== 5) && <span className="mono-label tabular-nums">{nomPresents(leurPresents[1])}</span>}
              </span>
            </span>
          </div>
        )}
        {etat.etat === "a-confirmer" && etat.par === mienne.id && (
          <p className="mono-label text-center text-muted-foreground">Validé {quandTombe(etat.vaut)} sans réponse</p>
        )}

        {!ferme && !forfait && (
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
                    <span className="min-w-0 flex-1 truncate text-lecture font-semibold">{j.name.split(" ")[0]}</span>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="mono-label text-encre-3">B</span>
                      <Pas valeur={l.buts} onMoins={() => changer(j.id, "buts", -1)} onPlus={() => changer(j.id, "buts", 1)} plusOff={butsAttribues >= pour} />
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="mono-label text-encre-3">P</span>
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
          etat.etat === "a-confirmer" ? null : (
            <p className="mono-label text-center text-muted-foreground">
              {etat.etat === "valide" ? "Validé" : etat.etat === "litige" ? "Litige" : "Non classé"} · {libelleJour(match.jour)}
            </p>
          )
        ) : (
          <Button
            variant="vert"
            disabled={envoi || coup.getTime() > (maintenant ?? new Date()).getTime() || (!forfait && (butsAttribues > pour || passes > butsAttribues))}
            onClick={valider}
            className="h-12 rounded-full text-lecture font-semibold"
          >
            {colle ? "Valider le match" : ma ? "Corriger la feuille" : "Envoyer la feuille"}
          </Button>
        )}
      </div>
    </>
  );
}
