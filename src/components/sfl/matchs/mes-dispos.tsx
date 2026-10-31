"use client";

// Mes dispos : la semaine qui vient, trois moments par jour. Je touche quand
// je suis libre ; chaque case dit combien d'autres le sont aussi. En dessous,
// pour chacun de mes moments, qui est libre avec moi — et de quoi ouvrir le
// match tout de suite. C'est le matchmaking : voir où et avec qui jouer.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { QuiVient } from "@/components/sfl/qui-vient";
import { direErreur, listerDispos, MOMENTS, poserDispo, prochainsJours, type Dispo, type Moment } from "@/lib/sfl/matchs";
import { cn } from "@/lib/utils";

const JOURS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const HEURE: Record<Moment, string> = { matin: "10:00", "apres-midi": "15:00", soir: "19:00" };

function nomJour(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

export function MesDispos({
  open,
  onOpenChange,
  moi,
  onOuvrir,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  moi: string | null;
  /** Ouvrir un match à ce moment-là, avec ceux qui sont libres. */
  onOuvrir: (jour: string, heure: string) => void;
}) {
  const jours = useMemo(() => prochainsJours(7), []);
  const [dispos, setDispos] = useState<Dispo[]>([]);

  const charger = useCallback(() => {
    listerDispos(jours[0], jours[jours.length - 1])
      .then(setDispos)
      .catch(() => setDispos([]));
  }, [jours]);
  useEffect(() => {
    if (open) charger();
  }, [open, charger]);

  const cle = (j: string, m: Moment) => `${j}|${m}`;
  const miennes = new Set(dispos.filter((d) => d.playerId === moi).map((d) => cle(d.jour, d.moment)));
  const autres = new Map<string, string[]>();
  for (const d of dispos) {
    if (d.playerId === moi) continue;
    const k = cle(d.jour, d.moment);
    autres.set(k, [...(autres.get(k) ?? []), d.name]);
  }

  async function basculer(jour: string, moment: Moment) {
    const libre = !miennes.has(cle(jour, moment));
    // Tout de suite à l'écran ; la base suit.
    setDispos((l) =>
      libre
        ? [...l, { playerId: moi ?? "", name: "", jour, moment }]
        : l.filter((d) => !(d.playerId === moi && d.jour === jour && d.moment === moment))
    );
    try {
      await poserDispo(jour, moment, libre);
    } catch (e) {
      toast.error(direErreur(e));
      charger();
    }
  }

  const ensemble = jours.flatMap((j) =>
    MOMENTS.filter((m) => miennes.has(cle(j, m.id)) && (autres.get(cle(j, m.id))?.length ?? 0) > 0).map((m) => ({
      jour: j,
      moment: m,
      noms: autres.get(cle(j, m.id))!,
    }))
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-titre-g font-bold tracking-tight">Mes dispos</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-1.5">
            <span />
            {MOMENTS.map((m) => (
              <span key={m.id} className="mono-label text-center text-muted-foreground">
                {m.libelle}
              </span>
            ))}
            {jours.map((j) => (
              <div key={j} className="contents">
                <span className="self-center pr-2 text-corps font-semibold">{nomJour(j)}</span>
                {MOMENTS.map((m) => {
                  const a = miennes.has(cle(j, m.id));
                  const n = autres.get(cle(j, m.id))?.length ?? 0;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!moi}
                      aria-pressed={a}
                      aria-label={`${nomJour(j)} ${m.libelle}${n ? `, ${n} autres libres` : ""}`}
                      onClick={() => basculer(j, m.id)}
                      className={cn(
                        "h-11 rounded-2xl text-corps font-semibold tabular-nums",
                        a ? "bouton-principal bouton--vert" : "bouton-secondaire text-muted-foreground"
                      )}
                    >
                      {n > 0 ? `+${n}` : ""}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {ensemble.map((e) => (
            <section key={cle(e.jour, e.moment.id)} className="rounded-[26px] bg-card p-5">
              <p className="mono-label text-muted-foreground">
                {nomJour(e.jour)} · {e.moment.libelle} · libres avec toi
              </p>
              <QuiVient className="mt-3" noms={e.noms} />
              <button
                type="button"
                onClick={() => onOuvrir(e.jour, HEURE[e.moment.id])}
                className="bouton-principal bouton--vert mt-3 flex h-11 w-full items-center justify-center text-ligne font-semibold"
              >
                Ouvrir un match
              </button>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
