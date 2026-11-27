"use client";

// Le programme d'un entraînement (Bola Club), l'onglet « Programme » de sa
// page (seance.tsx) : ses exercices dans l'ordre, numérotés, chacun avec ses
// minutes en − / + (de 5 en 5), et la durée totale en tête. Toucher un
// exercice ouvre sa fiche (déroulé, matériel), où on le monte, le descend ou
// le retire ; « Ajouter un exercice » ouvre la bibliothèque (exercices.tsx) ;
// un programme vide se reprend d'un autre entraînement de ses catégories. Il
// s'écrit jusqu'au jour de la séance ; après, il se lit. Rien n'est envoyé.

import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { jourLong } from "@/lib/sfl/club/actus";
import { dureeProgramme, exerciceDe, programmeDit } from "@/lib/sfl/club/exercices";
import { ajouterAuProgramme, minutesDansProgramme, rangerDansProgramme, reprendreProgramme, retirerDuProgramme } from "@/lib/sfl/club/mutations";
import { programmesAReprendre } from "@/lib/sfl/club/planning";
import { categorieDe } from "@/lib/sfl/club/regles";
import type { Seance as SeanceClub } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { DetailExercice, exerciceDit, ListeExercices } from "./exercices";
import { Feuille, FICHE, NOMBRE } from "./puces";

const ROND =
  "bouton-secondaire relative grid size-9 shrink-0 place-items-center after:absolute after:-inset-1 after:content-['']";

export function Programme({ s }: { s: SeanceClub }) {
  const { club, moi, agir } = useClub();
  const [bibli, setBibli] = useState(false);
  const [reprise, setReprise] = useState(false);
  const [fiche, setFiche] = useState<number | null>(null);
  const lignes = s.programme ?? [];
  // Il s'écrit jusqu'au jour de la séance ; une séance passée se lit.
  const ecrit = s.jour >= club.jour;
  const reprises =
    ecrit && !lignes.length
      ? programmesAReprendre(club, moi, s.id).slice(0, 6)
      : [];
  const ouverte = fiche !== null ? lignes[fiche] : undefined;
  const exo = ouverte ? exerciceDe(club, ouverte.exercice) : null;
  return (
    <>
      {lignes.length > 0 && (
        <div className="flex items-baseline justify-between gap-3">
          <span style={{ ...NOMBRE, fontSize: 44 }} className="tabular-nums">
            {dureeProgramme(lignes)}
            <span className="ml-1.5 text-[22px]">min</span>
          </span>
          <span className="mono-label text-encre-3">
            {programmeDit(lignes)?.split(" · ")[0]}
          </span>
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {lignes.map((l, i) => {
          const e = exerciceDe(club, l.exercice);
          return (
            <li
              key={`${l.exercice}-${i}`}
              className={cn(FICHE, "flex items-center gap-3 py-3 pr-3 pl-4")}
            >
              <span
                style={{ ...NOMBRE, fontSize: 26 }}
                className="w-6 shrink-0 text-center text-encre-3 tabular-nums"
              >
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => setFiche(i)}
                className="flex min-w-0 flex-1 flex-col gap-1 text-left"
              >
                <span className="text-lecture font-semibold text-balance">
                  {e?.nom ?? "Exercice retiré"}
                </span>
                {e && (
                  <span className="mono-label text-encre-3">
                    {exerciceDit(e, l.minutes).split(" · ")[0]}
                  </span>
                )}
              </button>
              {ecrit ? (
                <span
                  role="group"
                  aria-label={`Minutes de ${e?.nom ?? "l'exercice"}`}
                  className="flex shrink-0 items-center gap-1"
                >
                  <button
                    type="button"
                    aria-label="5 minutes de moins"
                    disabled={l.minutes <= 5}
                    onClick={() =>
                      agir((c, m) =>
                        minutesDansProgramme(c, m, s.id, i, l.minutes - 5),
                      )
                    }
                    className={ROND}
                  >
                    <Minus className="size-4" strokeWidth={2.4} />
                  </button>
                  <span className="w-[3.25rem] text-center text-corps font-semibold tabular-nums">
                    {l.minutes} min
                  </span>
                  <button
                    type="button"
                    aria-label="5 minutes de plus"
                    disabled={l.minutes >= 90}
                    onClick={() =>
                      agir((c, m) =>
                        minutesDansProgramme(
                          c,
                          m,
                          s.id,
                          i,
                          Math.min(90, l.minutes + 5),
                        ),
                      )
                    }
                    className={ROND}
                  >
                    <Plus className="size-4" strokeWidth={2.4} />
                  </button>
                </span>
              ) : (
                <span className="shrink-0 text-corps font-semibold tabular-nums">
                  {l.minutes} min
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {!lignes.length && (
        <span className="mono-label py-6 text-center text-encre-3">
          {ecrit ? "Programme à écrire" : "Pas de programme"}
        </span>
      )}
      {ecrit && (
        <div
          className={cn(
            "grid gap-2",
            reprises.length ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          <button
            type="button"
            onClick={() => setBibli(true)}
            className="bouton-principal flex h-12 items-center justify-center gap-2 text-[15px] font-semibold"
          >
            <Plus className="size-4" strokeWidth={2.6} />
            Ajouter un exercice
          </button>
          {reprises.length > 0 && (
            <button
              type="button"
              onClick={() => setReprise(true)}
              className="bouton-secondaire flex h-12 items-center justify-center gap-2 text-[15px] font-semibold"
            >
              <Copy className="size-4" strokeWidth={2.4} />
              Reprendre
            </button>
          )}
        </div>
      )}
      <Feuille titre="Exercices" open={bibli} onOpenChange={setBibli}>
        <ListeExercices
          onAjouter={(e) => {
            if (agir((c, m) => ajouterAuProgramme(c, m, s.id, e.id))) {
              navigator.vibrate?.(10);
              toast.success(`${e.nom} ajouté`);
            }
          }}
        />
      </Feuille>
      <Feuille
        titre="Reprendre un programme"
        open={reprise}
        onOpenChange={setReprise}
      >
        <ul className="flex flex-col gap-2">
          {reprises.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  if (agir((c, m) => reprendreProgramme(c, m, s.id, r.id))) {
                    navigator.vibrate?.([10, 40, 18]);
                    setReprise(false);
                  }
                }}
                className={cn(
                  FICHE,
                  "flex w-full flex-col gap-1 px-4 py-3.5 text-left",
                )}
              >
                <span className="text-lecture font-semibold">
                  {categorieDe(club, r.categorie)?.nom} · {jourLong(r.jour)}
                </span>
                <span className="mono-label text-encre-3">
                  {programmeDit(r.programme)}
                </span>
                <span className="text-corps text-encre-2 text-pretty">
                  {r
                    .programme!.map((l) => exerciceDe(club, l.exercice)?.nom)
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Feuille>
      <Feuille
        titre={exo?.nom ?? "Exercice"}
        open={fiche !== null}
        onOpenChange={(o) => !o && setFiche(null)}
      >
        {exo && fiche !== null && (
          <>
            <span className="mono-label -mt-2 text-encre-3">
              {exerciceDit(exo, ouverte!.minutes)}
            </span>
            <DetailExercice e={exo} />
            {ecrit && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  disabled={fiche === 0}
                  onClick={() =>
                    agir((c, m) =>
                      rangerDansProgramme(c, m, s.id, fiche, -1),
                    ) && setFiche(fiche - 1)
                  }
                  className="bouton-secondaire flex h-11 items-center justify-center gap-1.5 text-corps font-semibold"
                >
                  <ArrowUp className="size-4" strokeWidth={2.4} />
                  Monter
                </button>
                <button
                  type="button"
                  disabled={fiche === lignes.length - 1}
                  onClick={() =>
                    agir((c, m) => rangerDansProgramme(c, m, s.id, fiche, 1)) &&
                    setFiche(fiche + 1)
                  }
                  className="bouton-secondaire flex h-11 items-center justify-center gap-1.5 text-corps font-semibold"
                >
                  <ArrowDown className="size-4" strokeWidth={2.4} />
                  Descendre
                </button>
                <button
                  type="button"
                  onClick={() =>
                    agir((c, m) => retirerDuProgramme(c, m, s.id, fiche)) &&
                    setFiche(null)
                  }
                  className="bouton-secondaire flex h-11 items-center justify-center gap-1.5 text-corps font-semibold"
                >
                  <Trash2 className="size-4" strokeWidth={2.4} />
                  Retirer
                </button>
              </div>
            )}
          </>
        )}
      </Feuille>
    </>
  );
}
