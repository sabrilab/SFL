"use client";

// Le fil des Actus en variantes (components/sfl/actus/fil-variantes.tsx) :
// ?v=1..5, gardé dans l'adresse pour qu'un lien montre la même chose. Page
// d'essai : rien ne mène ici depuis l'app.

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilActus } from "@/components/sfl/actus/fil";
import { FilVariante, VARIANTES_FIL } from "@/components/sfl/actus/fil-variantes";
import { cn } from "@/lib/utils";

export default function FilVariantesPage() {
  // useSearchParams impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={null}>
      <Variantes />
    </Suspense>
  );
}

function Variantes() {
  const params = useSearchParams();
  const router = useRouter();
  const chemin = usePathname();
  const v = Math.min(VARIANTES_FIL.length, Math.max(1, Number(params.get("v")) || 1));
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="mx-auto flex w-full max-w-[470px] gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
        {VARIANTES_FIL.map((nom, i) => (
          <button
            key={nom}
            type="button"
            aria-pressed={v === i + 1}
            onClick={() => {
              router.replace(`${chemin}?v=${i + 1}`, { scroll: false });
              document.getElementById("app-scroll")?.scrollTo({ top: 0 });
            }}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors",
              v === i + 1 ? "bg-foreground text-background" : "glass text-foreground"
            )}
          >
            V{i + 1} · {nom}
          </button>
        ))}
      </div>
      <FilActus key={v} variante={v === 1 ? undefined : (ouvrirClassements) => <FilVariante v={v} onClassements={ouvrirClassements} />} />
    </div>
  );
}
