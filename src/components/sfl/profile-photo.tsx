"use client";

// Photo de profil du joueur — pastille ronde, comme sur les réseaux sociaux.
//
// Elle ne vient que du studio (photo-studio.tsx) : plus de choix dans la
// pellicule (Sabri, 22/10/2026 : « Les utilisateurs ne doivent pas pouvoir
// mettre de cartes de leurs pellicules »). Toucher la pastille ouvre le
// studio, et la photo faite là-bas passe par le recadrage avant de partir.
// Tant que le joueur n'a pas de photo, c'est le grand bouton sous la
// pastille ; ensuite, un simple lien à côté de Retirer et Recadrer.
//
// La photo part à la ligue : elle remplit la carte du joueur chez tout le
// monde (voir lib/sfl/photos).

import { useState } from "react";
import { Crop, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePhotoPerso, usePlayerPhoto } from "@/hooks/use-player-photo";
import { removePhoto, setPhoto } from "@/lib/sfl/photos";
import { RecadrerPhoto } from "@/components/sfl/recadrer-photo";
import { PhotoStudio } from "@/components/sfl/photo-studio";
import { useSeason } from "@/components/sfl/season-provider";
import { ovr } from "@/lib/sfl/engine";
import { useIdentites } from "@/hooks/use-identites";

export function ProfilePhoto({ name }: { name: string }) {
  const src = usePlayerPhoto(name);
  const identite = useIdentites();
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);
  const perso = usePhotoPerso(name);
  const hasCustom = perso !== null;
  const { allPlayers } = useSeason();
  const joueur = allPlayers.find((p) => p.name === name);
  const stats = joueur?.stats ?? { VIT: 60, TIR: 60, PAS: 60, DRI: 60, DEF: 60, PHY: 60 };
  // L'image en cours de recadrage (la photo du studio, ou la photo actuelle).
  const [aRecadrer, setARecadrer] = useState<string | null>(null);
  const [studio, setStudio] = useState(false);

  function fermer() {
    setARecadrer(null);
  }

  async function valider(dataUrl: string) {
    fermer();
    setBusy(true);
    try {
      const r = await setPhoto(name, dataUrl);
      setBroken(false);
      if (r.partagee) toast.success("Photo mise à jour", { description: "Elle est sur ta carte, chez tout le monde." });
      else toast.warning("Photo gardée sur cet appareil", { description: r.raison });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo impossible à enregistrer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setStudio(true)}
          disabled={busy}
          aria-label="Ma photo officielle"
          className="relative size-20 shrink-0 rounded-full transition-opacity active:opacity-70 disabled:opacity-50"
        >
          <span className="block size-20 overflow-hidden rounded-full bg-foreground/10 ring-1 ring-foreground/15">
            {broken ? (
              <span className="flex size-full items-center justify-center text-2xl font-bold text-muted-foreground">
                {name[0]}
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                onError={() => setBroken(true)}
                onLoad={() => setBroken(false)}
                className="size-full object-cover"
              />
            )}
          </span>
          <span className="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full bg-foreground text-background ring-2 ring-background">
            <Sparkles className="size-3.5" />
          </span>
        </button>
  
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Ma photo</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            Elle apparaît sur ta carte, chez tous les joueurs de la ligue.
          </p>
          {hasCustom && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5 -ml-2 h-7 gap-1.5 px-2 text-[12px] text-muted-foreground"
              onClick={() => setStudio(true)}
            >
              <Sparkles className="size-3.5" /> Photo officielle
            </Button>
          )}
          {hasCustom && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5 h-7 gap-1.5 px-2 text-[12px] text-muted-foreground"
              onClick={async () => {
                await removePhoto(name);
                setBroken(false);
                toast.success("Photo retirée");
              }}
            >
              <Trash2 className="size-3.5" /> Retirer
            </Button>
          )}
          {hasCustom && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5 h-7 gap-1.5 px-2 text-[12px] text-muted-foreground"
              onClick={() => setARecadrer(perso)}
            >
              <Crop className="size-3.5" /> Recadrer
            </Button>
          )}
        </div>
      </div>

      {/* Pas encore de photo : la photo officielle passe devant. */}
      {!hasCustom && (
        <Button className="h-12 gap-2 rounded-full text-[15px] font-semibold" onClick={() => setStudio(true)}>
          <Sparkles className="size-4" /> Créer ma photo officielle
        </Button>
      )}

      <PhotoStudio
        ouvert={studio}
        onFermer={() => setStudio(false)}
        onChoisir={(dataUrl) => {
          setStudio(false);
          setARecadrer(dataUrl);
        }}
      />

      <RecadrerPhoto
        src={aRecadrer}
        carte={{ name, affiche: identite.nom(name), username: identite.pseudo(name), position: joueur?.poste ?? "", overall: ovr(stats), stats }}
        onValider={valider}
        onFermer={fermer}
      />
    </div>
  );
}
