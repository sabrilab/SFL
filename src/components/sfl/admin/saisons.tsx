"use client";

// Les saisons — clôturer celle qui finit, ouvrir la suivante, relire les closes.
//
// Clôturer, c'est : tout ce qui a été saisi part en archive (journées, lignes,
// effectif du jour), lisible par tous à /saisons/N ; les compteurs et les
// classements repartent de zéro ; l'effectif et les convocations continuent.
// Les cartes ne bougent pas ici — on les requalifie à part, sous les yeux de
// ce que chacun a produit.
//
// Tant que la saison nouvelle est vierge, la clôture s'annule d'un geste.
// Au-delà, non : on n'écrase jamais du travail saisi.
//
// Les élus des votes (Impact, Défensive) partent avec l'archive : ils ne sont
// jamais écrits dans le document, et les votes d'une saison close ne se
// rechargent plus. La clôture attend donc que les votes soient chargés et que
// le dernier vote soit fermé (minuit, heure de Paris).

import Link from "next/link";
import { useMemo, useState } from "react";
import { Archive, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cloturerSaison, restaurationPossible, restaurerSaison } from "@/lib/sfl/saisie/mutations";
import { estBrouillon } from "@/lib/sfl/saisie/brouillon";
import { numeroSaison, type Saison } from "@/lib/sfl/saisie/types";
import { deriveSeason } from "@/lib/sfl/saisie/engine";
import { appliquerVotes, journeeAvecVote, titresFaibles, votesCharges } from "@/lib/sfl/votes";
import { voteOuvert } from "@/lib/sfl/convocation-temps";
import { useVotes } from "@/hooks/use-votes";

function dateCourte(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function Saisons({
  saison,
  onCommit,
}: {
  saison: Saison;
  onCommit: (next: Saison, label: string) => void;
}) {
  const numero = numeroSaison(saison);
  const archives = saison.archives ?? [];
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState(`Saison ${numero}`);
  const journees = saison.journees.length;
  const lignes = saison.entries.length;
  const vierge = journees === 0 && lignes === 0;
  const votes = useVotes();
  const charges = votesCharges() || !saison.journees.some((m) => m.mvpAuto);
  // Calculé à l'ouverture de la fenêtre : la saison que l'archive gardera, élus compris.
  const titres = useMemo(() => {
    if (!ouvert) return null;
    const brut = deriveSeason(saison);
    const maintenant = new Date();
    return {
      entries: appliquerVotes(saison, brut.journees, votes, maintenant).entries,
      faibles: titresFaibles(saison, brut.journees, votes, maintenant),
      voteEnCours: brut.journees.some((jn) => journeeAvecVote(jn) && voteOuvert(jn.date, maintenant)),
    };
  }, [ouvert, saison, votes]);
  const brouillon = saison.journees.find(estBrouillon);
  const bloque = brouillon
    ? `J${brouillon.j} en brouillon`
    : !charges
      ? "Les votes ne sont pas encore chargés."
      : titres?.voteEnCours
        ? "Le vote du dernier dimanche est ouvert jusqu'à minuit."
        : null;

  return (
    <div className="overflow-hidden rounded-3xl bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="mono-label text-[10px] text-muted-foreground">SAISON EN COURS</p>
          <p className="text-[17px] font-extrabold tracking-tight">Saison {numero}</p>
          <p className="text-[12px] text-muted-foreground">
            {journees} journée{journees > 1 ? "s" : ""} · {lignes} ligne{lignes > 1 ? "s" : ""} saisie{lignes > 1 ? "s" : ""}
            {vierge ? " · rien n'est encore joué" : ""}
          </p>
        </div>
        {restaurationPossible(saison) ? (
          <Button
            variant="outline"
            size="sm"
            className="bouton--rouge rounded-full"
            onClick={() => onCommit(restaurerSaison(saison), `Clôture annulée — retour à la saison ${numero - 1}`)}
          >
            <RotateCcw className="mr-1.5 size-3.5" /> Annuler la clôture
          </Button>
        ) : (
          <Button size="sm" variant="vert" className="rounded-full" disabled={vierge} onClick={() => { setNom(`Saison ${numero}`); setOuvert(true); }}>
            <Archive className="mr-1.5 size-3.5" /> Clôturer la saison
          </Button>
        )}
      </div>

      {archives.length > 0 && (
        <div className="border-t border-border/60">
          {[...archives].reverse().map((a) => (
            <Link
              key={a.numero}
              href={`/saisons/${a.numero}`}
              className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 last:border-0 active:bg-secondary"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <span className="mono-label text-[10px] text-primary">S{a.numero}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{a.nom}</span>
                <span className="block text-[11.5px] text-muted-foreground">
                  {a.journees.length} journées · {a.entries.length} lignes · close le {dateCourte(a.cloturee)}
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Clôturer la saison {numero} et ouvrir la saison {numero + 1}</DialogTitle>
            {/* Un bloc, pas un paragraphe : base-ui remplace l'élément par `render`. */}
            <DialogDescription render={<div />} className="space-y-2 text-left text-[13.5px]">
              <div>
                <p>
                  Les {journees} journées et leurs {lignes} lignes partent en archive, lisibles par
                  toute la ligue dans « {nom || `Saison ${numero}`} ». Rien n&apos;est effacé.
                </p>
                <p>
                  Les compteurs, les classements et les cartes de journée repartent de zéro.
                  L&apos;effectif reste ; les cartes de chacun sont à requalifier dans l&apos;onglet Joueurs.
                </p>
                <p className="text-muted-foreground">
                  Tant que la saison {numero + 1} est vierge, tu pourras annuler la clôture d&apos;un geste.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <label className="block">
            <span className="mono-label text-[10px] text-muted-foreground">NOM DE L&apos;ARCHIVE</span>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} className="mt-1 rounded-xl" maxLength={40} />
          </label>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setOuvert(false)}>Pas maintenant</Button>
            <Button
              variant="vert"
              className="rounded-full"
              disabled={!!bloque || !titres}
              title={bloque ?? undefined}
              onClick={() => {
                if (!titres || bloque) return;
                onCommit(cloturerSaison(saison, nom, titres), `Clôture de la saison ${numero}`);
                setOuvert(false);
              }}
            >
              {bloque ?? `Clôturer et ouvrir la saison ${numero + 1}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
