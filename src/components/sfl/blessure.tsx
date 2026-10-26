"use client";

// « Je suis blessé » (Sabri, 26/10) : chaque joueur se déclare blessé depuis
// Ma carte, et se dit remis quand il revient. Sur son profil, tout le monde
// lit combien de journées il a jouées, et lesquelles il a manquées sur
// blessure : ses stats se sont arrêtées là, pas parce qu'il a décroché
// (lib/sfl/blessures.ts). Dans les classements, « Blessé » sous son nom tant
// qu'il l'est (classements.tsx).
//
// Neutre en clair comme en sombre : ni rouge ni bleu (cartes Impact et
// Défensive), ni or.

import { useState } from "react";
import { Bandage } from "lucide-react";
import { useSaisonClose, useSeason } from "@/components/sfl/season-provider";
import { useBilanJournees } from "@/hooks/use-blessures";
import { direJournees, prochaineJournee } from "@/lib/sfl/blessures";
import { declarerBlessure } from "@/lib/sfl/blessures-store";
import { cn } from "@/lib/utils";

/** Le chiffre de tête : « 3 » ou « 3/5 » quand il a manqué des journées. */
export function useChiffreJournees(nom: string): { valeur: string; quoi: string } {
  const b = useBilanJournees(nom);
  const n = b.jouees.length;
  return { valeur: n < b.total ? `${n}/${b.total}` : String(n), quoi: n > 1 || b.total > 1 ? "Journées" : "Journée" };
}

/** Sur un profil : ses journées manquées sur blessure, et s'il l'est encore. Rien s'il n'a jamais été blessé. */
export function LigneBlessure({ nom, className }: { nom: string; className?: string }) {
  const b = useBilanJournees(nom);
  const close = useSaisonClose();
  const enCours = !close && b.enCours;
  if (!enCours && !b.blesse.length) return null;
  const manquees = b.blesse.length
    ? `${direJournees(b.blesse)} ${b.blesse.length > 1 ? "manquées" : "manquée"} sur blessure`
    : null;
  return (
    <div className={cn("glass-soft flex w-full items-center gap-3 rounded-[18px] px-4 py-3", className)}>
      <Bandage className="size-4 shrink-0 text-foreground/60" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] font-semibold">{enCours ? `Blessé depuis la J${enCours.depuis}` : "Blessure"}</span>
        <span className="font-mono text-[11px] text-foreground/50">
          {b.jouees.length} sur {b.total} {b.total > 1 ? "journées jouées" : "journée jouée"}
          {manquees && ` · ${manquees}`}
        </span>
      </span>
    </div>
  );
}

/** Sur Ma carte : se déclarer blessé, ou remis. */
export function BoutonBlessure({ nom }: { nom: string }) {
  const { saison } = useSeason();
  const b = useBilanJournees(nom);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const blesse = !!b.enCours;
  const basculer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await declarerBlessure(saison.numero ?? 0, nom, prochaineJournee(saison), !blesse);
      if (!blesse) navigator.vibrate?.(12);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Pas enregistré.");
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <div className="flex w-full flex-col gap-2">
      <LigneBlessure nom={nom} />
      <button
        type="button"
        onClick={basculer}
        disabled={envoi}
        aria-pressed={blesse}
        className="bouton-secondaire flex w-full items-center justify-center gap-2 py-3.5 text-[14px] font-semibold disabled:opacity-60"
      >
        <Bandage className="size-4" aria-hidden />
        {blesse ? "Je suis remis" : "Je suis blessé"}
      </button>
      {erreur && <p className="text-center text-[12px] text-foreground/55">{erreur}</p>}
    </div>
  );
}
