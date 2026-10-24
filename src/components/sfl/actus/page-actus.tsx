"use client";

// Les adresses de l'onglet Actus, une par époque (epoques.tsx) : /ligue (la
// saison en cours), /saisons/N (une saison close), /palmares (le Wall of
// Fame). Les trois pages ne font que poser leur époque ici. Les anciens liens
// restent bons :
//   · ?vue=classements (et /stats) ouvre les classements, ?vue=matchs les
//     matchs ; ?classement=buts ouvre les classements sur les buteurs (un id
//     de lib/sfl/rankings.ts) ;
//   · #j2 (un dimanche touché dans Ma saison) descend jusqu'à ce dimanche ;
//   · ?j=N (une feuille touchée au Vestiaire) ouvre le récap, /ligue/journee ;
//   · ?vue=vestiaire renvoie au Vestiaire ;
//   · ?exploit=… (une félicitation reçue) descend jusqu'à sa rubrique.

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LEAGUE_KEY } from "@/lib/nav";
import { LaCourse } from "./course";
import type { Epoque } from "./epoques";

export function PageActus({ epoque }: { epoque: Epoque }) {
  // useSearchParams impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={null}>
      <Actus epoque={epoque} />
    </Suspense>
  );
}

function Actus({ epoque }: { epoque: Epoque }) {
  const params = useSearchParams();
  const router = useRouter();
  const vue = params.get("vue");
  const j = params.get("j");
  const classement = params.get("classement");
  useEffect(() => {
    if (vue === "vestiaire") router.replace("/vestiaire");
    else if (j)
      router.replace(`/ligue/journee?${typeof epoque === "number" ? `saison=${epoque}&` : ""}j=${encodeURIComponent(j)}`);
  }, [vue, j, epoque, router]);
  // Une seule ligue, la SFL : un ancien choix d'une autre ligue est effacé.
  useEffect(() => {
    try {
      if (localStorage.getItem(LEAGUE_KEY) && localStorage.getItem(LEAGUE_KEY) !== "SFL") localStorage.setItem(LEAGUE_KEY, "SFL");
    } catch {}
  }, []);
  return (
    <LaCourse
      key={`${epoque}|${vue ?? ""}|${classement ?? ""}`}
      epoque={epoque}
      vueDepart={vue === "classements" || vue === "matchs" ? vue : "fil"}
      classement={classement}
      exploit={params.get("exploit")}
    />
  );
}
