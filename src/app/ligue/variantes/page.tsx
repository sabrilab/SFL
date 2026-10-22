"use client";

// L'onglet League, en variantes à comparer (Sabri, 22/10 : « me faire un
// tour de tout un tas de variantes »). Deux rangées de puces, gardées dans
// l'adresse pour qu'un lien montre la même chose :
//   ?v=1..6 — le contenu (contenus.tsx ; 1 est le fil de /ligue, tel quel) ;
//   ?t=a|b|c — l'en-tête (titres.tsx ; a est l'actuel, ChoixLigue) ;
//   ?l=sfl|bola — la ligue choisie dans les en-têtes b et c.
// Page d'essai : rien ne mène ici depuis l'app.

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilActus } from "@/components/sfl/actus/fil";
import { ChoixLigue } from "@/components/sfl/choix-ligue";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";
import { BoutonStats } from "@/components/layout/bouton-stats";
import { cn } from "@/lib/utils";
import { ClassementDabord, LaSaison, LesLigues, MaPlace, MatchDapres } from "./contenus";
import { TitreLogo, TitrePilule, type Ligue } from "./titres";

const VARIANTES = ["Le fil", "Classement", "La saison", "Ma place", "Les ligues", "Le match d'après"] as const;
const TITRES = ["a", "b", "c"] as const;
type Titre = (typeof TITRES)[number];

export default function VariantesPage() {
  // useSearchParams impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={null}>
      <Variantes />
    </Suspense>
  );
}

function Puce({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors",
        on ? "bg-foreground text-background" : "glass text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Variantes() {
  const params = useSearchParams();
  const router = useRouter();
  const chemin = usePathname();
  const v = Math.min(6, Math.max(1, Number(params.get("v")) || 1));
  const t: Titre = (TITRES as readonly string[]).includes(params.get("t") ?? "") ? (params.get("t") as Titre) : "a";
  const ligue: Ligue = params.get("l") === "bola" ? "bola" : "sfl";

  const poser = (cle: string, val: string) => {
    const p = new URLSearchParams(params.toString());
    p.set(cle, val);
    router.replace(`${chemin}?${p.toString()}`, { scroll: false });
    if (cle === "v") document.getElementById("app-scroll")?.scrollTo({ top: 0 });
  };
  const choisirLigue = (l: Ligue) => poser("l", l);

  return (
    <div className="mx-auto flex w-full max-w-[470px] flex-col gap-6 pt-2 pb-8 sm:pt-6">
      <div className="flex flex-col gap-2">
        <div className="flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
          {VARIANTES.map((nom, i) => (
            <Puce key={nom} on={v === i + 1} onClick={() => poser("v", String(i + 1))}>
              V{i + 1} · {nom}
            </Puce>
          ))}
        </div>
        {v !== 1 && (
          <div className="flex gap-1.5 px-5">
            {TITRES.map((x) => (
              <Puce key={x} on={t === x} onClick={() => poser("t", x)}>
                Titre {x}
              </Puce>
            ))}
          </div>
        )}
      </div>

      {v === 1 ? (
        // Le fil de /ligue, avec son en-tête actuel.
        <div className="-mt-3">
          <FilActus />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 px-5">
            <h1 className="sr-only">League</h1>
            {t === "a" ? (
              <ChoixLigue actif={ligue === "bola" ? "/ligue-vierge" : "/ligue"} />
            ) : t === "b" ? (
              <TitreLogo ligue={ligue} onLigue={choisirLigue} />
            ) : (
              <TitrePilule ligue={ligue} onLigue={choisirLigue} />
            )}
            {t !== "c" && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <BoutonStats className="size-10 sm:size-11" />
                <BoutonRecherche className="size-10 sm:size-11" />
              </div>
            )}
          </div>
          {v === 2 ? (
            <ClassementDabord ligue={ligue} />
          ) : v === 3 ? (
            <LaSaison ligue={ligue} />
          ) : v === 4 ? (
            <MaPlace ligue={ligue} />
          ) : v === 5 ? (
            <LesLigues />
          ) : (
            <MatchDapres ligue={ligue} />
          )}
        </>
      )}
    </div>
  );
}
