"use client";

// « Créer ma carte officielle » : l'appel principal de Ma carte. Il ouvre la
// photo officielle (photo-studio.tsx : visage à l'appareil photo, maillot,
// filtres), puis le recadrage habituel, et la photo part sur la carte chez
// tout le monde (lib/sfl/photos). Une fois la carte faite, le bouton quitte
// Ma carte (Sabri, 22/10 : il « ne doit plus être présent sur ma carte une
// fois l'action effectuée ») : on la refait depuis « Ma photo »
// (profile-photo.tsx), en touchant sa photo. Le parcours seul
// (FluxCarteOfficielle) sert aussi à l'invitation de l'ouverture
// (invitation-carte.tsx).

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PhotoStudio } from "@/components/sfl/photo-studio";
import { RecadrerPhoto } from "@/components/sfl/recadrer-photo";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { setPhoto } from "@/lib/sfl/photos";
import { ovr, type Player } from "@/lib/sfl/engine";
import { useIdentites } from "@/hooks/use-identites";
import { cn } from "@/lib/utils";

export function CarteOfficielle({ player, className }: { player: Player; className?: string }) {
  const [studio, setStudio] = useState(false);
  const aUnePhoto = usePhotoPerso(player.name) !== null;
  // La photo posée, le parcours est déjà refermé (le recadrage se ferme avant
  // l'envoi) : le bouton peut partir sans rien couper.
  if (aUnePhoto) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setStudio(true)}
        // L'or : c'est la carte à gagner.
        className={cn("bouton-principal bouton--or flex items-center justify-center gap-2 py-[15px] text-[15px] font-bold", className)}
      >
        <Sparkles className="size-4" />
        Créer ma carte officielle
      </button>
      <FluxCarteOfficielle player={player} ouvert={studio} onFermer={() => setStudio(false)} />
    </>
  );
}

/** Le parcours : photo officielle, recadrage, puis la photo part sur la carte. */
export function FluxCarteOfficielle({
  player,
  ouvert,
  onFermer,
}: {
  player: Player;
  ouvert: boolean;
  onFermer: () => void;
}) {
  const [aRecadrer, setARecadrer] = useState<string | null>(null);
  const identite = useIdentites();

  async function valider(dataUrl: string) {
    setARecadrer(null);
    try {
      const r = await setPhoto(player.name, dataUrl);
      if (r.partagee) toast.success("Ta carte officielle est prête", { description: "Elle est sur ta carte, chez tout le monde." });
      else toast.warning("Photo gardée sur cet appareil", { description: r.raison });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo impossible à enregistrer.");
    }
  }

  return (
    <>
      <PhotoStudio
        ouvert={ouvert}
        onFermer={onFermer}
        onChoisir={(dataUrl) => {
          onFermer();
          setARecadrer(dataUrl);
        }}
      />

      <RecadrerPhoto
        src={aRecadrer}
        carte={{
          name: player.name,
          affiche: identite.nom(player.name),
          username: identite.pseudo(player.name),
          position: player.poste,
          overall: ovr(player.stats),
          stats: player.stats,
        }}
        onValider={valider}
        onFermer={() => setARecadrer(null)}
      />
    </>
  );
}
