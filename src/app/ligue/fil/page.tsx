"use client";

// Les concepts de l'onglet Actus (components/sfl/actus/concepts.tsx), à
// comparer avec l'onglet tel qu'il est en ligne : ?c=a..d, gardé dans
// l'adresse pour qu'un lien montre la même chose. Page d'essai : rien ne mène
// ici depuis l'app.

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilActus } from "@/components/sfl/actus/fil";
import { Concept, CONCEPTS, type ConceptId } from "@/components/sfl/actus/concepts";
import { cn } from "@/lib/utils";

export default function ConceptsPage() {
  // useSearchParams impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={null}>
      <Concepts />
    </Suspense>
  );
}

const CHOIX = [{ id: "actuel", nom: "En ligne" }, ...CONCEPTS] as const;

function Concepts() {
  const params = useSearchParams();
  const router = useRouter();
  const chemin = usePathname();
  const c = CHOIX.find((x) => x.id === params.get("c"))?.id ?? "a";
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="mx-auto flex w-full max-w-[470px] gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
        {CHOIX.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={c === x.id}
            onClick={() => {
              router.replace(`${chemin}?c=${x.id}`, { scroll: false });
              document.getElementById("app-scroll")?.scrollTo({ top: 0 });
            }}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors",
              c === x.id ? "bg-foreground text-background" : "glass text-foreground"
            )}
          >
            {x.id === "actuel" ? x.nom : `${x.id.toUpperCase()} · ${x.nom}`}
          </button>
        ))}
      </div>
      {c === "actuel" ? <FilActus /> : <Concept key={c} id={c as ConceptId} />}
    </div>
  );
}
