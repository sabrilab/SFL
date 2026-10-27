"use client";

// La corbeille de la saison (Admin → Historique → Corbeille).
//
// Tout ce qu'une publication a fait disparaître ces 60 derniers jours — un
// joueur, une journée, une ligne —, lu dans saison_corbeille (schema.sql), du
// plus récent au plus ancien, avec qui l'a fait. « Remettre » le replace dans
// la saison d'aujourd'hui par une publication ordinaire (saisie/corbeille.ts) ;
// ce qui est déjà revenu, par « Annuler » ou à la main, n'y figure plus.

import { useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import {
  dejaLa,
  empechement,
  nommer,
  type ElementCorbeille,
  type LigneCorbeille,
} from "@/lib/sfl/saisie/corbeille";
import type { Saison } from "@/lib/sfl/saisie/types";

const GENRES: Record<ElementCorbeille["genre"], string> = {
  joueur: "Joueur",
  journee: "Journée",
  ligne: "Ligne",
};

function quand(iso: string): string {
  const d = new Date(iso);
  const auj = new Date();
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === auj.toDateString()) return heure;
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${heure}`;
}

export function Corbeille({
  open,
  onOpenChange,
  saison,
  onRemettre,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saison: Saison;
  /** Remet l'élément dans la saison actuelle ; faux s'il n'a pas pu l'être. */
  onRemettre: (x: ElementCorbeille, libelle: string) => boolean;
}) {
  const [lignes, setLignes] = useState<LigneCorbeille[] | null>(null);
  const [noms, setNoms] = useState<Map<string, string>>(new Map());
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!open) return;
    let vivant = true;
    const depuis = new Date(Date.now() - 60 * 86_400_000).toISOString();
    void (async () => {
      const { data, error } = await supabase()
        .from("saison_corbeille")
        .select("id, genre, libelle, element, supprime_le, par")
        .is("restaure_le", null)
        .gte("supprime_le", depuis)
        .order("supprime_le", { ascending: false })
        .limit(300);
      if (!vivant) return;
      if (error) {
        setErreur(true);
        setLignes([]);
        return;
      }
      const rows = (data ?? []) as LigneCorbeille[];
      setErreur(false);
      setLignes(rows);
      const ids = [...new Set(rows.map((r) => r.par).filter((x): x is string => !!x))];
      if (!ids.length) return;
      const { data: profils } = await supabase().from("profiles").select("id, name").in("id", ids);
      if (vivant) setNoms(new Map(((profils ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name])));
    })();
    return () => {
      vivant = false;
    };
  }, [open]);

  const visibles = (lignes ?? []).filter(
    (r) => !dejaLa(saison, { genre: r.genre, element: r.element } as ElementCorbeille)
  );

  async function remettre(r: LigneCorbeille) {
    const x = { genre: r.genre, element: r.element } as ElementCorbeille;
    if (!onRemettre(x, `Remis — ${nommer(x)}`)) return;
    await supabase().from("saison_corbeille").update({ restaure_le: new Date().toISOString() }).eq("id", r.id);
    setLignes((l) => (l ?? []).filter((y) => y.id !== r.id));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="px-1">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Trash2 className="size-5" /> Corbeille
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col divide-y divide-border/60 px-1 pb-6">
          {lignes === null ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">…</p>
          ) : erreur ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">Indisponible ici.</p>
          ) : visibles.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">Vide.</p>
          ) : (
            visibles.map((r) => {
              const x = { genre: r.genre, element: r.element } as ElementCorbeille;
              const bloque = empechement(saison, x);
              const qui = r.par ? noms.get(r.par) : null;
              return (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">{nommer(x)}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {GENRES[r.genre]} · {quand(r.supprime_le)}
                      {qui ? ` · ${qui}` : ""}
                      {bloque ? ` · ${bloque}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!!bloque}
                    onClick={() => void remettre(r)}
                    className="shrink-0 rounded-full"
                  >
                    <RotateCcw className="mr-1.5 size-3.5" /> Remettre
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
