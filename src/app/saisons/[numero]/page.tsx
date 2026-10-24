"use client";

// Une saison close, relue telle quelle : depuis le 24/10, une époque de
// l'onglet Actus (components/sfl/actus/epoques.tsx). L'archive voyage dans le
// document de saison ; on la rejoue dans le moteur exactement comme la saison
// en cours (mêmes classements, mêmes journées, mêmes rubriques) et on l'affiche
// en lecture seule : ce qu'on lit ici est ce que la ligue affichait le soir de
// la clôture.

import { useParams } from "next/navigation";
import { PageActus } from "@/components/sfl/actus/page-actus";

export default function SaisonPage() {
  const { numero } = useParams<{ numero: string }>();
  return <PageActus epoque={/^\d+$/.test(numero) ? Number(numero) : -1} />;
}
