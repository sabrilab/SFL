"use client";

// CONVOCATION : la vraie, celle à laquelle les joueurs répondent
// (public.convocations, public.presence) — « 18 OUI · 3 NON · 49 SANS
// RÉPONSE » en mots, la rangée des cartes de ceux qui viennent, et « Il
// manque N » en braise, le seul endroit de l'admin où elle apparaît. Toucher
// la rangée ouvre la feuille Convocation : toutes les réponses en cartes, et
// la correction d'une réponse d'un toucher (marquée « corrigé »).

import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { QuiVient } from "@/components/sfl/qui-vient";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import type { PresenceView } from "@/hooks/use-presence";
import { corrigerPresence } from "@/lib/sfl/presence-admin";
import { haptique } from "@/lib/sfl/haptique";
import { cn } from "@/lib/utils";
import { Etiquette, Feuille, Segmente } from "./ui";

/** Il manque N : pour remplir les terrains (10 par match). */
export function manque(presence: PresenceView, matchs: number): number {
  const places = Math.max(1, matchs) * 10;
  return Math.max(0, places - presence.presents.length - presence.remplacants.length);
}

export function BlocConvocation({ presence, matchs, onOuvrir }: { presence: PresenceView; matchs: number; onOuvrir: () => void }) {
  const n = manque(presence, matchs);
  return (
    <section className="flex flex-col gap-2">
      <button type="button" onClick={onOuvrir} className="flex items-center justify-between gap-2 text-left">
        <Etiquette>Convocation · {presence.jour}</Etiquette>
        <ChevronRight className="size-4 text-foreground/40" />
      </button>
      <p className="mono-label text-foreground/75">
        {presence.presents.length} oui · {presence.absents.length} non · {presence.sansReponse.length} sans réponse
      </p>
      {presence.presents.length > 0 && (
        <div className="-mx-1">
          <QuiVient noms={presence.ordreDesVenus.length ? presence.ordreDesVenus : presence.presents} />
        </div>
      )}
      {n > 0 && <p className="text-[15px] font-semibold text-[#FF8A4C]">Il manque {n}</p>}
    </section>
  );
}

type Onglet = "oui" | "non" | "sans";

export function FeuilleConvocation({ open, onOpenChange, presence }: { open: boolean; onOpenChange: (o: boolean) => void; presence: PresenceView }) {
  const [onglet, setOnglet] = useState<Onglet>("oui");
  const [corriges, setCorriges] = useState<Set<string>>(() => new Set());
  const listes: Record<Onglet, string[]> = { oui: presence.presents, non: presence.absents, sans: presence.sansReponse };
  const suivante = (o: Onglet) => (o === "oui" ? "absent" : o === "non" ? null : "present");

  async function corriger(nom: string) {
    if (presence.convocationId == null) return;
    const r = suivante(onglet);
    haptique.choix();
    const erreur = await corrigerPresence(presence.convocationId, nom, r);
    if (erreur) {
      haptique.refus();
      toast(erreur);
      return;
    }
    setCorriges((s) => new Set(s).add(nom));
  }

  return (
    <Feuille open={open} onOpenChange={onOpenChange} titre="Convocation" etat={<span className="mono-label text-foreground/55">{presence.jour}</span>} haute>
      <Segmente
        taille="sm"
        label="Réponses"
        options={[
          { id: "oui" as const, libelle: `Oui · ${presence.presents.length}` },
          { id: "non" as const, libelle: `Non · ${presence.absents.length}` },
          { id: "sans" as const, libelle: `Sans · ${presence.sansReponse.length}` },
        ]}
        valeur={onglet}
        onChange={setOnglet}
      />
      {presence.remplacants.length > 0 && onglet === "oui" && (
        <p className="mono-label text-foreground/55">{presence.remplacants.length} remplaçants</p>
      )}
      <div className="grid grid-cols-3 gap-3 min-[430px]:grid-cols-4">
        {listes[onglet].map((nom) => (
          <button
            key={nom}
            type="button"
            disabled={presence.convocationId == null}
            onClick={() => void corriger(nom)}
            className="flex flex-col items-center gap-1 transition-transform active:scale-95"
          >
            <CarteDe name={nom} size={FORMAT_CARTE.petite * 1.3} inerte />
            <span className={cn("max-w-full truncate text-[12px] font-semibold")}>
              <Nom n={nom} />
            </span>
            {corriges.has(nom) && <span className="mono-label text-foreground/55">corrigé</span>}
          </button>
        ))}
      </div>
      {listes[onglet].length === 0 && <p className="mono-label py-8 text-center text-foreground/40">Personne</p>}
    </Feuille>
  );
}
