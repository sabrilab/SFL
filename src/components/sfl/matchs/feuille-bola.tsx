"use client";

// La feuille d'un match Bola, tenue par l'organisateur après le coup d'envoi :
// chaque joueur chez les Clairs, chez les Foncés ou absent, ses buts, ses
// passes ; le score en haut, jamais sous les buts marqués. Corrigeable 24 h
// (la base ferme la feuille ensuite).
//
// Le MVP n'est jamais choisi ici : l'app le tire des stats (le plus haut
// buts + passes du match, ex æquo compris), et il s'affiche dès qu'il change.

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { direErreur, saisirFeuille, type EquipeFeuille, type Partie } from "@/lib/sfl/matchs";
import { mvpsDuMatch } from "@/lib/sfl/ligue-vierge";
import { cn } from "@/lib/utils";
import { Nom } from "@/components/sfl/nom";

interface Ligne {
  playerId: string;
  name: string;
  equipe: EquipeFeuille;
  buts: number;
  passes: number;
}

function lignesDe(p: Partie): Ligne[] {
  // Rien de saisi : les inscrits répartis un sur deux, les invités sans réponse absents.
  let i = 0;
  return p.joueurs.map((j) => ({
    playerId: j.id,
    name: j.name,
    equipe: j.equipe ?? (j.statut === "inscrit" ? (i++ % 2 === 0 ? "clairs" : "fonces") : "absent"),
    buts: j.buts,
    passes: j.passes,
  }));
}

function Pas({ valeur, min = 0, onChange, label }: { valeur: number; min?: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <button
        type="button"
        aria-label={`${label} : un de moins`}
        disabled={valeur <= min}
        onClick={() => onChange(valeur - 1)}
        className="bouton-secondaire grid size-8 place-items-center disabled:opacity-30"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-6 text-center text-[17px] font-bold tabular-nums">{valeur}</span>
      <button
        type="button"
        aria-label={`${label} : un de plus`}
        disabled={valeur >= 99}
        onClick={() => onChange(valeur + 1)}
        className="bouton-secondaire grid size-8 place-items-center"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

const EQUIPES: { id: EquipeFeuille; libelle: string }[] = [
  { id: "clairs", libelle: "Clairs" },
  { id: "fonces", libelle: "Foncés" },
  { id: "absent", libelle: "Absent" },
];

export function FeuilleBola({
  partie,
  open,
  onOpenChange,
  onSaisie,
  apercu = false,
}: {
  partie: Partie;
  /** Une feuille de démonstration : rien n'est envoyé. */
  apercu?: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaisie: () => void;
}) {
  const [lignes, setLignes] = useState<Ligne[]>(() => lignesDe(partie));
  const [score, setScore] = useState({ clairs: partie.scoreClairs ?? 0, fonces: partie.scoreFonces ?? 0 });
  const [envoi, setEnvoi] = useState(false);

  const butsDe = (e: "clairs" | "fonces") => lignes.filter((l) => l.equipe === e).reduce((s, l) => s + l.buts, 0);
  const passesDe = (e: "clairs" | "fonces") => lignes.filter((l) => l.equipe === e).reduce((s, l) => s + l.passes, 0);
  const min = { clairs: butsDe("clairs"), fonces: butsDe("fonces") };
  const mvps = useMemo(
    () => new Set(mvpsDuMatch(lignes.filter((l) => l.equipe !== "absent").map((l) => ({ id: l.playerId, buts: l.buts, passes: l.passes })))),
    [lignes]
  );
  // Une passe mène à un but de son équipe : jamais plus de passes que de buts.
  const coherent = passesDe("clairs") <= score.clairs && passesDe("fonces") <= score.fonces;
  const presents = lignes.filter((l) => l.equipe !== "absent").length;

  function changer(id: string, patch: Partial<Ligne>) {
    const suivantes = lignes.map((l) => (l.playerId === id ? { ...l, ...patch } : l));
    // Le score suit les buts : il ne descend jamais sous ceux qu'on a marqués.
    const b = (e: "clairs" | "fonces") => suivantes.filter((l) => l.equipe === e).reduce((s, l) => s + l.buts, 0);
    setLignes(suivantes);
    setScore((s) => ({ clairs: Math.max(s.clairs, b("clairs")), fonces: Math.max(s.fonces, b("fonces")) }));
  }

  async function valider() {
    setEnvoi(true);
    try {
      if (apercu) {
        toast("Aperçu : rien n'est enregistré.");
        onOpenChange(false);
        return;
      }
      await saisirFeuille(partie.id, {
        scoreClairs: score.clairs,
        scoreFonces: score.fonces,
        lignes: lignes.map(({ playerId, equipe, buts, passes }) => ({ playerId, equipe, buts, passes })),
      });
      toast.success("Feuille enregistrée, le classement Bola est à jour.");
      onSaisie();
      onOpenChange(false);
    } catch (e) {
      toast.error(direErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-[26px] font-bold tracking-tight">Feuille de match</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4">
          {/* Le score, les deux équipes face à face. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[26px] bg-card p-4">
            {(["clairs", "fonces"] as const).map((e, i) => (
              <div key={e} className={cn("flex flex-col items-center gap-2", i === 1 && "col-start-3")}>
                <span className="mono-label text-muted-foreground">{e === "clairs" ? "Clairs" : "Foncés"}</span>
                <span className="text-[44px] leading-none font-extrabold tracking-tight tabular-nums">{score[e]}</span>
                <Pas valeur={score[e]} min={min[e]} label={`Score des ${e === "clairs" ? "Clairs" : "Foncés"}`} onChange={(n) => setScore((s) => ({ ...s, [e]: n }))} />
              </div>
            ))}
            <span className="col-start-2 row-start-1 text-[28px] font-bold text-foreground/25">–</span>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-1">
              <span />
              <span className="mono-label w-[88px] text-center text-muted-foreground">Buts</span>
              <span className="mono-label w-[88px] text-center text-muted-foreground">Passes</span>
            </div>
            {lignes.map((l) => (
              <div key={l.playerId} className={cn("flex flex-col gap-2 rounded-2xl bg-card p-3", l.equipe === "absent" && "opacity-55")}>
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold">
                    <span className="truncate"><Nom n={l.name} /></span>
                    {mvps.has(l.playerId) && (
                      <span className="shrink-0 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-background">MVP</span>
                    )}
                  </span>
                  {l.equipe === "absent" ? (
                    <span className="col-span-2" />
                  ) : (
                    <>
                      <Pas valeur={l.buts} label={`Buts de ${l.name}`} onChange={(n) => changer(l.playerId, { buts: n })} />
                      <Pas valeur={l.passes} label={`Passes de ${l.name}`} onChange={(n) => changer(l.playerId, { passes: n })} />
                    </>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-full bg-secondary p-1">
                  {EQUIPES.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => changer(l.playerId, { equipe: o.id })}
                      className={cn(
                        "rounded-full py-1.5 text-[13px] font-semibold transition-colors",
                        l.equipe === o.id ? "bg-foreground text-background" : "text-muted-foreground"
                      )}
                    >
                      {o.libelle}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={envoi || !coherent || presents < 2}
            onClick={valider}
            className="bouton-principal flex h-12 items-center justify-center text-[15px] font-semibold disabled:opacity-40"
          >
            {coherent ? `Valider · ${score.clairs} – ${score.fonces}` : "Plus de passes que de buts"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
