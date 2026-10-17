"use client";

// La fiche d'un match ouvert par un joueur : qui vient (en cartes), qui est
// invité, les places libres, et le seul geste qui compte pour moi ici —
// prendre une place, accepter, me retirer, ou annuler si c'est mon match.

import { useState } from "react";
import { toast } from "sonner";
import { QuiVient } from "@/components/sfl/qui-vient";
import { accepter, annuler, direErreur, inscrits, placesLibres, quitter, rejoindre, type Partie } from "@/lib/sfl/matchs";
import { cn } from "@/lib/utils";

export function FichePartie({ partie, moi, onChange }: { partie: Partie; moi: string | null; onChange: () => void }) {
  const [occupe, setOccupe] = useState(false);
  const venus = inscrits(partie);
  const attendus = partie.joueurs.filter((j) => j.statut === "invite");
  const libres = placesLibres(partie);
  const moiLa = partie.joueurs.find((j) => j.id === moi) ?? null;
  const organise = partie.organisateurId === moi;

  async function faire(action: () => Promise<void>, ok: string) {
    setOccupe(true);
    try {
      await action();
      toast.success(ok);
      onChange();
    } catch (e) {
      toast.error(direErreur(e));
    } finally {
      setOccupe(false);
    }
  }

  const bouton = "flex h-12 items-center justify-center rounded-full text-[15px] font-semibold disabled:opacity-40";

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-[26px] bg-card p-5">
        <div className="flex items-baseline justify-between">
          <p className="mono-label text-muted-foreground">
            {partie.genre === "exhibition" ? "Exhibition" : "Match"} · {partie.visibilite === "prive" ? "privé" : "public"} · par {partie.organisateur}
          </p>
          <p className="text-[22px] font-bold tabular-nums">
            {venus.length}
            <span className="text-muted-foreground">/{partie.places}</span>
          </p>
        </div>
        <QuiVient className="mt-3" noms={venus.map((j) => j.name)} places={libres} />
        {attendus.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mono-label mr-1 text-muted-foreground">Invités</span>
            {attendus.map((j) => (
              <span key={j.id} className="rounded-full bg-secondary px-2.5 py-1 text-[12.5px] font-medium">
                {j.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {moiLa?.statut === "invite" && (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={occupe} onClick={() => faire(() => accepter(partie.id), "C'est noté, tu joues.")} className={cn(bouton, "bg-foreground text-background")}>
            Je viens
          </button>
          <button disabled={occupe} onClick={() => faire(() => quitter(partie.id), "Invitation déclinée.")} className={cn(bouton, "bg-secondary")}>
            Pas dispo
          </button>
        </div>
      )}
      {!moiLa && partie.visibilite === "public" && libres > 0 && (
        <button disabled={occupe || !moi} onClick={() => faire(() => rejoindre(partie.id), "Place prise, à toi de jouer.")} className={cn(bouton, "bg-foreground text-background")}>
          Prendre une place
        </button>
      )}
      {moiLa?.statut === "inscrit" && !organise && (
        <button disabled={occupe} onClick={() => faire(() => quitter(partie.id), "Tu as libéré ta place.")} className={cn(bouton, "bg-secondary")}>
          Me retirer
        </button>
      )}
      {organise && (
        <button
          disabled={occupe}
          onClick={() => {
            if (window.confirm("Annuler ce match pour tout le monde ?")) void faire(() => annuler(partie.id), "Match annulé.");
          }}
          className={cn(bouton, "bg-secondary text-foreground/80")}
        >
          Annuler le match
        </button>
      )}
    </section>
  );
}
