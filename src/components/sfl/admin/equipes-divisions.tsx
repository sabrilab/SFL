"use client";

// Les équipes de dimanche en divisions, vues par l'admin.
//
// Dès la J4, plus de composition à la main (Sabri, 23/10 : « c'est plus
// l'admin qui doit sélectionner ») : le serveur compose les équipes le
// vendredi à 18 h, une division par terrain (lib/sfl/equipes-division.ts),
// et les tient à jour jusqu'au coup d'envoi. Ici, l'admin les voit venir :
//   · avant vendredi 18 h, l'aperçu de ce qui se composerait maintenant ;
//   · ensuite, les équipes de la convocation, terrain par terrain.
// Il peut les composer plus tôt, les recomposer avec les réponses du moment,
// et, le jour venu, les poser sur la feuille de la journée en un geste.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, RefreshCw, Users } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import type { PresenceView } from "@/hooks/use-presence";
import type { EtatDivisions } from "@/lib/sfl/divisions";
import { composer, HEURE_DES_EQUIPES, terrainsDesEquipes } from "@/lib/sfl/equipes-division";
import { PointMaillot } from "@/components/sfl/point-maillot";
import { joueursDeLaFeuille } from "@/lib/sfl/presence-feuille";
import { lireEquipe } from "@/lib/sfl/saisie/equipes";
import type { ConvocationTeam } from "@/lib/sfl/saisie/types";

export function EquipesParDivision({
  presence,
  etat,
  onPoser,
}: {
  presence: PresenceView;
  etat: EtatDivisions;
  /** Pose les équipes sur la feuille de la journée (l'admin écrit la saison) ; `date` : « 1 novembre ». */
  onPoser?: (j: number, teams: ConvocationTeam[], date: string) => void;
}) {
  const { saison } = useSeason();
  const [saving, setSaving] = useState(false);
  const venus = presence.presents;
  // La liste change d'identité à chaque rendu ; la composition ne suit que son contenu.
  const cle = venus.join("\n");
  const apercu = useMemo(() => composer(saison, cle ? cle.split("\n") : [], etat), [saison, cle, etat]);
  const enBase = presence.teams && presence.teams.length > 0 ? presence.teams : null;
  const affichees = enBase ?? apercu.teams;
  const surLaFeuille = joueursDeLaFeuille(saison, presence.journee).equipes;
  const note = (n: string) => apercu.niveaux.get(n)?.note ?? null;

  async function enregistrer(teams: ConvocationTeam[], message: string) {
    if (!presence.saveTeams) return;
    setSaving(true);
    const ok = await presence.saveTeams(teams);
    setSaving(false);
    if (ok) toast.success(message);
    else toast.error("Enregistrement impossible. Réessaie dans un instant.");
  }

  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" /> Les équipes de la J{presence.journee}
        </span>
        <span className="mono-label shrink-0 text-foreground/40">
          {venus.length} confirmé{venus.length > 1 ? "s" : ""}
        </span>
      </div>
      <p className="mono-label text-foreground/45">
        {surLaFeuille
          ? "Sur la feuille de la journée"
          : enBase
            ? presence.equipesVisibles
              ? "Faites par division · visibles par la ligue"
              : "Faites par division · révélées vendredi 19h"
            : `Aperçu · composées vendredi à ${HEURE_DES_EQUIPES.heure}h`}
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {terrainsDesEquipes(affichees, etat).map(({ label, equipes }) => (
          <div key={label} className="rounded-2xl bg-secondary/40 p-3">
            <p className="mono-label mb-1.5 text-foreground/50">{label}</p>
            {equipes.map((t) => {
              const notes = t.players.map(note).filter((x): x is number => x != null);
              const moyenne = notes.length ? Math.round(notes.reduce((s, x) => s + x, 0) / notes.length) : null;
              const camp = lireEquipe(t.name)?.camp;
              return (
                <div key={t.name} className="py-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[13px] font-bold">
                      {camp && <PointMaillot camp={camp} />}
                      {camp ?? t.name}
                    </span>
                    {moyenne != null && <span className="mono-label text-foreground/40">OVR {moyenne}</span>}
                  </div>
                  <p className="text-[12.5px] leading-snug text-foreground/55">{t.players.join(" · ")}</p>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {presence.saveTeams && !surLaFeuille && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => void enregistrer(apercu.teams, enBase ? "Équipes recomposées" : "Équipes composées")}
            disabled={saving || apercu.teams.length < 2}
            className="bouton-secondaire bouton--vert flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-bold disabled:opacity-50"
          >
            <RefreshCw className="size-3.5" /> {enBase ? "Recomposer" : "Composer maintenant"}
          </button>
          {enBase && onPoser && (
            <button
              onClick={() => onPoser(presence.journee, enBase, presence.jour.replace(/^\S+\s+/, ""))}
              className="bouton-principal bouton--vert flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-bold"
            >
              <ClipboardList className="size-3.5" /> Poser sur la feuille de la J{presence.journee}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
