"use client";

// Les classements internes d'un club (Bola Club, bola-app#14 : « par
// catégorie : progression, assiduité, buteurs (mois / saison) »). Sous le
// rail des catégories : les puces Progression, Assiduité, Buteurs, et le
// segment Mois / Saison. Quand plus de trois joueurs partagent la première
// place (l'assiduité d'un mois sans absent), il n'y a pas de podium : tous
// sont en lignes, au rang 1. Le podium dans la hiérarchie des cartes (une
// grande, deux moyennes), puis les lignes : le rang en Anton (les ex æquo le
// partagent ; à valeur égale, la note, les présences ou les passes
// départagent), la carte petite, le nom, la valeur (« +4 », « 16 / 17 »,
// « 9 »). Seuls les licenciés actifs y sont classés. Le calcul :
// lib/sfl/club/classements.ts. Noir et blanc : pas de métal ici,
// l'or reste aux cartes MVP.

import { useState } from "react";
import { useClub } from "@/hooks/use-club";
import { aUnPodium, classementClub, type ClassementClub, type Periode } from "@/lib/sfl/club/classements";
import { estDeLaCategorie, licenceActive } from "@/lib/sfl/club/regles";
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
  const membres = club.membres.filter((m) => droits.voitJoueur(m) && licenceActive(club, m.id) && (!categorie || estDeLaCategorie(m, categorie)));
  const lignes = classementClub(club, membres, classement, periode);
  const podium = aUnPodium(lignes);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Puces nom="Classement" choix={CLASSEMENTS} actif={classement} onChange={setClassement} />
        <Segment nom="Période" choix={PERIODES} actif={periode} onChange={setPeriode} className="mx-5" />
      </div>
      {/* Plus de trois premiers ex æquo : pas de podium, il n'aurait pas de sens ; la liste dit leur rang. */}
      {podium && <Tete lignes={lignes.slice(0, 3)} />}
      <div className="flex flex-col gap-2 px-5">
        {lignes.slice(podium ? 3 : 0).map((l) => (
          <Rangee key={l.membre.id} l={l} rang />
        ))}
      </div>
      {lignes.length === 0 && <span className="mono-label py-8 text-center text-encre-3">Rien pour l&apos;instant</span>}
    </div>
  );
}
