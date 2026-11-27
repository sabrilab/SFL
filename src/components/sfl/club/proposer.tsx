"use client";

// « Proposer une séance » (Bola Club), en tête du programme d'un
// entraînement à venir (programme.tsx) : l'entraîneur choisit l'objectif
// (les objectifs qu'on propose à l'âge de la catégorie) et la durée ; la
// feuille montre la séance proposée (lib/sfl/club/proposition.ts), exercice
// par exercice avec ses minutes, et dessous pourquoi : l'âge, le nombre de
// convoqués, les joueurs en poussée de croissance, le ressenti de la
// dernière séance (lib/sfl/club/suivi.ts), ce qui a été écarté. « Autre proposition » en tire une autre ;
// « Prendre cette séance » la pose (elle remplace le programme), et
// l'entraîneur la modifie ensuite comme il veut.

import { useState } from "react";
import { LayoutList, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { exerciceDe, themeDit } from "@/lib/sfl/club/exercices";
import { poserProgramme } from "@/lib/sfl/club/mutations";
import { ageType, DUREES, objectifsPour, proposer, qualiteDite } from "@/lib/sfl/club/proposition";
import { dernierRessenti, enCroissanceParmi } from "@/lib/sfl/club/suivi";
import type { Qualite, Seance } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { Feuille, FICHE, NOMBRE, Puces, Segment } from "./puces";

export function ProposerSeance({ s, principal }: { s: Seance; principal: boolean }) {
  const { club, agir } = useClub();
  const [ouvert, setOuvert] = useState(false);
  const cat = club.categories.find((c) => c.id === s.categorie) ?? null;
  const objectifs = objectifsPour(ageType(cat));
  const [objectif, setObjectif] = useState<Qualite>(objectifs[0]);
  const [minutes, setMinutes] = useState<(typeof DUREES)[number]>(90);
  const [essai, setEssai] = useState(0);
  // Les présents annoncés, sinon tous les convoqués.
  const presents = Object.values(s.reponses).filter((r) => r === "present").length;
  const joueurs = presents || s.convoques.length;
  // Les présents annoncés (sinon les convoqués) en poussée de croissance, et le ressenti de la dernière séance.
  const groupe = presents ? s.convoques.filter((id) => s.reponses[id] === "present") : s.convoques;
  const p = proposer(club, s, {
    objectif,
    minutes,
    joueurs,
    essai,
    enCroissance: enCroissanceParmi(club, groupe),
    dernierRessenti: dernierRessenti(club, s.categorie, s.jour),
  });
  const prendre = () => {
    if (!agir((c, moi) => poserProgramme(c, moi, s.id, p.lignes))) return;
    navigator.vibrate?.([10, 40, 18]);
    toast.success("Séance posée");
    setOuvert(false);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={cn(principal ? "bouton-principal" : "bouton-secondaire", "flex h-12 items-center justify-center gap-2 text-[15px] font-semibold")}
      >
        <LayoutList className="size-4" strokeWidth={2.4} />
        Proposer une séance
      </button>
      <Feuille titre="Séance proposée" open={ouvert} onOpenChange={setOuvert}>
        <Puces nom="Objectif" choix={objectifs.map((q) => ({ id: q, label: qualiteDite(q) }))} actif={objectif} onChange={(q) => (setObjectif(q), setEssai(0))} className="-mx-5" />
        <Segment nom="Durée" choix={DUREES.map((d) => ({ id: String(d), label: `${d} min` }))} actif={String(minutes)} onChange={(d) => (setMinutes(Number(d) as (typeof DUREES)[number]), setEssai(0))} />
        <ol className="flex flex-col gap-2">
          {p.lignes.map((l, i) => {
            const e = exerciceDe(club, l.exercice);
            return (
              <li key={l.exercice} className={cn(FICHE, "flex items-center gap-3 px-4 py-3")}>
                <span style={{ ...NOMBRE, fontSize: 22 }} className="w-5 shrink-0 text-center text-encre-3 tabular-nums">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-lecture font-semibold text-balance">{e?.nom}</span>
                  {e && <span className="mono-label text-encre-3">{themeDit(e.theme)}</span>}
                </span>
                <span className="shrink-0 text-corps font-semibold tabular-nums">{l.minutes} min</span>
              </li>
            );
          })}
        </ol>
        <ul className="flex flex-col gap-1.5">
          {p.raisons.map((r) => (
            <li key={r} className="flex gap-2 text-corps text-encre-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-foreground/40" />
              <span className="text-pretty">{r}</span>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button type="button" aria-label="Autre proposition" onClick={() => setEssai((n) => n + 1)} className="bouton-secondaire grid size-12 place-items-center">
            <RefreshCw className="size-[18px]" strokeWidth={2.2} />
          </button>
          <button type="button" disabled={!p.lignes.length} onClick={prendre} className="bouton-principal h-12 text-[15px] font-semibold">
            {s.programme?.length ? "Remplacer le programme" : "Prendre cette séance"}
          </button>
        </div>
      </Feuille>
    </>
  );
}
