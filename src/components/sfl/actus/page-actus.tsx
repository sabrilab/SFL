"use client";

// Les adresses de l'onglet Actus, une par époque (epoques.tsx) : /ligue (la
// saison en cours), /saisons/N (une saison close), /palmares (le Wall of
// Fame). Les trois pages ne font que poser leur époque ici. L'onglet ouvert
// (Pépite d'Or, Classement, Match ; course.tsx) est dans l'adresse : en
// changer la remplace sans ajouter d'étape à l'historique, et le retour d'un
// récap retrouve l'onglet qu'on avait quitté. Les anciens liens restent bons :
//   · ?vue=classements (et /stats) ouvre l'onglet Classement, ?vue=matchs
//     l'onglet Match ; ?classement=buts ouvre Classement sur les buteurs (un
//     id de lib/sfl/rankings.ts) ;
//   · #j2 (un dimanche touché dans Ma saison) descend jusqu'à ce dimanche ;
//   · ?j=N (une feuille touchée au Vestiaire) ouvre le récap, /ligue/journee ;
//   · ?vue=vestiaire renvoie au Vestiaire ;
//   · ?exploit=… (une félicitation reçue) descend jusqu'à sa rubrique.

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LEAGUE_KEY } from "@/lib/nav";
import { LaCourse } from "./course";
import type { Epoque, Vue } from "./epoques";

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
  const pathname = usePathname();
  const router = useRouter();
  const brute = params.get("vue");
  const vue: Vue = brute === "classements" || brute === "matchs" ? brute : "fil";
  const j = params.get("j");
  const classement = params.get("classement");
  useEffect(() => {
    if (brute === "vestiaire") router.replace("/vestiaire");
    else if (j)
      router.replace(`/ligue/journee?${typeof epoque === "number" ? `saison=${epoque}&` : ""}j=${encodeURIComponent(j)}`);
  }, [brute, j, epoque, router]);
  // Une seule ligue, la SFL : un ancien choix d'une autre ligue est effacé.
  useEffect(() => {
    try {
      if (localStorage.getItem(LEAGUE_KEY) && localStorage.getItem(LEAGUE_KEY) !== "SFL") localStorage.setItem(LEAGUE_KEY, "SFL");
    } catch {}
  }, []);
  const changerDeVue = (v: Vue) => {
    // L'App Router suit history.replaceState : useSearchParams voit le nouvel onglet.
    if (v !== vue) window.history.replaceState(null, "", v === "fil" ? pathname : `${pathname}?vue=${v}`);
    document.getElementById("app-scroll")?.scrollTo({ top: 0 });
  };
  return (
    <LaCourse
      key={`${epoque}|${classement ?? ""}`}
      epoque={epoque}
      vue={vue}
      onVue={changerDeVue}
      classement={classement}
      exploit={params.get("exploit")}
    />
  );
}
