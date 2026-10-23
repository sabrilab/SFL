"use client";

// L'onglet Actus (ex-Ligue) : la course et le fil des dimanches
// (components/sfl/actus/course.tsx). Les anciens liens restent bons :
//   · ?vue=classements (et /stats) ouvre les classements, ?vue=matchs les matchs ;
//   · ?j=N (une feuille touchée au Vestiaire) ouvre le récap, /ligue/journee ;
//   · ?vue=vestiaire renvoie au Vestiaire ;
//   · ?exploit=… (une félicitation reçue) descend jusqu'à sa rubrique.

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LaCourse } from "@/components/sfl/actus/course";
import { LEAGUE_KEY } from "@/lib/nav";

export default function ActusPage() {
  // useSearchParams impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={null}>
      <Actus />
    </Suspense>
  );
}

function Actus() {
  const params = useSearchParams();
  const router = useRouter();
  const vue = params.get("vue");
  const j = params.get("j");
  useEffect(() => {
    if (vue === "vestiaire") router.replace("/vestiaire");
    else if (j) router.replace(`/ligue/journee?j=${encodeURIComponent(j)}`);
  }, [vue, j, router]);
  // Une seule ligue, la SFL : un ancien choix d'une autre ligue est effacé.
  useEffect(() => {
    try {
      if (localStorage.getItem(LEAGUE_KEY) && localStorage.getItem(LEAGUE_KEY) !== "SFL") localStorage.setItem(LEAGUE_KEY, "SFL");
    } catch {}
  }, []);
  return (
    <LaCourse key={vue ?? ""} vueDepart={vue === "classements" || vue === "matchs" ? vue : "fil"} exploit={params.get("exploit")} />
  );
}
