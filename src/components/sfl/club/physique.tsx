"use client";

// Le physique d'un joueur (Bola Club), sur sa fiche (fiche-joueur-club.tsx),
// pour son staff, lui-même et son parent : sa taille et sa croissance
// (« +0,9 cm par mois · poussée de croissance » : les séances proposées
// allègent sauts et sprints), sa VMA et son allure d'intermittent ; pour un
// adulte, et seulement devant le staff, son poids et son IMC
// (lib/sfl/club/suivi.ts). Le staff ajoute une mesure ; le poids ne se note
// que pour un adulte.

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { jourMoyen } from "@/lib/sfl/club/actus";
import { ajouterMesure } from "@/lib/sfl/club/mutations";
import { ageLe } from "@/lib/sfl/club/regles";
import { croissance, derniereTaille, derniereVma, dernierPoids, enPoussee, imc, virgule } from "@/lib/sfl/club/suivi";
import type { Membre } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CHAMP, Feuille, FICHE, NOMBRE, TitreSection } from "./puces";

function Valeur({ nom, valeur, unite, sous, fort }: { nom: string; valeur: string; unite: string; sous?: string; fort?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="mono-label text-encre-3">{nom}</span>
      <span className="flex items-baseline gap-1">
        <span style={{ ...NOMBRE, fontSize: 34 }} className="tabular-nums">
          {valeur}
        </span>
        <span className="text-corps font-semibold text-encre-2">{unite}</span>
      </span>
      {sous && <span className={cn("text-corps", fort ? "font-semibold text-foreground" : "text-encre-3")}>{sous}</span>}
    </div>
  );
}

const nombre = (t: string) => {
  const n = Number(t.replace(",", ".").trim());
  return t.trim() && Number.isFinite(n) ? n : undefined;
};

export function Physique({ m }: { m: Membre }) {
  const { club, droits, agir } = useClub();
  const [ouvert, setOuvert] = useState(false);
  const [taille, setTaille] = useState("");
  const [poids, setPoids] = useState("");
  const [vma, setVma] = useState("");
  const adulte = ageLe(m.naissance, club.jour) >= 18;
  const staff = droits.gereJoueur(m);
  const poidsPermis = adulte;
  const t = derniereTaille(club, m.id);
  const c = croissance(club, m.id);
  const v = derniereVma(club, m.id);
  const p = dernierPoids(club, m.id);
  const i = imc(club, m.id);
  const poussee = enPoussee(club, m.id);
  const rien = !t && !v;
  if (rien && !staff) return null;
  const noter = () => {
    const n = { tailleCm: nombre(taille), poidsKg: poidsPermis ? nombre(poids) : undefined, vma: nombre(vma) };
    if (!agir((cl, moi) => ajouterMesure(cl, moi, m.id, n))) return;
    navigator.vibrate?.(10);
    toast.success("Mesure ajoutée");
    setTaille("");
    setPoids("");
    setVma("");
    setOuvert(false);
  };
  return (
    <section className="flex flex-col gap-3">
      <TitreSection>Physique</TitreSection>
      {!rien && (
        <div className={cn(FICHE, "grid grid-cols-2 gap-x-4 gap-y-5 p-4")}>
          {t && (
            <Valeur
              nom="Taille"
              valeur={virgule(t.tailleCm!)}
              unite="cm"
              sous={c && !adulte ? `${c.cmParMois >= 0 ? "+" : ""}${virgule(c.cmParMois)} cm par mois${poussee ? " · poussée de croissance" : ""}` : jourMoyen(t.jour)}
              fort={poussee}
            />
          )}
          {v && <Valeur nom="VMA" valeur={virgule(v.vma!)} unite="km/h" sous={`${Math.round(v.vma! * 8.33)} m en 30 s`} />}
          {staff && adulte && p && <Valeur nom="Poids" valeur={virgule(p.poidsKg!)} unite="kg" sous={jourMoyen(p.jour)} />}
          {staff && i !== null && <Valeur nom="IMC" valeur={virgule(i)} unite="kg/m²" />}
        </div>
      )}
      {staff && (
        <button type="button" onClick={() => setOuvert(true)} className="bouton-secondaire flex h-11 items-center justify-center gap-2 text-lecture font-semibold">
          <Plus className="size-4" strokeWidth={2.4} />
          Nouvelle mesure
        </button>
      )}
      <Feuille titre="Mesure" open={ouvert} onOpenChange={setOuvert}>
        <input aria-label="Taille en cm" placeholder="Taille (cm)" inputMode="decimal" value={taille} onChange={(e) => setTaille(e.target.value)} className={CHAMP} />
        <input aria-label="VMA en km/h" placeholder="VMA (km/h)" inputMode="decimal" value={vma} onChange={(e) => setVma(e.target.value)} className={CHAMP} />
        {poidsPermis && (
          <input aria-label="Poids en kg" placeholder="Poids (kg)" inputMode="decimal" value={poids} onChange={(e) => setPoids(e.target.value)} className={CHAMP} />
        )}
        <button type="button" disabled={!taille.trim() && !vma.trim() && !poids.trim()} onClick={noter} className="bouton-principal h-12 text-[15px] font-semibold">
          Ajouter
        </button>
      </Feuille>
    </section>
  );
}
