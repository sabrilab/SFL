"use client";

// Les classements internes d'un club (Bola Club, bola-app#14 : « par
// catégorie : progression, assiduité, buteurs (mois / saison) »). Sous le
// rail des catégories : les puces Progression, Assiduité, Buteurs, et le
// segment Mois / Saison. Le podium dans la hiérarchie des cartes (une
// grande, deux moyennes), puis les lignes : le rang en Anton (les ex æquo le
// partagent), la carte petite, le nom, la valeur (« +4 », « 94 % », « 9 »).
// Le calcul : lib/sfl/club/classements.ts. Noir et blanc : pas de métal ici,
// l'or reste aux cartes MVP.

import { useState } from "react";
import { useClub } from "@/hooks/use-club";
import { classementClub, type ClassementClub, type Periode } from "@/lib/sfl/club/classements";
import { estDeLaCategorie } from "@/lib/sfl/club/regles";
import { Rangee, Tete } from "./effectif";
import { Puces, Segment } from "./puces";
import { useCategorieChoisie } from "./rail-categories";

const CLASSEMENTS: { id: ClassementClub; label: string }[] = [
  { id: "progression", label: "Progression" },
  { id: "assiduite", label: "Assiduité" },
  { id: "buteurs", label: "Buteurs" },
];
const PERIODES: { id: Periode; label: string }[] = [
  { id: "mois", label: "Mois" },
  { id: "saison", label: "Saison" },
];

export function ClassementsClub() {
  const { club, droits } = useClub();
  const [categorie] = useCategorieChoisie();
  const [classement, setClassement] = useState<ClassementClub>("progression");
  const [periode, setPeriode] = useState<Periode>("mois");
  const membres = club.membres.filter((m) =>
    categorie ? estDeLaCategorie(m, categorie) : droits.lit(m.categorie) || (m.surclasseEn !== null && droits.lit(m.surclasseEn)),
  );
  const lignes = classementClub(club, membres, classement, periode);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Puces nom="Classement" choix={CLASSEMENTS} actif={classement} onChange={setClassement} />
        <Segment nom="Période" choix={PERIODES} actif={periode} onChange={setPeriode} className="mx-5" />
      </div>
      <Tete lignes={lignes.slice(0, 3)} />
      <div className="flex flex-col gap-2 px-5">
        {lignes.slice(3).map((l) => (
          <Rangee key={l.membre.id} l={l} rang />
        ))}
      </div>
      {lignes.length === 0 && <span className="mono-label py-8 text-center text-encre-3">Rien pour l&apos;instant</span>}
    </div>
  );
}
